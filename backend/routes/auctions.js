/**
 * Rutas de Subastas (Auctions)
 */

import express from 'express';
import { pool, queryWithRetry } from '../db/connection.js';
import { authenticateToken, canViewAuctions, requireSebastian, canEditAuctions } from '../middleware/auth.js';
import { sendAuctionWonEmail, sendAuctionUpcomingEmail, testEmailConnection } from '../services/email.service.js';
import { triggerNotificationForEvent, clearAuctionsNotifications, checkAndExecuteRules } from '../services/notificationTriggers.js';
import { syncAuctionToPreselection, syncAuctionToPurchases } from '../services/syncBidirectionalPreselectionAuction.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/auctions - Obtener todas las subastas
router.get('/', canViewAuctions, async (req, res) => {
  try {
    const { role, userId } = req.user;
    
    let query = `
      SELECT 
        a.id,
        a.date::date as auction_date,
        a.date as date,
        a.lot as lot_number,
        a.machine_id,
        a.price_max as max_price,
        a.price_bought as purchased_price,
        a.purchase_type,
        a.supplier_id,
        a.status,
        a.epa,
        a.comments,
        a.photos_folder_id,
        a.auction_type,
        a.location,
        a.created_by,
        a.created_at,
        a.updated_at,
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours,
        m.machine_type,
        m.wet_line,
        m.arm_type,
        m.track_width,
        m.bucket_capacity,
        m.warranty_months,
        m.warranty_hours,
        m.engine_brand,
        m.cabin_type,
        m.blade,
        COALESCE(s.name, a.supplier_id::text) as supplier_name,
        p.id as preselection_id,
        p.colombia_time,
        p.local_time,
        p.auction_city,
        p.auction_date as preselection_auction_date
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      LEFT JOIN preselections p ON p.auction_id = a.id
      LEFT JOIN suppliers s ON a.supplier_id = s.id
    `;
    
    const params = [];
    
    // Sebastián ve todas las subastas (no solo las que creó)
    // El filtro se maneja a nivel de RLS si es necesario
    
    query += ' ORDER BY a.date DESC';
    
    // Usar queryWithRetry para manejar errores de conexión
    const result = await queryWithRetry(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener subastas:', error);
    res.status(500).json({ error: 'Error al obtener subastas' });
  }
});

// GET /api/auctions/:id - Obtener una subasta por ID
router.get('/:id', canViewAuctions, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;
    
    let query = `
      SELECT 
        a.id,
        a.date::date as auction_date,
        a.date as date,
        a.lot as lot_number,
        a.machine_id,
        a.price_max as max_price,
        a.price_bought as purchased_price,
        a.purchase_type,
        a.supplier_id,
        a.status,
        a.epa,
        a.comments,
        a.photos_folder_id,
        a.auction_type,
        a.location,
        a.created_by,
        a.created_at,
        a.updated_at,
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours,
        m.machine_type,
        m.wet_line,
        m.arm_type,
        m.track_width,
        m.bucket_capacity,
        m.warranty_months,
        m.warranty_hours,
        m.engine_brand,
        m.cabin_type,
        m.blade,
        COALESCE(s.name, a.supplier_id::text) as supplier_name,
        p.id as preselection_id,
        p.colombia_time,
        p.local_time,
        p.auction_city,
        p.auction_date as preselection_auction_date,
        p.currency as preselection_currency,
        pur.currency_type as purchase_currency_type
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      LEFT JOIN preselections p ON p.auction_id = a.id
      LEFT JOIN purchases pur ON pur.auction_id = a.id
      LEFT JOIN suppliers s ON a.supplier_id = s.id
      WHERE a.id = $1
    `;
    
    const params = [id];
    
    // Sebastián ve todas las subastas (no solo las que creó)
    // El filtro se maneja a nivel de RLS si es necesario
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subasta no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener subasta:', error);
    res.status(500).json({ error: 'Error al obtener subasta' });
  }
});

// POST /api/auctions - Crear nueva subasta
router.post('/', requireSebastian, async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      date,
      lot,
      machine_id,
      price_max,
      supplier_id,
      price_bought,
      purchase_type,
      status,
      comments,
      photos_folder_id
    } = req.body;
    
    const insertResult = await pool.query(
      `INSERT INTO auctions (
        date, lot, machine_id, price_max, supplier_id, price_bought,
        purchase_type, status, comments, photos_folder_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [date, lot, machine_id, price_max, supplier_id, price_bought,
       purchase_type, status, comments, photos_folder_id, userId]
    );
    
    const newAuctionId = insertResult.rows[0].id;
    
    // Devolver la subasta completa con joins y aliases
    const result = await pool.query(`
      SELECT 
        a.id,
        a.date::date as auction_date,
        a.date as date,
        a.lot as lot_number,
        a.machine_id,
        a.price_max as max_price,
        a.price_bought as purchased_price,
        a.purchase_type,
        a.supplier_id,
        a.status,
        a.epa,
        a.comments,
        a.photos_folder_id,
        a.auction_type,
        a.location,
        a.created_by,
        a.created_at,
        a.updated_at,
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours,
        m.machine_type,
        m.wet_line,
        m.arm_type,
        m.track_width,
        m.bucket_capacity,
        m.warranty_months,
        m.warranty_hours,
        m.engine_brand,
        m.cabin_type,
        m.blade,
        COALESCE(s.name, a.supplier_id::text) as supplier_name
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      LEFT JOIN suppliers s ON a.supplier_id = s.id
      WHERE a.id = $1
    `, [newAuctionId]);
    
    const newAuction = result.rows[0];
    
    // Enviar correo si la subasta se crea con estado GANADA
    // PAUSADO: Notificación de subasta ganada deshabilitada temporalmente
    // if (status === 'GANADA' && newAuction) {
    //   try {
    //     console.log('📧 Enviando correo de subasta ganada (nueva)...');
    //     const emailResult = await sendAuctionWonEmail({
    //       auction_date: newAuction.auction_date,
    //       lot_number: newAuction.lot_number,
    //       machine_model: newAuction.model,
    //       machine_serial: newAuction.serial,
    //       machine_year: newAuction.year,
    //       machine_hours: newAuction.hours,
    //       max_price: newAuction.max_price,
    //       purchased_price: newAuction.purchased_price,
    //       supplier_name: newAuction.supplier_name,
    //       comments: newAuction.comments
    //     });
    //     
    //     if (emailResult.success) {
    //       console.log('✅ Correo enviado exitosamente a pcano@partequipos.com');
    //     } else {
    //       console.error('❌ Error al enviar correo:', emailResult.error);
    //     }
    //   } catch (emailError) {
    //     console.error('❌ Error en envío de correo:', emailError);
    //   }
    // }
    
    // Verificar si hay reglas activas de subastas y ejecutarlas
    // También disparar notificación inmediata para el evento de creación de subasta
    try {
      // Disparar notificación inmediata para el evento de creación de subasta
      await triggerNotificationForEvent('auction_created', {
        recordId: newAuctionId.toString(),
        userId: userId,
        triggeredBy: userId,
        metadata: {
          auction_id: newAuctionId,
          lot: newAuction.lot_number || newAuction.lot,
          model: newAuction.model || 'N/A',
          serial: newAuction.serial || 'N/A',
          status: newAuction.status || 'PENDIENTE',
          source: 'auctions'
        }
      });
      
      // También ejecutar todas las reglas activas (incluye AUCTION_PENDING)
      await checkAndExecuteRules();
    } catch (notifError) {
      console.error('Error al verificar reglas de notificación:', notifError);
    }
    
    res.status(201).json(newAuction);
  } catch (error) {
    console.error('Error al crear subasta:', error);
    res.status(500).json({ error: 'Error al crear subasta' });
  }
});

// PUT /api/auctions/:id - Actualizar subasta
router.put('/:id', canEditAuctions, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;
    const updates = { ...req.body };

    if (updates.supplier_id) {
      // Sincronizar nombre del proveedor
      const supplierResult = await pool.query(
        'SELECT name FROM suppliers WHERE id = $1',
        [updates.supplier_id]
      );
      const supplierName = supplierResult.rows[0]?.name || updates.supplier_id;
      updates.supplier_name = supplierName;
    }
    
    // Verificar que la subasta existe
    // Admin, sebastian, gerencia y pcano@partequipos.com pueden editar cualquier subasta
    // Otros usuarios solo pueden editar las que crearon
    const userEmail = req.user.email?.toLowerCase();
    const isGerenciaOrPcano = role === 'admin' || role === 'sebastian' || role === 'gerencia' || userEmail === 'pcano@partequipos.com' || userEmail === 'gerencia@partequipos.com';
    
    const auctionCheck = await pool.query(
      'SELECT id, machine_id FROM auctions WHERE id = $1' + 
      (!isGerenciaOrPcano ? ' AND created_by = $2' : ''),
      !isGerenciaOrPcano ? [id, userId] : [id]
    );
    
    if (auctionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No puedes editar esta subasta' });
    }
    
    const auction = auctionCheck.rows[0];
    
    // Separar campos de máquina vs campos de subasta
    const machineFields = [
      'brand', 'model', 'serial', 'year', 'hours', 'drive_folder_id', 'photos_folder_id',
      // Especificaciones técnicas
      'machine_type', 'wet_line', 'arm_type', 'track_width', 'bucket_capacity',
      'warranty_months', 'warranty_hours', 'engine_brand', 'cabin_type', 'blade'
    ];
    const machineUpdates = {};
    const auctionUpdates = {};
    
    Object.entries(updates).forEach(([key, value]) => {
      if (machineFields.includes(key)) {
        if (key === 'photos_folder_id') {
          machineUpdates['drive_folder_id'] = value;
        } else {
          machineUpdates[key] = value;
        }
      } else {
        auctionUpdates[key] = value;
      }
    });
    
    // Actualizar máquina si hay cambios
    if (Object.keys(machineUpdates).length > 0 && auction.machine_id) {
      const machineFieldsArr = Object.keys(machineUpdates);
      const machineValuesArr = Object.values(machineUpdates);
      const machineSetClause = machineFieldsArr.map((field, index) => 
        `${field} = $${index + 1}`
      ).join(', ');
      
      await pool.query(
        `UPDATE machines SET ${machineSetClause}, updated_at = NOW() 
         WHERE id = $${machineFieldsArr.length + 1}`,
        [...machineValuesArr, auction.machine_id]
      );

      // 🔄 SINCRONIZACIÓN AUTOMÁTICA BIDIRECCIONAL
      // Paso 1: Sincronizar especificaciones técnicas a equipments
      const specsToSync = ['machine_type', 'wet_line', 'arm_type', 'track_width', 'bucket_capacity', 
                          'warranty_months', 'warranty_hours', 'engine_brand', 'cabin_type', 'blade'];
      const specsUpdates = {};
      
      specsToSync.forEach(field => {
        if (machineUpdates[field] !== undefined) {
          specsUpdates[field] = machineUpdates[field];
        }
      });

      if (Object.keys(specsUpdates).length > 0) {
        // Buscar el equipment asociado a esta máquina
        const equipmentResult = await pool.query(`
          SELECT e.id 
          FROM equipments e
          INNER JOIN purchases p ON e.purchase_id = p.id
          WHERE p.machine_id = $1
        `, [auction.machine_id]);

        if (equipmentResult.rows.length > 0) {
          const equipmentId = equipmentResult.rows[0].id;
          const equipmentFieldsArr = Object.keys(specsUpdates);
          const equipmentValuesArr = Object.values(specsUpdates);
          const equipmentSetClause = equipmentFieldsArr.map((field, index) => 
            `${field} = $${index + 1}`
          ).join(', ');
          
          await pool.query(
            `UPDATE equipments SET ${equipmentSetClause}, updated_at = NOW() 
             WHERE id = $${equipmentFieldsArr.length + 1}`,
            [...equipmentValuesArr, equipmentId]
          );
          
          console.log(`✅ Especificaciones sincronizadas desde Subasta a Equipment (ID: ${equipmentId})`);
        }
      }

      // Paso 2: Sincronizar TODOS los cambios de máquina a purchases (si la subasta está GANADA)
      // Verificar si existe un purchase asociado a esta subasta
      const purchaseCheck = await pool.query(`
        SELECT id FROM purchases WHERE auction_id = $1
      `, [id]);

      if (purchaseCheck.rows.length > 0) {
        const purchaseId = purchaseCheck.rows[0].id;
        console.log(`🔄 Sincronizando cambios de Subasta a Purchase (ID: ${purchaseId})...`);
        
        // Los cambios en machines ya se aplicaron arriba, aquí solo registramos
        console.log(`✅ Cambios de máquina sincronizados automáticamente a Purchase:`, Object.keys(machineUpdates));
        }
      }

      // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Sincronizar cambios a preselección relacionada
    // Esta sincronización debe ejecutarse siempre que haya cambios en auctionUpdates o machineUpdates
    if (Object.keys(auctionUpdates).length > 0 || Object.keys(machineUpdates).length > 0) {
      await syncAuctionToPreselection(id, auctionUpdates, machineUpdates);
      
      // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Sincronizar cambios a purchases relacionados
      // Esta función sincroniza location desde auctions a purchases
      await syncAuctionToPurchases(id, auctionUpdates, machineUpdates);
    }
    
    // Verificar si el estado cambió a GANADA ANTES de actualizar
    let shouldSendEmail = false;
    let shouldCreatePurchase = false;
    let shouldDeletePurchase = false;
    let previousStatus = null;
    
    if (auctionUpdates.status) {
      // Obtener el estado anterior ANTES de actualizar
      const currentAuction = await pool.query(
        'SELECT status FROM auctions WHERE id = $1',
        [id]
      );
      
      if (currentAuction.rows.length === 0) {
        return res.status(404).json({ error: 'Subasta no encontrada' });
      }
      
      previousStatus = currentAuction.rows[0]?.status;
      
      console.log('🔄 Cambio de estado:', previousStatus, '->', auctionUpdates.status);
      
      // Si cambiando de GANADA a PERDIDA o PENDIENTE
      if (previousStatus === 'GANADA' && (auctionUpdates.status === 'PERDIDA' || auctionUpdates.status === 'PENDIENTE')) {
        shouldDeletePurchase = true;
        console.log('⚠️ Se eliminará purchase porque la subasta cambió a', auctionUpdates.status);
      }
    }

    // Actualizar subasta
    if (Object.keys(auctionUpdates).length > 0) {
      const auctionFieldsArr = Object.keys(auctionUpdates);
      const auctionValuesArr = Object.values(auctionUpdates);
      const auctionSetClause = auctionFieldsArr.map((field, index) => 
        `${field} = $${index + 1}`
      ).join(', ');
      
      await pool.query(
        `UPDATE auctions SET ${auctionSetClause}, updated_at = NOW() 
         WHERE id = $${auctionFieldsArr.length + 1}`,
        [...auctionValuesArr, id]
      );
    }
    
    // Devolver la subasta completa con todos los joins y alias correctos
    const finalResult = await pool.query(`
      SELECT 
        a.id,
        a.date::date as auction_date,
        a.date as date,
        a.lot as lot_number,
        a.machine_id,
        a.price_max as max_price,
        a.price_bought as purchased_price,
        a.purchase_type,
        a.supplier_id,
        a.status,
        a.epa,
        a.comments,
        a.photos_folder_id,
        a.auction_type,
        a.location,
        a.created_by,
        a.created_at,
        a.updated_at,
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours,
        m.machine_type,
        m.wet_line,
        m.arm_type,
        m.track_width,
        m.bucket_capacity,
        m.warranty_months,
        m.warranty_hours,
        m.engine_brand,
        m.cabin_type,
        m.blade,
        COALESCE(s.name, a.supplier_id::text) as supplier_name
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      LEFT JOIN suppliers s ON a.supplier_id = s.id
      WHERE a.id = $1
    `, [id]);
    
    const updatedAuction = finalResult.rows[0];
    
    // Validar campos requeridos DESPUÉS de actualizar, si el estado cambió a GANADA
    // Esto asegura que validamos los valores finales en la BD, no solo los que vienen en el request
    if (auctionUpdates.status === 'GANADA' && updatedAuction && previousStatus !== 'GANADA') {
      // Usar los valores actualizados de la BD (después del UPDATE)
      const priceBought = updatedAuction.purchased_price ?? updatedAuction.price_bought;
      const location = updatedAuction.location;
      const epa = updatedAuction.epa;
      
      console.log('🔍 Validando campos requeridos para GANADA:', {
        priceBought,
        location,
        epa,
        previousStatus
      });
      
      // Validar campos requeridos
      const missingFields = [];
      
      if (!priceBought || priceBought === null || priceBought === '' || (typeof priceBought === 'number' && priceBought <= 0)) {
        missingFields.push('Comprado (price_bought)');
      }
      
      if (!location || (typeof location === 'string' && location.trim() === '')) {
        missingFields.push('Ubicación (location)');
      }
      
      if (!epa || (typeof epa === 'string' && epa.trim() === '')) {
        missingFields.push('EPA');
      }
      
      if (missingFields.length > 0) {
        // Revertir el cambio de estado si faltan campos
        await pool.query(
          'UPDATE auctions SET status = $1, updated_at = NOW() WHERE id = $2',
          [previousStatus || 'PENDIENTE', id]
        );
        
        console.error('❌ Validación fallida - campos faltantes:', missingFields);
        
        return res.status(400).json({ 
          error: `No se puede marcar la subasta como GANADA sin diligenciar los siguientes campos requeridos: ${missingFields.join(', ')}. Por favor, complete estos campos antes de cambiar el estado a GANADA.` 
        });
      }
      
      shouldSendEmail = true;
      shouldCreatePurchase = true;
      console.log('✅ Validación exitosa: Se creará purchase y se enviará correo');
      // NOTA: La notificación de "Subasta ganada sin registro de compra" se creará
      // DESPUÉS de intentar crear el purchase, solo si el purchase no se creó exitosamente
    }
    
    // Crear purchase automáticamente si la subasta cambió a GANADA
    // IMPORTANTE: Esto debe ejecutarse incluso si falló la notificación
    if (shouldCreatePurchase && updatedAuction) {
      try {
        // Verificar que userId esté definido
        if (!userId) {
          console.error('❌ Error: userId no está definido. req.user:', req.user);
          throw new Error('Usuario no autenticado correctamente');
        }
        
        console.log('👤 Usuario que está creando purchase:', {
          userId,
          email: req.user.email,
          role: req.user.role
        });
        
        // Verificar si ya existe un purchase para esta subasta
        const existingPurchase = await pool.query(
          'SELECT id FROM purchases WHERE auction_id = $1',
          [id]
        );

        if (existingPurchase.rows.length === 0) {
          console.log('📦 Creando purchase automático para subasta ganada...');
          console.log('📋 Estado de la subasta:', {
            id,
            status: updatedAuction.status,
            machine_id: updatedAuction.machine_id,
            supplier_id: updatedAuction.supplier_id
          });
          
          // Obtener supplier_id, supplier_name, location y epa de la tabla auctions
          const auctionData = await pool.query(
            `SELECT a.supplier_id, COALESCE(s.name, a.supplier_id::text) as supplier_name, a.location, a.epa 
             FROM auctions a
             LEFT JOIN suppliers s ON a.supplier_id = s.id
             WHERE a.id = $1`,
            [id]
          );
          
          if (!auctionData.rows || auctionData.rows.length === 0) {
            throw new Error(`No se encontraron datos de la subasta con ID: ${id}`);
          }
          
          const supplierId = auctionData.rows[0]?.supplier_id;
          const supplierName = auctionData.rows[0]?.supplier_name || supplierId;
          const auctionLocation = auctionData.rows[0]?.location;
          const auctionEpa = auctionData.rows[0]?.epa;
          
          if (!supplierId) {
            throw new Error('supplier_id es requerido para crear el purchase');
          }
          
          if (!updatedAuction.machine_id) {
            throw new Error('machine_id es requerido para crear el purchase');
          }
          
          const preselectionCurrencyResult = await pool.query(
            'SELECT currency FROM preselections WHERE auction_id = $1 LIMIT 1',
            [id]
          );
          const currencyFromPreselection = preselectionCurrencyResult.rows[0]?.currency || null;
          const currencyType = currencyFromPreselection || 'USD';
          
          // Usar la fecha de la subasta como invoice_date, o la fecha actual si no está disponible
          // invoice_date es NOT NULL, así que debemos proporcionar un valor válido
          const invoiceDate = updatedAuction.auction_date || updatedAuction.date || new Date().toISOString().split('T')[0];
          
          // Calcular due_date automáticamente: invoice_date + 10 días
          const invoiceDateObj = new Date(invoiceDate);
          invoiceDateObj.setDate(invoiceDateObj.getDate() + 10);
          const dueDate = invoiceDateObj.toISOString().split('T')[0];
          
          console.log('📝 Datos para purchase:', {
            auction_id: id,
            machine_id: updatedAuction.machine_id,
            supplier_id: supplierId,
            supplier_name: supplierName,
            model: updatedAuction.model,
            serial: updatedAuction.serial,
            invoice_date: invoiceDate,
            due_date: dueDate,
            currency_type: currencyType,
            location: auctionLocation,
            epa: auctionEpa,
            created_by: userId
          });
          
          const purchaseResult = await pool.query(`
            INSERT INTO purchases (
              auction_id, machine_id, supplier_id, supplier_name, model, serial, 
              invoice_date, due_date, incoterm, currency_type, currency, payment_status, trm,
              sales_reported, commerce_reported, luis_lemus_reported,
              purchase_type, location, epa, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING id
          `, [
            id,
            updatedAuction.machine_id, // Ya viene de la subasta
            supplierId,
            supplierName,
            updatedAuction.model,
            updatedAuction.serial,
            invoiceDate, // Usar fecha de subasta o fecha actual (NOT NULL constraint)
            dueDate, // Calcular automáticamente: invoice_date + 10 días
            'EXY', // Incoterm por defecto para subastas (EXY). El usuario de compras puede modificarlo después si es necesario.
            currencyType,
            currencyType, // mantener currency y currency_type alineados
            'PENDIENTE',
            0,
            'PDTE',
            'PDTE',
            'PDTE',
            'SUBASTA',
            auctionLocation || null, // Copiar location desde auction
            auctionEpa || null, // Copiar epa desde auction
            userId
          ]);
          
          const newPurchaseId = purchaseResult.rows[0].id;
          console.log('✅ Purchase creado automáticamente (ID:', newPurchaseId + ')');
          
          // 🔄 Crear equipment automáticamente para el purchase recién creado
          try {
            // Verificar si ya existe un equipment para este purchase
            const existingEquipment = await pool.query(
              'SELECT id FROM equipments WHERE purchase_id = $1',
              [newPurchaseId]
            );
            
            if (existingEquipment.rows.length === 0) {
              // Obtener datos de la máquina para el equipment
              const machineData = await pool.query(`
                SELECT 
                  m.year, m.hours, m.arm_type, m.shoe_width_mm as track_width,
                  m.spec_cabin as cabin_type, m.spec_pip, m.spec_blade
                FROM machines m
                WHERE m.id = $1
              `, [updatedAuction.machine_id]);
              
              const machine = machineData.rows[0] || {};
              
              // Crear equipment con datos básicos
              await pool.query(`
                INSERT INTO equipments (
                  purchase_id,
                  mq,
                  supplier_name,
                  model,
                  serial,
                  year,
                  hours,
                  condition,
                  state,
                  arm_type,
                  track_width,
                  cabin_type,
                  wet_line,
                  blade,
                  created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              `, [
                newPurchaseId,
                null, // MQ se asignará después
                supplierName || '',
                updatedAuction.model || '',
                updatedAuction.serial || '',
                machine.year || null,
                machine.hours || null,
                'USADO', // Las subastas son siempre USADO
                'Libre', // Estado por defecto
                machine.arm_type || null,
                machine.track_width || null,
                machine.cabin_type || null,
                machine.spec_pip ? 'SI' : 'No',
                machine.spec_blade ? 'SI' : 'No',
                userId
              ]);
              
              console.log('✅ Equipment creado automáticamente para purchase (ID:', newPurchaseId + ')');
            } else {
              console.log('ℹ️ Equipment ya existe para este purchase');
            }
          } catch (equipmentError) {
            console.error('❌ Error creando equipment automático:', equipmentError);
            // No lanzar error, solo loguear para no interrumpir el flujo
          }
        } else {
          console.log('ℹ️ Purchase ya existe para esta subasta');
        }
      } catch (purchaseError) {
        // Error crítico: registrar y lanzar para que el usuario sepa que falló
        console.error('❌ Error crítico creando purchase automático:', purchaseError);
        console.error('❌ Detalles del error:', {
          message: purchaseError.message,
          code: purchaseError.code,
          detail: purchaseError.detail,
          constraint: purchaseError.constraint,
          stack: purchaseError.stack
        });
        console.error('❌ Contexto del error:', {
          auction_id: id,
          userId,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          machine_id: updatedAuction?.machine_id,
          status: updatedAuction?.status
        });
        // Lanzar el error para que se reporte al usuario
        // El catch general de la función capturará este error
        throw new Error(`Error al crear purchase automático: ${purchaseError.message || purchaseError}. Por favor, contacte al administrador.`);
      }
      
      // 🔔 Verificar si el purchase se creó exitosamente
      // Si no se creó, generar notificación de "Subasta ganada sin registro de compra"
      try {
        const purchaseCheck = await pool.query(
          'SELECT id FROM purchases WHERE auction_id = $1',
          [id]
        );
        
        if (purchaseCheck.rows.length === 0) {
          // No se creó el purchase, generar notificación
          console.log('⚠️ Purchase no se creó, generando notificación de alerta...');
          const auctionData = await pool.query(`
            SELECT 
              COALESCE(p.mq, 'PDTE-' || LPAD((ABS(HASHTEXT(a.id::text)) % 10000)::text, 4, '0')) as mq,
              m.model, 
              m.serial
            FROM auctions a
            LEFT JOIN machines m ON a.machine_id = m.id
            LEFT JOIN purchases p ON a.id = p.auction_id
            WHERE a.id = $1
          `, [id]);
          
          if (auctionData.rows.length > 0) {
            await triggerNotificationForEvent('status_change', {
              recordId: id,
              mq: auctionData.rows[0].mq,
              model: auctionData.rows[0].model || 'N/A',
              serial: auctionData.rows[0].serial || 'N/A',
              status: 'GANADA',
              triggeredBy: userId
            });
          }
        } else {
          console.log('✅ Purchase creado exitosamente, no se generará notificación de alerta');
        }
      } catch (notifError) {
        console.error('⚠️ Error verificando purchase y generando notificación:', notifError);
      }
    }

    // Eliminar purchase si la subasta cambió de GANADA a PERDIDA o PENDIENTE
    if (shouldDeletePurchase) {
      try {
        console.log('🗑️ Eliminando purchase asociado a subasta que cambió de GANADA...');
        
        const deleteResult = await pool.query(
          'DELETE FROM purchases WHERE auction_id = $1 RETURNING id',
          [id]
        );
        
        if (deleteResult.rows.length > 0) {
          console.log(`✅ Se eliminaron ${deleteResult.rows.length} purchase(s) asociados`);
        } else {
          console.log('ℹ️ No se encontraron purchases para eliminar');
        }
      } catch (error) {
        console.error('❌ Error eliminando purchase:', error);
        // No lanzar error, solo loguear
      }
    }

    // PAUSADO: Notificación de subasta ganada deshabilitada temporalmente
    // Enviar correo si la subasta cambió a GANADA
    // if (shouldSendEmail && updatedAuction) {
    //   try {
    //     console.log('📧 Enviando correo de subasta ganada...');
    //     const emailResult = await sendAuctionWonEmail({
    //       auction_date: updatedAuction.auction_date,
    //       lot_number: updatedAuction.lot_number,
    //       machine_model: updatedAuction.model,
    //       machine_serial: updatedAuction.serial,
    //       machine_year: updatedAuction.year,
    //       machine_hours: updatedAuction.hours,
    //       max_price: updatedAuction.max_price,
    //       purchased_price: updatedAuction.purchased_price,
    //       supplier_name: updatedAuction.supplier_name,
    //       comments: updatedAuction.comments
    //     });
    //     
    //     if (emailResult.success) {
    //       console.log('✅ Correo enviado exitosamente a pcano@partequipos.com');
    //     } else {
    //       console.error('❌ Error al enviar correo:', emailResult.error);
    //     }
    //   } catch (emailError) {
    //     console.error('❌ Error en envío de correo:', emailError);
    //   }
    // }
    
    // Sincronizar location y epa desde auctions a purchases cuando se actualizan
    if (auctionUpdates.location !== undefined || auctionUpdates.epa !== undefined) {
      try {
        const purchaseCheck = await pool.query(
          'SELECT id FROM purchases WHERE auction_id = $1',
          [id]
        );
        
        if (purchaseCheck.rows.length > 0) {
          const purchaseId = purchaseCheck.rows[0].id;
          const purchaseUpdates = {};
          
          if (auctionUpdates.location !== undefined) {
            purchaseUpdates.location = auctionUpdates.location;
          }
          
          if (auctionUpdates.epa !== undefined) {
            purchaseUpdates.epa = auctionUpdates.epa;
          }

          if (Object.keys(purchaseUpdates).length > 0) {
            const purchaseFieldsArr = Object.keys(purchaseUpdates);
            const purchaseValuesArr = Object.values(purchaseUpdates);
            const purchaseSetClause = purchaseFieldsArr.map((field, index) => 
              `${field} = $${index + 1}`
            ).join(', ');
            
            await pool.query(
              `UPDATE purchases SET ${purchaseSetClause}, updated_at = NOW() 
               WHERE id = $${purchaseFieldsArr.length + 1}`,
              [...purchaseValuesArr, purchaseId]
            );
            
            console.log(`✅ Sincronizados campos ${purchaseFieldsArr.join(', ')} desde auction a purchase (ID: ${purchaseId})`);
          }
        }
      } catch (syncError) {
        console.error('❌ Error sincronizando location/epa desde auction a purchase:', syncError);
        // No lanzar error, solo loguear para no interrumpir la actualización de la auction
      }
    }
    
    // Actualizar notificaciones de subastas si cambió el estado
    if (auctionUpdates.status) {
      try {
        const pendingCount = await pool.query(`SELECT COUNT(*) FROM auctions WHERE status = 'PENDIENTE'`);
        if (pendingCount.rows[0].count == 0) {
          await clearAuctionsNotifications();
        } else {
          await checkAndExecuteRules();
        }
      } catch (notifError) {
        console.error('Error al actualizar notificaciones:', notifError);
      }
    }
    
    res.json(updatedAuction);
    
  } catch (error) {
    console.error('❌ Error al actualizar subasta:', error);
    console.error('❌ Stack trace completo:', error.stack);
    // Si el error es específico sobre purchase, devolver ese mensaje
    const errorMessage = error.message?.includes('purchase') 
      ? error.message 
      : 'Error al actualizar subasta';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/auctions/:id - Eliminar subasta (solo admin)
router.delete('/:id', requireSebastian, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role, email } = req.user;
    const userEmail = email?.toLowerCase();
    
    // Admin, gerencia y pcano@partequipos.com pueden eliminar cualquier subasta
    const isGerenciaOrPcano = role === 'admin' || role === 'gerencia' || userEmail === 'pcano@partequipos.com' || userEmail === 'gerencia@partequipos.com';
    
    if (!isGerenciaOrPcano) {
      // Sebastián puede eliminar solo sus subastas
      const check = await pool.query(
        'SELECT id FROM auctions WHERE id = $1 AND created_by = $2',
        [id, userId]
      );
      
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'No puedes eliminar esta subasta' });
      }
    }
    
    await pool.query('DELETE FROM auctions WHERE id = $1', [id]);
    res.json({ message: 'Subasta eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar subasta:', error);
    res.status(500).json({ error: 'Error al eliminar subasta' });
  }
});

// POST /api/auctions/test-email - Probar servicio de correo (solo admin)
router.post('/test-email', async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden probar el correo' });
    }
    
    // Probar conexión
    const connectionTest = await testEmailConnection();
    if (!connectionTest) {
      return res.status(500).json({ error: 'Error en configuración de correo' });
    }
    
    // Enviar correo de prueba
    const testResult = await sendAuctionWonEmail({
      auction_date: new Date(),
      lot_number: 'TEST-001',
      machine_model: 'KOMATSU PC200-8',
      machine_serial: 'TEST12345',
      machine_year: 2020,
      machine_hours: 5000,
      max_price: 50000,
      purchased_price: 45000,
      supplier_name: 'KANEHARU',
      comments: 'Esta es una prueba del sistema de correo automático.'
    });
    
    if (testResult.success) {
      res.json({ 
        success: true, 
        message: 'Correo de prueba enviado exitosamente',
        messageId: testResult.messageId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: testResult.error 
      });
    }
    
  } catch (error) {
    console.error('Error en prueba de correo:', error);
    res.status(500).json({ error: 'Error al probar el servicio de correo' });
  }
});

// POST /api/auctions/test-notification-email - Probar notificación de subasta próxima (solo admin)
router.post('/test-notification-email', async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden probar el correo' });
    }
    
    const { notificationType = '1_DAY_BEFORE' } = req.body;
    
    // Validar tipo de notificación
    if (!['1_DAY_BEFORE', '3_HOURS_BEFORE'].includes(notificationType)) {
      return res.status(400).json({ error: 'Tipo de notificación inválido. Use: 1_DAY_BEFORE o 3_HOURS_BEFORE' });
    }
    
    // Probar conexión
    const connectionTest = await testEmailConnection();
    if (!connectionTest) {
      return res.status(500).json({ error: 'Error en configuración de correo' });
    }
    
    // Calcular hora de Colombia para la prueba
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // 10:00 AM hora Colombia
    
    // Enviar correo de prueba
    const testResult = await sendAuctionUpcomingEmail({
      auction_id: '00000000-0000-0000-0000-000000000000',
      lot_number: 'TEST-LOTE-001',
      machine_model: 'ZX200LC-5B',
      machine_serial: 'TEST123456',
      machine_year: 2020,
      machine_hours: 2500,
      max_price: 45000,
      supplier_name: 'Hitachi Construction Machinery',
      colombia_time: tomorrow.toISOString(),
      local_time: '18:52',
      auction_city: 'Tokio, Japón (GMT+9)',
      comments: 'Esta es una prueba del sistema de notificaciones por correo electrónico.'
    }, notificationType);
    
    if (testResult.success) {
      res.json({ 
        success: true, 
        message: `Correo de notificación (${notificationType}) enviado exitosamente`,
        messageId: testResult.messageId,
        notificationType
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: testResult.error 
      });
    }
    
  } catch (error) {
    console.error('Error en prueba de correo de notificación:', error);
    res.status(500).json({ error: 'Error al probar el servicio de correo de notificación' });
  }
});

export default router;

