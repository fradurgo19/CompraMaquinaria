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
        p.auction_id,
        -- De auctions (si existe)
        m.year,
        m.hours,
        -- De purchases
        p.model,
        p.serial,
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
        -- Precio FOB (suma de valor EXW + BP, gastos FOB + lavado, desensamblaje + cargue)
        (
          COALESCE(p.exw_value_formatted::numeric, 0) + 
          COALESCE(p.fob_expenses::numeric, 0) + 
          COALESCE(p.disassembly_load_value, 0)
        ) as precio_fob,
        -- Inland (de purchases, manual)
        COALESCE(p.inland, 0) as inland,
        -- CIF USD (automático: suma de Precio FOB + Inland)
        (
          COALESCE(p.exw_value_formatted::numeric, 0) + 
          COALESCE(p.fob_expenses::numeric, 0) + 
          COALESCE(p.disassembly_load_value, 0) +
          COALESCE(p.inland, 0)
        ) as cif_usd,
        -- CIF Local (automático: CIF USD * Tasa)
        (
          (
            COALESCE(p.exw_value_formatted::numeric, 0) + 
            COALESCE(p.fob_expenses::numeric, 0) + 
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
          )
        ) as cif_local,
        -- Gastos Puerto, Flete, Traslado, Repuestos, Mant. Ejec. (manuales)
        COALESCE(p.gastos_pto, 0) as gastos_pto,
        COALESCE(p.flete, 0) as flete,
        COALESCE(p.traslado, 0) as traslado,
        COALESCE(p.repuestos, 0) as repuestos,
        COALESCE(p.mant_ejec, 0) as mant_ejec,
        -- Cost. Arancel (automático: suma de CIF Local + Gastos Pto + Flete + Traslado + Repuestos)
        (
          (
            COALESCE(p.exw_value_formatted::numeric, 0) + 
            COALESCE(p.fob_expenses::numeric, 0) + 
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
        p.updated_at
      FROM purchases p
      LEFT JOIN auctions a ON p.auction_id = a.id
      LEFT JOIN machines m ON p.machine_id = m.id
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
    
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    // Actualizar en la tabla purchases
    const result = await pool.query(
      `UPDATE purchases SET ${setClause}, updated_at = NOW()
       WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar consolidado:', error);
    res.status(500).json({ error: 'Error al actualizar consolidado', details: error.message });
  }
});

export default router;

