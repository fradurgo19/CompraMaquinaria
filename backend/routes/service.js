import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewService, canEditService } from '../middleware/auth.js';

const router = express.Router();

const MSG_ERROR_FETCH_SERVICE = 'Error al obtener servicio';
const MSG_ERROR_UPDATE_SERVICE = 'Error al actualizar servicio';
const MSG_NOT_FOUND = 'Registro no encontrado';
const MSG_SYNC_EQUIPMENT_NP = 'Error sincronizando servicio a new_purchase (no crítico):';
const MSG_SYNC_SERVICE_RELATED = 'Error sincronizando servicio relacionado (no crítico):';

/**
 * Fusiona el cuerpo del PUT parcial con la fila existente (campos omitidos se conservan).
 * @param {Record<string, unknown>} existingRow
 * @param {Record<string, unknown>} body
 */
function mergeServiceUpdatePayload(existingRow, body) {
  const { start_staging, end_staging, service_value, staging_type, comentarios } = body;
  const nullIfEmpty = (v) => (v === undefined || v === null || v === '' ? null : v);

  let nextServiceValue = existingRow.service_value ?? 0;
  if (service_value !== undefined) {
    nextServiceValue =
      service_value === null || service_value === '' ? 0 : Number(service_value) || 0;
  }

  let nextComentarios = existingRow.comentarios;
  if (comentarios !== undefined) {
    nextComentarios = comentarios === null || comentarios === '' ? null : comentarios;
  }

  return {
    start_staging:
      start_staging === undefined ? existingRow.start_staging : nullIfEmpty(start_staging),
    end_staging:
      end_staging === undefined ? existingRow.end_staging : nullIfEmpty(end_staging),
    service_value: nextServiceValue,
    staging_type:
      staging_type === undefined ? existingRow.staging_type : nullIfEmpty(staging_type),
    comentarios: nextComentarios,
  };
}

/** Valores de alistamiento para sincronizar a `equipments` y queries relacionadas. */
function equipmentStagingValues(sr) {
  return [sr.start_staging, sr.end_staging, sr.staging_type];
}

/**
 * Sincroniza staging en equipments cuando el service_record tiene purchase_id.
 * @param {Record<string, unknown>} serviceRecord
 */
async function syncEquipmentStagingForPurchaseServiceRecord(serviceRecord) {
  const purchaseId = serviceRecord.purchase_id;
  const updateBoth = await pool.query(
    `UPDATE equipments
         SET start_staging = $1, end_staging = $2, staging_type = $3, updated_at = NOW()
         WHERE purchase_id = $4 AND new_purchase_id IS NOT NULL
         RETURNING id`,
    [...equipmentStagingValues(serviceRecord), purchaseId]
  );

  if (updateBoth.rows.length === 0) {
    await pool.query(
      `UPDATE equipments
           SET start_staging = $1, end_staging = $2, staging_type = $3, updated_at = NOW()
           WHERE purchase_id = $4`,
      [...equipmentStagingValues(serviceRecord), purchaseId]
    );
  }

  try {
    const purchaseCheck = await pool.query('SELECT mq FROM purchases WHERE id = $1', [purchaseId]);
    const mq = purchaseCheck.rows[0]?.mq;
    if (!mq) {
      return;
    }
    const newPurchaseCheck = await pool.query('SELECT id FROM new_purchases WHERE mq = $1', [mq]);
    if (newPurchaseCheck.rows.length === 0) {
      return;
    }
    const newPurchaseIds = newPurchaseCheck.rows.map((row) => row.id);
    await pool.query(
      `UPDATE equipments
               SET start_staging = $1, end_staging = $2, staging_type = $3, updated_at = NOW()
               WHERE new_purchase_id = ANY($4::uuid[]) AND purchase_id IS NULL`,
      [...equipmentStagingValues(serviceRecord), newPurchaseIds]
    );
  } catch (syncError) {
    console.error(MSG_SYNC_EQUIPMENT_NP, syncError);
  }
}

/**
 * Sincroniza staging cuando el service_record solo tiene new_purchase_id.
 * @param {Record<string, unknown>} serviceRecord
 */
async function syncEquipmentStagingForNewPurchaseOnly(serviceRecord) {
  const npId = serviceRecord.new_purchase_id;
  await pool.query(
    `UPDATE equipments
         SET start_staging = $1, end_staging = $2, staging_type = $3, updated_at = NOW()
         WHERE new_purchase_id = $4`,
    [...equipmentStagingValues(serviceRecord), npId]
  );

  try {
    const newPurchaseCheck = await pool.query('SELECT mq FROM new_purchases WHERE id = $1', [npId]);
    const mq = newPurchaseCheck.rows[0]?.mq;
    if (!mq) {
      return;
    }
    const purchaseCheck = await pool.query('SELECT id FROM purchases WHERE mq = $1', [mq]);
    if (purchaseCheck.rows.length === 0) {
      return;
    }
    const purchaseIds = purchaseCheck.rows.map((row) => row.id);
    await pool.query(
      `UPDATE service_records
               SET start_staging = $1, end_staging = $2, staging_type = $3, updated_at = NOW()
               WHERE purchase_id = ANY($4::uuid[])`,
      [...equipmentStagingValues(serviceRecord), purchaseIds]
    );
  } catch (syncError) {
    console.error(MSG_SYNC_SERVICE_RELATED, syncError);
  }
}

router.use(authenticateToken);

// Sincroniza desde purchases (logística) a service_records
async function syncFromLogistics(userId) {
  // ✅ EVITAR DUPLICADOS: Primero manejar purchases que pueden estar relacionados con new_purchases
  // Obtener purchases sin service_record
  const purchasesWithoutService = await pool.query(`
    SELECT 
      p.id as purchase_id,
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
      COALESCE(p.condition, 'USADO') as condition
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE NOT EXISTS (SELECT 1 FROM service_records s WHERE s.purchase_id = p.id)
  `);

  // Para cada purchase sin service_record, verificar si hay un service_record con new_purchase_id relacionado
  for (const purchase of purchasesWithoutService.rows) {
    const existingCheck = purchase.mq
      ? await pool.query(
          `
        SELECT s.id, s.new_purchase_id 
        FROM service_records s
        WHERE s.new_purchase_id IS NOT NULL 
          AND EXISTS (
            SELECT 1 FROM new_purchases np 
            WHERE np.id = s.new_purchase_id AND np.mq = $1
          )
        ORDER BY s.created_at DESC
        LIMIT 1
      `,
          [purchase.mq]
        )
      : null;
    const existingServiceRecord = existingCheck?.rows?.[0] ?? null;

    if (existingServiceRecord) {
      // ✅ ACTUALIZAR service_record existente agregando purchase_id
      await pool.query(`
        UPDATE service_records SET
          purchase_id = $1,
          supplier_name = COALESCE(NULLIF($2, ''), supplier_name),
          model = COALESCE(NULLIF($3, ''), model),
          serial = COALESCE(NULLIF($4, ''), serial),
          shipment_departure_date = COALESCE($5, shipment_departure_date),
          shipment_arrival_date = COALESCE($6, shipment_arrival_date),
          port_of_destination = COALESCE(NULLIF($7, ''), port_of_destination),
          nationalization_date = COALESCE($8, nationalization_date),
          current_movement = COALESCE(NULLIF($9, ''), current_movement),
          current_movement_date = COALESCE($10, current_movement_date),
          year = COALESCE($11, year),
          hours = COALESCE($12, hours),
          condition = COALESCE($13, condition),
          machine_type = COALESCE(NULLIF($14, ''), machine_type),
          updated_at = NOW()
        WHERE id = $15
      `, [
        purchase.purchase_id,
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
        purchase.condition || 'USADO',
        purchase.machine_type || '',
        existingServiceRecord.id
      ]);
    } else {
      // Crear uno nuevo solo si no existe ninguno relacionado
      await pool.query(`
        INSERT INTO service_records (
          purchase_id, supplier_name, model, serial, shipment_departure_date, shipment_arrival_date,
          port_of_destination, nationalization_date, current_movement, current_movement_date, year, hours, condition, machine_type, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        purchase.purchase_id,
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
        purchase.condition || 'USADO',
        purchase.machine_type || null,
        userId
      ]);
    }
  }

  // Insertar faltantes desde new_purchases (solo los que NO tienen purchase relacionado por MQ)
  await pool.query(`
    INSERT INTO service_records (
      new_purchase_id, supplier_name, model, serial, shipment_departure_date, shipment_arrival_date,
      port_of_destination, nationalization_date, current_movement, current_movement_date, condition, machine_type, created_by
    )
    SELECT np.id, np.supplier_name, np.model, np.serial, np.shipment_departure_date, np.shipment_arrival_date,
           np.port_of_loading, np.nationalization_date, np.machine_location, NULL,
           COALESCE(np.condition, 'NUEVO'), np.machine_type, $1
    FROM new_purchases np
    WHERE NOT EXISTS (SELECT 1 FROM service_records s WHERE s.new_purchase_id = np.id)
      AND NOT EXISTS (
        -- ✅ EVITAR DUPLICADOS: No crear si ya existe un purchase con el mismo MQ que tiene service_record
        SELECT 1 FROM purchases p 
        WHERE p.mq = np.mq 
          AND EXISTS (SELECT 1 FROM service_records s2 WHERE s2.purchase_id = p.id)
      )
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
        machine_type = COALESCE(m.machine_type, s.machine_type),
        updated_at = NOW()
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE s.purchase_id = p.id
  `);

  // Actualizar espejo desde new_purchases (sin tocar campos propios de servicio)
  await pool.query(`
    UPDATE service_records s
    SET supplier_name = np.supplier_name,
        year = COALESCE(np.year, s.year),
        model = np.model,
        serial = np.serial,
        shipment_departure_date = np.shipment_departure_date,
        shipment_arrival_date = np.shipment_arrival_date,
        port_of_destination = np.port_of_loading,
        nationalization_date = np.nationalization_date,
        current_movement = np.machine_location,
        condition = COALESCE(np.condition, 'NUEVO'),
        machine_type = COALESCE(np.machine_type, s.machine_type),
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
        COALESCE(m.year, np.year, s.year) as year,
        m.hours,
        COALESCE(m.machine_type, np.machine_type, s.machine_type) as machine_type,
        -- Especificaciones técnicas desde machines (para purchases)
        m.shoe_width_mm,
        m.track_width,
        m.spec_pip,
        m.spec_blade,
        m.spec_cabin,
        COALESCE(eq.spec_pad, m.spec_pad) as spec_pad,
        -- Datos de purchase o new_purchase
        p.machine_id,
        COALESCE(p.supplier_name, np.supplier_name, s.supplier_name) as supplier_name,
        COALESCE(p.shipment_departure_date, np.shipment_departure_date, s.shipment_departure_date) as shipment_departure_date,
        COALESCE(p.shipment_arrival_date, np.shipment_arrival_date, s.shipment_arrival_date) as shipment_arrival_date,
        COALESCE(p.port_of_destination, np.port_of_loading, s.port_of_destination) as port_of_destination,
        COALESCE(p.nationalization_date, np.nationalization_date, s.nationalization_date) as nationalization_date,
        COALESCE(p.mc, np.mc) as mc,
        COALESCE(p.current_movement, np.machine_location, s.current_movement) as current_movement,
        COALESCE(p.current_movement_date, NULL) as current_movement_date,
        p.repuestos,
        COALESCE(s.condition, p.condition, np.condition, 'USADO') as condition,
        COALESCE(m.arm_type, np.arm_type) as arm_type,
        np.arm_type as np_arm_type,
        m.arm_type as machine_arm_type,
        np.cabin_type as np_cabin_type,
        np.wet_line as np_wet_line,
        np.dozer_blade as np_dozer_blade,
        np.track_type as np_track_type,
        np.track_width as np_track_width,
        s.comentarios
      FROM service_records s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      LEFT JOIN new_purchases np ON s.new_purchase_id = np.id
      LEFT JOIN machines m ON p.machine_id = m.id
      LEFT JOIN equipments eq ON eq.purchase_id = p.id
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(MSG_ERROR_FETCH_SERVICE, error);
    res.status(500).json({ error: MSG_ERROR_FETCH_SERVICE });
  }
});

// PUT /api/service/:id
router.put('/:id', canEditService, async (req, res) => {
  try {
    const { id } = req.params;
    const { comentarios } = req.body;

    const existingRes = await pool.query('SELECT * FROM service_records WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: MSG_NOT_FOUND });
    }
    const ex = existingRes.rows[0];
    const merged = mergeServiceUpdatePayload(ex, req.body);

    const result = await pool.query(
      `UPDATE service_records
       SET start_staging = $1, end_staging = $2, service_value = $3, staging_type = $4, comentarios = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        merged.start_staging,
        merged.end_staging,
        merged.service_value,
        merged.staging_type,
        merged.comentarios,
        id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: MSG_NOT_FOUND });
    }

    // Sincronizar fechas de alistamiento a la tabla equipments
    const serviceRecord = result.rows[0];

    // 🔄 Sincronizar comentarios a purchases.comentarios_servicio si tiene purchase_id
    if (serviceRecord.purchase_id && comentarios !== undefined) {
      await pool.query(
        'UPDATE purchases SET comentarios_servicio = $1, updated_at = NOW() WHERE id = $2',
        [serviceRecord.comentarios, serviceRecord.purchase_id]
      );
    }

    if (serviceRecord.purchase_id) {
      await syncEquipmentStagingForPurchaseServiceRecord(serviceRecord);
    } else if (serviceRecord.new_purchase_id) {
      await syncEquipmentStagingForNewPurchaseOnly(serviceRecord);
    }

    res.json(serviceRecord);
  } catch (error) {
    console.error(MSG_ERROR_UPDATE_SERVICE, error);
    res.status(500).json({ error: MSG_ERROR_UPDATE_SERVICE });
  }
});

export default router;
