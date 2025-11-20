/**
 * Rutas de Preselecciones (Preselections)
 * Módulo previo a subastas para evaluación de equipos
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { clearPreselectionNotifications, checkAndExecuteRules } from '../services/notificationTriggers.js';

const router = express.Router();

router.use(authenticateToken);

const CITY_TIME_OFFSETS = {
  TOKYO: 9,
  NEW_YORK: -5,
  CALIFORNIA: -8,
};
const HOUR_IN_MS = 60 * 60 * 1000;

const calculateColombiaTime = (auctionDate, localTime, city) => {
  if (!auctionDate || !localTime || !city) return null;
  const offset = CITY_TIME_OFFSETS[city];
  if (offset === undefined) return null;

  const [hoursStr, minutesStr] = localTime.split(':');
  if (hoursStr === undefined || minutesStr === undefined) return null;
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const baseDate = new Date(auctionDate);
  if (Number.isNaN(baseDate.getTime())) return null;

  const utcMs =
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate(),
      hours,
      minutes
    ) - offset * HOUR_IN_MS;

  return new Date(utcMs).toISOString();
};

// Middleware para verificar acceso a preselecciones (Sebastian y Gerencia)
const canViewPreselections = (req, res, next) => {
  const { role } = req.user;
  if (role === 'sebastian' || role === 'gerencia' || role === 'admin') {
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
        supplier_name, auction_date, lot_number, brand, model, serial,
        year, hours, suggested_price, auction_url, comments, created_by,
        auction_type, auction_country, currency, location, final_price,
        local_time, auction_city, shoe_width_mm, spec_pip, spec_blade, spec_cabin, arm_type, colombia_time
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, COALESCE($15, 'USD'), $16, $17,
        $18, $19, $20, COALESCE($21, FALSE), COALESCE($22, FALSE), $23, $24, $25
      )
      RETURNING *`,
      [
        supplier_name, auction_date, lot_number, brand, model, serial,
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
    const { role, userId } = req.user;
    const updates = req.body;
    
    // Verificar que la preselección existe y pertenece al usuario (si no es admin/gerencia)
    const check = await pool.query(
      'SELECT id, auction_date, local_time, auction_city FROM preselections WHERE id = $1' + 
      (role === 'sebastian' ? ' AND created_by = $2' : ''),
      role === 'sebastian' ? [id, userId] : [id]
    );
    
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'No puedes editar esta preselección' });
    }
    
    const basePreselection = check.rows[0];
    
    // Construir query dinámico
    const nextAuctionDate = updates.auction_date ?? basePreselection.auction_date;
    const nextLocalTime = Object.prototype.hasOwnProperty.call(updates, 'local_time')
      ? updates.local_time
      : basePreselection.local_time;
    const nextAuctionCity = Object.prototype.hasOwnProperty.call(updates, 'auction_city')
      ? updates.auction_city
      : basePreselection.auction_city;
    const colombiaTime = calculateColombiaTime(nextAuctionDate, nextLocalTime, nextAuctionCity);
    updates.colombia_time = colombiaTime;

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE preselections SET ${setClause}, updated_at = NOW() 
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar preselección:', error);
    res.status(500).json({ error: 'Error al actualizar preselección' });
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
      
      // 1. Crear o buscar máquina
      let machineId;
      const existingMachine = await pool.query(
        'SELECT id FROM machines WHERE serial = $1',
        [presel.serial]
      );
      
      if (existingMachine.rows.length > 0) {
        machineId = existingMachine.rows[0].id;
        // Actualizar datos de la máquina
        await pool.query(
          `UPDATE machines SET brand = $1, model = $2, year = $3, hours = $4, updated_at = NOW()
           WHERE id = $5`,
          [presel.brand, presel.model, presel.year, presel.hours, machineId]
        );
      } else {
        // Crear nueva máquina
        const newMachine = await pool.query(
          `INSERT INTO machines (brand, model, serial, year, hours)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [presel.brand, presel.model, presel.serial, presel.year, presel.hours]
        );
        machineId = newMachine.rows[0].id;
      }
      
      // 2. Crear subasta
      const newAuction = await pool.query(
        `INSERT INTO auctions (
          date, lot, machine_id, price_max, supplier_id, 
          purchase_type, status, comments, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          presel.auction_date,
          presel.lot_number,
          machineId,
          presel.suggested_price || 0,
          presel.supplier_name, // Usar supplier_name directamente
          'SUBASTA', // Siempre es subasta cuando viene de preselección
          'PENDIENTE',
          presel.comments,
          userId
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
    const { role, userId } = req.user;
    
    // Verificar que no ha sido transferida a subasta
    const check = await pool.query(
      'SELECT transferred_to_auction FROM preselections WHERE id = $1' +
      (role === 'sebastian' ? ' AND created_by = $2' : ''),
      role === 'sebastian' ? [id, userId] : [id]
    );
    
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'No puedes eliminar esta preselección' });
    }
    
    if (check.rows[0].transferred_to_auction) {
      return res.status(400).json({ 
        error: 'No se puede eliminar una preselección que ya fue transferida a subasta' 
      });
    }
    
    await pool.query('DELETE FROM preselections WHERE id = $1', [id]);
    res.json({ message: 'Preselección eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar preselección:', error);
    res.status(500).json({ error: 'Error al eliminar preselección' });
  }
});

export default router;

