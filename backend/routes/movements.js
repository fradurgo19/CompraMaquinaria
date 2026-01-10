import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticación y autorización
const canManageLogistics = requireRole('logistica', 'admin', 'gerencia');
// Middleware para lectura de movimientos (permite también a jefe_comercial y comerciales)
const canViewMovements = requireRole('logistica', 'admin', 'gerencia', 'jefe_comercial', 'comerciales');

// Obtener movimientos de una compra específica
router.get('/:purchaseId', authenticateToken, canViewMovements, async (req, res) => {
  try {
    const { purchaseId } = req.params;

    // ✅ Verificar si el purchaseId existe en purchases
    let validPurchaseId = purchaseId;
    const purchaseCheck = await pool.query(
      'SELECT id FROM purchases WHERE id = $1',
      [purchaseId]
    );

    // Si no existe en purchases, verificar si es de new_purchases y buscar purchase correspondiente
    if (purchaseCheck.rows.length === 0) {
      const newPurchaseCheck = await pool.query(
        'SELECT id, mq FROM new_purchases WHERE id = $1',
        [purchaseId]
      );

      if (newPurchaseCheck.rows.length > 0) {
        const newPurchase = newPurchaseCheck.rows[0];
        // ✅ Buscar purchase con el mismo mq (puede haber múltiples, usar el más reciente)
        const purchaseByMq = await pool.query(
          'SELECT id FROM purchases WHERE mq = $1 ORDER BY created_at DESC LIMIT 1',
          [newPurchase.mq]
        );

        if (purchaseByMq.rows.length > 0) {
          // Usar el purchase_id más reciente
          validPurchaseId = purchaseByMq.rows[0].id;
        }
        // Si no existe purchase correspondiente, validPurchaseId seguirá siendo purchaseId
        // y la consulta simplemente no devolverá resultados (lo cual es correcto)
      }
    }

    const result = await pool.query(
      `SELECT 
        mm.id,
        mm.purchase_id,
        mm.movement_description,
        mm.movement_date,
        mm.created_at,
        mm.updated_at,
        mm.created_by,
        up.full_name as created_by_name,
        p.driver_name,
        p.current_movement_plate as movement_plate
      FROM machine_movements mm
      LEFT JOIN users_profile up ON mm.created_by = up.id
      LEFT JOIN purchases p ON mm.purchase_id = p.id
      WHERE mm.purchase_id = $1
      ORDER BY mm.movement_date ASC, mm.created_at ASC`,
      [validPurchaseId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ error: 'Error al obtener los movimientos' });
  }
});

// Crear un nuevo movimiento
router.post('/', authenticateToken, canManageLogistics, async (req, res) => {
  try {
    const { purchase_id, movement_description, movement_date, driver_name, movement_plate } = req.body;

    if (!purchase_id || !movement_description || !movement_date) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    
    // Guardar driver_name y movement_plate en purchases (no en machine_movements)
    // Estos campos se actualizan en purchases cuando se crea un movimiento

    // Obtener userId del request - verificar múltiples posibles ubicaciones
    let userId = req.user?.id || req.user?.userId || req.user?.user_id;
    
    // Si aún no está disponible, intentar obtenerlo del token decodificado directamente
    if (!userId && req.user) {
      console.warn('⚠️ userId no encontrado en req.user.id, buscando en otras propiedades:', Object.keys(req.user));
      // El JWT puede tener el ID en diferentes campos
      userId = req.user.sub || req.user.userId || req.user.id;
    }
    
    if (!userId) {
      console.error('❌ Error: userId no disponible. req.user completo:', JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: 'Usuario no autenticado. No se pudo obtener el ID del usuario.' });
    }
    
    console.log(`✅ userId obtenido: ${userId} (tipo: ${typeof userId})`);

    // ✅ Verificar si el purchase_id existe en purchases
    let validPurchaseId = purchase_id;
    const purchaseCheck = await pool.query(
      'SELECT id FROM purchases WHERE id = $1',
      [purchase_id]
    );

    // Si no existe en purchases, verificar si es de new_purchases y crear purchase automáticamente
    if (purchaseCheck.rows.length === 0) {
      const newPurchaseCheck = await pool.query(
        `SELECT 
          id, mq, supplier_name, brand, model, serial, 
          invoice_date, incoterm, currency, port_of_loading,
          shipment_departure_date, shipment_arrival_date, mc,
          condition, shipment, purchase_order, invoice_number,
          payment_date, machine_location, created_by, empresa
        FROM new_purchases WHERE id = $1`,
        [purchase_id]
      );

      if (newPurchaseCheck.rows.length > 0) {
        const newPurchase = newPurchaseCheck.rows[0];
        // ✅ Buscar purchase con el mismo mq (puede haber múltiples, usar el más reciente)
        const purchaseByMq = await pool.query(
          'SELECT id FROM purchases WHERE mq = $1 ORDER BY created_at DESC LIMIT 1',
          [newPurchase.mq]
        );

        if (purchaseByMq.rows.length > 0) {
          // Usar el purchase_id más reciente
          validPurchaseId = purchaseByMq.rows[0].id;
          console.log(`✅ Movimiento: ID de new_purchases (${purchase_id}) mapeado a purchase (${validPurchaseId}) por MQ: ${newPurchase.mq}`);
        } else {
          // ✅ Crear automáticamente un purchase desde new_purchases
          console.log(`🔄 Creando purchase automáticamente desde new_purchases (${purchase_id}) con MQ: ${newPurchase.mq}`);
          
          const client = await pool.connect();
          try {
            await client.query('BEGIN');

            // 1. Crear o buscar supplier (REQUERIDO)
            let supplierId = null;
            const supplierName = newPurchase.supplier_name || 'PROVEEDOR DESCONOCIDO';
            const supplierCheck = await client.query(
              'SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)',
              [supplierName]
            );
            
            if (supplierCheck.rows.length > 0) {
              supplierId = supplierCheck.rows[0].id;
            } else {
              const newSupplier = await client.query(
                'INSERT INTO suppliers (name) VALUES ($1) RETURNING id',
                [supplierName]
              );
              supplierId = newSupplier.rows[0].id;
            }

            // 2. Crear o buscar machine (REQUERIDO)
            let machineId = null;
            const brand = newPurchase.brand || 'SIN MARCA';
            const model = newPurchase.model || 'SIN MODELO';
            const serial = newPurchase.serial || `SERIAL-${newPurchase.mq}`;
            const year = new Date().getFullYear(); // Año actual como valor por defecto (year es NOT NULL)
            
            const machineCheck = await client.query(
              'SELECT id FROM machines WHERE serial = $1',
              [serial]
            );
            
            if (machineCheck.rows.length > 0) {
              machineId = machineCheck.rows[0].id;
            } else {
              const newMachine = await client.query(
                `INSERT INTO machines (brand, model, serial, year, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
                [brand, model, serial, year]
              );
              machineId = newMachine.rows[0].id;
            }

            // 3. Crear purchase con los datos de new_purchases
            // Validar que userId esté disponible antes de insertar
            if (!userId) {
              throw new Error(`userId no disponible. req.user: ${JSON.stringify(req.user)}`);
            }
            
            console.log(`🔍 Creando purchase con userId: ${userId}, machineId: ${machineId}, supplierId: ${supplierId}`);
            
            const purchaseResult = await client.query(
              `INSERT INTO purchases (
                machine_id, supplier_id, invoice_date, incoterm, 
                trm, payment_status, mq, supplier_name, model, serial,
                shipment_type_v2, port_of_embarkation, currency_type,
                shipment_departure_date, shipment_arrival_date, mc,
                condition, purchase_order, invoice_number, payment_date,
                port_of_destination, current_movement, empresa, created_by, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, NOW(), NOW()
              ) RETURNING id`,
              [
                machineId,
                supplierId,
                newPurchase.invoice_date || new Date().toISOString().split('T')[0],
                newPurchase.incoterm || 'EXW',
                0, // trm por defecto
                newPurchase.payment_date ? 'COMPLETADO' : 'PENDIENTE', // Valores válidos: 'PENDIENTE', 'DESBOLSADO', 'COMPLETADO'
                newPurchase.mq,
                supplierName,
                model,
                serial,
                newPurchase.shipment || 'RORO',
                null, // ✅ port_of_embarkation debe ser NULL para registros de new_purchases (port_of_loading va solo a port_of_destination)
                newPurchase.currency || 'USD',
                newPurchase.shipment_departure_date,
                newPurchase.shipment_arrival_date,
                newPurchase.mc,
                newPurchase.condition || 'NUEVO',
                newPurchase.purchase_order,
                newPurchase.invoice_number,
                newPurchase.payment_date,
                newPurchase.port_of_loading, // ✅ port_of_loading de new_purchases va a port_of_destination
                newPurchase.machine_location,
                newPurchase.empresa || 'Partequipos Maquinaria', // ✅ empresa: tomar de new_purchases o usar 'Partequipos Maquinaria' por defecto
                userId // Usar siempre el userId del usuario que crea el movimiento
              ]
            );

            validPurchaseId = purchaseResult.rows[0].id;
            console.log(`✅ Purchase creado automáticamente: ${validPurchaseId} desde new_purchases ${purchase_id}`);

            // 4. ✅ ACTUALIZAR equipment existente (si tiene new_purchase_id) en lugar de crear uno nuevo
            // Buscar si ya existe un equipment con new_purchase_id
            const existingEquipment = await client.query(
              `SELECT id FROM equipments WHERE new_purchase_id = $1`,
              [purchase_id]
            );

            if (existingEquipment.rows.length > 0) {
              // Actualizar el equipment existente para agregar purchase_id
              await client.query(
                `UPDATE equipments 
                 SET purchase_id = $1, updated_at = NOW()
                 WHERE new_purchase_id = $2`,
                [validPurchaseId, purchase_id]
              );
              console.log(`✅ Equipment existente actualizado con purchase_id (ID: ${existingEquipment.rows[0].id})`);
            } else {
              // Si no existe, crear uno nuevo (caso raro pero posible)
              await client.query(
                `INSERT INTO equipments (purchase_id, new_purchase_id, state, created_at, updated_at)
                 VALUES ($1, $2, 'Libre', NOW(), NOW())`,
                [validPurchaseId, purchase_id]
              );
              console.log(`✅ Equipment nuevo creado con purchase_id y new_purchase_id`);
            }

            // 5. Crear service_record asociado (solo si no existe)
            const existingServiceRecord = await client.query(
              `SELECT id FROM service_records WHERE purchase_id = $1 OR new_purchase_id = $2`,
              [validPurchaseId, purchase_id]
            );

            if (existingServiceRecord.rows.length === 0) {
              await client.query(
                `INSERT INTO service_records (purchase_id, created_at, updated_at)
                 VALUES ($1, NOW(), NOW())`,
                [validPurchaseId]
              );
              console.log(`✅ Service_record creado`);
            } else {
              // Actualizar service_record existente para agregar purchase_id si solo tiene new_purchase_id
              await client.query(
                `UPDATE service_records 
                 SET purchase_id = $1, updated_at = NOW()
                 WHERE new_purchase_id = $2 AND purchase_id IS NULL`,
                [validPurchaseId, purchase_id]
              );
              console.log(`✅ Service_record existente actualizado con purchase_id`);
            }

            await client.query('COMMIT');
            console.log(`✅ Purchase, equipment y service_record creados automáticamente para MQ: ${newPurchase.mq}`);
          } catch (createError) {
            await client.query('ROLLBACK');
            console.error('❌ Error al crear purchase automáticamente:', createError);
            throw createError;
          } finally {
            client.release();
          }
        }
      } else {
        return res.status(404).json({ 
          error: 'El purchase_id proporcionado no existe en purchases ni en new_purchases.' 
        });
      }
    }

    // ✅ Crear movimiento solo en purchases (no en new_purchases)
    const result = await pool.query(
      `INSERT INTO machine_movements 
       (purchase_id, movement_description, movement_date, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [validPurchaseId, movement_description, movement_date, userId]
    );
    
    // Actualizar driver_name y current_movement_plate en purchases
    // Solo si el movimiento incluye "SALIÓ", de lo contrario limpiar estos campos
    const isSalio = movement_description && movement_description.toUpperCase().includes('SALIÓ');
    if (isSalio) {
      // Si es "SALIÓ", actualizar con los valores proporcionados
      await pool.query(
        `UPDATE purchases 
         SET driver_name = $1, current_movement_plate = $2, updated_at = NOW()
         WHERE id = $3`,
        [driver_name || null, movement_plate || null, validPurchaseId]
      );
    } else {
      // Si no es "SALIÓ", limpiar estos campos
      await pool.query(
        `UPDATE purchases 
         SET driver_name = NULL, current_movement_plate = NULL, updated_at = NOW()
         WHERE id = $1`,
        [validPurchaseId]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear movimiento:', error);
    res.status(500).json({ error: 'Error al crear el movimiento', details: error.message });
  }
});

// Actualizar un movimiento
router.put('/:id', authenticateToken, canManageLogistics, async (req, res) => {
  try {
    const { id } = req.params;
    const { movement_description, movement_date } = req.body;

    const result = await pool.query(
      `UPDATE machine_movements 
       SET movement_description = $1, movement_date = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [movement_description, movement_date, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    res.status(500).json({ error: 'Error al actualizar el movimiento' });
  }
});

// Eliminar un movimiento
router.delete('/:id', authenticateToken, canManageLogistics, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM machine_movements WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    res.json({ message: 'Movimiento eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    res.status(500).json({ error: 'Error al eliminar el movimiento' });
  }
});

export default router;
