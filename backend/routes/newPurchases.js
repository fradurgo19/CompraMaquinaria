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

    // ✅ Los triggers automáticamente crean equipments y service_records
    // No necesitamos createPurchaseMirror() ni syncNewPurchaseToEquipment() manualmente
    // Los triggers sync_new_purchase_to_equipment() y sync_new_purchase_to_service() lo hacen automáticamente

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
      invoice_date, payment_date, due_date, machine_location, incoterm,
      currency, port_of_loading, shipment_departure_date,
      shipment_arrival_date, value, shipping_costs, finance_costs, mc,
      equipment_type, cabin_type, wet_line, dozer_blade, track_type, track_width
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
        due_date = $13,
        machine_location = $14,
        incoterm = $15,
        currency = COALESCE($16, currency),
        port_of_loading = $17,
        shipment_departure_date = $18,
        shipment_arrival_date = $19,
        value = $20,
        shipping_costs = $21,
        finance_costs = $22,
        mc = $23,
        equipment_type = $25,
        cabin_type = $26,
        wet_line = $27,
        dozer_blade = $28,
        track_type = $29,
        track_width = $30,
        updated_at = NOW()
      WHERE id = $24
      RETURNING *
    `, [
      mq, type, shipment, supplier_name, condition,
      brand, model, serial, purchase_order, invoice_number,
      invoice_date, payment_date, due_date, machine_location, incoterm,
      currency, port_of_loading, shipment_departure_date,
      shipment_arrival_date, value, shipping_costs, finance_costs, mc, id,
      equipment_type, cabin_type, wet_line, dozer_blade, track_type, track_width
    ]);

    console.log('✅ Compra nueva actualizada:', id);

    // ✅ Los triggers automáticamente sincronizan a equipments y service_records
    // No necesitamos sincronización manual - los triggers lo hacen automáticamente
    // El control de cambios inline sigue funcionando porque se guarda en change_logs
    // con table_name='new_purchases' y record_id del new_purchase

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

