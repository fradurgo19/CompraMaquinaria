/**
 * Rutas para gestionar marcas y modelos dinámicamente
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/brands-and-models/brands - Obtener todas las marcas
router.get('/brands', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, created_at, updated_at FROM brands ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener marcas:', error);
    res.status(500).json({ error: 'Error al obtener marcas' });
  }
});

// GET /api/brands-and-models/models - Obtener todos los modelos
router.get('/models', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, created_at, updated_at FROM models ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener modelos:', error);
    res.status(500).json({ error: 'Error al obtener modelos' });
  }
});

// POST /api/brands-and-models/brands - Crear nueva marca
router.post('/brands', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre de la marca es requerido' });
    }

    const trimmedName = name.trim().toUpperCase();

    // Verificar si ya existe
    const existing = await pool.query(
      'SELECT id FROM brands WHERE name = $1',
      [trimmedName]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Esta marca ya existe' });
    }

    const result = await pool.query(
      'INSERT INTO brands (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
      [trimmedName]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear marca:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Esta marca ya existe' });
    }
    res.status(500).json({ error: 'Error al crear marca' });
  }
});

// POST /api/brands-and-models/models - Crear nuevo modelo
router.post('/models', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre del modelo es requerido' });
    }

    const trimmedName = name.trim();

    // Verificar si ya existe
    const existing = await pool.query(
      'SELECT id FROM models WHERE name = $1',
      [trimmedName]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Este modelo ya existe' });
    }

    const result = await pool.query(
      'INSERT INTO models (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
      [trimmedName]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear modelo:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Este modelo ya existe' });
    }
    res.status(500).json({ error: 'Error al crear modelo' });
  }
});

// PUT /api/brands-and-models/brands/:id - Actualizar marca
router.put('/brands/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre de la marca es requerido' });
    }

    const trimmedName = name.trim().toUpperCase();

    // Verificar si ya existe con otro ID
    const existing = await pool.query(
      'SELECT id FROM brands WHERE name = $1 AND id != $2',
      [trimmedName, id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Esta marca ya existe' });
    }

    const result = await pool.query(
      'UPDATE brands SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, created_at, updated_at',
      [trimmedName, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar marca:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Esta marca ya existe' });
    }
    res.status(500).json({ error: 'Error al actualizar marca' });
  }
});

// PUT /api/brands-and-models/models/:id - Actualizar modelo
router.put('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre del modelo es requerido' });
    }

    const trimmedName = name.trim();

    // Verificar si ya existe con otro ID
    const existing = await pool.query(
      'SELECT id FROM models WHERE name = $1 AND id != $2',
      [trimmedName, id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Este modelo ya existe' });
    }

    const result = await pool.query(
      'UPDATE models SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, created_at, updated_at',
      [trimmedName, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Modelo no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar modelo:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Este modelo ya existe' });
    }
    res.status(500).json({ error: 'Error al actualizar modelo' });
  }
});

// DELETE /api/brands-and-models/brands/:id - Eliminar marca
router.delete('/brands/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM brands WHERE id = $1 RETURNING id, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }

    res.json({ message: 'Marca eliminada exitosamente', brand: result.rows[0] });
  } catch (error) {
    console.error('Error al eliminar marca:', error);
    if (error.code === '23503') { // Foreign key violation
      return res.status(409).json({ error: 'No se puede eliminar esta marca porque está siendo usada en otros registros' });
    }
    res.status(500).json({ error: 'Error al eliminar marca' });
  }
});

// DELETE /api/brands-and-models/models/:id - Eliminar modelo
router.delete('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM models WHERE id = $1 RETURNING id, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Modelo no encontrado' });
    }

    res.json({ message: 'Modelo eliminado exitosamente', model: result.rows[0] });
  } catch (error) {
    console.error('Error al eliminar modelo:', error);
    if (error.code === '23503') { // Foreign key violation
      return res.status(409).json({ error: 'No se puede eliminar este modelo porque está siendo usado en otros registros' });
    }
    res.status(500).json({ error: 'Error al eliminar modelo' });
  }
});

export default router;

