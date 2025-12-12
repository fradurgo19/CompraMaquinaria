/**
 * Rutas de Subastas (Auctions)
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewAuctions, requireSebastian } from '../middleware/auth.js';
import { sendAuctionWonEmail, sendAuctionUpcomingEmail, testEmailConnection } from '../services/email.service.js';
import { triggerNotificationForEvent, clearAuctionsNotifications, checkAndExecuteRules } from '../services/notificationTriggers.js';

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
        a.comments,
        a.photos_folder_id,
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
        a.supplier_id as supplier_name,
        p.id as preselection_id,
        p.colombia_time,
        p.local_time,
        p.auction_city,
        p.auction_date as preselection_auction_date
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      LEFT JOIN preselections p ON p.auction_id = a.id
    `;
    
    const params = [];
    
    // Sebastián ve todas las subastas (no solo las que creó)
    // El filtro se maneja a nivel de RLS si es necesario
    
    query += ' ORDER BY a.date DESC';
    
    const result = await pool.query(query, params);
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
        a.comments,
        a.photos_folder_id,
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
        a.supplier_id as supplier_name,
        p.id as preselection_id,
        p.colombia_time,
        p.local_time,
        p.auction_city,
        p.auction_date as preselection_auction_date
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      LEFT JOIN preselections p ON p.auction_id = a.id
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
        a.comments,
        a.photos_folder_id,
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
        a.supplier_id as supplier_name
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      WHERE a.id = $1
    `, [newAuctionId]);
    
    const newAuction = result.rows[0];
    
    // Enviar correo si la subasta se crea con estado GANADA
    if (status === 'GANADA' && newAuction) {
      try {
        console.log('📧 Enviando correo de subasta ganada (nueva)...');
        const emailResult = await sendAuctionWonEmail({
          auction_date: newAuction.auction_date,
          lot_number: newAuction.lot_number,
          machine_model: newAuction.model,
          machine_serial: newAuction.serial,
          machine_year: newAuction.year,
          machine_hours: newAuction.hours,
          max_price: newAuction.max_price,
          purchased_price: newAuction.purchased_price,
          supplier_name: newAuction.supplier_name,
          comments: newAuction.comments
        });
        
        if (emailResult.success) {
          console.log('✅ Correo enviado exitosamente a pcano@partequipos.com');
        } else {
          console.error('❌ Error al enviar correo:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Error en envío de correo:', emailError);
      }
    }
    
    // Verificar si hay reglas activas de subastas y ejecutarlas
    try {
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
router.put('/:id', requireSebastian, async (req, res) => {
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
    
    // Verificar que la subasta existe y pertenece al usuario (si no es admin)
    const auctionCheck = await pool.query(
      'SELECT id, machine_id FROM auctions WHERE id = $1' + 
      (role !== 'admin' ? ' AND created_by = $2' : ''),
      role !== 'admin' ? [id, userId] : [id]
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
    
    // Verificar si el estado cambió a GANADA ANTES de actualizar
    let shouldSendEmail = false;
    let shouldCreatePurchase = false;
    let shouldDeletePurchase = false;
    
    if (auctionUpdates.status) {
      // Obtener el estado anterior ANTES de actualizar
      const currentAuction = await pool.query(
        'SELECT status FROM auctions WHERE id = $1',
        [id]
      );
      const previousStatus = currentAuction.rows[0]?.status;
      
      console.log('🔄 Cambio de estado:', previousStatus, '->', auctionUpdates.status);
      
      // Si cambiando a GANADA desde otro estado
      if (auctionUpdates.status === 'GANADA' && previousStatus !== 'GANADA') {
        shouldSendEmail = true;
        shouldCreatePurchase = true;
        console.log('✅ Se creará purchase y se enviará correo');
        
        // 🔔 Disparar notificación de subasta ganada
        try {
          const auctionData = await pool.query(`
            SELECT 
              COALESCE(p.mq, 'MQ-' || SUBSTRING(SPLIT_PART(a.id::text, '-', 1), 1, 6)) as mq,
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
        } catch (notifError) {
          console.error('⚠️ Error disparando notificación:', notifError);
        }
      }
      
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
        a.comments,
        a.photos_folder_id,
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
        a.supplier_id as supplier_name
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      WHERE a.id = $1
    `, [id]);
    
    const updatedAuction = finalResult.rows[0];
    
    // Crear purchase automáticamente si la subasta cambió a GANADA
    if (shouldCreatePurchase && updatedAuction) {
      try {
        // Verificar si ya existe un purchase para esta subasta
        const existingPurchase = await pool.query(
          'SELECT id FROM purchases WHERE auction_id = $1',
          [id]
        );

        if (existingPurchase.rows.length === 0) {
          console.log('📦 Creando purchase automático para subasta ganada...');
          
          // Obtener supplier_id (text) y supplier_name de la tabla auctions
          const auctionData = await pool.query(
            'SELECT supplier_id, supplier_id as supplier_name FROM auctions WHERE id = $1',
            [id]
          );
          const supplierId = auctionData.rows[0]?.supplier_id;
          const supplierName = auctionData.rows[0]?.supplier_name || supplierId;
          
          console.log('📝 Datos para purchase:', {
            auction_id: id,
            machine_id: updatedAuction.machine_id,
            supplier_id: supplierId,
            model: updatedAuction.model,
            serial: updatedAuction.serial
          });
          
          await pool.query(`
            INSERT INTO purchases (
              auction_id, machine_id, supplier_id, supplier_name, model, serial, 
              invoice_date, incoterm, payment_status, trm,
              sales_reported, commerce_reported, luis_lemus_reported,
              purchase_type, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            id,
            updatedAuction.machine_id, // Ya viene de la subasta
            supplierId,
            supplierName,
            updatedAuction.model,
            updatedAuction.serial,
            null, // Fecha de factura debe ser llenada manualmente por el usuario de compras
            'EXY', // SUBASTA usa EXY
            'PENDIENTE',
            0,
            'PDTE',
            'PDTE',
            'PDTE',
            'SUBASTA',
            userId
          ]);
          
          console.log('✅ Purchase creado automáticamente');
        } else {
          console.log('ℹ️ Purchase ya existe para esta subasta');
        }
      } catch (error) {
        console.error('❌ Error creando purchase automático:', error);
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

    // Enviar correo si la subasta cambió a GANADA
    if (shouldSendEmail && updatedAuction) {
      try {
        console.log('📧 Enviando correo de subasta ganada...');
        const emailResult = await sendAuctionWonEmail({
          auction_date: updatedAuction.auction_date,
          lot_number: updatedAuction.lot_number,
          machine_model: updatedAuction.model,
          machine_serial: updatedAuction.serial,
          machine_year: updatedAuction.year,
          machine_hours: updatedAuction.hours,
          max_price: updatedAuction.max_price,
          purchased_price: updatedAuction.purchased_price,
          supplier_name: updatedAuction.supplier_name,
          comments: updatedAuction.comments
        });
        
        if (emailResult.success) {
          console.log('✅ Correo enviado exitosamente a pcano@partequipos.com');
        } else {
          console.error('❌ Error al enviar correo:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Error en envío de correo:', emailError);
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
    res.status(500).json({ error: 'Error al actualizar subasta' });
  }
});

// DELETE /api/auctions/:id - Eliminar subasta (solo admin)
router.delete('/:id', requireSebastian, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;
    
    // Solo admin puede eliminar
    if (role !== 'admin') {
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

