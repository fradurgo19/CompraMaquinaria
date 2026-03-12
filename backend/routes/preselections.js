/**
 * Rutas de Preselecciones (Preselections)
 * Módulo previo a subastas para evaluación de equipos
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { clearPreselectionNotifications, checkAndExecuteRules, triggerNotificationForEvent } from '../services/notificationTriggers.js';
import { syncPreselectionToAuction } from '../services/syncBidirectionalPreselectionAuction.js';

const router = express.Router();

router.use(authenticateToken);

const CITY_TIME_OFFSETS = {
  TOKYO: 9,        // GMT+9 (9 horas adelante de UTC)
  TOKIO: 9,        // Alias para Tokio
  NEW_YORK: -5,    // GMT-5 (5 horas atrás de UTC)
  NUEVA_YORK: -5,  // Alias para Nueva York
  CALIFORNIA: -8,  // GMT-8 (8 horas atrás de UTC)
  UNITED_KINGDOM: 0, // GMT+0 (misma hora que UTC, o GMT+1 en horario de verano)
  UK: 0,           // Alias para United Kingdom
  LEEDS: 0,        // Leeds, UK (GMT+0)
  LEEDS_UK: 0,     // Leeds, UK (GMT+0)
  BERLIN: 1,       // Berlin, Germany (GMT+1)
  GERMANY: 1,      // Germany (GMT+1)
  MADRID_ESP: 1,   // Madrid, España (GMT+1)
  ON: -5,          // ON, Canada (GMT-5) - Ontario, Canada
  ON_CANADA: -5,   // ON, Canada (GMT-5)
  CANADA: -5,      // Canada (GMT-5) - zona horaria del este
  ONTARIO: -5,     // Ontario, Canada (GMT-5)
  BEIJING: 8,      // Beijing, China (GMT+8)
  CHINA: 8,        // China (GMT+8)
};
const COLOMBIA_OFFSET = -5; // Colombia es GMT-5 (5 horas atrás de UTC)
const HOUR_IN_MS = 60 * 60 * 1000;

const normalizeMachineType = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
};

const calculateColombiaTime = (auctionDate, localTime, city) => {
  if (!auctionDate || !localTime || !city) return null;
  
  // Normalizar el nombre de la ciudad para que coincida con las claves del objeto
  // Acepta formatos como: "Tokio, Japón (GMT+9)", "TOKYO", "Tokyo", etc.
  let normalizedCity = city.toUpperCase().trim();
  
  // Extraer solo el nombre de la ciudad si viene con formato "Ciudad, País (GMT+X)"
  // Ejemplo: "Tokio, Japón (GMT+9)" -> "TOKIO"
  const cityMatch = normalizedCity.match(/^([^,\(]+)/);
  if (cityMatch) {
    normalizedCity = cityMatch[1].trim();
  }
  
  // Reemplazar espacios con guiones bajos y mapear nombres comunes
  normalizedCity = normalizedCity.replace(/\s+/g, '_');
  
  // Mapear variaciones comunes de nombres de ciudades
  const cityMapping = {
    'TOKIO': 'TOKYO',
    'TOKYO': 'TOKYO',
    'NUEVA_YORK': 'NEW_YORK',
    'NEW_YORK': 'NEW_YORK',
    'NUEVA_YORK_USA': 'NEW_YORK',
    'NEW_YORK_USA': 'NEW_YORK',
    'NUEVA_YORK,_USA': 'NEW_YORK',
    'NEW_YORK,_USA': 'NEW_YORK',
    'CALIFORNIA': 'CALIFORNIA',
    'CALIFORNIA_USA': 'CALIFORNIA',
    'REINO_UNIDO': 'UNITED_KINGDOM',
    'UNITED_KINGDOM': 'UNITED_KINGDOM',
    'UNITED_KINGDOM_UK': 'UNITED_KINGDOM',
    'UK': 'UK',
    'LEEDS': 'LEEDS',
    'LEEDS,_UK': 'LEEDS',
    'LEEDS,_REINO_UNIDO': 'LEEDS',
    'BERLIN': 'BERLIN',
    'BERLIN,_GERMANY': 'BERLIN',
    'BERLIN,_ALEMANIA': 'BERLIN',
    'GERMANY': 'GERMANY',
    'ALEMANIA': 'GERMANY',
    'LEEDS_UK': 'LEEDS_UK',
    'MADRID_ESP': 'MADRID_ESP',
    'MADRID': 'MADRID_ESP',
    'MADRID,_ESPAÑA': 'MADRID_ESP',
    'ESPAÑA': 'MADRID_ESP',
    'ON': 'ON',
    'ON_CANADA': 'ON_CANADA',
    'ON,_CANADA': 'ON',
    'ONTARIO': 'ONTARIO',
    'ONTARIO,_CANADA': 'ONTARIO',
    'CANADA': 'CANADA',
    'BEIJING': 'BEIJING',
    'BEIJING,_CHINA': 'BEIJING',
    'PEKIN': 'BEIJING',
    'PEKIN,_CHINA': 'BEIJING',
    'CHINA': 'CHINA'
  };
  
  const mappedCity = cityMapping[normalizedCity] || normalizedCity;
  const cityOffset = CITY_TIME_OFFSETS[mappedCity];
  
  if (cityOffset === undefined) {
    console.warn(`⚠️ Ciudad no reconocida para cálculo de hora: "${city}" (normalizada: "${mappedCity}")`);
    return null;
  }

  const [hoursStr, minutesStr] = localTime.split(':');
  if (hoursStr === undefined || minutesStr === undefined) return null;
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  // Parsear la fecha de subasta
  // La fecha puede venir en formato "2026-01-09" (ISO) o "2026-01-09T00:00:00" o "13/1/2026"
  // Usamos métodos UTC para evitar problemas de zona horaria del servidor
  let baseDate;
  if (typeof auctionDate === 'string') {
    if (auctionDate.includes('/')) {
      // Formato DD/MM/YYYY o MM/DD/YYYY
      const parts = auctionDate.split('/');
      if (parts.length === 3) {
        // Asumimos formato DD/MM/YYYY
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Mes es 0-indexed
        const year = parseInt(parts[2], 10);
        baseDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
      } else {
        baseDate = new Date(auctionDate);
      }
    } else if (auctionDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Formato YYYY-MM-DD (ISO date only)
      const parts = auctionDate.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Mes es 0-indexed
      const day = parseInt(parts[2], 10);
      baseDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
    } else if (auctionDate.includes('T')) {
      // Formato ISO con hora: YYYY-MM-DDTHH:mm:ss
      // Extraer solo la fecha para evitar problemas de zona horaria
      const datePart = auctionDate.split('T')[0];
      const parts = datePart.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Mes es 0-indexed
      const day = parseInt(parts[2], 10);
      baseDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
    } else {
      baseDate = new Date(auctionDate);
    }
  } else {
    baseDate = new Date(auctionDate);
  }
  
  if (Number.isNaN(baseDate.getTime())) {
    console.error(`❌ Error: Fecha inválida "${auctionDate}"`);
    return null;
  }

  // Algoritmo correcto de conversión de zonas horarias:
  // Ejemplo 1: 16:17 en Tokio (GMT+9) del 4/1/2026
  //   UTC = 16:17 - 9 = 7:17
  //   Colombia (GMT-5) = 7:17 - 5 = 2:17 ✓
  // Ejemplo 2: 10:00 en Nueva York (GMT-5) del 4/1/2026
  //   UTC = 10:00 - (-5) = 15:00
  //   Colombia (GMT-5) = 15:00 - 5 = 10:00 ✓ (misma hora)
  // Ejemplo 3: 10:00 en California (GMT-8) del 4/1/2026
  //   UTC = 10:00 - (-8) = 18:00
  //   Colombia (GMT-5) = 18:00 - 5 = 13:00 ✓ (3 horas adelante)
  // Ejemplo 4: 10:00 en UK (GMT+0) del 4/1/2026
  //   UTC = 10:00 - 0 = 10:00
  //   Colombia (GMT-5) = 10:00 - 5 = 5:00 ✓ (5 horas adelante)
  
  // Obtener año, mes y día de la fecha base (usando métodos UTC para evitar problemas de zona horaria local)
  const baseYear = baseDate.getUTCFullYear();
  const baseMonth = baseDate.getUTCMonth();
  const baseDay = baseDate.getUTCDate();
  
  // ALGORITMO CORRECTO:
  // 1. Crear fecha UTC con la hora local de la ciudad (esto es solo un punto de referencia)
  // 2. Convertir a UTC real restando el offset de la ciudad
  // 3. Convertir de UTC a hora de Colombia sumando el offset de Colombia (que es negativo, así que resta)
  
  // Paso 1: Crear fecha base en UTC con la hora local de la ciudad
  const cityDateUtc = new Date(Date.UTC(baseYear, baseMonth, baseDay, hours, minutes));
  
  // Paso 2: Convertir de hora local de la ciudad a UTC
  // Si la ciudad es GMT+9 (Tokio), está 9 horas adelante de UTC
  // Para obtener UTC: restamos 9 horas
  // Si la ciudad es GMT-5 (NY), está 5 horas atrás de UTC
  // Para obtener UTC: restamos -5 = sumamos 5 horas
  const utcTimestamp = cityDateUtc.getTime() - (cityOffset * HOUR_IN_MS);
  
  // Paso 3: Convertir de UTC a hora de Colombia (GMT-5)
  // Colombia está 5 horas ATRÁS de UTC, así que su offset es -5
  // Para obtener hora de Colombia desde UTC: sumamos el offset de Colombia
  // Como COLOMBIA_OFFSET = -5, sumar (-5 * HOUR_IN_MS) resta 5 horas correctamente
  const colombiaTimestamp = utcTimestamp + (COLOMBIA_OFFSET * HOUR_IN_MS);
  
  // DEBUG: Logs siempre activos para producción (Vercel)
  const debugUtc = new Date(utcTimestamp);
  const debugColombia = new Date(colombiaTimestamp);
  console.log(`🔍 Cálculo hora Colombia:`, {
    ciudad: city,
    horaLocal: `${hours}:${minutes}`,
    fechaBase: auctionDate,
    cityOffset,
    colombiaOffset: COLOMBIA_OFFSET,
    utc: debugUtc.toISOString(),
    colombia: debugColombia.toISOString(),
    colombiaLocal: debugColombia.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  });
  
  // Crear objeto Date con el timestamp corregido
  const colombiaDate = new Date(colombiaTimestamp);
  
  // Verificar que la fecha sea válida
  if (Number.isNaN(colombiaDate.getTime())) {
    console.error('❌ Error: Fecha de Colombia inválida calculada');
    return null;
  }
  
  return colombiaDate.toISOString();
};

/**
 * Valida si el valor de location es un puerto válido para auctions
 * NOTA: preselections.location contiene países (Japón, Estados Unidos, etc.)
 *       auctions.location contiene puertos específicos (KOBE, YOKOHAMA, etc.)
 * @param {string|null|undefined} location - Valor de location desde preselección
 * @returns {string|null} - Valor válido para auctions (puerto) o null si es un país
 */
const mapLocationToAuction = (location) => {
  if (!location || typeof location !== 'string') return null;
  
  // Valores válidos en auctions según la restricción CHECK (puertos específicos)
  const validPorts = [
    'ALBERTA', 'BALTIMORE', 'BOSTON', 'FLORIDA', 'FUJI', 'HAKATA', 'HOKKAIDO',
    'HYOGO', 'KASHIBA', 'KOBE', 'LAKE WORTH', 'LEBANON', 'LEEDS', 'MIAMI',
    'NAGOYA', 'NARITA', 'OKINAWA', 'OSAKA', 'SAKURA', 'TIANJIN', 'TOMAKOMAI',
    'YOKOHAMA', 'ZEEBRUGE'
  ];
  
  // Normalizar el valor (trim y uppercase)
  const normalized = location.trim().toUpperCase();
  
  // Si el valor ya es un puerto válido, retornarlo
  if (validPorts.includes(normalized)) {
    return normalized;
  }
  
  // Si es un país (Japón, Estados Unidos, etc.), retornar null
  // La ubicación de país se mantiene en preselections, pero no se copia a auctions
  // auctions.location debe ser un puerto específico, que se definirá más adelante
  const countryNames = [
    'JAPON', 'JAPAN', 'JAPÓN', 'Japón', 'Japon',
    'USA', 'ESTADOS UNIDOS', 'UNITED STATES', 'ESTADOS UNIDOS DE AMERICA', 'UNITED STATES OF AMERICA',
    'CANADA', 'CANADÁ',
    'REINO UNIDO', 'UNITED KINGDOM', 'UK'
  ];
  
  if (countryNames.includes(normalized)) {
    // Es un país, no un puerto - retornar null para auctions
    return null;
  }
  
  // Si no es ni puerto ni país conocido, retornar null
  // Esto evita violar la restricción CHECK en auctions
  return null;
};

// Middleware para verificar acceso a preselecciones (Sebastian y Gerencia)
const canViewPreselections = (req, res, next) => {
  const { role, email } = req.user;
  const userEmail = email?.toLowerCase();
  
  // Permitir por rol
  if (role === 'sebastian' || role === 'gerencia' || role === 'admin') {
    next();
  }
  // Permitir por email específico (sdonado@partequiposusa.com y pcano@partequipos.com)
  else if (userEmail === 'pcano@partequipos.com' || userEmail === 'sdonado@partequiposusa.com') {
    next();
  } else {
    res.status(403).json({ error: 'No tienes permisos para acceder a preselecciones' });
  }
};

// GET /api/preselections - Obtener todas las preselecciones
router.get('/', canViewPreselections, async (req, res) => {
  try {
    const query = `
      SELECT 
        p.*,
        p.machine_type,
        a.id as auction_id_generated,
        a.status as auction_status,
        a.price_bought as auction_price_bought
      FROM preselections p
      LEFT JOIN auctions a ON p.auction_id = a.id
      ORDER BY p.auction_date DESC, p.created_at DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener preselecciones:', error);
    res.status(500).json({ error: 'Error al obtener preselecciones' });
  }
});

// POST /api/preselections - Crear nueva preselección
router.post('/', canViewPreselections, async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      supplier_name,
      auction_date,
      lot_number,
      brand,
      machine_type,
      model,
      serial,
      year,
      hours,
      suggested_price,
      auction_url,
      comments,
      auction_type,
      auction_country,
      currency,
      location,
      final_price,
      local_time,
      auction_city,
      shoe_width_mm,
      spec_pip,
      spec_blade,
      spec_cabin,
      arm_type
    } = req.body;

    const colombia_time = calculateColombiaTime(auction_date, local_time, auction_city);
    
    const result = await pool.query(
      `INSERT INTO preselections (
        supplier_name, auction_date, lot_number, brand, machine_type, model, serial,
        year, hours, suggested_price, auction_url, comments, created_by,
        auction_type, auction_country, currency, location, final_price,
        local_time, auction_city, shoe_width_mm, spec_pip, spec_blade, spec_cabin, arm_type, colombia_time
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, COALESCE($16, 'USD'), $17, $18,
        $19, $20, $21, COALESCE($22, FALSE), COALESCE($23, FALSE), $24, $25, $26
      )
      RETURNING *`,
      [
        supplier_name, auction_date, lot_number, brand, normalizeMachineType(machine_type), model, serial,
        year, hours, suggested_price, auction_url, comments, userId,
        auction_type, auction_country, currency, location, final_price,
        local_time, auction_city, shoe_width_mm, spec_pip, spec_blade, spec_cabin, arm_type, colombia_time
      ]
    );
    
    // Verificar si hay reglas activas de preselección y ejecutarlas
    try {
      await checkAndExecuteRules();
    } catch (notifError) {
      console.error('Error al verificar reglas de notificación:', notifError);
    }

    // Notificación usando reglas (template con {model}, {serial}); modelo completo = brand + model
    try {
      const row = result.rows[0];
      const fullModel = [row.brand, row.model].filter(Boolean).join(' ').trim() || row.model || 'N/A';
      await triggerNotificationForEvent('preselection_created', {
        recordId: row.id,
        model: fullModel,
        serial: row.serial || 'N/A'
      });
    } catch (preselNotifError) {
      console.error('Error al enviar notificación de preselección creada:', preselNotifError);
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear preselección:', error);
    res.status(500).json({ error: 'Error al crear preselección' });
  }
});

// PUT /api/preselections/:id - Actualizar preselección
router.put('/:id', canViewPreselections, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId, email } = req.user;
    const updates = req.body;
    
    // Admin, sebastian, gerencia, pcano@partequipos.com y sdonado@partequiposusa.com pueden editar cualquier preselección
    const userEmail = email?.toLowerCase();
    const isGerenciaOrPcano = role === 'admin' || role === 'sebastian' || role === 'gerencia' || userEmail === 'pcano@partequipos.com' || userEmail === 'gerencia@partequipos.com' || userEmail === 'sdonado@partequiposusa.com';
    
    // Verificar que la preselección existe
    const check = await pool.query(
      'SELECT id, auction_date, local_time, auction_city FROM preselections WHERE id = $1',
      [id]
    );
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Preselección no encontrada' });
    }
    
    const basePreselection = check.rows[0];
    
    // Construir query dinámico
    // IMPORTANTE: Preservar los valores originales de auction_date y local_time tal cual se ingresan
    // Solo calcular colombia_time para referencia (mostrar hora de Colombia), pero NO modificar los valores originales
    const nextAuctionDate = Object.prototype.hasOwnProperty.call(updates, 'auction_date')
      ? updates.auction_date
      : basePreselection.auction_date;
    const nextLocalTime = Object.prototype.hasOwnProperty.call(updates, 'local_time')
      ? updates.local_time
      : basePreselection.local_time;
    const nextAuctionCity = Object.prototype.hasOwnProperty.call(updates, 'auction_city')
      ? updates.auction_city
      : basePreselection.auction_city;
    
    // Preservar auction_date y local_time tal cual vienen (valores originales)
    // Si auction_date viene como "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ss", extraer solo la fecha
    if (Object.prototype.hasOwnProperty.call(updates, 'auction_date') && typeof updates.auction_date === 'string') {
      // Extraer solo la parte de fecha (YYYY-MM-DD) sin hora para preservar el valor original
      const dateMatch = updates.auction_date.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        updates.auction_date = dateMatch[1]; // Solo la fecha YYYY-MM-DD (valor original ingresado)
      }
    }
    
    // Preservar local_time tal cual viene (valor original ingresado)
    // local_time debe venir en formato HH:mm y mantenerse así
    
    // Calcular colombia_time para referencia (solo para mostrar hora de Colombia en frontend)
    const colombiaTime = calculateColombiaTime(nextAuctionDate, nextLocalTime, nextAuctionCity);
    updates.colombia_time = colombiaTime;

    // Validar y normalizar campos de especificaciones técnicas
    // spec_pip y spec_blade deben ser booleanos
    if ('spec_pip' in updates) {
      updates.spec_pip = updates.spec_pip === true || updates.spec_pip === 'true' || updates.spec_pip === 1;
    }
    if ('spec_blade' in updates) {
      updates.spec_blade = updates.spec_blade === true || updates.spec_blade === 'true' || updates.spec_blade === 1;
    }
    
    // spec_pad debe ser 'Bueno' o 'Malo' o null
    if ('spec_pad' in updates) {
      if (updates.spec_pad === null || updates.spec_pad === undefined || updates.spec_pad === '') {
        updates.spec_pad = null;
      } else {
        const padValue = String(updates.spec_pad).trim();
        if (padValue !== 'Bueno' && padValue !== 'Malo') {
          // Si viene un valor no válido, intentar normalizar
          if (padValue.toLowerCase() === 'bueno' || padValue.toLowerCase() === 'good') {
            updates.spec_pad = 'Bueno';
          } else if (padValue.toLowerCase() === 'malo' || padValue.toLowerCase() === 'bad') {
            updates.spec_pad = 'Malo';
          } else {
            updates.spec_pad = null; // Si no es válido, usar null
          }
        }
      }
    }
    
    // arm_type debe ser 'ESTANDAR', 'N/A', 'LONG ARM' o null
    if ('arm_type' in updates) {
      if (updates.arm_type === null || updates.arm_type === undefined || updates.arm_type === '') {
        updates.arm_type = null;
      } else {
        const armValue = String(updates.arm_type).trim().toUpperCase();
        if (['ESTANDAR', 'N/A', 'LONG ARM'].includes(armValue)) {
          updates.arm_type = armValue;
        } else {
          updates.arm_type = null; // Si no es válido, usar null
        }
      }
    }
    
    // shoe_width_mm debe ser numérico o null
    if ('shoe_width_mm' in updates) {
      if (updates.shoe_width_mm === null || updates.shoe_width_mm === undefined || updates.shoe_width_mm === '') {
        updates.shoe_width_mm = null;
      } else {
        const widthValue = parseFloat(updates.shoe_width_mm);
        updates.shoe_width_mm = isNaN(widthValue) ? null : widthValue;
      }
    }

    if ('machine_type' in updates) {
      updates.machine_type = normalizeMachineType(updates.machine_type);
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE preselections SET ${setClause}, updated_at = NOW() 
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    
    // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Si tiene auction_id, sincronizar cambios a subasta
    if (result.rows[0].auction_id) {
      await syncPreselectionToAuction(id, updates);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'hours')) {
      try {
        const row = result.rows[0];
        const fullModel = [row.brand, row.model].filter(Boolean).join(' ').trim() || row.model || 'N/A';
        await triggerNotificationForEvent('field_changed', {
          recordId: id,
          model: fullModel,
          serial: row.serial ?? 'N/A',
          fieldName: 'hours',
          userId: userId,
          triggeredBy: userId,
        });
      } catch (notifErr) {
        console.error('Error al enviar notificación por cambio de HORAS:', notifErr);
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar preselección:', error);
    console.error('Detalles del error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position
    });
    res.status(500).json({ 
      error: 'Error al actualizar preselección',
      details: error.message,
      code: error.code
    });
  }
});

// PUT /api/preselections/:id/decision - Cambiar decisión (SI/NO)
router.put('/:id/decision', canViewPreselections, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body; // 'SI' o 'NO'
    const { userId } = req.user;
    
    if (!['SI', 'NO'].includes(decision)) {
      return res.status(400).json({ error: 'Decisión debe ser SI o NO' });
    }
    
    // Obtener la preselección
    const preselection = await pool.query(
      'SELECT * FROM preselections WHERE id = $1',
      [id]
    );
    
    if (preselection.rows.length === 0) {
      return res.status(404).json({ error: 'Preselección no encontrada' });
    }
    
    const presel = preselection.rows[0];
    const previousDecision = presel.decision;
    
    if (decision === 'NO') {
      console.log('🗑️ Eliminando preselección rechazada:', id);
      // Si llegó a tener subasta, eliminarla
      if (presel.auction_id) {
        await pool.query('DELETE FROM auctions WHERE id = $1', [presel.auction_id]);
        console.log('✅ Subasta asociada eliminada:', presel.auction_id);
      }

      await pool.query('DELETE FROM preselections WHERE id = $1', [id]);

      try {
        const pendingCount = await pool.query(`SELECT COUNT(*) FROM preselections WHERE decision = 'PENDIENTE'`);
        if (pendingCount.rows[0].count == 0) {
          await clearPreselectionNotifications();
        } else {
          await checkAndExecuteRules();
        }
      } catch (notifError) {
        console.error('Error al actualizar notificaciones tras eliminar preselección:', notifError);
      }

      res.json({
        deleted: true,
        message: 'Preselección rechazada y eliminada exitosamente',
      });
      return;
    }
    
    // CASO 2: Cambio de NO a SI o PENDIENTE a SI (crear subasta)
    if (decision === 'SI') {
      // Crear subasta automáticamente
      const allowedArmTypes = ['ESTANDAR', 'N/A', 'LONG ARM'];
      const normalizedArmType = presel.arm_type ? presel.arm_type.toUpperCase().trim() : null;
      const finalArmType = allowedArmTypes.includes(normalizedArmType) ? normalizedArmType : null;
      
      // 1. Crear o buscar máquina
      let machineId;
      const existingMachine = await pool.query(
        'SELECT id FROM machines WHERE serial = $1',
        [presel.serial]
      );
      
      if (existingMachine.rows.length > 0) {
        machineId = existingMachine.rows[0].id;
        // Actualizar datos de la máquina incluyendo especificaciones
        await pool.query(
          `UPDATE machines SET 
            brand = $1, model = $2, year = $3, hours = $4, machine_type = $5,
            shoe_width_mm = $6, spec_pip = $7, spec_blade = $8, spec_pad = $9, spec_cabin = $10, arm_type = $11,
            updated_at = NOW()
           WHERE id = $12`,
          [
            presel.brand, presel.model, presel.year, presel.hours, normalizeMachineType(presel.machine_type),
            presel.shoe_width_mm, presel.spec_pip, presel.spec_blade, presel.spec_pad, presel.spec_cabin, finalArmType,
            machineId
          ]
        );
      } else {
        // Crear nueva máquina con especificaciones
        const newMachine = await pool.query(
          `INSERT INTO machines (
            brand, model, serial, year, hours, machine_type,
            shoe_width_mm, spec_pip, spec_blade, spec_pad, spec_cabin, arm_type
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          [
            presel.brand, presel.model, presel.serial, presel.year, presel.hours, normalizeMachineType(presel.machine_type),
            presel.shoe_width_mm, presel.spec_pip, presel.spec_blade, presel.spec_pad, presel.spec_cabin, finalArmType
          ]
        );
        machineId = newMachine.rows[0].id;
      }
      
      // Validaciones requeridas antes de aprobar y crear subasta
      if (!presel.supplier_name || presel.supplier_name.trim() === '' || presel.supplier_name.toUpperCase() === 'PENDIENTE') {
        return res.status(400).json({ 
          error: 'No se puede aprobar la preselección sin seleccionar un proveedor. Por favor, seleccione un proveedor antes de aprobar.' 
        });
      }
      
      if (!presel.currency) {
        return res.status(400).json({ 
          error: 'No se puede aprobar la preselección sin seleccionar una moneda. Por favor, seleccione una moneda antes de aprobar.' 
        });
      }
      
      if (!presel.auction_type || presel.auction_type.toUpperCase() === 'PENDIENTE') {
        return res.status(400).json({ 
          error: 'No se puede aprobar la preselección sin seleccionar un tipo de subasta. Por favor, seleccione un tipo de subasta antes de aprobar.' 
        });
      }
      
      // Validación de LOTE (lot_number) - obligatorio para aprobar
      if (!presel.lot_number || presel.lot_number.trim() === '' || presel.lot_number.startsWith('TMP-')) {
        return res.status(400).json({ 
          error: 'No se puede aprobar la preselección sin un número de lote válido. Por favor, ingrese un número de lote antes de aprobar.' 
        });
      }
      
      // 2. Verificar si ya existe una subasta asociada
      // Si ya existe auction_id, actualizar la subasta existente en lugar de crear una nueva
      if (presel.auction_id) {
        console.log('⚠️ Ya existe una subasta asociada (auction_id:', presel.auction_id, '). Actualizando la subasta existente.');
        
        // Verificar que la subasta existe
        const existingAuction = await pool.query(
          'SELECT id FROM auctions WHERE id = $1',
          [presel.auction_id]
        );
        
        if (existingAuction.rows.length > 0) {
          // La subasta existe, solo actualizar la preselección
          await pool.query(
            `UPDATE preselections 
             SET decision = $1, transferred_to_auction = TRUE, transferred_at = NOW()
             WHERE id = $2`,
            ['SI', id]
          );
          
          // Devolver la preselección actualizada
          const updated = await pool.query(
            `SELECT p.*, a.id as auction_id_generated, a.status as auction_status
             FROM preselections p
             LEFT JOIN auctions a ON p.auction_id = a.id
             WHERE p.id = $1`,
            [id]
          );
          
          // Actualizar notificaciones
          try {
            const pendingCount = await pool.query(`SELECT COUNT(*) FROM preselections WHERE decision = 'PENDIENTE'`);
            if (pendingCount.rows[0].count == 0) {
              await clearPreselectionNotifications();
            } else {
              await checkAndExecuteRules();
            }
          } catch (notifError) {
            console.error('Error al actualizar notificaciones:', notifError);
          }
          
          return res.json({
            preselection: updated.rows[0],
            message: 'Preselección aprobada exitosamente (subasta existente)',
            auction_id: presel.auction_id
          });
        } else {
          // La subasta no existe en la BD pero está referenciada, limpiar la referencia
          console.log('⚠️ La subasta referenciada no existe. Limpiando referencia y creando nueva subasta.');
          await pool.query(
            'UPDATE preselections SET auction_id = NULL WHERE id = $1',
            [id]
          );
        }
      }
      
      // 2. Crear subasta
      // Si no hay auction_type en la preselección, intenta reutilizar el último valor usado en el mismo día
      let auctionTypeToUse = presel.auction_type || null;
      if (!auctionTypeToUse && presel.auction_date) {
        const fallbackAuctionType = await pool.query(
          `SELECT auction_type 
             FROM preselections 
            WHERE auction_date = $1 AND auction_type IS NOT NULL 
         ORDER BY updated_at DESC 
            LIMIT 1`,
          [presel.auction_date]
        );
        if (fallbackAuctionType.rows.length > 0) {
          auctionTypeToUse = fallbackAuctionType.rows[0].auction_type;
        }
      }
      // Buscar supplier_id si supplier_name es un UUID, sino buscar por nombre o crearlo
      let supplierId = null;
      if (presel.supplier_name) {
        // Si es un UUID válido, usarlo directamente
        if (presel.supplier_name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          supplierId = presel.supplier_name;
        } else {
          // Buscar por nombre en la tabla suppliers
          const supplierResult = await pool.query(
            'SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)',
            [presel.supplier_name]
          );
          if (supplierResult.rows.length > 0) {
            supplierId = supplierResult.rows[0].id;
          } else {
            // Si no se encuentra el proveedor, crearlo automáticamente
            // Esto mantiene la integridad de los datos y permite el flujo normal
            try {
              const newSupplierResult = await pool.query(
                'INSERT INTO suppliers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
                [presel.supplier_name]
              );
              supplierId = newSupplierResult.rows[0].id;
            } catch (insertError) {
              // Si falla por conflicto de unique, intentar obtener el ID nuevamente
              if (insertError.code === '23505') { // unique_violation
                const existingSupplier = await pool.query(
                  'SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)',
                  [presel.supplier_name]
                );
                if (existingSupplier.rows.length > 0) {
                  supplierId = existingSupplier.rows[0].id;
                } else {
                  throw insertError; // Re-lanzar si no se puede resolver
                }
              } else {
                throw insertError; // Re-lanzar otros errores
              }
            }
          }
        }
      }
      
      // Validar que supplierId no sea null antes de crear la subasta
      if (!supplierId) {
        console.error(`Error: No se pudo obtener supplier_id para "${presel.supplier_name}". La subasta requiere un proveedor.`);
        throw new Error(`No se pudo determinar el proveedor para la subasta. supplier_name: "${presel.supplier_name}"`);
      }
      
      // Validar y mapear location a un valor válido para auctions
      const validLocation = mapLocationToAuction(presel.location);
      
      // IMPORTANTE: Usar el created_by de la preselección original para mantener la trazabilidad
      // pero permitir que cualquier usuario con permisos pueda aprobar y crear la subasta
      const preselectionCreatedBy = presel.created_by || userId;
      
      // IMPORTANTE: Convertir auction_date a formato correcto para PostgreSQL timestamptz
      // Puede venir como objeto Date, string ISO, o string simple
      let auctionDateValue = presel.auction_date;
      
      console.log('📅 auction_date original recibido:', auctionDateValue, 'Tipo:', typeof auctionDateValue, 'Es Date?', auctionDateValue instanceof Date);
      
      // Si es un objeto Date, convertirlo a ISO string
      if (auctionDateValue instanceof Date) {
        // Convertir a formato ISO: "2026-01-13T00:00:00.000Z"
        auctionDateValue = auctionDateValue.toISOString().split('T')[0]; // Extraer solo la parte de fecha
        console.log('📅 Convertido desde Date a:', auctionDateValue);
      } else if (typeof auctionDateValue === 'string') {
        // Si viene como string ISO con hora: "2026-01-09T00:00:00", extraer solo "2026-01-09"
        if (auctionDateValue.includes('T')) {
          auctionDateValue = auctionDateValue.split('T')[0];
        }
        // Si viene como string con formato toString de Date: "Tue Jan 13 2026 00:00:00 GMT+0000..."
        // Intentar parsearlo como Date y convertir a ISO
        else if (auctionDateValue.includes('GMT') || auctionDateValue.includes('UTC')) {
          try {
            const parsedDate = new Date(auctionDateValue);
            if (!isNaN(parsedDate.getTime())) {
              auctionDateValue = parsedDate.toISOString().split('T')[0];
            }
          } catch (e) {
            console.error('Error al parsear fecha:', auctionDateValue, e);
            // Intentar extraer fecha con regex
            const dateMatch = auctionDateValue.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              auctionDateValue = dateMatch[1];
            }
          }
        }
        // Si ya está en formato YYYY-MM-DD, mantenerlo
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(auctionDateValue)) {
          // Intentar parsear como Date si no está en formato esperado
          try {
            const parsedDate = new Date(auctionDateValue);
            if (!isNaN(parsedDate.getTime())) {
              auctionDateValue = parsedDate.toISOString().split('T')[0];
            }
          } catch (e) {
            console.error('Error al parsear fecha:', auctionDateValue, e);
          }
        }
      }
      
      // Asegurar que auctionDateValue esté en formato YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(auctionDateValue)) {
        console.error('Formato de fecha inválido después de procesamiento:', auctionDateValue);
        return res.status(400).json({ error: 'Formato de fecha inválido en auction_date' });
      }
      
      // IMPORTANTE: Usar colombia_time si existe (ya calculado), NO usar local_time
      // Esto evita crear subastas duplicadas con diferentes zonas horarias
      let finalAuctionDate;
      if (presel.colombia_time) {
        // Usar colombia_time directamente (ya está calculado y en formato timestamptz)
        // El campo colombia_time viene como timestamptz desde la BD (puede ser Date object o ISO string)
        let colombiaDateValue = presel.colombia_time;
        
        // Si viene como string de PostgreSQL (formato ISO con o sin 'Z'), parsearlo
        if (typeof colombiaDateValue === 'string') {
          // PostgreSQL puede devolver timestamptz como "2026-01-13T02:17:00+00:00" o "2026-01-13 02:17:00+00"
          // Convertir a formato estándar ISO
          if (colombiaDateValue.includes('+') || colombiaDateValue.includes('Z')) {
            // Tiene zona horaria, parsear y convertir a formato sin zona para PostgreSQL
            colombiaDateValue = new Date(colombiaDateValue);
          } else if (colombiaDateValue.includes('T')) {
            // Formato ISO sin zona: "2026-01-13T02:17:00"
            // PostgreSQL lo interpretará correctamente
            finalAuctionDate = colombiaDateValue;
            console.log('✅ Usando colombia_time (string ISO) para la subasta:', finalAuctionDate);
          } else {
            // Formato con espacio: "2026-01-13 02:17:00", convertir a ISO
            colombiaDateValue = colombiaDateValue.replace(' ', 'T');
            finalAuctionDate = colombiaDateValue;
            console.log('✅ Usando colombia_time (string con espacio convertido) para la subasta:', finalAuctionDate);
          }
        }
        
        // Si después del procesamiento aún no tenemos finalAuctionDate, parsear como Date
        if (!finalAuctionDate) {
          const colombiaDate = colombiaDateValue instanceof Date ? colombiaDateValue : new Date(colombiaDateValue);
          if (!isNaN(colombiaDate.getTime())) {
            // Extraer componentes de la fecha de Colombia (usando UTC ya que está almacenado como UTC)
            const year = colombiaDate.getUTCFullYear();
            const month = String(colombiaDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(colombiaDate.getUTCDate()).padStart(2, '0');
            const hours = String(colombiaDate.getUTCHours()).padStart(2, '0');
            const minutes = String(colombiaDate.getUTCMinutes()).padStart(2, '0');
            const seconds = String(colombiaDate.getUTCSeconds()).padStart(2, '0');
            // Formato ISO: YYYY-MM-DDTHH:mm:ss (PostgreSQL interpreta esto como timestamptz)
            finalAuctionDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
            console.log('✅ Usando colombia_time (parseado desde Date) para la subasta:', finalAuctionDate);
          } else {
            console.warn('⚠️ colombia_time no es válido después de parseo, usando fecha base con medianoche');
            finalAuctionDate = `${auctionDateValue}T00:00:00`;
          }
        }
      } else {
        // Si no hay colombia_time, calcularlo
        console.log('⚠️ No se encontró colombia_time, calculándolo...');
        const calculatedColombiaTime = calculateColombiaTime(presel.auction_date, presel.local_time, presel.auction_city);
        if (calculatedColombiaTime) {
          const colombiaDate = new Date(calculatedColombiaTime);
          if (!isNaN(colombiaDate.getTime())) {
            const year = colombiaDate.getUTCFullYear();
            const month = String(colombiaDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(colombiaDate.getUTCDate()).padStart(2, '0');
            const hours = String(colombiaDate.getUTCHours()).padStart(2, '0');
            const minutes = String(colombiaDate.getUTCMinutes()).padStart(2, '0');
            const seconds = String(colombiaDate.getUTCSeconds()).padStart(2, '0');
            finalAuctionDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
            console.log('✅ colombia_time calculado y usado para la subasta:', finalAuctionDate);
          } else {
            console.warn('⚠️ Error al calcular colombia_time, usando fecha base con medianoche');
            finalAuctionDate = `${auctionDateValue}T00:00:00`;
          }
        } else {
          // Si no se puede calcular, usar medianoche de la fecha base
          console.warn('⚠️ No se pudo calcular colombia_time, usando fecha base con medianoche');
          finalAuctionDate = `${auctionDateValue}T00:00:00`;
        }
      }
      
      console.log('📅 Fecha final procesada para inserción (hora de Colombia):', finalAuctionDate, 'Tipo:', typeof finalAuctionDate);
      
      // Asegurar que finalAuctionDate sea un string válido antes de insertar
      // PostgreSQL acepta formato ISO 8601: 'YYYY-MM-DDTHH:mm:ss' o 'YYYY-MM-DD HH:mm:ss'
      // Para timestamptz, es mejor usar el formato con 'T' o con espacio, ambos funcionan
      // Si viene con formato toString() de JavaScript, ya fue convertido arriba
      
      const newAuction = await pool.query(
        `INSERT INTO auctions (
          date, lot, machine_id, price_max, supplier_id, 
          purchase_type, status, comments, auction_type, location, epa, created_by
        ) VALUES ($1::timestamptz, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [
          finalAuctionDate, // Formato ISO: 'YYYY-MM-DDTHH:mm:ss' para PostgreSQL timestamptz
          presel.lot_number,
          machineId,
          presel.suggested_price || 0,
          supplierId,
          'SUBASTA', // Siempre es subasta cuando viene de preselección
          'PENDIENTE',
          presel.comments || null,
          auctionTypeToUse, // Tipo de subasta (de la preselección o último valor del día)
          validLocation, // Ubicación validada y mapeada
          presel.epa || null, // Copiar EPA si existe
          preselectionCreatedBy // Usar el created_by de la preselección original para mantener trazabilidad
        ]
      );
      
      const auctionId = newAuction.rows[0].id;
      
      // 3. Actualizar preselección
      await pool.query(
        `UPDATE preselections 
         SET decision = $1, transferred_to_auction = TRUE, auction_id = $2, transferred_at = NOW()
         WHERE id = $3`,
        ['SI', auctionId, id]
      );
      
      // 4. Devolver preselección actualizada con info de subasta
      const updated = await pool.query(
        `SELECT p.*, a.id as auction_id_generated, a.status as auction_status
         FROM preselections p
         LEFT JOIN auctions a ON p.auction_id = a.id
         WHERE p.id = $1`,
        [id]
      );
      
      // Actualizar notificaciones de preselección
      try {
        const pendingCount = await pool.query(`SELECT COUNT(*) FROM preselections WHERE decision = 'PENDIENTE'`);
        if (pendingCount.rows[0].count == 0) {
          await clearPreselectionNotifications();
        } else {
          await checkAndExecuteRules();
        }
      } catch (notifError) {
        console.error('Error al actualizar notificaciones:', notifError);
      }
      
      // Disparar notificación inmediata para el evento de creación de subasta desde preselección
      try {
        await triggerNotificationForEvent('auction_created', {
          recordId: auctionId.toString(),
          userId: userId,
          triggeredBy: userId,
          metadata: {
            auction_id: auctionId,
            lot: presel.lot_number,
            model: presel.model,
            serial: presel.serial,
            status: 'PENDIENTE',
            source: 'preselection'
          }
        });
        
        // También ejecutar todas las reglas activas (incluye AUCTION_PENDING)
        await checkAndExecuteRules();
      } catch (notifError) {
        console.error('Error al disparar notificaciones de subasta:', notifError);
      }
      
      res.json({
        preselection: updated.rows[0],
        message: 'Preselección aprobada y transferida a subastas exitosamente',
        auction_id: auctionId
      });
      
    } else if (decision === 'NO') {
      // CASO 3: Cambio a NO (desde PENDIENTE o desde SI)
      
      // Si venía de SI, eliminar la subasta asociada
      if (previousDecision === 'SI' && presel.auction_id) {
        console.log('🔄 Reversión adicional: Eliminando subasta al cambiar a NO');
        await pool.query('DELETE FROM auctions WHERE id = $1', [presel.auction_id]);
      }
      
      // Marcar como rechazada y limpiar relación con subasta
      const result = await pool.query(
        `UPDATE preselections 
         SET decision = $1, transferred_to_auction = FALSE, auction_id = NULL, transferred_at = NULL
         WHERE id = $2
         RETURNING *`,
        ['NO', id]
      );
      
      // Actualizar notificaciones de preselección
      try {
        const pendingCount = await pool.query(`SELECT COUNT(*) FROM preselections WHERE decision = 'PENDIENTE'`);
        if (pendingCount.rows[0].count == 0) {
          await clearPreselectionNotifications();
        } else {
          await checkAndExecuteRules();
        }
      } catch (notifError) {
        console.error('Error al actualizar notificaciones:', notifError);
      }
      
      res.json({
        preselection: result.rows[0],
        message: previousDecision === 'SI' 
          ? 'Preselección revertida a NO y subasta eliminada' 
          : 'Preselección rechazada'
      });
    }
    
  } catch (error) {
    console.error('Error al procesar decisión:', error);
    res.status(500).json({ error: 'Error al procesar decisión', details: error.message });
  }
});

// DELETE /api/preselections/:id - Eliminar preselección
router.delete('/:id', canViewPreselections, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId, email } = req.user;
    
    // Admin, sebastian, gerencia, pcano@partequipos.com y sdonado@partequiposusa.com pueden eliminar cualquier preselección
    const userEmail = email?.toLowerCase();
    const isGerenciaOrPcano = role === 'admin' || role === 'sebastian' || role === 'gerencia' || userEmail === 'pcano@partequipos.com' || userEmail === 'gerencia@partequipos.com' || userEmail === 'sdonado@partequiposusa.com';
    
    // Obtener la preselección
    const check = await pool.query(
      'SELECT transferred_to_auction, auction_id FROM preselections WHERE id = $1',
      [id]
    );
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Preselección no encontrada' });
    }
    
    const preselection = check.rows[0];
    
    // Si fue transferida a subasta, eliminar también la subasta (CASCADE se encarga del resto)
    if (preselection.transferred_to_auction && preselection.auction_id) {
      console.log(`🗑️ Eliminando subasta asociada: ${preselection.auction_id}`);
      await pool.query('DELETE FROM auctions WHERE id = $1', [preselection.auction_id]);
    }
    
    // Eliminar preselección
    await pool.query('DELETE FROM preselections WHERE id = $1', [id]);
    
    console.log(`✅ Preselección ${id} eliminada exitosamente${preselection.auction_id ? ' (con subasta asociada)' : ''}`);
    
    res.json({ 
      message: preselection.auction_id 
        ? 'Preselección y subasta asociada eliminadas exitosamente' 
        : 'Preselección eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar preselección:', error);
    res.status(500).json({ error: 'Error al eliminar preselección' });
  }
});

export default router;

