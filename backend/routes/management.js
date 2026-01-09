/**
 * Rutas de Consolidado de Gerencia (Management)
 */

import express from 'express';
import { pool, queryWithRetry, connectWithSemaphore } from '../db/connection.js';
import { authenticateToken, canViewManagement } from '../middleware/auth.js';
import { syncPurchaseToNewPurchaseAndEquipment } from '../services/syncBidirectional.js';
import { syncPurchaseToAuctionAndPreselection } from '../services/syncBidirectionalPreselectionAuction.js';

const router = express.Router();

router.use(authenticateToken);
router.use(canViewManagement);

// GET /api/management
// OPTIMIZACIÓN: Soporta paginación opcional y caching para mejor rendimiento con 10,000+ registros
router.get('/', async (req, res) => {
  try {
    // Parámetros de paginación (opcionales, por defecto sin límite para compatibilidad)
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const getAll = req.query.all === 'true'; // Flag para obtener todos los registros
    
    // Construir la query base
    let query = `
      SELECT 
        p.id,
        p.machine_id,
        p.auction_id,
        -- 🔄 Datos de máquina obtenidos de la tabla machines (SINCRONIZACIÓN AUTOMÁTICA)
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours,
        m.machine_type,
        -- Especificaciones técnicas de machines (evitar duplicados)
        m.wet_line,
        m.arm_type,
        m.track_width,
        m.bucket_capacity,
        m.warranty_months,
        m.warranty_hours,
        m.engine_brand,
        m.cabin_type,
        m.blade,
        -- Nuevas especificaciones desde preselección
        m.shoe_width_mm,
        m.spec_pip,
        m.spec_blade,
        m.spec_cabin,
        m.spec_pad,
        -- De purchases
        p.shipment_type_v2 as shipment,
        p.supplier_name as supplier,
        p.purchase_type as tipo_compra,
        p.incoterm,
        p.incoterm as tipo_incoterm,
        p.currency_type as currency,
        p.fob_usd,
        p.usd_jpy_rate,
        p.trm_rate,
        p.ocean_pagos,
        p.trm_ocean,
        -- Cálculo de Tasa: TRM / USD-JPY
        CASE 
          WHEN p.usd_jpy_rate IS NOT NULL AND p.usd_jpy_rate > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0 
            THEN p.trm_rate / p.usd_jpy_rate
          WHEN p.trm_rate IS NOT NULL AND p.trm_rate > 0 
            THEN p.trm_rate
          ELSE NULL
        END as tasa,
        -- FOB ORIGEN (precio base)
        CASE 
          WHEN p.incoterm = 'CIF' THEN COALESCE(p.cif_usd, 0)
          ELSE (
            COALESCE(NULLIF(p.exw_value_formatted, '')::numeric, 0) + 
            COALESCE(NULLIF(p.fob_expenses, '')::numeric, 0) + 
            COALESCE(p.disassembly_load_value, 0)
          )
        END as precio_fob,
        -- OCEAN (inland manual)
        COALESCE(p.inland, 0) as inland,
        -- CIF USD (ahora solo FOB USD, sin sumar OCEAN)
        COALESCE(p.fob_usd, 0) as cif_usd,
        -- CIF Local (COP) = (FOB USD * TRM COP) - Sin sumar OCEAN (COP)
        (
          COALESCE(p.fob_usd, 0) * COALESCE(p.trm_rate, 0)
        ) as cif_local,
        -- Gastos Puerto, Flete, Traslado, Repuestos, Mant. Ejec. (manuales)
        COALESCE(p.gastos_pto, 0) as gastos_pto,
        COALESCE(p.flete, 0) as flete,
        COALESCE(p.traslado, 0) as traslado,
        COALESCE(p.repuestos, 0) as repuestos,
        -- Valor Servicio desde service_records (reemplaza mant_ejec)
        COALESCE(s.service_value, 0) as service_value,
        s.id as service_record_id,
        -- Campos de verificación
        COALESCE(p.inland_verified, false) as inland_verified,
        COALESCE(p.gastos_pto_verified, false) as gastos_pto_verified,
        COALESCE(p.flete_verified, false) as flete_verified,
        COALESCE(p.traslado_verified, false) as traslado_verified,
        COALESCE(p.repuestos_verified, false) as repuestos_verified,
        COALESCE(p.fob_total_verified, false) as fob_total_verified,
        COALESCE(p.cif_usd_verified, false) as cif_usd_verified,
        -- Cost. Arancel (CIF Local COP + OCEAN COP + Gastos Pto + Traslados Nal + PPTO Reparación)
        -- Usar el mismo cálculo de OCEAN (COP) que se usa en el campo ocean_cop
        (
          COALESCE(p.fob_usd, 0) * COALESCE(p.trm_rate, 0) +
          CASE 
            -- Prioridad 1: Si ambos trm_ocean y ocean_pagos tienen valores (vienen desde pagos), usar ocean_pagos * trm_ocean
            WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.ocean_pagos IS NOT NULL AND p.ocean_pagos > 0
            THEN p.ocean_pagos * p.trm_ocean
            -- Prioridad 2: Si SOLO existe trm_ocean (sin ocean_pagos), usar inland * trm_ocean
            WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.inland IS NOT NULL AND p.inland > 0
            THEN p.inland * p.trm_ocean
            -- Prioridad 3: Si NO existe trm_ocean, usar inland (OCEAN USD) * trm_rate (TRM COP)
            WHEN p.inland IS NOT NULL AND p.inland > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0
            THEN p.inland * p.trm_rate
            ELSE 0
          END +
          COALESCE(p.gastos_pto, 0) +
          COALESCE(p.flete, 0) +
          COALESCE(p.traslado, 0) +
          COALESCE(p.repuestos, 0)
        ) as cost_arancel,
        -- OCEAN (COP): 
        -- Lógica según requerimientos:
        -- 1. Si existen trm_ocean (TRM OCEAN COP) y ocean_pagos (OCEAN Pagos USD) desde pagos: ocean_pagos * trm_ocean
        -- 2. Si SOLO existe trm_ocean (sin ocean_pagos), usar: inland (OCEAN USD) * trm_ocean
        -- 3. Si NO existe trm_ocean, usar: inland (OCEAN USD) * trm_rate (TRM COP)
        CASE 
          -- Prioridad 1: Si ambos trm_ocean y ocean_pagos tienen valores (vienen desde pagos)
          WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.ocean_pagos IS NOT NULL AND p.ocean_pagos > 0
          THEN p.ocean_pagos * p.trm_ocean
          -- Prioridad 2: Si SOLO existe trm_ocean (sin ocean_pagos), usar inland * trm_ocean
          WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.inland IS NOT NULL AND p.inland > 0
          THEN p.inland * p.trm_ocean
          -- Prioridad 3: Si NO existe trm_ocean, usar inland (OCEAN USD) * trm_rate (TRM COP)
          WHEN p.inland IS NOT NULL AND p.inland > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0
          THEN p.inland * p.trm_rate
          ELSE NULL
        END as ocean_cop,
        -- Campos manuales (proyecciones)
        p.proyectado,
        p.pvp_est,
        p.comentarios,
        p.comentarios_servicio,
        p.comentarios_comercial,
        p.sales_state,
        p.created_at,
        p.updated_at,
        COALESCE(p.condition, 'USADO') as condition,
        p.mq
      FROM purchases p
      LEFT JOIN auctions a ON p.auction_id = a.id
      LEFT JOIN machines m ON p.machine_id = m.id
      LEFT JOIN service_records s ON s.purchase_id = p.id
      WHERE (p.auction_id IS NULL OR a.status = 'GANADA')
      ORDER BY 
        -- Prioridad 1: Registros nuevos sin MQ (agregados desde purchases o creados directamente en management)
        CASE 
          WHEN p.mq IS NULL THEN 1
          WHEN p.mq = 'PDTE' THEN 2
          WHEN p.mq ~ '^MQ[0-9]+$' THEN 3
          ELSE 4
        END ASC,
        -- Para MQ numéricos (categoría 3), extraer el número y ordenar descendente (MQ868 -> MQ1)
        -- Usar valor negativo para orden descendente dentro de PostgreSQL
        CASE 
          WHEN p.mq ~ '^MQ[0-9]+$' THEN -CAST(SUBSTRING(p.mq, 3) AS INTEGER)
          ELSE NULL
        END ASC NULLS LAST,
        -- Orden secundario por fecha de creación (más recientes primero) para categorías 1 y 2 (sin MQ y PDTE)
        -- Para categoría 3 (MQ numéricos), este orden no se aplica porque ya están ordenados por número
        CASE 
          WHEN p.mq IS NULL OR p.mq = 'PDTE' THEN p.created_at
          ELSE NULL
        END DESC NULLS LAST
    `;
    
    // Agregar paginación si se especifica y no se solicita todo
    if (!getAll && limit && limit > 0) {
      query += ` LIMIT ${limit} OFFSET ${offset}`;
    }
    
    // Ejecutar query principal
    const result = await queryWithRetry(query);
    
    // Si se solicita con paginación, obtener el total de registros
    let total = null;
    if (!getAll && limit && limit > 0) {
      const countResult = await queryWithRetry(`
        SELECT COUNT(*) as total
        FROM purchases p
        LEFT JOIN auctions a ON p.auction_id = a.id
        WHERE (p.auction_id IS NULL OR a.status = 'GANADA')
      `);
      total = parseInt(countResult.rows[0].total, 10);
    }
    
    // Retornar respuesta con metadatos de paginación si aplica
    if (total !== null) {
      res.json({
        data: result.rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      });
    } else {
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error al obtener consolidado:', error);
    res.status(500).json({ error: 'Error al obtener consolidado', details: error.message });
  }
});

// PUT /api/management/:id
// OPTIMIZACIÓN: Usa un solo cliente del pool para todas las queries para evitar agotar el pool
// Usa connectWithSemaphore para gestionar correctamente el semáforo de conexiones
router.put('/:id', async (req, res) => {
  const client = await connectWithSemaphore();
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Obtener machine_id asociado al purchase
    const purchaseResult = await client.query(
      'SELECT machine_id FROM purchases WHERE id = $1',
      [id]
    );
    
    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase no encontrado' });
    }
    
    const machineId = purchaseResult.rows[0].machine_id;
    
    // Inicializar purchaseUpdates como objeto vacío
    const purchaseUpdates = {};
    
    // 🔄 Manejar supplier_name (puede venir como "supplier" desde el frontend)
    if (updates.supplier || updates.supplier_name) {
      const supplierName = updates.supplier || updates.supplier_name;
      if (supplierName && supplierName.trim() !== '') {
        const normalizedSupplierName = String(supplierName).trim();
        
        // Buscar o crear proveedor
        let supplierId = null;
        const supplierCheck = await client.query(
          'SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)',
          [normalizedSupplierName]
        );
        if (supplierCheck.rows.length > 0) {
          supplierId = supplierCheck.rows[0].id;
        } else {
          const newSupplier = await client.query(
            'INSERT INTO suppliers (name) VALUES ($1) RETURNING id',
            [normalizedSupplierName]
          );
          supplierId = newSupplier.rows[0].id;
        }
        
        // Agregar supplier_id y supplier_name a purchaseUpdates
        purchaseUpdates.supplier_id = supplierId;
        purchaseUpdates.supplier_name = normalizedSupplierName;
        
        // Eliminar supplier del objeto updates para evitar duplicados
        delete updates.supplier;
        delete updates.supplier_name;
      }
    }
    
    // 🔄 Separar campos de máquina (básicos + especificaciones) vs campos de purchase
    const machineBasicFields = ['brand', 'model', 'serial', 'year', 'hours', 'machine_type'];
        const specsFields = ['machine_type', 'wet_line', 'arm_type', 'track_width', 'bucket_capacity', 
                         'warranty_months', 'warranty_hours', 'engine_brand', 'cabin_type', 'blade', 'spec_pad'];
    const allMachineFields = [...machineBasicFields, ...specsFields];
    
    const machineUpdates = {};
    
    // Campos que NO se deben actualizar en purchases (son solo de visualización o vienen de otras tablas)
    const readOnlyFields = ['service_value', 'service_record_id', 'cif_usd', 'cif_local', 'fob_usd'];
    
    // Mapeo de campos calculados a campos reales en la base de datos
    const fieldMapping = {
      'precio_fob': 'exw_value_formatted', // precio_fob es calculado, se guarda en exw_value_formatted
    };
    
    // Validar valores según constraints de la base de datos
    // En consolidado y compras se usan: EXY, FOB, CIF (no EXW)
    const validateIncoterm = (value) => {
      if (!value || value === '' || value === null || value === undefined) {
        // incoterm es NOT NULL en la base de datos, pero si viene vacío, mantener el valor actual
        return undefined; // Retornar undefined para no actualizar el campo
      }
      const normalized = String(value).trim().toUpperCase();
      const validValues = ['EXY', 'FOB', 'CIF'];
      if (!validValues.includes(normalized)) {
        throw new Error(`INCOTERM inválido: "${value}". Solo se permiten: ${validValues.join(', ')}`);
      }
      return normalized;
    };
    
    const validateShipmentType = (value) => {
      if (!value || value === '' || value === null || value === undefined) {
        return null; // shipment_type_v2 puede ser null
      }
      const normalized = String(value).trim().toUpperCase();
      const validValues = ['1X40', 'RORO', 'LOLO'];
      if (!validValues.includes(normalized)) {
        throw new Error(`Método de embarque inválido: "${value}". Solo se permiten: ${validValues.join(', ')}`);
      }
      return normalized;
    };
    
    const validateCurrencyType = (value) => {
      if (!value || value === '' || value === null || value === undefined) {
        return null; // currency_type puede ser null (tiene default 'JPY')
      }
      const normalized = String(value).trim().toUpperCase();
      const validValues = ['JPY', 'GBP', 'EUR', 'USD', 'CAD'];
      if (!validValues.includes(normalized)) {
        throw new Error(`Moneda inválida: "${value}". Solo se permiten: ${validValues.join(', ')}`);
      }
      return normalized;
    };
    
    Object.entries(updates).forEach(([key, value]) => {
      // Excluir campos de solo lectura
      if (readOnlyFields.includes(key)) {
        return; // Ignorar este campo, no actualizar
      }
      
      // Aplicar mapeo de campos si existe
      const dbField = fieldMapping[key] || key;
      
      // Validar y normalizar valores según constraints de la base de datos
      let normalizedValue = value;
      
      try {
        if (dbField === 'incoterm') {
          normalizedValue = validateIncoterm(value);
          // Si validateIncoterm retorna undefined (valor vacío), no agregar a purchaseUpdates
          // incoterm es NOT NULL, así que no se debe actualizar si viene vacío
          if (normalizedValue === undefined) {
            return; // Salir del forEach para este campo
          }
        } else if (dbField === 'shipment_type_v2') {
          normalizedValue = validateShipmentType(value);
          // shipment_type_v2 puede ser null, así que siempre agregarlo
        } else if (dbField === 'currency_type') {
          normalizedValue = validateCurrencyType(value);
          // currency_type puede ser null, así que siempre agregarlo
        }
      } catch (validationError) {
        // Si la validación falla, devolver error inmediatamente
        return res.status(400).json({ error: validationError.message });
      }
      
      if (allMachineFields.includes(key)) {
        machineUpdates[key] = normalizedValue;
      } else {
        // Para shipment_type_v2 y currency_type: siempre agregar (pueden ser null)
        // Para incoterm: solo agregar si hay valor normalizado (no undefined, porque ya se filtró arriba)
        if (dbField === 'shipment_type_v2' || dbField === 'currency_type') {
          purchaseUpdates[dbField] = normalizedValue;
        } else if (dbField === 'incoterm') {
          // incoterm ya fue validado arriba, así que normalizedValue nunca será undefined aquí
          purchaseUpdates[dbField] = normalizedValue;
        } else {
          // Otros campos: solo agregar si el valor no es null o undefined
          if (normalizedValue !== null && normalizedValue !== undefined) {
            purchaseUpdates[dbField] = normalizedValue;
          }
        }
      }
    });
    
    // 🔄 Sincronizar especificaciones con machines si existen cambios
    if (Object.keys(machineUpdates).length > 0 && machineId) {
      const machineFieldsArr = Object.keys(machineUpdates);
      const machineValuesArr = Object.values(machineUpdates);
      const machineSetClause = machineFieldsArr.map((field, index) => 
        `${field} = $${index + 1}`
      ).join(', ');
      
      await client.query(
        `UPDATE machines SET ${machineSetClause}, updated_at = NOW() 
         WHERE id = $${machineFieldsArr.length + 1}`,
        [...machineValuesArr, machineId]
      );
      
      // 🔄 Sincronizar también con equipments
      const equipmentResult = await client.query(`
        SELECT e.id 
        FROM equipments e
        WHERE e.purchase_id = $1
      `, [id]);

      if (equipmentResult.rows.length > 0) {
        const equipmentId = equipmentResult.rows[0].id;
        await client.query(
          `UPDATE equipments SET ${machineSetClause}, updated_at = NOW() 
           WHERE id = $${machineFieldsArr.length + 1}`,
          [...machineValuesArr, equipmentId]
        );
        
        console.log(`✅ Cambios de máquina sincronizados desde Consolidado a Machines y Equipment:`, Object.keys(machineUpdates));
      }
    }
    
    // Actualizar purchase solo si hay campos no-especificaciones
    let result;
    let validatedFields = [];
    if (Object.keys(purchaseUpdates).length > 0) {
      const fields = Object.keys(purchaseUpdates);
      const values = Object.values(purchaseUpdates);
      
      // Validar nuevamente antes de actualizar para asegurarnos de que los valores son válidos
      const validatedFieldsArray = [];
      const validatedValuesArray = [];
      
      fields.forEach((field, index) => {
        const value = values[index];
        
        // Validar según el campo - misma lógica para todos los campos de tipo select/combobox
        if (field === 'incoterm') {
          // incoterm: validar y normalizar, pero permitir que se agregue al UPDATE
          // Si está vacío o null, no actualizar (incoterm es NOT NULL)
          if (value && value !== '' && value !== null && value !== undefined) {
            const normalized = String(value).trim().toUpperCase();
            if (!['EXY', 'FOB', 'CIF'].includes(normalized)) {
              throw new Error(`INCOTERM inválido: "${value}". Solo se permiten: EXY, FOB, CIF`);
            }
            validatedFieldsArray.push(field);
            validatedValuesArray.push(normalized);
          }
          // Si está vacío, simplemente no agregar (no actualizar el campo)
        } else if (field === 'shipment_type_v2') {
          // shipment_type_v2: igual que currency_type - puede ser null
          if (value && value !== '' && value !== null && value !== undefined) {
            const normalized = String(value).trim().toUpperCase();
            if (!['1X40', 'RORO', 'LOLO'].includes(normalized)) {
              throw new Error(`Método de embarque inválido: "${value}". Solo se permiten: 1X40, RORO, LOLO`);
            }
            validatedFieldsArray.push(field);
            validatedValuesArray.push(normalized);
          } else {
            validatedFieldsArray.push(field);
            validatedValuesArray.push(null);
          }
        } else if (field === 'currency_type') {
          // currency_type: puede ser null (tiene default 'JPY')
          if (value && value !== '' && value !== null && value !== undefined) {
            const normalized = String(value).trim().toUpperCase();
            if (!['JPY', 'GBP', 'EUR', 'USD', 'CAD'].includes(normalized)) {
              throw new Error(`Moneda inválida: "${value}". Solo se permiten: JPY, GBP, EUR, USD, CAD`);
            }
            validatedFieldsArray.push(field);
            validatedValuesArray.push(normalized);
          } else {
            validatedFieldsArray.push(field);
            validatedValuesArray.push(null);
          }
        } else {
          // Otros campos, agregar tal cual
          validatedFieldsArray.push(field);
          validatedValuesArray.push(value);
        }
      });
      
      validatedFields = validatedFieldsArray;
      
      if (validatedFields.length === 0) {
        // No hay campos válidos para actualizar (por ejemplo, cuando incoterm viene vacío/null)
        // Retornar el purchase actual sin modificar (mismo formato que cuando sí se actualiza)
        const currentPurchase = await client.query('SELECT * FROM purchases WHERE id = $1', [id]);
        return res.json(currentPurchase.rows[0]);
      }
      
      const setClause = validatedFields.map((field, i) => `${field} = $${i + 1}`).join(', ');
      
      result = await client.query(
        `UPDATE purchases SET ${setClause}, updated_at = NOW()
         WHERE id = $${validatedFields.length + 1} RETURNING *`,
        [...validatedValuesArray, id]
      );

      // Preparar respuesta ANTES de cualquier sincronización adicional
      const responseData = result.rows[0];
      
      // 🔄 SINCRONIZACIÓN: incoterm, shipment_type_v2, currency_type NO necesitan sincronización
      // Estos campos son específicos de purchases y no se sincronizan a new_purchases
      // Enviar respuesta INMEDIATAMENTE sin esperar sincronizaciones
      res.json(responseData);

      // Ejecutar sincronizaciones adicionales en background DESPUÉS de enviar respuesta (fire and forget)
      // Usar setImmediate para ejecutar en el siguiente tick del event loop
      setImmediate(async () => {
        try {
          // 🔄 Sincronizar comentarios_servicio a service_records.comentarios (en background)
          if ('comentarios_servicio' in purchaseUpdates) {
            try {
              const serviceResult = await pool.query(
                'SELECT id FROM service_records WHERE purchase_id = $1',
                [id]
              );
              if (serviceResult.rows.length > 0) {
                await pool.query(
                  'UPDATE service_records SET comentarios = $1, updated_at = NOW() WHERE purchase_id = $2',
                  [purchaseUpdates.comentarios_servicio || null, id]
                );
                console.log(`✅ Comentarios de servicio sincronizados a service_records (purchase_id: ${id})`);
              }
            } catch (err) {
              console.error('⚠️ Error sincronizando comentarios_servicio:', err?.message || err);
            }
          }

          // 🔄 Sincronizar comentarios_comercial a equipments.commercial_observations (en background)
          if ('comentarios_comercial' in purchaseUpdates) {
            try {
              const equipmentResult = await pool.query(
                'SELECT id FROM equipments WHERE purchase_id = $1',
                [id]
              );
              if (equipmentResult.rows.length > 0) {
                await pool.query(
                  'UPDATE equipments SET commercial_observations = $1, updated_at = NOW() WHERE purchase_id = $2',
                  [purchaseUpdates.comentarios_comercial || null, id]
                );
                console.log(`✅ Comentarios comerciales sincronizados a equipments (purchase_id: ${id})`);
              }
            } catch (err) {
              console.error('⚠️ Error sincronizando comentarios_comercial:', err?.message || err);
            }
          }
          
          // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Sincronizar supplier_name a otros módulos (en background)
          if ('supplier_name' in purchaseUpdates) {
            const syncUpdates = { supplier_name: purchaseUpdates.supplier_name };
            Promise.all([
              syncPurchaseToNewPurchaseAndEquipment(id, syncUpdates),
              syncPurchaseToAuctionAndPreselection(id, syncUpdates)
            ])
              .then(() => {
                console.log(`✅ Supplier sincronizado desde Management (ID: ${id}) a otros módulos`);
              })
              .catch((syncError) => {
                console.error('⚠️ Error en sincronización bidireccional de supplier (no crítico, ejecutado en background):', syncError?.message || syncError);
              });
          }
        } catch (bgError) {
          console.error('⚠️ Error en sincronizaciones en background:', bgError?.message || bgError);
        }
      });
    } else {
      // Si solo se actualizaron especificaciones, devolver el purchase actual
      result = await client.query('SELECT * FROM purchases WHERE id = $1', [id]);
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error al actualizar consolidado:', error);
    res.status(500).json({ error: 'Error al actualizar consolidado', details: error.message });
  } finally {
    // SIEMPRE liberar el cliente del pool, incluso si hay errores
    client.release();
  }
});

export default router;

