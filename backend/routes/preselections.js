/**
 * Rutas de Preselecciones (Preselections)
 * Módulo previo a subastas para evaluación de equipos
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Middleware para verificar acceso a preselecciones (Sebastian y Gerencia)
const canViewPreselections = (req, res, next) => {
  const { role } = req.user;
  if (role === 'sebastian' || role === 'gerencia' || role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'No tienes permisos para acceder a preselecciones' });
  }
};

// GET /api/preselections - Obtener todas las preselecciones
router.get('/', canViewPreselections, async (req, res) => {
  try {
    const { role, userId } = req.user;
    
    let query = `
      SELECT 
        p.*,
        a.id as auction_id_generated,
        a.status as auction_status
      FROM preselections p
      LEFT JOIN auctions a ON p.auction_id = a.id
    `;
    
    const params = [];
    
    // Sebastián solo ve sus propias preselecciones
    if (role === 'sebastian') {
      query += ' WHERE p.created_by = $1';
      params.push(userId);
    }
    
    query += ' ORDER BY p.auction_date DESC, p.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener preselecciones:', error);
    res.status(500).json({ error: 'Error al obtener preselecciones' });
  }
});

// POST /api/preselections - Crear nueva preselección
router.post('/', canViewPreselections, async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      supplier_name,
      auction_date,
      lot_number,
      brand,
      model,
      serial,
      year,
      hours,
      suggested_price,
      auction_url,
      comments
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO preselections (
        supplier_name, auction_date, lot_number, brand, model, serial,
        year, hours, suggested_price, auction_url, comments, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [supplier_name, auction_date, lot_number, brand, model, serial,
       year, hours, suggested_price, auction_url, comments, userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear preselección:', error);
    res.status(500).json({ error: 'Error al crear preselección' });
  }
});

// PUT /api/preselections/:id - Actualizar preselección
router.put('/:id', canViewPreselections, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;
    const updates = req.body;
    
    // Verificar que la preselección existe y pertenece al usuario (si no es admin/gerencia)
    const check = await pool.query(
      'SELECT id FROM preselections WHERE id = $1' + 
      (role === 'sebastian' ? ' AND created_by = $2' : ''),
      role === 'sebastian' ? [id, userId] : [id]
    );
    
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'No puedes editar esta preselección' });
    }
    
    // Construir query dinámico
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE preselections SET ${setClause}, updated_at = NOW() 
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar preselección:', error);
    res.status(500).json({ error: 'Error al actualizar preselección' });
  }
});

// PUT /api/preselections/:id/decision - Cambiar decisión (SI/NO)
router.put('/:id/decision', canViewPreselections, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body; // 'SI' o 'NO'
    const { userId } = req.user;
    
    if (!['SI', 'NO'].includes(decision)) {
      return res.status(400).json({ error: 'Decisión debe ser SI o NO' });
    }
    
    // Obtener la preselección
    const preselection = await pool.query(
      'SELECT * FROM preselections WHERE id = $1',
      [id]
    );
    
    if (preselection.rows.length === 0) {
      return res.status(404).json({ error: 'Preselección no encontrada' });
    }
    
    const presel = preselection.rows[0];
    const previousDecision = presel.decision;
    
    // CASO 1: Reversión de SI a NO (eliminar subasta creada)
    if (previousDecision === 'SI' && decision === 'NO') {
      console.log('🔄 Reversión: Cambiando de SI a NO - Eliminando subasta creada');
      
      // Eliminar la subasta asociada si existe
      if (presel.auction_id) {
        await pool.query('DELETE FROM auctions WHERE id = $1', [presel.auction_id]);
        console.log('✅ Subasta eliminada:', presel.auction_id);
      }
      
      // Actualizar preselección
      await pool.query(
        `UPDATE preselections 
         SET decision = $1, transferred_to_auction = FALSE, auction_id = NULL, transferred_at = NULL
         WHERE id = $2`,
        ['NO', id]
      );
      
      res.json({
        preselection: (await pool.query('SELECT * FROM preselections WHERE id = $1', [id])).rows[0],
        message: 'Preselección revertida a NO y subasta eliminada exitosamente'
      });
      return;
    }
    
    // CASO 2: Cambio de NO a SI o PENDIENTE a SI (crear subasta)
    if (decision === 'SI') {
      // Crear subasta automáticamente
      
      // 1. Crear o buscar máquina
      let machineId;
      const existingMachine = await pool.query(
        'SELECT id FROM machines WHERE serial = $1',
        [presel.serial]
      );
      
      if (existingMachine.rows.length > 0) {
        machineId = existingMachine.rows[0].id;
        // Actualizar datos de la máquina
        await pool.query(
          `UPDATE machines SET brand = $1, model = $2, year = $3, hours = $4, updated_at = NOW()
           WHERE id = $5`,
          [presel.brand, presel.model, presel.year, presel.hours, machineId]
        );
      } else {
        // Crear nueva máquina
        const newMachine = await pool.query(
          `INSERT INTO machines (brand, model, serial, year, hours)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [presel.brand, presel.model, presel.serial, presel.year, presel.hours]
        );
        machineId = newMachine.rows[0].id;
      }
      
      // 2. Crear subasta
      const newAuction = await pool.query(
        `INSERT INTO auctions (
          date, lot, machine_id, price_max, supplier_id, 
          purchase_type, status, comments, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          presel.auction_date,
          presel.lot_number,
          machineId,
          presel.suggested_price || 0,
          presel.supplier_name, // Usar supplier_name directamente
          'SUBASTA', // Siempre es subasta cuando viene de preselección
          'PENDIENTE',
          presel.comments,
          userId
        ]
      );
      
      const auctionId = newAuction.rows[0].id;
      
      // 3. Actualizar preselección
      await pool.query(
        `UPDATE preselections 
         SET decision = $1, transferred_to_auction = TRUE, auction_id = $2, transferred_at = NOW()
         WHERE id = $3`,
        ['SI', auctionId, id]
      );
      
      // 4. Devolver preselección actualizada con info de subasta
      const updated = await pool.query(
        `SELECT p.*, a.id as auction_id_generated, a.status as auction_status
         FROM preselections p
         LEFT JOIN auctions a ON p.auction_id = a.id
         WHERE p.id = $1`,
        [id]
      );
      
      res.json({
        preselection: updated.rows[0],
        message: 'Preselección aprobada y transferida a subastas exitosamente',
        auction_id: auctionId
      });
      
    } else if (decision === 'NO') {
      // CASO 3: Cambio a NO (desde PENDIENTE o desde SI)
      
      // Si venía de SI, eliminar la subasta asociada
      if (previousDecision === 'SI' && presel.auction_id) {
        console.log('🔄 Reversión adicional: Eliminando subasta al cambiar a NO');
        await pool.query('DELETE FROM auctions WHERE id = $1', [presel.auction_id]);
      }
      
      // Marcar como rechazada y limpiar relación con subasta
      const result = await pool.query(
        `UPDATE preselections 
         SET decision = $1, transferred_to_auction = FALSE, auction_id = NULL, transferred_at = NULL
         WHERE id = $2
         RETURNING *`,
        ['NO', id]
      );
      
      res.json({
        preselection: result.rows[0],
        message: previousDecision === 'SI' 
          ? 'Preselección revertida a NO y subasta eliminada' 
          : 'Preselección rechazada'
      });
    }
    
  } catch (error) {
    console.error('Error al procesar decisión:', error);
    res.status(500).json({ error: 'Error al procesar decisión', details: error.message });
  }
});

// DELETE /api/preselections/:id - Eliminar preselección
router.delete('/:id', canViewPreselections, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;
    
    // Verificar que no ha sido transferida a subasta
    const check = await pool.query(
      'SELECT transferred_to_auction FROM preselections WHERE id = $1' +
      (role === 'sebastian' ? ' AND created_by = $2' : ''),
      role === 'sebastian' ? [id, userId] : [id]
    );
    
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'No puedes eliminar esta preselección' });
    }
    
    if (check.rows[0].transferred_to_auction) {
      return res.status(400).json({ 
        error: 'No se puede eliminar una preselección que ya fue transferida a subasta' 
      });
    }
    
    await pool.query('DELETE FROM preselections WHERE id = $1', [id]);
    res.json({ message: 'Preselección eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar preselección:', error);
    res.status(500).json({ error: 'Error al eliminar preselección' });
  }
});

export default router;

