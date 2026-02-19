import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewEquipments, canEditEquipments, canAddEquipments } from '../middleware/auth.js';

const router = express.Router();

/** Fechas festivas Colombia (MM-DD) para no contar como hábiles. Ajustar según calendario oficial. */
const HOLIDAYS_MMDD = new Set([
  '01-01', '01-06', '03-19', '04-18', '04-19', '05-01', '06-03', '06-24', '07-20', '08-07', '08-19',
  '10-14', '11-04', '11-11', '12-08', '12-25'
]);

// Primera etapa de reservas: destinatario preferente (Laura).
const LAURA_JEFE_COMERCIAL_EMAIL = (process.env.LAURA_JEFE_COMERCIAL_EMAIL || 'lgarcia@partequipos.com').toLowerCase().trim();
const EQUIPMENTS_MAINTENANCE_LOCK_KEY = 842101;

/** Sumar días hábiles: no se cuentan domingos ni festivos. */
function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() === 0) continue; // domingo
    const mmdd = `${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
    if (HOLIDAYS_MMDD.has(mmdd)) continue;
    added += 1;
  }
  return result;
}

/** Restar días hábiles desde una fecha (no se cuentan domingos ni festivos). */
function subtractBusinessDays(fromDate, days) {
  const result = new Date(fromDate);
  let subtracted = 0;
  while (subtracted < days) {
    result.setDate(result.getDate() - 1);
    if (result.getDay() === 0) continue; // domingo
    const mmdd = `${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
    if (HOLIDAYS_MMDD.has(mmdd)) continue;
    subtracted += 1;
  }
  return result;
}

/** Procesa un valor de campo para actualización de equipo. Retorna { value } o { skip: true }. */
function processEquipmentFieldValue(key, value, allowedFields) { // NOSONAR
  if (!Object.hasOwn(allowedFields, key)) return { skip: true };
  if (value === undefined) return { skip: true };
  const kind = allowedFields[key];
  if (kind === 'DATE' && (value === null || value === '')) return { value: null };
  if (value === null) return { skip: true };
  if (kind === 'NUMERIC' || kind === 'INTEGER') {
    if (value === '') return { value: null };
    const num = Number(value);
    return { value: Number.isNaN(num) ? null : num };
  }
  if (kind === 'TEXT') {
    const str = value === '' ? null : String(value);
    if (key === 'wet_line' && str !== null) {
      const upper = str.toUpperCase();
      let normalized = str;
      if (upper === 'SI') normalized = 'SI';
      else if (upper === 'NO') normalized = 'No';
      return { value: normalized };
    }
    return { value: str };
  }
  if (kind === 'DATE') {
    return { value: (value === '' || value === null || value === undefined) ? null : String(value) };
  }
  return { skip: true };
}

/**
 * Normaliza cabin_type para machines según su CHECK constraint.
 * - undefined: valor no reconocido (se omite en sync para no romper update)
 * - null: limpiar valor
 */
function normalizeCabinTypeForMachines(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim().toUpperCase().replaceAll(/\s+/g, ' ');
  if (normalized === 'N/A') return 'N/A';
  if (normalized === 'CANOPY') return 'CANOPY';
  if (normalized.includes('CERRADA')) {
    return 'CABINA CERRADA / AIRE ACONDICIONADO';
  }
  return undefined;
}

/** Sincroniza especificaciones a machines y staging_type a service_records tras actualizar equipo. */
async function syncEquipmentToMachinesAndRecords(db, equipment, updates) { // NOSONAR
  if (!equipment.purchase_id) return;
  const machineResult = await db.query(`
    SELECT m.id FROM machines m INNER JOIN purchases p ON p.machine_id = m.id WHERE p.id = $1
  `, [equipment.purchase_id]);
  if (machineResult.rows.length > 0) {
    const machineId = machineResult.rows[0].id;
    const specsToSync = ['machine_type', 'wet_line', 'arm_type', 'track_width', 'bucket_capacity',
      'warranty_months', 'warranty_hours', 'engine_brand', 'cabin_type', 'blade'];
    const machineFields = [];
    const machineValues = [];
    let idx = 1;
    for (const field of specsToSync) {
      if (Object.hasOwn(updates, field) && updates[field] !== undefined) {
        let valueToSync = updates[field] === '' ? null : updates[field];
        if (field === 'cabin_type') {
          const normalizedCabinType = normalizeCabinTypeForMachines(valueToSync);
          if (normalizedCabinType === undefined) {
            console.warn('⚠️ cabin_type no válido para machines, se omite sincronización:', updates[field]);
            continue;
          }
          valueToSync = normalizedCabinType;
        }
        machineFields.push(`${field} = $${idx}`);
        machineValues.push(valueToSync);
        idx++;
      }
    }
    if (machineFields.length > 0) {
      machineFields.push('updated_at = NOW()');
      machineValues.push(machineId);
      await db.query(`UPDATE machines SET ${machineFields.join(', ')} WHERE id = $${idx}`, machineValues);
      console.log(`✅ Especificaciones sincronizadas con machines (ID: ${machineId})`);
    }
  }
  if (updates.staging_type !== undefined && equipment.purchase_id) {
    await db.query(
      'UPDATE service_records SET staging_type = $1, updated_at = NOW() WHERE purchase_id = $2',
      [updates.staging_type || null, equipment.purchase_id]
    );
    console.log('✅ staging_type sincronizado con service_records');
  }
}

/** Libera equipo (Libre, borra cliente/asesor/fecha) y registra en change_logs para trazabilidad. */
async function releaseEquipmentAndLogRejection(db, equipmentId, userId, reason) {
  const before = await db.query(`SELECT cliente, asesor FROM equipments WHERE id = $1`, [equipmentId]);
  const oldCliente = before.rows[0]?.cliente ?? null;
  const oldAsesor = before.rows[0]?.asesor ?? null;
  await db.query(`
    UPDATE equipments
    SET state = 'Libre', cliente = NULL, asesor = NULL,
        reservation_deadline_date = NULL, reservation_deadline_modified = FALSE, updated_at = NOW()
    WHERE id = $1
  `, [equipmentId]);
  if (oldCliente != null) {
    await db.query(
      `INSERT INTO change_logs (table_name, record_id, field_name, old_value, new_value, change_reason, changed_by, changed_at)
       VALUES ('equipments', $1, 'cliente', $2, NULL, $3, $4, NOW())`,
      [equipmentId, String(oldCliente), reason, userId]
    );
  }
  if (oldAsesor != null) {
    await db.query(
      `INSERT INTO change_logs (table_name, record_id, field_name, old_value, new_value, change_reason, changed_by, changed_at)
       VALUES ('equipments', $1, 'asesor', $2, NULL, $3, $4, NOW())`,
      [equipmentId, String(oldAsesor), reason, userId]
    );
  }
}

/** Aplica efectos secundarios del checklist: first_checklist_date y estado Reservada +7 días si aplica. */
async function applyChecklistEquipmentState(db, reservationId, reservation) { // NOSONAR
  const checkedCount = (reservation.consignacion_10_millones ? 1 : 0) +
    (reservation.porcentaje_10_valor_maquina ? 1 : 0) +
    (reservation.firma_documentos ? 1 : 0);
  const hasFirstChecklistDate = reservation.first_checklist_date != null;

  if (checkedCount >= 1 && !hasFirstChecklistDate) {
    await db.query(`
      UPDATE equipment_reservations
      SET first_checklist_date = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [reservationId]);
  }

  if (reservation.consignacion_10_millones && checkedCount < 3) {
    const deadlineDate = addBusinessDays(new Date(), 7);
    await db.query(`
      UPDATE equipments
      SET state = 'Reservada', reservation_deadline_date = $2, updated_at = NOW()
      WHERE id = $1
    `, [reservation.equipment_id, deadlineDate]);
    const snap = await db.query(
      `SELECT cliente, asesor, reservation_deadline_date FROM equipments WHERE id = $1`,
      [reservation.equipment_id]
    );
    const s = snap.rows[0];
    if (s) {
      await db.query(`
        UPDATE equipment_reservations
        SET snapshot_cliente = $2, snapshot_asesor = $3, snapshot_deadline = $4::date, updated_at = NOW()
        WHERE id = $1
      `, [reservationId, s.cliente, s.asesor, s.reservation_deadline_date]);
    }
  }
}

/** Ejecuta auto-liberaciones y notificaciones de reservas (job de mantenimiento). Liberación solo al vencer FECHA LÍMITE (Reservada). */
async function runEquipmentsAutoTasks(db) { // NOSONAR
  const todaySep = new Date();
  const todaySepStr = `${todaySep.getFullYear()}-${String(todaySep.getMonth() + 1).padStart(2, '0')}-${String(todaySep.getDate()).padStart(2, '0')}`;
  const separadaWithDeadline = await db.query(`
      SELECT
        er.id,
        er.equipment_id,
        er.commercial_user_id,
        COALESCE(NULLIF(BTRIM(e.serial), ''), NULLIF(BTRIM(p.serial), ''), NULLIF(BTRIM(np.serial), ''), 'N/A') AS serial,
        COALESCE(NULLIF(BTRIM(e.model), ''), NULLIF(BTRIM(p.model), ''), NULLIF(BTRIM(np.model), ''), 'N/A') AS model,
        e.cliente,
        e.asesor,
        e.reservation_deadline_date
      FROM equipment_reservations er
      INNER JOIN equipments e ON e.id = er.equipment_id
      LEFT JOIN purchases p ON e.purchase_id = p.id
      LEFT JOIN new_purchases np ON e.new_purchase_id = np.id
      WHERE er.status = 'APPROVED'
        AND e.state = 'Separada'
        AND e.reservation_deadline_date IS NOT NULL
        AND e.reservation_deadline_date::date > CURRENT_DATE
    `);
  const warnSeparations = separadaWithDeadline.rows.filter((row) => {
    const raw = row.reservation_deadline_date;
    let deadlineLocal;
    if (raw instanceof Date) {
      deadlineLocal = raw;
    } else {
      const [y, m, d] = String(raw).slice(0, 10).split('-').map(Number);
      deadlineLocal = new Date(y, m - 1, d);
    }
    const alertDate = subtractBusinessDays(deadlineLocal, 10);
    const alertDateStr = `${alertDate.getFullYear()}-${String(alertDate.getMonth() + 1).padStart(2, '0')}-${String(alertDate.getDate()).padStart(2, '0')}`;
    return alertDateStr === todaySepStr;
  });

  if (warnSeparations.length > 0) {
    // Día 50 (10 días hábiles antes): notificar jefe_comercial y asesor de la solicitud.
    const jefeComercialUsers = await db.query(
      `SELECT id FROM users_profile WHERE role = 'jefe_comercial'`
    );
    const jefeIds = jefeComercialUsers.rows.map((r) => r.id);
    const msgTemplate = (row) =>
      `Asesor: ${row.asesor || 'N/A'}\nMáquina: ${row.model || ''} ${row.serial || ''}\nCliente: ${row.cliente || 'N/A'}\nFaltan 10 días hábiles para que venza el periodo de legalización. Si no se completa el proceso, el equipo se liberará del inventario y se cancelará la entrega. Por favor, realiza la notificación formal de advertencia al cliente hoy mismo.`;
    for (const row of warnSeparations) {
      const recipients = new Set([...(row.commercial_user_id ? [row.commercial_user_id] : []), ...jefeIds]);
      for (const userId of recipients) {
        const alreadySent = await db.query(
          `SELECT 1
           FROM notifications
           WHERE reference_id = $1
             AND user_id = $2
             AND (
               (type = 'warning' AND title = 'Legalización próxima a vencer')
               OR type = 'legalization_warning'
             )
           LIMIT 1`,
          [row.id, userId]
        );
        if (alreadySent.rows.length > 0) continue;
        await db.query(`
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
            ) VALUES ($1, 'equipments', 'equipments', 'warning', 2,
              $2, $3, $4, $5, 'view_equipment_reservation', $6, NOW())
          `, [
            userId,
            'Legalización próxima a vencer',
            msgTemplate(row),
            row.id,
            JSON.stringify({
              equipment_id: row.equipment_id,
              reservation_id: row.id,
              serial: row.serial,
              model: row.model,
              cliente: row.cliente,
              asesor: row.asesor
            }),
            `/equipments?reservationEquipmentId=${encodeURIComponent(row.equipment_id)}`
          ]);
      }
    }
  }

  const overdueReservada = await db.query(`
      SELECT
        e.id as equipment_id,
        COALESCE(NULLIF(BTRIM(e.serial), ''), NULLIF(BTRIM(p.serial), ''), NULLIF(BTRIM(np.serial), ''), 'N/A') AS serial,
        COALESCE(NULLIF(BTRIM(e.model), ''), NULLIF(BTRIM(p.model), ''), NULLIF(BTRIM(np.model), ''), 'N/A') AS model,
        e.asesor,
        e.cliente,
        e.reservation_deadline_date,
        er.id as reservation_id,
        er.commercial_user_id
      FROM equipments e
      INNER JOIN equipment_reservations er ON er.equipment_id = e.id AND er.status = 'PENDING'
      LEFT JOIN purchases p ON e.purchase_id = p.id
      LEFT JOIN new_purchases np ON e.new_purchase_id = np.id
      WHERE e.state = 'Reservada'
        AND e.reservation_deadline_date IS NOT NULL
        AND e.reservation_deadline_date::date < CURRENT_DATE
    `);
  for (const row of overdueReservada.rows) {
    await db.query(`
      UPDATE equipment_reservations
      SET status = 'REJECTED',
          rejection_reason = 'Liberada por sistema: no cumplió condiciones de separación (fecha límite vencida)',
          rejected_at = NOW(),
          snapshot_cliente = $2,
          snapshot_asesor = $3,
          snapshot_deadline = $4::date,
          updated_at = NOW()
      WHERE id = $1
    `, [row.reservation_id, row.cliente, row.asesor, row.reservation_deadline_date]);
    // Trazabilidad: registrar cliente/asesor en change_logs antes de borrar
    if (row.cliente != null) {
      await db.query(
        `INSERT INTO change_logs (table_name, record_id, field_name, old_value, new_value, change_reason, changed_by, changed_at)
         VALUES ('equipments', $1, 'cliente', $2, NULL, 'Liberado por sistema: fecha límite vencida', NULL, NOW())`,
        [row.equipment_id, String(row.cliente)]
      );
    }
    if (row.asesor != null) {
      await db.query(
        `INSERT INTO change_logs (table_name, record_id, field_name, old_value, new_value, change_reason, changed_by, changed_at)
         VALUES ('equipments', $1, 'asesor', $2, NULL, 'Liberado por sistema: fecha límite vencida', NULL, NOW())`,
        [row.equipment_id, String(row.asesor)]
      );
    }
    await db.query(`
      UPDATE equipments
      SET state = 'Libre',
          cliente = NULL,
          asesor = NULL,
          reservation_deadline_date = NULL,
          reservation_deadline_modified = FALSE,
          updated_at = NOW()
      WHERE id = $1
    `, [row.equipment_id]);
    const actionUrl = `/equipments?reservationEquipmentId=${encodeURIComponent(row.equipment_id)}`;
    const msgLogistica = `La máquina ${row.model || 'N/A'} Serie ${row.serial || 'N/A'}, del asesor ${row.asesor || 'N/A'}, se liberó por el sistema, dado que no cumplió las condiciones de separación.`;
    const jefeIds = (await db.query(`SELECT id FROM users_profile WHERE role = 'jefe_comercial'`)).rows.map((r) => r.id);
    for (const uid of jefeIds) {
      await db.query(`
        INSERT INTO notifications (user_id, module_source, module_target, type, priority, title, message, reference_id, metadata, action_type, action_url, created_at)
        VALUES ($1, 'equipments', 'equipments', 'warning', 2, $2, $3, $4, $5, 'view_equipment_reservation', $6, NOW())
      `, [uid, 'Máquina liberada por sistema', msgLogistica, row.reservation_id, JSON.stringify({ equipment_id: row.equipment_id, serial: row.serial, model: row.model }), actionUrl]);
    }
    if (row.commercial_user_id) {
      await db.query(`
        INSERT INTO notifications (user_id, module_source, module_target, type, priority, title, message, reference_id, metadata, action_type, action_url, created_at)
        VALUES ($1, 'equipments', 'equipments', 'warning', 2, $2, $3, $4, $5, 'view_equipment_reservation', $6, NOW())
      `, [row.commercial_user_id, 'Reserva liberada', msgLogistica, row.reservation_id, JSON.stringify({ equipment_id: row.equipment_id }), actionUrl]);
    }
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const reservadaWithDeadline = await db.query(`
      SELECT
        e.id as equipment_id,
        COALESCE(NULLIF(BTRIM(e.serial), ''), NULLIF(BTRIM(p.serial), ''), NULLIF(BTRIM(np.serial), ''), 'N/A') AS serial,
        COALESCE(NULLIF(BTRIM(e.model), ''), NULLIF(BTRIM(p.model), ''), NULLIF(BTRIM(np.model), ''), 'N/A') AS model,
        e.asesor,
        e.cliente,
        e.reservation_deadline_date,
        er.id as reservation_id,
        er.commercial_user_id
      FROM equipments e
      INNER JOIN equipment_reservations er ON er.equipment_id = e.id AND er.status = 'PENDING'
      LEFT JOIN purchases p ON e.purchase_id = p.id
      LEFT JOIN new_purchases np ON e.new_purchase_id = np.id
      WHERE e.state = 'Reservada'
        AND e.reservation_deadline_date IS NOT NULL
        AND e.reservation_deadline_date::date > CURRENT_DATE
  `);
  const warnTwoDays = reservadaWithDeadline.rows.filter((row) => {
    const raw = row.reservation_deadline_date;
    let deadlineLocal;
    if (raw instanceof Date) {
      deadlineLocal = raw;
    } else {
      const [y, m, d] = String(raw).slice(0, 10).split('-').map(Number);
      deadlineLocal = new Date(y, m - 1, d);
    }
    const alertDate = subtractBusinessDays(deadlineLocal, 2);
    const alertDateStr = `${alertDate.getFullYear()}-${String(alertDate.getMonth() + 1).padStart(2, '0')}-${String(alertDate.getDate()).padStart(2, '0')}`;
    return alertDateStr === todayStr;
  });
  for (const row of warnTwoDays) {
    const msg = `La máquina ${row.model || 'N/A'} Serie ${row.serial || 'N/A'} aún no tiene el pago del 10% e inicio de legalización; al cumplirse la fecha límite, se procederá a liberarla.`;
    const actionUrl = `/equipments?reservationEquipmentId=${encodeURIComponent(row.equipment_id)}`;
    const jefeIds = (await db.query(`SELECT id FROM users_profile WHERE role = 'jefe_comercial'`)).rows.map((r) => r.id);
    const recipients = new Set([...jefeIds, ...(row.commercial_user_id ? [row.commercial_user_id] : [])]);
    for (const uid of recipients) {
      const existing = await db.query(
        `SELECT 1 FROM notifications WHERE reference_id = $1 AND user_id = $2 AND message LIKE $3 AND created_at > NOW() - INTERVAL '3 days' LIMIT 1`,
        [row.reservation_id, uid, '%fecha límite%']
      );
      if (existing.rows.length > 0) continue;
      await db.query(`
        INSERT INTO notifications (user_id, module_source, module_target, type, priority, title, message, reference_id, metadata, action_type, action_url, created_at)
        VALUES ($1, 'equipments', 'equipments', 'warning', 2, $2, $3, $4, $5, 'view_equipment_reservation', $6, NOW())
      `, [uid, 'Aviso: fecha límite de reserva en 2 días', msg, row.reservation_id, JSON.stringify({ equipment_id: row.equipment_id, serial: row.serial, model: row.model }), actionUrl]);
    }
  }
}

/**
 * Sincroniza equipments con purchases/new_purchases/service_records.
 * NOSONAR: consulta extensa y sync incremental de múltiples fuentes.
 */
async function syncEquipmentsCatalog(db, userId) { // NOSONAR
  // Primero sincronizar: insertar/actualizar purchases que no estén en equipments
  // Sin restricción de nacionalización para que Comercial vea todos los equipos
  // ✅ EVITAR DUPLICADOS: Actualizar equipment existente con new_purchase_id en lugar de crear uno nuevo
  const purchasesToSync = await db.query(`
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
      const equipmentCheck = await db.query(`
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
        await db.query(`
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
      await db.query(`
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
        userId
      ]);
      console.log(`✅ Equipment nuevo creado para purchase_id: ${purchase.id}`);
    }
  }

  // Sincronizar fechas de alistamiento y tipo desde service_records a equipments
  await db.query(`
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
  await db.query(`
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
  await db.query(`
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
}

export async function runEquipmentsMaintenanceIfLeader(db, userId) {
  const client = await db.connect();
  let lockAcquired = false;
  try {
    const lockResult = await client.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [EQUIPMENTS_MAINTENANCE_LOCK_KEY]
    );
    lockAcquired = lockResult.rows[0]?.locked === true;
    if (!lockAcquired) return { executed: false };

    await runEquipmentsAutoTasks(client);
    await syncEquipmentsCatalog(client, userId);
    return { executed: true };
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1)', [EQUIPMENTS_MAINTENANCE_LOCK_KEY]);
    }
    client.release();
  }
}

/**
 * GET /api/equipments
 * Obtener todos los equipos con datos de Logística y Consolidado
 * NOSONAR: complejidad por sincronización purchases/new_purchases y query principal
 */
router.get('/', authenticateToken, canViewEquipments, async (req, res) => { // NOSONAR
  try {
    // Determinar si el usuario es comercial para aplicar filtro de ETD
    const userRole = req.user.role;
    const isCommercial = userRole === 'comerciales';

    // Obtener todos los equipos directamente desde purchases y new_purchases
    // Para usuarios comerciales, solo mostrar equipos con ETD DILIGENCIADO (shipment_departure_date con fecha)
    let query = `
      WITH reservation_counts AS (
        SELECT
          er.equipment_id,
          COUNT(*)::int as total_reservations_count,
          COUNT(*) FILTER (WHERE er.status = 'PENDING')::int as pending_reservations_count
        FROM equipment_reservations er
        GROUP BY er.equipment_id
      )
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
        e.reservation_deadline_modified,
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
        -- Columnas de reserva (cliente y asesor de la última reserva)
        e.cliente,
        e.asesor,
        COALESCE(rc.pending_reservations_count, 0) as pending_reservations_count,
        COALESCE(rc.total_reservations_count, 0) as total_reservations_count
      FROM equipments e
      LEFT JOIN purchases p ON e.purchase_id = p.id
      LEFT JOIN new_purchases np ON e.new_purchase_id = np.id
      LEFT JOIN machines m ON p.machine_id = m.id
      LEFT JOIN reservation_counts rc ON rc.equipment_id = e.id`;

    // Agregar filtro WHERE solo para usuarios comerciales
    if (isCommercial) {
      query += ` WHERE COALESCE(e.shipment_departure_date, p.shipment_departure_date, np.shipment_departure_date) IS NOT NULL`;
    }

    query += ` ORDER BY e.created_at DESC`;

    const result = await pool.query(query);
    let rows = result.rows;

    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener equipos:', error);
    res.status(500).json({ error: 'Error al obtener equipos', details: error.message });
  }
});

/**
 * PUT /api/equipments/:id
 * Actualizar equipo
 * NOSONAR: validaciones y construcción dinámica de UPDATE
 */
router.put('/:id', authenticateToken, canEditEquipments, async (req, res) => { // NOSONAR
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

    const allowedStates = ['Libre', 'Pre-Reserva', 'Reservada', 'Separada', 'Entregada'];
    if (updates.state && !allowedStates.includes(updates.state)) {
      return res.status(400).json({ error: `Estado no permitido. Usa: ${allowedStates.join(', ')}` });
    }

    // Proteger equipos entregados: no permitir cambios de asesor/cliente/fecha límite ni otro estado distinto a Libre
    const currentRowResult = await pool.query(
      'SELECT state, reservation_deadline_date FROM equipments WHERE id = $1',
      [id]
    );
    if (currentRowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    const currentState = currentRowResult.rows[0].state;
    const normalizedCurrentState = String(currentState || '').trim().toUpperCase();
    const previousDeadline = currentRowResult.rows[0].reservation_deadline_date;
    if (normalizedCurrentState === 'ENTREGADA') {
      const protectedFields = ['cliente', 'asesor', 'reservation_deadline_date'];
      const triesProtected = protectedFields.some((field) => updates[field] !== undefined);
      const changingStateToNonLibre = updates.state && updates.state !== 'Libre';
      if (triesProtected || changingStateToNonLibre) {
        return res.status(400).json({ error: 'Equipo Entregado: primero cambia a Libre desde Editar equipo para modificar asesor/cliente/fecha.' });
      }
    }

    // Campos que solo pueden ser editados por jefe_comercial o admin
    const restrictedFields = new Set(['pvp_est', 'reservation_deadline_date']);

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (restrictedFields.has(key) && userRole !== 'jefe_comercial' && userRole !== 'admin') {
        return res.status(403).json({
          error: `No tienes permisos para editar el campo ${key}. Solo el jefe comercial puede modificar este campo.`
        });
      }
      const result = processEquipmentFieldValue(key, value, allowedFields);
      if (result.skip) continue;
      fields.push(`${key} = $${paramIndex}`);
      values.push(result.value);
      paramIndex++;
    }

    // En estado Reservada/Separada, si se modifica FECHA LIMITE: marcar flag y registrar en historial
    const canTrackDeadlineModification =
      updates.reservation_deadline_date !== undefined &&
      (normalizedCurrentState === 'SEPARADA' || normalizedCurrentState === 'RESERVADA');
    if (canTrackDeadlineModification) {
      fields.push('reservation_deadline_modified = true');
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

    // Historial: registrar cambio de FECHA LIMITE en change_logs (trazabilidad)
    if (canTrackDeadlineModification) {
      const newDeadline = result.rows[0].reservation_deadline_date;
      const oldVal = previousDeadline ? String(previousDeadline) : null;
      const newVal = newDeadline ? String(newDeadline) : null;
      const changedBy = req.user?.userId ?? null;
      await pool.query(
        `INSERT INTO change_logs (table_name, record_id, field_name, old_value, new_value, change_reason, changed_by, changed_at)
         VALUES ('equipments', $1, 'reservation_deadline_date', $2, $3, NULL, $4, NOW())`,
        [id, oldVal, newVal, changedBy]
      );
    }

    const equipment = result.rows[0];
    await syncEquipmentToMachinesAndRecords(pool, equipment, updates);

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
        updates.spec_pip === undefined ? null : updates.spec_pip,
        updates.spec_blade === undefined ? null : updates.spec_blade,
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
    const { documents, comments, cliente } = req.body;
    const { userId, role } = req.user;

    // Verificar que el usuario es comercial
    if (role !== 'comerciales') {
      return res.status(403).json({ error: 'Solo usuarios comerciales pueden reservar equipos' });
    }

    // Verificar que el equipo existe y obtener datos para la notificación (serial y model desde purchases, new_purchases o machines)
    const equipmentResult = await pool.query(`
      SELECT 
        e.id, 
        e.state,
        COALESCE(e.serial, p.serial, np.serial, m.serial) as serial,
        COALESCE(e.model, p.model, np.model, m.model) as model
      FROM equipments e
      LEFT JOIN purchases p ON e.purchase_id = p.id
      LEFT JOIN new_purchases np ON e.new_purchase_id = np.id
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE e.id = $1
    `, [id]);
    if (equipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const equipment = equipmentResult.rows[0];

    // Verificar que el equipo esté disponible (solo se puede reservar si está "Libre")
    if (equipment.state !== 'Libre') {
      return res.status(400).json({
        error: `El equipo no está disponible para reserva. Estado actual: ${equipment.state}. Solo se pueden crear reservas cuando el equipo está "Libre".`
      });
    }
    
    // También verificar si hay reservas pendientes o aprobadas para este equipo
    const existingReservationCheck = await pool.query(`
      SELECT id, status 
      FROM equipment_reservations 
      WHERE equipment_id = $1 
        AND (status = 'PENDING' OR status = 'APPROVED')
      LIMIT 1
    `, [id]);
    
    if (existingReservationCheck.rows.length > 0) {
      const existingReservation = existingReservationCheck.rows[0];
      return res.status(400).json({ 
        error: `Ya existe una reserva ${existingReservation.status === 'PENDING' ? 'pendiente' : 'aprobada'} para este equipo. No se pueden crear nuevas reservas.` 
      });
    }

    // Validar que el comercial no tenga ya una reserva (pendiente o aprobada) para este equipo
    const userReservationCheck = await pool.query(
      `SELECT id, status FROM equipment_reservations 
       WHERE equipment_id = $1 
         AND commercial_user_id = $2 
         AND (status = 'PENDING' OR status = 'APPROVED')
       LIMIT 1`,
      [id, userId]
    );

    if (userReservationCheck.rows.length > 0) {
      const userReservation = userReservationCheck.rows[0];
      return res.status(400).json({ 
        error: `Ya tienes una reserva ${userReservation.status === 'PENDING' ? 'pendiente' : 'aprobada'} para este equipo. No puedes crear otra reserva.` 
      });
    }

    // Obtener nombre del asesor (usuario comercial)
    const userResult = await pool.query(
      `SELECT full_name FROM users_profile WHERE id = $1`,
      [userId]
    );
    const asesorName = userResult.rows[0]?.full_name || 'Usuario desconocido';

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

    // Actualizar equipments: ESTADO → Pre-Reserva, cliente y asesor; FECHA LIMITE explícitamente en blanco
    await pool.query(`
      UPDATE equipments 
      SET state = 'Pre-Reserva',
          cliente = $1, 
          asesor = $2,
          reservation_deadline_date = NULL,
          updated_at = NOW()
      WHERE id = $3
    `, [cliente || null, asesorName, id]);

    // Primera etapa: notificar solo a Laura (identificada por email). La notificación solo se marca leída cuando Laura la abre.
    const lauraResult = await pool.query(
      `SELECT id FROM users_profile WHERE LOWER(TRIM(COALESCE(email, ''))) = LOWER(TRIM($1))`,
      [LAURA_JEFE_COMERCIAL_EMAIL]
    );
    const firstStageRecipients = lauraResult.rows.length > 0
      ? lauraResult.rows.map((r) => r.id)
      : (await pool.query(`SELECT id FROM users_profile WHERE role = 'jefe_comercial'`)).rows.map((r) => r.id);

    const clienteDisplay = cliente && String(cliente).trim() ? String(cliente).trim() : 'No indicado';
    const notificationMessage = [
      `Máquina: ${equipment.model || 'N/A'} - Serie: ${equipment.serial || 'N/A'}`,
      `Asesor: ${asesorName}`,
      `Cliente: ${clienteDisplay}`,
      '',
      'Use el botón "Ver" para ir al registro de la máquina.'
    ].join('\n');
    const metadata = {
      equipment_id: id,
      reservation_id: reservation.id,
      serial: equipment.serial,
      model: equipment.model,
      asesor: asesorName,
      cliente: clienteDisplay
    };
    const actionUrl = `/equipments?reservationEquipmentId=${encodeURIComponent(id)}&serial=${encodeURIComponent(equipment.serial || '')}&model=${encodeURIComponent(equipment.model || '')}`;

    for (const userId of firstStageRecipients) {
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
        userId,
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
 * GET /api/equipments/reservations/batch?equipment_ids=id1,id2,...
 * Obtener reservas de múltiples equipos en una sola consulta
 */
router.get('/reservations/batch', authenticateToken, async (req, res) => {
  try {
    const rawEquipmentIds = typeof req.query.equipment_ids === 'string'
      ? req.query.equipment_ids
      : '';
    const equipmentIds = Array.from(
      new Set(
        rawEquipmentIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      )
    );

    if (equipmentIds.length === 0) {
      return res.json({});
    }

    if (equipmentIds.length > 200) {
      return res.status(400).json({ error: 'Máximo 200 equipos por consulta batch de reservas' });
    }

    const result = await pool.query(`
      SELECT
        er.*,
        up.full_name as commercial_name,
        up.email as commercial_email,
        approver.full_name as approver_name,
        rejector.full_name as rejector_name,
        e.state as equipment_state,
        e.cliente,
        e.asesor
      FROM equipment_reservations er
      LEFT JOIN users_profile up ON er.commercial_user_id = up.id
      LEFT JOIN users_profile approver ON er.approved_by = approver.id
      LEFT JOIN users_profile rejector ON er.rejected_by = rejector.id
      LEFT JOIN equipments e ON er.equipment_id = e.id
      WHERE er.equipment_id = ANY($1::uuid[])
      ORDER BY er.equipment_id, er.created_at DESC
    `, [equipmentIds]);

    const groupedByEquipment = {};
    equipmentIds.forEach((equipmentId) => {
      groupedByEquipment[equipmentId] = [];
    });

    result.rows.forEach((row) => {
      const equipmentId = row.equipment_id;
      const parsedRow = {
        ...row,
        documents: typeof row.documents === 'string' ? JSON.parse(row.documents) : (row.documents || [])
      };

      if (!groupedByEquipment[equipmentId]) {
        groupedByEquipment[equipmentId] = [];
      }
      groupedByEquipment[equipmentId].push(parsedRow);
    });

    res.json(groupedByEquipment);
  } catch (error) {
    console.error('❌ Error al obtener reservas batch:', error);
    res.status(500).json({ error: 'Error al obtener reservas batch', details: error.message });
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
        rejector.full_name as rejector_name,
        e.state as equipment_state,
        e.cliente,
        e.asesor
      FROM equipment_reservations er
      LEFT JOIN users_profile up ON er.commercial_user_id = up.id
      LEFT JOIN users_profile approver ON er.approved_by = approver.id
      LEFT JOIN users_profile rejector ON er.rejected_by = rejector.id
      LEFT JOIN equipments e ON er.equipment_id = e.id
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
 * PUT /api/equipments/reservations/:id/update-checklist
 * Actualizar checklist de reserva (solo jefe_comercial)
 */
router.put('/reservations/:id/update-checklist', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { consignacion_10_millones, porcentaje_10_valor_maquina, firma_documentos } = req.body;
    const { role } = req.user;

    if (role !== 'jefe_comercial' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo el jefe comercial puede actualizar el checklist' });
    }

    const updates = {};
    if (consignacion_10_millones !== undefined) updates.consignacion_10_millones = consignacion_10_millones;
    if (porcentaje_10_valor_maquina !== undefined) updates.porcentaje_10_valor_maquina = porcentaje_10_valor_maquina;
    if (firma_documentos !== undefined) updates.firma_documentos = firma_documentos;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];

    await pool.query(`
      UPDATE equipment_reservations
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
    `, values);

    const checkResult = await pool.query(`
      SELECT consignacion_10_millones, porcentaje_10_valor_maquina, firma_documentos, equipment_id, created_at, first_checklist_date
      FROM equipment_reservations
      WHERE id = $1
    `, [id]);

    if (checkResult.rows.length > 0) {
      await applyChecklistEquipmentState(pool, id, checkResult.rows[0]);
    }

    res.json({ success: true, message: 'Checklist actualizado' });
  } catch (error) {
    console.error('❌ Error al actualizar checklist:', error);
    res.status(500).json({ error: 'Error al actualizar checklist', details: error.message });
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
        SELECT er.*, e.id as equipment_id, e.serial, e.model, e.pvp_est
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
      
      // Verificar que los 3 checkboxes estén marcados
      if (!reservation.consignacion_10_millones || !reservation.porcentaje_10_valor_maquina || !reservation.firma_documentos) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Debe completar los 3 checkboxes antes de aprobar: Consignación de 10 millones y/o VoBo Director, 10% Valor de la máquina, y Firma de Documentos'
        });
      }

      // Verificar que no hayan pasado más de 7 días desde el primer checklist (ventana de aprobación = FECHA LÍMITE)
      const firstCheckDate = reservation.first_checklist_date || reservation.created_at;
      const daysSinceFirstCheck = Math.floor((Date.now() - new Date(firstCheckDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceFirstCheck > 7) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Han pasado más de 7 días desde el primer checklist. La máquina será liberada automáticamente al cumplirse la fecha límite.'
        });
      }

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

      // Actualizar equipo a Separada con fecha límite +59 días hábiles (sin contar domingos ni festivos)
      const deadline = addBusinessDays(new Date(), 59);
      await client.query(`
        UPDATE equipments
        SET state = 'Separada',
            reservation_deadline_date = $2,
            updated_at = NOW()
        WHERE id = $1
      `, [reservation.equipment_id, deadline]);
      const snapSep = await client.query(
        `SELECT cliente, asesor, reservation_deadline_date FROM equipments WHERE id = $1`,
        [reservation.equipment_id]
      );
      const sSep = snapSep.rows[0];
      if (sSep) {
        await client.query(`
          UPDATE equipment_reservations
          SET snapshot_cliente = $2, snapshot_asesor = $3, snapshot_deadline = $4::date, updated_at = NOW()
          WHERE id = $1
        `, [id, sSep.cliente, sSep.asesor, sSep.reservation_deadline_date]);
      }

      // Rechazar automáticamente las demás pendientes y limpiar cliente/asesor de equipos relacionados
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
        
        // Limpiar cliente y asesor de los equipos que fueron rechazados
        await client.query(`
          UPDATE equipments
          SET cliente = NULL,
              asesor = NULL
          WHERE id = $1
            AND id NOT IN (
              SELECT equipment_id FROM equipment_reservations
              WHERE equipment_id = $1 AND status = 'APPROVED'
            )
        `, [reservation.equipment_id]);
      }

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
 * PUT /api/equipments/reservations/:id/add-documents
 * Agregar documentos adicionales a una reserva existente (solo comerciales)
 */
router.put('/reservations/:id/add-documents', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { documents } = req.body;
    const { userId, role } = req.user;

    if (role !== 'comerciales') {
      return res.status(403).json({ error: 'Solo usuarios comerciales pueden agregar documentos' });
    }

    // Obtener la reserva
    const reservationResult = await pool.query(`
      SELECT er.*, e.id as equipment_id
      FROM equipment_reservations er
      INNER JOIN equipments e ON er.equipment_id = e.id
      WHERE er.id = $1 AND er.commercial_user_id = $2 AND er.status = 'PENDING'
    `, [id, userId]);

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada o no tienes permisos' });
    }

    const reservation = reservationResult.rows[0];

    // Verificar que no hayan pasado más de 10 días desde el primer checklist
    const firstCheckDate = reservation.first_checklist_date || reservation.created_at;
    const daysSinceFirstCheck = Math.floor((Date.now() - new Date(firstCheckDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceFirstCheck > 10) {
      return res.status(400).json({
        error: 'Han pasado más de 10 días. Ya no puedes agregar documentos a esta reserva.'
      });
    }

    // Obtener documentos existentes
    const existingDocuments = typeof reservation.documents === 'string' 
      ? JSON.parse(reservation.documents) 
      : (reservation.documents || []);

    // Agregar nuevos documentos
    const updatedDocuments = [...existingDocuments, ...documents];

    // Actualizar la reserva
    await pool.query(`
      UPDATE equipment_reservations
      SET documents = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(updatedDocuments), id]);

    res.json({ success: true, message: 'Documentos agregados exitosamente' });
  } catch (error) {
    console.error('❌ Error al agregar documentos:', error);
    res.status(500).json({ error: 'Error al agregar documentos', details: error.message });
  }
});

/**
 * GET /api/equipments/:id/state-history
 * Obtener historial de cambios de estado del equipo (Separada/Reservada)
 */
router.get('/:id/state-history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener reservas con información de estado (incluyendo rechazos)
    const reservationsResult = await pool.query(`
      SELECT
        er.id,
        er.first_checklist_date,
        er.approved_at,
        er.rejected_at,
        er.created_at,
        er.status,
        er.snapshot_cliente,
        er.snapshot_asesor,
        er.snapshot_deadline,
        e.cliente,
        e.asesor,
        e.reservation_deadline_date as reservation_deadline_date,
        up.full_name as commercial_name,
        rejector.full_name as rejector_name
      FROM equipment_reservations er
      LEFT JOIN equipments e ON er.equipment_id = e.id
      LEFT JOIN users_profile up ON er.commercial_user_id = up.id
      LEFT JOIN users_profile rejector ON er.rejected_by = rejector.id
      WHERE er.equipment_id = $1
        AND (er.first_checklist_date IS NOT NULL OR er.approved_at IS NOT NULL OR er.rejected_at IS NOT NULL)
      ORDER BY 
        COALESCE(er.first_checklist_date, er.approved_at, er.rejected_at, er.created_at) DESC
    `, [id]);

    const history = [];

    reservationsResult.rows.forEach((row) => {
      // Cada reserva conserva su propio snapshot (asesor, cliente, fechas) para el timeline
      const cliente = row.snapshot_cliente ?? row.cliente;
      const asesor = row.snapshot_asesor ?? row.asesor ?? row.commercial_name;
      const deadlineDate = row.snapshot_deadline ?? row.reservation_deadline_date;
      const reservationCreatedAt = row.created_at;

      if (row.first_checklist_date) {
        history.push({
          id: `reservada-${row.id}`,
          state: 'Reservada',
          updated_at: row.first_checklist_date,
          cliente,
          asesor,
          reservation_id: row.id,
          deadline_date: deadlineDate || null,
          reservation_created_at: reservationCreatedAt,
        });
      }

      if (row.approved_at) {
        history.push({
          id: `separada-${row.id}`,
          state: 'Separada',
          updated_at: row.approved_at,
          cliente,
          asesor,
          reservation_id: row.id,
          deadline_date: deadlineDate || null,
          reservation_created_at: reservationCreatedAt,
        });
      }

      if (row.rejected_at) {
        history.push({
          id: `rechazada-${row.id}`,
          state: 'Rechazada',
          updated_at: row.rejected_at,
          cliente,
          asesor,
          reservation_id: row.id,
          deadline_date: deadlineDate || null,
          reservation_created_at: reservationCreatedAt,
        });
      }
    });

    // Incluir cambios de FECHA LIMITE desde change_logs (trazabilidad)
    const deadlineLogs = await pool.query(
      `SELECT id, old_value, new_value, changed_at
       FROM change_logs
       WHERE table_name = 'equipments' AND record_id = $1 AND field_name = 'reservation_deadline_date'
       ORDER BY changed_at DESC`,
      [id]
    );
    deadlineLogs.rows.forEach((log) => {
      history.push({
        id: `deadline-${log.id}`,
        state: 'Fecha límite modificada',
        updated_at: log.changed_at,
        cliente: null,
        asesor: null,
        reservation_id: null,
        old_value: log.old_value,
        new_value: log.new_value,
      });
    });
    
    // Ordenar por fecha (más reciente primero). Si empatan, orden: Reservada (primer check) -> Separada (aprobación) -> Rechazada
    history.sort((a, b) => {
      const dateDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (Math.abs(dateDiff) < 1000) {
        const order = { 'Reservada': 1, 'Separada': 2, 'Rechazada': 3, 'Fecha límite modificada': 4 };
        const aOrder = order[a.state] ?? 99;
        const bOrder = order[b.state] ?? 99;
        return aOrder - bOrder;
      }
      return dateDiff;
    });
    
    res.json(history);
  } catch (error) {
    console.error('❌ Error al obtener historial de estados:', error);
    res.status(500).json({ error: 'Error al obtener historial', details: error.message });
  }
});

/**
 * PUT /api/equipments/reservations/:id/reject
 * Rechazar reserva (solo jefe_comercial). Si existe otra PENDING, se promueve la más antigua.
 */
router.put('/reservations/:id/reject', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const { role, userId } = req.user;

    if (role !== 'jefe_comercial' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo el jefe comercial puede rechazar reservas' });
    }

    await client.query('BEGIN');

    // Obtener la reserva con datos de equipo para notificación (permitir PENDING o APPROVED)
    const reservationResult = await client.query(`
      SELECT er.*, e.id as equipment_id, e.state as equipment_state,
        COALESCE(e.serial, p.serial, np.serial, m.serial) as serial,
        COALESCE(e.model, p.model, np.model, m.model) as model
      FROM equipment_reservations er
      INNER JOIN equipments e ON er.equipment_id = e.id
      LEFT JOIN purchases p ON e.purchase_id = p.id
      LEFT JOIN new_purchases np ON e.new_purchase_id = np.id
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE er.id = $1 AND er.status IN ('PENDING', 'APPROVED')
      FOR UPDATE OF er, e
    `, [id]);

    if (reservationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva no encontrada o ya procesada' });
    }

    const reservation = reservationResult.rows[0];

    // Conservar asesor, cliente y fechas del proceso en timeline (snapshot antes de liberar o promover)
    const snapBefore = await client.query(
      `SELECT cliente, asesor, reservation_deadline_date FROM equipments WHERE id = $1`,
      [reservation.equipment_id]
    );
    const sBefore = snapBefore.rows[0];

    await client.query(`
      UPDATE equipment_reservations
      SET status = 'REJECTED',
          rejected_by = $1,
          rejected_at = NOW(),
          rejection_reason = $2,
          snapshot_cliente = $4,
          snapshot_asesor = $5,
          snapshot_deadline = $6::date,
          updated_at = NOW()
      WHERE id = $3
    `, [
      userId,
      rejection_reason || null,
      id,
      sBefore?.cliente ?? null,
      sBefore?.asesor ?? null,
      sBefore?.reservation_deadline_date ?? null
    ]);

    // Buscar otras pendientes en orden de llegada
    const pendingResult = await client.query(`
      SELECT er.id, er.commercial_user_id, er.created_at
      FROM equipment_reservations er
      WHERE er.equipment_id = $1
        AND er.status = 'PENDING'
      ORDER BY er.created_at ASC
      FOR UPDATE
    `, [reservation.equipment_id]);

    if (pendingResult.rows.length === 0) {
      await releaseEquipmentAndLogRejection(client, reservation.equipment_id, userId, 'Liberado por rechazo de reserva');
    } else {
      // Promover la más antigua: Reservada +7 días hábiles (misma regla que primer check)
      const nextReservation = pendingResult.rows[0];
      const advisorResult = await client.query(
        `SELECT full_name FROM users_profile WHERE id = $1`,
        [nextReservation.commercial_user_id]
      );
      const advisorName = advisorResult.rows[0]?.full_name || null;
      const deadline = addBusinessDays(new Date(), 7);

      await client.query(`
        UPDATE equipments
        SET state = 'Reservada',
            cliente = NULL,
            asesor = $2,
            reservation_deadline_date = $3,
            updated_at = NOW()
        WHERE id = $1
      `, [reservation.equipment_id, advisorName, deadline]);

      // Notificar a comercial promovido
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
        ) VALUES ($1, 'equipments', 'equipments', 'info', 2,
          $2, $3, $4, $5, 'view_equipment_reservation', $6, NOW())
      `, [
        nextReservation.commercial_user_id,
        'Tu reserva ahora está en turno',
        'Otra solicitud fue rechazada; tu reserva es la siguiente en la cola. Completa documentos y checklist para avanzar.',
        nextReservation.id,
        JSON.stringify({ equipment_id: reservation.equipment_id, reservation_id: nextReservation.id }),
        `/equipments?reservationEquipmentId=${encodeURIComponent(reservation.equipment_id)}`
      ]);

      // Notificar a jefe_comercial para revisar la nueva primera en cola
      const jefeResult = await client.query(`SELECT id FROM users_profile WHERE role = 'jefe_comercial'`);
      for (const jefe of jefeResult.rows) {
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
          ) VALUES ($1, 'equipments', 'equipments', 'info', 2,
            $2, $3, $4, $5, 'view_equipment_reservation', $6, NOW())
        `, [
          jefe.id,
          'Nueva solicitud en turno',
          'Se promovió la siguiente solicitud en la cola después de un rechazo. Revísala para continuar.',
          nextReservation.id,
          JSON.stringify({ equipment_id: reservation.equipment_id, reservation_id: nextReservation.id }),
          `/equipments?reservationEquipmentId=${encodeURIComponent(reservation.equipment_id)}`
        ]);
      }
    }

    // Notificar al comercial: mensaje alineado con spec (Máquina X, Serie X fue rechazada)
    const modelLabel = reservation.model || 'N/A';
    const serialLabel = reservation.serial || 'N/A';
    const rejectMessage = `La solicitud para la Máquina ${modelLabel}, Serie ${serialLabel} fue rechazada${rejection_reason ? ': ' + rejection_reason : ''}.`;
    const actionUrlReject = `/equipments?reservationEquipmentId=${encodeURIComponent(reservation.equipment_id)}&serial=${encodeURIComponent(reservation.serial || '')}&model=${encodeURIComponent(reservation.model || '')}`;
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
      reservation.commercial_user_id,
      'Reserva de equipo rechazada',
      rejectMessage,
      reservation.id,
      JSON.stringify({
        equipment_id: reservation.equipment_id,
        reservation_id: reservation.id,
        serial: reservation.serial,
        model: reservation.model
      }),
      actionUrlReject
    ]);

    await client.query('COMMIT');
    res.json({ message: 'Reserva rechazada exitosamente (cola actualizada)' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error al rechazar reserva:', error);
    res.status(500).json({ error: 'Error al rechazar reserva', details: error.message });
  } finally {
    client.release();
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
      
      if (Number.parseInt(otherEquipmentsCheck.rows[0].count, 10) === 0) {
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
      
      if (Number.parseInt(otherEquipmentsCheck.rows[0].count, 10) === 0) {
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

