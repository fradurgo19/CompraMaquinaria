/**
 * Rutas de administración para tareas especiales
 * Solo accesibles para administradores
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Middleware para verificar que es admin
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden acceder a esta ruta' });
  }
  next();
};

/**
 * DELETE /api/admin/equipment/:id/force
 * Eliminar un equipment y todos sus registros relacionados de forma forzada
 * Útil para eliminar registros duplicados que no se pueden eliminar normalmente
 */
router.delete('/equipment/:id/force', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // 1. Verificar que el equipment existe
    const equipmentCheck = await client.query(
      'SELECT id, purchase_id, new_purchase_id, mq, model, serial FROM equipments WHERE id = $1',
      [id]
    );

    if (equipmentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const equipment = equipmentCheck.rows[0];
    console.log(`🗑️ Eliminando equipment forzadamente:`, equipment);

    // 2. Eliminar registros dependientes de equipment
    await client.query('DELETE FROM equipment_reservations WHERE equipment_id = $1', [id]);
    console.log(`✅ Reservas eliminadas`);

    // 3. Eliminar registros dependientes de purchase (si existe)
    if (equipment.purchase_id) {
      await client.query('DELETE FROM machine_movements WHERE purchase_id = $1', [equipment.purchase_id]);
      await client.query('DELETE FROM cost_items WHERE purchase_id = $1', [equipment.purchase_id]);
      await client.query('DELETE FROM service_records WHERE purchase_id = $1', [equipment.purchase_id]);
      await client.query('DELETE FROM change_logs WHERE table_name = $1 AND record_id = $2', ['purchases', equipment.purchase_id]);
      console.log(`✅ Registros dependientes de purchase eliminados`);
    }

    // 4. Eliminar registros dependientes de new_purchase (si existe)
    if (equipment.new_purchase_id) {
      await client.query('DELETE FROM service_records WHERE new_purchase_id = $1', [equipment.new_purchase_id]);
      await client.query('DELETE FROM change_logs WHERE table_name = $1 AND record_id = $2', ['new_purchases', equipment.new_purchase_id]);
      console.log(`✅ Registros dependientes de new_purchase eliminados`);
    }

    // 5. Eliminar el equipment
    await client.query('DELETE FROM equipments WHERE id = $1', [id]);
    console.log(`✅ Equipment eliminado`);

    // 6. Eliminar purchase si existe y no tiene otros equipments
    if (equipment.purchase_id) {
      const otherEquipments = await client.query(
        'SELECT COUNT(*) as count FROM equipments WHERE purchase_id = $1',
        [equipment.purchase_id]
      );
      
      if (otherEquipments.rows[0].count === '0') {
        // Verificar si tiene machine_id (puede tener restricciones)
        const purchaseCheck = await client.query(
          'SELECT machine_id FROM purchases WHERE id = $1',
          [equipment.purchase_id]
        );
        
        if (purchaseCheck.rows.length > 0) {
          // Intentar eliminar purchase (puede fallar si tiene foreign keys estrictas)
          try {
            await client.query('DELETE FROM purchases WHERE id = $1', [equipment.purchase_id]);
            console.log(`✅ Purchase eliminado`);
          } catch (purchaseError) {
            console.warn(`⚠️ No se pudo eliminar purchase (puede tener dependencias):`, purchaseError.message);
            // Continuar aunque no se pueda eliminar el purchase
          }
        }
      }
    }

    // 7. Eliminar new_purchase si existe y no tiene otros equipments
    if (equipment.new_purchase_id) {
      const otherEquipments = await client.query(
        'SELECT COUNT(*) as count FROM equipments WHERE new_purchase_id = $1',
        [equipment.new_purchase_id]
      );
      
      if (otherEquipments.rows[0].count === '0') {
        // Eliminar también registros dependientes de new_purchase
        await client.query('DELETE FROM change_logs WHERE table_name = $1 AND record_id = $2', ['new_purchases', equipment.new_purchase_id]);
        await client.query('DELETE FROM new_purchases WHERE id = $1', [equipment.new_purchase_id]);
        console.log(`✅ New_purchase eliminado completamente`);
      }
    }
    
    // 8. Si no tiene purchase_id ni new_purchase_id, pero tiene mq, buscar y eliminar purchase/new_purchase relacionado
    if (!equipment.purchase_id && !equipment.new_purchase_id && equipment.mq) {
      // Buscar purchase por MQ
      const purchaseByMq = await client.query(
        'SELECT id FROM purchases WHERE mq = $1',
        [equipment.mq]
      );
      
      if (purchaseByMq.rows.length > 0) {
        const purchaseId = purchaseByMq.rows[0].id;
        // Verificar que no tenga otros equipments
        const otherEquipments = await client.query(
          'SELECT COUNT(*) as count FROM equipments WHERE purchase_id = $1',
          [purchaseId]
        );
        
        if (otherEquipments.rows[0].count === '0') {
          // Eliminar purchase y sus dependencias
          await client.query('DELETE FROM machine_movements WHERE purchase_id = $1', [purchaseId]);
          await client.query('DELETE FROM cost_items WHERE purchase_id = $1', [purchaseId]);
          await client.query('DELETE FROM service_records WHERE purchase_id = $1', [purchaseId]);
          await client.query('DELETE FROM change_logs WHERE table_name = $1 AND record_id = $2', ['purchases', purchaseId]);
          
          try {
            await client.query('DELETE FROM purchases WHERE id = $1', [purchaseId]);
            console.log(`✅ Purchase relacionado por MQ eliminado`);
          } catch (purchaseError) {
            console.warn(`⚠️ No se pudo eliminar purchase relacionado:`, purchaseError.message);
          }
        }
      }
      
      // Buscar new_purchase por MQ
      const newPurchaseByMq = await client.query(
        'SELECT id FROM new_purchases WHERE mq = $1',
        [equipment.mq]
      );
      
      if (newPurchaseByMq.rows.length > 0) {
        const newPurchaseId = newPurchaseByMq.rows[0].id;
        // Verificar que no tenga otros equipments
        const otherEquipments = await client.query(
          'SELECT COUNT(*) as count FROM equipments WHERE new_purchase_id = $1',
          [newPurchaseId]
        );
        
        if (otherEquipments.rows[0].count === '0') {
          // Eliminar new_purchase y sus dependencias
          await client.query('DELETE FROM service_records WHERE new_purchase_id = $1', [newPurchaseId]);
          await client.query('DELETE FROM change_logs WHERE table_name = $1 AND record_id = $2', ['new_purchases', newPurchaseId]);
          await client.query('DELETE FROM new_purchases WHERE id = $1', [newPurchaseId]);
          console.log(`✅ New_purchase relacionado por MQ eliminado`);
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Equipo y registros relacionados eliminados exitosamente',
      deleted: {
        equipment_id: id,
        purchase_id: equipment.purchase_id,
        new_purchase_id: equipment.new_purchase_id,
        mq: equipment.mq,
        model: equipment.model,
        serial: equipment.serial
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al eliminar equipment forzadamente:', error);
    res.status(500).json({ 
      error: 'Error al eliminar el equipo', 
      details: error.message 
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/admin/delete-by-mq/:mq
 * Eliminar completamente un registro por MQ (equipment, purchase, new_purchase y todos sus relacionados)
 * Útil para eliminar registros duplicados que se recrean automáticamente
 */
router.delete('/delete-by-mq/:mq', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { mq } = req.params;

    console.log(`🗑️ Eliminando todos los registros relacionados con MQ: ${mq}`);

    // 1. Buscar todos los equipments con este MQ
    const equipments = await client.query(
      'SELECT id, purchase_id, new_purchase_id FROM equipments WHERE mq = $1',
      [mq]
    );

    const equipmentIds = equipments.rows.map(e => e.id);
    const purchaseIds = equipments.rows.filter(e => e.purchase_id).map(e => e.purchase_id);
    const newPurchaseIds = equipments.rows.filter(e => e.new_purchase_id).map(e => e.new_purchase_id);

    // 2. Buscar purchases por MQ (puede haber purchases sin equipment)
    const purchasesByMq = await client.query(
      'SELECT id FROM purchases WHERE mq = $1',
      [mq]
    );
    purchasesByMq.rows.forEach(p => {
      if (!purchaseIds.includes(p.id)) {
        purchaseIds.push(p.id);
      }
    });

    // 3. Buscar new_purchases por MQ (puede haber new_purchases sin equipment)
    const newPurchasesByMq = await client.query(
      'SELECT id FROM new_purchases WHERE mq = $1',
      [mq]
    );
    newPurchasesByMq.rows.forEach(np => {
      if (!newPurchaseIds.includes(np.id)) {
        newPurchaseIds.push(np.id);
      }
    });

    console.log(`📋 Encontrados: ${equipmentIds.length} equipments, ${purchaseIds.length} purchases, ${newPurchaseIds.length} new_purchases`);

    // 4. Eliminar registros dependientes de equipments
    if (equipmentIds.length > 0) {
      await client.query('DELETE FROM equipment_reservations WHERE equipment_id = ANY($1)', [equipmentIds]);
      console.log(`✅ Reservas eliminadas`);
    }

    // 5. Eliminar registros dependientes de purchases
    if (purchaseIds.length > 0) {
      await client.query('DELETE FROM machine_movements WHERE purchase_id = ANY($1)', [purchaseIds]);
      await client.query('DELETE FROM cost_items WHERE purchase_id = ANY($1)', [purchaseIds]);
      await client.query('DELETE FROM service_records WHERE purchase_id = ANY($1)', [purchaseIds]);
      await client.query('DELETE FROM change_logs WHERE table_name = $1 AND record_id = ANY($2)', ['purchases', purchaseIds]);
      console.log(`✅ Registros dependientes de purchases eliminados`);
    }

    // 6. Eliminar registros dependientes de new_purchases
    if (newPurchaseIds.length > 0) {
      await client.query('DELETE FROM service_records WHERE new_purchase_id = ANY($1)', [newPurchaseIds]);
      await client.query('DELETE FROM change_logs WHERE table_name = $1 AND record_id = ANY($2)', ['new_purchases', newPurchaseIds]);
      console.log(`✅ Registros dependientes de new_purchases eliminados`);
    }

    // 7. Eliminar equipments
    if (equipmentIds.length > 0) {
      await client.query('DELETE FROM equipments WHERE id = ANY($1)', [equipmentIds]);
      console.log(`✅ ${equipmentIds.length} equipment(s) eliminado(s)`);
    }

    // 8. Eliminar purchases (puede fallar si tiene foreign keys estrictas, pero intentamos)
    for (const purchaseId of purchaseIds) {
      try {
        await client.query('DELETE FROM purchases WHERE id = $1', [purchaseId]);
        console.log(`✅ Purchase ${purchaseId} eliminado`);
      } catch (purchaseError) {
        console.warn(`⚠️ No se pudo eliminar purchase ${purchaseId}:`, purchaseError.message);
        // Continuar con los demás
      }
    }

    // 9. Eliminar new_purchases
    if (newPurchaseIds.length > 0) {
      await client.query('DELETE FROM new_purchases WHERE id = ANY($1)', [newPurchaseIds]);
      console.log(`✅ ${newPurchaseIds.length} new_purchase(s) eliminado(s)`);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Todos los registros relacionados con MQ ${mq} han sido eliminados`,
      deleted: {
        mq: mq,
        equipments_count: equipmentIds.length,
        purchases_count: purchaseIds.length,
        new_purchases_count: newPurchaseIds.length,
        equipment_ids: equipmentIds,
        purchase_ids: purchaseIds,
        new_purchase_ids: newPurchaseIds
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al eliminar por MQ:', error);
    res.status(500).json({ 
      error: 'Error al eliminar registros', 
      details: error.message 
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/find-duplicates
 * Buscar registros duplicados por modelo, serial y MC
 */
router.get('/find-duplicates', requireAdmin, async (req, res) => {
  try {
    const { model, serial, mc } = req.query;

    if (!model || !serial || !mc) {
      return res.status(400).json({ 
        error: 'Se requieren los parámetros: model, serial, mc' 
      });
    }

    // Buscar en equipments
    const equipments = await pool.query(`
      SELECT 
        e.id,
        e.purchase_id,
        e.new_purchase_id,
        e.mq,
        e.model,
        e.serial,
        e.mc,
        e.condition,
        e.created_at
      FROM equipments e
      WHERE e.model = $1 
        AND e.serial = $2
        AND e.mc = $3
      ORDER BY e.created_at
    `, [model, serial, mc]);

    // Buscar purchases relacionados
    const purchaseIds = equipments.rows
      .filter(e => e.purchase_id)
      .map(e => e.purchase_id);

    const purchases = purchaseIds.length > 0 ? await pool.query(`
      SELECT 
        p.id,
        p.mq,
        p.model,
        p.serial,
        p.mc,
        p.condition,
        p.created_at
      FROM purchases p
      WHERE p.id = ANY($1)
      ORDER BY p.created_at
    `, [purchaseIds]) : { rows: [] };

    // Buscar new_purchases relacionados
    const newPurchaseIds = equipments.rows
      .filter(e => e.new_purchase_id)
      .map(e => e.new_purchase_id);

    const newPurchases = newPurchaseIds.length > 0 ? await pool.query(`
      SELECT 
        np.id,
        np.mq,
        np.model,
        np.serial,
        np.mc,
        np.condition,
        np.created_at
      FROM new_purchases np
      WHERE np.id = ANY($1)
      ORDER BY np.created_at
    `, [newPurchaseIds]) : { rows: [] };

    res.json({
      equipments: equipments.rows,
      purchases: purchases.rows,
      new_purchases: newPurchases.rows,
      total_equipments: equipments.rows.length,
      is_duplicate: equipments.rows.length > 1
    });
  } catch (error) {
    console.error('❌ Error al buscar duplicados:', error);
    res.status(500).json({ 
      error: 'Error al buscar duplicados', 
      details: error.message 
    });
  }
});

export default router;

