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
        p.supplier_name as proveedor,
        p.currency as moneda,
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
        np.supplier_name as proveedor,
        COALESCE(np.currency, 'USD') as moneda,
        0::numeric as tasa,
        0::numeric as trm_rate,
        NULL::numeric as usd_jpy_rate,
        np.payment_date,
        NULL::numeric as valor_factura_proveedor,
        NULL::text as observaciones_pagos,
        NULL::text as pendiente_a,
        NULL::date as fecha_vto_fact,
        np.model as modelo,
        np.serial as serie,
        np.empresa,
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
    payment_date,
    observaciones_pagos
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

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id);

      const result = await pool.query(
        `UPDATE new_purchases SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        updateValues
      );

      // Los triggers sincronizarán automáticamente
      res.json({
        id: result.rows[0].id,
        mq: result.rows[0].mq,
        condition: result.rows[0].condition,
        no_factura: result.rows[0].invoice_number,
        fecha_factura: result.rows[0].invoice_date,
        proveedor: result.rows[0].supplier_name,
        moneda: result.rows[0].currency,
        tasa: 0,
        trm_rate: 0,
        usd_jpy_rate: null,
        payment_date: result.rows[0].payment_date,
        valor_factura_proveedor: null,
        observaciones_pagos: null,
        pendiente_a: null,
        fecha_vto_fact: null,
        modelo: result.rows[0].model,
        serie: result.rows[0].serial,
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].updated_at
      });
      return;
    }
    
    // Si es purchase, continuar con la lógica original
    const oldData = previousData.rows[0];

    // Solo actualizar los campos editables: trm_rate, usd_jpy_rate, payment_date, observaciones_pagos
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (trm_rate !== undefined) {
      updateFields.push(`trm_rate = $${paramIndex}`);
      updateValues.push(trm_rate);
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

    // Registrar cambios
    const changes = {};
    const fieldLabels = {
      trm_rate: 'TRM',
      usd_jpy_rate: 'Contravalor',
      payment_date: 'Fecha de Pago',
      observaciones_pagos: 'Observaciones'
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

    // Sincronización bidireccional: Si es un equipo NUEVO, actualizar también new_purchases
    if (newData.condition === 'NUEVO' && newData.mq) {
      try {
        // Buscar el new_purchase correspondiente por MQ
        const newPurchaseCheck = await pool.query(
          'SELECT id FROM new_purchases WHERE mq = $1',
          [newData.mq]
        );

        if (newPurchaseCheck.rows.length > 0) {
          const newPurchaseId = newPurchaseCheck.rows[0].id;
          
          // Actualizar campos relevantes en new_purchases
          const newPurchaseUpdates = [];
          const newPurchaseValues = [];
          let paramIndex = 1;

          if (usd_jpy_rate !== undefined) {
            // new_purchases no tiene usd_jpy_rate directamente, pero podemos actualizar otros campos
            // Por ahora solo actualizamos los campos que existen en new_purchases
          }

          if (trm_rate !== undefined) {
            // new_purchases no tiene trm_rate directamente
          }

          if (payment_date !== undefined) {
            newPurchaseUpdates.push(`payment_date = $${paramIndex}`);
            newPurchaseValues.push(payment_date);
            paramIndex++;
          }

          if (observaciones_pagos !== undefined) {
            // new_purchases no tiene observaciones_pagos directamente
          }

          if (newPurchaseUpdates.length > 0) {
            newPurchaseValues.push(newPurchaseId);
            await pool.query(
              `UPDATE new_purchases 
               SET ${newPurchaseUpdates.join(', ')}, updated_at = NOW()
               WHERE id = $${paramIndex}`,
              newPurchaseValues
            );
            console.log(`✅ Sincronizado cambio a new_purchases (MQ: ${newData.mq})`);
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
      `SELECT 
        p.id,
        p.mq,
        p.invoice_number as no_factura,
        p.invoice_date as fecha_factura,
        p.supplier_name as proveedor,
        p.currency as moneda,
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
        p.created_at,
        p.updated_at
      FROM purchases p
      WHERE p.id = $1`,
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

