/**
 * Rutas de COMPRAS NUEVOS (New Purchases)
 * Módulo para compras de equipos nuevos - Jefe Comercial
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { generatePurchaseOrderPDF } from '../services/pdf.service.js';
import path from 'path';
import fs from 'fs';

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

// =====================================================
// GET /api/new-purchases - Obtener todas las compras nuevas
// =====================================================
router.get('/', canViewNewPurchases, async (req, res) => {
  try {
    console.log('📥 GET /api/new-purchases - Obteniendo compras nuevas...');
    
    // ✅ Con esquema unificado, los triggers sincronizan automáticamente
    // Esta función solo sincroniza datos existentes que se crearon antes de los triggers
    // (opcional, los triggers manejan todo automáticamente para nuevos registros)
    // await syncNewPurchasesToEquipments();
    
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

// =====================================================
// POST /api/new-purchases - Crear una compra nueva
// =====================================================
router.post('/', canEditNewPurchases, async (req, res) => {
  try {
    const {
      mq, type, shipment, supplier_name, condition,
      brand, model, serial, machine_type, purchase_order, invoice_number,
      invoice_date, payment_date, machine_location, incoterm,
      currency, port_of_loading, port_of_embarkation, shipment_departure_date,
      shipment_arrival_date, value, mc, quantity = 1, empresa, year, machine_year,
      cabin_type, wet_line, dozer_blade, track_type, track_width, arm_type, payment_term, description
    } = req.body;

    console.log('📝 POST /api/new-purchases - Creando compra nueva:', { mq, model, serial, quantity, empresa });

    // Validaciones básicas
    if (!supplier_name || !model) {
      return res.status(400).json({ 
        error: 'Campos requeridos: Proveedor, Modelo' 
      });
    }

    // Generar Orden de Compra automáticamente con formato PTQ###-AA
    let generatedPurchaseOrder = purchase_order;
    if (!generatedPurchaseOrder) {
      const currentYear = new Date().getFullYear().toString().slice(-2); // Últimos 2 dígitos del año
      
      // Obtener el último número de orden de compra del año actual
      const lastOrderResult = await pool.query(`
        SELECT purchase_order FROM new_purchases
        WHERE purchase_order LIKE 'PTQ%'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      let nextNumber = 1;
      if (lastOrderResult.rows.length > 0) {
        const lastOrder = lastOrderResult.rows[0].purchase_order;
        // Extraer el número del formato PTQ###-AA
        const match = lastOrder.match(/PTQ(\d+)-/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      generatedPurchaseOrder = `PTQ${String(nextNumber).padStart(3, '0')}-${currentYear}`;
      console.log(`🔢 Orden de compra auto-generada: ${generatedPurchaseOrder}`);
    }

    // Asegurar que quantity sea un número válido entre 1 y 100
    let qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      qty = 1;
    } else if (qty > 100) {
      qty = 100;
    }
    
    console.log('📝 POST /api/new-purchases - Cantidad validada:', qty, '(original:', quantity, ')');

    // Generar MQs automáticamente si no se proporciona (formato PDTE-#### como en otros módulos)
    // Si quantity > 1, generar múltiples MQs únicos
    const generatedMqs = [];
    if (!mq) {
      try {
        // Buscar el último MQ con formato PDTE-#### en new_purchases
        const mqResult = await pool.query(`
          SELECT mq 
          FROM new_purchases 
          WHERE mq ~ '^PDTE-[0-9]+$'
          ORDER BY CAST(SUBSTRING(mq FROM 'PDTE-([0-9]+)') AS INTEGER) DESC
          LIMIT 1
        `);
        
        let startMqNumber = 1;
        if (mqResult.rows.length > 0) {
          // Extraer el número del último MQ PDTE-####
          const lastMq = mqResult.rows[0].mq;
          const match = lastMq.match(/PDTE-(\d+)/);
          if (match) {
            startMqNumber = parseInt(match[1]) + 1;
          }
        }
        
        // Generar MQs únicos para cada registro
        for (let i = 0; i < qty; i++) {
          const mqNumber = startMqNumber + i;
          generatedMqs.push(`PDTE-${String(mqNumber).padStart(4, '0')}`);
        }
        
        console.log(`🔢 ${qty} MQ(s) auto-generado(s): ${generatedMqs[0]}${qty > 1 ? ` hasta ${generatedMqs[generatedMqs.length - 1]}` : ''}`);
      } catch (mqError) {
        console.error('Error al generar MQ automático:', mqError);
        // Fallback: usar timestamp para evitar duplicados
        const timestamp = Date.now().toString().slice(-6);
        for (let i = 0; i < qty; i++) {
          generatedMqs.push(`PDTE-${timestamp}${String(i + 1).padStart(2, '0')}`);
        }
        console.log(`⚠️ Usando MQ(s) de fallback: ${generatedMqs.join(', ')}`);
      }
    } else {
      // Si se proporciona MQ
      if (qty === 1) {
        // Si solo es 1 registro, usar el MQ proporcionado
        generatedMqs.push(mq);
      } else {
        // Si quantity > 1, generar MQs únicos aunque se haya proporcionado un MQ inicial
        // Para mantener consistencia, buscar el último MQ PDTE y generar secuencialmente
        try {
          const mqResult = await pool.query(`
            SELECT mq 
            FROM new_purchases 
            WHERE mq ~ '^PDTE-[0-9]+$'
            ORDER BY CAST(SUBSTRING(mq FROM 'PDTE-([0-9]+)') AS INTEGER) DESC
            LIMIT 1
          `);
          
          let startMqNumber = 1;
          if (mqResult.rows.length > 0) {
            const lastMq = mqResult.rows[0].mq;
            const match = lastMq.match(/PDTE-(\d+)/);
            if (match) {
              startMqNumber = parseInt(match[1]) + 1;
            }
          }
          
          // Generar MQs únicos para cada registro
          for (let i = 0; i < qty; i++) {
            const mqNumber = startMqNumber + i;
            generatedMqs.push(`PDTE-${String(mqNumber).padStart(4, '0')}`);
          }
          
          console.log(`🔢 ${qty} MQ(s) auto-generado(s) (se ignoró MQ proporcionado): ${generatedMqs[0]}${qty > 1 ? ` hasta ${generatedMqs[generatedMqs.length - 1]}` : ''}`);
        } catch (mqError) {
          console.error('Error al generar MQ automático:', mqError);
          // Fallback: usar timestamp
          const timestamp = Date.now().toString().slice(-6);
          for (let i = 0; i < qty; i++) {
            generatedMqs.push(`PDTE-${timestamp}${String(i + 1).padStart(2, '0')}`);
          }
        }
      }
    }
    
    const createdPurchases = [];
    const serials = [];

    // Crear múltiples registros si quantity > 1
    // Cada registro tiene su propio MQ único
    for (let i = 0; i < qty; i++) {
      const currentMq = generatedMqs[i];
      // Generar serial único para cada máquina:
      // - Si viene serial, usarlo (y sufijar si qty>1)
      // - Si NO viene serial, usar el MQ como serial para cumplir NOT NULL
      const currentSerial = serial && serial.trim() !== '' 
        ? (qty > 1 ? `${serial}-${String(i + 1).padStart(3, '0')}` : serial)
        : currentMq;
      
      serials.push(currentSerial);

    const result = await pool.query(`
      INSERT INTO new_purchases (
        mq, type, shipment, supplier_name, condition,
        brand, model, serial, machine_type, purchase_order, invoice_number,
        invoice_date, payment_date, machine_location, incoterm,
          currency, port_of_loading, port_of_embarkation, shipment_departure_date,
          shipment_arrival_date, value, mc, empresa, year, created_by,
          cabin_type, wet_line, dozer_blade, track_type, track_width, arm_type, payment_term, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
      RETURNING *
    `, [
        currentMq, type || 'COMPRA DIRECTA', shipment, supplier_name, condition || 'NUEVO',
        brand, model, currentSerial, machine_type, generatedPurchaseOrder, invoice_number,
      invoice_date, payment_date, machine_location, incoterm,
        currency || 'USD', port_of_loading, port_of_embarkation || null, shipment_departure_date,
        shipment_arrival_date, value, mc, empresa, machine_year || year || null, req.user.id,
        cabin_type, wet_line, dozer_blade, track_type, track_width, arm_type || 'ESTANDAR', payment_term || null, description || null
      ]);

      createdPurchases.push(result.rows[0]);
    }

    console.log(`✅ ${createdPurchases.length} compra(s) nueva(s) creada(s)`);

    // Generar PDF de orden de compra
    let pdfPath = null;
    if (generatedPurchaseOrder) {
      try {
        // Obtener payment_term y description de la primera compra creada
        const firstPurchase = createdPurchases[0];
        const purchaseDataResult = await pool.query(
          'SELECT payment_term, description FROM new_purchases WHERE id = $1',
          [firstPurchase.id]
        );
        const purchaseData = purchaseDataResult.rows[0];
        const paymentTerm = purchaseData?.payment_term || '120 days after the BL date';
        const purchaseDescription = purchaseData?.description || (qty > 1 ? `${qty} unidades del modelo ${model}` : '-');

        pdfPath = await generatePurchaseOrderPDF({
          purchase_order: generatedPurchaseOrder,
          supplier_name,
          brand,
          model,
          serial: qty > 1 ? `${serial}-001 a ${serial}-${String(qty).padStart(3, '0')}` : (serial || '-'),
          quantity: qty,
          value: value || 0,
          currency: currency || 'USD',
          invoice_date,
          empresa: empresa || 'Partequipos Maquinaria',
          incoterm: incoterm || 'EXW',
          payment_term: paymentTerm,
          payment_days: '120', // Mantener para compatibilidad
          description: purchaseDescription
        });

        // Actualizar todos los registros creados con la ruta del PDF
        const updatePromises = createdPurchases.map(purchase => 
          pool.query(
            'UPDATE new_purchases SET purchase_order_pdf_path = $1 WHERE id = $2',
            [pdfPath, purchase.id]
          )
        );

        await Promise.all(updatePromises);
        console.log('✅ PDF de orden de compra generado y guardado');
      } catch (pdfError) {
        console.error('⚠️ Error generando PDF (continuando sin PDF):', pdfError);
        // No fallar la creación si el PDF falla
      }
    }

    // ✅ Los triggers automáticamente crean equipments y service_records
    // No necesitamos createPurchaseMirror() ni syncNewPurchaseToEquipment() manualmente
    // Los triggers sync_new_purchase_to_equipment() y sync_new_purchase_to_service() lo hacen automáticamente

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

router.post('/bulk-upload', canEditNewPurchases, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array "records" con al menos un registro.' });
    }

    console.log(`📤 POST /api/new-purchases/bulk-upload - ${records.length} registro(s)`);

    // Obtener último MQ y OC para generar secuencialmente
    const [mqResult, ocResult] = await Promise.all([
      pool.query(`
        SELECT mq FROM new_purchases
        WHERE mq ~ '^PDTE-[0-9]+$'
        ORDER BY CAST(SUBSTRING(mq FROM 'PDTE-([0-9]+)') AS INTEGER) DESC
        LIMIT 1
      `),
      pool.query(`
        SELECT purchase_order FROM new_purchases
        WHERE purchase_order LIKE 'PTQ%'
        ORDER BY created_at DESC
        LIMIT 1
      `)
    ]);

    let nextMqNum = 1;
    if (mqResult.rows.length > 0) {
      const match = mqResult.rows[0].mq.match(/PDTE-(\d+)/);
      if (match) nextMqNum = parseInt(match[1], 10) + 1;
    }

    const currentYear = new Date().getFullYear().toString().slice(-2);
    let nextOcNum = 1;
    if (ocResult.rows.length > 0) {
      const match = ocResult.rows[0].purchase_order.match(/PTQ(\d+)-/);
      if (match) nextOcNum = parseInt(match[1], 10) + 1;
    }

    const errors = [];
    let inserted = 0;

    for (let b = 0; b < records.length; b += BULK_BATCH_SIZE) {
      const batch = records.slice(b, b + BULK_BATCH_SIZE);
      for (let i = 0; i < batch.length; i++) {
        const r = batch[i];
        const supplier_name = r.supplier_name ? String(r.supplier_name).trim() : null;
        const model = r.model ? String(r.model).trim() : null;
        const rowNum = b + i + 1;
        if (!supplier_name || !model) {
          errors.push(`Fila ${rowNum}: Se requieren PROVEEDOR y MODELO.`);
          nextMqNum++;
          nextOcNum++;
          continue;
        }

        const mq = r.mq && String(r.mq).trim() ? String(r.mq).trim() : `PDTE-${String(nextMqNum).padStart(4, '0')}`;
        nextMqNum++;

        const purchase_order = r.purchase_order && String(r.purchase_order).trim()
          ? String(r.purchase_order).trim()
          : `PTQ${String(nextOcNum).padStart(3, '0')}-${currentYear}`;
        nextOcNum++;

        const serial = (r.serial && String(r.serial).trim()) ? String(r.serial).trim() : mq;
        const condition = (r.condition || 'NUEVO').toString().toUpperCase().trim() === 'USADO' ? 'USADO' : 'NUEVO';
        const type = (r.type || 'COMPRA DIRECTA').toString().trim();
        const currency = (r.currency || 'USD').toString().toUpperCase().trim();
        const value = r.value != null && r.value !== '' ? Number(r.value) : null;
        const shipping_costs = r.shipping_costs != null && r.shipping_costs !== '' ? Number(r.shipping_costs) : null;
        const finance_costs = r.finance_costs != null && r.finance_costs !== '' ? Number(r.finance_costs) : null;

        const invoice_date = r.invoice_date || null;
        const due_date = r.due_date || null;
        const year = r.year != null && r.year !== '' ? parseInt(r.year, 10) : null;
        const machine_type = r.machine_type ? String(r.machine_type).trim() : null;
        const brand = r.brand ? String(r.brand).trim() : null;
        const incoterm = r.incoterm ? String(r.incoterm).trim() : null;
        const machine_location = r.machine_location ? String(r.machine_location).trim() : null;
        const port_of_loading = r.port_of_loading ? String(r.port_of_loading).trim() : null;
        const invoice_number = r.invoice_number ? String(r.invoice_number).trim() : null;
        const description = r.description || r.spec ? String(r.description || r.spec).trim() : null;
        // Especificaciones técnicas (parseadas desde SPEC en el frontend o enviadas explícitamente)
        const cabin_type = r.cabin_type ? String(r.cabin_type).trim() : null;
        const wet_line = r.wet_line ? String(r.wet_line).trim().toUpperCase() : null;
        const dozer_blade = r.dozer_blade ? String(r.dozer_blade).trim().toUpperCase() : null;
        const track_type = r.track_type ? String(r.track_type).trim() : null;
        const track_width = r.track_width ? String(r.track_width).trim() : null;
        const arm_type = (r.arm_type && String(r.arm_type).trim()) ? String(r.arm_type).trim() : 'ESTANDAR';

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
            mq, type || 'COMPRA DIRECTA', null, supplier_name, condition,
            brand, model, serial, machine_type, purchase_order, invoice_number,
            invoice_date, null, machine_location, incoterm,
            currency, port_of_loading, null, null, null,
            value, null, null, year, req.user.id,
            cabin_type, wet_line, dozer_blade, track_type, track_width, arm_type, null, description,
            due_date, shipping_costs, finance_costs
          ]);
          inserted++;
        } catch (insertErr) {
          if (insertErr.code === '23505') {
            errors.push(`Fila ${rowNum}: Ya existe modelo/serial (${model}/${serial}).`);
          } else {
            errors.push(`Fila ${rowNum}: ${insertErr.message}`);
          }
        }
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

    // Verificar que existe
    const check = await pool.query('SELECT id FROM new_purchases WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Compra nueva no encontrada' });
    }

    // Construir query dinámicamente solo con los campos presentes en updates
    // Esto evita que campos undefined sobrescriban valores existentes
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    // Mapeo de campos a sus nombres en la BD
    const fieldMap = {
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
      port_of_loading: 'port_of_loading',
      port_of_embarkation: 'port_of_embarkation',  // ✅ Puerto de embarque para importaciones
      shipment_departure_date: 'shipment_departure_date',
      shipment_arrival_date: 'shipment_arrival_date',
      nationalization_date: 'nationalization_date',  // ✅ Fecha de nacionalización desde importaciones
      value: 'value',
      shipping_costs: 'shipping_costs',
      finance_costs: 'finance_costs',
      mc: 'mc',
      year: 'year',  // ✅ Año para mostrar en importaciones
      machine_year: 'year',  // ✅ Mapear machine_year del frontend a year en BD
      equipment_type: 'equipment_type',
      cabin_type: 'cabin_type',
      wet_line: 'wet_line',
      dozer_blade: 'dozer_blade',
      track_type: 'track_type',
      track_width: 'track_width',
      arm_type: 'arm_type',
      empresa: 'empresa',
      payment_term: 'payment_term',
      description: 'description'
    };

    // Solo agregar campos que están presentes en updates (no undefined)
    // Evitar duplicados: si machine_year está presente, ignorar year (ambos mapean a la misma columna)
    const processedFields = new Set();
    Object.entries(fieldMap).forEach(([key, dbField]) => {
      if (key in updates && updates[key] !== undefined) {
        // Si machine_year está presente y estamos procesando year, saltar year
        if (key === 'year' && 'machine_year' in updates && updates.machine_year !== undefined) {
          return; // Ignorar year si machine_year está presente
        }
        
        // Si ya procesamos este campo de BD, saltar (evitar duplicados)
        if (processedFields.has(dbField)) {
          return;
        }
        
        processedFields.add(dbField);
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    // Siempre actualizar updated_at
    setClauses.push('updated_at = NOW()');

    // Agregar id al final para el WHERE
    values.push(id);

    if (setClauses.length === 1) {
      // Solo updated_at, no hay nada que actualizar
      const result = await pool.query('SELECT * FROM new_purchases WHERE id = $1', [id]);
      return res.json(result.rows[0]);
    }

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

    // ✅ Los triggers automáticamente sincronizan a equipments y service_records
    // No necesitamos sincronización manual - los triggers lo hacen automáticamente
    // El control de cambios inline sigue funcionando porque se guarda en change_logs
    // con table_name='new_purchases' y record_id del new_purchase

    // Si se actualizaron campos relevantes para el PDF, regenerar el PDF si existe
    const pdfRelevantFields = ['purchase_order', 'supplier_name', 'brand', 'model', 'serial', 
      'value', 'currency', 'invoice_date', 'empresa', 'incoterm', 'payment_term', 'description'];
    const shouldRegeneratePDF = pdfRelevantFields.some(field => updates[field] !== undefined);
    
    if (shouldRegeneratePDF) {
      const updatedPurchase = result.rows[0];
      
      // Verificar si existe un PDF previo
      if (updatedPurchase.purchase_order_pdf_path) {
        try {
          // Obtener todos los registros con el mismo purchase_order para regenerar el PDF
          const sameOrderResult = await pool.query(
            'SELECT * FROM new_purchases WHERE purchase_order = $1 ORDER BY serial',
            [updatedPurchase.purchase_order]
          );
          
          if (sameOrderResult.rows.length > 0) {
            const purchases = sameOrderResult.rows;
            const firstPurchase = purchases[0];
            
            // Obtener payment_term
            const paymentTerm = firstPurchase.payment_term || '120 days after the BL date';
            
            // Obtener description
            const purchaseDescription = firstPurchase.description || (purchases.length > 1 
              ? `${purchases.length} unidades del modelo ${firstPurchase.model}`
              : '-');
            
            // Generar PDF con todos los registros del mismo purchase_order
            const pdfPath = await generatePurchaseOrderPDF({
              purchase_order: firstPurchase.purchase_order,
              supplier_name: firstPurchase.supplier_name,
              brand: firstPurchase.brand,
              model: firstPurchase.model,
              serial: purchases.length > 1 
                ? `${purchases[0].serial}-001 a ${purchases[purchases.length - 1].serial}`
                : (firstPurchase.serial || '-'),
              quantity: purchases.length,
              value: firstPurchase.value || 0,
              currency: firstPurchase.currency || 'USD',
              invoice_date: firstPurchase.invoice_date,
              empresa: firstPurchase.empresa || 'Partequipos Maquinaria',
              incoterm: firstPurchase.incoterm || 'EXW',
              payment_term: paymentTerm,
              payment_days: '120',
              description: purchaseDescription
            });
            
            // Actualizar todos los registros con la nueva ruta del PDF
            await pool.query(
              'UPDATE new_purchases SET purchase_order_pdf_path = $1 WHERE purchase_order = $2',
              [pdfPath, firstPurchase.purchase_order]
            );
            
            console.log('✅ PDF de orden de compra regenerado después de actualización');
          }
        } catch (pdfError) {
          console.warn('⚠️ Error regenerando PDF (continuando sin regenerar):', pdfError);
          // No fallar la actualización si el PDF falla
        }
      }
    }

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

/**
 * ⚠️ FUNCIÓN OBSOLETA - Ya no se usa con esquema unificado y triggers
 * Los triggers sync_new_purchase_to_equipment() y sync_new_purchase_to_service()
 * crean automáticamente los registros cuando se crea/actualiza un new_purchase.
 * 
 * Esta función se mantiene comentada por si se necesita sincronizar datos existentes
 * que se crearon antes de los triggers.
 */
// async function syncNewPurchasesToEquipments() {
//   // Ya no necesaria - los triggers lo hacen automáticamente
//   // Código comentado por referencia histórica
// }

/**
 * ⚠️ FUNCIÓN OBSOLETA - Ya no se usa con esquema unificado y triggers
 * Los triggers sync_new_purchase_to_equipment() y sync_new_purchase_to_service()
 * crean automáticamente los registros cuando se crea/actualiza un new_purchase.
 */
// async function syncNewPurchaseToEquipment(newPurchaseId) {
//   // Ya no necesaria - los triggers lo hacen automáticamente
// }

/**
 * ⚠️ FUNCIÓN OBSOLETA - Ya no se usa con esquema unificado y triggers
 * Los triggers sync_new_purchase_to_equipment() y sync_new_purchase_to_service()
 * actualizan automáticamente los registros cuando se modifica un new_purchase.
 */
// async function updateSyncedEquipment(newPurchaseId) {
//   // Ya no necesaria - los triggers lo hacen automáticamente
// }

/**
 * ⚠️ FUNCIÓN OBSOLETA - Ya no se usa con esquema unificado
 * Los triggers sync_new_purchase_to_equipment() y sync_new_purchase_to_service()
 * crean automáticamente los registros en equipments y service_records
 * cuando se crea/actualiza un new_purchase.
 * 
 * Esta función se mantiene comentada por referencia histórica.
 */
// async function createPurchaseMirror(newPurchase) {
//   // Ya no necesaria - los triggers lo hacen automáticamente
// }

export default router;

