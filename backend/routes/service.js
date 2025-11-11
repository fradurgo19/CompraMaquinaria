import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewService, canEditService } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Sincroniza desde purchases (logística) a service_records
async function syncFromLogistics(userId) {
  // Insertar faltantes
  await pool.query(`
    INSERT INTO service_records (
      purchase_id, supplier_name, model, serial, shipment_departure_date, shipment_arrival_date,
      port_of_destination, nationalization_date, current_movement, current_movement_date, year, hours, condition, created_by
    )
    SELECT p.id, p.supplier_name, p.model, p.serial, p.shipment_departure_date, p.shipment_arrival_date,
           p.port_of_destination, p.nationalization_date, p.current_movement, p.current_movement_date,
           m.year, m.hours, COALESCE(p.condition, 'USADO'), $1
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE (p.nationalization_date IS NOT NULL OR p.condition = 'NUEVO')
      AND NOT EXISTS (SELECT 1 FROM service_records s WHERE s.purchase_id = p.id)
  `, [userId]);

  // Actualizar espejo (sin tocar campos propios de servicio)
  await pool.query(`
    UPDATE service_records s
    SET supplier_name = p.supplier_name,
        model = p.model,
        serial = p.serial,
        shipment_departure_date = p.shipment_departure_date,
        shipment_arrival_date = p.shipment_arrival_date,
        port_of_destination = p.port_of_destination,
        nationalization_date = p.nationalization_date,
        current_movement = p.current_movement,
        current_movement_date = p.current_movement_date,
        year = m.year,
        hours = m.hours,
        condition = COALESCE(p.condition, 'USADO'),
        updated_at = NOW()
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE s.purchase_id = p.id
      AND (p.nationalization_date IS NOT NULL OR p.condition = 'NUEVO')
  `);
}

// GET /api/service
router.get('/', canViewService, async (req, res) => {
  try {
    await syncFromLogistics(req.user.userId || req.user.id);
    const result = await pool.query(`
      SELECT 
        s.id,
        s.purchase_id,
        s.start_staging,
        s.end_staging,
        s.created_at,
        s.updated_at,
        s.created_by,
        -- 🔄 Datos de máquina obtenidos de machines (SINCRONIZACIÓN BIDIRECCIONAL)
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours,
        -- Datos de purchase
        p.machine_id,
        p.supplier_name,
        p.shipment_departure_date,
        p.shipment_arrival_date,
        p.port_of_destination,
        p.nationalization_date,
        p.mc,
        p.current_movement,
        p.current_movement_date,
        COALESCE(s.condition, p.condition, 'USADO') as condition
      FROM service_records s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      LEFT JOIN machines m ON p.machine_id = m.id
      ORDER BY s.updated_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener servicio:', error);
    res.status(500).json({ error: 'Error al obtener servicio' });
  }
});

// PUT /api/service/:id
router.put('/:id', canEditService, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_staging, end_staging } = req.body;
    const result = await pool.query(
      `UPDATE service_records
       SET start_staging = $1, end_staging = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [start_staging || null, end_staging || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    // Sincronizar fechas de alistamiento a la tabla equipments
    const serviceRecord = result.rows[0];
    if (serviceRecord.purchase_id) {
      await pool.query(
        `UPDATE equipments
         SET start_staging = $1, end_staging = $2, updated_at = NOW()
         WHERE purchase_id = $3`,
        [start_staging || null, end_staging || null, serviceRecord.purchase_id]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al actualizar servicio:', error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
});

export default router;


