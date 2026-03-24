import express from 'express';
import { pool } from '../db/connection.js';
import { runEquipmentsMaintenanceIfLeader } from './equipments.js';
import { processAllNotifications } from '../services/auctionColombiaTimeNotifications.js';

const router = express.Router();

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim();
}

function isCronAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const token = extractBearerToken(req);
    return token === cronSecret;
  }
  return process.env.NODE_ENV !== 'production';
}

function isPoolConnectionTimeoutError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('timeout exceeded when trying to connect') ||
    message.includes('timeout obteniendo conexión del pool') ||
    message.includes('timeout esperando conexión disponible') ||
    error?.code === 'ETIMEDOUT'
  );
}

/**
 * Endpoint para Vercel Cron.
 * Seguridad:
 * - Producción: requiere CRON_SECRET y Authorization: Bearer <CRON_SECRET>.
 * - No producción: permite ejecución local si CRON_SECRET no está configurado.
 */
router.get('/equipments-maintenance', async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const token = extractBearerToken(req);
      if (token !== cronSecret) {
        return res.status(401).json({ error: 'No autorizado' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'CRON_SECRET no configurado en producción'
      });
    }

    const startedAt = Date.now();
    const maintenanceResult = await runEquipmentsMaintenanceIfLeader(pool, null);

    return res.status(200).json({
      ok: true,
      executed: maintenanceResult?.executed === true,
      skipped_reason: maintenanceResult?.skippedReason ?? null,
      duration_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (isPoolConnectionTimeoutError(error)) {
      console.warn('⚠️ Cron de mantenimiento omitido por timeout de conexión');
      return res.status(200).json({
        ok: true,
        executed: false,
        skipped_reason: 'db_connection_timeout',
        duration_ms: 0,
        timestamp: new Date().toISOString()
      });
    }
    console.error('❌ Error ejecutando cron de mantenimiento de equipos:', error);
    return res.status(500).json({
      error: 'Error ejecutando mantenimiento de equipos',
      details: error.message
    });
  }
});

/**
 * Endpoint para Vercel Cron: notificaciones "Subasta por cumplirse" (1 día y 3 horas antes, hora Colombia).
 * Crea notificaciones in-app para sdonado@partequiposusa.com (rol sebastian).
 * Debe ejecutarse cada 15 minutos para que las notificaciones lleguen en la ventana correcta.
 */
router.get('/auction-colombia-time', async (req, res) => {
  try {
    if (!isCronAuthorized(req)) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const startedAt = Date.now();
    const results = await processAllNotifications();

    return res.status(200).json({
      ok: true,
      oneDayBefore: results.oneDayBefore ?? { sent: 0, errors: 0 },
      threeHoursBefore: results.threeHoursBefore ?? { sent: 0, errors: 0 },
      duration_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error ejecutando cron de notificaciones de subastas (Colombia):', error);
    return res.status(500).json({
      error: 'Error ejecutando notificaciones de subastas',
      details: error.message
    });
  }
});

export default router;
