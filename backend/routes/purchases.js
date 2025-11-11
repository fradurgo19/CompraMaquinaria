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

// DELETE /api/purchases/:id
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

