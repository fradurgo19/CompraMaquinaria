/**
 * Rutas de Control de Cambios (Change Logs)
 * Sistema de auditoría para registrar modificaciones
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * POST /api/change-logs
 * Registrar cambios en un registro
 */
router.post('/', async (req, res) => {
  try {
    const { table_name, record_id, changes, change_reason } = req.body;
    const userId = req.user.userId || req.user.id;

    console.log('📥 Recibiendo solicitud de registro de cambios:');
    console.log('  - Tabla:', table_name);
    console.log('  - Record ID:', record_id);
    console.log('  - Cambios:', changes);
    console.log('  - Usuario:', userId);

    if (!table_name || !record_id || !changes || changes.length === 0) {
      console.log('❌ Datos incompletos:', { table_name, record_id, changes });
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Insertar cada cambio en la tabla
    const insertPromises = changes.map(change => {
      return pool.query(
        `INSERT INTO change_logs 
         (table_name, record_id, field_name, field_label, old_value, new_value, change_reason, changed_by, changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING *`,
        [
          table_name,
          record_id,
          change.field_name,
          change.field_label,
          change.old_value,
          change.new_value,
          change_reason || null,
          userId
        ]
      );
    });

    await Promise.all(insertPromises);

    console.log(`✅ Registrados ${changes.length} cambios en ${table_name} (ID: ${record_id})`);
    
    res.status(201).json({ 
      success: true, 
      message: `${changes.length} cambio(s) registrado(s)`,
      count: changes.length
    });
  } catch (error) {
    console.error('❌ Error al registrar cambios:', error);
    res.status(500).json({ error: 'Error al registrar cambios' });
  }
});

/**
 * GET /api/change-logs/recent
 * Obtener cambios recientes (últimos 50)
 */
router.get('/recent', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         cl.*,
         up.email as changed_by_email,
         up.full_name as changed_by_name
       FROM change_logs cl
       LEFT JOIN users_profile up ON cl.changed_by = up.id
       ORDER BY cl.changed_at DESC
       LIMIT 50`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener cambios recientes:', error);
    res.status(500).json({ error: 'Error al obtener cambios recientes' });
  }
});

/**
 * GET /api/change-logs/full/:purchaseId
 * Obtener historial completo de todos los módulos relacionados a un purchase
 */
router.get('/full/:purchaseId', async (req, res) => {
  try {
    const { purchaseId } = req.params;

    console.log('📤 Solicitando historial COMPLETO para Purchase ID:', purchaseId);

    // Buscar TODOS los cambios relacionados al purchase_id (incluyendo módulos relacionados)
    const result = await pool.query(
      `SELECT 
         cl.*,
         up.email as changed_by_email,
         up.full_name as changed_by_name
       FROM change_logs cl
       LEFT JOIN users_profile up ON cl.changed_by = up.id
       WHERE cl.record_id = $1
          OR cl.record_id IN (
            SELECT id FROM service_records WHERE purchase_id = $1
          )
          OR cl.record_id IN (
            SELECT id FROM equipments WHERE purchase_id = $1
          )
       ORDER BY cl.changed_at DESC`,
      [purchaseId]
    );

    console.log(`✅ Historial completo encontrado: ${result.rows.length} cambio(s) para purchase ${purchaseId}`);
    
    if (result.rows.length > 0) {
      console.log('   Cambios encontrados:');
      result.rows.forEach(row => {
        console.log(`   - [${row.table_name}] ${row.field_label || row.field_name}: ${row.old_value} → ${row.new_value}`);
      });
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener historial completo:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({ error: 'Error al obtener historial completo', details: error.message });
  }
});

/**
 * GET /api/change-logs/:tableName/:recordId
 * Obtener historial de cambios de un registro específico
 * NOTA: Esta ruta debe estar AL FINAL para no interferir con /full y /recent
 */
router.get('/:tableName/:recordId', async (req, res) => {
  try {
    const { tableName, recordId } = req.params;

    console.log('📤 Solicitando historial específico:');
    console.log('  - Tabla:', tableName);
    console.log('  - Record ID:', recordId);

    const result = await pool.query(
      `SELECT 
         cl.*,
         up.email as changed_by_email,
         up.full_name as changed_by_name
       FROM change_logs cl
       LEFT JOIN users_profile up ON cl.changed_by = up.id
       WHERE cl.table_name = $1 AND cl.record_id = $2
       ORDER BY cl.changed_at DESC`,
      [tableName, recordId]
    );

    console.log(`✅ Encontrados ${result.rows.length} cambio(s) en ${tableName}`);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial de cambios' });
  }
});

export default router;

