/**
 * Rutas para Notificaciones Automáticas
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { 
  getUpcomingAuctions, 
  sendAuctionReminder, 
  sendReminderNow 
} from '../services/auctionNotifications.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/notifications/auctions/upcoming
 * Obtiene las subastas que ocurrirán en 2 días
 */
router.get('/auctions/upcoming', authenticateToken, async (req, res) => {
  try {
    const auctions = await getUpcomingAuctions();
    res.json({
      success: true,
      count: auctions.length,
      auctions
    });
  } catch (error) {
    console.error('Error al obtener subastas próximas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener subastas próximas'
    });
  }
});

/**
 * POST /api/notifications/auctions/send-reminder
 * Envía manualmente el recordatorio de subastas (solo para testing)
 */
router.post('/auctions/send-reminder', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin' && req.user.role !== 'gerencia') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ejecutar esta acción'
      });
    }

    const result = await sendReminderNow();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Recordatorio enviado exitosamente',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'No se pudo enviar el recordatorio',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error al enviar recordatorio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar recordatorio'
    });
  }
});

/**
 * GET /api/notifications/test-email
 * Prueba la configuración de correo (solo admin)
 */
router.get('/test-email', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ejecutar esta acción'
      });
    }

    const { createTransport } = await import('nodemailer');
    const transporter = createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'fradurgo19@gmail.com',
        pass: process.env.EMAIL_PASS || 'ylrjeyvjfembryig'
      }
    });

    await transporter.verify();
    
    res.json({
      success: true,
      message: 'Configuración de correo verificada correctamente'
    });
  } catch (error) {
    console.error('Error al verificar configuración de correo:', error);
    res.status(500).json({
      success: false,
      error: 'Error en la configuración de correo',
      details: error.message
    });
  }
});

/**
 * ============================================
 * SISTEMA DE NOTIFICACIONES INTERNAS
 * ============================================
 */

/**
 * GET /api/notifications
 * Obtener notificaciones del usuario actual
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const userRole = req.user.role;
    const { unreadOnly, module, limit = 50 } = req.query;

    let query = `
      SELECT 
        n.*,
        up.email as created_by_email,
        up.full_name as created_by_name
      FROM notifications n
      LEFT JOIN users_profile up ON n.created_by = up.id
      WHERE n.user_id = $1
        AND (n.expires_at IS NULL OR n.expires_at > NOW())
    `;

    const params = [userId];

    if (unreadOnly === 'true') {
      query += ` AND n.is_read = false`;
    }

    if (module) {
      query += ` AND n.module_target = $${params.length + 1}`;
      params.push(module);
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    console.log(`📬 Obtenidas ${result.rows.length} notificaciones para usuario ${userId}`);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Obtener contador de notificaciones no leídas
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const result = await pool.query(
      `SELECT COUNT(*) as total
       FROM notifications
       WHERE user_id = $1 
         AND is_read = false
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );

    const count = parseInt(result.rows[0]?.total || 0);
    res.json({ count });
  } catch (error) {
    console.error('❌ Error al contar notificaciones:', error);
    res.status(500).json({ error: 'Error al contar notificaciones' });
  }
});

/**
 * GET /api/notifications/by-module
 * Obtener contadores agrupados por módulo
 */
router.get('/by-module', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const result = await pool.query(
      `SELECT 
         module_target,
         COUNT(*) as total,
         COUNT(CASE WHEN is_read = false THEN 1 END) as unread
       FROM notifications
       WHERE user_id = $1
         AND (expires_at IS NULL OR expires_at > NOW())
       GROUP BY module_target`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener notificaciones por módulo:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones por módulo' });
  }
});

/**
 * POST /api/notifications
 * Crear nueva notificación
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      user_id,
      module_source,
      module_target,
      type,
      priority = 1,
      title,
      message,
      reference_id = null,
      metadata = null,
      action_type = null,
      action_url = null,
      expires_at = null
    } = req.body;

    const createdBy = req.user.userId || req.user.id;

    const result = await pool.query(
      `INSERT INTO notifications (
        user_id, module_source, module_target, type, priority, 
        title, message, reference_id, metadata, action_type, action_url,
        expires_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        user_id, module_source, module_target, type, priority,
        title, message, reference_id, metadata, action_type, action_url,
        expires_at, createdBy
      ]
    );

    console.log(`✅ Notificación creada: ${title} (${type})`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al crear notificación:', error);
    res.status(500).json({ error: 'Error al crear notificación', details: error.message });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Marcar notificación como leída
 */
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true, read_at = NOW(), read_by = $2
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    console.log(`✅ Notificación marcada como leída: ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al marcar notificación:', error);
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
});

/**
 * PUT /api/notifications/mark-all-read
 * Marcar todas las notificaciones como leídas
 */
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { module } = req.body;

    let query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW(), read_by = $1
      WHERE user_id = $1 AND is_read = false
    `;

    const params = [userId];

    if (module) {
      query += ` AND module_target = $2`;
      params.push(module);
    }

    query += ` RETURNING *`;

    const result = await pool.query(query, params);

    console.log(`✅ ${result.rows.length} notificaciones marcadas como leídas`);
    res.json({ count: result.rows.length, notifications: result.rows });
  } catch (error) {
    console.error('❌ Error al marcar todas como leídas:', error);
    res.status(500).json({ error: 'Error al marcar todas como leídas' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Eliminar una notificación
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    console.log(`✅ Notificación eliminada: ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error al eliminar notificación:', error);
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
});

export default router;

