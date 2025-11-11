import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/pagos - Obtener todos los pagos (registros de purchases con datos de pagos)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.mq,
        p.invoice_number as no_factura,
        p.invoice_date as fecha_factura,
        p.supplier_name as proveedor,
        p.currency as moneda,
        p.trm as tasa,
        p.valor_factura_proveedor,
        p.observaciones_pagos,
        p.pendiente_a,
        p.fecha_vto_fact,
        p.model as modelo,
        p.serial as serie,
        p.created_at,
        p.updated_at
      FROM purchases p
      WHERE p.condition = 'USADO'
      ORDER BY p.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// PUT /api/pagos/:id - Actualizar un registro de pago
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
  const {
    invoice_date,
    supplier_name,
    invoice_number,
    mq,
    currency,
    trm,
    valor_factura_proveedor,
    observaciones_pagos,
    pendiente_a,
    fecha_vto_fact
  } = req.body;

  try {
    // Validar pendiente_a
    const validPendienteA = [
      'PROVEEDORES MAQUITECNO',
      'PROVEEDORES PARTEQUIPOS MAQUINARIA',
      'PROVEEDORES SOREMAQ'
    ];

    if (pendiente_a && !validPendienteA.includes(pendiente_a)) {
      return res.status(400).json({ 
        error: 'Valor inválido para pendiente_a' 
      });
    }

    // Obtener datos anteriores para el log
    const previousData = await pool.query(
      'SELECT * FROM purchases WHERE id = $1',
      [id]
    );

    if (previousData.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const oldData = previousData.rows[0];

    const result = await pool.query(
      `UPDATE purchases 
       SET 
         invoice_date = COALESCE($1, invoice_date),
         supplier_name = COALESCE($2, supplier_name),
         invoice_number = COALESCE($3, invoice_number),
         mq = COALESCE($4, mq),
         currency = COALESCE($5, currency),
         trm = COALESCE($6, trm),
         valor_factura_proveedor = $7,
         observaciones_pagos = $8,
         pendiente_a = $9,
         fecha_vto_fact = $10,
         updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        invoice_date,
        supplier_name,
        invoice_number,
        mq,
        currency,
        trm,
        valor_factura_proveedor,
        observaciones_pagos,
        pendiente_a,
        fecha_vto_fact,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const newData = result.rows[0];

    // Registrar cambios
    const changes = {};
    const fieldLabels = {
      invoice_date: 'Fecha Factura',
      supplier_name: 'Proveedor',
      invoice_number: 'No. Factura',
      mq: 'MQ',
      currency: 'Moneda',
      trm: 'Tasa',
      valor_factura_proveedor: 'Valor Factura Proveedor',
      observaciones_pagos: 'Observaciones',
      pendiente_a: 'Pendiente A',
      fecha_vto_fact: 'Fecha Vencimiento'
    };

    for (const field of Object.keys(fieldLabels)) {
      if (oldData[field] !== newData[field]) {
        changes[fieldLabels[field]] = {
          old: oldData[field],
          new: newData[field]
        };
      }
    }

    // Registrar cambios en la tabla change_logs
    if (Object.keys(changes).length > 0) {
      const changeEntries = Object.entries(changes).map(([field, value]) => ({
        field_name: field.toLowerCase().replace(/ /g, '_'),
        field_label: field,
        old_value: value.old,
        new_value: value.new
      }));

      const insertPromises = changeEntries.map(change => {
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
      });

      await Promise.all(insertPromises);
      console.log(`✅ Registrados ${changeEntries.length} cambios en pagos (ID: ${id})`);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando pago:', error);
    res.status(500).json({ error: 'Error al actualizar pago' });
  }
});

// GET /api/pagos/:id - Obtener un pago específico
router.get('/:id', authenticateToken, async (req, res) => {
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

