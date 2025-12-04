/**
 * Rutas de Consolidado de Gerencia (Management)
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewManagement } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(canViewManagement);

// GET /api/management
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
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
        -- De purchases
        p.shipment_type_v2 as shipment,
        p.supplier_name as supplier,
        p.purchase_type as tipo_compra,
        p.incoterm,
        p.incoterm as tipo_incoterm,
        p.currency_type as currency,
        -- Cálculo de Tasa: TRM / USD-JPY
        CASE 
          WHEN p.usd_jpy_rate IS NOT NULL AND p.usd_jpy_rate > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0 
            THEN p.trm_rate / p.usd_jpy_rate
          WHEN p.trm_rate IS NOT NULL AND p.trm_rate > 0 
            THEN p.trm_rate
          ELSE NULL
        END as tasa,
        -- PRECIO: si incoterm=CIF usa cif_usd directo, sino suma componentes
        CASE 
          WHEN p.incoterm = 'CIF' THEN COALESCE(p.cif_usd, 0)
          ELSE (
            COALESCE(NULLIF(p.exw_value_formatted, '')::numeric, 0) + 
            COALESCE(NULLIF(p.fob_expenses, '')::numeric, 0) + 
            COALESCE(p.disassembly_load_value, 0)
          )
        END as precio_fob,
        -- Inland (de purchases, manual)
        COALESCE(p.inland, 0) as inland,
        -- CIF USD (automático: PRECIO + Inland)
        (
          CASE 
            WHEN p.incoterm = 'CIF' THEN COALESCE(p.cif_usd, 0)
            ELSE (
              COALESCE(NULLIF(p.exw_value_formatted, '')::numeric, 0) + 
              COALESCE(NULLIF(p.fob_expenses, '')::numeric, 0) + 
              COALESCE(p.disassembly_load_value, 0)
            )
          END + COALESCE(p.inland, 0)
        ) as cif_usd,
        -- CIF Local (automático: CIF USD * Tasa)
        (
          (
            CASE 
              WHEN p.incoterm = 'CIF' THEN COALESCE(p.cif_usd, 0)
              ELSE (
                COALESCE(NULLIF(p.exw_value_formatted, '')::numeric, 0) + 
                COALESCE(NULLIF(p.fob_expenses, '')::numeric, 0) + 
                COALESCE(p.disassembly_load_value, 0)
              )
            END + COALESCE(p.inland, 0)
          ) * COALESCE(
            CASE 
              WHEN p.usd_jpy_rate IS NOT NULL AND p.usd_jpy_rate > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0 
                THEN p.trm_rate / p.usd_jpy_rate
              WHEN p.trm_rate IS NOT NULL AND p.trm_rate > 0 
                THEN p.trm_rate
              ELSE 1
            END, 1
          )
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
        -- Cost. Arancel (automático: suma de CIF Local + Gastos Pto + Flete + Traslado + Repuestos)
        (
          (
            COALESCE(NULLIF(p.exw_value_formatted, '')::numeric, 0) + 
            COALESCE(NULLIF(p.fob_expenses, '')::numeric, 0) + 
            COALESCE(p.disassembly_load_value, 0) +
            COALESCE(p.inland, 0)
          ) * COALESCE(
            CASE 
              WHEN p.usd_jpy_rate IS NOT NULL AND p.usd_jpy_rate > 0 AND p.trm_rate IS NOT NULL AND p.trm_rate > 0 
                THEN p.trm_rate / p.usd_jpy_rate
              WHEN p.trm_rate IS NOT NULL AND p.trm_rate > 0 
                THEN p.trm_rate
              ELSE 1
            END, 1
          ) +
          COALESCE(p.gastos_pto, 0) +
          COALESCE(p.flete, 0) +
          COALESCE(p.traslado, 0) +
          COALESCE(p.repuestos, 0)
        ) as cost_arancel,
        -- Campos manuales (proyecciones)
        p.proyectado,
        p.pvp_est,
        p.comentarios,
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
    
    // 🔄 Separar campos de máquina (básicos + especificaciones) vs campos de purchase
    const machineBasicFields = ['brand', 'model', 'serial', 'year', 'hours'];
    const specsFields = ['machine_type', 'wet_line', 'arm_type', 'track_width', 'bucket_capacity', 
                         'warranty_months', 'warranty_hours', 'engine_brand', 'cabin_type', 'blade'];
    const allMachineFields = [...machineBasicFields, ...specsFields];
    
    const machineUpdates = {};
    const purchaseUpdates = {};
    
    Object.entries(updates).forEach(([key, value]) => {
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

