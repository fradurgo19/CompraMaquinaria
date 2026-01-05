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
      brand, model, serial, purchase_order, invoice_number,
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

    // Generar MQ automáticamente si no se proporciona (viene del módulo de importaciones)
    // El MQ se genera basado en el modelo y serial
    let generatedMq = mq;
    if (!generatedMq && serial) {
      // Generar MQ basado en modelo y serial (formato: MODELO-SERIAL)
      const mqPrefix = model.substring(0, 3).toUpperCase();
      const serialSuffix = serial.substring(0, 3).toUpperCase();
      generatedMq = `${mqPrefix}-${serialSuffix}`;
    } else if (!generatedMq) {
      // Si no hay serial, solo usar el modelo
      generatedMq = model.substring(0, 6).toUpperCase();
    }

    // Asegurar que quantity sea un número válido entre 1 y 100
    let qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      qty = 1;
    } else if (qty > 100) {
      qty = 100;
    }
    
    console.log('📝 POST /api/new-purchases - Cantidad validada:', qty, '(original:', quantity, ')');
    
    const createdPurchases = [];
    const serials = [];

    // Crear múltiples registros si quantity > 1
    // ✅ MQ puede repetirse para múltiples máquinas (mismo MQ para 1 o 10 máquinas)
    for (let i = 0; i < qty; i++) {
      // Generar serial único para cada máquina
      const currentSerial = qty > 1 ? `${serial}-${String(i + 1).padStart(3, '0')}` : serial;
      // ✅ Usar el mismo MQ para todas las máquinas (permite MQ repetido)
      const currentMq = generatedMq;
      
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
    
    // Solo admin puede eliminar
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admin puede eliminar compras nuevas' });
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

