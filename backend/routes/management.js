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
    
    Object.entries(updates).forEach(([key, value]) => {
      // Excluir campos de solo lectura
      if (readOnlyFields.includes(key)) {
        return; // Ignorar este campo, no actualizar
      }
      if (allMachineFields.includes(key)) {
        machineUpdates[key] = value;
      } else {
        purchaseUpdates[key] = value;
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
    if (Object.keys(purchaseUpdates).length > 0) {
      const fields = Object.keys(purchaseUpdates);
      const values = Object.values(purchaseUpdates);
      const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
      
      result = await pool.query(
        `UPDATE purchases SET ${setClause}, updated_at = NOW()
         WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
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

