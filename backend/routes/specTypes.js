/**
 * Rutas para tipos de especificación técnica (ej: Llanta, Tipo Cabina)
 * Permite al usuario agregar nuevas especificaciones desde Gestionar Especificaciones por Defecto.
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

const canManageSpecs = async (req, res, next) => {
  const userRole = req.user?.role;
  const allowedRoles = ['admin', 'jefe_comercial'];
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: 'No tienes permisos para gestionar especificaciones' });
  }
  next();
};

/** Normaliza key: minúsculas, solo letras/números/guion bajo */
function normalizeKey(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^a-z0-9_]/g, '');
}

// GET /api/spec-types - Listar tipos de especificación
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, key, label, sort_order, created_at
      FROM spec_types
      ORDER BY sort_order ASC, label ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listando spec_types:', error);
    res.status(500).json({ error: 'Error al listar tipos de especificación' });
  }
});

// POST /api/spec-types - Crear tipo de especificación
router.post('/', canManageSpecs, async (req, res) => {
  try {
    const { label } = req.body;
    const labelTrim = label != null ? String(label).trim() : '';
    if (labelTrim !== '') {
      const key = normalizeKey(labelTrim);
      if (key !== '') {
        const result = await pool.query(
          `INSERT INTO spec_types (key, label, sort_order)
           VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM spec_types))
           RETURNING id, key, label, sort_order, created_at`,
          [key, labelTrim]
        );
        res.status(201).json(result.rows[0]);
        return;
      }
    }
    res.status(400).json({
      error: labelTrim === ''
        ? 'El nombre de la especificación es requerido'
        : 'El nombre debe contener al menos una letra o número',
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe una especificación con ese nombre' });
    }
    console.error('Error creando spec_type:', error);
    res.status(500).json({ error: 'Error al crear tipo de especificación' });
  }
});

export default router;
