/**
 * Rutas de Consolidado de Gerencia (Management)
 */

import express from 'express';
import { pool, queryWithRetry } from '../db/connection.js';
import { authenticateToken, canViewManagement } from '../middleware/auth.js';
import { syncPurchaseToNewPurchaseAndEquipment } from '../services/syncBidirectional.js';
import { syncPurchaseToAuctionAndPreselection } from '../services/syncBidirectionalPreselectionAuction.js';

const router = express.Router();

router.use(authenticateToken);
router.use(canViewManagement);

// GET /api/management
router.get('/', async (req, res) => {
  try {
    // Usar queryWithRetry para manejar errores de conexión
    const result = await queryWithRetry(`
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
        -- Especificaciones técnicas de machines
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
        COALESCE(p.ocean_pagos, 0) as ocean_pagos,
        COALESCE(p.trm_ocean, 0) as trm_ocean,
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
        -- Cost. Arancel (CIF Local COP + Gastos Pto + Traslados Nal + PPTO Reparación)
        -- Usar el mismo cálculo de OCEAN (COP) que se usa en cif_local
        (
          COALESCE(
            (COALESCE(p.fob_usd, 0) * COALESCE(p.trm_rate, 0)) +
            CASE 
              -- Si ambos trm_ocean y ocean_pagos tienen valores, usar el cálculo actual
              WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.ocean_pagos IS NOT NULL AND p.ocean_pagos > 0
              THEN p.ocean_pagos * p.trm_ocean
              -- Si falta trm_ocean o ocean_pagos, usar inland (OCEAN USD editable) * trm_rate (TRM COP de la misma tabla)
              WHEN p.inland IS NOT NULL AND p.inland > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0
              THEN p.inland * p.trm_rate
              ELSE 0
            END,
            0
          )
          + COALESCE(p.gastos_pto, 0)
          + COALESCE(p.flete, 0)
          + COALESCE(p.traslado, 0)
          + COALESCE(p.repuestos, 0)
        ) as cost_arancel,
        -- OCEAN (COP): 
        -- Si trm_ocean y ocean_pagos tienen valores, usar trm_ocean * ocean_pagos (comportamiento actual)
        -- Si falta trm_ocean o ocean_pagos (o ambos), calcular como inland (OCEAN USD editable, siempre tiene valor) * trm_rate (TRM COP de la misma tabla)
        CASE 
          -- Si ambos trm_ocean y ocean_pagos tienen valores, usar el cálculo actual
          WHEN p.trm_ocean IS NOT NULL AND p.trm_ocean > 0 AND p.ocean_pagos IS NOT NULL AND p.ocean_pagos > 0
          THEN p.ocean_pagos * p.trm_ocean
          -- Si falta trm_ocean o ocean_pagos (o ambos), usar inland * trm_rate (inland siempre tiene valor por defecto según el modelo)
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
        COALESCE(p.condition, 'USADO') as condition
      FROM purchases p
      LEFT JOIN auctions a ON p.auction_id = a.id
      LEFT JOIN machines m ON p.machine_id = m.id
      LEFT JOIN service_records s ON s.purchase_id = p.id
      WHERE (p.auction_id IS NULL OR a.status = 'GANADA')
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener consolidado:', error);
    res.status(500).json({ error: 'Error al obtener consolidado', details: error.message });
  }
});

// PUT /api/management/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Obtener machine_id asociado al purchase
    const purchaseResult = await pool.query(
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
        const supplierCheck = await pool.query(
          'SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)',
          [normalizedSupplierName]
        );
        if (supplierCheck.rows.length > 0) {
          supplierId = supplierCheck.rows[0].id;
        } else {
          const newSupplier = await pool.query(
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
    const validateIncoterm = (value) => {
      if (!value || value === '' || value === null || value === undefined) {
        // incoterm es NOT NULL en la base de datos, pero si viene vacío, mantener el valor actual
        return undefined; // Retornar undefined para no actualizar el campo
      }
      const normalized = String(value).trim().toUpperCase();
      const validValues = ['EXW', 'FOB'];
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
      const validValues = ['1X40', 'RORO'];
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
      const validValues = ['JPY', 'USD', 'EUR'];
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
      let shouldSkip = false;
      
      try {
        if (dbField === 'incoterm') {
          normalizedValue = validateIncoterm(value);
          // Si validateIncoterm retorna undefined, significa que no debemos actualizar este campo
          if (normalizedValue === undefined) {
            shouldSkip = true;
          }
        } else if (dbField === 'shipment_type_v2') {
          normalizedValue = validateShipmentType(value);
        } else if (dbField === 'currency_type') {
          normalizedValue = validateCurrencyType(value);
        }
      } catch (validationError) {
        // Si la validación falla, devolver error inmediatamente
        return res.status(400).json({ error: validationError.message });
      }
      
      // Si debemos saltar este campo, no procesarlo
      if (shouldSkip) {
        return;
      }
      
      if (allMachineFields.includes(key)) {
        machineUpdates[key] = normalizedValue;
      } else {
        // Solo agregar al purchaseUpdates si el valor no es null o undefined
        // Para incoterm, shipment_type_v2 y currency_type, agregar si hay un valor válido
        if (normalizedValue !== null && normalizedValue !== undefined) {
          purchaseUpdates[dbField] = normalizedValue;
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
      
      await pool.query(
        `UPDATE machines SET ${machineSetClause}, updated_at = NOW() 
         WHERE id = $${machineFieldsArr.length + 1}`,
        [...machineValuesArr, machineId]
      );
      
      // 🔄 Sincronizar también con equipments
      const equipmentResult = await pool.query(`
        SELECT e.id 
        FROM equipments e
        WHERE e.purchase_id = $1
      `, [id]);

      if (equipmentResult.rows.length > 0) {
        const equipmentId = equipmentResult.rows[0].id;
        await pool.query(
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
        
        // Validar según el campo
        if (field === 'incoterm') {
          if (!value || value === '' || value === null || value === undefined) {
            // incoterm es NOT NULL, no actualizar si viene vacío
            return;
          }
          const normalized = String(value).trim().toUpperCase();
          if (!['EXW', 'FOB'].includes(normalized)) {
            throw new Error(`INCOTERM inválido: "${value}". Solo se permiten: EXW, FOB`);
          }
          validatedFieldsArray.push(field);
          validatedValuesArray.push(normalized);
        } else if (field === 'shipment_type_v2') {
          if (value && value !== '' && value !== null && value !== undefined) {
            const normalized = String(value).trim().toUpperCase();
            if (!['1X40', 'RORO'].includes(normalized)) {
              throw new Error(`Método de embarque inválido: "${value}". Solo se permiten: 1X40, RORO`);
            }
            validatedFieldsArray.push(field);
            validatedValuesArray.push(normalized);
          } else {
            validatedFieldsArray.push(field);
            validatedValuesArray.push(null);
          }
        } else if (field === 'currency_type') {
          if (value && value !== '' && value !== null && value !== undefined) {
            const normalized = String(value).trim().toUpperCase();
            if (!['JPY', 'USD', 'EUR'].includes(normalized)) {
              throw new Error(`Moneda inválida: "${value}". Solo se permiten: JPY, USD, EUR`);
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
        // No hay campos válidos para actualizar
        return res.json({ 
          message: 'No hay campos válidos para actualizar',
          purchase: (await pool.query('SELECT * FROM purchases WHERE id = $1', [id])).rows[0]
        });
      }
      
      const setClause = validatedFields.map((field, i) => `${field} = $${i + 1}`).join(', ');
      
      result = await pool.query(
        `UPDATE purchases SET ${setClause}, updated_at = NOW()
         WHERE id = $${validatedFields.length + 1} RETURNING *`,
        [...validatedValuesArray, id]
      );

      // 🔄 Sincronizar comentarios_servicio a service_records.comentarios
      if ('comentarios_servicio' in purchaseUpdates) {
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
      }

      // 🔄 Sincronizar comentarios_comercial a equipments.commercial_observations
      if ('comentarios_comercial' in purchaseUpdates) {
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
      }
      
      // 🔄 SINCRONIZACIÓN BIDIRECCIONAL: Sincronizar supplier_name a otros módulos
      if ('supplier_name' in purchaseUpdates) {
        try {
          const syncUpdates = { supplier_name: purchaseUpdates.supplier_name };
          // Sincronizar a new_purchases y equipments
          await syncPurchaseToNewPurchaseAndEquipment(id, syncUpdates);
          // Sincronizar a auctions y preselections
          await syncPurchaseToAuctionAndPreselection(id, syncUpdates);
          console.log(`✅ Supplier sincronizado desde Management (ID: ${id}) a otros módulos`);
        } catch (syncError) {
          console.error('⚠️ Error en sincronización bidireccional de supplier (no crítico):', syncError);
        }
      }
      
      // 🔄 SINCRONIZACIÓN: Sincronizar incoterm, shipment_type_v2, currency_type a otros módulos si es necesario
      const syncFields = ['incoterm', 'shipment_type_v2', 'currency_type'];
      const syncUpdatesForFields = {};
      let hasSyncFieldsForFields = false;
      
      syncFields.forEach(field => {
        // Verificar si el campo está en los campos validados y actualizados
        if (validatedFields.includes(field)) {
          const index = validatedFields.indexOf(field);
          syncUpdatesForFields[field] = validatedValuesArray[index];
          hasSyncFieldsForFields = true;
        }
      });
      
      if (hasSyncFieldsForFields) {
        try {
          // Sincronizar a new_purchases y equipments
          await syncPurchaseToNewPurchaseAndEquipment(id, syncUpdatesForFields);
          console.log(`✅ Campos sincronizados desde Management (ID: ${id}):`, Object.keys(syncUpdatesForFields));
        } catch (syncError) {
          console.error('⚠️ Error en sincronización de campos (no crítico):', syncError);
        }
      }
    } else {
      // Si solo se actualizaron especificaciones, devolver el purchase actual
      result = await pool.query('SELECT * FROM purchases WHERE id = $1', [id]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar consolidado:', error);
    res.status(500).json({ error: 'Error al actualizar consolidado', details: error.message });
  }
});

export default router;

