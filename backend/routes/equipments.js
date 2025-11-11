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
          mc,
          condition,
          state,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'Disponible', $17)
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
        purchase.mc || null,
        purchase.condition || 'USADO',
        req.user.id
      ]);
    }

    // Sincronizar fechas de alistamiento desde service_records a equipments
    await pool.query(`
      UPDATE equipments e
      SET start_staging = sr.start_staging,
          end_staging = sr.end_staging,
          updated_at = NOW()
      FROM service_records sr
      WHERE e.purchase_id = sr.purchase_id
        AND (e.start_staging IS DISTINCT FROM sr.start_staging OR e.end_staging IS DISTINCT FROM sr.end_staging)
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
        e.created_at,
        e.updated_at,
        COALESCE(e.supplier_name, p.supplier_name, np.supplier_name) as supplier_name,
        COALESCE(e.model, p.model, np.model) as model,
        COALESCE(e.serial, p.serial, np.serial) as serial,
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
        COALESCE(e.condition, p.condition, np.condition, 'USADO') as condition
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

export default router;

