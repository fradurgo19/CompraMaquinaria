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

/** Convierte options de fila DB a array de strings */
function parseOptionsToArray(rowOptions) {
  if (Array.isArray(rowOptions)) return rowOptions;
  if (typeof rowOptions === 'string') {
    try {
      const parsed = JSON.parse(rowOptions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// GET /api/spec-types - Listar tipos de especificación
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, key, label, sort_order, COALESCE(options, '[]') AS options, created_at
      FROM spec_types
      ORDER BY sort_order ASC, label ASC
    `);
    const rows = result.rows.map((row) => ({
      ...row,
      options: parseOptionsToArray(row.options),
    }));
    res.json(rows);
  } catch (error) {
    console.error('Error listando spec_types:', error);
    res.status(500).json({ error: 'Error al listar tipos de especificación' });
  }
});

// POST /api/spec-types - Crear tipo de especificación
router.post('/', canManageSpecs, async (req, res) => {
  try {
    const { label, options: optionsRaw } = req.body;
    const labelTrim = (label === null || label === undefined) ? '' : String(label).trim();
    if (labelTrim === '') {
      return res.status(400).json({
        error: 'El nombre de la especificación es requerido',
      });
    }
    const key = normalizeKey(labelTrim);
    if (key === '') {
      return res.status(400).json({
        error: 'El nombre debe contener al menos una letra o número',
      });
    }
    const optionsArr = Array.isArray(optionsRaw)
      ? optionsRaw.map((o) => String(o).trim()).filter((o) => o !== '')
      : [];
    const result = await pool.query(
      `INSERT INTO spec_types (key, label, sort_order, options)
       VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM spec_types), $3)
       RETURNING id, key, label, sort_order, COALESCE(options, '[]') AS options, created_at`,
      [key, labelTrim, JSON.stringify(optionsArr)]
    );
    const row = result.rows[0];
    const options = parseOptionsToArray(row.options);
    res.status(201).json({ ...row, options });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe una especificación con ese nombre' });
    }
    console.error('Error creando spec_type:', error);
    res.status(500).json({ error: 'Error al crear tipo de especificación' });
  }
});

/** Normaliza body.options a array de strings no vacíos */
function normalizeOptionsFromBody(optionsRaw) {
  if (Array.isArray(optionsRaw)) {
    return optionsRaw.map((o) => String(o).trim()).filter((o) => o !== '');
  }
  return [];
}

// PUT /api/spec-types/:id - Actualizar opciones de un tipo de especificación
router.put('/:id', canManageSpecs, async (req, res) => {
  try {
    const { id } = req.params;
    const { options: optionsRaw } = req.body;
    if (id === undefined || id === null || String(id).trim() === '') {
      return res.status(400).json({ error: 'ID de tipo de especificación requerido' });
    }
    const optionsArr = normalizeOptionsFromBody(optionsRaw);
    const result = await pool.query(
      `UPDATE spec_types SET options = $2
       WHERE id = $1
       RETURNING id, key, label, sort_order, COALESCE(options, '[]') AS options, created_at`,
      [id, JSON.stringify(optionsArr)]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tipo de especificación no encontrado' });
    }
    const row = result.rows[0];
    const options = parseOptionsToArray(row.options);
    res.json({ ...row, options });
  } catch (error) {
    console.error('Error actualizando opciones de spec_type:', error);
    res.status(500).json({ error: 'Error al actualizar opciones' });
  }
});

export default router;
