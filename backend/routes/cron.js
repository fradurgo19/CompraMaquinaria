import express from 'express';
import { pool } from '../db/connection.js';
import { runEquipmentsMaintenanceIfLeader } from './equipments.js';

const router = express.Router();

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim();
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
      duration_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error ejecutando cron de mantenimiento de equipos:', error);
    return res.status(500).json({
      error: 'Error ejecutando mantenimiento de equipos',
      details: error.message
    });
  }
});

export default router;
