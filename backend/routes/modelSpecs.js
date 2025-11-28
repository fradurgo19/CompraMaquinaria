/**
 * Rutas para gestionar especificaciones por defecto de modelos
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Middleware para verificar permisos (solo admin y jefe_comercial)
const canManageSpecs = async (req, res, next) => {
  const userRole = req.user.role;
  const allowedRoles = ['admin', 'jefe_comercial'];
  
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: 'No tienes permisos para gestionar especificaciones' });
  }
  next();
};

// GET /api/model-specs - Obtener todas las especificaciones
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        model,
        condition,
        cabin_type,
        wet_line,
        dozer_blade,
        track_type,
        track_width,
        created_at,
        updated_at
      FROM model_specifications
      ORDER BY model, condition
    `);

    // Convertir a formato ModelSpecs
    const specs = result.rows.map(row => ({
      id: row.id,
      model: row.model,
      condition: row.condition,
      specs: {
        cabin_type: row.cabin_type,
        wet_line: row.wet_line,
        dozer_blade: row.dozer_blade,
        track_type: row.track_type,
        track_width: row.track_width,
      },
    }));

    res.json(specs);
  } catch (error) {
    console.error('❌ Error obteniendo especificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo especificaciones' });
  }
});

// POST /api/model-specs - Crear o actualizar especificaciones (bulk)
router.post('/', canManageSpecs, async (req, res) => {
  try {
    const { specs } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!Array.isArray(specs)) {
      return res.status(400).json({ error: 'Se espera un array de especificaciones' });
    }

    // Eliminar todas las especificaciones existentes
    await pool.query('DELETE FROM model_specifications');

    // Insertar las nuevas especificaciones
    const insertPromises = specs.map((spec) => {
      return pool.query(
        `INSERT INTO model_specifications 
         (model, condition, cabin_type, wet_line, dozer_blade, track_type, track_width, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          spec.model,
          spec.condition,
          spec.specs.cabin_type,
          spec.specs.wet_line,
          spec.specs.dozer_blade,
          spec.specs.track_type,
          spec.specs.track_width,
          userId,
        ]
      );
    });

    await Promise.all(insertPromises);

    console.log(`✅ ${specs.length} especificaciones guardadas`);
    res.json({ message: 'Especificaciones guardadas correctamente', count: specs.length });
  } catch (error) {
    console.error('❌ Error guardando especificaciones:', error);
    res.status(500).json({ error: 'Error guardando especificaciones' });
  }
});

// GET /api/model-specs/:model/:condition - Obtener especificación por modelo y condición
router.get('/:model/:condition', async (req, res) => {
  try {
    const { model, condition } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM model_specifications 
       WHERE UPPER(model) = UPPER($1) AND UPPER(condition) = UPPER($2)`,
      [model, condition]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Especificación no encontrada' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      model: row.model,
      condition: row.condition,
      specs: {
        cabin_type: row.cabin_type,
        wet_line: row.wet_line,
        dozer_blade: row.dozer_blade,
        track_type: row.track_type,
        track_width: row.track_width,
      },
    });
  } catch (error) {
    console.error('❌ Error obteniendo especificación:', error);
    res.status(500).json({ error: 'Error obteniendo especificación' });
  }
});

export default router;

