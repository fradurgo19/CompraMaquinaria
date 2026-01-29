/**
 * Rutas para gestionar especificaciones por defecto de máquinas
 * Permite crear, leer, actualizar y eliminar especificaciones por marca/modelo
 */

import express from 'express';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Middleware para verificar acceso (solo Sebastian y Gerencia)
const canManageSpecDefaults = (req, res, next) => {
  const { role } = req.user;
  if (role === 'sebastian' || role === 'gerencia' || role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'No tienes permisos para gestionar especificaciones por defecto' });
  }
};

// GET /api/machine-spec-defaults - Obtener todas las especificaciones por defecto
router.get('/', canManageSpecDefaults, async (req, res) => {
  try {
    // Verificar si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      // Si la tabla no existe, retornar array vacío
      return res.json([]);
    }
    
    const { brand, model } = req.query;
    let query = 'SELECT * FROM machine_spec_defaults';
    const params = [];
    
    if (brand && model) {
      query += ' WHERE brand = $1 AND model = $2';
      params.push(brand, model);
    } else if (brand) {
      query += ' WHERE brand = $1';
      params.push(brand);
    }
    
    query += ' ORDER BY brand, model';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener especificaciones por defecto:', error);
    // Si hay error (tabla no existe, etc.), retornar array vacío en lugar de error
    if (error.code === '42P01') {
      return res.json([]);
    }
    res.status(500).json({ error: 'Error al obtener especificaciones por defecto' });
  }
});

const getSpecByBrandModel = async (brand, model) => {
  // Primero buscar coincidencia exacta (marca + modelo)
  let result = await pool.query(
    'SELECT * FROM machine_spec_defaults WHERE brand = $1 AND model = $2',
    [brand, model]
  );

  // Si no hay coincidencia exacta y el modelo tiene al menos 4 caracteres, buscar por los primeros 4 con la misma marca
  if (result.rows.length === 0 && model && model.length >= 4) {
    const modelPrefix = model.substring(0, 4);
    result = await pool.query(
      'SELECT * FROM machine_spec_defaults WHERE brand = $1 AND LEFT(model, 4) = $2 ORDER BY model LIMIT 1',
      [brand, modelPrefix]
    );
  }

  // Si aún no hay coincidencia, buscar solo por los primeros 4 caracteres del modelo (sin importar la marca)
  if (result.rows.length === 0 && model && model.length >= 4) {
    const modelPrefix = model.substring(0, 4);
    result = await pool.query(
      'SELECT * FROM machine_spec_defaults WHERE LEFT(model, 4) = $1 ORDER BY brand, model LIMIT 1',
      [modelPrefix]
    );
  }

  return result.rows[0] || null;
};

// POST /api/machine-spec-defaults/batch - Obtener especificaciones por defecto para varias marca/modelo en una sola petición
// Body: { items: [{ brand, model }, ...] }
// Retorna: { [key]: spec } con key = `${brand}_${model}`
router.post('/batch', canManageSpecDefaults, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items (array de { brand, model }) es requerido' });
    }

    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);
    if (!tableCheck.rows[0].exists) {
      return res.json({});
    }

    const grouped = {};
    await Promise.all(
      items.map(async ({ brand, model }) => {
        if (!brand || !model) return;
        const spec = await getSpecByBrandModel(brand, model);
        const key = `${brand}_${model}`;
        if (spec) grouped[key] = spec;
      })
    );
    res.json(grouped);
  } catch (error) {
    console.error('Error al obtener especificaciones por defecto (batch):', error);
    if (error.code === '42P01') return res.json({});
    res.status(500).json({ error: 'Error al obtener especificaciones por defecto' });
  }
});

// GET /api/machine-spec-defaults/by-model?brand=...&model=...
router.get('/by-model', canManageSpecDefaults, async (req, res) => {
  try {
    const { brand, model } = req.query;

    // Verificar si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }

    if (!model) {
      return res.status(400).json({ error: 'model es requerido' });
    }

    const spec = await getSpecByBrandModel(brand, model);

    if (!spec) {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }

    res.json(spec);
  } catch (error) {
    console.error('Error al obtener especificación por defecto:', error);
    if (error.code === '42P01') {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }
    res.status(500).json({ error: 'Error al obtener especificación por defecto' });
  }
});

// GET /api/machine-spec-defaults/:id - Obtener una especificación por defecto
router.get('/:id', canManageSpecDefaults, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }
    
    const result = await pool.query('SELECT * FROM machine_spec_defaults WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener especificación por defecto:', error);
    if (error.code === '42P01') {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }
    res.status(500).json({ error: 'Error al obtener especificación por defecto' });
  }
});

// GET /api/machine-spec-defaults/brand/:brand/model/:model - Obtener especificación por marca y modelo
// Busca primero coincidencia exacta, luego por los primeros 4 caracteres del modelo
router.get('/brand/:brand/model/:model', canManageSpecDefaults, async (req, res) => {
  try {
    const { brand, model } = req.params;
    
    // Verificar si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }
    
    if (!model) {
      return res.status(400).json({ error: 'model es requerido' });
    }

    const spec = await getSpecByBrandModel(brand, model);

    if (!spec) {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }
    
    res.json(spec);
  } catch (error) {
    console.error('Error al obtener especificación por defecto:', error);
    if (error.code === '42P01') {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }
    res.status(500).json({ error: 'Error al obtener especificación por defecto' });
  }
});

// POST /api/machine-spec-defaults - Crear nueva especificación por defecto
router.post('/', canManageSpecDefaults, async (req, res) => {
  try {
    // Verificar si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(503).json({ 
        error: 'La tabla de especificaciones por defecto no existe. Por favor ejecuta la migración primero.' 
      });
    }
    
    // Verificar si la columna shoe_width_mm existe
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
        AND column_name = 'shoe_width_mm'
      );
    `);
    
    const hasShoeWidthColumn = columnCheck.rows[0].exists;
    
    const {
      brand,
      model,
      capacidad,
      tonelage,
      spec_blade,
      spec_pip,
      spec_cabin,
      arm_type,
      shoe_width_mm
    } = req.body;
    
    if (!brand || !model) {
      return res.status(400).json({ error: 'Marca y modelo son requeridos' });
    }
    
    let query, params;
    
    if (hasShoeWidthColumn) {
      query = `INSERT INTO machine_spec_defaults (
        brand, model, capacidad, tonelage, spec_blade, spec_pip, spec_cabin, arm_type, shoe_width_mm
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (brand, model) 
      DO UPDATE SET
        capacidad = EXCLUDED.capacidad,
        tonelage = EXCLUDED.tonelage,
        spec_blade = EXCLUDED.spec_blade,
        spec_pip = EXCLUDED.spec_pip,
        spec_cabin = EXCLUDED.spec_cabin,
        arm_type = EXCLUDED.arm_type,
        shoe_width_mm = EXCLUDED.shoe_width_mm,
        updated_at = NOW()
      RETURNING *`;
      // Parsear shoe_width_mm correctamente
      let shoeWidthValue = null;
      if (shoe_width_mm !== undefined && shoe_width_mm !== null && shoe_width_mm !== '') {
        const parsed = typeof shoe_width_mm === 'string' ? parseFloat(shoe_width_mm) : shoe_width_mm;
        if (!isNaN(parsed) && parsed > 0) {
          shoeWidthValue = parsed;
        }
      }
      params = [brand, model, capacidad || null, tonelage || null, spec_blade || false, spec_pip || false, spec_cabin || null, arm_type || null, shoeWidthValue];
    } else {
      query = `INSERT INTO machine_spec_defaults (
        brand, model, capacidad, tonelage, spec_blade, spec_pip, spec_cabin, arm_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (brand, model) 
      DO UPDATE SET
        capacidad = EXCLUDED.capacidad,
        tonelage = EXCLUDED.tonelage,
        spec_blade = EXCLUDED.spec_blade,
        spec_pip = EXCLUDED.spec_pip,
        spec_cabin = EXCLUDED.spec_cabin,
        arm_type = EXCLUDED.arm_type,
        updated_at = NOW()
      RETURNING *`;
      params = [brand, model, capacidad || null, tonelage || null, spec_blade || false, spec_pip || false, spec_cabin || null, arm_type || null];
    }
    
    const result = await pool.query(query, params);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear especificación por defecto:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ 
        error: 'La tabla de especificaciones por defecto no existe. Por favor ejecuta la migración primero.' 
      });
    }
    if (error.code === '42703') {
      return res.status(503).json({ 
        error: 'La columna shoe_width_mm no existe. Por favor ejecuta la migración: backend/migrations/2025-11-15_add_shoe_width_to_spec_defaults.sql' 
      });
    }
    res.status(500).json({ error: 'Error al crear especificación por defecto' });
  }
});

// PUT /api/machine-spec-defaults/by-tonelage - Actualizar todas las especificaciones de un rango de toneladas
router.put('/by-tonelage', canManageSpecDefaults, async (req, res) => {
  try {
    // Verificar si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(503).json({ 
        error: 'La tabla de especificaciones por defecto no existe. Por favor ejecuta la migración primero.' 
      });
    }
    
    // Verificar si la columna shoe_width_mm existe
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
        AND column_name = 'shoe_width_mm'
      );
    `);
    
    const hasShoeWidthColumn = columnCheck.rows[0].exists;
    
    const {
      brand,
      tonelage,
      spec_blade,
      spec_pip,
      spec_cabin,
      arm_type,
      shoe_width_mm
    } = req.body;
    
    if (!brand || !tonelage) {
      return res.status(400).json({ error: 'Marca y rango de toneladas son requeridos' });
    }
    
    let query, params;
    
    if (hasShoeWidthColumn) {
      query = `UPDATE machine_spec_defaults SET
        spec_blade = $1,
        spec_pip = $2,
        spec_cabin = $3,
        arm_type = $4,
        shoe_width_mm = $5,
        updated_at = NOW()
      WHERE brand = $6 AND tonelage = $7
      RETURNING *`;
      // Parsear shoe_width_mm correctamente
      let shoeWidthValue = null;
      if (shoe_width_mm !== undefined && shoe_width_mm !== null && shoe_width_mm !== '') {
        const parsed = typeof shoe_width_mm === 'string' ? parseFloat(shoe_width_mm) : shoe_width_mm;
        if (!isNaN(parsed) && parsed > 0) {
          shoeWidthValue = parsed;
        }
      }
      params = [spec_blade || false, spec_pip || false, spec_cabin || null, arm_type || null, shoeWidthValue, brand, tonelage];
    } else {
      query = `UPDATE machine_spec_defaults SET
        spec_blade = $1,
        spec_pip = $2,
        spec_cabin = $3,
        arm_type = $4,
        updated_at = NOW()
      WHERE brand = $5 AND tonelage = $6
      RETURNING *`;
      params = [spec_blade || false, spec_pip || false, spec_cabin || null, arm_type || null, brand, tonelage];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron especificaciones para el rango de toneladas especificado' });
    }
    
    res.json({ 
      success: true, 
      updated: result.rows.length,
      specs: result.rows 
    });
  } catch (error) {
    console.error('Error al actualizar especificaciones por rango de toneladas:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ 
        error: 'La tabla de especificaciones por defecto no existe. Por favor ejecuta la migración primero.' 
      });
    }
    res.status(500).json({ error: 'Error al actualizar especificaciones por rango de toneladas' });
  }
});

// PUT /api/machine-spec-defaults/:id - Actualizar especificación por defecto
router.put('/:id', canManageSpecDefaults, async (req, res) => {
  try {
    // Verificar si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(503).json({ 
        error: 'La tabla de especificaciones por defecto no existe. Por favor ejecuta la migración primero.' 
      });
    }
    
    // Verificar si la columna shoe_width_mm existe
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
        AND column_name = 'shoe_width_mm'
      );
    `);
    
    const hasShoeWidthColumn = columnCheck.rows[0].exists;
    
    const { id } = req.params;
    const {
      brand,
      model,
      capacidad,
      tonelage,
      spec_blade,
      spec_pip,
      spec_cabin,
      arm_type,
      shoe_width_mm
    } = req.body;
    
    let query, params;
    
    if (hasShoeWidthColumn) {
      query = `UPDATE machine_spec_defaults SET
        brand = $1,
        model = $2,
        capacidad = $3,
        tonelage = $4,
        spec_blade = $5,
        spec_pip = $6,
        spec_cabin = $7,
        arm_type = $8,
        shoe_width_mm = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING *`;
      // Parsear shoe_width_mm correctamente
      let shoeWidthValue = null;
      if (shoe_width_mm !== undefined && shoe_width_mm !== null && shoe_width_mm !== '') {
        const parsed = typeof shoe_width_mm === 'string' ? parseFloat(shoe_width_mm) : shoe_width_mm;
        if (!isNaN(parsed) && parsed > 0) {
          shoeWidthValue = parsed;
        }
      }
      params = [brand, model, capacidad || null, tonelage || null, spec_blade || false, spec_pip || false, spec_cabin || null, arm_type || null, shoeWidthValue, id];
    } else {
      query = `UPDATE machine_spec_defaults SET
        brand = $1,
        model = $2,
        capacidad = $3,
        tonelage = $4,
        spec_blade = $5,
        spec_pip = $6,
        spec_cabin = $7,
        arm_type = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *`;
      params = [brand, model, capacidad || null, tonelage || null, spec_blade || false, spec_pip || false, spec_cabin || null, arm_type || null, id];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar especificación por defecto:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ 
        error: 'La tabla de especificaciones por defecto no existe. Por favor ejecuta la migración primero.' 
      });
    }
    if (error.code === '42703') {
      return res.status(503).json({ 
        error: 'La columna shoe_width_mm no existe. Por favor ejecuta la migración: backend/migrations/2025-11-15_add_shoe_width_to_spec_defaults.sql' 
      });
    }
    res.status(500).json({ error: 'Error al actualizar especificación por defecto' });
  }
});

// DELETE /api/machine-spec-defaults/:id - Eliminar especificación por defecto
router.delete('/:id', canManageSpecDefaults, async (req, res) => {
  try {
    // Verificar si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(503).json({ 
        error: 'La tabla de especificaciones por defecto no existe. Por favor ejecuta la migración primero.' 
      });
    }
    
    const { id } = req.params;
    const result = await pool.query('DELETE FROM machine_spec_defaults WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Especificación por defecto no encontrada' });
    }
    
    res.json({ message: 'Especificación por defecto eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar especificación por defecto:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ 
        error: 'La tabla de especificaciones por defecto no existe. Por favor ejecuta la migración primero.' 
      });
    }
    res.status(500).json({ error: 'Error al eliminar especificación por defecto' });
  }
});

export default router;

