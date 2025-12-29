import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewPagos, canEditPagos } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// GET /api/pagos - Obtener todos los pagos (registros de purchases y new_purchases con datos de pagos)
router.get('/', canViewPagos, async (req, res) => {
  try {
    // ✅ CON ESQUEMA UNIFICADO: Incluir tanto purchases como new_purchases
    const result = await pool.query(`
      SELECT 
        p.id,
        p.mq,
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
        p.model as modelo,
        p.serial as serie,
        p.empresa,
        p.ocean_pagos,
        p.trm_ocean,
        -- Campos de múltiples pagos
        p.pago1_moneda,
        p.pago1_contravalor,
        p.pago1_trm,
        p.pago1_valor_girado,
        p.pago1_tasa,
        p.pago2_moneda,
        p.pago2_contravalor,
        p.pago2_trm,
        p.pago2_valor_girado,
        p.pago2_tasa,
        p.pago3_moneda,
        p.pago3_contravalor,
        p.pago3_trm,
        p.pago3_valor_girado,
        p.pago3_tasa,
        p.total_valor_girado,
        p.created_at,
        p.updated_at
      FROM purchases p
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
        np.pago1_contravalor,
        np.pago1_trm,
        np.pago1_valor_girado,
        np.pago1_tasa,
        np.pago2_moneda,
        np.pago2_contravalor,
        np.pago2_trm,
        np.pago2_valor_girado,
        np.pago2_tasa,
        np.pago3_moneda,
        np.pago3_contravalor,
        np.pago3_trm,
        np.pago3_valor_girado,
        np.pago3_tasa,
        np.total_valor_girado,
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
  const {
    trm_rate,
    usd_jpy_rate,
    ocean_pagos,
    trm_ocean,
    payment_date,
    observaciones_pagos,
    // Campos de múltiples pagos
    pago1_moneda,
    pago1_contravalor,
    pago1_trm,
    pago1_valor_girado,
    pago1_tasa,
    pago2_moneda,
    pago2_contravalor,
    pago2_trm,
    pago2_valor_girado,
    pago2_tasa,
    pago3_moneda,
    pago3_contravalor,
    pago3_trm,
    pago3_valor_girado,
    pago3_tasa,
  } = req.body;

  try {
    // ✅ CON ESQUEMA UNIFICADO: Verificar si es purchase o new_purchase
    const previousData = await pool.query('SELECT * FROM purchases WHERE id = $1', [id]);
    const previousNewPurchase = await pool.query('SELECT * FROM new_purchases WHERE id = $1', [id]);
    
    if (previousData.rows.length === 0 && previousNewPurchase.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    
    // Si es new_purchase, actualizar new_purchases
    if (previousNewPurchase.rows.length > 0) {
      const oldData = previousNewPurchase.rows[0];
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (payment_date !== undefined) {
        updateFields.push(`payment_date = $${paramIndex}`);
        updateValues.push(payment_date);
        paramIndex++;
      }

      // ✅ Agregar contravalor (usd_jpy_rate) y TRM (trm_rate) desde pagos
      // Nota: Estas columnas fueron agregadas en la migración 20251223_add_rate_fields_to_new_purchases.sql
      if (usd_jpy_rate !== undefined) {
        updateFields.push(`usd_jpy_rate = $${paramIndex}`);
        updateValues.push(usd_jpy_rate);
        paramIndex++;
      }

      if (trm_rate !== undefined) {
        updateFields.push(`trm_rate = $${paramIndex}`);
        updateValues.push(trm_rate);
        paramIndex++;
      }

      if (ocean_pagos !== undefined) {
        updateFields.push(`ocean_pagos = $${paramIndex}`);
        updateValues.push(ocean_pagos);
        paramIndex++;
      }

      if (trm_ocean !== undefined) {
        updateFields.push(`trm_ocean = $${paramIndex}`);
        updateValues.push(trm_ocean);
        paramIndex++;
      }

      if (observaciones_pagos !== undefined) {
        updateFields.push(`observaciones_pagos = $${paramIndex}`);
        updateValues.push(observaciones_pagos);
        paramIndex++;
      }

      // Campos de múltiples pagos (agregados en migración 20251223_add_payment_fields_to_new_purchases.sql)
      if (pago1_moneda !== undefined) {
        updateFields.push(`pago1_moneda = $${paramIndex}`);
        updateValues.push(pago1_moneda);
        paramIndex++;
      }
      if (pago1_contravalor !== undefined) {
        updateFields.push(`pago1_contravalor = $${paramIndex}`);
        updateValues.push(pago1_contravalor);
        paramIndex++;
      }
      if (pago1_trm !== undefined) {
        updateFields.push(`pago1_trm = $${paramIndex}`);
        updateValues.push(pago1_trm);
        paramIndex++;
      }
      if (pago1_valor_girado !== undefined) {
        updateFields.push(`pago1_valor_girado = $${paramIndex}`);
        updateValues.push(pago1_valor_girado);
        paramIndex++;
      }
      if (pago1_tasa !== undefined) {
        updateFields.push(`pago1_tasa = $${paramIndex}`);
        updateValues.push(pago1_tasa);
        paramIndex++;
      }
      if (pago2_moneda !== undefined) {
        updateFields.push(`pago2_moneda = $${paramIndex}`);
        updateValues.push(pago2_moneda);
        paramIndex++;
      }
      if (pago2_contravalor !== undefined) {
        updateFields.push(`pago2_contravalor = $${paramIndex}`);
        updateValues.push(pago2_contravalor);
        paramIndex++;
      }
      if (pago2_trm !== undefined) {
        updateFields.push(`pago2_trm = $${paramIndex}`);
        updateValues.push(pago2_trm);
        paramIndex++;
      }
      if (pago2_valor_girado !== undefined) {
        updateFields.push(`pago2_valor_girado = $${paramIndex}`);
        updateValues.push(pago2_valor_girado);
        paramIndex++;
      }
      if (pago2_tasa !== undefined) {
        updateFields.push(`pago2_tasa = $${paramIndex}`);
        updateValues.push(pago2_tasa);
        paramIndex++;
      }
      if (pago3_moneda !== undefined) {
        updateFields.push(`pago3_moneda = $${paramIndex}`);
        updateValues.push(pago3_moneda);
        paramIndex++;
      }
      if (pago3_contravalor !== undefined) {
        updateFields.push(`pago3_contravalor = $${paramIndex}`);
        updateValues.push(pago3_contravalor);
        paramIndex++;
      }
      if (pago3_trm !== undefined) {
        updateFields.push(`pago3_trm = $${paramIndex}`);
        updateValues.push(pago3_trm);
        paramIndex++;
      }
      if (pago3_valor_girado !== undefined) {
        updateFields.push(`pago3_valor_girado = $${paramIndex}`);
        updateValues.push(pago3_valor_girado);
        paramIndex++;
      }
      if (pago3_tasa !== undefined) {
        updateFields.push(`pago3_tasa = $${paramIndex}`);
        updateValues.push(pago3_tasa);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id);

      const result = await pool.query(
        `UPDATE new_purchases SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        updateValues
      );

      const newPurchaseData = result.rows[0];

      // Calcular total_valor_girado usando los valores actualizados (si fueron enviados) o los valores actuales de la BD
      const valorGirado1 = pago1_valor_girado !== undefined ? (Number(pago1_valor_girado) || 0) : (Number(newPurchaseData.pago1_valor_girado) || 0);
      const valorGirado2 = pago2_valor_girado !== undefined ? (Number(pago2_valor_girado) || 0) : (Number(newPurchaseData.pago2_valor_girado) || 0);
      const valorGirado3 = pago3_valor_girado !== undefined ? (Number(pago3_valor_girado) || 0) : (Number(newPurchaseData.pago3_valor_girado) || 0);
      
      const totalValorGirado = valorGirado1 + valorGirado2 + valorGirado3;

      console.log(`🔍 Calculando total_valor_girado para new_purchase: P1=${valorGirado1}, P2=${valorGirado2}, P3=${valorGirado3}, Total=${totalValorGirado}`);

      // Actualizar total_valor_girado en new_purchases
      try {
        await pool.query(
          `UPDATE new_purchases 
           SET total_valor_girado = $1, updated_at = NOW()
           WHERE id = $2`,
          [totalValorGirado, id]
        );
        console.log(`✅ Actualizado total_valor_girado (${totalValorGirado}) en new_purchase (ID: ${id})`);
      } catch (syncError) {
        console.error('⚠️ Error actualizando total_valor_girado en new_purchase (no crítico):', syncError);
      }

      // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Si existe un purchase relacionado por MQ, sincronizar también
      if (newPurchaseData.mq) {
        try {
          // ✅ Buscar TODOS los purchases con el mismo MQ
          const purchaseCheck = await pool.query(
            'SELECT id FROM purchases WHERE mq = $1',
            [newPurchaseData.mq]
          );

          if (purchaseCheck.rows.length > 0) {
            // ✅ Actualizar TODOS los purchases con el mismo MQ
            const purchaseUpdates = [];
            const purchaseUpdateValues = [];
            let purchaseParamIndex = 1;

            if (payment_date !== undefined) {
              purchaseUpdates.push(`payment_date = $${purchaseParamIndex}`);
              purchaseUpdateValues.push(payment_date);
              purchaseParamIndex++;
            }

            if (usd_jpy_rate !== undefined) {
              purchaseUpdates.push(`usd_jpy_rate = $${purchaseParamIndex}`);
              purchaseUpdateValues.push(usd_jpy_rate);
              purchaseParamIndex++;
            }

            if (trm_rate !== undefined) {
              purchaseUpdates.push(`trm_rate = $${purchaseParamIndex}`);
              purchaseUpdateValues.push(trm_rate);
              purchaseParamIndex++;
            }

            if (purchaseUpdates.length > 0) {
              // Actualizar TODOS los purchases con el mismo MQ
              purchaseUpdateValues.push(newPurchaseData.mq);
              const result = await pool.query(
                `UPDATE purchases 
                 SET ${purchaseUpdates.join(', ')}, updated_at = NOW()
                 WHERE mq = $${purchaseParamIndex}
                 RETURNING id`,
                purchaseUpdateValues
              );
              const syncedFields = ['payment_date'];
              if (usd_jpy_rate !== undefined) syncedFields.push('usd_jpy_rate');
              if (trm_rate !== undefined) syncedFields.push('trm_rate');
              console.log(`✅ Sincronizado ${syncedFields.join(', ')} desde new_purchases a ${result.rows.length} purchase(s) (MQ: ${newPurchaseData.mq})`);
            }
          }
          
          // Sincronizar también a equipments
          try {
            await pool.query(
              `UPDATE equipments 
               SET payment_date = $1, updated_at = NOW()
               WHERE new_purchase_id = $2 OR (purchase_id IS NOT NULL AND EXISTS (
                 SELECT 1 FROM purchases p WHERE p.id = equipments.purchase_id AND p.mq = $3
               ))`,
              [payment_date || null, id, newPurchaseData.mq]
            );
            console.log(`✅ Sincronizado payment_date a equipments desde new_purchases (MQ: ${newPurchaseData.mq})`);
          } catch (equipError) {
            console.error('⚠️ Error sincronizando a equipments (no crítico):', equipError);
          }
        } catch (syncError) {
          console.error('⚠️ Error sincronizando a purchases (no crítico):', syncError);
        }
      }

      // Recargar datos actualizados para incluir total_valor_girado
      const updatedData = await pool.query(
        'SELECT * FROM new_purchases WHERE id = $1',
        [id]
      );
      const finalData = updatedData.rows[0] || newPurchaseData;

      res.json({
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
        // Campos de múltiples pagos
        pago1_moneda: finalData.pago1_moneda || null,
        pago1_contravalor: finalData.pago1_contravalor || null,
        pago1_trm: finalData.pago1_trm || null,
        pago1_valor_girado: finalData.pago1_valor_girado || null,
        pago1_tasa: finalData.pago1_tasa || null,
        pago2_moneda: finalData.pago2_moneda || null,
        pago2_contravalor: finalData.pago2_contravalor || null,
        pago2_trm: finalData.pago2_trm || null,
        pago2_valor_girado: finalData.pago2_valor_girado || null,
        pago2_tasa: finalData.pago2_tasa || null,
        pago3_moneda: finalData.pago3_moneda || null,
        pago3_contravalor: finalData.pago3_contravalor || null,
        pago3_trm: finalData.pago3_trm || null,
        pago3_valor_girado: finalData.pago3_valor_girado || null,
        pago3_tasa: finalData.pago3_tasa || null,
        total_valor_girado: finalData.total_valor_girado || null,
        created_at: finalData.created_at,
        updated_at: finalData.updated_at
      });
      return;
    }
    
    // Si es purchase, continuar con la lógica original
    const oldData = previousData.rows[0];
    const mqValue = oldData.mq; // Guardar MQ antes del UPDATE para sincronización

    // Solo actualizar los campos editables: trm_rate, usd_jpy_rate, payment_date, observaciones_pagos
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (trm_rate !== undefined) {
      updateFields.push(`trm_rate = $${paramIndex}`);
      updateValues.push(trm_rate);
      paramIndex++;
    }

      if (ocean_pagos !== undefined) {
        updateFields.push(`ocean_pagos = $${paramIndex}`);
        updateValues.push(ocean_pagos);
        paramIndex++;
      }

      if (trm_ocean !== undefined) {
        updateFields.push(`trm_ocean = $${paramIndex}`);
        updateValues.push(trm_ocean);
      paramIndex++;
    }

    if (usd_jpy_rate !== undefined) {
      updateFields.push(`usd_jpy_rate = $${paramIndex}`);
      updateValues.push(usd_jpy_rate);
      paramIndex++;
    }

    if (payment_date !== undefined) {
      updateFields.push(`payment_date = $${paramIndex}`);
      updateValues.push(payment_date);
      paramIndex++;
    }

    if (observaciones_pagos !== undefined) {
      updateFields.push(`observaciones_pagos = $${paramIndex}`);
      updateValues.push(observaciones_pagos);
      paramIndex++;
    }

    // Campos de múltiples pagos
    if (pago1_moneda !== undefined) {
      updateFields.push(`pago1_moneda = $${paramIndex}`);
      updateValues.push(pago1_moneda);
      paramIndex++;
    }
    if (pago1_contravalor !== undefined) {
      updateFields.push(`pago1_contravalor = $${paramIndex}`);
      updateValues.push(pago1_contravalor);
      paramIndex++;
    }
    if (pago1_trm !== undefined) {
      updateFields.push(`pago1_trm = $${paramIndex}`);
      updateValues.push(pago1_trm);
      paramIndex++;
    }
    if (pago1_valor_girado !== undefined) {
      updateFields.push(`pago1_valor_girado = $${paramIndex}`);
      updateValues.push(pago1_valor_girado);
      paramIndex++;
    }
    if (pago1_tasa !== undefined) {
      updateFields.push(`pago1_tasa = $${paramIndex}`);
      updateValues.push(pago1_tasa);
      paramIndex++;
    }
    if (pago2_moneda !== undefined) {
      updateFields.push(`pago2_moneda = $${paramIndex}`);
      updateValues.push(pago2_moneda);
      paramIndex++;
    }
    if (pago2_contravalor !== undefined) {
      updateFields.push(`pago2_contravalor = $${paramIndex}`);
      updateValues.push(pago2_contravalor);
      paramIndex++;
    }
    if (pago2_trm !== undefined) {
      updateFields.push(`pago2_trm = $${paramIndex}`);
      updateValues.push(pago2_trm);
      paramIndex++;
    }
    if (pago2_valor_girado !== undefined) {
      updateFields.push(`pago2_valor_girado = $${paramIndex}`);
      updateValues.push(pago2_valor_girado);
      paramIndex++;
    }
    if (pago2_tasa !== undefined) {
      updateFields.push(`pago2_tasa = $${paramIndex}`);
      updateValues.push(pago2_tasa);
      paramIndex++;
    }
    if (pago3_moneda !== undefined) {
      updateFields.push(`pago3_moneda = $${paramIndex}`);
      updateValues.push(pago3_moneda);
      paramIndex++;
    }
    if (pago3_contravalor !== undefined) {
      updateFields.push(`pago3_contravalor = $${paramIndex}`);
      updateValues.push(pago3_contravalor);
      paramIndex++;
    }
    if (pago3_trm !== undefined) {
      updateFields.push(`pago3_trm = $${paramIndex}`);
      updateValues.push(pago3_trm);
      paramIndex++;
    }
    if (pago3_valor_girado !== undefined) {
      updateFields.push(`pago3_valor_girado = $${paramIndex}`);
      updateValues.push(pago3_valor_girado);
      paramIndex++;
    }
    if (pago3_tasa !== undefined) {
      updateFields.push(`pago3_tasa = $${paramIndex}`);
      updateValues.push(pago3_tasa);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const result = await pool.query(
      `UPDATE purchases 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const newData = result.rows[0];

    // Calcular total_valor_girado usando los valores actualizados (si fueron enviados) o los valores actuales de la BD
    const valorGirado1 = pago1_valor_girado !== undefined ? (Number(pago1_valor_girado) || 0) : (Number(newData.pago1_valor_girado) || 0);
    const valorGirado2 = pago2_valor_girado !== undefined ? (Number(pago2_valor_girado) || 0) : (Number(newData.pago2_valor_girado) || 0);
    const valorGirado3 = pago3_valor_girado !== undefined ? (Number(pago3_valor_girado) || 0) : (Number(newData.pago3_valor_girado) || 0);
    
    const totalValorGirado = valorGirado1 + valorGirado2 + valorGirado3;

    console.log(`🔍 Calculando total_valor_girado: P1=${valorGirado1}, P2=${valorGirado2}, P3=${valorGirado3}, Total=${totalValorGirado}`);

    // Actualizar total_valor_girado SOLO en el registro específico (por ID)
    // Cada máquina tiene pagos independientes, aunque compartan MQ
    try {
      const updateTotalResult = await pool.query(
        `UPDATE purchases 
         SET total_valor_girado = $1, updated_at = NOW()
         WHERE id = $2`,
        [totalValorGirado, id]
      );
      console.log(`✅ Actualizado total_valor_girado (${totalValorGirado}) en purchase específico (ID: ${id})`);
    } catch (syncError) {
      console.error('⚠️ Error actualizando total_valor_girado en purchase específico (no crítico):', syncError);
    }

    // Registrar cambios
    const changes = {};
    const fieldLabels = {
      trm_rate: 'TRM',
      usd_jpy_rate: 'Contravalor',
      payment_date: 'Fecha de Pago',
      observaciones_pagos: 'Observaciones',
      pago1_valor_girado: 'Pago 1 - Valor Girado',
      pago2_valor_girado: 'Pago 2 - Valor Girado',
      pago3_valor_girado: 'Pago 3 - Valor Girado'
    };

    for (const field of Object.keys(fieldLabels)) {
      if (oldData[field] !== newData[field]) {
        changes[field] = {
          old: oldData[field],
          new: newData[field],
          label: fieldLabels[field]
        };
      }
    }

    // Registrar cambios en la tabla change_logs
    if (Object.keys(changes).length > 0) {
      const changeEntries = Object.entries(changes).map(([field, value]) => ({
        field_name: field, // Usar el nombre del campo de la BD directamente
        field_label: value.label, // Usar el label del mapeo
        old_value: value.old,
        new_value: value.new
      }));

      // Verificar si existe la columna module_name
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'change_logs' AND column_name = 'module_name'
      `);
      const hasModuleName = columnCheck.rows.length > 0;

      const insertPromises = changeEntries.map(change => {
        if (hasModuleName) {
          return pool.query(
            `INSERT INTO change_logs 
             (table_name, record_id, field_name, field_label, old_value, new_value, changed_by, module_name, changed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              'purchases',
              id,
              change.field_name,
              change.field_label,
              String(change.old_value || ''),
              String(change.new_value || ''),
              userId,
              'pagos'
            ]
          );
        } else {
          return pool.query(
            `INSERT INTO change_logs 
             (table_name, record_id, field_name, field_label, old_value, new_value, changed_by, changed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
              'purchases',
              id,
              change.field_name,
              change.field_label,
              String(change.old_value || ''),
              String(change.new_value || ''),
              userId
            ]
          );
        }
      });

      await Promise.all(insertPromises);
      console.log(`✅ Registrados ${changeEntries.length} cambios en pagos (ID: ${id})`);
    }

    // 🔄 SINCRONIZACIÓN BIDIRECCIONAL EXISTENTE: Si es un equipo NUEVO, actualizar también new_purchases
    // EXTENDIDA: Ahora sincroniza para cualquier purchase relacionado con new_purchase por MQ (no solo NUEVO)
    if (newData.mq) {
      try {
        // ✅ Buscar TODOS los new_purchases correspondientes por MQ
        const newPurchaseCheck = await pool.query(
          'SELECT id FROM new_purchases WHERE mq = $1',
          [newData.mq]
        );

        if (newPurchaseCheck.rows.length > 0) {
          // ✅ Actualizar TODOS los new_purchases con el mismo MQ
          const newPurchaseUpdates = [];
          const newPurchaseValues = [];
          let paramIndex = 1;

          if (payment_date !== undefined) {
            newPurchaseUpdates.push(`payment_date = $${paramIndex}`);
            newPurchaseValues.push(payment_date);
            paramIndex++;
          }

          if (newPurchaseUpdates.length > 0) {
            // Actualizar TODOS los new_purchases con el mismo MQ
            newPurchaseValues.push(newData.mq);
            const result = await pool.query(
              `UPDATE new_purchases 
               SET ${newPurchaseUpdates.join(', ')}, updated_at = NOW()
               WHERE mq = $${paramIndex}
               RETURNING id`,
              newPurchaseValues
            );
            console.log(`✅ Sincronizado cambio de pagos a ${result.rows.length} new_purchase(s) (MQ: ${newData.mq})`);
          }
          
          // ✅ Sincronizar también a equipments (actualizar todos los relacionados con el MQ)
          try {
            // Actualizar todos los equipments relacionados con purchases o new_purchases con el mismo MQ
            await pool.query(
              `UPDATE equipments 
               SET payment_date = $1, updated_at = NOW()
               WHERE purchase_id = $2 OR (
                 new_purchase_id IS NOT NULL AND EXISTS (
                   SELECT 1 FROM new_purchases np 
                   WHERE np.id = equipments.new_purchase_id AND np.mq = $3
                 )
               )`,
              [payment_date || null, id, newData.mq]
            );
            console.log(`✅ Sincronizado payment_date a equipments (MQ: ${newData.mq})`);
          } catch (equipError) {
            console.error('⚠️ Error sincronizando a equipments (no crítico):', equipError);
          }
        }
      } catch (syncError) {
        // No fallar si hay error en sincronización, solo loguear
        console.error('⚠️ Error sincronizando a new_purchases (no crítico):', syncError);
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando pago:', error);
    res.status(500).json({ error: 'Error al actualizar pago' });
  }
});

// GET /api/pagos/:id - Obtener un pago específico
router.get('/:id', canViewPagos, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        p.id,
        p.mq,
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
        p.model as modelo,
        p.serial as serie,
        p.empresa,
        p.ocean_pagos,
        p.trm_ocean,
        p.pago1_moneda,
        p.pago1_contravalor,
        p.pago1_trm,
        p.pago1_valor_girado,
        p.pago1_tasa,
        p.pago2_moneda,
        p.pago2_contravalor,
        p.pago2_trm,
        p.pago2_valor_girado,
        p.pago2_tasa,
        p.pago3_moneda,
        p.pago3_contravalor,
        p.pago3_trm,
        p.pago3_valor_girado,
        p.pago3_tasa,
        p.total_valor_girado,
        p.created_at,
        p.updated_at
      FROM purchases p
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
        np.pago1_contravalor,
        np.pago1_trm,
        np.pago1_valor_girado,
        np.pago1_tasa,
        np.pago2_moneda,
        np.pago2_contravalor,
        np.pago2_trm,
        np.pago2_valor_girado,
        np.pago2_tasa,
        np.pago3_moneda,
        np.pago3_contravalor,
        np.pago3_trm,
        np.pago3_valor_girado,
        np.pago3_tasa,
        np.total_valor_girado,
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

