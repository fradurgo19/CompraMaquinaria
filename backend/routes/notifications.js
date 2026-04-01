/**
 * Rutas para Notificaciones Automáticas
 */

import express from 'express';
import { queryWithRetry } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  getAuctionsNeedingNotification,
  sendNotificationsNow,
} from '../services/auctionColombiaTimeNotifications.js';

const router = express.Router();

/**
 * POST /api/notifications/auctions/send-colombia-time
 * Envía manualmente las notificaciones de subastas basadas en hora de Colombia
 * Envía ambas: 1 día antes y 3 horas antes (solo para testing)
 */
router.post('/auctions/send-colombia-time', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea admin o gerencia
    if (req.user.role !== 'admin' && req.user.role !== 'gerencia') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ejecutar esta acción'
      });
    }

    const result = await sendNotificationsNow();
    
    res.json({
      success: true,
      message: 'Notificaciones procesadas',
      data: result
    });
  } catch (error) {
    console.error('Error al enviar notificaciones de Colombia time:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar notificaciones',
      details: error.message
    });
  }
});

/**
 * GET /api/notifications/auctions/colombia-time-preview
 * Solo lectura: subastas que entrarían hoy en cada ventana (1 día / 3 horas) sin enviar correos ni tocar BD de envíos.
 * Misma lógica de filtro que el envío real; admin o gerencia.
 */
router.get('/auctions/colombia-time-preview', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'gerencia') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ejecutar esta acción',
      });
    }

    const [oneDayRows, threeHourRows] = await Promise.all([
      getAuctionsNeedingNotification('1_DAY_BEFORE'),
      getAuctionsNeedingNotification('3_HOURS_BEFORE'),
    ]);

    const mapRow = (row) => ({
      auctionId: row.auction_id,
      lotNumber: row.lot_number,
      colombiaTime: row.colombia_time,
      model: row.model,
      serial: row.serial,
    });

    res.json({
      success: true,
      message:
        'Vista previa: subastas elegibles ahora (pendientes de envío para cada tipo). No se ha enviado nada.',
      data: {
        oneDayBefore: { count: oneDayRows.length, auctions: oneDayRows.map(mapRow) },
        threeHoursBefore: { count: threeHourRows.length, auctions: threeHourRows.map(mapRow) },
      },
    });
  } catch (error) {
    console.error('Error en colombia-time-preview:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener vista previa',
      details: error.message,
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
    const { unreadOnly, module, limit = 50 } = req.query;

    let query = `
      SELECT n.*
      FROM notifications n
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

    const result = await queryWithRetry(query, params);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`📬 Obtenidas ${result.rows.length} notificaciones para usuario ${userId}`);
    }
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

    const result = await queryWithRetry(
      `SELECT COUNT(*) as total
       FROM notifications
       WHERE user_id = $1 
         AND is_read = false
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );

    const count = Number.parseInt(result.rows[0]?.total || 0, 10);
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

    const result = await queryWithRetry(
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

    const result = await queryWithRetry(
      `INSERT INTO notifications (
        user_id, module_source, module_target, type, priority, 
        title, message, reference_id, metadata, action_type, action_url,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        user_id, module_source, module_target, type, priority,
        title, message, reference_id, metadata, action_type, action_url,
        expires_at
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
 * Marcar notificación como leída. Solo el destinatario (user_id) puede marcarla leída.
 */
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    const result = await queryWithRetry(
      `UPDATE notifications
       SET is_read = true, read_at = NOW()
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
 * Marcar como leídas solo las notificaciones del usuario actual.
 */
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { module } = req.body;

    let query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE is_read = false AND user_id = $1
    `;

    const params = [userId];

    if (module) {
      query += ` AND module_target = $2`;
      params.push(module);
    }

    query += ` RETURNING *`;

    const result = await queryWithRetry(query, params);

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

    const result = await queryWithRetry(
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

