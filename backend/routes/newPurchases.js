/**
 * Rutas de COMPRAS NUEVOS (New Purchases)
 * Módulo para compras de equipos nuevos - Jefe Comercial
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

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
    
    // Sincronizar primero: insertar compras nuevas que no estén en equipments
    await syncNewPurchasesToEquipments();
    
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
      currency, port_of_loading, shipment_departure_date,
      shipment_arrival_date, value, mc
    } = req.body;

    console.log('📝 POST /api/new-purchases - Creando compra nueva:', { mq, model, serial });

    // Validaciones básicas
    if (!mq || !supplier_name || !model || !serial) {
      return res.status(400).json({ 
        error: 'Campos requeridos: MQ, Proveedor, Modelo, Serial' 
      });
    }

    const result = await pool.query(`
      INSERT INTO new_purchases (
        mq, type, shipment, supplier_name, condition,
        brand, model, serial, purchase_order, invoice_number,
        invoice_date, payment_date, machine_location, incoterm,
        currency, port_of_loading, shipment_departure_date,
        shipment_arrival_date, value, mc, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [
      mq, type || 'COMPRA DIRECTA', shipment, supplier_name, condition || 'NUEVO',
      brand, model, serial, purchase_order, invoice_number,
      invoice_date, payment_date, machine_location, incoterm,
      currency || 'USD', port_of_loading, shipment_departure_date,
      shipment_arrival_date, value, mc, req.user.id
    ]);

    console.log('✅ Compra nueva creada:', result.rows[0].id);

    // Crear registro espejo en purchases para que fluya por importaciones/logística/servicio
    await createPurchaseMirror(result.rows[0]);
    
    // Sincronizar automáticamente a equipments
    await syncNewPurchaseToEquipment(result.rows[0].id);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creando compra nueva:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ 
        error: 'Ya existe una compra con ese MQ o Modelo/Serial' 
      });
    }
    
    res.status(500).json({ error: 'Error creando compra nueva' });
  }
});

// =====================================================
// PUT /api/new-purchases/:id - Actualizar una compra nueva
// =====================================================
router.put('/:id', canEditNewPurchases, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      mq, type, shipment, supplier_name, condition,
      brand, model, serial, purchase_order, invoice_number,
      invoice_date, payment_date, machine_location, incoterm,
      currency, port_of_loading, shipment_departure_date,
      shipment_arrival_date, value, mc
    } = req.body;

    console.log(`📝 PUT /api/new-purchases/${id} - Actualizando compra nueva`);

    // Verificar que existe
    const check = await pool.query('SELECT id FROM new_purchases WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Compra nueva no encontrada' });
    }

    const result = await pool.query(`
      UPDATE new_purchases SET
        mq = COALESCE($1, mq),
        type = COALESCE($2, type),
        shipment = COALESCE($3, shipment),
        supplier_name = COALESCE($4, supplier_name),
        condition = COALESCE($5, condition),
        brand = COALESCE($6, brand),
        model = COALESCE($7, model),
        serial = COALESCE($8, serial),
        purchase_order = $9,
        invoice_number = $10,
        invoice_date = $11,
        payment_date = $12,
        machine_location = $13,
        incoterm = $14,
        currency = COALESCE($15, currency),
        port_of_loading = $16,
        shipment_departure_date = $17,
        shipment_arrival_date = $18,
        value = $19,
        mc = $20,
        updated_at = NOW()
      WHERE id = $21
      RETURNING *
    `, [
      mq, type, shipment, supplier_name, condition,
      brand, model, serial, purchase_order, invoice_number,
      invoice_date, payment_date, machine_location, incoterm,
      currency, port_of_loading, shipment_departure_date,
      shipment_arrival_date, value, mc, id
    ]);

    console.log('✅ Compra nueva actualizada:', id);

    // Actualizar en equipments si ya está sincronizada
    await updateSyncedEquipment(id);

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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Solo admin puede eliminar
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo admin puede eliminar compras nuevas' });
    }

    console.log(`🗑️ DELETE /api/new-purchases/${id}`);

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
 * Sincronizar TODAS las new_purchases a equipments
 * Solo inserta las que no existen aún
 */
async function syncNewPurchasesToEquipments() {
  try {
    // Obtener new_purchases que no tienen registro en equipments
    const newPurchasesToSync = await pool.query(`
      SELECT 
        np.id,
        np.mq,
        np.supplier_name,
        np.model,
        np.serial,
        np.brand,
        np.shipment_departure_date,
        np.shipment_arrival_date,
        np.port_of_loading,
        np.value,
        np.mc,
        np.condition,
        np.machine_location,
        np.invoice_date
      FROM new_purchases np
      WHERE NOT EXISTS (
        SELECT 1 FROM equipments e 
        WHERE e.new_purchase_id = np.id
      )
      ORDER BY np.created_at DESC
    `);

    if (newPurchasesToSync.rows.length > 0) {
      console.log(`🔄 Sincronizando ${newPurchasesToSync.rows.length} compras nuevas a equipments...`);

      for (const np of newPurchasesToSync.rows) {
        await pool.query(`
          INSERT INTO equipments (
            mq, supplier_name, model, serial,
            shipment_departure_date, shipment_arrival_date,
            port_of_destination, pvp_est, condition,
            current_movement, new_purchase_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (mq) DO NOTHING
        `, [
          np.mq, np.supplier_name, np.model, np.serial,
          np.shipment_departure_date, np.shipment_arrival_date,
          np.port_of_loading, np.value, np.condition || 'NUEVO',
          np.machine_location, np.id
        ]);

        // Actualizar referencia en new_purchases
        const equipmentResult = await pool.query(
          'SELECT id FROM equipments WHERE mq = $1',
          [np.mq]
        );
        
        if (equipmentResult.rows.length > 0) {
          await pool.query(
            'UPDATE new_purchases SET synced_to_equipment_id = $1 WHERE id = $2',
            [equipmentResult.rows[0].id, np.id]
          );
        }
      }

      console.log(`✅ ${newPurchasesToSync.rows.length} compras nuevas sincronizadas a equipments`);
    }
  } catch (error) {
    console.error('❌ Error sincronizando compras nuevas a equipments:', error);
  }
}

/**
 * Sincronizar UNA new_purchase específica a equipments
 */
async function syncNewPurchaseToEquipment(newPurchaseId) {
  try {
    const npResult = await pool.query('SELECT * FROM new_purchases WHERE id = $1', [newPurchaseId]);
    
    if (npResult.rows.length === 0) return;

    const np = npResult.rows[0];

    // Insertar en equipments
    await pool.query(`
      INSERT INTO equipments (
        mq, supplier_name, model, serial,
        shipment_departure_date, shipment_arrival_date,
        port_of_destination, pvp_est, condition,
        current_movement, new_purchase_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (mq) DO UPDATE SET
        model = EXCLUDED.model,
        serial = EXCLUDED.serial,
        condition = EXCLUDED.condition
    `, [
      np.mq, np.supplier_name, np.model, np.serial,
      np.shipment_departure_date, np.shipment_arrival_date,
      np.port_of_loading, np.value, np.condition || 'NUEVO',
      np.machine_location, newPurchaseId
    ]);

    // Obtener el ID del equipo y actualizar referencia
    const equipmentResult = await pool.query(
      'SELECT id FROM equipments WHERE mq = $1',
      [np.mq]
    );
    
    if (equipmentResult.rows.length > 0) {
      await pool.query(
        'UPDATE new_purchases SET synced_to_equipment_id = $1 WHERE id = $2',
        [equipmentResult.rows[0].id, newPurchaseId]
      );
    }

    console.log(`✅ Compra nueva ${np.mq} sincronizada a equipments`);
  } catch (error) {
    console.error('❌ Error sincronizando compra nueva a equipment:', error);
  }
}

/**
 * Actualizar equipment cuando se modifica una new_purchase
 */
async function updateSyncedEquipment(newPurchaseId) {
  try {
    const npResult = await pool.query(
      'SELECT * FROM new_purchases WHERE id = $1',
      [newPurchaseId]
    );
    
    if (npResult.rows.length === 0) return;

    const np = npResult.rows[0];

    // Actualizar en equipments
    await pool.query(`
      UPDATE equipments SET
        supplier_name = $1,
        model = $2,
        serial = $3,
        shipment_departure_date = $4,
        shipment_arrival_date = $5,
        port_of_destination = $6,
        pvp_est = $7,
        condition = $8,
        current_movement = $9,
        updated_at = NOW()
      WHERE new_purchase_id = $10
    `, [
      np.supplier_name, np.model, np.serial,
      np.shipment_departure_date, np.shipment_arrival_date,
      np.port_of_loading, np.value, np.condition || 'NUEVO',
      np.machine_location, newPurchaseId
    ]);

    console.log(`✅ Equipment sincronizado desde new_purchase ${np.mq}`);
  } catch (error) {
    console.error('❌ Error actualizando equipment sincronizado:', error);
  }
}

/**
 * Crear registro espejo en purchases para que new_purchase fluya por importaciones/logística/servicio
 */
async function createPurchaseMirror(newPurchase) {
  try {
    // Verificar si ya existe un espejo
    const existing = await pool.query(
      'SELECT id FROM purchases WHERE mq = $1',
      [newPurchase.mq]
    );
    
    if (existing.rows.length > 0) {
      console.log(`⚠️ Ya existe espejo en purchases para ${newPurchase.mq}`);
      return;
    }

    // Crear registro espejo en purchases (con campos nullables para NUEVOS)
    await pool.query(`
      INSERT INTO purchases (
        mq, supplier_name, model, serial,
        invoice_date, payment_date, mc, condition,
        shipment_departure_date, shipment_arrival_date,
        port_of_destination, current_movement,
        purchase_type, payment_status, currency,
        incoterm, pvp_est, trm, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
    `, [
      newPurchase.mq,
      newPurchase.supplier_name,
      newPurchase.model,
      newPurchase.serial,
      newPurchase.invoice_date,
      newPurchase.payment_date,
      newPurchase.mc,
      newPurchase.condition || 'NUEVO',
      newPurchase.shipment_departure_date,
      newPurchase.shipment_arrival_date,
      newPurchase.port_of_loading,
      newPurchase.machine_location,
      newPurchase.type || 'COMPRA DIRECTA',
      newPurchase.payment_date ? 'COMPLETADO' : 'PENDIENTE',
      newPurchase.currency || 'USD',
      newPurchase.incoterm || 'EXW',
      newPurchase.value,
      0, // trm default 0 para NUEVOS
      newPurchase.created_by
    ]);

    console.log(`✅ Registro espejo creado en purchases para ${newPurchase.mq} (condition: NUEVO)`);
  } catch (error) {
    console.error('❌ Error creando espejo en purchases:', error);
  }
}

export default router;

