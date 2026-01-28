/**
 * Rutas de Compras (Purchases)
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewPurchases, requireEliana, canEditShipmentDates, canDeletePurchases } from '../middleware/auth.js';
import { checkAndExecuteRules, clearImportNotifications } from '../services/notificationTriggers.js';
import { syncPurchaseToNewPurchaseAndEquipment } from '../services/syncBidirectional.js';
import { syncPurchaseToAuctionAndPreselection } from '../services/syncBidirectionalPreselectionAuction.js';
import { createNotification } from '../services/notificationService.js';

const router = express.Router();

router.use(authenticateToken);

const normalizeMachineType = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
};

/**
 * Normaliza valores numéricos eliminando signos de moneda, comas, espacios y otros caracteres
 * Ejemplos: "¥8,169,400" -> 8169400, "$ 3,873.00" -> 3873.00, "¥384,500.00" -> 384500.00
 */
const normalizeNumericValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Si ya es un número, retornarlo
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  // Convertir a string y limpiar
  let cleaned = String(value).trim();
  
  // Si está vacío después de trim, retornar null
  if (cleaned === '') {
    return null;
  }
  
  // Eliminar signos de moneda comunes: ¥, $, €, £, etc.
  cleaned = cleaned.replace(/[¥$€£₹₽₩₪₫₨₦₧₨₩₪₫₭₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽₾₿]/g, '');
  
  // Eliminar comas (separadores de miles)
  cleaned = cleaned.replace(/,/g, '');
  
  // Eliminar espacios
  cleaned = cleaned.replace(/\s/g, '');
  
  // Mantener solo números, punto decimal y signo negativo
  cleaned = cleaned.replace(/[^\d.-]/g, '');
  
  // Convertir a número
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? null : num;
};

// GET /api/purchases
// OPTIMIZACIÓN: Soporta paginación opcional para mejor rendimiento con 10,000+ registros
router.get('/', canViewPurchases, async (req, res) => {
  try {
    console.log('📥 GET /api/purchases - Obteniendo compras...');
    
    // Parámetros de paginación (opcionales, por defecto sin límite para compatibilidad)
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const getAll = req.query.all === 'true'; // Flag para obtener todos los registros
    
    // ✅ SOLO purchases: new_purchases viaja a otros módulos (pagos, servicio, logística, equipos) pero NO a compras
    let query = `
      SELECT 
        p.id::uuid,
        p.machine_id::uuid,
        p.auction_id::uuid,
        COALESCE(p.supplier_id::text, p.supplier_name)::text as supplier_id,
        p.invoice_date::date,
        p.payment_date::date,
        p.incoterm::text,
        COALESCE(p.exw_value, 0)::numeric as exw_value,
        COALESCE(p.fob_value, 0)::numeric as fob_value,
        COALESCE(p.trm, 0)::numeric as trm,
        COALESCE(p.usd_rate, 0)::numeric as usd_rate,
        COALESCE(p.jpy_rate, 0)::numeric as jpy_rate,
        COALESCE(p.usd_jpy_rate, 0)::numeric as usd_jpy_rate,
        COALESCE(p.payment_status, 'PENDIENTE')::text as payment_status,
        COALESCE(p.shipment_type, p.shipment_type_v2, 'N/A')::text as shipment_type,
        p.port_of_embarkation::text,
        p.port_of_shipment::text,
        COALESCE(p.fob_additional, 0)::numeric as fob_additional,
        COALESCE(p.disassembly_load, 0)::numeric as disassembly_load,
        p.exw_value_formatted::text,
        p.fob_expenses::text,
        COALESCE(p.disassembly_load_value, 0)::numeric as disassembly_load_value,
        COALESCE(p.fob_total, 0)::numeric as fob_total,
        p.departure_date::date,
        p.estimated_arrival_date::date,
        p.shipment_departure_date::date,
        p.shipment_arrival_date::date,
        p.nationalization_date::date,
        p.port_of_destination::text,
        p.current_movement::text,
        p.current_movement_date::date,
        p.current_movement_plate::text,
        p.mc::text,
        p.location::text,
        p.invoice_number::text,
        p.purchase_order::text,
        COALESCE(p.valor_factura_proveedor, 0)::numeric as valor_factura_proveedor,
        p.observaciones_pagos::text,
        p.pendiente_a::text,
        p.fecha_vto_fact::date,
        COALESCE(p.pending_marker, '')::text as pending_marker,
        p.cu::text,
        p.due_date::date,
        p.driver_name::text,
        p.epa::text,
        p.cpd::text,
        p.created_at::timestamptz,
        p.updated_at::timestamptz,
        p.supplier_name::text,
        COALESCE(p.mq, 'PDTE-' || LPAD((ABS(HASHTEXT(p.id::text)) % 10000)::text, 4, '0'))::text as mq,
        COALESCE(p.purchase_type, CASE WHEN p.auction_id IS NOT NULL THEN 'SUBASTA' ELSE 'COMPRA_DIRECTA' END)::text as tipo,
        COALESCE(p.purchase_type, CASE WHEN p.auction_id IS NOT NULL THEN 'SUBASTA' ELSE 'COMPRA_DIRECTA' END)::text as purchase_type,
        COALESCE(p.shipment_type, p.shipment_type_v2, 'N/A')::text as shipment,
        COALESCE(p.shipment_type, p.shipment_type_v2, 'N/A')::text as shipment_type_v2,
        COALESCE(p.currency_type, p.currency, 'USD')::text as currency,
        COALESCE(p.currency_type, p.currency, 'USD')::text as currency_type,
        COALESCE(p.trm_display, p.trm_rate::text, '0')::text as trm_display,
        COALESCE(p.trm_rate, 0)::numeric as trm_rate,
        COALESCE(p.condition, 'USADO')::text as condition,
        COALESCE(p.cif_usd, 0)::numeric as cif_usd,
        COALESCE(p.fob_total_verified, false)::boolean as fob_total_verified,
        COALESCE(p.cif_usd_verified, false)::boolean as cif_usd_verified,
        COALESCE(p.total_valor_girado, 0)::numeric as total_valor_girado,
        p.empresa::text,
        COALESCE(p.sales_reported, 'PDTE')::text as sales_reported,
        COALESCE(p.commerce_reported, 'PDTE')::text as commerce_reported,
        COALESCE(p.luis_lemus_reported, 'PDTE')::text as luis_lemus_reported,
        COALESCE(p.envio_originales, false)::boolean as envio_originales,
        -- 🔄 Datos de máquina obtenidos de la tabla machines (SINCRONIZACIÓN AUTOMÁTICA)
        m.brand::text,
        m.model::text,
        m.serial::text,
        m.year::integer,
        COALESCE(m.hours, 0)::integer as hours,
        m.machine_type::text as machine_type,
        -- Precio de compra: usar price_bought de la subasta (SUBASTA) o N/A en compra directa (se captura desde EXW en frontend)
        COALESCE(a.price_bought, 0)::numeric as auction_price_bought
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      LEFT JOIN auctions a ON p.auction_id = a.id
      
      UNION ALL
      
      -- Incluir new_purchases (esquema unificado)
      SELECT 
        np.id::uuid,
        NULL::uuid as machine_id,
        NULL::uuid as auction_id,
        NULL::text as supplier_id,
        np.invoice_date::date,
        np.payment_date::date,
        COALESCE(np.incoterm, 'EXW')::text as incoterm,
        NULL::numeric as exw_value,
        NULL::numeric as fob_value,
        0::numeric as trm,
        NULL::numeric as usd_rate,
        NULL::numeric as jpy_rate,
        NULL::numeric as usd_jpy_rate,
        CASE WHEN np.payment_date IS NOT NULL THEN 'COMPLETADO' ELSE 'PENDIENTE' END::text as payment_status,
        COALESCE(np.shipment, 'N/A')::text as shipment_type,
        -- ✅ PUERTO EMBARQUE: NO usar port_of_loading para registros de new_purchases (solo para purchases)
        NULL::text as port_of_embarkation,
        NULL::text as port_of_shipment,
        NULL::numeric as fob_additional,
        NULL::numeric as disassembly_load,
        NULL::text as exw_value_formatted,
        NULL::text as fob_expenses,
        NULL::numeric as disassembly_load_value,
        NULL::numeric as fob_total,
        np.shipment_departure_date::date as departure_date,
        NULL::date as estimated_arrival_date,
        np.shipment_departure_date::date,
        np.shipment_arrival_date::date,
        -- ✅ NACIONALIZACIÓN: usar nationalization_date de new_purchases
        np.nationalization_date::date as nationalization_date,
        -- ✅ PUERTO DE LLEGADA: port_of_loading de new_purchases va solo a port_of_destination
        np.port_of_loading::text as port_of_destination,
        -- ✅ MOVIMIENTO: NO usar machine_location de new_purchases para current_movement (solo para location)
        NULL::text as current_movement,
        NULL::date as current_movement_date,
        NULL::text as current_movement_plate,
        np.mc::text,
        -- ✅ UBICACIÓN: usar machine_location de new_purchases
        np.machine_location::text as location,
        np.invoice_number::text,
        np.purchase_order::text,
        NULL::numeric as valor_factura_proveedor,
        NULL::text as observaciones_pagos,
        NULL::text as pendiente_a,
        NULL::date as fecha_vto_fact,
        NULL::text as pending_marker,
        NULL::text as cu,
        np.due_date::date as due_date,
        NULL::text as driver_name,
        NULL::text as epa,
        NULL::text as cpd,
        np.created_at::timestamptz,
        np.updated_at::timestamptz,
        np.supplier_name::text,
        np.mq::text,
        COALESCE(np.type, 'COMPRA_DIRECTA')::text as tipo,
        COALESCE(np.type, 'COMPRA_DIRECTA')::text as purchase_type,
        COALESCE(np.shipment, 'N/A')::text as shipment,
        COALESCE(np.shipment, 'N/A')::text as shipment_type_v2,
        COALESCE(np.currency, 'USD')::text as currency,
        COALESCE(np.currency, 'USD')::text as currency_type,
        COALESCE(np.trm_display, '0')::text as trm_display,
        COALESCE(np.trm_rate, 0)::numeric as trm_rate,
        COALESCE(np.condition, 'NUEVO')::text as condition,
        NULL::numeric as cif_usd,
        false::boolean as fob_total_verified,
        false::boolean as cif_usd_verified,
        0::numeric as total_valor_girado,
        np.empresa::text,
        'PDTE'::text as sales_reported,
        'PDTE'::text as commerce_reported,
        'PDTE'::text as luis_lemus_reported,
        false as envio_originales,
        -- ✅ Datos de máquina desde new_purchases (para mostrar en importaciones)
        np.brand::text as brand,
        np.model::text as model,
        np.serial::text as serial,
        -- ✅ AÑO: usar year de new_purchases (la columna debe existir - ejecutar migración 20251206_add_fields_to_new_purchases.sql si no existe)
        np.year::integer as year,
        NULL::integer as hours,
        np.machine_type::text as machine_type,
        -- Precio de compra (no editable en new_purchases, se mantiene null)
        NULL::numeric as auction_price_bought
      FROM new_purchases np
      WHERE NOT EXISTS (
        -- Excluir new_purchases que ya tienen un purchase espejo (para evitar duplicados)
        SELECT 1 FROM purchases p2 WHERE p2.mq = np.mq
      )
      
      ORDER BY created_at DESC
    `;
    
    // Agregar paginación si se especifica y no se solicita todo
    if (!getAll && limit && limit > 0) {
      query += ` LIMIT ${limit} OFFSET ${offset}`;
    }
    
    const result = await pool.query(query);
    
    // Si se solicita con paginación, obtener el total de registros
    let total = null;
    if (!getAll && limit && limit > 0) {
      const countQuery = `
        SELECT COUNT(*) as total FROM (
          SELECT p.id FROM purchases p
          UNION ALL
          SELECT np.id FROM new_purchases np
          WHERE NOT EXISTS (SELECT 1 FROM purchases p2 WHERE p2.mq = np.mq)
        ) as combined
      `;
      const countResult = await pool.query(countQuery);
      total = parseInt(countResult.rows[0].total, 10);
    }
    
    console.log('✅ Compras encontradas:', result.rows.length);
    
    // Retornar respuesta con metadatos de paginación si aplica
    if (total !== null) {
      res.json({
        data: result.rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      });
    } else {
      res.json(result.rows);
    }
  } catch (error) {
    console.error('❌ Error al obtener compras:', error);
    res.status(500).json({ error: 'Error al obtener compras', details: error.message });
  }
});

// POST /api/purchases
router.post('/', requireEliana, async (req, res) => {
  try {
    const { userId } = req.user;
    const data = { ...req.body, created_by: userId };
    
    const fields = Object.keys(data).filter(k => k !== 'machine_year' && k !== 'machine_hours' && k !== 'lot_number');
    const values = fields.map(f => data[f]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const result = await pool.query(
      `INSERT INTO purchases (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    
    // Verificar reglas de notificación para importaciones
    try {
      await checkAndExecuteRules();
    } catch (notifError) {
      console.error('Error al verificar reglas de notificación:', notifError);
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear compra:', error);
    res.status(500).json({ error: 'Error al crear compra', details: error.message });
  }
});

// POST /api/purchases/direct - Crear compra directa desde Gerencia
router.post('/direct', async (req, res) => {
  try {
    const { userId } = req.user;
    const { 
      supplier_name, brand, model, serial, year, hours, machine_type,
      condition, incoterm, currency_type, exw_value_formatted 
    } = req.body;

    // 1. Crear o buscar proveedor
    let supplierId = null;
    if (supplier_name) {
      const supplierCheck = await pool.query(
        'SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)',
        [supplier_name]
      );
      if (supplierCheck.rows.length > 0) {
        supplierId = supplierCheck.rows[0].id;
      } else {
        const newSupplier = await pool.query(
          'INSERT INTO suppliers (name) VALUES ($1) RETURNING id',
          [supplier_name]
        );
        supplierId = newSupplier.rows[0].id;
      }
    }

    // 2. Crear máquina
    const machineResult = await pool.query(
      `INSERT INTO machines (brand, model, serial, year, hours, machine_type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
      [brand, model, serial, year || new Date().getFullYear(), hours || 0, normalizeMachineType(machine_type)]
    );
    const machineId = machineResult.rows[0].id;

    // 3. Crear compra
    // Usar la fecha actual como invoice_date (NOT NULL constraint)
    const invoiceDate = new Date().toISOString().split('T')[0];
    
    // Calcular due_date automáticamente: invoice_date + 10 días
    const invoiceDateObj = new Date(invoiceDate);
    invoiceDateObj.setDate(invoiceDateObj.getDate() + 10);
    const dueDate = invoiceDateObj.toISOString().split('T')[0];
    
    const purchaseResult = await pool.query(
      `INSERT INTO purchases (
        machine_id, supplier_id, purchase_type, incoterm, currency_type, 
        exw_value_formatted, invoice_date, due_date, trm, payment_status, shipment_type_v2, created_by, created_at, updated_at
      ) VALUES ($1, $2, 'COMPRA_DIRECTA', $3, $4, $5, $6, $7, $8, 'PENDIENTE', $9, $10, NOW(), NOW()) RETURNING *`,
      [machineId, supplierId, incoterm || 'FOB', currency_type || 'USD', exw_value_formatted || null, invoiceDate, dueDate, 0, '1X40', userId]
    );

    // 4. Crear equipment
    await pool.query(
      `INSERT INTO equipments (purchase_id, state, created_at, updated_at)
       VALUES ($1, 'Libre', NOW(), NOW())`,
      [purchaseResult.rows[0].id]
    );

    // 5. Crear service_record
    await pool.query(
      `INSERT INTO service_records (purchase_id, created_at, updated_at)
       VALUES ($1, NOW(), NOW())`,
      [purchaseResult.rows[0].id]
    );

    console.log('✅ Compra directa creada desde Gerencia:', purchaseResult.rows[0].id);
    res.status(201).json(purchaseResult.rows[0]);
  } catch (error) {
    console.error('Error al crear compra directa:', error);
    res.status(500).json({ error: 'Error al crear compra directa', details: error.message });
  }
});

// PUT /api/purchases/:id/machine - Actualizar campos de máquina para compras directas
router.put('/:id/machine', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Obtener machine_id del purchase
    const purchaseCheck = await pool.query('SELECT machine_id FROM purchases WHERE id = $1', [id]);
    if (purchaseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    const machineId = purchaseCheck.rows[0].machine_id;
    
    // Construir query de actualización
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    
    await pool.query(
      `UPDATE machines SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1}`,
      [...values, machineId]
    );

    // Nota: Los campos brand, model, serial, year, hours no existen en purchases,
    // solo en machines. Por lo tanto, no se sincronizan en purchases.
    // Estos campos se obtienen mediante JOIN con machines en las consultas SELECT.
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando máquina:', error);
    res.status(500).json({ error: 'Error al actualizar máquina' });
  }
});

// PUT /api/purchases/:id/supplier - Actualizar proveedor para compras directas
router.put('/:id/supplier', async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_name } = req.body;
    
    console.log(`📝 PUT /api/purchases/${id}/supplier - Actualizando proveedor:`, { supplier_name });
    
    if (!supplier_name || supplier_name.trim() === '') {
      return res.status(400).json({ error: 'supplier_name es requerido' });
    }
    
    // Normalizar el nombre del proveedor (preservar espacios y caracteres especiales como "/")
    const normalizedSupplierName = String(supplier_name).trim();
    console.log(`🔄 Nombre normalizado: "${normalizedSupplierName}"`);
    
    // Verificar que el purchase existe
    const purchaseCheck = await pool.query('SELECT id FROM purchases WHERE id = $1', [id]);
    if (purchaseCheck.rows.length === 0) {
      console.error(`❌ Purchase no encontrado: ${id}`);
      return res.status(404).json({ error: 'Purchase no encontrado' });
    }
    
    // Buscar o crear proveedor
    let supplierId = null;
    const supplierCheck = await pool.query(
      'SELECT id FROM suppliers WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))',
      [normalizedSupplierName]
    );
    
    if (supplierCheck.rows.length > 0) {
      supplierId = supplierCheck.rows[0].id;
      console.log(`✅ Proveedor existente encontrado: ID ${supplierId}`);
    } else {
      console.log(`📝 Creando nuevo proveedor: "${normalizedSupplierName}"`);
      const newSupplier = await pool.query(
        'INSERT INTO suppliers (name) VALUES ($1) RETURNING id',
        [normalizedSupplierName]
      );
      supplierId = newSupplier.rows[0].id;
      console.log(`✅ Nuevo proveedor creado: ID ${supplierId}`);
    }
    
    // Actualizar purchase con nuevo supplier_id Y supplier_name
    console.log(`🔄 Actualizando purchase ${id} con supplier_id=${supplierId}, supplier_name="${normalizedSupplierName}"`);
    const updateResult = await pool.query(
      'UPDATE purchases SET supplier_id = $1, supplier_name = $2, updated_at = NOW() WHERE id = $3 RETURNING id, supplier_id, supplier_name',
      [supplierId, normalizedSupplierName, id]
    );
    
    if (updateResult.rows.length === 0) {
      console.error(`❌ No se pudo actualizar purchase ${id}`);
      return res.status(500).json({ error: 'No se pudo actualizar el purchase' });
    }
    
    console.log(`✅ Purchase actualizado:`, updateResult.rows[0]);
    
    // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Sincronizar supplier_name a otros módulos
    try {
      const updates = { supplier_name: normalizedSupplierName };
      // Sincronizar a new_purchases y equipments
      await syncPurchaseToNewPurchaseAndEquipment(id, updates);
      // Sincronizar a auctions y preselections
      await syncPurchaseToAuctionAndPreselection(id, updates);
      console.log(`✅ Supplier sincronizado desde purchases (ID: ${id}) a otros módulos`);
    } catch (syncError) {
      console.error('⚠️ Error en sincronización bidireccional de supplier (no crítico):', syncError?.message || syncError);
      // No fallar la operación si la sincronización falla
    }
    
    res.json({ success: true, supplier_id: supplierId, supplier_name: normalizedSupplierName });
  } catch (error) {
    console.error('❌ Error actualizando proveedor:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Error al actualizar proveedor', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// PUT /api/purchases/:id
router.put('/:id', canEditShipmentDates, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // ✅ CON ESQUEMA UNIFICADO: Verificar si es purchase o new_purchase
    const purchaseCheck = await pool.query(
      'SELECT machine_id, fob_total_verified, mq, model, serial FROM purchases WHERE id = $1',
      [id]
    );
    const newPurchaseCheck = await pool.query('SELECT id FROM new_purchases WHERE id = $1', [id]);
    
    if (purchaseCheck.rows.length === 0 && newPurchaseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    
    // Si es new_purchase, actualizar new_purchases con mapeo correcto de campos
    if (newPurchaseCheck.rows.length > 0) {
      // Mapeo de campos de purchases a new_purchases
      const fieldMapping = {
        // Campos que existen en ambas tablas (mismo nombre)
        'mq': 'mq',
        'supplier_name': 'supplier_name',
        'brand': 'brand',
        'model': 'model',
        'serial': 'serial',
        'condition': 'condition',
        'purchase_order': 'purchase_order',
        'invoice_number': 'invoice_number',
        'invoice_date': 'invoice_date',
        'payment_date': 'payment_date',
        'incoterm': 'incoterm',
        'currency': 'currency',
        'shipment_departure_date': 'shipment_departure_date',
        'shipment_arrival_date': 'shipment_arrival_date',
        'mc': 'mc',
        'empresa': 'empresa',
        'year': 'year',
        // ✅ Campos que se mapean a otros nombres
        'port_of_destination': 'port_of_loading',  // PUERTO DE LLEGADA → port_of_loading (solo para registros de new_purchases)
        // 'port_of_embarkation': NO se sincroniza desde new_purchases (solo se usa en purchases)
        // 'port_of_shipment': NO se sincroniza desde new_purchases
        // 'current_movement': NO se sincroniza desde new_purchases (machine_location es solo para ubicación de importaciones)
        'shipment_type': 'shipment',
        'shipment_type_v2': 'shipment',
        // ✅ NACIONALIZACIÓN: sincronizar desde importaciones
        'nationalization_date': 'nationalization_date',
        // Campos que no existen en new_purchases (se ignoran)
        'current_movement_date': null,
        'current_movement_plate': null,
        'driver_name': null,
        'machine_id': null,
        'auction_id': null,
        'supplier_id': null,
        'exw_value': null,
        'fob_value': null,
        'trm': null,
        'usd_rate': null,
        'jpy_rate': null,
        'usd_jpy_rate': null,
        'payment_status': null,
        'fob_additional': null,
        'disassembly_load': null,
        'exw_value_formatted': null,
        'fob_expenses': null,
        'disassembly_load_value': null,
        'fob_total': null,
        'departure_date': null,
        'estimated_arrival_date': null,
        'location': null,
        'currency_type': null,
        'valor_factura_proveedor': null,
        'observaciones_pagos': null,
        'pendiente_a': null,
        'fecha_vto_fact': null,
        'pending_marker': null,
        'cu': null,
        'due_date': null,
        'trm_rate': null,
        'trm_display': null,
        'cif_usd': null,
        'fob_total_verified': null,
        'cif_usd_verified': null,
        'sales_reported': null,
        'commerce_reported': null,
        'luis_lemus_reported': null,
        'envio_originales': null,
        'cpd': null,
        'pvp_est': null,
        'comments': null
      };

      // Filtrar y mapear campos - SOLO campos que existen en new_purchases
      const mappedFields = {};
      for (const [purchaseField, newPurchaseField] of Object.entries(fieldMapping)) {
        if (updates[purchaseField] !== undefined && newPurchaseField !== null) {
          // Si hay múltiples campos que mapean al mismo (ej: port_of_destination, port_of_embarkation -> port_of_loading)
          // Usar el último valor no nulo
          if (!mappedFields[newPurchaseField] || updates[purchaseField] !== null) {
            mappedFields[newPurchaseField] = updates[purchaseField];
          }
        }
      }

      // ✅ FILTRO ADICIONAL: Verificar que solo se actualicen campos que realmente existen en new_purchases
      // Lista de campos válidos en new_purchases
      const validNewPurchaseFields = [
        'mq', 'type', 'shipment', 'supplier_name', 'condition', 'brand', 'model', 'serial',
        'purchase_order', 'invoice_number', 'invoice_date', 'payment_date',
        'machine_location', 'incoterm', 'currency', 'port_of_loading', 'port_of_embarkation',
        'shipment_departure_date', 'shipment_arrival_date', 'value', 'mc', 'empresa',
        'year', 'nationalization_date'  // ✅ Campos agregados para sincronización con importaciones
      ];
      
      // Campos de fecha que deben convertirse a NULL si están vacíos
      const dateFields = ['invoice_date', 'payment_date', 'shipment_departure_date', 'shipment_arrival_date', 'nationalization_date'];
      
      // Filtrar solo campos válidos y convertir cadenas vacías a NULL para campos de fecha
      const validMappedFields = {};
      for (const [field, value] of Object.entries(mappedFields)) {
        if (validNewPurchaseFields.includes(field)) {
          // ✅ Convertir cadenas vacías a NULL para campos de fecha (más robusto)
          if (dateFields.includes(field)) {
            // Si es cadena vacía, null, undefined, o solo espacios en blanco, convertir a NULL
            if (!value || (typeof value === 'string' && value.trim() === '')) {
              validMappedFields[field] = null;
            } else {
              validMappedFields[field] = value;
            }
          } else {
            validMappedFields[field] = value;
          }
        } else {
          console.warn(`⚠️ Campo ${field} no existe en new_purchases, se omite`);
        }
      }

      // Eliminar campos que no deben actualizarse
      delete validMappedFields.id;
      delete validMappedFields.machine_year;
      delete validMappedFields.machine_hours;
      delete validMappedFields.lot_number;

      const fields = Object.keys(validMappedFields);
      const values = fields.map(f => validMappedFields[f]);
      const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      
      if (fields.length > 0) {
        const result = await pool.query(
          `UPDATE new_purchases SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
          [...values, id]
        );
        
        // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Sincronizar cambios a equipments
        // Nota: No necesitamos sincronizar de new_purchases a purchases porque estamos actualizando new_purchases
        // Pero sí sincronizamos a equipments
        try {
          // Obtener el MQ para sincronizar a equipments
          const newPurchaseData = result.rows[0];
          if (newPurchaseData.mq) {
            // Sincronizar campos relevantes a equipments
            const equipmentUpdates = {};
            if (validMappedFields.port_of_loading !== undefined) {
              equipmentUpdates.port_of_destination = validMappedFields.port_of_loading;
            }
            // ✅ NO sincronizar machine_location a current_movement (machine_location es solo para ubicación de importaciones)
            // current_movement se gestiona desde logística
            if (validMappedFields.shipment_departure_date !== undefined) {
              equipmentUpdates.shipment_departure_date = validMappedFields.shipment_departure_date;
            }
            if (validMappedFields.shipment_arrival_date !== undefined) {
              equipmentUpdates.shipment_arrival_date = validMappedFields.shipment_arrival_date;
            }
            // ✅ NACIONALIZACIÓN: sincronizar a equipments
            if (validMappedFields.nationalization_date !== undefined) {
              equipmentUpdates.nationalization_date = validMappedFields.nationalization_date;
            }
            // ✅ NO sincronizar mc a equipments (la columna no existe en equipments)
            
            if (Object.keys(equipmentUpdates).length > 0) {
              await pool.query(
                `UPDATE equipments 
                 SET ${Object.keys(equipmentUpdates).map((f, i) => `${f} = $${i + 1}`).join(', ')}, updated_at = NOW()
                 WHERE new_purchase_id = $${Object.keys(equipmentUpdates).length + 1}`,
                [...Object.values(equipmentUpdates), id]
              );
              console.log(`✅ Sincronizado a equipments desde new_purchases`);
            }

            // ✅ Sincronizar también a service_records
            const serviceUpdates = {};
            if (validMappedFields.shipment_departure_date !== undefined) {
              serviceUpdates.shipment_departure_date = validMappedFields.shipment_departure_date;
            }
            if (validMappedFields.shipment_arrival_date !== undefined) {
              serviceUpdates.shipment_arrival_date = validMappedFields.shipment_arrival_date;
            }
            if (validMappedFields.port_of_loading !== undefined) {
              serviceUpdates.port_of_destination = validMappedFields.port_of_loading;
            }
            // ✅ NACIONALIZACIÓN: sincronizar a service_records
            if (validMappedFields.nationalization_date !== undefined) {
              serviceUpdates.nationalization_date = validMappedFields.nationalization_date;
            }
            if (validMappedFields.mc !== undefined) {
              serviceUpdates.mc = validMappedFields.mc;
            }
            
            if (Object.keys(serviceUpdates).length > 0) {
              await pool.query(
                `UPDATE service_records 
                 SET ${Object.keys(serviceUpdates).map((f, i) => `${f} = $${i + 1}`).join(', ')}, updated_at = NOW()
                 WHERE new_purchase_id = $${Object.keys(serviceUpdates).length + 1}`,
                [...Object.values(serviceUpdates), id]
              );
              console.log(`✅ Sincronizado a service_records desde new_purchases`);
            }
          }
        } catch (syncError) {
          console.error('⚠️ Error en sincronización bidireccional (no crítico):', syncError);
        }
        
        res.json(result.rows[0]);
        return;
      } else {
        const result = await pool.query('SELECT * FROM new_purchases WHERE id = $1', [id]);
        res.json(result.rows[0]);
        return;
      }
    }
    
    // Si es purchase, continuar con la lógica original
    const machineId = purchaseCheck.rows[0].machine_id;
    
    // Separar campos de máquina vs campos de purchase
    const machineFields = ['brand', 'model', 'serial', 'year', 'hours', 'machine_type'];
    const machineUpdates = {};
    const purchaseUpdates = {};
    
    // Campos que deben actualizarse TANTO en machines COMO en purchases (sincronización bidireccional)
    const bidirectionalFields = ['model', 'serial', 'brand'];
    
    // Convertir strings vacíos a null para campos de fecha
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'machine_year' || key === 'machine_hours' || key === 'lot_number' || key === 'id') {
        continue; // Ignorar estos campos
      }
      
      if (machineFields.includes(key)) {
        // Campos que van a machines
        machineUpdates[key] = value;
        
        // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Si son campos que también deben estar en purchases, agregarlos también
        if (bidirectionalFields.includes(key)) {
          purchaseUpdates[key] = value;
        }
      } else {
        // Campos que van a purchases
        if (key.includes('date') || key.includes('Date')) {
          purchaseUpdates[key] = (value === '' || value === null || value === undefined) ? null : value;
        } else if (key === 'current_movement') {
          purchaseUpdates[key] = value;
        } else {
          purchaseUpdates[key] = value;
        }
      }
    }

    if (machineUpdates.machine_type !== undefined) {
      machineUpdates.machine_type = normalizeMachineType(machineUpdates.machine_type);
    }
    
    // Normalizar/validar puerto de embarque contra constraint de BD
    if (purchaseUpdates.port_of_embarkation !== undefined) {
      const allowedPorts = [
        'AMBERES',
        'AMSTERDAM',
        'ALBERTA',
        'BALTIMORE',
        'CANADA',
        'FLORIDA',
        'FUJI',
        'HAKATA',
        'HOKKAIDO',
        'HYOGO',
        'JACKSONVILLE',
        'KASHIBA',
        'KOBE',
        'LAKE WORTH',
        'LEBANON',
        'MIAMI',
        'NAGOYA',
        'NARITA',
        'OSAKA',
        'SAKURA',
        'SAVANNA',
        'TIANJIN',
        'TOMAKOMAI',
        'YOKOHAMA',
        'ZEEBRUGE',
      ];
      const normalizedPort = purchaseUpdates.port_of_embarkation
        ? String(purchaseUpdates.port_of_embarkation).toUpperCase().trim()
        : null;
      if (normalizedPort && !allowedPorts.includes(normalizedPort)) {
        return res.status(400).json({
          error: `Puerto de embarque inválido. Usa uno de: ${allowedPorts.join(', ')}`
        });
      }
      purchaseUpdates.port_of_embarkation = normalizedPort;
    }
    
    // 🔄 Actualizar máquina si hay cambios (SINCRONIZACIÓN BIDIRECCIONAL)
    if (Object.keys(machineUpdates).length > 0 && machineId) {
      const machineFieldsArr = Object.keys(machineUpdates);
      const machineValuesArr = Object.values(machineUpdates);
      const machineSetClause = machineFieldsArr.map((field, index) => 
        `${field} = $${index + 1}`
      ).join(', ');
      
      await pool.query(
        `UPDATE machines SET ${machineSetClause}, updated_at = NOW() 
         WHERE id = $${machineFieldsArr.length + 1}`,
        [...machineValuesArr, machineId]
      );
      
      console.log(`✅ Cambios sincronizados desde Compras a Máquina (ID: ${machineId}):`, Object.keys(machineUpdates));
      
      // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Obtener valores actualizados de machines y sincronizar a purchases
      // Esto asegura que purchases.model y purchases.serial siempre estén sincronizados con machines
      const updatedMachineResult = await pool.query(
        'SELECT model, serial, brand, machine_type FROM machines WHERE id = $1',
        [machineId]
      );
      
      if (updatedMachineResult.rows.length > 0) {
        const updatedMachine = updatedMachineResult.rows[0];
        // Sincronizar campos bidireccionales a purchases
        if (updatedMachine.model) purchaseUpdates.model = updatedMachine.model;
        if (updatedMachine.serial) purchaseUpdates.serial = updatedMachine.serial;
        if (updatedMachine.brand) purchaseUpdates.brand = updatedMachine.brand;
        console.log(`✅ Campos model/serial/brand sincronizados desde machines a purchases para actualización`);
      }
    }
    
    // Actualizar purchase
    if (Object.keys(purchaseUpdates).length > 0) {
      // Si se actualiza currency_type, también actualizar currency para mantener sincronización con pagos
      if (purchaseUpdates.currency_type !== undefined) {
        purchaseUpdates.currency = purchaseUpdates.currency_type;
      }

      // Si se actualiza invoice_date y no viene due_date, calcular automáticamente
      if (purchaseUpdates.invoice_date && !purchaseUpdates.due_date) {
        // Si invoice_date se actualiza pero due_date no viene, calcular automáticamente (invoice_date + 10 días)
        const invoiceDate = new Date(purchaseUpdates.invoice_date);
        invoiceDate.setDate(invoiceDate.getDate() + 10);
        purchaseUpdates.due_date = invoiceDate.toISOString().split('T')[0];
        console.log(`📅 Calculando due_date automáticamente: invoice_date=${purchaseUpdates.invoice_date}, due_date=${purchaseUpdates.due_date}`);
      }
      
      // Si el registro ya tiene invoice_date pero no tiene due_date, calcularlo también
      if (!purchaseUpdates.invoice_date && !purchaseUpdates.due_date) {
        const currentPurchase = await pool.query('SELECT invoice_date, due_date FROM purchases WHERE id = $1', [id]);
        if (currentPurchase.rows.length > 0) {
          const currentInvoiceDate = currentPurchase.rows[0].invoice_date;
          const currentDueDate = currentPurchase.rows[0].due_date;
          if (currentInvoiceDate && !currentDueDate) {
            // Calcular due_date para registros existentes que tienen invoice_date pero no due_date
            const invoiceDate = new Date(currentInvoiceDate);
            invoiceDate.setDate(invoiceDate.getDate() + 10);
            purchaseUpdates.due_date = invoiceDate.toISOString().split('T')[0];
            console.log(`📅 Calculando due_date para registro existente: invoice_date=${currentInvoiceDate}, due_date=${purchaseUpdates.due_date}`);
          }
        }
      }

      const fields = Object.keys(purchaseUpdates);
      const values = fields.map(f => purchaseUpdates[f]);
      const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      
      console.log(`🔄 Actualizando purchases (ID: ${id}):`, Object.keys(purchaseUpdates));
      
      const result = await pool.query(
        `UPDATE purchases SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );
      
      // 🚨 Notificar a Jefe Comercial cuando se marca FOB ORIGEN verificado
      try {
        const wasFobVerified = !!purchaseCheck.rows?.[0]?.fob_total_verified;
        const becameFobVerified = purchaseUpdates.fob_total_verified === true || purchaseUpdates.fob_total_verified === 'true';
        if (!wasFobVerified && becameFobVerified) {
          const mq = purchaseUpdates.mq || purchaseCheck.rows?.[0]?.mq || 'N/A';
          const model = purchaseUpdates.model || purchaseCheck.rows?.[0]?.model || 'N/A';
          const serial = purchaseUpdates.serial || purchaseCheck.rows?.[0]?.serial || 'N/A';
          await createNotification({
            targetRoles: ['jefe_comercial'],
            moduleSource: 'purchases',
            moduleTarget: 'equipments',
            type: 'info',
            priority: 3,
            title: 'Solicitud Crear Orden de Compra SAP',
            message: `FOB ORIGEN verificado para MQ ${mq} · Modelo ${model} · Serie ${serial}`,
            referenceId: id,
            actionType: 'view_equipment',
            actionUrl: `/equipments?purchaseId=${encodeURIComponent(id)}`
          });
          console.log('✅ Notificación enviada a jefe_comercial por FOB verificado');
        }
      } catch (notifError) {
        console.error('⚠️ Error creando notificación FOB verificado:', notifError);
      }
      
      // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Sincronizar cambios a subasta y preselección relacionadas
      const allUpdates = { ...purchaseUpdates, ...machineUpdates };
      await syncPurchaseToAuctionAndPreselection(id, allUpdates);
      
      // Limpiar notificaciones si se completaron campos críticos
      const criticalFields = ['shipment_departure_date', 'shipment_arrival_date', 'port_of_destination', 'nationalization_date'];
      for (const field of criticalFields) {
        if (purchaseUpdates[field] && purchaseUpdates[field] !== null) {
          try {
            await clearImportNotifications(id, field);
          } catch (notifError) {
            console.error(`Error al limpiar notificaciones de ${field}:`, notifError);
          }
        }
      }
      
      // Si algún campo crítico se vació o aún falta, verificar reglas
      const needsCheck = criticalFields.some(field => 
        field in purchaseUpdates && (purchaseUpdates[field] === null || purchaseUpdates[field] === '')
      );
      if (needsCheck) {
        try {
          await checkAndExecuteRules();
        } catch (notifError) {
          console.error('Error al verificar reglas de notificación:', notifError);
        }
      }
      
      // 🔔 Trigger: Si se agregó/actualizó fecha de factura, disparar notificación
      if (purchaseUpdates.invoice_date && purchaseUpdates.invoice_date !== null) {
        try {
          const { triggerNotificationForEvent } = await import('../services/notificationTriggers.js');
          await triggerNotificationForEvent('invoice_date_added', {
            recordId: id,
            purchaseData: result.rows[0]
          });
        } catch (notifError) {
          console.error('Error al disparar notificación de fecha factura:', notifError);
        }
      }
      
      // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Sincronizar cambios a new_purchases y equipments
      try {
        await syncPurchaseToNewPurchaseAndEquipment(id, purchaseUpdates);
      } catch (syncError) {
        console.error('⚠️ Error en sincronización bidireccional (no crítico):', syncError);
      }
      
      res.json(result.rows[0]);
    } else if (Object.keys(machineUpdates).length > 0) {
      // Si solo se actualizó la máquina, devolver el purchase
      const result = await pool.query('SELECT * FROM purchases WHERE id = $1', [id]);
      res.json(result.rows[0]);
    } else {
      res.json({ message: 'Sin cambios para actualizar' });
    }
  } catch (error) {
    console.error('Error al actualizar compra:', error);
    res.status(500).json({ error: 'Error al actualizar compra', details: error.message });
  }
});

// PATCH /api/purchases/:id/toggle-pending
// Toggle el marcador de pendiente para seguimiento visual
router.patch('/:id/toggle-pending', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener el estado actual
    const current = await pool.query('SELECT pending_marker FROM purchases WHERE id = $1', [id]);
    
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    
    // pending_marker es de tipo TEXT, puede ser null, '' (vacío), o algún valor
    // Si tiene algún valor (no null y no vacío), lo consideramos como "marcado"
    // Si está null o vacío, lo consideramos como "no marcado"
    const currentValue = current.rows[0].pending_marker;
    const isMarked = currentValue && currentValue.trim() !== '';
    
    // Toggle: si está marcado, lo desmarcamos (null), si no está marcado, lo marcamos ('PENDIENTE')
    const newValue = isMarked ? null : 'PENDIENTE';
    
    const result = await pool.query(
      'UPDATE purchases SET pending_marker = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newValue, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar marcador pendiente:', error);
    res.status(500).json({ error: 'Error al actualizar marcador pendiente' });
  }
});

// DELETE /api/purchases/:id
// POST /api/purchases/group-by-cu - Agrupar compras seleccionadas en un CU
router.post('/group-by-cu', requireEliana, async (req, res) => {
  try {
    const { purchase_ids, cu } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!purchase_ids || !Array.isArray(purchase_ids) || purchase_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de purchase_ids' });
    }

    // Generar CU secuencial si no se proporciona
    let finalCu = cu;
    if (!finalCu) {
      // Buscar el CU más alto existente
      const maxCuQuery = await pool.query(
        `SELECT cu FROM purchases 
         WHERE cu IS NOT NULL 
         AND cu ~ '^CU[0-9]+$'
         ORDER BY 
           CAST(SUBSTRING(cu FROM 3) AS INTEGER) DESC
         LIMIT 1`
      );

      let nextNumber = 1;
      if (maxCuQuery.rows.length > 0 && maxCuQuery.rows[0].cu) {
        const maxCu = maxCuQuery.rows[0].cu;
        const numberMatch = maxCu.match(/^CU(\d+)$/);
        if (numberMatch) {
          nextNumber = parseInt(numberMatch[1], 10) + 1;
        }
      }

      // Formatear como CU001, CU002, etc. (3 dígitos mínimo)
      finalCu = `CU${String(nextNumber).padStart(3, '0')}`;
    }

    // Verificar que todos los purchase_ids existan y pertenezcan al usuario (si aplica)
    const placeholders = purchase_ids.map((_, i) => `$${i + 1}`).join(', ');
    const checkQuery = await pool.query(
      `SELECT id FROM purchases WHERE id IN (${placeholders})`,
      purchase_ids
    );

    if (checkQuery.rows.length !== purchase_ids.length) {
      return res.status(400).json({ error: 'Algunos purchase_ids no existen' });
    }

    // Actualizar todos los purchases con el mismo CU y cambiar SHIPMENT a 1X40 (contenedor)
    const updateQuery = await pool.query(
      `UPDATE purchases 
       SET cu = $1, 
           shipment_type_v2 = '1X40',
           updated_at = NOW() 
       WHERE id = ANY($2)
       RETURNING id, cu, mq, brand, model, serial`,
      [finalCu, purchase_ids]
    );

    console.log(`✅ Agrupadas ${updateQuery.rows.length} compras en CU: ${finalCu} - SHIPMENT cambiado a 1X40`);

    res.json({
      success: true,
      cu: finalCu,
      count: updateQuery.rows.length,
      purchases: updateQuery.rows,
      message: `${updateQuery.rows.length} compra(s) agrupada(s) en CU ${finalCu}`
    });
  } catch (error) {
    console.error('❌ Error al agrupar compras por CU:', error);
    res.status(500).json({ error: 'Error al agrupar compras por CU', details: error.message });
  }
});

// DELETE /api/purchases/ungroup/:id - Desagrupar una compra (eliminar su CU)
router.delete('/ungroup/:id', requireEliana, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE purchases 
       SET cu = NULL, 
           shipment_type_v2 = 'RORO',
           updated_at = NOW() 
       WHERE id = $1
       RETURNING id, cu`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    res.json({
      success: true,
      message: 'Compra desagrupada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al desagrupar compra:', error);
    res.status(500).json({ error: 'Error al desagrupar compra', details: error.message });
  }
});

// DELETE /api/purchases/ungroup-mq/:id - Desagrupar una compra (eliminar su MQ)
router.delete('/ungroup-mq/:id', requireEliana, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE purchases 
       SET mq = NULL, 
           updated_at = NOW() 
       WHERE id = $1
       RETURNING id, mq`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    res.json({
      success: true,
      message: 'Importación desagrupada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al desagrupar importación:', error);
    res.status(500).json({ error: 'Error al desagrupar importación', details: error.message });
  }
});

// POST /api/purchases/group-by-mq - Agrupar compras seleccionadas en un MQ
router.post('/group-by-mq', requireEliana, async (req, res) => {
  try {
    const { purchase_ids, mq } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!purchase_ids || !Array.isArray(purchase_ids) || purchase_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de purchase_ids' });
    }

    if (!mq || mq.trim() === '') {
      return res.status(400).json({ error: 'Se requiere un MQ válido' });
    }

    const finalMq = mq.trim();

    // Verificar que todos los purchase_ids existan
    const placeholders = purchase_ids.map((_, i) => `$${i + 1}`).join(', ');
    const checkQuery = await pool.query(
      `SELECT id FROM purchases WHERE id IN (${placeholders})`,
      purchase_ids
    );

    if (checkQuery.rows.length !== purchase_ids.length) {
      return res.status(400).json({ error: 'Algunos purchase_ids no existen' });
    }

    // Actualizar todos los purchases con el mismo MQ
    const updateQuery = await pool.query(
      `UPDATE purchases 
       SET mq = $1, 
           updated_at = NOW() 
       WHERE id = ANY($2)
       RETURNING id, mq, brand, model, serial`,
      [finalMq, purchase_ids]
    );

    console.log(`✅ Agrupadas ${updateQuery.rows.length} importaciones en MQ: ${finalMq}`);

    res.json({
      success: true,
      mq: finalMq,
      count: updateQuery.rows.length,
      purchases: updateQuery.rows,
      message: `${updateQuery.rows.length} importación(es) movida(s) al MQ ${finalMq}`
    });
  } catch (error) {
    console.error('❌ Error al agrupar importaciones por MQ:', error);
    res.status(500).json({ error: 'Error al agrupar importaciones por MQ', details: error.message });
  }
});

// POST /api/purchases/migrate-mq-to-pdte - Migrar MQ de formato MQ-* a PDTE-{número}
router.post('/migrate-mq-to-pdte', requireEliana, async (req, res) => {
  try {
    // Obtener todos los purchases con MQ en formato antiguo (MQ-*)
    const oldMQsQuery = await pool.query(
      `SELECT id, mq 
       FROM purchases 
       WHERE mq IS NOT NULL 
       AND mq LIKE 'MQ-%'
       ORDER BY created_at ASC`
    );

    if (oldMQsQuery.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No hay MQs antiguos para migrar',
        migrated: []
      });
    }

    const migrations = [];
    let counter = 1;

    // Migrar cada MQ antiguo
    for (const row of oldMQsQuery.rows) {
      const oldMq = row.mq;
      // Generar nuevo MQ: PDTE-{número de 4 dígitos}
      const newMq = `PDTE-${String(counter).padStart(4, '0')}`;
      
      // Actualizar el purchase
      await pool.query(
        `UPDATE purchases 
         SET mq = $1, updated_at = NOW() 
         WHERE id = $2`,
        [newMq, row.id]
      );

      migrations.push({
        id: row.id,
        old_mq: oldMq,
        new_mq: newMq
      });

      counter++;
    }

    console.log(`✅ Migrados ${migrations.length} MQs de formato MQ-* a PDTE-{número}`);

    res.json({
      success: true,
      message: `${migrations.length} MQ(s) migrado(s) exitosamente`,
      migrated: migrations
    });
  } catch (error) {
    console.error('❌ Error al migrar MQs:', error);
    res.status(500).json({ error: 'Error al migrar MQs', details: error.message });
  }
});

// POST /api/purchases/migrate-old-cus - Migrar CUs antiguos al formato secuencial
router.post('/migrate-old-cus', requireEliana, async (req, res) => {
  try {
    // Obtener todos los CUs antiguos (que no siguen el patrón CU###)
    const oldCUsQuery = await pool.query(
      `SELECT DISTINCT cu, COUNT(*) as count
       FROM purchases 
       WHERE cu IS NOT NULL 
       AND cu !~ '^CU[0-9]+$'
       GROUP BY cu
       ORDER BY cu`
    );

    if (oldCUsQuery.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No hay CUs antiguos para migrar',
        migrated: []
      });
    }

    // Obtener el siguiente número disponible
    const maxCuQuery = await pool.query(
      `SELECT cu FROM purchases 
       WHERE cu IS NOT NULL 
       AND cu ~ '^CU[0-9]+$'
       ORDER BY CAST(SUBSTRING(cu FROM 3) AS INTEGER) DESC
       LIMIT 1`
    );

    let nextNumber = 1;
    if (maxCuQuery.rows.length > 0 && maxCuQuery.rows[0].cu) {
      const maxCu = maxCuQuery.rows[0].cu;
      const numberMatch = maxCu.match(/^CU(\d+)$/);
      if (numberMatch) {
        nextNumber = parseInt(numberMatch[1], 10) + 1;
      }
    }

    const migrations = [];

    // Migrar cada CU antiguo
    for (const oldCuRow of oldCUsQuery.rows) {
      const oldCu = oldCuRow.cu;
      const newCu = `CU${String(nextNumber).padStart(3, '0')}`;

      // Actualizar todas las compras con el CU antiguo
      const updateResult = await pool.query(
        `UPDATE purchases 
         SET cu = $1, updated_at = NOW() 
         WHERE cu = $2
         RETURNING id, cu`,
        [newCu, oldCu]
      );

      migrations.push({
        oldCu,
        newCu,
        count: updateResult.rows.length
      });

      nextNumber++;
    }

    console.log(`✅ Migrados ${migrations.length} CUs antiguos al formato secuencial`);

    res.json({
      success: true,
      message: `${migrations.length} CU(s) migrado(s) exitosamente`,
      migrated: migrations
    });
  } catch (error) {
    console.error('❌ Error al migrar CUs antiguos:', error);
    res.status(500).json({ error: 'Error al migrar CUs antiguos', details: error.message });
  }
});

// POST /api/purchases/bulk-upload - Carga masiva de compras (solo administradores)
router.post('/bulk-upload', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, role } = req.user;
    
    // Verificar que sea administrador
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden realizar carga masiva' });
    }

    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de registros' });
    }

    // Procesar registros hasta insertar 50 nuevos O hasta procesar 200 registros del archivo (lo que ocurra primero)
    // Esto asegura que siempre se procesen registros nuevos, no solo los primeros del archivo
    const MAX_NEW_RECORDS = 50; // Máximo de registros nuevos a insertar
    const MAX_RECORDS_TO_PROCESS = 200; // Máximo de registros del archivo a procesar
    const recordsToProcess = records.slice(0, MAX_RECORDS_TO_PROCESS);
    const remainingRecords = records.length - MAX_RECORDS_TO_PROCESS;
    
    console.log(`📦 Iniciando carga masiva: procesando hasta ${MAX_RECORDS_TO_PROCESS} registros del archivo (de ${records.length} totales)`);
    console.log(`💡 El sistema se detendrá después de insertar ${MAX_NEW_RECORDS} registros nuevos o después de procesar ${MAX_RECORDS_TO_PROCESS} registros del archivo`);

    // OPTIMIZACIÓN: Pre-cargar suppliers, machines y purchases existentes en memoria
    console.log('🔄 Pre-cargando suppliers, machines y purchases existentes...');
    const suppliersResult = await client.query('SELECT id, LOWER(name) as name_lower FROM suppliers');
    const suppliersMap = new Map();
    suppliersResult.rows.forEach(row => {
      suppliersMap.set(row.name_lower, row.id);
    });
    
    const machinesResult = await client.query('SELECT id, serial FROM machines WHERE serial IS NOT NULL');
    const machinesMap = new Map();
    machinesResult.rows.forEach(row => {
      machinesMap.set(row.serial, row.id);
    });
    
    // Pre-cargar purchases existentes para validación de duplicados (mucho más rápido que consultar uno por uno)
    const purchasesResult = await client.query('SELECT machine_id FROM purchases WHERE machine_id IS NOT NULL');
    const existingPurchasesSet = new Set();
    purchasesResult.rows.forEach(row => {
      existingPurchasesSet.add(row.machine_id);
    });
    console.log(`✓ Pre-cargados ${suppliersMap.size} suppliers, ${machinesMap.size} machines y ${existingPurchasesSet.size} purchases existentes`);

    await client.query('BEGIN');

    const inserted = [];
    const errors = [];
    const newSuppliers = new Map(); // Cache para suppliers nuevos creados en esta transacción
    const newMachines = new Map(); // Cache para machines nuevos creados en esta transacción
    let processedCount = 0; // Contador de registros procesados (incluyendo duplicados)

    for (let i = 0; i < recordsToProcess.length; i++) {
      processedCount++;
      const record = records[i];
      // Usar SAVEPOINT para cada registro, así si uno falla, los demás pueden continuar
      const savepointName = `sp_record_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        
        // Validar campos mínimos
        if (!record.model && !record.serial) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          errors.push(`Registro ${i + 1}: Se requiere al menos modelo o serial`);
          continue;
        }

        // Validar tipo de compra (requerido)
        const recordPurchaseType = record.purchase_type || record.tipo;
        if (!recordPurchaseType || !['COMPRA_DIRECTA', 'SUBASTA'].includes(recordPurchaseType.toUpperCase())) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          errors.push(`Registro ${i + 1}: Se requiere el campo "tipo" con valor "COMPRA_DIRECTA" o "SUBASTA"`);
          continue;
        }
        const finalPurchaseType = recordPurchaseType.toUpperCase();

        // 1. Validar y crear o buscar proveedor (optimizado con cache)
        let supplierId = null;
        let supplierName = null; // Guardar el nombre original del proveedor
        if (record.supplier_name) {
          // Normalizar el nombre del proveedor (trim y mantener formato original)
          supplierName = String(record.supplier_name).trim();
          const supplierNameUpper = supplierName.toUpperCase();
          
          // Lista de proveedores permitidos
          const allowedSuppliers = [
            'GREEN', 'GUIA', 'HCMJ', 'JEN', 'KANEHARU', 'KIXNET', 'NORI', 'ONAGA', 'SOGO',
            'THI', 'TOZAI', 'WAKITA', 'YUMAC', 'AOI', 'NDT',
            'EUROAUCTIONS / UK', 'EUROAUCTIONS / GER',
            'RITCHIE / USA / PE USA', 'RITCHIE / CAN / PE USA',
            'ROYAL - PROXY / USA / PE USA', 'ACME / USA / PE USA',
            'GDF', 'GOSHO', 'JTF', 'KATAGIRI', 'MONJI', 'REIBRIDGE',
            'IRON PLANET / USA / PE USA', 'SHOJI',
            'YIWU ELI TRADING COMPANY / CHINA', 'E&F / USA / PE USA', 'DIESEL'
          ];
          
          // Verificar si el proveedor está en la lista permitida (comparación case-insensitive)
          const isAllowed = allowedSuppliers.some(allowed => 
            allowed.toUpperCase() === supplierNameUpper
          );
          
          if (!isAllowed) {
            await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
            errors.push(`Registro ${i + 1}: Proveedor inválido "${supplierName}". Debe estar en la lista de proveedores permitidos.`);
            continue;
          }
          
          const supplierNameLower = supplierName.toLowerCase();
          // Primero buscar en cache de nuevos suppliers creados en esta transacción
          if (newSuppliers.has(supplierNameLower)) {
            supplierId = newSuppliers.get(supplierNameLower);
          } else if (suppliersMap.has(supplierNameLower)) {
            supplierId = suppliersMap.get(supplierNameLower);
          } else {
            // Crear nuevo supplier solo si está en la lista permitida
            const newSupplier = await client.query(
              'INSERT INTO suppliers (name) VALUES ($1) RETURNING id',
              [supplierName]
            );
            supplierId = newSupplier.rows[0].id;
            // Agregar a cache
            newSuppliers.set(supplierNameLower, supplierId);
            suppliersMap.set(supplierNameLower, supplierId);
          }
        }

        // 2. Buscar o crear máquina (optimizado con cache)
        let machineId = null;
        if (record.serial) {
          // Primero buscar en cache de nuevas machines creadas en esta transacción
          if (newMachines.has(record.serial)) {
            machineId = newMachines.get(record.serial);
          } else if (machinesMap.has(record.serial)) {
            machineId = machinesMap.get(record.serial);
            console.log(`✓ Máquina existente encontrada para serial ${record.serial}: ${machineId}`);
          }
        }
        
        if (!machineId) {
          // Crear nueva máquina solo si no existe
          // IMPORTANTE: machine_id es requerido para purchases, siempre debemos crear una máquina
          const machineResult = await client.query(
            `INSERT INTO machines (brand, model, serial, year, hours, machine_type, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
            [
              record.brand || null,
              record.model || null,
              record.serial || null,
              record.year ? parseInt(record.year) : new Date().getFullYear(),
              record.hours ? parseInt(record.hours) : 0,
              normalizeMachineType(record.machine_type)
            ]
          );
          machineId = machineResult.rows[0].id;
          // Agregar a cache
          if (record.serial) {
            newMachines.set(record.serial, machineId);
            machinesMap.set(record.serial, machineId);
          }
        }
        
        // Validar que machineId esté presente antes de continuar
        // Esto previene que el trigger update_management_table() falle con machine_id null
        if (!machineId) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          errors.push(`Registro ${i + 1}: No se pudo crear o encontrar la máquina. Se requiere al menos modelo o serial.`);
          continue;
        }
        
        // Normalizar y guardar campo SPEC si viene en el Excel
        // El campo spec se normaliza en el frontend y se pasa como texto normalizado
        // Se almacenará en comentarios_servicio y comentarios_comercial (mismo valor en ambas)
        let specValue = null;
        if (record.spec) {
          // El spec ya viene normalizado del frontend (valores separados por comas)
          // Guardar en ambas columnas de comentarios para que sea visible en servicio y equipo
          specValue = String(record.spec).trim();
          if (specValue === '') {
            specValue = null;
          }
          console.log(`📝 SPEC recibido para máquina ${machineId}: ${specValue}`);
        }

        // 3. Preparar datos de compra
        const invoiceDate = record.invoice_date || new Date().toISOString().split('T')[0];
        const invoiceDateObj = new Date(invoiceDate);
        invoiceDateObj.setDate(invoiceDateObj.getDate() + 10);
        const dueDate = invoiceDateObj.toISOString().split('T')[0];

        // 4. Tipo de compra ya validado arriba

        // 5. Preparar campos adicionales del Excel UNION_DOE_DOP
        // Normalizar valores numéricos que pueden venir con formato (signos de moneda, comas, espacios)
        const mq = record.mq || null;
        
        // Validar y normalizar shipment_type_v2 según constraint de BD
        // Valores permitidos: '1X40' o 'RORO'
        // Por defecto: '1X40' si no se especifica
        const shipmentTypeV2Raw = record.shipment_type_v2 || record.shipment || null;
        let shipmentTypeV2 = '1X40'; // Default a '1X40'
        if (shipmentTypeV2Raw) {
          const normalizedShipment = String(shipmentTypeV2Raw).toUpperCase().trim();
          // Mapeo de valores comunes a valores permitidos
          const shipmentMapping = {
            '1X40': '1X40',
            '1X20': '1X40',  // Mapear 1X20 a 1X40
            'LCL': '1X40',    // Mapear LCL a 1X40
            'AEREO': '1X40',  // Mapear AEREO a 1X40
            'RORO': 'RORO',
            'RORO ': 'RORO',  // Con espacio
            'RORO/': 'RORO',  // Con barra
          };
          
          if (normalizedShipment === '1X40' || normalizedShipment === 'RORO') {
            shipmentTypeV2 = normalizedShipment;
          } else if (shipmentMapping[normalizedShipment]) {
            shipmentTypeV2 = shipmentMapping[normalizedShipment];
            console.log(`ℹ️ Tipo de envío "${shipmentTypeV2Raw}" mapeado a "${shipmentTypeV2}"`);
          } else {
            // Si no se puede mapear, usar default '1X40'
            console.warn(`⚠️ Tipo de envío "${shipmentTypeV2Raw}" no está en la lista permitida (1X40, RORO) y no se puede mapear. Se establecerá como '1X40' por defecto.`);
            shipmentTypeV2 = '1X40';
          }
        }
        
        // Validar y normalizar location según constraint de BD
        const locationRaw = record.location ? String(record.location).trim().toUpperCase() : null;
        let location = null;
        if (locationRaw) {
          // Lista de ubicaciones permitidas según constraint purchases_location_check
          const allowedLocations = [
            'KOBE', 'YOKOHAMA', 'NARITA', 'HAKATA', 'FUJI', 'TOMAKOMAI', 'SAKURA',
            'LEBANON', 'LAKE WORTH', 'NAGOYA', 'HOKKAIDO', 'OSAKA',
            'ALBERTA', 'FLORIDA', 'KASHIBA', 'HYOGO', 'MIAMI', 'BOSTON'
          ];
          
          // Normalizar nombres comunes
          const locationMap = {
            'BOSTON': 'BOSTON',
            'TOKYO': 'NARITA',
            'YOKOHAMA': 'YOKOHAMA',
            'KOBE': 'KOBE',
            'OSAKA': 'OSAKA',
            'NAGOYA': 'NAGOYA',
            'HAKATA': 'HAKATA',
            'FUJI': 'FUJI',
            'TOMAKOMAI': 'TOMAKOMAI',
            'SAKURA': 'SAKURA',
            'HOKKAIDO': 'HOKKAIDO',
            'KASHIBA': 'KASHIBA',
            'HYOGO': 'HYOGO',
            'LEBANON': 'LEBANON',
            'LAKE WORTH': 'LAKE WORTH',
            'ALBERTA': 'ALBERTA',
            'FLORIDA': 'FLORIDA',
            'MIAMI': 'MIAMI'
          };
          
          const normalizedLocation = locationMap[locationRaw] || locationRaw;
          
          // Verificar si está en la lista permitida
          if (allowedLocations.includes(normalizedLocation)) {
            location = normalizedLocation;
          } else {
            // Si no está en la lista permitida, establecer como null para evitar error de constraint
            console.warn(`⚠️ Ubicación "${locationRaw}" no está en la lista permitida. Se establecerá como null.`);
            location = null;
          }
        }
        
        // Validar y normalizar port_of_embarkation según constraint de BD
        // Valores permitidos después de la migración: KOBE, YOKOHAMA, SAVANNA, JACKSONVILLE, CANADA, MIAMI,
        // NARITA, HAKATA, FUJI, TOMAKOMAI, SAKURA, LEBANON, LAKE WORTH, NAGOYA, HOKKAIDO, OSAKA, 
        // ALBERTA, FLORIDA, KASHIBA, HYOGO
        const portOfEmbarkationRaw = record.port_of_embarkation || record.port || null;
        let portOfEmbarkation = null;
        if (portOfEmbarkationRaw) {
          const normalizedPort = String(portOfEmbarkationRaw).toUpperCase().trim();
          const allowedPorts = [
            'KOBE', 'YOKOHAMA', 'SAVANNA', 'JACKSONVILLE', 'CANADA', 'MIAMI',
            'NARITA', 'HAKATA', 'FUJI', 'TOMAKOMAI', 'SAKURA',
            'LEBANON', 'LAKE WORTH', 'NAGOYA', 'HOKKAIDO', 'OSAKA',
            'ALBERTA', 'FLORIDA', 'KASHIBA', 'HYOGO'
          ];
          
          // Verificar si está en la lista permitida
          if (allowedPorts.includes(normalizedPort)) {
            portOfEmbarkation = normalizedPort;
          } else {
            // Si no está en la lista permitida, establecer como null para evitar error de constraint
            console.warn(`⚠️ Puerto de embarque "${portOfEmbarkationRaw}" no está en la lista permitida. Se establecerá como null.`);
            portOfEmbarkation = null;
          }
        }
        
        // Normalizar incoterm (EXY, FOB, CIF) a mayúsculas
        // En el módulo de compras (COMPRA_DIRECTA y SUBASTA - usadas), los valores válidos son EXY, FOB o CIF
        const incoterm = record.incoterm ? String(record.incoterm).toUpperCase().trim() : 'FOB';
        if (!['EXY', 'FOB', 'CIF'].includes(incoterm)) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          errors.push(`Registro ${i + 1}: INCOTERM inválido "${record.incoterm}". Debe ser "EXY", "FOB" o "CIF"`);
          continue;
        }
        // fob_expenses es texto pero puede venir con formato, normalizarlo como texto limpio
        const fobExpensesRaw = record.fob_expenses ? String(record.fob_expenses) : null;
        const fobExpenses = fobExpensesRaw ? fobExpensesRaw.replace(/[¥$€£₹₽₩₪₫₨₦₧₨₩₪₫₭₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽₾₿,\s]/g, '') : null;
        const disassemblyLoadValue = normalizeNumericValue(record.disassembly_load_value);
        // Normalizar currency_type según constraint de BD
        // Valores permitidos: JPY, GBP, EUR, USD, CAD
        const currencyTypeRaw = record.currency_type ? String(record.currency_type).trim().toUpperCase() : 'USD';
        const currencyTypeMap = {
          'EURO': 'EUR',
          'EUR': 'EUR',
          'USD': 'USD',
          'JPY': 'JPY',
          'GBP': 'GBP',
          'CAD': 'CAD',
          'YEN': 'JPY',
          'DOLAR': 'USD',
          'DOLLAR': 'USD',
          'POUND': 'GBP',
          'LIBRA': 'GBP',
          'CANADIAN DOLLAR': 'CAD',
          'DOLLAR CANADIENSE': 'CAD'
        };
        const currencyType = currencyTypeMap[currencyTypeRaw] || 'USD';
        if (!['JPY', 'GBP', 'EUR', 'USD', 'CAD'].includes(currencyType)) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          errors.push(`Registro ${i + 1}: Moneda inválida "${currencyTypeRaw}". Debe ser una de: JPY, GBP, EUR, USD, CAD`);
          continue;
        }
        
        // fob_total se calcula automáticamente, ignorar si viene en el archivo
        // Se calculará como: exw_value_formatted (convertido a número) + fob_expenses (convertido a número) + disassembly_load_value
        const exwValueNum = normalizeNumericValue(record.exw_value_formatted);
        const fobExpensesNum = normalizeNumericValue(record.fob_expenses);
        const fobTotal = (exwValueNum || 0) + (fobExpensesNum || 0) + (disassemblyLoadValue || 0);
        const usdJpyRate = normalizeNumericValue(record.usd_jpy_rate || record.contravalor);
        const trmValue = normalizeNumericValue(record.trm || record.trm_rate);
        const trm = trmValue !== null ? trmValue : 0;
        const paymentDate = record.payment_date || null;
        const shipmentDepartureDate = record.shipment_departure_date || record.etd || null;
        const shipmentArrivalDate = record.shipment_arrival_date || record.eta || null;
        const salesReported = record.sales_reported || 'PDTE';
        const commerceReported = record.commerce_reported || 'PDTE';
        const luisLemusReported = record.luis_lemus_reported || 'PDTE';
        // NOTA: cif_usd, fob_value, fob_usd, fob_total, cif_local_cop y cost_arancel_cop son campos calculados automáticamente
        // No deben venir del Excel, pero si vienen, los ignoramos (no los usamos en el INSERT)
        // cifUsd se calculará automáticamente en management_table basado en FOB + ocean
        // fobValue se calculará automáticamente por el trigger de la BD: exw_value + fob_additional + disassembly_load
        // fobTotal se calculará automáticamente: exw_value + fob_expenses + disassembly_load_value
        const cifUsd = null; // Se calculará automáticamente
        const fobValue = null; // Se calculará automáticamente por el trigger
        
        // Determinar payment_status basado en payment_date
        const paymentStatus = paymentDate ? 'COMPLETADO' : 'PENDIENTE';

        // 5. Validar que no exista un purchase duplicado para esta máquina
        // IMPORTANTE: Validar que machineId esté presente antes de verificar duplicados
        if (!machineId) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          errors.push(`Registro ${i + 1}: Error interno - machine_id no está disponible antes de crear purchase`);
          continue;
        }
        
        // Verificar si ya existe un purchase para esta máquina (usando Set pre-cargado - mucho más rápido)
        if (existingPurchasesSet.has(machineId)) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          console.log(`⚠️ Registro ${i + 1}: Ya existe un purchase para la máquina con serial "${record.serial || 'N/A'}" y modelo "${record.model || 'N/A'}". Se omite para evitar duplicados.`);
          errors.push(`Registro ${i + 1}: Ya existe un purchase para esta máquina (serial: ${record.serial || 'N/A'}, modelo: ${record.model || 'N/A'}). Se omite para evitar duplicados.`);
          continue;
        }
        
        // Agregar a Set para evitar duplicados dentro de la misma transacción
        existingPurchasesSet.add(machineId);
        
        // Normalizar valores de campos manuales del consolidado
        const oceanUsd = normalizeNumericValue(record.ocean_usd);
        const gastosPtoCop = normalizeNumericValue(record.gastos_pto_cop);
        const trasladosNacionalesCop = normalizeNumericValue(record.traslados_nacionales_cop); // TRASLADOS NACIONALES -> flete
        const pptoReparacionCop = normalizeNumericValue(record.ppto_reparacion_cop);
        const pvpEst = normalizeNumericValue(record.pvp_est);
        
        // NOTA: cif_usd y fob_value se calculan automáticamente, no los incluimos en el INSERT
        const purchaseResult = await client.query(
          `INSERT INTO purchases (
            machine_id, supplier_id, supplier_name, purchase_type, incoterm, currency_type, 
            exw_value_formatted, invoice_date, due_date, trm, payment_status, 
            invoice_number, purchase_order, condition, created_by, created_at, updated_at,
            mq, shipment_type_v2, location, port_of_embarkation, fob_expenses,
            disassembly_load_value, fob_total, usd_jpy_rate, payment_date,
            shipment_departure_date, shipment_arrival_date, sales_reported,
            commerce_reported, luis_lemus_reported, trm_rate, comentarios_servicio, comentarios_comercial,
            inland, gastos_pto, flete, repuestos, pvp_est
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW(),
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
            $33, $34, $35, $36, $37
          ) RETURNING id`,
          [
            machineId,
            supplierId,
            supplierName, // Guardar el nombre del proveedor en supplier_name
            finalPurchaseType,
            incoterm,
            currencyType,
            // Normalizar exw_value_formatted (es texto pero puede venir con formato de moneda)
            record.exw_value_formatted ? String(record.exw_value_formatted).replace(/[¥$€£₹₽₩₪₫₨₦₧₨₩₪₫₭₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽₾₿,\s]/g, '') : null,
            invoiceDate,
            dueDate,
            trm,
            paymentStatus,
            record.invoice_number || null,
            record.purchase_order || null,
            record.condition || 'USADO',
            userId,
            mq,
            shipmentTypeV2,
            location,
            portOfEmbarkation,
            fobExpenses,
            disassemblyLoadValue,
            fobTotal,
            usdJpyRate,
            paymentDate,
            shipmentDepartureDate,
            shipmentArrivalDate,
            salesReported,
            commerceReported,
            luisLemusReported,
            trm,
            specValue, // comentarios_servicio: mismo valor de spec
            specValue, // comentarios_comercial: mismo valor de spec
            oceanUsd, // OCEAN (USD) -> inland
            gastosPtoCop, // Gastos Pto (COP) -> gastos_pto
            trasladosNacionalesCop, // TRASLADOS NACIONALES (COP) -> flete (corregido)
            pptoReparacionCop, // PPTO DE REPARACION (COP) -> repuestos
            pvpEst // PVP Est. -> pvp_est
          ]
        );

        const purchaseId = purchaseResult.rows[0].id;

        // 6. Crear equipment
        await client.query(
          `INSERT INTO equipments (purchase_id, state, created_at, updated_at)
           VALUES ($1, 'Libre', NOW(), NOW())`,
          [purchaseId]
        );

        // 7. Crear service_record
        await client.query(
          `INSERT INTO service_records (purchase_id, created_at, updated_at)
           VALUES ($1, NOW(), NOW())`,
          [purchaseId]
        );

        // 8. NOTA: Los campos inland, gastos_pto, traslado, repuestos y pvp_est 
        // ya se guardaron directamente en la tabla purchases en el INSERT anterior.
        // No necesitamos guardarlos en cost_items porque estos campos van directamente en purchases.
        
        // 9. El trigger update_management_table() ya crea/actualiza management_table automáticamente
        // con los valores de purchases.inland, purchases.gastos_pto, purchases.traslado, 
        // purchases.repuestos y purchases.pvp_est

        // 10. Las reglas automáticas se aplicarán automáticamente cuando los registros viajen a consolidado
        // El trigger update_management_table() ya crea el registro en management_table
        // Las reglas automáticas se pueden aplicar después desde el módulo de consolidado

        // Liberar el SAVEPOINT si todo salió bien
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        
        inserted.push({ index: i + 1, purchaseId, model: record.model, serial: record.serial });
        
        // Detener procesamiento si ya insertamos el máximo de registros nuevos
        if (inserted.length >= MAX_NEW_RECORDS) {
          console.log(`✓ Se alcanzó el límite de ${MAX_NEW_RECORDS} registros nuevos insertados. Deteniendo procesamiento.`);
          break; // Salir del loop
        }
      } catch (error) {
        // Hacer ROLLBACK al SAVEPOINT para este registro específico
        try {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        } catch (rollbackError) {
          // Si el SAVEPOINT no existe, continuar
          console.warn(`No se pudo hacer rollback al savepoint ${savepointName}:`, rollbackError);
        }
        
        console.error(`Error procesando registro ${i + 1}:`, error);
        errors.push(`Registro ${i + 1}: ${error.message}`);
      }
    }

    await client.query('COMMIT');

    const duplicatesCount = errors.filter(e => e.includes('Ya existe')).length;
    const otherErrorsCount = errors.length - duplicatesCount;
    
    console.log(`✅ Carga masiva completada: ${inserted.length} insertados, ${duplicatesCount} duplicados omitidos, ${otherErrorsCount} errores`);
    console.log(`📊 Total procesado: ${processedCount} de ${recordsToProcess.length} registros del lote`);

    res.json({
      success: true,
      inserted: inserted.length,
      duplicates: duplicatesCount,
      errors: errors.filter(e => !e.includes('Ya existe')).length > 0 ? errors.filter(e => !e.includes('Ya existe')) : undefined,
      totalProcessed: processedCount,
      remainingRecords: remainingRecords > 0 ? remainingRecords : undefined,
      message: remainingRecords > 0 
        ? `Se insertaron ${inserted.length} registros nuevos (${duplicatesCount} duplicados omitidos, ${otherErrorsCount} errores). Se procesaron ${processedCount} de ${recordsToProcess.length} registros del lote. Quedan ${remainingRecords} registros del archivo por procesar. Carga el archivo de nuevo para continuar.`
        : `Se procesaron exitosamente todos los registros del archivo. ${inserted.length} registros nuevos insertados (${duplicatesCount} duplicados omitidos, ${otherErrorsCount} errores).`,
      details: inserted.length > 0 ? {
        inserted: inserted.slice(0, 10), // Mostrar solo los primeros 10
        totalInserted: inserted.length
      } : undefined
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en carga masiva:', error);
    res.status(500).json({ 
      error: 'Error en carga masiva', 
      details: error.message 
    });
  } finally {
    client.release();
  }
});

router.delete('/:id', canDeletePurchases, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { role } = req.user;

    console.log(`🗑️ Iniciando eliminación de compra ${id} por usuario ${role}`);

    await client.query('BEGIN');

    // Verificar que la compra existe
    const purchaseCheck = await client.query(
      'SELECT id, mq, model, serial FROM purchases WHERE id = $1',
      [id]
    );
    
    if (purchaseCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const purchase = purchaseCheck.rows[0];
    console.log(`📋 Compra encontrada: MQ=${purchase.mq}, Modelo=${purchase.model}, Serial=${purchase.serial}`);

    // Contar registros relacionados antes de eliminar (para logging)
    const equipmentCount = await client.query(
      'SELECT COUNT(*) FROM equipments WHERE purchase_id = $1',
      [id]
    );
    const serviceCount = await client.query(
      'SELECT COUNT(*) FROM service_records WHERE purchase_id = $1',
      [id]
    );

    // Eliminar la compra principal
    // Gracias al ON DELETE CASCADE configurado en las migraciones, esto eliminará automáticamente:
    // - equipments (ON DELETE CASCADE)
    // - service_records (ON DELETE CASCADE)
    // Y actualizará automáticamente las vistas de:
    // - management (vista consolidada)
    // - logistics (vista de purchases)
    // - importations (vista de purchases)
    // - pagos (usa columnas de purchases)
    const result = await client.query('DELETE FROM purchases WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No se pudo eliminar la compra' });
    }

    await client.query('COMMIT');
    
    const equipmentsDeleted = parseInt(equipmentCount.rows[0].count);
    const serviceDeleted = parseInt(serviceCount.rows[0].count);
    
    console.log(`✅ Compra ${id} eliminada exitosamente`);
    console.log(`   - Equipments: ${equipmentsDeleted} registro(s)`);
    console.log(`   - Service: ${serviceDeleted} registro(s)`);
    
    res.json({ 
      message: 'Compra eliminada exitosamente de todos los módulos',
      deleted: {
        purchase: purchase.mq,
        equipments: equipmentsDeleted,
        service: serviceDeleted
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al eliminar compra:', error);
    res.status(500).json({ error: 'Error al eliminar compra' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/purchases/export
 * Exporta TODAS las compras a CSV para comparación
 * Sin límite de registros (descarga todos)
 */
router.get('/export', canViewPurchases, async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('📥 Exportando todas las compras a CSV...');

    // Obtener TODAS las compras sin límite
    // Usar COALESCE para obtener datos de purchases si están disponibles, sino de machines
    const result = await client.query(`
      SELECT 
        p.id,
        p.mq,
        p.supplier_name as proveedor,
        COALESCE(NULLIF(p.model, ''), m.model) as modelo,
        COALESCE(NULLIF(p.serial, ''), m.serial) as serial,
        COALESCE(m.brand, '') as marca,
        p.invoice_date as fecha_factura,
        p.invoice_number as numero_factura,
        p.purchase_order as orden_compra,
        p.purchase_type as tipo_compra,
        p.incoterm,
        p.currency_type as moneda,
        p.location as ubicacion,
        p.port_of_embarkation as puerto_embarque,
        p.shipment_type_v2 as metodo_embarque,
        p.created_at as fecha_creacion,
        p.updated_at as fecha_actualizacion
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      ORDER BY p.created_at DESC
    `);

    const purchases = result.rows;

    if (purchases.length === 0) {
      return res.status(404).json({ error: 'No se encontraron compras para exportar' });
    }

    // Función para escapar valores CSV
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // Si contiene comas, comillas o saltos de línea, envolver en comillas y escapar comillas
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Generar CSV
    const headers = [
      'id',
      'mq',
      'proveedor',
      'modelo',
      'serial',
      'marca',
      'fecha_factura',
      'numero_factura',
      'orden_compra',
      'tipo_compra',
      'incoterm',
      'moneda',
      'ubicacion',
      'puerto_embarque',
      'metodo_embarque',
      'fecha_creacion',
      'fecha_actualizacion'
    ];

    // Crear filas CSV
    const csvRows = [
      headers.join(','), // Encabezados
      ...purchases.map(purchase => {
        return headers.map(header => {
          const value = purchase[header];
          // Formatear fechas
          if (value instanceof Date) {
            return escapeCSV(value.toISOString().split('T')[0]);
          }
          return escapeCSV(value);
        }).join(',');
      })
    ];

    const csvContent = csvRows.join('\n');

    // Configurar headers para descarga
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `compras_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Crear Buffer con BOM para Excel (UTF-8) - esto asegura que el BOM se envíe como bytes
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    const buffer = Buffer.from(csvWithBOM, 'utf8');
    
    res.send(buffer);

    console.log(`✅ Exportación completada: ${purchases.length} registros exportados`);
  } catch (error) {
    console.error('❌ Error al exportar compras:', error);
    res.status(500).json({ error: 'Error al exportar compras', details: error.message });
  } finally {
    client.release();
  }
});

export default router;

