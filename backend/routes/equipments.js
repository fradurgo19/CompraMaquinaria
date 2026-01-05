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
    // Expirar reservas: si pasó 1 día después de la fecha límite y sigue en "Reservada", liberar
    await pool.query(`
      UPDATE equipments
      SET state = 'Libre',
          updated_at = NOW()
      WHERE state = 'Reservada'
        AND reservation_deadline_date IS NOT NULL
        AND NOW()::date > (reservation_deadline_date::date + INTERVAL '1 day')
    `);

    // Primero sincronizar: insertar/actualizar purchases que no estén en equipments
    // Sin restricción de nacionalización para que Comercial vea todos los equipos
    // ✅ EVITAR DUPLICADOS: Actualizar equipment existente con new_purchase_id en lugar de crear uno nuevo
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
        m.machine_type,
        p.pvp_est,
        p.comments,
        p.mc,
        COALESCE(p.condition, 'USADO') as condition,
        m.arm_type,
        m.shoe_width_mm as track_width,
        m.spec_cabin as cabin_type,
        m.spec_pip,
        m.spec_blade
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE NOT EXISTS (
          SELECT 1 FROM equipments e WHERE e.purchase_id = p.id
        )
      ORDER BY p.created_at DESC
    `);

    // Insertar o actualizar los que no existen (con especificaciones desde machines)
    for (const purchase of purchasesToSync.rows) {
      // ✅ Buscar TODOS los equipments con new_purchase_id relacionado por MQ (MQ puede repetirse)
      let existingEquipments = [];
      if (purchase.mq) {
        const equipmentCheck = await pool.query(`
          SELECT e.id, e.new_purchase_id 
          FROM equipments e
          WHERE e.new_purchase_id IS NOT NULL 
            AND EXISTS (
              SELECT 1 FROM new_purchases np 
              WHERE np.id = e.new_purchase_id AND np.mq = $1
            )
        `, [purchase.mq]);
        
        existingEquipments = equipmentCheck.rows;
      }

      if (existingEquipments.length > 0) {
        // ✅ ACTUALIZAR TODOS los equipments existentes con el mismo MQ
        for (const existingEquipment of existingEquipments) {
        // ✅ ACTUALIZAR equipment existente agregando purchase_id
        await pool.query(`
          UPDATE equipments SET
            purchase_id = $1,
            mq = COALESCE($2, mq),
            supplier_name = COALESCE(NULLIF($3, ''), supplier_name),
            model = COALESCE(NULLIF($4, ''), model),
            serial = COALESCE(NULLIF($5, ''), serial),
            shipment_departure_date = COALESCE($6, shipment_departure_date),
            shipment_arrival_date = COALESCE($7, shipment_arrival_date),
            port_of_destination = COALESCE(NULLIF($8, ''), port_of_destination),
            nationalization_date = COALESCE($9, nationalization_date),
            current_movement = COALESCE(NULLIF($10, ''), current_movement),
            current_movement_date = COALESCE($11, current_movement_date),
            year = COALESCE($12, year),
            hours = COALESCE($13, hours),
            pvp_est = COALESCE($14, pvp_est),
            comments = COALESCE(NULLIF($15, ''), comments),
            condition = COALESCE($16, condition),
            machine_type = COALESCE($17, machine_type),
            arm_type = COALESCE($18, arm_type),
            track_width = COALESCE($19, track_width),
            cabin_type = COALESCE($20, cabin_type),
            wet_line = COALESCE($21, wet_line),
            blade = COALESCE($22, blade),
            updated_at = NOW()
          WHERE id = $23
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
          purchase.machine_type || null,
          purchase.arm_type || null,
          purchase.track_width || null,
          purchase.cabin_type || null,
          purchase.spec_pip ? 'SI' : 'No',
          purchase.spec_blade ? 'SI' : 'No',
          existingEquipment.id
        ]);
          console.log(`✅ Equipment existente actualizado con purchase_id (ID: ${existingEquipment.id}, MQ: ${purchase.mq})`);
        }
      } else {
        // Crear uno nuevo solo si no existe ninguno relacionado
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
          machine_type,
            state,
            arm_type,
            track_width,
            cabin_type,
            wet_line,
            blade,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'Libre', $18, $19, $20, $21, $22, $23)
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
          purchase.machine_type || null,
          purchase.arm_type || null,
          purchase.track_width || null,
          purchase.cabin_type || null,
          purchase.spec_pip ? 'SI' : 'No',
          purchase.spec_blade ? 'SI' : 'No',
          req.user.id
        ]);
        console.log(`✅ Equipment nuevo creado para purchase_id: ${purchase.id}`);
      }
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
          nationalization_date = p.nationalization_date,
          updated_at = NOW()
      FROM purchases p
      WHERE e.purchase_id = p.id
        AND (
          e.mq IS DISTINCT FROM p.mq OR
          e.current_movement IS DISTINCT FROM p.current_movement OR
          e.current_movement_date IS DISTINCT FROM p.current_movement_date OR
          e.port_of_destination IS DISTINCT FROM p.port_of_destination OR
          e.nationalization_date IS DISTINCT FROM p.nationalization_date
        )
    `);

    // ✅ Sincronizar campos críticos desde new_purchases a equipments
    await pool.query(`
      UPDATE equipments e
      SET supplier_name = np.supplier_name,
          model = np.model,
          serial = np.serial,
          shipment_departure_date = np.shipment_departure_date,
          shipment_arrival_date = np.shipment_arrival_date,
          port_of_destination = np.port_of_loading,
          nationalization_date = np.nationalization_date,
          year = COALESCE(np.year, e.year),
          condition = COALESCE(np.condition, e.condition),
          machine_type = COALESCE(np.machine_type, e.machine_type),
          updated_at = NOW()
      FROM new_purchases np
      WHERE e.new_purchase_id = np.id
        AND (
          e.supplier_name IS DISTINCT FROM np.supplier_name OR
          e.model IS DISTINCT FROM np.model OR
          e.serial IS DISTINCT FROM np.serial OR
          e.shipment_departure_date IS DISTINCT FROM np.shipment_departure_date OR
          e.shipment_arrival_date IS DISTINCT FROM np.shipment_arrival_date OR
          e.port_of_destination IS DISTINCT FROM np.port_of_loading OR
          e.nationalization_date IS DISTINCT FROM np.nationalization_date OR
          e.year IS DISTINCT FROM COALESCE(np.year, e.year) OR
          e.condition IS DISTINCT FROM COALESCE(np.condition, e.condition) OR
          e.machine_type IS DISTINCT FROM np.machine_type
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
        COALESCE(e.machine_type, m.machine_type, np.machine_type) as machine_type,
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
        e.reservation_deadline_date,
        e.created_at,
        e.updated_at,
        COALESCE(e.supplier_name, p.supplier_name, np.supplier_name) as supplier_name,
        COALESCE(e.model, m.model, np.model) as model,
        COALESCE(e.serial, m.serial, np.serial) as serial,
        COALESCE(e.shipment_departure_date, p.shipment_departure_date, np.shipment_departure_date) as shipment_departure_date,
        COALESCE(e.shipment_arrival_date, p.shipment_arrival_date, np.shipment_arrival_date) as shipment_arrival_date,
        COALESCE(e.port_of_destination, p.port_of_destination, np.port_of_loading) as port_of_destination,
        COALESCE(e.nationalization_date, p.nationalization_date, np.nationalization_date) as nationalization_date,
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
        -- Especificaciones técnicas desde machines (para popover SPEC)
        m.shoe_width_mm,
        m.spec_pip,
        m.spec_blade,
        m.spec_cabin,
        COALESCE(e.spec_pad, m.spec_pad) as spec_pad,
        m.arm_type as machine_arm_type,
        -- También desde new_purchases (para equipos nuevos)
        np.cabin_type as np_cabin_type,
        np.wet_line as np_wet_line,
        np.dozer_blade as np_dozer_blade,
        np.track_type as np_track_type,
        np.track_width as np_track_width,
        np.arm_type as np_arm_type,
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

    // Obtener el rol del usuario
    const userRole = req.user?.role;

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
      staging_type: 'TEXT',
      reservation_deadline_date: 'DATE',
      pvp_est: 'NUMERIC'
    };

    // Campos que solo pueden ser editados por jefe_comercial o admin
    const restrictedFields = ['pvp_est'];

    // Construir query dinámico
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.hasOwnProperty(key) && value !== undefined && value !== null) {
        // Validar permisos para campos restringidos
        if (restrictedFields.includes(key) && userRole !== 'jefe_comercial' && userRole !== 'admin') {
          return res.status(403).json({ 
            error: `No tienes permisos para editar el campo ${key}. Solo el jefe comercial puede modificar este campo.` 
          });
        }
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
        } else if (allowedFields[key] === 'DATE') {
          // Para campos de fecha, aceptar string en formato YYYY-MM-DD o null
          processedValue = value === '' || value === null || value === undefined ? null : String(value);
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

// PUT /api/equipments/:id/machine - Actualizar especificaciones técnicas en machines desde equipos
router.put('/:id/machine', authenticateToken, canEditEquipments, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Obtener purchase_id o new_purchase_id del equipo
    const equipmentCheck = await pool.query(
      'SELECT purchase_id, new_purchase_id FROM equipments WHERE id = $1',
      [id]
    );
    
    if (equipmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    
    const equipment = equipmentCheck.rows[0];
    let machineId = null;
    
    // Si tiene purchase_id, obtener machine_id desde purchases
    if (equipment.purchase_id) {
      const purchaseCheck = await pool.query(
        'SELECT machine_id FROM purchases WHERE id = $1',
        [equipment.purchase_id]
      );
      if (purchaseCheck.rows.length > 0) {
        machineId = purchaseCheck.rows[0].machine_id;
      }
    }
    
    // Si no tiene machine_id, no podemos actualizar (equipos de new_purchases sin machine_id)
    if (!machineId) {
      return res.status(400).json({ 
        error: 'Este equipo no tiene una máquina asociada. Las especificaciones se guardan en new_purchases.' 
      });
    }
    
    // Construir query de actualización para machines
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    
    await pool.query(
      `UPDATE machines SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1}`,
      [...values, machineId]
    );
    
    // También actualizar en equipments para mantener sincronización
    await pool.query(
      `UPDATE equipments 
       SET arm_type = COALESCE($1, arm_type),
           track_width = COALESCE($2, track_width),
           cabin_type = COALESCE($3, cabin_type),
           wet_line = CASE WHEN $4 IS TRUE THEN 'SI' WHEN $4 IS FALSE THEN 'No' ELSE wet_line END,
           blade = CASE WHEN $5 IS TRUE THEN 'SI' WHEN $5 IS FALSE THEN 'No' ELSE blade END,
           spec_pad = COALESCE($6, spec_pad),
           updated_at = NOW()
       WHERE id = $7`,
      [
        updates.arm_type || null,
        updates.shoe_width_mm || null,
        updates.spec_cabin || null,
        updates.spec_pip !== undefined ? updates.spec_pip : null,
        updates.spec_blade !== undefined ? updates.spec_blade : null,
        updates.spec_pad || null,
        id
      ]
    );
    
    res.json({ success: true, message: 'Especificaciones actualizadas correctamente' });
  } catch (error) {
    console.error('❌ Error actualizando especificaciones de máquina:', error);
    res.status(500).json({ error: 'Error al actualizar especificaciones', details: error.message });
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
      state || 'Libre',
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

    // Verificar que el equipo existe y obtener datos para la notificación
    const equipmentResult = await pool.query('SELECT id, state, serial, model FROM equipments WHERE id = $1', [id]);
    if (equipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const equipment = equipmentResult.rows[0];

    // Verificar que el equipo esté disponible
    if (equipment.state === 'Reservada') {
      return res.status(400).json({ error: 'El equipo ya está reservado' });
    }

    // Validar que el comercial no tenga ya una reserva pendiente para este equipo
    const pendingCheck = await pool.query(
      `SELECT id FROM equipment_reservations 
       WHERE equipment_id = $1 
         AND commercial_user_id = $2 
         AND status = 'PENDING'
       LIMIT 1`,
      [id, userId]
    );

    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Ya tienes una solicitud de reserva pendiente para este equipo. Espera la respuesta del jefe comercial antes de crear otra.' });
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
      const notificationMessage = `Se ha recibido una nueva solicitud de reserva de equipo (Serie: ${equipment.serial || 'N/A'} - Modelo: ${equipment.model || 'N/A'})`;
      const metadata = {
        equipment_id: id,
        reservation_id: reservation.id,
        serial: equipment.serial,
        model: equipment.model
      };
      const actionUrl = `/equipments?reservationEquipmentId=${encodeURIComponent(id)}&serial=${encodeURIComponent(equipment.serial || '')}&model=${encodeURIComponent(equipment.model || '')}`;

      await pool.query(`
        INSERT INTO notifications (
          user_id,
          module_source,
          module_target,
          type,
          priority,
          title,
          message,
          reference_id,
          metadata,
          action_type,
          action_url,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, [
        jefeComercialId,
        'equipments',
        'equipments',
        'warning',
        2,
        'Nueva solicitud de reserva de equipo',
        notificationMessage,
        reservation.id,
        JSON.stringify(metadata),
        'view_equipment_reservation',
        actionUrl
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Obtener la reserva seleccionada
      const reservationResult = await client.query(`
        SELECT er.*, e.id as equipment_id, e.serial, e.model
        FROM equipment_reservations er
        INNER JOIN equipments e ON er.equipment_id = e.id
        WHERE er.id = $1 AND er.status = 'PENDING'
        FOR UPDATE
      `, [id]);

      if (reservationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reserva no encontrada o ya procesada' });
      }

      const reservation = reservationResult.rows[0];

      // Obtener otras reservas pendientes del mismo equipo
      const otherPendingResult = await client.query(
        `SELECT id, commercial_user_id FROM equipment_reservations WHERE equipment_id = $1 AND status = 'PENDING' AND id <> $2 FOR UPDATE`,
        [reservation.equipment_id, id]
      );
      const otherPending = otherPendingResult.rows;

      // Aprobar la reserva seleccionada
      await client.query(`
        UPDATE equipment_reservations
        SET status = 'APPROVED',
            approved_by = $1,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `, [userId, id]);

      // Rechazar automáticamente las demás pendientes
      if (otherPending.length > 0) {
        await client.query(`
          UPDATE equipment_reservations
          SET status = 'REJECTED',
              rejected_by = $1,
              rejected_at = NOW(),
              rejection_reason = 'Aprobada otra solicitud para este equipo',
              updated_at = NOW()
          WHERE equipment_id = $2
            AND status = 'PENDING'
            AND id <> $3
        `, [userId, reservation.equipment_id, id]);
      }

      // Actualizar el estado del equipo
      await client.query(`
        UPDATE equipments
        SET state = 'Reservada',
            reservation_deadline_date = (NOW()::date + INTERVAL '20 days'),
            updated_at = NOW()
        WHERE id = $1
      `, [reservation.equipment_id]);

      const notificationMetadata = {
        equipment_id: reservation.equipment_id,
        reservation_id: reservation.id,
        serial: reservation.serial,
        model: reservation.model
      };
      const actionUrl = `/equipments?reservationEquipmentId=${encodeURIComponent(reservation.equipment_id)}&serial=${encodeURIComponent(reservation.serial || '')}&model=${encodeURIComponent(reservation.model || '')}`;

      // Notificación para el comercial aprobado
      await client.query(`
        INSERT INTO notifications (
          user_id,
          module_source,
          module_target,
          type,
          priority,
          title,
          message,
          reference_id,
          metadata,
          action_type,
          action_url,
          created_at
        ) VALUES ($1, 'equipments', 'equipments', 'success', 2, $2, $3, $4, $5, 'view_equipment_reservation', $6, NOW())
      `, [
        reservation.commercial_user_id,
        'Reserva de equipo aprobada',
        `Tu solicitud de reserva para el equipo ${reservation.model || ''} ${reservation.serial || ''} fue aprobada`,
        reservation.id,
        JSON.stringify(notificationMetadata),
        actionUrl
      ]);

      // Notificaciones para los comerciales rechazados
      for (const other of otherPending) {
        await client.query(`
          INSERT INTO notifications (
            user_id,
            module_source,
            module_target,
            type,
            priority,
            title,
            message,
            reference_id,
            metadata,
            action_type,
            action_url,
            created_at
          ) VALUES ($1, 'equipments', 'equipments', 'warning', 2, $2, $3, $4, $5, 'view_equipment_reservation', $6, NOW())
        `, [
          other.commercial_user_id,
          'Reserva de equipo rechazada',
          `Otra solicitud para el equipo ${reservation.model || ''} ${reservation.serial || ''} fue aprobada, por lo que tu reserva fue rechazada`,
          other.id,
          JSON.stringify({
            equipment_id: reservation.equipment_id,
            reservation_id: other.id,
            serial: reservation.serial,
            model: reservation.model
          }),
          actionUrl
        ]);
      }

      await client.query('COMMIT');
      res.json({ message: 'Reserva aprobada exitosamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
      SET state = 'Libre',
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

/**
 * DELETE /api/equipments/:id
 * Eliminar equipo (solo admin)
 * Mejorado para eliminar registros relacionados
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { role } = req.user;

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede eliminar equipos' });
    }

    await client.query('BEGIN');

    // Verificar que el equipo existe
    const equipmentCheck = await client.query(
      'SELECT id, purchase_id, new_purchase_id, mq, model, serial FROM equipments WHERE id = $1',
      [id]
    );

    if (equipmentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const equipment = equipmentCheck.rows[0];

    // 1. Eliminar registros dependientes de equipment
    await client.query('DELETE FROM equipment_reservations WHERE equipment_id = $1', [id]);

    // 2. Guardar purchase_id y new_purchase_id antes de continuar
    const purchaseIdToDelete = equipment.purchase_id;
    const newPurchaseIdToDelete = equipment.new_purchase_id;

    // 3. Eliminar el equipo primero
    await client.query('DELETE FROM equipments WHERE id = $1', [id]);

    // 4. Si había un purchase_id, verificar si hay otros equipments con ese purchase_id
    // Si no hay otros, eliminar el purchase (esto eliminará todos los registros relacionados)
    if (purchaseIdToDelete) {
      const otherEquipmentsCheck = await client.query(
        'SELECT COUNT(*) as count FROM equipments WHERE purchase_id = $1',
        [purchaseIdToDelete]
      );
      
      if (parseInt(otherEquipmentsCheck.rows[0].count) === 0) {
        // No hay otros equipments, eliminar el purchase y todos sus registros relacionados
        // Esto eliminará automáticamente (por CASCADE):
        // - machine_movements (si existe relación)
        // - cost_items (si existe relación)
        // - service_records (si existe relación)
        await client.query('DELETE FROM purchases WHERE id = $1', [purchaseIdToDelete]);
        console.log(`✅ Purchase ${purchaseIdToDelete} eliminado (no había otros equipments relacionados)`);
      }
    }

    // 5. Si había un new_purchase_id, verificar si hay otros equipments con ese new_purchase_id
    // Si no hay otros, eliminar el new_purchase y todos sus registros relacionados
    if (newPurchaseIdToDelete) {
      const otherEquipmentsCheck = await client.query(
        'SELECT COUNT(*) as count FROM equipments WHERE new_purchase_id = $1',
        [newPurchaseIdToDelete]
      );
      
      if (parseInt(otherEquipmentsCheck.rows[0].count) === 0) {
        // No hay otros equipments, eliminar el new_purchase y todos sus registros relacionados
        // Primero eliminar registros relacionados manualmente (no hay CASCADE configurado)
        await client.query('DELETE FROM service_records WHERE new_purchase_id = $1', [newPurchaseIdToDelete]);
        await client.query('DELETE FROM new_purchases WHERE id = $1', [newPurchaseIdToDelete]);
        console.log(`✅ New Purchase ${newPurchaseIdToDelete} eliminado (no había otros equipments relacionados)`);
      }
    }

    await client.query('COMMIT');

    console.log(`✅ Equipo eliminado: ${id} (MQ: ${equipment.mq || 'N/A'}, Model: ${equipment.model}, Serial: ${equipment.serial})`);

    res.json({ 
      message: 'Equipo eliminado exitosamente',
      deleted: {
        id: equipment.id,
        mq: equipment.mq,
        model: equipment.model,
        serial: equipment.serial
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al eliminar equipo:', error);
    res.status(500).json({ error: 'Error al eliminar equipo', details: error.message });
  } finally {
    client.release();
  }
});

export default router;

