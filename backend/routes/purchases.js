/**
 * Rutas de Compras (Purchases)
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewPurchases, requireEliana, canEditShipmentDates } from '../middleware/auth.js';
import { checkAndExecuteRules, clearImportNotifications } from '../services/notificationTriggers.js';
import { syncPurchaseToNewPurchaseAndEquipment } from '../services/syncBidirectional.js';
import { syncPurchaseToAuctionAndPreselection } from '../services/syncBidirectionalPreselectionAuction.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/purchases
router.get('/', canViewPurchases, async (req, res) => {
  try {
    console.log('📥 GET /api/purchases - Obteniendo compras...');
    
    // ✅ CON ESQUEMA UNIFICADO: Incluir tanto purchases como new_purchases
    const result = await pool.query(`
      SELECT 
        p.id,
        p.machine_id,
        p.auction_id,
        p.supplier_id,
        p.invoice_date,
        p.payment_date,
        p.incoterm,
        p.exw_value,
        p.fob_value,
        p.trm,
        p.usd_rate,
        p.jpy_rate,
        p.usd_jpy_rate,
        p.payment_status,
        p.shipment_type,
        p.port_of_embarkation,
        p.port_of_shipment,
        p.fob_additional,
        p.disassembly_load,
        p.exw_value_formatted,
        p.fob_expenses,
        p.disassembly_load_value,
        p.fob_total,
        p.departure_date,
        p.estimated_arrival_date,
        p.shipment_departure_date,
        p.shipment_arrival_date,
        p.nationalization_date,
        p.port_of_destination,
        p.current_movement,
        p.current_movement_date,
        p.current_movement_plate,
        p.mc,
        p.location,
        p.invoice_number,
        p.purchase_order,
        p.valor_factura_proveedor,
        p.observaciones_pagos,
        p.pendiente_a,
        p.fecha_vto_fact,
        p.pending_marker,
        p.cu,
        p.due_date,
        p.driver_name,
        p.epa,
        p.cpd,
        p.created_at,
        p.updated_at,
        p.supplier_name,
        COALESCE(p.mq, 'MQ-' || SUBSTRING(SPLIT_PART(p.id::text, '-', 1), 1, 6)) as mq,
        COALESCE(p.purchase_type, CASE WHEN p.auction_id IS NOT NULL THEN 'SUBASTA' ELSE 'COMPRA_DIRECTA' END) as tipo,
        COALESCE(p.purchase_type, CASE WHEN p.auction_id IS NOT NULL THEN 'SUBASTA' ELSE 'COMPRA_DIRECTA' END) as purchase_type,
        COALESCE(p.shipment_type, p.shipment_type_v2, 'N/A') as shipment,
        COALESCE(p.shipment_type, p.shipment_type_v2, 'N/A') as shipment_type_v2,
        COALESCE(p.currency_type, p.currency, 'USD') as currency,
        COALESCE(p.currency_type, p.currency, 'USD') as currency_type,
        COALESCE(p.trm_display, p.trm_rate::text, '0') as trm_display,
        COALESCE(p.trm_rate, 0) as trm_rate,
        COALESCE(p.condition, 'USADO') as condition,
        p.cif_usd,
        COALESCE(p.fob_total_verified, false) as fob_total_verified,
        COALESCE(p.cif_usd_verified, false) as cif_usd_verified,
        COALESCE(p.total_valor_girado, 0) as total_valor_girado,
        -- 🔄 Datos de máquina obtenidos de la tabla machines (SINCRONIZACIÓN AUTOMÁTICA)
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours,
        -- Precio de compra: usar price_bought de la subasta (SUBASTA) o N/A en compra directa (se captura desde EXW en frontend)
        a.price_bought as auction_price_bought
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
        NULL::boolean as pending_marker,
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
        '0'::text as trm_display,
        0::numeric as trm_rate,
        COALESCE(np.condition, 'NUEVO')::text as condition,
        NULL::numeric as cif_usd,
        false::boolean as fob_total_verified,
        false::boolean as cif_usd_verified,
        0::numeric as total_valor_girado,
        -- ✅ Datos de máquina desde new_purchases (para mostrar en importaciones)
        np.brand::text as brand,
        np.model::text as model,
        np.serial::text as serial,
        -- ✅ AÑO: usar year de new_purchases (la columna debe existir - ejecutar migración 20251206_add_fields_to_new_purchases.sql si no existe)
        np.year::integer as year,
        NULL::numeric as hours,
        -- Precio de compra (no editable en new_purchases, se mantiene null)
        NULL::numeric as auction_price_bought
      FROM new_purchases np
      WHERE NOT EXISTS (
        -- Excluir new_purchases que ya tienen un purchase espejo (para evitar duplicados)
        SELECT 1 FROM purchases p2 WHERE p2.mq = np.mq
      )
      
      ORDER BY created_at DESC
    `);
    
    console.log('✅ Compras encontradas:', result.rows.length);
    res.json(result.rows);
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
      supplier_name, brand, model, serial, year, hours, 
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
      `INSERT INTO machines (brand, model, serial, year, hours, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id`,
      [brand, model, serial, year || new Date().getFullYear(), hours || 0]
    );
    const machineId = machineResult.rows[0].id;

    // 3. Crear compra
    const purchaseResult = await pool.query(
      `INSERT INTO purchases (
        machine_id, supplier_id, purchase_type, incoterm, currency_type, 
        exw_value_formatted, payment_status, created_by, created_at, updated_at
      ) VALUES ($1, $2, 'COMPRA_DIRECTA', $3, $4, $5, 'PENDIENTE', $6, NOW(), NOW()) RETURNING *`,
      [machineId, supplierId, incoterm || 'FOB', currency_type || 'USD', exw_value_formatted || null, userId]
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
    
    // Buscar o crear proveedor
    let supplierId = null;
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
    
    // Actualizar purchase con nuevo supplier_id
    await pool.query(
      'UPDATE purchases SET supplier_id = $1, updated_at = NOW() WHERE id = $2',
      [supplierId, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando proveedor:', error);
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
});

// PUT /api/purchases/:id
router.put('/:id', canEditShipmentDates, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // ✅ CON ESQUEMA UNIFICADO: Verificar si es purchase o new_purchase
    const purchaseCheck = await pool.query('SELECT machine_id FROM purchases WHERE id = $1', [id]);
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
    const machineFields = ['brand', 'model', 'serial', 'year', 'hours'];
    const machineUpdates = {};
    const purchaseUpdates = {};
    
    // Convertir strings vacíos a null para campos de fecha
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'machine_year' || key === 'machine_hours' || key === 'lot_number' || key === 'id') {
        continue; // Ignorar estos campos
      }
      
      if (machineFields.includes(key)) {
        // Campos que van a machines
        machineUpdates[key] = value;
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
    }
    
    // Actualizar purchase
    if (Object.keys(purchaseUpdates).length > 0) {
      // Si se actualiza currency_type, también actualizar currency para mantener sincronización con pagos
      if (purchaseUpdates.currency_type !== undefined) {
        purchaseUpdates.currency = purchaseUpdates.currency_type;
      }

      // Si se actualiza invoice_date y viene due_date, asegurar que due_date se guarde
      if (purchaseUpdates.invoice_date && purchaseUpdates.due_date === undefined && !purchaseUpdates.due_date) {
        // Si invoice_date se actualiza pero due_date no viene, calcular automáticamente
        const invoiceDate = new Date(purchaseUpdates.invoice_date);
        invoiceDate.setDate(invoiceDate.getDate() + 10);
        purchaseUpdates.due_date = invoiceDate.toISOString().split('T')[0];
        console.log(`📅 Calculando due_date automáticamente: invoice_date=${purchaseUpdates.invoice_date}, due_date=${purchaseUpdates.due_date}`);
      }

      const fields = Object.keys(purchaseUpdates);
      const values = fields.map(f => purchaseUpdates[f]);
      const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      
      console.log(`🔄 Actualizando purchases (ID: ${id}):`, Object.keys(purchaseUpdates));
      
      const result = await pool.query(
        `UPDATE purchases SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );
      
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
    
    // Toggle el valor
    const newValue = !current.rows[0].pending_marker;
    
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

router.delete('/:id', requireEliana, async (req, res) => {
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

export default router;

