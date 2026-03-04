import express from 'express';
import { queryWithRetry } from '../db/connection.js';
import { authenticateToken, canViewPagos, canEditPagos } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/** Construye arrays de UPDATE desde req.body para reducir complejidad del PUT (SonarQube). */
function buildUpdateFromBody(body, fieldList) {
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;
  for (const field of fieldList) {
    if (body[field] !== undefined) {
      updateFields.push(`${field} = $${paramIndex}`);
      updateValues.push(body[field]);
      paramIndex += 1;
    }
  }
  return { updateFields, updateValues, paramIndex };
}

const NEW_PURCHASE_PUT_FIELDS = [
  'payment_date', 'usd_jpy_rate', 'trm_rate', 'ocean_pagos', 'trm_ocean', 'observaciones_pagos',
  'pago1_moneda', 'pago1_fecha', 'pago1_contravalor', 'pago1_trm', 'pago1_valor_girado', 'pago1_tasa',
  'pago2_moneda', 'pago2_fecha', 'pago2_contravalor', 'pago2_trm', 'pago2_valor_girado', 'pago2_tasa',
  'pago3_moneda', 'pago3_fecha', 'pago3_contravalor', 'pago3_trm', 'pago3_valor_girado', 'pago3_tasa',
];

const PURCHASE_PUT_FIELDS = [
  'trm_rate', 'ocean_pagos', 'trm_ocean', 'usd_jpy_rate', 'payment_date', 'observaciones_pagos',
  'shipment_type_v2', 'exw_value_formatted', 'fob_expenses', 'disassembly_load_value',
  'pago1_moneda', 'pago1_fecha', 'pago1_contravalor', 'pago1_trm', 'pago1_valor_girado', 'pago1_tasa',
  'pago2_moneda', 'pago2_fecha', 'pago2_contravalor', 'pago2_trm', 'pago2_valor_girado', 'pago2_tasa',
  'pago3_moneda', 'pago3_fecha', 'pago3_contravalor', 'pago3_trm', 'pago3_valor_girado', 'pago3_tasa',
];

const SYNC_PUT_FIELDS = ['payment_date', 'usd_jpy_rate', 'trm_rate'];

function buildSyncUpdatesFromBody(body) {
  return buildUpdateFromBody(body, SYNC_PUT_FIELDS);
}

function mapNewPurchaseToResponse(finalData) {
  return {
    id: finalData.id,
    mq: finalData.mq,
    condition: finalData.condition,
    no_factura: finalData.invoice_number,
    fecha_factura: finalData.invoice_date,
    proveedor: finalData.supplier_name,
    moneda: finalData.currency,
    tasa: finalData.trm_rate || 0,
    trm_rate: finalData.trm_rate || 0,
    usd_jpy_rate: finalData.usd_jpy_rate || null,
    payment_date: finalData.payment_date,
    valor_factura_proveedor: null,
    observaciones_pagos: finalData.observaciones_pagos || null,
    pendiente_a: null,
    fecha_vto_fact: null,
    modelo: finalData.model,
    serie: finalData.serial,
    empresa: finalData.empresa,
    pago1_moneda: finalData.pago1_moneda || null,
    pago1_fecha: finalData.pago1_fecha || null,
    pago1_contravalor: finalData.pago1_contravalor || null,
    pago1_trm: finalData.pago1_trm || null,
    pago1_valor_girado: finalData.pago1_valor_girado || null,
    pago1_tasa: finalData.pago1_tasa || null,
    pago2_moneda: finalData.pago2_moneda || null,
    pago2_fecha: finalData.pago2_fecha || null,
    pago2_contravalor: finalData.pago2_contravalor || null,
    pago2_trm: finalData.pago2_trm || null,
    pago2_valor_girado: finalData.pago2_valor_girado || null,
    pago2_tasa: finalData.pago2_tasa || null,
    pago3_moneda: finalData.pago3_moneda || null,
    pago3_fecha: finalData.pago3_fecha || null,
    pago3_contravalor: finalData.pago3_contravalor || null,
    pago3_trm: finalData.pago3_trm || null,
    pago3_valor_girado: finalData.pago3_valor_girado || null,
    pago3_tasa: finalData.pago3_tasa || null,
    total_valor_girado: finalData.total_valor_girado || null,
    created_at: finalData.created_at,
    updated_at: finalData.updated_at
  };
}

async function putNewPurchaseHandler(req, res, id) {
  const { payment_date, pago1_valor_girado, pago2_valor_girado, pago3_valor_girado } = req.body;
  const { updateFields, updateValues, paramIndex } = buildUpdateFromBody(req.body, NEW_PURCHASE_PUT_FIELDS);
  if (updateFields.length === 0) {
    res.status(400).json({ error: 'No hay campos para actualizar' });
    return;
  }
  updateFields.push(`updated_at = NOW()`);
  updateValues.push(id);
  const result = await queryWithRetry(
    `UPDATE new_purchases SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    updateValues
  );
  const newPurchaseData = result.rows[0];
  const valorGirado1 = pago1_valor_girado === undefined ? (Number(newPurchaseData.pago1_valor_girado) || 0) : (Number(pago1_valor_girado) || 0);
  const valorGirado2 = pago2_valor_girado === undefined ? (Number(newPurchaseData.pago2_valor_girado) || 0) : (Number(pago2_valor_girado) || 0);
  const valorGirado3 = pago3_valor_girado === undefined ? (Number(newPurchaseData.pago3_valor_girado) || 0) : (Number(pago3_valor_girado) || 0);
  const totalValorGirado = valorGirado1 + valorGirado2 + valorGirado3;
  try {
    await queryWithRetry(
      `UPDATE new_purchases SET total_valor_girado = $1, updated_at = NOW() WHERE id = $2`,
      [totalValorGirado, id]
    );
  } catch (syncError) {
    console.error('⚠️ Error actualizando total_valor_girado en new_purchase (no crítico):', syncError);
  }
  if (newPurchaseData.mq) {
    try {
      const purchaseCheck = await queryWithRetry('SELECT id FROM purchases WHERE mq = $1', [newPurchaseData.mq]);
      if (purchaseCheck.rows.length > 0) {
        const { updateFields: purchaseUpdates, updateValues: purchaseUpdateValues, paramIndex: purchaseParamIndex } = buildSyncUpdatesFromBody(req.body);
        if (purchaseUpdates.length > 0) {
          purchaseUpdateValues.push(newPurchaseData.mq);
          await queryWithRetry(
            `UPDATE purchases SET ${purchaseUpdates.join(', ')}, updated_at = NOW() WHERE mq = $${purchaseParamIndex} RETURNING id`,
            purchaseUpdateValues
          );
        }
      }
      try {
        await queryWithRetry(
          `UPDATE equipments SET payment_date = $1, updated_at = NOW() WHERE new_purchase_id = $2 OR (purchase_id IS NOT NULL AND EXISTS (SELECT 1 FROM purchases p WHERE p.id = equipments.purchase_id AND p.mq = $3))`,
          [payment_date || null, id, newPurchaseData.mq]
        );
      } catch (equipError) {
        console.error('⚠️ Error sincronizando a equipments (no crítico):', equipError);
      }
    } catch (syncError) {
      console.error('⚠️ Error sincronizando a purchases (no crítico):', syncError);
    }
  }
  const updatedData = await queryWithRetry('SELECT * FROM new_purchases WHERE id = $1', [id]);
  const finalData = updatedData.rows[0] || newPurchaseData;
  res.json(mapNewPurchaseToResponse(finalData));
}

const PURCHASE_FIELD_LABELS = {
  trm_rate: 'TRM',
  usd_jpy_rate: 'Contravalor',
  payment_date: 'Fecha de Pago',
  observaciones_pagos: 'Observaciones',
  pago1_valor_girado: 'Pago 1 - Valor Girado',
  pago2_valor_girado: 'Pago 2 - Valor Girado',
  pago3_valor_girado: 'Pago 3 - Valor Girado'
};

async function insertChangeLogsForPago(id, userId, oldData, newData) {
  const changes = {};
  for (const field of Object.keys(PURCHASE_FIELD_LABELS)) {
    if (oldData[field] !== newData[field]) {
      changes[field] = { old: oldData[field], new: newData[field], label: PURCHASE_FIELD_LABELS[field] };
    }
  }
  if (Object.keys(changes).length === 0) return;
  const changeEntries = Object.entries(changes).map(([field, value]) => ({
    field_name: field,
    field_label: value.label,
    old_value: value.old,
    new_value: value.new
  }));
  const columnCheck = await queryWithRetry(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'change_logs' AND column_name IN ('module_name', 'field_label')`
  );
  const hasModuleName = columnCheck.rows.some(row => row.column_name === 'module_name');
  const hasFieldLabel = columnCheck.rows.some(row => row.column_name === 'field_label');
  const insertPromises = changeEntries.map(change => {
    const params = ['purchases', id, change.field_name];
    let columns = ['table_name', 'record_id', 'field_name'];
    let placeholders = ['$1', '$2', '$3'];
    let paramIdx = 4;
    if (hasFieldLabel) {
      columns.push('field_label');
      placeholders.push(`$${paramIdx}`);
      params.push(change.field_label || null);
      paramIdx++;
    }
    columns.push('old_value', 'new_value');
    placeholders.push(`$${paramIdx}`, `$${paramIdx + 1}`);
    params.push(String(change.old_value || ''), String(change.new_value || ''));
    paramIdx += 2;
    columns.push('changed_by');
    placeholders.push(`$${paramIdx}`);
    params.push(userId);
    paramIdx++;
    if (hasModuleName) {
      columns.push('module_name');
      placeholders.push(`$${paramIdx}`);
      params.push('pagos');
      paramIdx++;
    }
    columns.push('changed_at');
    placeholders.push(`NOW()`);
    return queryWithRetry(`INSERT INTO change_logs (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`, params);
  });
  await Promise.all(insertPromises);
}

async function syncPurchaseToNewPurchasesAndEquipments(req, id, newData) {
  if (!newData.mq) return;
  try {
    const newPurchaseCheck = await queryWithRetry('SELECT id FROM new_purchases WHERE mq = $1', [newData.mq]);
    if (newPurchaseCheck.rows.length === 0) return;
    const { payment_date } = req.body;
    const { updateFields: npUpdates, updateValues: npValues, paramIndex: npParamIndex } = buildSyncUpdatesFromBody(req.body);
    if (npUpdates.length > 0) {
      npValues.push(newData.mq);
      await queryWithRetry(
        `UPDATE new_purchases SET ${npUpdates.join(', ')}, updated_at = NOW() WHERE mq = $${npParamIndex} RETURNING id`,
        npValues
      );
    }
    try {
      await queryWithRetry(
        `UPDATE equipments SET payment_date = $1, updated_at = NOW() WHERE purchase_id = $2 OR (new_purchase_id IS NOT NULL AND EXISTS (SELECT 1 FROM new_purchases np WHERE np.id = equipments.new_purchase_id AND np.mq = $3))`,
        [payment_date || null, id, newData.mq]
      );
    } catch (equipError) {
      console.error('⚠️ Error sincronizando a equipments (no crítico):', equipError);
    }
  } catch (syncError) {
    console.error('⚠️ Error sincronizando a new_purchases (no crítico):', syncError);
  }
}

async function putPurchaseHandler(req, res, id, userId, oldData) {
  const { pago1_valor_girado, pago2_valor_girado, pago3_valor_girado } = req.body;
  const { updateFields, updateValues, paramIndex } = buildUpdateFromBody(req.body, PURCHASE_PUT_FIELDS);
  if (updateFields.length === 0) {
    res.status(400).json({ error: 'No hay campos para actualizar' });
    return;
  }
  updateFields.push(`updated_at = NOW()`);
  updateValues.push(id);
  const result = await queryWithRetry(
    `UPDATE purchases SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    updateValues
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Registro no encontrado' });
    return;
  }
  const newData = result.rows[0];
  const valorGirado1 = pago1_valor_girado === undefined ? (Number(newData.pago1_valor_girado) || 0) : (Number(pago1_valor_girado) || 0);
  const valorGirado2 = pago2_valor_girado === undefined ? (Number(newData.pago2_valor_girado) || 0) : (Number(pago2_valor_girado) || 0);
  const valorGirado3 = pago3_valor_girado === undefined ? (Number(newData.pago3_valor_girado) || 0) : (Number(pago3_valor_girado) || 0);
  const totalValorGirado = valorGirado1 + valorGirado2 + valorGirado3;
  try {
    await queryWithRetry(
      `UPDATE purchases SET total_valor_girado = $1, updated_at = NOW() WHERE id = $2`,
      [totalValorGirado, id]
    );
  } catch (syncError) {
    console.error('⚠️ Error actualizando total_valor_girado en purchase (no crítico):', syncError);
  }
  await insertChangeLogsForPago(id, userId, oldData, newData);
  await syncPurchaseToNewPurchasesAndEquipments(req, id, newData);
  res.json(result.rows[0]);
}

// GET /api/pagos - Obtener todos los pagos (registros de purchases y new_purchases con datos de pagos)
router.get('/', canViewPagos, async (req, res) => {
  try {
    // ✅ CON ESQUEMA UNIFICADO: Incluir tanto purchases como new_purchases (queryWithRetry evita fallar por Max client connections)
    const result = await queryWithRetry(`
      SELECT 
        p.id,
        COALESCE(p.mq, 'PDTE-' || LPAD((ABS(HASHTEXT(p.id::text)) % 10000)::text, 4, '0')) as mq,
        COALESCE(p.condition, 'USADO') as condition,
        p.invoice_number as no_factura,
        p.invoice_date as fecha_factura,
        -- ✅ VENCIMIENTO: obtener due_date de purchases o calcular automáticamente (invoice_date + 10 días si invoice_date existe)
        CASE 
          WHEN p.due_date IS NOT NULL THEN p.due_date::date
          WHEN p.invoice_date IS NOT NULL THEN (p.invoice_date + INTERVAL '10 days')::date
          ELSE NULL::date
        END as vencimiento,
        p.supplier_name as proveedor,
        COALESCE(p.currency_type, p.currency, 'USD') as moneda,
        p.trm as tasa,
        p.trm_rate,
        p.usd_jpy_rate,
        p.payment_date,
        p.valor_factura_proveedor,
        p.observaciones_pagos,
        p.pendiente_a,
        p.fecha_vto_fact,
        COALESCE(NULLIF(p.model, ''), m.model, '') as modelo,
        COALESCE(NULLIF(p.serial, ''), m.serial, '') as serie,
        p.empresa,
        p.ocean_pagos,
        p.trm_ocean,
        -- Campos de múltiples pagos
        p.pago1_moneda,
        p.pago1_fecha,
        p.pago1_contravalor,
        p.pago1_trm,
        p.pago1_valor_girado,
        p.pago1_tasa,
        p.pago2_moneda,
        p.pago2_fecha,
        p.pago2_contravalor,
        p.pago2_trm,
        p.pago2_valor_girado,
        p.pago2_tasa,
        p.pago3_moneda,
        p.pago3_fecha,
        p.pago3_contravalor,
        p.pago3_trm,
        p.pago3_valor_girado,
        p.pago3_tasa,
        p.total_valor_girado,
        p.shipment_type_v2,
        p.exw_value_formatted,
        p.fob_expenses,
        p.disassembly_load_value,
        -- VALOR FOB (SUMA): siempre calculado igual que PurchasesPage (exw + fob_expenses + disassembly) para que coincida entre Compras y Editar Pago; no usar p.fob_total para evitar valores desactualizados
        (
          COALESCE(NULLIF(TRIM(COALESCE(p.exw_value_formatted, '')), '')::numeric, 0) +
          COALESCE(NULLIF(TRIM(COALESCE(p.fob_expenses::text, '')), '')::numeric, 0) +
          COALESCE(p.disassembly_load_value, 0)
        ) as fob_total,
        p.created_at,
        p.updated_at
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE p.condition IN ('USADO', 'NUEVO')
      
      UNION ALL
      
      -- Incluir new_purchases (esquema unificado)
      SELECT 
        np.id,
        np.mq,
        COALESCE(np.condition, 'NUEVO') as condition,
        np.invoice_number as no_factura,
        np.invoice_date as fecha_factura,
        -- ✅ VENCIMIENTO: solo para registros de new_purchases
        np.due_date::date as vencimiento,
        np.supplier_name as proveedor,
        COALESCE(np.currency, 'USD') as moneda,
        0::numeric as tasa,
        COALESCE(np.trm_rate, 0)::numeric as trm_rate,
        np.usd_jpy_rate,
        np.payment_date,
        NULL::numeric as valor_factura_proveedor,
        np.observaciones_pagos,
        NULL::text as pendiente_a,
        NULL::date as fecha_vto_fact,
        np.model as modelo,
        np.serial as serie,
        np.empresa,
        np.ocean_pagos,
        np.trm_ocean,
        -- Campos de múltiples pagos (obtener valores reales de new_purchases)
        np.pago1_moneda,
        np.pago1_fecha,
        np.pago1_contravalor,
        np.pago1_trm,
        np.pago1_valor_girado,
        np.pago1_tasa,
        np.pago2_moneda,
        np.pago2_fecha,
        np.pago2_contravalor,
        np.pago2_trm,
        np.pago2_valor_girado,
        np.pago2_tasa,
        np.pago3_moneda,
        np.pago3_fecha,
        np.pago3_contravalor,
        np.pago3_trm,
        np.pago3_valor_girado,
        np.pago3_tasa,
        np.total_valor_girado,
        np.shipment as shipment_type_v2,
        NULL::text as exw_value_formatted,
        NULL::text as fob_expenses,
        NULL::numeric as disassembly_load_value,
        -- VALOR FOB (SUMA) para new_purchases = valor total (value + shipping_costs + finance_costs), igual que columna VALOR TOTAL en NewPurchasesPage
        (COALESCE(np.value, 0) + COALESCE(np.shipping_costs, 0) + COALESCE(np.finance_costs, 0))::numeric as fob_total,
        np.created_at,
        np.updated_at
      FROM new_purchases np
      WHERE COALESCE(np.condition, 'NUEVO') IN ('USADO', 'NUEVO')
        AND NOT EXISTS (
          -- Excluir new_purchases que ya tienen un purchase espejo (para evitar duplicados)
          SELECT 1 FROM purchases p2 WHERE p2.mq = np.mq
        )
      
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// PUT /api/pagos/:id - Actualizar un registro de pago
router.put('/:id', canEditPagos, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
  try {
    const previousData = await queryWithRetry('SELECT * FROM purchases WHERE id = $1', [id]);
    const previousNewPurchase = await queryWithRetry('SELECT * FROM new_purchases WHERE id = $1', [id]);
    if (previousData.rows.length === 0 && previousNewPurchase.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    if (previousNewPurchase.rows.length > 0) {
      return await putNewPurchaseHandler(req, res, id);
    }
    return await putPurchaseHandler(req, res, id, userId, previousData.rows[0]);
  } catch (error) {
    console.error('Error actualizando pago:', error);
    res.status(500).json({ error: 'Error al actualizar pago' });
  }
});

// GET /api/pagos/:id - Obtener un pago específico
router.get('/:id', canViewPagos, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await queryWithRetry(
      `
      SELECT 
        p.id,
        COALESCE(p.mq, 'PDTE-' || LPAD((ABS(HASHTEXT(p.id::text)) % 10000)::text, 4, '0')) as mq,
        COALESCE(p.condition, 'USADO') as condition,
        p.invoice_number as no_factura,
        p.invoice_date as fecha_factura,
        p.supplier_name as proveedor,
        COALESCE(p.currency_type, p.currency, 'USD') as moneda,
        p.trm as tasa,
        p.trm_rate,
        p.usd_jpy_rate,
        p.payment_date,
        p.valor_factura_proveedor,
        p.observaciones_pagos,
        p.pendiente_a,
        p.fecha_vto_fact,
        COALESCE(NULLIF(p.model, ''), m.model, '') as modelo,
        COALESCE(NULLIF(p.serial, ''), m.serial, '') as serie,
        p.empresa,
        p.ocean_pagos,
        p.trm_ocean,
        p.pago1_moneda,
        p.pago1_fecha,
        p.pago1_contravalor,
        p.pago1_trm,
        p.pago1_valor_girado,
        p.pago1_tasa,
        p.pago2_moneda,
        p.pago2_fecha,
        p.pago2_contravalor,
        p.pago2_trm,
        p.pago2_valor_girado,
        p.pago2_tasa,
        p.pago3_moneda,
        p.pago3_fecha,
        p.pago3_contravalor,
        p.pago3_trm,
        p.pago3_valor_girado,
        p.pago3_tasa,
        p.total_valor_girado,
        p.shipment_type_v2,
        p.exw_value_formatted,
        p.fob_expenses,
        p.disassembly_load_value,
        (COALESCE(NULLIF(TRIM(COALESCE(p.exw_value_formatted, '')), '')::numeric, 0) +
          COALESCE(NULLIF(TRIM(COALESCE(p.fob_expenses::text, '')), '')::numeric, 0) +
          COALESCE(p.disassembly_load_value, 0)) as fob_total,
        p.created_at,
        p.updated_at
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE p.id = $1
      
      UNION ALL
      
      SELECT 
        np.id,
        np.mq,
        COALESCE(np.condition, 'NUEVO') as condition,
        np.invoice_number as no_factura,
        np.invoice_date as fecha_factura,
        np.supplier_name as proveedor,
        COALESCE(np.currency, 'USD') as moneda,
        0::numeric as tasa,
        COALESCE(np.trm_rate, 0)::numeric as trm_rate,
        np.usd_jpy_rate,
        np.payment_date,
        NULL::numeric as valor_factura_proveedor,
        np.observaciones_pagos,
        NULL::text as pendiente_a,
        np.due_date::date as fecha_vto_fact,
        np.model as modelo,
        np.serial as serie,
        np.empresa,
        np.ocean_pagos,
        np.trm_ocean,
        np.pago1_moneda,
        np.pago1_fecha,
        np.pago1_contravalor,
        np.pago1_trm,
        np.pago1_valor_girado,
        np.pago1_tasa,
        np.pago2_moneda,
        np.pago2_fecha,
        np.pago2_contravalor,
        np.pago2_trm,
        np.pago2_valor_girado,
        np.pago2_tasa,
        np.pago3_moneda,
        np.pago3_fecha,
        np.pago3_contravalor,
        np.pago3_trm,
        np.pago3_valor_girado,
        np.pago3_tasa,
        np.total_valor_girado,
        np.shipment as shipment_type_v2,
        NULL::text as exw_value_formatted,
        NULL::text as fob_expenses,
        NULL::numeric as disassembly_load_value,
        (COALESCE(np.value, 0) + COALESCE(np.shipping_costs, 0) + COALESCE(np.finance_costs, 0))::numeric as fob_total,
        np.created_at,
        np.updated_at
      FROM new_purchases np
      WHERE np.id = $1
      
      LIMIT 1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo pago:', error);
    res.status(500).json({ error: 'Error al obtener pago' });
  }
});

export default router;

