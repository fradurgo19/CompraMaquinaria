import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewService, canEditService } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Sincroniza desde purchases (logística) a service_records
async function syncFromLogistics(userId) {
  // Insertar faltantes desde purchases - TODOS los registros sin restricciones
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
    WHERE NOT EXISTS (SELECT 1 FROM service_records s WHERE s.purchase_id = p.id)
  `, [userId]);

  // Insertar faltantes desde new_purchases
  await pool.query(`
    INSERT INTO service_records (
      new_purchase_id, supplier_name, model, serial, shipment_departure_date, shipment_arrival_date,
      port_of_destination, nationalization_date, current_movement, current_movement_date, condition, created_by
    )
    SELECT np.id, np.supplier_name, np.model, np.serial, np.shipment_departure_date, np.shipment_arrival_date,
           np.port_of_loading, NULL, np.machine_location, NULL,
           COALESCE(np.condition, 'NUEVO'), $1
    FROM new_purchases np
    WHERE NOT EXISTS (SELECT 1 FROM service_records s WHERE s.new_purchase_id = np.id)
  `, [userId]);

  // Actualizar espejo desde purchases (sin tocar campos propios de servicio)
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
  `);

  // Actualizar espejo desde new_purchases (sin tocar campos propios de servicio)
  await pool.query(`
    UPDATE service_records s
    SET supplier_name = np.supplier_name,
        model = np.model,
        serial = np.serial,
        shipment_departure_date = np.shipment_departure_date,
        shipment_arrival_date = np.shipment_arrival_date,
        port_of_destination = np.port_of_loading,
        current_movement = np.machine_location,
        condition = COALESCE(np.condition, 'NUEVO'),
        updated_at = NOW()
    FROM new_purchases np
    WHERE s.new_purchase_id = np.id
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
        s.new_purchase_id,
        s.start_staging,
        s.end_staging,
        s.service_value,
        s.staging_type,
        s.created_at,
        s.updated_at,
        s.created_by,
        -- 🔄 Datos de máquina obtenidos de machines (SINCRONIZACIÓN BIDIRECCIONAL)
        -- Para purchases: desde machines, para new_purchases: desde new_purchases directamente
        COALESCE(m.brand, np.brand) as brand,
        COALESCE(m.model, np.model, s.model) as model,
        COALESCE(m.serial, np.serial, s.serial) as serial,
        m.year,
        m.hours,
        -- Datos de purchase o new_purchase
        p.machine_id,
        COALESCE(p.supplier_name, np.supplier_name, s.supplier_name) as supplier_name,
        COALESCE(p.shipment_departure_date, np.shipment_departure_date, s.shipment_departure_date) as shipment_departure_date,
        COALESCE(p.shipment_arrival_date, np.shipment_arrival_date, s.shipment_arrival_date) as shipment_arrival_date,
        COALESCE(p.port_of_destination, np.port_of_loading, s.port_of_destination) as port_of_destination,
        COALESCE(p.nationalization_date, NULL) as nationalization_date,
        COALESCE(p.mc, np.mc) as mc,
        COALESCE(p.current_movement, np.machine_location, s.current_movement) as current_movement,
        COALESCE(p.current_movement_date, NULL) as current_movement_date,
        p.repuestos,
        COALESCE(s.condition, p.condition, np.condition, 'USADO') as condition
      FROM service_records s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      LEFT JOIN new_purchases np ON s.new_purchase_id = np.id
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
    const { start_staging, end_staging, service_value, staging_type } = req.body;
    const result = await pool.query(
      `UPDATE service_records
       SET start_staging = $1, end_staging = $2, service_value = $3, staging_type = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [start_staging || null, end_staging || null, service_value || 0, staging_type || null, id]
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
    } else if (serviceRecord.new_purchase_id) {
      await pool.query(
        `UPDATE equipments
         SET start_staging = $1, end_staging = $2, updated_at = NOW()
         WHERE new_purchase_id = $3`,
        [start_staging || null, end_staging || null, serviceRecord.new_purchase_id]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al actualizar servicio:', error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
});

export default router;


