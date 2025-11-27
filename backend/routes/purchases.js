/**
 * Rutas de Compras (Purchases)
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewPurchases, requireEliana, canEditShipmentDates } from '../middleware/auth.js';
import { checkAndExecuteRules, clearImportNotifications } from '../services/notificationTriggers.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/purchases
router.get('/', canViewPurchases, async (req, res) => {
  try {
    console.log('📥 GET /api/purchases - Obteniendo compras...');
    
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
        p.currency,
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
        p.created_at,
        p.updated_at,
        p.supplier_name,
        COALESCE(p.mq, 'MQ-' || SUBSTRING(SPLIT_PART(p.id::text, '-', 1), 1, 6)) as mq,
        COALESCE(p.purchase_type, CASE WHEN p.auction_id IS NOT NULL THEN 'SUBASTA' ELSE 'COMPRA_DIRECTA' END) as tipo,
        COALESCE(p.purchase_type, CASE WHEN p.auction_id IS NOT NULL THEN 'SUBASTA' ELSE 'COMPRA_DIRECTA' END) as purchase_type,
        COALESCE(p.shipment_type, p.shipment_type_v2, 'N/A') as shipment,
        COALESCE(p.shipment_type, p.shipment_type_v2, 'N/A') as shipment_type_v2,
        COALESCE(p.currency_type, 'USD') as currency,
        COALESCE(p.currency_type, 'USD') as currency_type,
        COALESCE(p.trm_display, p.trm_rate::text, '0') as trm_display,
        COALESCE(p.trm_rate, 0) as trm_rate,
        COALESCE(p.condition, 'USADO') as condition,
        p.cif_usd,
        COALESCE(p.fob_total_verified, false) as fob_total_verified,
        COALESCE(p.cif_usd_verified, false) as cif_usd_verified,
        -- 🔄 Datos de máquina obtenidos de la tabla machines (SINCRONIZACIÓN AUTOMÁTICA)
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      ORDER BY p.created_at DESC
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
      [machineId, supplierId, incoterm || 'EXW', currency_type || 'USD', exw_value_formatted || null, userId]
    );

    // 4. Crear equipment
    await pool.query(
      `INSERT INTO equipments (purchase_id, created_at, updated_at)
       VALUES ($1, NOW(), NOW())`,
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
    
    // Obtener machine_id del purchase
    const purchaseCheck = await pool.query('SELECT machine_id FROM purchases WHERE id = $1', [id]);
    if (purchaseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
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
      const fields = Object.keys(purchaseUpdates);
      const values = fields.map(f => purchaseUpdates[f]);
      const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      
      const result = await pool.query(
        `UPDATE purchases SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );
      
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

    // Actualizar todos los purchases con el mismo CU
    const updateQuery = await pool.query(
      `UPDATE purchases 
       SET cu = $1, updated_at = NOW() 
       WHERE id = ANY($2)
       RETURNING id, cu, mq, brand, model, serial`,
      [finalCu, purchase_ids]
    );

    console.log(`✅ Agrupadas ${updateQuery.rows.length} compras en CU: ${finalCu}`);

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
       SET cu = NULL, updated_at = NOW() 
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
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM purchases WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    
    res.json({ message: 'Compra eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar compra:', error);
    res.status(500).json({ error: 'Error al eliminar compra' });
  }
});

export default router;

