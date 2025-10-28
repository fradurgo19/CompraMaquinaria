import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewEquipments, canEditEquipments, canAddEquipments } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/equipments
 * Obtener todos los equipos con datos de Logística y Consolidado
 */
router.get('/', authenticateToken, canViewEquipments, async (req, res) => {
  try {
    // Primero sincronizar: insertar purchases con nacionalization_date que no estén en equipments
    const purchasesToSync = await pool.query(`
      SELECT 
        p.id,
        p.supplier_name,
        p.model,
        p.serial,
        p.shipment_departure_date,
        p.shipment_arrival_date,
        p.port_of_destination,
        p.nationalization_date,
        p.current_movement,
        p.current_movement_date,
        m.year,
        m.hours,
        p.pvp_est,
        p.comments
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE p.nationalization_date IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM equipments e WHERE e.purchase_id = p.id
        )
      ORDER BY p.created_at DESC
    `);

    // Insertar los que no existen
    for (const purchase of purchasesToSync.rows) {
      await pool.query(`
        INSERT INTO equipments (
          purchase_id,
          supplier_name,
          model,
          serial,
          shipment_departure_date,
          shipment_arrival_date,
          port_of_destination,
          nationalization_date,
          current_movement,
          current_movement_date,
          year,
          hours,
          pvp_est,
          comments,
          state,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Disponible', $15)
      `, [
        purchase.id,
        purchase.supplier_name || '',
        purchase.model || '',
        purchase.serial || '',
        purchase.shipment_departure_date || null,
        purchase.shipment_arrival_date || null,
        purchase.port_of_destination || '',
        purchase.nationalization_date || null,
        purchase.current_movement || '',
        purchase.current_movement_date || null,
        purchase.year || null,
        purchase.hours || null,
        purchase.pvp_est || null,
        purchase.comments || '',
        req.user.id
      ]);
    }

    // Obtener todos los equipos directamente desde purchases
    const result = await pool.query(`
      SELECT 
        e.id,
        e.purchase_id,
        e.full_serial,
        e.state,
        e.machine_type,
        e.wet_line,
        e.arm_type,
        e.track_width,
        e.bucket_capacity,
        e.warranty_months,
        e.warranty_hours,
        e.engine_brand,
        e.cabin_type,
        e.commercial_observations,
        e.created_at,
        e.updated_at,
        COALESCE(e.supplier_name, p.supplier_name) as supplier_name,
        COALESCE(e.model, p.model) as model,
        COALESCE(e.serial, p.serial) as serial,
        COALESCE(e.shipment_departure_date, p.shipment_departure_date) as shipment_departure_date,
        COALESCE(e.shipment_arrival_date, p.shipment_arrival_date) as shipment_arrival_date,
        COALESCE(e.port_of_destination, p.port_of_destination) as port_of_destination,
        COALESCE(e.nationalization_date, p.nationalization_date) as nationalization_date,
        COALESCE(e.current_movement, p.current_movement) as current_movement,
        COALESCE(e.current_movement_date, p.current_movement_date) as current_movement_date,
        COALESCE(e.year, m.year) as year,
        COALESCE(e.hours, m.hours) as hours,
        COALESCE(e.pvp_est, p.pvp_est) as pvp_est,
        COALESCE(e.comments, p.comments) as comments
      FROM equipments e
      LEFT JOIN purchases p ON e.purchase_id = p.id
      LEFT JOIN machines m ON p.machine_id = m.id
      ORDER BY e.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener equipos:', error);
    res.status(500).json({ error: 'Error al obtener equipos', details: error.message });
  }
});

/**
 * PUT /api/equipments/:id
 * Actualizar equipo
 */
router.put('/:id', authenticateToken, canEditEquipments, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Definir campos permitidos y sus validaciones
    const allowedFields = {
      full_serial: 'NUMERIC',
      state: 'TEXT',
      machine_type: 'TEXT',
      wet_line: 'TEXT',
      arm_type: 'TEXT',
      track_width: 'NUMERIC',
      bucket_capacity: 'NUMERIC',
      warranty_months: 'INTEGER',
      warranty_hours: 'INTEGER',
      engine_brand: 'TEXT',
      cabin_type: 'TEXT',
      commercial_observations: 'TEXT'
    };

    // Construir query dinámico
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.hasOwnProperty(key) && value !== undefined && value !== null) {
        // Validar que el campo existe en la tabla
        const fieldName = key;
        fields.push(`${fieldName} = $${paramIndex}`);
        
        // Convertir el valor según el tipo esperado
        let processedValue = value;
        if (allowedFields[key] === 'NUMERIC' || allowedFields[key] === 'INTEGER') {
          // Si ya es número, mantenerlo, si es string vacío o no numérico, usar null
          if (value === '' || value === null || value === undefined) {
            processedValue = null;
          } else {
            processedValue = Number(value);
            // Validar que sea un número válido
            if (isNaN(processedValue)) {
              processedValue = null;
            }
          }
        } else if (allowedFields[key] === 'TEXT') {
          processedValue = value === '' ? null : String(value);
          
          // Normalizar valores de wet_line a mayúsculas para cumplir el CHECK constraint
          if (key === 'wet_line') {
            processedValue = processedValue === null ? null : processedValue.toUpperCase() === 'SI' ? 'SI' : (processedValue.toUpperCase() === 'NO' ? 'No' : processedValue);
          }
        }
        
        console.log(`🔄 Campo: ${key}, Valor original: ${value}, Procesado: ${processedValue}, Tipo: ${typeof processedValue}`);
        
        values.push(processedValue);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE equipments 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    console.log('📝 Query:', query);
    console.log('📝 Values:', values);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al actualizar equipo:', error);
    res.status(500).json({ error: 'Error al actualizar equipo', details: error.message });
  }
});

/**
 * POST /api/equipments
 * Crear nuevo equipo (solo jefe_comercial)
 */
router.post('/', authenticateToken, canAddEquipments, async (req, res) => {
  try {
    const {
      purchase_id,
      full_serial,
      state,
      machine_type,
      wet_line,
      arm_type,
      track_width,
      bucket_capacity,
      warranty_months,
      warranty_hours,
      engine_brand,
      cabin_type
    } = req.body;

    if (!purchase_id) {
      return res.status(400).json({ error: 'purchase_id es requerido' });
    }

    // Obtener datos del purchase
    const purchaseResult = await pool.query('SELECT * FROM purchases WHERE id = $1', [purchase_id]);

    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const purchase = purchaseResult.rows[0];

    // Insertar nuevo equipo
    const result = await pool.query(`
      INSERT INTO equipments (
        purchase_id,
        supplier_name,
        model,
        serial,
        shipment_departure_date,
        shipment_arrival_date,
        port_of_destination,
        nationalization_date,
        current_movement,
        current_movement_date,
        year,
        hours,
        pvp_est,
        comments,
        full_serial,
        state,
        machine_type,
        wet_line,
        arm_type,
        track_width,
        bucket_capacity,
        warranty_months,
        warranty_hours,
        engine_brand,
        cabin_type,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *
    `, [
      purchase_id,
      purchase.supplier_name,
      purchase.model,
      purchase.serial,
      purchase.shipment_departure_date,
      purchase.shipment_arrival_date,
      purchase.port_of_destination,
      purchase.nationalization_date,
      purchase.current_movement,
      purchase.current_movement_date,
      purchase.year,
      purchase.hours,
      purchase.pvp_est,
      purchase.comments,
      full_serial,
      state || 'Disponible',
      machine_type,
      wet_line,
      arm_type,
      track_width,
      bucket_capacity,
      warranty_months,
      warranty_hours,
      engine_brand,
      cabin_type,
      req.user.id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al crear equipo:', error);
    res.status(500).json({ error: 'Error al crear equipo', details: error.message });
  }
});

export default router;

