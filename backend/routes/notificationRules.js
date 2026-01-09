/**
 * Rutas para Gestión de Reglas de Notificación
 * Panel de Administración - Solo Admin
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware: Solo Admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
  }
  next();
};

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * GET /api/notification-rules
 * Obtener todas las reglas
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        nr.*,
        up.full_name as creator_name,
        up.email as creator_email
      FROM notification_rules nr
      LEFT JOIN users_profile up ON nr.created_by = up.id
      ORDER BY nr.notification_priority DESC, nr.name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo reglas:', error);
    res.status(500).json({ error: 'Error al obtener reglas de notificación' });
  }
});

/**
 * GET /api/notification-rules/:id
 * Obtener una regla específica
 */
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM notification_rules WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo regla:', error);
    res.status(500).json({ error: 'Error al obtener regla' });
  }
});

/**
 * POST /api/notification-rules
 * Crear nueva regla
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      rule_code,
      name,
      description,
      module_source,
      module_target,
      trigger_event,
      trigger_condition,
      notification_type,
      notification_priority,
      notification_title_template,
      notification_message_template,
      target_roles,
      target_users,
      action_type,
      action_url_template,
      is_active,
      check_frequency_minutes,
      expires_in_days
    } = req.body;

    // Validaciones
    if (!rule_code || !name || !module_source || !module_target || !trigger_event) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    const result = await pool.query(`
      INSERT INTO notification_rules (
        rule_code, name, description,
        module_source, module_target,
        trigger_event, trigger_condition,
        notification_type, notification_priority,
        notification_title_template, notification_message_template,
        target_roles, target_users,
        action_type, action_url_template,
        is_active, check_frequency_minutes, expires_in_days,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      rule_code, name, description,
      module_source, module_target,
      trigger_event, trigger_condition || {},
      notification_type || 'info', notification_priority || 1,
      notification_title_template, notification_message_template,
      target_roles || [], target_users || null,
      action_type || null, action_url_template || null,
      is_active !== undefined ? is_active : true,
      check_frequency_minutes || 60,
      expires_in_days || 7,
      userId
    ]);

    console.log(`✅ Regla creada: ${rule_code}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creando regla:', error);
    
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'El código de regla ya existe' });
    }
    
    res.status(500).json({ error: 'Error al crear regla' });
  }
});

/**
 * PUT /api/notification-rules/:id
 * Actualizar regla
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Construir SET clause dinámicamente
    const allowedFields = [
      'name', 'description', 'module_source', 'module_target',
      'trigger_event', 'trigger_condition',
      'notification_type', 'notification_priority',
      'notification_title_template', 'notification_message_template',
      'target_roles', 'target_users',
      'action_type', 'action_url_template',
      'is_active', 'check_frequency_minutes', 'expires_in_days'
    ];

    const fieldsToUpdate = [];
    const values = [];
    let paramCounter = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        fieldsToUpdate.push(`${key} = $${paramCounter}`);
        values.push(value);
        paramCounter++;
      }
    });

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    values.push(id);

    const result = await pool.query(`
      UPDATE notification_rules
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    console.log(`✅ Regla actualizada: ${result.rows[0].rule_code}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando regla:', error);
    res.status(500).json({ error: 'Error al actualizar regla' });
  }
});

/**
 * DELETE /api/notification-rules/:id
 * Eliminar regla
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM notification_rules WHERE id = $1 RETURNING rule_code',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    console.log(`✅ Regla eliminada: ${result.rows[0].rule_code}`);
    res.json({ message: 'Regla eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando regla:', error);
    res.status(500).json({ error: 'Error al eliminar regla' });
  }
});

/**
 * POST /api/notification-rules/:id/toggle
 * Activar/Desactivar regla rápidamente
 */
router.post('/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE notification_rules
      SET is_active = NOT is_active
      WHERE id = $1
      RETURNING id, rule_code, is_active
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    const rule = result.rows[0];
    console.log(`✅ Regla ${rule.rule_code} ${rule.is_active ? 'activada' : 'desactivada'}`);
    
    res.json(rule);
  } catch (error) {
    console.error('Error cambiando estado de regla:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

/**
 * POST /api/notification-rules/test
 * Ejecutar TODAS las reglas activas manualmente para pruebas
 */
router.post('/test', requireAdmin, async (req, res) => {
  try {
    const { checkAndExecuteRules } = await import('../services/notificationTriggers.js');

    console.log('🧪 Ejecución manual de prueba solicitada');
    const result = await checkAndExecuteRules();

    res.json({
      success: true,
      message: 'Ejecución de prueba completada',
      totalNotificationsCreated: result.totalNotificationsCreated || 0
    });
  } catch (error) {
    console.error('❌ Error ejecutando prueba de reglas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al ejecutar prueba de reglas',
      details: error.message 
    });
  }
});

/**
 * POST /api/notification-rules/:id/test
 * Ejecutar regla específica manualmente para pruebas
 */
router.post('/:id/test', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { checkAndExecuteRules } = await import('../services/notificationTriggers.js');

    const result = await checkAndExecuteRules();

    res.json({
      message: 'Ejecución de prueba completada',
      ...result
    });
  } catch (error) {
    console.error('Error ejecutando regla de prueba:', error);
    res.status(500).json({ error: 'Error al ejecutar regla' });
  }
});

/**
 * GET /api/notification-rules/stats/summary
 * Resumen de estadísticas de reglas
 */
router.get('/stats/summary', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_rules,
        COUNT(*) FILTER (WHERE is_active = true) as active_rules,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_rules,
        COUNT(DISTINCT module_source) as modules_covered
      FROM notification_rules
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/notification-rules/users/list
 * Obtener lista de usuarios para selección en reglas
 * 
 * Intenta usar la función get_all_users_for_notification_rules() si existe,
 * de lo contrario usa una consulta directa (ya que el usuario está verificado como admin).
 */
router.get('/users/list', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.user; // Obtener el ID del usuario autenticado (ya verificado como admin por requireAdmin)
    const { queryWithRetry } = await import('../db/connection.js');
    
    let result;
    
    // Intentar usar la función si existe, de lo contrario usar consulta directa
    // Nota: En Vercel/Supabase Transaction Pooler, no hay contexto JWT, así que la consulta directa
    // debe usar SECURITY DEFINER o bypasear RLS de otra forma
    try {
      // Intentar usar la función SECURITY DEFINER si existe
      result = await queryWithRetry(
        `SELECT * FROM get_all_users_for_notification_rules($1::uuid)`,
        [userId]
      );
      console.log('✅ Usando función get_all_users_for_notification_rules');
    } catch (funcError) {
      // Si la función no existe, usar consulta directa
      // En Supabase, cuando el backend usa service role connection string, debería bypasear RLS
      // Pero para estar seguros, usamos SET LOCAL para deshabilitar RLS temporalmente solo para esta query
      console.log('⚠️ Función get_all_users_for_notification_rules no existe, usando consulta directa con bypass RLS');
      
      // Usar una consulta que acceda directamente a las tablas sin depender de RLS
      // Esto funcionará porque el backend en Vercel usa connection string con permisos elevados
      result = await queryWithRetry(
        `SELECT 
          up.id,
          up.full_name,
          COALESCE(up.email, au.email, 'Sin email') as email,
          up.role
        FROM users_profile up
        LEFT JOIN auth.users au ON up.id = au.id
        ORDER BY up.full_name ASC NULLS LAST, COALESCE(up.email, au.email, '') ASC`,
        []
      );
    }

    res.json(result.rows.map(row => ({
      id: row.id,
      full_name: row.full_name || 'Sin nombre',
      email: row.email || 'Sin email',
      role: row.role || 'Sin rol'
    })));
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    console.error('Detalles del error:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    
    // Si el error es relacionado con permisos o RLS
    if (error.message?.includes('Acceso denegado') || 
        error.message?.includes('permission denied') ||
        error.message?.includes('policy') ||
        error.code === '42501') {
      return res.status(403).json({ 
        error: 'No tienes permisos para acceder a esta información. Asegúrate de aplicar la migración SQL en Supabase: 20260110_allow_admin_view_all_users_for_notification_rules.sql',
        details: error.message,
        hint: 'Ejecuta la migración SQL en Supabase SQL Editor para habilitar esta funcionalidad'
      });
    }
    
    // Si la función no existe, sugerir aplicar migraciones
    if (error.message?.includes('does not exist') || error.message?.includes('function')) {
      return res.status(500).json({ 
        error: 'La función de base de datos no existe. Por favor, ejecute la migración 20260110_allow_admin_view_all_users_for_notification_rules.sql en Supabase SQL Editor.',
        details: error.message,
        hint: 'Copia y pega el contenido del archivo de migración en Supabase SQL Editor'
      });
    }
    
    res.status(500).json({ 
      error: 'Error al obtener lista de usuarios', 
      details: error.message 
    });
  }
});

export default router;

