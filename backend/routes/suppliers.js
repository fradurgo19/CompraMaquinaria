/**
 * Rutas de Proveedores (Suppliers)
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/suppliers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// POST /api/suppliers
router.post('/', async (req, res) => {
  try {
    const { name, contact_email, phone, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO suppliers (name, contact_email, phone, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, contact_email, phone, notes]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

export default router;

