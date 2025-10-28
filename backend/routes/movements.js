import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticación y autorización
const canManageLogistics = requireRole('logistica', 'admin', 'gerencia');

// Obtener movimientos de una compra específica
router.get('/:purchaseId', authenticateToken, canManageLogistics, async (req, res) => {
  try {
    const { purchaseId } = req.params;

    const result = await pool.query(
      `SELECT 
        mm.*,
        up.full_name as created_by_name
      FROM machine_movements mm
      LEFT JOIN users_profile up ON mm.created_by = up.id
      WHERE mm.purchase_id = $1
      ORDER BY mm.movement_date ASC, mm.created_at ASC`,
      [purchaseId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ error: 'Error al obtener los movimientos' });
  }
});

// Crear un nuevo movimiento
router.post('/', authenticateToken, canManageLogistics, async (req, res) => {
  try {
    const { purchase_id, movement_description, movement_date } = req.body;

    if (!purchase_id || !movement_description || !movement_date) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    const userId = req.user.id;

    const result = await pool.query(
      `INSERT INTO machine_movements 
       (purchase_id, movement_description, movement_date, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [purchase_id, movement_description, movement_date, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear movimiento:', error);
    res.status(500).json({ error: 'Error al crear el movimiento' });
  }
});

// Actualizar un movimiento
router.put('/:id', authenticateToken, canManageLogistics, async (req, res) => {
  try {
    const { id } = req.params;
    const { movement_description, movement_date } = req.body;

    const result = await pool.query(
      `UPDATE machine_movements 
       SET movement_description = $1, movement_date = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [movement_description, movement_date, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    res.status(500).json({ error: 'Error al actualizar el movimiento' });
  }
});

// Eliminar un movimiento
router.delete('/:id', authenticateToken, canManageLogistics, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM machine_movements WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    res.json({ message: 'Movimiento eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    res.status(500).json({ error: 'Error al eliminar el movimiento' });
  }
});

export default router;
