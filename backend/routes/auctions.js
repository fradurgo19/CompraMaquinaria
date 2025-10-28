/**
 * Rutas de Subastas (Auctions)
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewAuctions, requireSebastian } from '../middleware/auth.js';
import { sendAuctionWonEmail, testEmailConnection } from '../services/email.service.js';

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
        a.date as auction_date,
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
        m.model,
        m.serial,
        m.year,
        m.hours,
        a.supplier_id as supplier_name
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
    `;
    
    const params = [];
    
    // Sebastián solo ve sus propias subastas
    if (role === 'sebastian') {
      query += ' WHERE a.created_by = $1';
      params.push(userId);
    }
    
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
      SELECT a.*, m.*, a.supplier_id as supplier_name
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      WHERE a.id = $1
    `;
    
    const params = [id];
    
    // Sebastián solo ve sus propias subastas
    if (role === 'sebastian') {
      query += ' AND a.created_by = $2';
      params.push(userId);
    }
    
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
        a.date as auction_date,
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
        m.model,
        m.serial,
        m.year,
        m.hours,
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
    const updates = req.body;
    
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
    const machineFields = ['model', 'serial', 'year', 'hours', 'drive_folder_id', 'photos_folder_id'];
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
        a.date as auction_date,
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
        m.model,
        m.serial,
        m.year,
        m.hours,
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
            updatedAuction.auction_date || new Date(),
            'EXW',
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

export default router;

