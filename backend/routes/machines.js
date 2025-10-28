/**
 * Rutas de Máquinas (Machines)
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/machines
router.get('/', async (req, res) => {
  try {
    const { role, userId } = req.user;
    
    let query = 'SELECT * FROM machines';
    const params = [];
    
    // Sebastián solo ve máquinas de sus subastas
    if (role === 'sebastian') {
      query += ' WHERE id IN (SELECT machine_id FROM auctions WHERE created_by = $1)';
      params.push(userId);
    }
    // Eliana solo ve máquinas de compras
    else if (role === 'eliana') {
      query += ' WHERE id IN (SELECT machine_id FROM purchases)';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener máquinas:', error);
    res.status(500).json({ error: 'Error al obtener máquinas' });
  }
});

// POST /api/machines
router.post('/', async (req, res) => {
  try {
    const { model, serial, year, hours, drive_folder_id } = req.body;
    
    const result = await pool.query(
      `INSERT INTO machines (model, serial, year, hours, drive_folder_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [model, serial, year, hours, drive_folder_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear máquina:', error);
    res.status(500).json({ error: 'Error al crear máquina' });
  }
});

export default router;

