/**
 * Rutas de COMPRAS NUEVOS (New Purchases)
 * Módulo para compras de equipos nuevos - Jefe Comercial
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generatePurchaseOrderPDF } from '../services/pdf.service.js';
import path from 'node:path';
import fs from 'node:fs';

const router = express.Router();

router.use(authenticateToken);

// Middleware para verificar permisos de COMPRAS NUEVOS
const canViewNewPurchases = async (req, res, next) => {
  const userRole = req.user.role;
  const allowedRoles = ['admin', 'jefe_comercial', 'gerencia'];
  
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: 'No tienes permisos para ver compras nuevas' });
  }
  next();
};

const canEditNewPurchases = async (req, res, next) => {
  const userRole = req.user.role;
  const allowedRoles = ['admin', 'jefe_comercial'];
  
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: 'No tienes permisos para editar compras nuevas' });
  }
  next();
};

/** Clamp quantity between 1 and 100; returns number. */
function validateQuantity(quantity) {
  const qty = Number.parseInt(quantity, 10);
  if (Number.isNaN(qty) || qty < 1) return 1;
  if (qty > 100) return 100;
  return qty;
}

/** Resolve purchase order: use provided or generate PTQ###-AA. */
async function getGeneratedPurchaseOrder(pool, purchaseOrder) {
  if (purchaseOrder) return purchaseOrder;
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const lastOrderResult = await pool.query(`
    SELECT purchase_order FROM new_purchases
    WHERE purchase_order LIKE 'PTQ%'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  let nextNumber = 1;
  if (lastOrderResult.rows.length > 0) {
    const match = lastOrderResult.rows[0].purchase_order.match(/PTQ(\d+)-/);
    if (match) nextNumber = Number.parseInt(match[1], 10) + 1;
  }
  const generated = `PTQ${String(nextNumber).padStart(3, '0')}-${currentYear}`;
  console.log(`🔢 Orden de compra auto-generada: ${generated}`);
  return generated;
}

/** Fetch next PDTE start number from DB.
 * Uses max from both mq and serial so (model, serial) never duplicates when serial is unknown.
 */
async function getNextPdteNumber(pool) {
  const result = await pool.query(`
    SELECT GREATEST(
      COALESCE(
        (SELECT MAX(CAST(SUBSTRING(mq FROM 'PDTE-([0-9]+)') AS INTEGER))
         FROM new_purchases WHERE mq ~ '^PDTE-[0-9]+$'),
        0
      ),
      COALESCE(
        (SELECT MAX(CAST(SUBSTRING(serial FROM 'PDTE-([0-9]+)') AS INTEGER))
         FROM new_purchases WHERE serial ~ '^PDTE-[0-9]+$'),
        0
      )
    ) AS max_num
  `);
  const rawMax = result.rows[0]?.max_num;
  const maxNum = (rawMax === undefined || rawMax === null) ? 0 : Number(rawMax);
  return maxNum + 1;
}

/** Generate list of MQ strings (PDTE-#### or single mq). */
async function generateMqList(pool, mq, qty) {
  if (mq && qty === 1) return [mq];
  try {
    const startMqNumber = await getNextPdteNumber(pool);
    const list = [];
    for (let i = 0; i < qty; i++) {
      list.push(`PDTE-${String(startMqNumber + i).padStart(4, '0')}`);
    }
    const suffix = qty > 1 ? ` hasta ${list.at(-1)}` : '';
    console.log(`🔢 ${qty} MQ(s) auto-generado(s): ${list[0]}${suffix}`);
    return list;
  } catch (mqError) {
    console.error('Error al generar MQ automático:', mqError);
    const timestamp = Date.now().toString().slice(-6);
    const list = [];
    for (let i = 0; i < qty; i++) {
      list.push(`PDTE-${timestamp}${String(i + 1).padStart(2, '0')}`);
    }
    if (!mq) console.log(`⚠️ Usando MQ(s) de fallback: ${list.join(', ')}`);
    return list;
  }
}

/** Serial for one row: serial-001 or serial or currentMq. */
function computeCurrentSerial(serial, qty, index, currentMq) {
  if (serial && serial.trim() !== '') {
    return qty > 1 ? `${serial}-${String(index + 1).padStart(3, '0')}` : serial;
  }
  return currentMq;
}

const NEW_PURCHASE_FIELD_MAP = {
  mq: 'mq',
  type: 'type',
  shipment: 'shipment',
  supplier_name: 'supplier_name',
  condition: 'condition',
  brand: 'brand',
  model: 'model',
  serial: 'serial',
  machine_type: 'machine_type',
  purchase_order: 'purchase_order',
  invoice_number: 'invoice_number',
  invoice_date: 'invoice_date',
  payment_date: 'payment_date',
  due_date: 'due_date',
  machine_location: 'machine_location',
  incoterm: 'incoterm',
  currency: 'currency',
  purchase_year: 'purchase_year',
  port_of_loading: 'port_of_loading',
  port_of_embarkation: 'port_of_embarkation',
  shipment_departure_date: 'shipment_departure_date',
  shipment_arrival_date: 'shipment_arrival_date',
  nationalization_date: 'nationalization_date',
  value: 'value',
  pvp_est: 'pvp_est',
  shipping_costs: 'shipping_costs',
  finance_costs: 'finance_costs',
  mc: 'mc',
  year: 'year',
  machine_year: 'year',
  equipment_type: 'equipment_type',
  cabin_type: 'cabin_type',
  wet_line: 'wet_line',
  dozer_blade: 'dozer_blade',
  track_type: 'track_type',
  track_width: 'track_width',
  arm_type: 'arm_type',
  empresa: 'empresa',
  payment_term: 'payment_term',
  description: 'description',
  extra_specs: 'extra_specs'
};

/** Build SET clauses and values for UPDATE from updates object and field map. */
function buildUpdateParams(updates, fieldMap) {
  const setClauses = [];
  const values = [];
  let paramIndex = 1;
  const processedFields = new Set();
  Object.entries(fieldMap).forEach(([key, dbField]) => {
    if (!(key in updates) || updates[key] === undefined) return;
    if (key === 'year' && 'machine_year' in updates && updates.machine_year !== undefined) return;
    if (processedFields.has(dbField)) return;
    processedFields.add(dbField);
    setClauses.push(`${dbField} = $${paramIndex}`);
    const val = key === 'extra_specs' && typeof updates[key] === 'object'
      ? JSON.stringify(updates[key])
      : updates[key];
    values.push(val);
    paramIndex++;
  });
  setClauses.push('updated_at = NOW()');
  return { setClauses, values };
}

const PDF_RELEVANT_FIELDS = ['purchase_order', 'supplier_name', 'brand', 'model', 'serial',
  'value', 'currency', 'invoice_date', 'empresa', 'incoterm', 'payment_term', 'description'];

/** Regenerate purchase order PDF after update if relevant fields changed and path exists. */
async function regeneratePdfAfterUpdate(pool, updates, updatedPurchase) {
  const shouldRegenerate = PDF_RELEVANT_FIELDS.some(field => updates[field] !== undefined);
  if (!shouldRegenerate || !updatedPurchase.purchase_order_pdf_path) return;
  try {
    const sameOrderResult = await pool.query(
      'SELECT * FROM new_purchases WHERE purchase_order = $1 ORDER BY serial',
      [updatedPurchase.purchase_order]
    );
    if (sameOrderResult.rows.length === 0) return;
    const purchases = sameOrderResult.rows;
    const first = purchases[0];
    const paymentTerm = first.payment_term || '120 days after the BL date';
    const purchaseDescription = first.description ||
      (purchases.length > 1 ? `${purchases.length} unidades del modelo ${first.model}` : '-');
    const firstSerial = (purchases[0].serial ?? '-').toString().trim() || '-';
    const lastSerial = (purchases[purchases.length - 1].serial ?? '-').toString().trim() || '-';
    const serialLabel = purchases.length > 1
      ? `${firstSerial}-001 a ${lastSerial}`
      : firstSerial;
    const pdfPath = await generatePurchaseOrderPDF({
      purchase_order: first.purchase_order,
      supplier_name: first.supplier_name,
      brand: first.brand,
      model: first.model,
      serial: serialLabel,
      quantity: purchases.length,
      value: first.value || 0,
      currency: first.currency || 'USD',
      invoice_date: first.invoice_date,
      empresa: first.empresa || 'Partequipos Maquinaria',
      incoterm: first.incoterm || 'EXW',
      payment_term: paymentTerm,
      payment_days: '120',
      description: purchaseDescription
    });
    await pool.query(
      'UPDATE new_purchases SET purchase_order_pdf_path = $1 WHERE purchase_order = $2',
      [pdfPath, first.purchase_order]
    );
    console.log('✅ PDF de orden de compra regenerado después de actualización');
  } catch (pdfError) {
    console.warn('⚠️ Error regenerando PDF (continuando sin regenerar):', pdfError);
  }
}

// =====================================================
// GET /api/new-purchases - Obtener todas las compras nuevas
// =====================================================
router.get('/', canViewNewPurchases, async (req, res) => {
  try {
    console.log('📥 GET /api/new-purchases - Obteniendo compras nuevas...');
    
    const result = await pool.query(`
      SELECT 
        np.*,
        up.full_name as created_by_name,
        up.email as created_by_email,
        e.id as synced_equipment_id
      FROM new_purchases np
      LEFT JOIN users_profile up ON np.created_by = up.id
      LEFT JOIN equipments e ON np.synced_to_equipment_id = e.id
      ORDER BY np.created_at DESC
    `);

    console.log(`✅ ${result.rows.length} compras nuevas encontradas`);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo compras nuevas:', error);
    res.status(500).json({ error: 'Error obteniendo compras nuevas' });
  }
});

// =====================================================
// GET /api/new-purchases/:id - Obtener una compra nueva específica
// =====================================================
router.get('/:id', canViewNewPurchases, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 GET /api/new-purchases/${id}`);
    
    const result = await pool.query(`
      SELECT 
        np.*,
        up.full_name as created_by_name,
        up.email as created_by_email,
        e.id as synced_equipment_id
      FROM new_purchases np
      LEFT JOIN users_profile up ON np.created_by = up.id
      LEFT JOIN equipments e ON np.synced_to_equipment_id = e.id
      WHERE np.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compra nueva no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error obteniendo compra nueva:', error);
    res.status(500).json({ error: 'Error obteniendo compra nueva' });
  }
});

/** Genera PDF de orden de compra y actualiza las compras creadas con la ruta. Devuelve pdfPath o null. */
async function generateAndAttachPurchaseOrderPdf(pool, opts) {
  const {
    generatedPurchaseOrder,
    createdPurchases,
    qty,
    model,
    serial,
    supplier_name,
    brand,
    invoice_date,
    empresa,
    incoterm,
    value,
    currency
  } = opts;
  if (!generatedPurchaseOrder || !createdPurchases?.length) return null;
  try {
    const firstPurchase = createdPurchases[0];
    const purchaseDataResult = await pool.query(
      'SELECT payment_term, description FROM new_purchases WHERE id = $1',
      [firstPurchase.id]
    );
    const purchaseData = purchaseDataResult.rows[0];
    const paymentTerm = purchaseData?.payment_term || '120 days after the BL date';
    const purchaseDescription = purchaseData?.description || (qty > 1 ? `${qty} unidades del modelo ${model}` : '-');
    const serialSafe = (serial != null && String(serial).trim() !== '') ? String(serial).trim() : '-';
    const serialLabel = qty > 1 ? `${serialSafe}-001 a ${serialSafe}-${String(qty).padStart(3, '0')}` : serialSafe;

    const pdfPath = await generatePurchaseOrderPDF({
      purchase_order: generatedPurchaseOrder,
      supplier_name,
      brand,
      model,
      serial: serialLabel,
      quantity: qty,
      value: value || 0,
      currency: currency || 'USD',
      invoice_date,
      empresa: empresa || 'Partequipos Maquinaria',
      incoterm: incoterm || 'EXW',
      payment_term: paymentTerm,
      payment_days: '120',
      description: purchaseDescription
    });

    await Promise.all(createdPurchases.map(purchase =>
      pool.query('UPDATE new_purchases SET purchase_order_pdf_path = $1 WHERE id = $2', [pdfPath, purchase.id])
    ));
    console.log('✅ PDF de orden de compra generado y guardado');
    return pdfPath;
  } catch (pdfError) {
    console.error('⚠️ Error generando PDF (continuando sin PDF):', pdfError);
    return null;
  }
}

// =====================================================
// POST /api/new-purchases - Crear una compra nueva
// =====================================================
router.post('/', canEditNewPurchases, async (req, res) => {
  try {
    const {
      mq, type, shipment, supplier_name, condition,
      brand, model, serial, machine_type, purchase_order, invoice_number,
      invoice_date, payment_date, machine_location, incoterm,
      currency, purchase_year, port_of_loading, port_of_embarkation, shipment_departure_date,
      shipment_arrival_date, value, pvp_est, mc, quantity = 1, empresa, year, machine_year,
      cabin_type, wet_line, dozer_blade, track_type, track_width, arm_type, payment_term, description,
      extra_specs: extra_specs_body
    } = req.body;

    console.log('📝 POST /api/new-purchases - Creando compra nueva:', { mq, model, serial, quantity, empresa });

    if (!supplier_name || !model) {
      return res.status(400).json({ error: 'Campos requeridos: Proveedor, Modelo' });
    }

    const generatedPurchaseOrder = await getGeneratedPurchaseOrder(pool, purchase_order);
    const qty = validateQuantity(quantity);
    console.log('📝 POST /api/new-purchases - Cantidad validada:', qty, '(original:', quantity, ')');

    const generatedMqs = await generateMqList(pool, mq, qty);
    const createdPurchases = [];
    const extraSpecsVal = (extra_specs_body != null && typeof extra_specs_body === 'object')
      ? JSON.stringify(extra_specs_body)
      : '{}';

    for (let i = 0; i < qty; i++) {
      const currentMq = generatedMqs[i];
      const currentSerial = computeCurrentSerial(serial, qty, i, currentMq);

    const result = await pool.query(`
      INSERT INTO new_purchases (
        mq, type, shipment, supplier_name, condition,
        brand, model, serial, machine_type, purchase_order, invoice_number,
        invoice_date, payment_date, machine_location, incoterm,
        currency, purchase_year, port_of_loading, port_of_embarkation, shipment_departure_date,
        shipment_arrival_date, value, pvp_est, mc, empresa, year, created_by,
        cabin_type, wet_line, dozer_blade, track_type, track_width, arm_type, payment_term, description,
        extra_specs
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)
      RETURNING *
    `, [
      currentMq, type || 'COMPRA DIRECTA', shipment, supplier_name, condition || 'NUEVO',
      brand, model, currentSerial, machine_type, generatedPurchaseOrder, invoice_number,
      invoice_date, payment_date, machine_location, incoterm,
      currency || 'USD', purchase_year ?? null, port_of_loading, port_of_embarkation || null, shipment_departure_date,
      shipment_arrival_date, value, pvp_est ?? null, mc, empresa, machine_year || year || null, req.user.id,
      cabin_type, wet_line, dozer_blade, track_type, track_width, arm_type || 'ESTANDAR', payment_term || null, description || null,
      extraSpecsVal
    ]);

      createdPurchases.push(result.rows[0]);
    }

    console.log(`✅ ${createdPurchases.length} compra(s) nueva(s) creada(s)`);

    // Notificar a Pagos cuando se crea un new_purchase con valor (mismo evento que al actualizar precios)
    try {
      const { triggerNotificationForEvent } = await import('../services/notificationTriggers.js');
      for (const row of createdPurchases) {
        const numValue = row.value != null && row.value !== '' ? Number(row.value) : Number.NaN;
        const hasValue = !Number.isNaN(numValue) && numValue > 0;
        if (hasValue) {
          await triggerNotificationForEvent('purchase_price_fields_changed', {
            recordId: row.id,
            mq: (row.mq ?? '').toString().trim() || 'N/A',
            model: (row.model ?? '').toString().trim() || 'N/A',
            serial: (row.serial ?? '').toString().trim() || 'N/A'
          });
        }
      }
    } catch (error_) {
      console.error('Error al notificar a Pagos por nueva compra (new_purchases):', error_);
    }

    const pdfPath = await generateAndAttachPurchaseOrderPdf(pool, {
      generatedPurchaseOrder,
      createdPurchases,
      qty,
      model,
      serial,
      supplier_name,
      brand,
      invoice_date,
      empresa,
      incoterm,
      value,
      currency
    });

    res.status(201).json({
      purchases: createdPurchases,
      count: createdPurchases.length,
      pdf_path: pdfPath
    });
  } catch (error) {
    console.error('❌ Error creando compra nueva:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ 
        error: 'Ya existe una compra con ese Modelo/Serial (el MQ puede repetirse)' 
      });
    }
    
    res.status(500).json({ error: 'Error creando compra nueva', details: error.message });
  }
});

// =====================================================
// POST /api/new-purchases/bulk-upload - Carga masiva (800+ registros en lotes)
// =====================================================
const BULK_BATCH_SIZE = 100;

function trimOpt(val) {
  return val != null && String(val).trim() !== '' ? String(val).trim() : null;
}
function numOpt(val) {
  return val != null && val !== '' ? Number(val) : null;
}
function intOpt(val) {
  return val != null && val !== '' ? Number.parseInt(val, 10) : null;
}

/** Parse one bulk row into insert params; returns { params, ctx, validationError }. */
function parseBulkRow(r, rowNum, ctx) {
  const supplier_name = trimOpt(r.supplier_name);
  const model = trimOpt(r.model);
  if (!supplier_name || !model) {
    return { validationError: `Fila ${rowNum}: Se requieren PROVEEDOR y MODELO.`, ctx: { ...ctx, nextMqNum: ctx.nextMqNum + 1, nextOcNum: ctx.nextOcNum + 1 } };
  }
  const mq = trimOpt(r.mq) || `PDTE-${String(ctx.nextMqNum).padStart(4, '0')}`;
  const purchase_order = trimOpt(r.purchase_order) || `PTQ${String(ctx.nextOcNum).padStart(3, '0')}-${ctx.currentYear}`;
  const serial = trimOpt(r.serial) || mq;
  const condition = (r.condition || 'NUEVO').toString().toUpperCase().trim() === 'USADO' ? 'USADO' : 'NUEVO';
  const params = {
    mq,
    purchase_order,
    serial,
    supplier_name,
    model,
    condition,
    type: (r.type || 'COMPRA DIRECTA').toString().trim(),
    currency: (r.currency || 'USD').toString().toUpperCase().trim(),
    value: numOpt(r.value),
    shipping_costs: numOpt(r.shipping_costs),
    finance_costs: numOpt(r.finance_costs),
    year: intOpt(r.year),
    description: trimOpt(r.description || r.spec),
    invoice_date: r.invoice_date || null,
    due_date: r.due_date || null,
    machine_type: trimOpt(r.machine_type),
    brand: trimOpt(r.brand),
    incoterm: trimOpt(r.incoterm),
    machine_location: trimOpt(r.machine_location),
    port_of_loading: trimOpt(r.port_of_loading),
    invoice_number: trimOpt(r.invoice_number),
    cabin_type: trimOpt(r.cabin_type),
    wet_line: r.wet_line ? String(r.wet_line).trim().toUpperCase() : null,
    dozer_blade: r.dozer_blade ? String(r.dozer_blade).trim().toUpperCase() : null,
    track_type: trimOpt(r.track_type),
    track_width: trimOpt(r.track_width),
    arm_type: trimOpt(r.arm_type) || 'ESTANDAR'
  };
  return { params, ctx: { ...ctx, nextMqNum: ctx.nextMqNum + 1, nextOcNum: ctx.nextOcNum + 1 } };
}

/** Insert one bulk row; returns error message or null on success. */
async function insertBulkRow(pool, params, userId) {
  try {
    await pool.query(`
      INSERT INTO new_purchases (
        mq, type, shipment, supplier_name, condition,
        brand, model, serial, machine_type, purchase_order, invoice_number,
        invoice_date, payment_date, machine_location, incoterm,
        currency, port_of_loading, port_of_embarkation, shipment_departure_date,
        shipment_arrival_date, value, mc, empresa, year, created_by,
        cabin_type, wet_line, dozer_blade, track_type, track_width, arm_type, payment_term, description,
        due_date, shipping_costs, finance_costs
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36
      )
    `, [
      params.mq, params.type || 'COMPRA DIRECTA', null, params.supplier_name, params.condition,
      params.brand, params.model, params.serial, params.machine_type, params.purchase_order, params.invoice_number,
      params.invoice_date, null, params.machine_location, params.incoterm,
      params.currency, params.port_of_loading, null, null, null,
      params.value, null, null, params.year, userId,
      params.cabin_type, params.wet_line, params.dozer_blade, params.track_type, params.track_width, params.arm_type, null, params.description,
      params.due_date, params.shipping_costs, params.finance_costs
    ]);
    return null;
  } catch (error_) {
    if (error_.code === '23505') {
      return `Ya existe modelo/serial (${params.model}/${params.serial}).`;
    }
    return error_.message;
  }
}

/** Process one bulk record; returns { inserted, error, ctx }. */
async function processOneBulkRecord(pool, record, rowNum, ctx, userId) {
  const parsed = parseBulkRow(record, rowNum, ctx);
  if (parsed.validationError) {
    return { inserted: 0, error: parsed.validationError, ctx: parsed.ctx };
  }
  const errMsg = await insertBulkRow(pool, parsed.params, userId);
  const error = errMsg ? `Fila ${rowNum}: ${errMsg}` : null;
  return { inserted: errMsg ? 0 : 1, error, ctx: parsed.ctx };
}

async function getBulkInitialContext(pool) {
  const [mqResult, ocResult] = await Promise.all([
    pool.query(`SELECT mq FROM new_purchases WHERE mq ~ '^PDTE-[0-9]+$' ORDER BY CAST(SUBSTRING(mq FROM 'PDTE-([0-9]+)') AS INTEGER) DESC LIMIT 1`),
    pool.query(`SELECT purchase_order FROM new_purchases WHERE purchase_order LIKE 'PTQ%' ORDER BY created_at DESC LIMIT 1`)
  ]);
  let nextMqNum = 1;
  if (mqResult.rows.length > 0) {
    const match = mqResult.rows[0].mq.match(/PDTE-(\d+)/);
    if (match) nextMqNum = Number.parseInt(match[1], 10) + 1;
  }
  let nextOcNum = 1;
  if (ocResult.rows.length > 0) {
    const match = ocResult.rows[0].purchase_order.match(/PTQ(\d+)-/);
    if (match) nextOcNum = Number.parseInt(match[1], 10) + 1;
  }
  const currentYear = new Date().getFullYear().toString().slice(-2);
  return { nextMqNum, nextOcNum, currentYear };
}

router.post('/bulk-upload', canEditNewPurchases, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array "records" con al menos un registro.' });
    }
    console.log(`📤 POST /api/new-purchases/bulk-upload - ${records.length} registro(s)`);

    let ctx = await getBulkInitialContext(pool);
    const errors = [];
    let inserted = 0;

    for (let b = 0; b < records.length; b += BULK_BATCH_SIZE) {
      const batch = records.slice(b, b + BULK_BATCH_SIZE);
      for (let i = 0; i < batch.length; i++) {
        const rowNum = b + i + 1;
        const result = await processOneBulkRecord(pool, batch[i], rowNum, ctx, req.user.id);
        ctx = result.ctx;
        if (result.error) errors.push(result.error);
        inserted += result.inserted;
      }
    }

    console.log(`✅ bulk-upload: ${inserted} insertado(s), ${errors.length} error(es)`);
    res.json({ success: true, inserted, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('❌ Error en bulk-upload new-purchases:', error);
    res.status(500).json({ error: 'Error en carga masiva', details: error.message });
  }
});

// =====================================================
// PUT /api/new-purchases/:id - Actualizar una compra nueva
// =====================================================
router.put('/:id', canEditNewPurchases, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`📝 PUT /api/new-purchases/${id} - Actualizando compra nueva`);
    console.log('📦 Updates recibidos:', JSON.stringify(updates, null, 2));

    const check = await pool.query('SELECT id FROM new_purchases WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Compra nueva no encontrada' });
    }

    const { setClauses, values } = buildUpdateParams(updates, NEW_PURCHASE_FIELD_MAP);
    values.push(id);

    if (setClauses.length === 1) {
      // Solo updated_at, no hay nada que actualizar
      const result = await pool.query('SELECT * FROM new_purchases WHERE id = $1', [id]);
      return res.json(result.rows[0]);
    }

    const paramIndex = setClauses.length;
    const query = `
      UPDATE new_purchases SET
        ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    console.log('🔧 Query SQL:', query);
    console.log('📊 Valores:', values);

    const result = await pool.query(query, values);

    console.log('✅ Compra nueva actualizada:', id);

    await regeneratePdfAfterUpdate(pool, updates, result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error actualizando compra nueva:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({ 
        error: 'Ya existe una compra con ese MQ o Modelo/Serial' 
      });
    }
    
    res.status(500).json({ error: 'Error actualizando compra nueva' });
  }
});

// =====================================================
// DELETE /api/new-purchases/:id - Eliminar una compra nueva
// =====================================================
// GET /api/new-purchases/:id/pdf - Descargar PDF de orden de compra
// =====================================================
router.get('/:id/pdf', canViewNewPurchases, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT purchase_order_pdf_path FROM new_purchases WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compra nueva no encontrada' });
    }

    const pdfPath = result.rows[0].purchase_order_pdf_path;
    
    if (!pdfPath) {
      return res.status(404).json({ error: 'No hay PDF de orden de compra para esta compra' });
    }

    // Si está en producción y usa Supabase Storage, redirigir a la URL pública
    if (process.env.NODE_ENV === 'production' || process.env.SUPABASE_STORAGE_ENABLED === 'true') {
      const storageService = (await import('../services/storage.service.js')).default;
      // pdfPath puede venir como "pdfs/filename.pdf" o solo "filename.pdf"
      let filePathInBucket = pdfPath;
      if (filePathInBucket.startsWith('pdfs/')) {
        filePathInBucket = filePathInBucket.replace('pdfs/', '');
      }
      const publicUrl = storageService.getPublicUrl('new-purchase-files', `pdfs/${filePathInBucket}`);
      return res.redirect(publicUrl);
    }

    // Desarrollo local: servir desde disco
    const fullPath = path.join(process.cwd(), 'storage', pdfPath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Archivo PDF no encontrado' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="orden-compra-${id}.pdf"`);
    res.sendFile(fullPath);
  } catch (error) {
    console.error('❌ Error descargando PDF:', error);
    res.status(500).json({ error: 'Error al descargar PDF' });
  }
});

// =====================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Admin o jefe_comercial pueden eliminar
    if (req.user.role !== 'admin' && req.user.role !== 'jefe_comercial') {
      return res.status(403).json({ error: 'Solo admin o jefe_comercial pueden eliminar compras nuevas' });
    }

    console.log(`🗑️ DELETE /api/new-purchases/${id}`);

    // Primero eliminar el equipment asociado (si existe) para evitar violación del constraint
    // El constraint requiere que al menos uno de purchase_id o new_purchase_id sea NOT NULL
    await pool.query(
      `DELETE FROM equipments WHERE new_purchase_id = $1`,
      [id]
    );

    // También eliminar el service_record asociado si existe
    await pool.query(
      `DELETE FROM service_records WHERE new_purchase_id = $1`,
      [id]
    );

    // Ahora eliminar el new_purchase
    const result = await pool.query('DELETE FROM new_purchases WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compra nueva no encontrada' });
    }

    console.log('✅ Compra nueva eliminada:', id);
    res.json({ message: 'Compra nueva eliminada correctamente', deleted: result.rows[0] });
  } catch (error) {
    console.error('❌ Error eliminando compra nueva:', error);
    res.status(500).json({ error: 'Error eliminando compra nueva' });
  }
});

// =====================================================
// FUNCIONES DE SINCRONIZACIÓN BIDIRECCIONAL
// =====================================================

export default router;

