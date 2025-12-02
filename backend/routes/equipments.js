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
    // Primero sincronizar: insertar TODOS los purchases que no estén en equipments
    // Sin restricción de nacionalización para que Comercial vea todos los equipos
    const purchasesToSync = await pool.query(`
      SELECT 
        p.id,
        p.mq,
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
        p.comments,
        p.mc,
        COALESCE(p.condition, 'USADO') as condition
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE NOT EXISTS (
          SELECT 1 FROM equipments e WHERE e.purchase_id = p.id
        )
        AND (p.mq IS NULL OR NOT EXISTS (
          SELECT 1 FROM equipments e WHERE e.mq = p.mq
        ))
      ORDER BY p.created_at DESC
    `);

    // Insertar los que no existen
    for (const purchase of purchasesToSync.rows) {
      await pool.query(`
        INSERT INTO equipments (
          purchase_id,
          mq,
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
          condition,
          state,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'Disponible', $17)
      `, [
        purchase.id,
        purchase.mq || null,
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
        purchase.condition || 'USADO',
        req.user.id
      ]);
    }

    // Sincronizar fechas de alistamiento y tipo desde service_records a equipments
    await pool.query(`
      UPDATE equipments e
      SET start_staging = sr.start_staging,
          end_staging = sr.end_staging,
          staging_type = sr.staging_type,
          updated_at = NOW()
      FROM service_records sr
      WHERE e.purchase_id = sr.purchase_id
        AND (e.start_staging IS DISTINCT FROM sr.start_staging 
             OR e.end_staging IS DISTINCT FROM sr.end_staging
             OR e.staging_type IS DISTINCT FROM sr.staging_type)
    `);

    // Sincronizar campos críticos desde purchases a equipments
    await pool.query(`
      UPDATE equipments e
      SET mq = p.mq,
          current_movement = p.current_movement,
          current_movement_date = p.current_movement_date,
          port_of_destination = p.port_of_destination,
          updated_at = NOW()
      FROM purchases p
      WHERE e.purchase_id = p.id
        AND (
          e.mq IS DISTINCT FROM p.mq OR
          e.current_movement IS DISTINCT FROM p.current_movement OR
          e.current_movement_date IS DISTINCT FROM p.current_movement_date OR
          e.port_of_destination IS DISTINCT FROM p.port_of_destination
        )
    `);

    // Obtener todos los equipos directamente desde purchases y new_purchases
    const result = await pool.query(`
      SELECT 
        e.id,
        e.purchase_id,
        e.new_purchase_id,
        p.machine_id,
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
        e.blade,
        e.real_sale_price,
        e.commercial_observations,
        e.start_staging,
        e.end_staging,
        e.staging_type,
        e.created_at,
        e.updated_at,
        COALESCE(e.reservation_status, 'AVAILABLE') as reservation_status,
        COALESCE(e.supplier_name, p.supplier_name, np.supplier_name) as supplier_name,
        COALESCE(e.model, m.model, np.model) as model,
        COALESCE(e.serial, m.serial, np.serial) as serial,
        COALESCE(e.shipment_departure_date, p.shipment_departure_date, np.shipment_departure_date) as shipment_departure_date,
        COALESCE(e.shipment_arrival_date, p.shipment_arrival_date, np.shipment_arrival_date) as shipment_arrival_date,
        COALESCE(e.port_of_destination, p.port_of_destination, np.port_of_loading) as port_of_destination,
        COALESCE(e.nationalization_date, p.nationalization_date) as nationalization_date,
        COALESCE(e.current_movement, p.current_movement) as current_movement,
        COALESCE(e.current_movement_date, p.current_movement_date) as current_movement_date,
        COALESCE(e.year, m.year) as year,
        COALESCE(e.hours, m.hours) as hours,
        p.invoice_date,
        COALESCE(e.mq, p.mq, np.mq) as mq,
        COALESCE(p.mc, np.mc) as mc,
        COALESCE(m.brand, np.brand) as brand,
        COALESCE(e.pvp_est, p.pvp_est, np.value) as pvp_est,
        COALESCE(e.comments, p.comments) as comments,
        COALESCE(e.condition, p.condition, np.condition, 'USADO') as condition,
        (SELECT COUNT(*) FROM equipment_reservations er WHERE er.equipment_id = e.id AND er.status = 'PENDING') as pending_reservations_count
      FROM equipments e
      LEFT JOIN purchases p ON e.purchase_id = p.id
      LEFT JOIN new_purchases np ON e.new_purchase_id = np.id
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
      blade: 'TEXT',
      real_sale_price: 'NUMERIC',
      commercial_observations: 'TEXT',
      staging_type: 'TEXT'
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

    // Sincronizar las especificaciones con la tabla machines si existe
    const equipment = result.rows[0];
    
    // Obtener el machine_id asociado al purchase_id del equipo
    const machineResult = await pool.query(`
      SELECT m.id 
      FROM machines m
      INNER JOIN purchases p ON p.machine_id = m.id
      WHERE p.id = $1
    `, [equipment.purchase_id]);

    if (machineResult.rows.length > 0) {
      const machineId = machineResult.rows[0].id;
      
      // Preparar los campos de especificaciones para actualizar en machines
      const machineFields = [];
      const machineValues = [];
      let machineParamIndex = 1;

      const specsToSync = ['machine_type', 'wet_line', 'arm_type', 'track_width', 'bucket_capacity', 
                          'warranty_months', 'warranty_hours', 'engine_brand', 'cabin_type', 'blade'];

      for (const field of specsToSync) {
        if (updates.hasOwnProperty(field) && updates[field] !== undefined) {
          machineFields.push(`${field} = $${machineParamIndex}`);
          machineValues.push(updates[field] === '' ? null : updates[field]);
          machineParamIndex++;
        }
      }

      if (machineFields.length > 0) {
        machineFields.push(`updated_at = NOW()`);
        machineValues.push(machineId);

        const updateMachineQuery = `
          UPDATE machines 
          SET ${machineFields.join(', ')} 
          WHERE id = $${machineParamIndex}
        `;

        await pool.query(updateMachineQuery, machineValues);
        console.log(`✅ Especificaciones sincronizadas con machines (ID: ${machineId})`);
      }
    }

    // Sincronizar staging_type con service_records (bidireccional)
    if (updates.staging_type !== undefined && equipment.purchase_id) {
      await pool.query(`
        UPDATE service_records 
        SET staging_type = $1, updated_at = NOW()
        WHERE purchase_id = $2
      `, [updates.staging_type || null, equipment.purchase_id]);
      console.log(`✅ staging_type sincronizado con service_records`);
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
      cabin_type,
      blade
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
          blade,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
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
      blade,
      req.user.id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al crear equipo:', error);
    res.status(500).json({ error: 'Error al crear equipo', details: error.message });
  }
});

/**
 * POST /api/equipments/sync-specs
 * Sincronizar todas las especificaciones de equipments a machines (admin only)
 */
router.post('/sync-specs', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado. Solo el administrador puede ejecutar esta acción.' });
    }

    // Obtener todos los equipments con especificaciones
    const equipmentsResult = await pool.query(`
      SELECT 
        e.id as equipment_id,
        e.purchase_id,
        e.machine_type,
        e.wet_line,
        e.arm_type,
        e.track_width,
        e.bucket_capacity,
        e.warranty_months,
        e.warranty_hours,
        e.engine_brand,
        e.cabin_type,
        e.blade,
        p.machine_id
      FROM equipments e
      INNER JOIN purchases p ON e.purchase_id = p.id
      WHERE p.machine_id IS NOT NULL
    `);

    let syncedCount = 0;
    let errorCount = 0;

    for (const equipment of equipmentsResult.rows) {
      if (!equipment.machine_id) continue;

      try {
        // Actualizar machines con los valores de equipments (sobrescribir)
        const updateResult = await pool.query(`
          UPDATE machines 
          SET 
            machine_type = $1,
            wet_line = $2,
            arm_type = $3,
            track_width = $4,
            bucket_capacity = $5,
            warranty_months = $6,
            warranty_hours = $7,
            engine_brand = $8,
            cabin_type = $9,
            blade = $10,
            updated_at = NOW()
          WHERE id = $11
          RETURNING id
        `, [
          equipment.machine_type,
          equipment.wet_line,
          equipment.arm_type,
          equipment.track_width,
          equipment.bucket_capacity,
          equipment.warranty_months,
          equipment.warranty_hours,
          equipment.engine_brand,
          equipment.cabin_type,
          equipment.blade,
          equipment.machine_id
        ]);

        if (updateResult.rows.length > 0) {
          console.log(`✅ Machine ${equipment.machine_id} sincronizada con especificaciones de Equipment ${equipment.equipment_id}`);
          syncedCount++;
        }
      } catch (err) {
        console.error(`❌ Error sincronizando equipment ${equipment.equipment_id}:`, err.message);
        errorCount++;
      }
    }

    res.json({
      message: 'Sincronización completada',
      synced: syncedCount,
      errors: errorCount,
      total: equipmentsResult.rows.length
    });
  } catch (error) {
    console.error('❌ Error en sincronización masiva:', error);
    res.status(500).json({ error: 'Error en sincronización', details: error.message });
  }
});

/**
 * POST /api/equipments/:id/reserve
 * Crear reserva de equipo (solo comerciales)
 */
router.post('/:id/reserve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { documents, comments } = req.body;
    const { userId, role } = req.user;

    // Verificar que el usuario es comercial
    if (role !== 'comerciales') {
      return res.status(403).json({ error: 'Solo usuarios comerciales pueden reservar equipos' });
    }

    // Verificar que el equipo existe
    const equipmentResult = await pool.query('SELECT id, reservation_status FROM equipments WHERE id = $1', [id]);
    if (equipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const equipment = equipmentResult.rows[0];

    // Verificar que el equipo esté disponible
    if (equipment.reservation_status === 'RESERVED') {
      return res.status(400).json({ error: 'El equipo ya está reservado' });
    }

    // Crear la reserva
    const reservationResult = await pool.query(`
      INSERT INTO equipment_reservations (
        equipment_id,
        commercial_user_id,
        status,
        documents,
        comments
      ) VALUES ($1, $2, 'PENDING', $3, $4)
      RETURNING *
    `, [id, userId, JSON.stringify(documents || []), comments || null]);

    const reservation = reservationResult.rows[0];

    // Crear notificación para el jefe comercial
    const jefeComercialResult = await pool.query(
      `SELECT id FROM users_profile WHERE role = 'jefe_comercial' LIMIT 1`
    );

    if (jefeComercialResult.rows.length > 0) {
      const jefeComercialId = jefeComercialResult.rows[0].id;
      await pool.query(`
        INSERT INTO notifications (
          user_id,
          title,
          message,
          type,
          reference_id,
          created_at
        ) VALUES ($1, $2, $3, 'equipment_reservation', $4, NOW())
      `, [
        jefeComercialId,
        'Nueva solicitud de reserva de equipo',
        `Se ha recibido una nueva solicitud de reserva de equipo (ID: ${id})`,
        reservation.id
      ]);
    }

    res.status(201).json(reservation);
  } catch (error) {
    console.error('❌ Error al crear reserva:', error);
    res.status(500).json({ error: 'Error al crear reserva', details: error.message });
  }
});

/**
 * GET /api/equipments/:id/reservations
 * Obtener reservas de un equipo
 */
/**
 * GET /api/equipments/:id/reservations
 * Obtener todas las reservas de un equipo
 */
router.get('/:id/reservations', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        er.*,
        up.full_name as commercial_name,
        up.email as commercial_email,
        approver.full_name as approver_name,
        rejector.full_name as rejector_name
      FROM equipment_reservations er
      LEFT JOIN users_profile up ON er.commercial_user_id = up.id
      LEFT JOIN users_profile approver ON er.approved_by = approver.id
      LEFT JOIN users_profile rejector ON er.rejected_by = rejector.id
      WHERE er.equipment_id = $1
      ORDER BY er.created_at DESC
    `, [id]);

    // Parsear documentos desde JSONB
    const reservations = result.rows.map(row => ({
      ...row,
      documents: typeof row.documents === 'string' ? JSON.parse(row.documents) : (row.documents || [])
    }));

    res.json(reservations);
  } catch (error) {
    console.error('❌ Error al obtener reservas:', error);
    res.status(500).json({ error: 'Error al obtener reservas', details: error.message });
  }
});

/**
 * PUT /api/equipments/reservations/:id/approve
 * Aprobar reserva (solo jefe_comercial)
 */
router.put('/reservations/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;

    if (role !== 'jefe_comercial' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo el jefe comercial puede aprobar reservas' });
    }

    // Obtener la reserva
    const reservationResult = await pool.query(`
      SELECT er.*, e.id as equipment_id
      FROM equipment_reservations er
      INNER JOIN equipments e ON er.equipment_id = e.id
      WHERE er.id = $1 AND er.status = 'PENDING'
    `, [id]);

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada o ya procesada' });
    }

    const reservation = reservationResult.rows[0];

    // Actualizar la reserva
    await pool.query(`
      UPDATE equipment_reservations
      SET status = 'APPROVED',
          approved_by = $1,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
    `, [userId, id]);

    // Actualizar el estado del equipo
    await pool.query(`
      UPDATE equipments
      SET reservation_status = 'RESERVED',
          updated_at = NOW()
      WHERE id = $1
    `, [reservation.equipment_id]);

    // Crear notificación para el comercial
    await pool.query(`
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        reference_id,
        created_at
      ) VALUES ($1, $2, $3, 'equipment_reservation_approved', $4, NOW())
    `, [
      reservation.commercial_user_id,
      'Reserva de equipo aprobada',
      `Tu solicitud de reserva de equipo ha sido aprobada`,
      reservation.id
    ]);

    res.json({ message: 'Reserva aprobada exitosamente' });
  } catch (error) {
    console.error('❌ Error al aprobar reserva:', error);
    res.status(500).json({ error: 'Error al aprobar reserva', details: error.message });
  }
});

/**
 * PUT /api/equipments/reservations/:id/reject
 * Rechazar reserva (solo jefe_comercial)
 */
router.put('/reservations/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const { role, userId } = req.user;

    if (role !== 'jefe_comercial' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo el jefe comercial puede rechazar reservas' });
    }

    // Obtener la reserva
    const reservationResult = await pool.query(`
      SELECT er.*, e.id as equipment_id
      FROM equipment_reservations er
      INNER JOIN equipments e ON er.equipment_id = e.id
      WHERE er.id = $1 AND er.status = 'PENDING'
    `, [id]);

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada o ya procesada' });
    }

    const reservation = reservationResult.rows[0];

    // Actualizar la reserva
    await pool.query(`
      UPDATE equipment_reservations
      SET status = 'REJECTED',
          rejected_by = $1,
          rejected_at = NOW(),
          rejection_reason = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [userId, rejection_reason || null, id]);

    // El equipo vuelve a estar disponible (solo si estaba reservado por esta reserva)
    // Nota: Si hay otras reservas pendientes, el estado se mantiene
    await pool.query(`
      UPDATE equipments
      SET reservation_status = 'AVAILABLE',
          updated_at = NOW()
      WHERE id = $1
        AND NOT EXISTS (
          SELECT 1 FROM equipment_reservations 
          WHERE equipment_id = $1 
            AND status = 'APPROVED'
        )
    `, [reservation.equipment_id]);

    // Crear notificación para el comercial
    await pool.query(`
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        reference_id,
        created_at
      ) VALUES ($1, $2, $3, 'equipment_reservation_rejected', $4, NOW())
    `, [
      reservation.commercial_user_id,
      'Reserva de equipo rechazada',
      `Tu solicitud de reserva de equipo ha sido rechazada${rejection_reason ? ': ' + rejection_reason : ''}`,
      reservation.id
    ]);

    res.json({ message: 'Reserva rechazada exitosamente' });
  } catch (error) {
    console.error('❌ Error al rechazar reserva:', error);
    res.status(500).json({ error: 'Error al rechazar reserva', details: error.message });
  }
});

export default router;

