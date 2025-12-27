/**
 * Rutas para gestionar reglas automáticas de gastos (OCEAN, Gastos Pto, Flete)
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewManagement } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(canViewManagement);

const TABLE_NAME = 'automatic_cost_rules';

let tableChecked = false;

const ensureTableExists = async () => {
  if (tableChecked) return true;

  const check = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [TABLE_NAME]
  );

  tableChecked = check.rows?.[0]?.exists === true;
  return tableChecked;
};

const normalizePatterns = (patterns = []) => {
  const list = Array.isArray(patterns)
    ? patterns
    : typeof patterns === 'string'
      ? patterns.split(',').map((p) => p.trim())
      : [];

  return Array.from(
    new Set(
      list
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => p.toUpperCase())
    )
  );
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

const findBestRule = async ({ model, brand, shipment_method, tonnage }) => {
  const hasTable = await ensureTableExists();
  if (!hasTable) return null;

  const normalizedModel = (model || '').trim().toUpperCase();
  const normalizedBrand = brand ? brand.trim().toUpperCase() : null;
  const normalizedShipment = shipment_method ? shipment_method.trim().toUpperCase() : null;
  const tonnageValue = parseNumber(tonnage);

  const result = await pool.query(
    `
    SELECT *,
      -- score prioritizes: exact model match > prefix match > generic
      (
        CASE 
          WHEN $1 = ANY(model_patterns) THEN 3
          WHEN EXISTS (
            SELECT 1 FROM unnest(model_patterns) mp WHERE $1 ILIKE mp || '%'
          ) THEN 2
          ELSE 1
        END
      ) AS match_score
    FROM ${TABLE_NAME}
    WHERE active = TRUE
      AND ($2 IS NULL OR brand IS NULL OR UPPER(brand) = $2)
      AND ($3 IS NULL OR shipment_method IS NULL OR shipment_method = $3)
      AND (
        array_length(model_patterns, 1) = 0 
        OR $1 = ANY(model_patterns) 
        OR EXISTS (SELECT 1 FROM unnest(model_patterns) mp WHERE $1 ILIKE mp || '%')
      )
      AND (
        $4 IS NULL
        OR (
          (tonnage_min IS NULL OR tonnage_min <= $4)
          AND (tonnage_max IS NULL OR tonnage_max >= $4)
        )
      )
    ORDER BY match_score DESC, updated_at DESC
    LIMIT 1;
    `,
    [normalizedModel, normalizedBrand, normalizedShipment, tonnageValue]
  );

  return result.rows?.[0] || null;
};

// GET /api/auto-costs/suggest?model=ZX200&brand=HITACHI&shipment=RORO
router.get('/suggest', async (req, res) => {
  try {
    const hasTable = await ensureTableExists();
    if (!hasTable) {
      return res.status(503).json({ error: 'La tabla automatic_cost_rules no existe. Ejecuta la migración.' });
    }

    const { model, brand = null, shipment = null, tonnage = null } = req.query;
    if (!model) {
      return res.status(400).json({ error: 'model es requerido' });
    }

    const rule = await findBestRule({
      model,
      brand,
      shipment_method: shipment,
      tonnage,
    });

    if (!rule) {
      return res.status(404).json({ error: 'No se encontró una regla para el modelo indicado' });
    }

    res.json(rule);
  } catch (error) {
    console.error('Error buscando regla automática:', error);
    res.status(500).json({ error: 'Error al buscar regla automática' });
  }
});

// POST /api/auto-costs/apply
router.post('/apply', async (req, res) => {
  try {
    const hasTable = await ensureTableExists();
    if (!hasTable) {
      return res.status(503).json({ error: 'La tabla automatic_cost_rules no existe. Ejecuta la migración.' });
    }

    const { purchase_id, model, brand = null, shipment = null, tonnage = null, force = false } = req.body;

    if (!purchase_id || !model) {
      return res.status(400).json({ error: 'purchase_id y model son requeridos' });
    }

    // Buscar el purchase para conocer valores actuales
    const purchaseResult = await pool.query(
      'SELECT id, inland, gastos_pto, flete FROM purchases WHERE id = $1',
      [purchase_id]
    );
    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase no encontrado' });
    }

    const purchase = purchaseResult.rows[0];
    if (!force && (parseNumber(purchase.inland) > 0 || parseNumber(purchase.gastos_pto) > 0 || parseNumber(purchase.flete) > 0)) {
      return res.status(409).json({ error: 'El registro ya tiene valores. Usa force=true para sobrescribir.' });
    }

    const rule = await findBestRule({
      model,
      brand,
      shipment_method: shipment,
      tonnage,
    });

    if (!rule) {
      return res.status(404).json({ error: 'No se encontró una regla para el modelo indicado' });
    }

    const updateResult = await pool.query(
      `UPDATE purchases SET 
        inland = $1,
        gastos_pto = $2,
        flete = $3,
        inland_verified = FALSE,
        gastos_pto_verified = FALSE,
        flete_verified = FALSE,
        updated_at = NOW()
      WHERE id = $4
      RETURNING id, inland, gastos_pto, flete, inland_verified, gastos_pto_verified, flete_verified`,
      [
        parseNumber(rule.ocean_usd),
        parseNumber(rule.gastos_pto_cop),
        parseNumber(rule.flete_cop),
        purchase_id,
      ]
    );

    res.json({
      rule,
      updates: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Error aplicando regla automática:', error);
    res.status(500).json({ error: 'Error al aplicar regla automática', details: error.message });
  }
});

// GET /api/auto-costs
router.get('/', async (_req, res) => {
  try {
    const hasTable = await ensureTableExists();
    if (!hasTable) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT * FROM ${TABLE_NAME} ORDER BY tonnage_min NULLS FIRST, brand NULLS FIRST, updated_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener reglas automáticas:', error);
    res.status(500).json({ error: 'Error al obtener reglas automáticas' });
  }
});

// POST /api/auto-costs
router.post('/', async (req, res) => {
  try {
    const hasTable = await ensureTableExists();
    if (!hasTable) {
      return res.status(503).json({ error: 'La tabla automatic_cost_rules no existe. Ejecuta la migración.' });
    }

    const {
      name = null,
      brand = null,
      tonnage_min = null,
      tonnage_max = null,
      tonnage_label = null,
      equipment = null,
      m3 = null,
      shipment_method = null,
      model_patterns = [],
      ocean_usd = null,
      gastos_pto_cop = null,
      flete_cop = null,
      notes = null,
      active = true,
    } = req.body;

    const patterns = normalizePatterns(model_patterns);

    if (!patterns.length) {
      return res.status(400).json({ error: 'Debes indicar al menos un modelo o patrón' });
    }

    const result = await pool.query(
      `INSERT INTO ${TABLE_NAME} (
        name, brand, tonnage_min, tonnage_max, tonnage_label, equipment, m3, shipment_method, model_patterns,
        ocean_usd, gastos_pto_cop, flete_cop, notes, active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14
      )
      RETURNING *`,
      [
        name,
        brand ? brand.trim().toUpperCase() : null,
        parseNumber(tonnage_min),
        parseNumber(tonnage_max),
        tonnage_label,
        equipment,
        parseNumber(m3),
        shipment_method ? shipment_method.trim().toUpperCase() : null,
        patterns,
        parseNumber(ocean_usd),
        parseNumber(gastos_pto_cop),
        parseNumber(flete_cop),
        notes,
        active,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear regla automática:', error);
    res.status(500).json({ error: 'Error al crear regla automática' });
  }
});

// PUT /api/auto-costs/:id
router.put('/:id', async (req, res) => {
  try {
    const hasTable = await ensureTableExists();
    if (!hasTable) {
      return res.status(503).json({ error: 'La tabla automatic_cost_rules no existe. Ejecuta la migración.' });
    }

    const { id } = req.params;
    const {
      name = null,
      brand = null,
      tonnage_min = null,
      tonnage_max = null,
      tonnage_label = null,
      equipment = null,
      m3 = null,
      shipment_method = null,
      model_patterns = [],
      ocean_usd = null,
      gastos_pto_cop = null,
      flete_cop = null,
      notes = null,
      active = true,
    } = req.body;

    const patterns = normalizePatterns(model_patterns);
    if (!patterns.length) {
      return res.status(400).json({ error: 'Debes indicar al menos un modelo o patrón' });
    }

    const result = await pool.query(
      `UPDATE ${TABLE_NAME} SET
        name = $1,
        brand = $2,
        tonnage_min = $3,
        tonnage_max = $4,
        tonnage_label = $5,
        equipment = $6,
        m3 = $7,
        shipment_method = $8,
        model_patterns = $9,
        ocean_usd = $10,
        gastos_pto_cop = $11,
        flete_cop = $12,
        notes = $13,
        active = $14,
        updated_at = NOW()
      WHERE id = $15
      RETURNING *`,
      [
        name,
        brand ? brand.trim().toUpperCase() : null,
        parseNumber(tonnage_min),
        parseNumber(tonnage_max),
        tonnage_label,
        equipment,
        parseNumber(m3),
        shipment_method ? shipment_method.trim().toUpperCase() : null,
        patterns,
        parseNumber(ocean_usd),
        parseNumber(gastos_pto_cop),
        parseNumber(flete_cop),
        notes,
        active,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar regla automática:', error);
    res.status(500).json({ error: 'Error al actualizar regla automática' });
  }
});

// DELETE /api/auto-costs/:id
router.delete('/:id', async (req, res) => {
  try {
    const hasTable = await ensureTableExists();
    if (!hasTable) {
      return res.status(503).json({ error: 'La tabla automatic_cost_rules no existe. Ejecuta la migración.' });
    }

    const { id } = req.params;
    const result = await pool.query(`DELETE FROM ${TABLE_NAME} WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    res.json({ message: 'Regla eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar regla automática:', error);
    res.status(500).json({ error: 'Error al eliminar regla automática' });
  }
});

export default router;

