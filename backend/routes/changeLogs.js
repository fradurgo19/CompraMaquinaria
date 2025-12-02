/**
 * Rutas de Control de Cambios (Change Logs)
 * Sistema de auditoría para registrar modificaciones
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * POST /api/change-logs
 * Registrar cambios en un registro
 */
router.post('/', async (req, res) => {
  try {
    const { table_name, record_id, changes, change_reason, module_name } = req.body;
    const userId = req.user.userId || req.user.id;

    console.log('📥 Recibiendo solicitud de registro de cambios:');
    console.log('  - Tabla:', table_name);
    console.log('  - Record ID:', record_id);
    console.log('  - Módulo:', module_name);
    console.log('  - Cambios:', changes);
    console.log('  - Usuario:', userId);

    if (!table_name || !record_id || !changes || changes.length === 0) {
      console.log('❌ Datos incompletos:', { table_name, record_id, changes });
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar si existe la columna module_name
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'change_logs' AND column_name = 'module_name'
    `);
    const hasModuleName = columnCheck.rows.length > 0;

    // Insertar cada cambio en la tabla
    const insertPromises = changes.map(change => {
      if (hasModuleName) {
        return pool.query(
          `INSERT INTO change_logs 
           (table_name, record_id, field_name, field_label, old_value, new_value, change_reason, changed_by, module_name, changed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           RETURNING *`,
          [
            table_name,
            record_id,
            change.field_name,
            change.field_label,
            change.old_value,
            change.new_value,
            change_reason || null,
            userId,
            module_name || null
          ]
        );
      } else {
        return pool.query(
          `INSERT INTO change_logs 
           (table_name, record_id, field_name, field_label, old_value, new_value, change_reason, changed_by, changed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           RETURNING *`,
          [
            table_name,
            record_id,
            change.field_name,
            change.field_label,
            change.old_value,
            change.new_value,
            change_reason || null,
            userId
          ]
        );
      }
    });

    await Promise.all(insertPromises);

    console.log(`✅ Registrados ${changes.length} cambios en ${table_name} (ID: ${record_id})`);
    
    res.status(201).json({ 
      success: true, 
      message: `${changes.length} cambio(s) registrado(s)`,
      count: changes.length
    });
  } catch (error) {
    console.error('❌ Error al registrar cambios:', error);
    res.status(500).json({ error: 'Error al registrar cambios' });
  }
});

/**
 * GET /api/change-logs/recent
 * Obtener cambios recientes (últimos 50)
 */
router.get('/recent', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         cl.*,
         up.email as changed_by_email,
         up.full_name as changed_by_name
       FROM change_logs cl
       LEFT JOIN users_profile up ON cl.changed_by = up.id
       ORDER BY cl.changed_at DESC
       LIMIT 50`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener cambios recientes:', error);
    res.status(500).json({ error: 'Error al obtener cambios recientes' });
  }
});

/**
 * GET /api/change-logs/full/:purchaseId
 * Obtener historial completo de todos los módulos relacionados a un purchase
 */
router.get('/full/:purchaseId', async (req, res) => {
  try {
    const { purchaseId } = req.params;

    console.log('📤 Solicitando historial COMPLETO para Purchase ID:', purchaseId);

    // Buscar TODOS los cambios relacionados al purchase_id (incluyendo módulos relacionados)
    const result = await pool.query(
      `SELECT 
         cl.*,
         up.email as changed_by_email,
         up.full_name as changed_by_name
       FROM change_logs cl
       LEFT JOIN users_profile up ON cl.changed_by = up.id
       WHERE cl.record_id = $1
          OR cl.record_id IN (
            SELECT id FROM service_records WHERE purchase_id = $1
          )
          OR cl.record_id IN (
            SELECT id FROM equipments WHERE purchase_id = $1
          )
       ORDER BY cl.changed_at DESC`,
      [purchaseId]
    );

    console.log(`✅ Historial completo encontrado: ${result.rows.length} cambio(s) para purchase ${purchaseId}`);
    
    if (result.rows.length > 0) {
      console.log('   Cambios encontrados:');
      result.rows.forEach(row => {
        console.log(`   - [${row.table_name}] ${row.field_label || row.field_name}: ${row.old_value} → ${row.new_value}`);
      });
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener historial completo:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({ error: 'Error al obtener historial completo', details: error.message });
  }
});

/**
 * GET /api/change-logs/:tableName/:recordId
 * Obtener historial de cambios de un registro específico
 * Busca cambios en el registro actual Y en registros relacionados que compartan los mismos campos
 * NOTA: Esta ruta debe estar AL FINAL para no interferir con /full y /recent
 */
router.get('/:tableName/:recordId', async (req, res) => {
  try {
    const { tableName, recordId } = req.params;

    console.log('📤 Solicitando historial específico:');
    console.log('  - Tabla:', tableName);
    console.log('  - Record ID:', recordId);

    // Mapeo de campos compartidos por módulo
    // Esto permite que cambios en un módulo sean visibles en otros módulos que muestren la misma columna
    const sharedFieldsMap = {
      'purchases': [
        // Campos de purchases que pueden verse en otros módulos
        'purchase_order', 'invoice_number', 'location', 'port_of_embarkation', 'cpd',
        'invoice_date', 'payment_date', 'incoterm', 'currency_type', 'exw_value_formatted',
        'fob_expenses', 'disassembly_load_value', 'usd_jpy_rate', 'trm_rate',
        'shipment_type_v2', 'sales_reported', 'commerce_reported', 'luis_lemus_reported',
        // Campos compartidos con auctions/preselections
        'price_bought', 'purchased_price', 'brand', 'model', 'serial', 'year', 'hours',
        'supplier_name', 'lot_number'
      ],
      'auctions': [
        // Campos de auctions que pueden verse en otros módulos
        'price_bought', 'purchased_price', 'brand', 'model', 'serial', 'year', 'hours',
        'supplier_name', 'lot_number', 'status', 'price_max', 'date', 'lot'
      ],
      'preselections': [
        // Campos de preselections que pueden verse en otros módulos
        'brand', 'model', 'serial', 'year', 'hours', 'supplier_name', 'lot_number',
        'auction_date', 'local_time', 'auction_city', 'auction_url', 'currency',
        'location', 'suggested_price', 'purchase_price', 'decision'
      ]
    };

    // Obtener campos compartidos para esta tabla
    const sharedFields = sharedFieldsMap[tableName] || [];

    // Obtener el registro actual para encontrar relaciones
    let relatedRecordIds = [recordId];
    let relatedFieldNames = [];

    // Verificar una sola vez si purchases tiene machine_id (cache para evitar múltiples consultas)
    let purchasesHasMachineId = false;
    try {
      const machineIdCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'purchases' AND column_name = 'machine_id'
      `);
      purchasesHasMachineId = machineIdCheck.rows.length > 0;
    } catch (checkError) {
      // Si falla la verificación, asumir que no existe
      purchasesHasMachineId = false;
    }

    try {
      if (tableName === 'purchases') {
        // Buscar cambios en auctions relacionadas y en el purchase mismo
        let query = 'SELECT auction_id';
        if (purchasesHasMachineId) {
          query += ', machine_id';
        }
        query += ' FROM purchases WHERE id = $1';
        
        const purchaseResult = await pool.query(query, [recordId]);
        if (purchaseResult.rows.length > 0) {
          const purchase = purchaseResult.rows[0];
          if (purchase.auction_id) {
            relatedRecordIds.push(purchase.auction_id);
          }
          // También buscar en preselections relacionadas solo si machine_id existe
          if (purchasesHasMachineId && purchase.machine_id) {
            try {
              const preselResult = await pool.query(
                'SELECT id FROM preselections WHERE machine_id = $1',
                [purchase.machine_id]
              );
              if (preselResult.rows.length > 0) {
                relatedRecordIds.push(...preselResult.rows.map(r => r.id));
              }
            } catch (preselError) {
              // Ignorar errores al buscar preselections relacionadas
            }
          }
        }
        relatedFieldNames = sharedFields;
      } else if (tableName === 'auctions') {
        // Buscar cambios en purchases relacionadas
        let query = 'SELECT id';
        if (purchasesHasMachineId) {
          query += ', machine_id';
        }
        query += ' FROM purchases WHERE auction_id = $1';
        
        const auctionResult = await pool.query(query, [recordId]);
        if (auctionResult.rows.length > 0) {
          relatedRecordIds.push(...auctionResult.rows.map(r => r.id));
          // También buscar en preselections relacionadas solo si machine_id existe
          if (purchasesHasMachineId) {
            // Verificar que la columna machine_id existe antes de acceder a ella
            const machineIds = auctionResult.rows
              .map(r => r.machine_id)
              .filter(id => id !== undefined && id !== null);
            if (machineIds.length > 0) {
              try {
                const preselResult = await pool.query(
                  'SELECT id FROM preselections WHERE machine_id = ANY($1)',
                  [machineIds]
                );
                if (preselResult.rows.length > 0) {
                  relatedRecordIds.push(...preselResult.rows.map(r => r.id));
                }
              } catch (preselError) {
                // Ignorar errores al buscar preselections relacionadas
              }
            }
          }
        }
        relatedFieldNames = sharedFields;
      } else if (tableName === 'preselections') {
        // Buscar cambios en auctions relacionadas
        const preselResult = await pool.query(
          'SELECT id, machine_id FROM preselections WHERE id = $1',
          [recordId]
        );
        if (preselResult.rows.length > 0) {
          const presel = preselResult.rows[0];
          if (presel.machine_id) {
            // Verificar si auctions tiene machine_id
            const auctionsHasMachineId = await pool.query(`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'auctions' AND column_name = 'machine_id'
            `);
            if (auctionsHasMachineId.rows.length > 0) {
              // Buscar auctions relacionadas
              const auctionResult = await pool.query(
                'SELECT id FROM auctions WHERE machine_id = $1',
                [presel.machine_id]
              );
              if (auctionResult.rows.length > 0) {
                relatedRecordIds.push(...auctionResult.rows.map(r => r.id));
              }
            }
            // Buscar purchases relacionadas solo si purchases tiene machine_id
            if (purchasesHasMachineId) {
              try {
                const purchaseResult = await pool.query(
                  'SELECT id FROM purchases WHERE machine_id = $1',
                  [presel.machine_id]
                );
                if (purchaseResult.rows.length > 0) {
                  relatedRecordIds.push(...purchaseResult.rows.map(r => r.id));
                }
              } catch (purchaseError) {
                // Ignorar errores al buscar purchases relacionadas
              }
            }
          }
        }
        relatedFieldNames = sharedFields;
      }
    } catch (relError) {
      // Solo mostrar warning si el error NO es sobre machine_id (ya que sabemos que puede no existir)
      if (!relError.message.includes('machine_id')) {
        console.warn('⚠️ Error al buscar relaciones, continuando solo con el registro actual:', relError.message);
      }
    }

    // Verificar si existe la columna module_name
    let hasModuleName = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'change_logs' AND column_name = 'module_name'
      `);
      hasModuleName = columnCheck.rows.length > 0;
    } catch (err) {
      console.warn('⚠️ Error al verificar columna module_name:', err.message);
    }

    // Obtener machine_id del registro actual para buscar cambios compartidos
    let currentMachineId = null;
    try {
      // Verificar si la columna machine_id existe en cada tabla antes de consultarla
      if (tableName === 'purchases') {
        if (purchasesHasMachineId) {
          const result = await pool.query('SELECT machine_id FROM purchases WHERE id = $1', [recordId]);
          if (result.rows.length > 0) currentMachineId = result.rows[0].machine_id;
        }
      } else if (tableName === 'auctions') {
        const columnCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'auctions' AND column_name = 'machine_id'
        `);
        if (columnCheck.rows.length > 0) {
          const result = await pool.query('SELECT machine_id FROM auctions WHERE id = $1', [recordId]);
          if (result.rows.length > 0) currentMachineId = result.rows[0].machine_id;
        }
      } else if (tableName === 'preselections') {
        const columnCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'preselections' AND column_name = 'machine_id'
        `);
        if (columnCheck.rows.length > 0) {
          const result = await pool.query('SELECT machine_id FROM preselections WHERE id = $1', [recordId]);
          if (result.rows.length > 0) currentMachineId = result.rows[0].machine_id;
        }
      }
    } catch (err) {
      // Solo mostrar warning si el error NO es sobre machine_id (ya que sabemos que puede no existir)
      if (!err.message.includes('machine_id')) {
        console.warn('⚠️ Error al obtener machine_id, continuando sin búsqueda por machine_id:', err.message);
      }
    }

    // Construir la consulta para buscar cambios
    // 1. Cambios directos en el registro
    // 2. Cambios en registros relacionados que compartan los mismos field_name
    // 3. Cambios en CUALQUIER registro relacionado por machine_id que tenga el mismo field_name (visibilidad entre módulos)
    // Usar COALESCE para inferir el módulo desde table_name si module_name es null o no existe
    let moduleNameSelect = '';
    if (hasModuleName) {
      moduleNameSelect = `COALESCE(
        cl.module_name,
        CASE 
          WHEN cl.table_name = 'purchases' THEN 'compras'
          WHEN cl.table_name = 'auctions' THEN 'subasta'
          WHEN cl.table_name = 'preselections' THEN 'preseleccion'
          WHEN cl.table_name = 'equipments' THEN 'equipos'
          WHEN cl.table_name = 'service_records' THEN 'servicio'
          WHEN cl.table_name = 'importations' THEN 'importaciones'
          WHEN cl.table_name = 'payments' THEN 'pagos'
          ELSE cl.table_name
        END
      ) as module_name`;
    } else {
      moduleNameSelect = `CASE 
        WHEN cl.table_name = 'purchases' THEN 'compras'
        WHEN cl.table_name = 'auctions' THEN 'subasta'
        WHEN cl.table_name = 'preselections' THEN 'preseleccion'
        WHEN cl.table_name = 'equipments' THEN 'equipos'
        WHEN cl.table_name = 'service_records' THEN 'servicio'
        WHEN cl.table_name = 'importations' THEN 'importaciones'
        WHEN cl.table_name = 'payments' THEN 'pagos'
        ELSE cl.table_name
      END as module_name`;
    }

    let query = `
      SELECT DISTINCT
        cl.*,
        ${moduleNameSelect},
        up.email as changed_by_email,
        up.full_name as changed_by_name
      FROM change_logs cl
      LEFT JOIN users_profile up ON cl.changed_by = up.id
      WHERE (
        (cl.table_name = $1 AND cl.record_id = $2)
    `;

    const params = [tableName, recordId];

    // Agregar búsqueda en registros relacionados con los mismos field_name
    if (relatedRecordIds.length > 1) {
      query += ` OR (cl.record_id::text = ANY($${params.length + 1}::text[]))`;
      params.push(relatedRecordIds);
      if (relatedFieldNames.length > 0) {
        query += ` AND cl.field_name = ANY($${params.length + 1}))`;
        params.push(relatedFieldNames);
      } else {
        query += ')';
      }
    }

    // Buscar cambios por field_name compartido en registros relacionados por machine_id
    // Esto permite ver cambios de otros módulos si comparten el mismo campo
    if (relatedFieldNames.length > 0 && currentMachineId) {
      // Verificar si las tablas tienen la columna machine_id antes de usarla
      try {
        const auctionsHasMachineId = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'auctions' AND column_name = 'machine_id'
        `);
        const preselectionsHasMachineId = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'preselections' AND column_name = 'machine_id'
        `);

        const subqueries = [];
        if (purchasesHasMachineId) {
          subqueries.push(`SELECT id FROM purchases WHERE machine_id = $${params.length + 2}`);
        }
        if (auctionsHasMachineId.rows.length > 0) {
          subqueries.push(`SELECT id FROM auctions WHERE machine_id = $${params.length + 2}`);
        }
        if (preselectionsHasMachineId.rows.length > 0) {
          subqueries.push(`SELECT id FROM preselections WHERE machine_id = $${params.length + 2}`);
        }

        if (subqueries.length > 0) {
          query += ` OR (
            cl.field_name = ANY($${params.length + 1})
            AND cl.record_id IN (
              ${subqueries.join(' UNION ')}
            )
          )`;
          params.push(relatedFieldNames, currentMachineId);
        }
      } catch (err) {
        // Solo mostrar warning si el error NO es sobre machine_id (ya que sabemos que puede no existir)
        if (!err.message.includes('machine_id')) {
          console.warn('⚠️ Error al verificar columnas machine_id:', err.message);
        }
      }
    }

    query += `)
      ORDER BY cl.changed_at DESC
      LIMIT 50`;

    const result = await pool.query(query, params);

    console.log(`✅ Encontrados ${result.rows.length} cambio(s) para ${tableName} (ID: ${recordId})`);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial de cambios' });
  }
});

/**
 * POST /api/change-logs/batch
 * Obtener historial de cambios para múltiples registros en una sola consulta
 * Body: { table_name: string, record_ids: string[] }
 */
router.post('/batch', async (req, res) => {
  try {
    const { table_name, record_ids } = req.body;

    if (!table_name || !record_ids || !Array.isArray(record_ids) || record_ids.length === 0) {
      return res.status(400).json({ error: 'table_name y record_ids (array) son requeridos' });
    }

    // Verificar si existe la columna module_name
    let hasModuleName = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'change_logs' AND column_name = 'module_name'
      `);
      hasModuleName = columnCheck.rows.length > 0;
    } catch (err) {
      console.warn('⚠️ Error al verificar columna module_name:', err.message);
    }

    let moduleNameSelect = '';
    if (hasModuleName) {
      moduleNameSelect = `COALESCE(
        cl.module_name,
        CASE 
          WHEN cl.table_name = 'purchases' THEN 'compras'
          WHEN cl.table_name = 'auctions' THEN 'subasta'
          WHEN cl.table_name = 'preselections' THEN 'preseleccion'
          WHEN cl.table_name = 'equipments' THEN 'equipos'
          WHEN cl.table_name = 'service_records' THEN 'servicio'
          WHEN cl.table_name = 'importations' THEN 'importaciones'
          WHEN cl.table_name = 'payments' THEN 'pagos'
          ELSE cl.table_name
        END
      ) as module_name`;
    } else {
      moduleNameSelect = `CASE 
        WHEN cl.table_name = 'purchases' THEN 'compras'
        WHEN cl.table_name = 'auctions' THEN 'subasta'
        WHEN cl.table_name = 'preselections' THEN 'preseleccion'
        WHEN cl.table_name = 'equipments' THEN 'equipos'
        WHEN cl.table_name = 'service_records' THEN 'servicio'
        WHEN cl.table_name = 'importations' THEN 'importaciones'
        WHEN cl.table_name = 'payments' THEN 'pagos'
        ELSE cl.table_name
      END as module_name`;
    }

    const query = `
      SELECT DISTINCT
        cl.*,
        ${moduleNameSelect},
        up.email as changed_by_email,
        up.full_name as changed_by_name
      FROM change_logs cl
      LEFT JOIN users_profile up ON cl.changed_by = up.id
      WHERE cl.table_name = $1
        AND cl.record_id::text = ANY($2::text[])
      ORDER BY cl.record_id, cl.changed_at DESC
    `;

    const result = await pool.query(query, [table_name, record_ids]);

    // Agrupar por record_id
    const grouped = {};
    result.rows.forEach(row => {
      if (!grouped[row.record_id]) {
        grouped[row.record_id] = [];
      }
      grouped[row.record_id].push(row);
    });

    console.log(`✅ Encontrados cambios para ${Object.keys(grouped).length} registro(s) de ${table_name}`);
    res.json(grouped);
  } catch (error) {
    console.error('❌ Error al obtener historial batch:', error);
    res.status(500).json({ error: 'Error al obtener historial de cambios' });
  }
});

/**
 * POST /api/change-logs/batch-by-purchase
 * Obtener historial de cambios de service_records usando purchase_ids
 * Body: { purchase_ids: string[] }
 * Retorna: { [purchase_id]: changes[] }
 */
router.post('/batch-by-purchase', async (req, res) => {
  try {
    const { purchase_ids } = req.body;

    if (!purchase_ids || !Array.isArray(purchase_ids) || purchase_ids.length === 0) {
      return res.status(400).json({ error: 'purchase_ids (array) es requerido' });
    }

    // Verificar si existe la columna module_name
    let hasModuleName = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'change_logs' AND column_name = 'module_name'
      `);
      hasModuleName = columnCheck.rows.length > 0;
    } catch (err) {
      console.warn('⚠️ Error al verificar columna module_name:', err.message);
    }

    // Buscar los service_records por purchase_id y luego sus change_logs
    const query = hasModuleName ? `
      SELECT 
        sr.purchase_id,
        cl.id,
        cl.field_name,
        cl.field_label,
        cl.old_value,
        cl.new_value,
        cl.change_reason,
        cl.changed_at,
        COALESCE(cl.module_name, 'servicio') as module_name,
        u.full_name as changed_by_name
      FROM change_logs cl
      INNER JOIN service_records sr ON sr.id = cl.record_id::uuid
      LEFT JOIN users_profile u ON cl.changed_by::text = u.id::text
      WHERE cl.table_name = 'service_records'
        AND sr.purchase_id = ANY($1::uuid[])
      ORDER BY cl.changed_at DESC
    ` : `
      SELECT 
        sr.purchase_id,
        cl.id,
        cl.field_name,
        cl.field_label,
        cl.old_value,
        cl.new_value,
        cl.change_reason,
        cl.changed_at,
        'servicio' as module_name,
        u.full_name as changed_by_name
      FROM change_logs cl
      INNER JOIN service_records sr ON sr.id = cl.record_id::uuid
      LEFT JOIN users_profile u ON cl.changed_by::text = u.id::text
      WHERE cl.table_name = 'service_records'
        AND sr.purchase_id = ANY($1::uuid[])
      ORDER BY cl.changed_at DESC
    `;

    const result = await pool.query(query, [purchase_ids]);

    // Agrupar por purchase_id
    const grouped = {};
    for (const row of result.rows) {
      const purchaseId = row.purchase_id;
      if (!grouped[purchaseId]) {
        grouped[purchaseId] = [];
      }
      grouped[purchaseId].push({
        id: row.id,
        field_name: row.field_name,
        field_label: row.field_label,
        old_value: row.old_value,
        new_value: row.new_value,
        change_reason: row.change_reason,
        changed_at: row.changed_at,
        module_name: row.module_name || 'servicio',
        changed_by_name: row.changed_by_name
      });
    }

    res.json(grouped);
  } catch (error) {
    console.error('❌ Error al obtener historial batch-by-purchase:', error);
    res.status(500).json({ error: 'Error al obtener historial de cambios' });
  }
});

/**
 * POST /api/change-logs/batch-by-new-purchase
 * Obtener historial de cambios de new_purchases usando los IDs de new_purchases
 * Body: { new_purchase_ids: string[] }
 * Retorna: { [new_purchase_id]: changes[] }
 */
router.post('/batch-by-new-purchase', async (req, res) => {
  try {
    const { new_purchase_ids } = req.body;

    if (!new_purchase_ids || !Array.isArray(new_purchase_ids) || new_purchase_ids.length === 0) {
      return res.status(400).json({ error: 'new_purchase_ids (array) es requerido' });
    }

    // Verificar si existe la columna module_name
    let hasModuleName = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'change_logs' AND column_name = 'module_name'
      `);
      hasModuleName = columnCheck.rows.length > 0;
    } catch (err) {
      console.warn('⚠️ Error al verificar columna module_name:', err.message);
    }

    const query = hasModuleName ? `
      SELECT 
        cl.record_id as new_purchase_id,
        cl.id,
        cl.field_name,
        cl.field_label,
        cl.old_value,
        cl.new_value,
        cl.change_reason,
        cl.changed_at,
        COALESCE(cl.module_name, 'compras_nuevos') as module_name,
        u.full_name as changed_by_name
      FROM change_logs cl
      LEFT JOIN users_profile u ON cl.changed_by::text = u.id::text
      WHERE cl.table_name = 'new_purchases'
        AND cl.record_id::text = ANY($1::text[])
      ORDER BY cl.changed_at DESC
    ` : `
      SELECT 
        cl.record_id as new_purchase_id,
        cl.id,
        cl.field_name,
        cl.field_label,
        cl.old_value,
        cl.new_value,
        cl.change_reason,
        cl.changed_at,
        'compras_nuevos' as module_name,
        u.full_name as changed_by_name
      FROM change_logs cl
      LEFT JOIN users_profile u ON cl.changed_by::text = u.id::text
      WHERE cl.table_name = 'new_purchases'
        AND cl.record_id::text = ANY($1::text[])
      ORDER BY cl.changed_at DESC
    `;

    const result = await pool.query(query, [new_purchase_ids]);

    // Agrupar por new_purchase_id
    const grouped = {};
    for (const row of result.rows) {
      const newPurchaseId = row.new_purchase_id;
      if (!grouped[newPurchaseId]) {
        grouped[newPurchaseId] = [];
      }
      grouped[newPurchaseId].push({
        id: row.id,
        field_name: row.field_name,
        field_label: row.field_label,
        old_value: row.old_value,
        new_value: row.new_value,
        change_reason: row.change_reason,
        changed_at: row.changed_at,
        module_name: row.module_name || 'compras_nuevos',
        changed_by_name: row.changed_by_name
      });
    }

    res.json(grouped);
  } catch (error) {
    console.error('❌ Error al obtener historial batch-by-new-purchase:', error);
    res.status(500).json({ error: 'Error al obtener historial de cambios' });
  }
});

export default router;

