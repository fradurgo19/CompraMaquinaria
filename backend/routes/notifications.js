/**
 * Rutas para Notificaciones Automáticas
 */

import express from 'express';
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

export default router;

