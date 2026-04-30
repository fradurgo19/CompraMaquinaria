/**
 * Rutas de Consolidado de Gerencia (Management)
 */

import express from 'express';
import { pool, queryWithRetry, connectWithSemaphore } from '../db/connection.js';
import { authenticateToken, canViewManagement } from '../middleware/auth.js';
import { syncPurchaseToNewPurchaseAndEquipment } from '../services/syncBidirectional.js';
import { syncPurchaseToAuctionAndPreselection } from '../services/syncBidirectionalPreselectionAuction.js';

const router = express.Router();

/** Query base para listado de consolidado (management). Extraída para reducir complejidad del handler. */
function getManagementBaseQuery() {
  return `
    SELECT
      p.id, p.machine_id, p.auction_id,
      m.brand, m.model, m.serial, m.year, m.hours, m.machine_type,
      m.wet_line, m.arm_type, m.track_width, m.bucket_capacity,
      m.warranty_months, m.warranty_hours, m.engine_brand, m.cabin_type, m.blade,
      m.shoe_width_mm, m.spec_pip, m.spec_blade, m.spec_cabin, m.spec_pad,
      p.shipment_type_v2 as shipment, p.supplier_name as supplier, p.purchase_type as tipo_compra,
      p.incoterm, p.incoterm as tipo_incoterm, p.currency_type as currency,
      p.fob_usd, p.usd_jpy_rate, p.trm_rate, p.ocean_pagos, p.trm_ocean,
      p.exw_value_formatted, p.fob_expenses, p.disassembly_load_value,
      CASE WHEN p.usd_jpy_rate IS NOT NULL AND p.usd_jpy_rate > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0 THEN p.trm_rate / p.usd_jpy_rate
           WHEN p.trm_rate IS NOT NULL AND p.trm_rate > 0 THEN p.trm_rate ELSE NULL END as tasa,
      CASE WHEN p.incoterm = 'CIF' THEN COALESCE(p.cif_usd, 0)
           ELSE (COALESCE(NULLIF(p.exw_value_formatted, '')::numeric, 0) + COALESCE(NULLIF(p.fob_expenses, '')::numeric, 0) + COALESCE(p.disassembly_load_value, 0)) END as precio_fob,
      COALESCE(p.inland, 0) as inland,
      (COALESCE(p.fob_usd, 0) + COALESCE(p.inland, 0)) as cif_usd,
      CASE
        WHEN p.trm_rate IS NULL OR p.trm_rate <= 0 THEN NULL
        WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.inland IS NOT NULL AND p.inland > 0
          THEN (COALESCE(p.fob_usd, 0) * p.trm_rate) + (p.inland * p.trm_ocean)
        ELSE p.trm_rate * (COALESCE(p.fob_usd, 0) + COALESCE(p.inland, 0))
      END as cif_local,
      COALESCE(p.gastos_pto, 0) as gastos_pto, COALESCE(p.flete, 0) as flete,
      COALESCE(p.traslado, 0) as traslado, COALESCE(p.repuestos, 0) as repuestos,
      COALESCE(s.service_value, 0) as service_value, s.id as service_record_id,
      COALESCE(p.inland_verified, false) as inland_verified,
      COALESCE(p.gastos_pto_verified, false) as gastos_pto_verified,
      COALESCE(p.flete_verified, false) as flete_verified,
      COALESCE(p.traslado_verified, false) as traslado_verified,
      COALESCE(p.repuestos_verified, false) as repuestos_verified,
      COALESCE(p.fob_total_verified, false) as fob_total_verified,
      COALESCE(p.cif_usd_verified, false) as cif_usd_verified,
      (COALESCE(p.fob_usd, 0) * COALESCE(p.trm_rate, 0) +
        CASE WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.ocean_pagos IS NOT NULL AND p.ocean_pagos > 0 THEN p.ocean_pagos * p.trm_ocean
             WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.inland IS NOT NULL AND p.inland > 0 THEN p.inland * p.trm_ocean
             WHEN p.inland IS NOT NULL AND p.inland > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0 THEN p.inland * p.trm_rate
             ELSE 0 END + COALESCE(p.gastos_pto, 0) + COALESCE(p.flete, 0) + COALESCE(p.traslado, 0) + COALESCE(p.repuestos, 0)) as cost_arancel,
      CASE WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.ocean_pagos IS NOT NULL AND p.ocean_pagos > 0 THEN p.ocean_pagos * p.trm_ocean
           WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.inland IS NOT NULL AND p.inland > 0 THEN p.inland * p.trm_ocean
           WHEN p.inland IS NOT NULL AND p.inland > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0 THEN p.inland * p.trm_rate
           ELSE NULL END as ocean_cop,
      p.proyectado, p.pvp_est, p.comentarios, p.comentarios_servicio, p.comentarios_comercial,
      p.sales_state, p.created_at, p.updated_at, COALESCE(p.condition, 'USADO') as condition, p.mq, p.bulk_upload_id,
      p.shipment_departure_date,
      EXISTS (
        SELECT 1
        FROM machine_files f
        WHERE f.machine_id = p.machine_id
          AND f.file_type = 'FOTO'
      ) as has_photos
    FROM purchases p
    LEFT JOIN auctions a ON p.auction_id = a.id
    LEFT JOIN machines m ON p.machine_id = m.id
    LEFT JOIN service_records s ON s.purchase_id = p.id
    WHERE (p.auction_id IS NULL OR a.status = 'GANADA')
    /* Management: recencia primero; para cargas masivas, ID mayor primero. */
    ORDER BY p.created_at DESC, p.bulk_upload_id DESC NULLS LAST, p.id DESC
  `;
}

const MANAGEMENT_COUNT_WHERE = 'FROM purchases p LEFT JOIN auctions a ON p.auction_id = a.id WHERE (p.auction_id IS NULL OR a.status = \'GANADA\')';

const INCOTERM_VALID = new Set(['EXY', 'FOB', 'CIF']);
const SHIPMENT_VALID = new Set(['1X40', '1X20', 'RORO', 'LOLO']);
const CURRENCY_VALID = new Set(['JPY', 'GBP', 'EUR', 'USD', 'CAD']);

function validateIncoterm(value) {
  if (!value || value === '' || value === null || value === undefined) return undefined;
  const n = String(value).trim().toUpperCase();
  if (!INCOTERM_VALID.has(n)) {
    throw new Error(`INCOTERM inválido: "${value}". Solo se permiten: EXY, FOB, CIF`);
  }
  return n;
}

function validateShipmentType(value) {
  if (!value || value === '' || value === null || value === undefined) return null;
  const n = String(value).trim().toUpperCase();
  if (!SHIPMENT_VALID.has(n)) {
    throw new Error(`Método de embarque inválido: "${value}". Solo se permiten: 1X40, 1X20, RORO, LOLO`);
  }
  return n;
}

function validateCurrencyType(value) {
  if (!value || value === '' || value === null || value === undefined) return null;
  const n = String(value).trim().toUpperCase();
  if (!CURRENCY_VALID.has(n)) {
    throw new Error(`Moneda inválida: "${value}". Solo se permiten: JPY, GBP, EUR, USD, CAD`);
  }
  return n;
}

function parseNumericValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  let cleaned = String(value).trim();
  if (cleaned === '') return null;
  cleaned = cleaned.replaceAll(/[¥$€£₹₽₩₪₫₨₦₧₭₮₯₰₱₲₳₴₵₶₷₸₺₻₼₾₿\s]/g, '');
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replaceAll('.', '').replaceAll(',', '.');
    } else {
      cleaned = cleaned.replaceAll(',', '');
    }
  } else if (hasComma) {
    cleaned = cleaned.replaceAll('.', '').replaceAll(',', '.');
  } else {
    cleaned = cleaned.replaceAll(',', '');
  }
  cleaned = cleaned.replaceAll(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

async function syncMachineAndEquipmentUpdates(client, purchaseId, machineId, machineUpdates) {
  if (Object.keys(machineUpdates).length === 0 || !machineId) return;
  const machineFieldsArr = Object.keys(machineUpdates);
  const machineValuesArr = Object.values(machineUpdates);
  const setClause = machineFieldsArr.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const idParam = machineFieldsArr.length + 1;
  await client.query(`UPDATE machines SET ${setClause}, updated_at = NOW() WHERE id = $${idParam}`, [...machineValuesArr, machineId]);
  const equipmentResult = await client.query('SELECT id FROM equipments WHERE purchase_id = $1', [purchaseId]);
  if (equipmentResult.rows.length > 0) {
    await client.query(`UPDATE equipments SET ${setClause}, updated_at = NOW() WHERE id = $${idParam}`, [...machineValuesArr, equipmentResult.rows[0].id]);
  }
}

const MACHINE_BASIC_FIELDS = ['brand', 'model', 'serial', 'year', 'hours', 'machine_type'];
const SPECS_FIELDS = ['machine_type', 'wet_line', 'arm_type', 'track_width', 'bucket_capacity',
  'warranty_months', 'warranty_hours', 'engine_brand', 'cabin_type', 'blade', 'spec_pad'];
const ALL_MACHINE_FIELDS_SET = new Set([...MACHINE_BASIC_FIELDS, ...SPECS_FIELDS]);
const READ_ONLY_FIELDS_SET = new Set(['service_value', 'service_record_id', 'cif_usd', 'cif_local', 'fob_usd']);

function hasOwn(obj, key) {
  return Object.hasOwn(obj, key);
}

async function resolvePrecioFobUpdate(client, purchaseId, updates, purchaseUpdates) {
  if (!hasOwn(updates, 'precio_fob')) return;

  const purchaseResult = await client.query(
    'SELECT incoterm, fob_expenses, disassembly_load_value FROM purchases WHERE id = $1',
    [purchaseId]
  );
  if (purchaseResult.rows.length === 0) {
    throw new Error('Purchase no encontrado');
  }

  const current = purchaseResult.rows[0];
  const effectiveIncotermRaw = purchaseUpdates.incoterm ?? current.incoterm;
  const effectiveIncoterm = effectiveIncotermRaw ? String(effectiveIncotermRaw).trim().toUpperCase() : null;
  const targetPrecioFob = parseNumericValue(updates.precio_fob);

  if (effectiveIncoterm === 'CIF') {
    purchaseUpdates.cif_usd = targetPrecioFob;
    return;
  }

  const effectiveFobExpenses = parseNumericValue(
    hasOwn(purchaseUpdates, 'fob_expenses') ? purchaseUpdates.fob_expenses : current.fob_expenses
  ) ?? 0;
  const effectiveDisassembly = parseNumericValue(
    hasOwn(purchaseUpdates, 'disassembly_load_value') ? purchaseUpdates.disassembly_load_value : current.disassembly_load_value
  ) ?? 0;

  if (targetPrecioFob === null) {
    purchaseUpdates.exw_value_formatted = null;
    return;
  }

  const computedExw = targetPrecioFob - effectiveFobExpenses - effectiveDisassembly;
  if (computedExw < 0) {
    throw new Error(
      `FOB ORIGEN inválido: ${targetPrecioFob}. Debe ser mayor o igual a GASTOS + LAVADO (${effectiveFobExpenses}) + DESENSAMBLAJE + CARGUE (${effectiveDisassembly}).`
    );
  }

  purchaseUpdates.exw_value_formatted = String(computedExw);
}

async function resolveSupplierToPurchaseUpdates(client, updates, purchaseUpdates) {
  const supplierName = updates.supplier || updates.supplier_name;
  if (!supplierName || String(supplierName).trim() === '') return;
  const normalized = String(supplierName).trim();
  const supplierCheck = await client.query('SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)', [normalized]);
  const supplierId = supplierCheck.rows.length > 0
    ? supplierCheck.rows[0].id
    : (await client.query('INSERT INTO suppliers (name) VALUES ($1) RETURNING id', [normalized])).rows[0].id;
  purchaseUpdates.supplier_id = supplierId;
  purchaseUpdates.supplier_name = normalized;
  delete updates.supplier;
  delete updates.supplier_name;
}

function applyUpdatesToMachineAndPurchase(updates, machineUpdates, purchaseUpdates) {
  const isConfig = (n) => n === 'shipment_type_v2' || n === 'currency_type' || n === 'incoterm';
  Object.entries(updates).forEach(([key, value]) => {
    if (READ_ONLY_FIELDS_SET.has(key)) return;
    if (key === 'precio_fob') return;
    const dbField = key;
    let normalizedValue = value;
    if (dbField === 'incoterm') {
      normalizedValue = validateIncoterm(value);
      if (normalizedValue === undefined) return;
    } else if (dbField === 'shipment_type_v2') {
      normalizedValue = validateShipmentType(value);
    } else if (dbField === 'currency_type') {
      normalizedValue = validateCurrencyType(value);
    }
    if (ALL_MACHINE_FIELDS_SET.has(key)) {
      machineUpdates[key] = normalizedValue;
    } else if (isConfig(dbField) || (normalizedValue !== null && normalizedValue !== undefined)) {
      purchaseUpdates[dbField] = normalizedValue;
    }
  });
}

function normalizeAndValidate(value, allowedSet, errorMsg) {
  const n = String(value).trim().toUpperCase();
  if (!allowedSet.has(n)) throw new Error(errorMsg);
  return n;
}

function validatedValueForPurchaseField(fieldName, value) {
  const hasVal = value !== '' && value !== null && value !== undefined;
  switch (fieldName) {
    case 'incoterm':
      return hasVal ? normalizeAndValidate(value, INCOTERM_VALID, `INCOTERM inválido: "${value}". Solo se permiten: EXY, FOB, CIF`) : null;
    case 'shipment_type_v2':
      return hasVal ? normalizeAndValidate(value, SHIPMENT_VALID, `Método de embarque inválido: "${value}". Solo se permiten: 1X40, 1X20, RORO, LOLO`) : null;
    case 'currency_type':
      return hasVal ? normalizeAndValidate(value, CURRENCY_VALID, `Moneda inválida: "${value}". Solo se permiten: JPY, GBP, EUR, USD, CAD`) : null;
    default:
      return value;
  }
}

function buildValidatedPurchaseFieldsAndValues(fields, values) {
  const validatedFieldsArray = [];
  const validatedValuesArray = [];
  for (let i = 0; i < fields.length; i++) {
    const fieldName = fields[i];
    const validatedValue = validatedValueForPurchaseField(fieldName, values[i]);
    if (fieldName === 'incoterm' && validatedValue === null) continue;
    validatedFieldsArray.push(fieldName);
    validatedValuesArray.push(validatedValue);
  }
  return { validatedFieldsArray, validatedValuesArray };
}

function runBackgroundSyncAfterPurchaseUpdate(purchaseId, purchaseUpdates) {
  setImmediate(async () => {
    try {
      if ('comentarios_servicio' in purchaseUpdates) {
        const serviceResult = await pool.query('SELECT id FROM service_records WHERE purchase_id = $1', [purchaseId]);
        if (serviceResult.rows.length > 0) {
          await pool.query('UPDATE service_records SET comentarios = $1, updated_at = NOW() WHERE purchase_id = $2',
            [purchaseUpdates.comentarios_servicio || null, purchaseId]);
        }
      }
      if ('comentarios_comercial' in purchaseUpdates) {
        const equipmentResult = await pool.query('SELECT id FROM equipments WHERE purchase_id = $1', [purchaseId]);
        if (equipmentResult.rows.length > 0) {
          await pool.query('UPDATE equipments SET commercial_observations = $1, updated_at = NOW() WHERE purchase_id = $2',
            [purchaseUpdates.comentarios_comercial || null, purchaseId]);
        }
      }
      if ('supplier_name' in purchaseUpdates) {
        const syncUpdates = { supplier_name: purchaseUpdates.supplier_name };
        Promise.all([
          syncPurchaseToNewPurchaseAndEquipment(purchaseId, syncUpdates),
          syncPurchaseToAuctionAndPreselection(purchaseId, syncUpdates)
        ]).catch((syncError) => console.error('⚠️ Error sincronización supplier (background):', syncError?.message || syncError));
      }
    } catch (bgError) {
      console.error('⚠️ Error en sincronizaciones en background:', bgError?.message || bgError);
    }
  });
}

async function updatePurchaseAndSendResponse(client, purchaseId, purchaseUpdates, res) {
  const fields = Object.keys(purchaseUpdates);
  const values = Object.values(purchaseUpdates);
  let built;
  try {
    built = buildValidatedPurchaseFieldsAndValues(fields, values);
  } catch (validationErr) {
    res.status(400).json({ error: validationErr.message });
    return;
  }
  if (built.validatedFieldsArray.length === 0) {
    const current = await client.query('SELECT * FROM purchases WHERE id = $1', [purchaseId]);
    res.json(current.rows[0]);
    return;
  }
  const setClause = built.validatedFieldsArray.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const result = await client.query(
    `UPDATE purchases SET ${setClause}, updated_at = NOW() WHERE id = $${built.validatedFieldsArray.length + 1} RETURNING *`,
    [...built.validatedValuesArray, purchaseId]
  );
  res.json(result.rows[0]);
  runBackgroundSyncAfterPurchaseUpdate(purchaseId, purchaseUpdates);
}

async function processPutManagement(client, purchaseId, machineId, updates, res) {
  const purchaseUpdates = {};
  const machineUpdates = {};
  if (updates.supplier || updates.supplier_name) {
    await resolveSupplierToPurchaseUpdates(client, updates, purchaseUpdates);
  }
  try {
    applyUpdatesToMachineAndPurchase(updates, machineUpdates, purchaseUpdates);
    await resolvePrecioFobUpdate(client, purchaseId, updates, purchaseUpdates);
  } catch (validationError) {
    res.status(400).json({ error: validationError.message });
    return;
  }
  await syncMachineAndEquipmentUpdates(client, purchaseId, machineId, machineUpdates);
  if (Object.keys(purchaseUpdates).length === 0) {
    const result = await client.query('SELECT * FROM purchases WHERE id = $1', [purchaseId]);
    res.json(result.rows[0]);
  } else {
    await updatePurchaseAndSendResponse(client, purchaseId, purchaseUpdates, res);
  }
}

router.use(authenticateToken);
router.use(canViewManagement);

router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : null;
    const offset = req.query.offset ? Number.parseInt(req.query.offset, 10) : 0;
    const getAll = req.query.all === 'true';
    const usePagination = getAll === false && limit > 0;

    let query = getManagementBaseQuery();
    if (usePagination) {
      query += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const result = await queryWithRetry(query);
    let total = null;
    if (usePagination) {
      const countResult = await queryWithRetry(`SELECT COUNT(*) as total ${MANAGEMENT_COUNT_WHERE}`);
      total = Number.parseInt(countResult.rows[0].total, 10);
    }

    if (total === null) {
      res.json(result.rows);
    } else {
      res.json({ data: result.rows, pagination: { total, limit, offset, hasMore: offset + limit < total } });
    }
  } catch (error) {
    console.error('Error al obtener consolidado:', error);
    res.status(500).json({ error: 'Error al obtener consolidado', details: error.message });
  }
});

// PUT /api/management/:id
// OPTIMIZACIÓN: Usa un solo cliente del pool para todas las queries para evitar agotar el pool
// Usa connectWithSemaphore para gestionar correctamente el semáforo de conexiones
router.put('/:id', async (req, res) => {
  const client = await connectWithSemaphore();
  try {
    const { id } = req.params;
    const purchaseResult = await client.query('SELECT machine_id FROM purchases WHERE id = $1', [id]);
    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase no encontrado' });
    }
    const machineId = purchaseResult.rows[0].machine_id;
    await processPutManagement(client, id, machineId, req.body, res);
  } catch (error) {
    console.error('Error al actualizar consolidado:', error);
    res.status(500).json({ error: 'Error al actualizar consolidado', details: error.message });
  } finally {
    client.release();
  }
});

export default router;

