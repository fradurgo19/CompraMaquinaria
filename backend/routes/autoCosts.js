/**
 * Rutas para gestionar reglas automáticas de gastos (OCEAN, Gastos Pto, Flete)
 */

import express from 'express';
import { pool, queryWithRetry } from '../db/connection.js';
import fs from 'fs';
import path from 'path';
// Solo escribir logs de debug en desarrollo local
const isDevelopment = process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
const DEBUG_LOG_PATH = isDevelopment 
  ? path.join(process.cwd(), '.cursor', 'debug.log')
  : null;
import { authenticateToken, canViewManagement } from '../middleware/auth.js';
import { cache, TTL, getAutoCostRuleKey, getTableCheckKey } from '../services/cache.js';
import { autoCostsQueue } from '../services/requestQueue.js';

const router = express.Router();
router.use(authenticateToken);
router.use(canViewManagement);

const TABLE_NAME = 'automatic_cost_rules';

let tableChecked = false;
let tableCheckPromise = null; // Promise para evitar múltiples verificaciones simultáneas
let rulesCache = null; // Cache de todas las reglas activas
let rulesCachePromise = null; // Promise para evitar múltiples cargas simultáneas

const ensureTableExists = async () => {
  // Si ya está verificado, retornar inmediatamente
  if (tableChecked) return true;
  
  // Verificar cache primero
  const cacheKey = getTableCheckKey(TABLE_NAME);
  const cached = cache.get(cacheKey);
  if (cached !== null) {
    tableChecked = cached;
    return cached;
  }
  
  // Si hay una verificación en progreso, esperar a que termine
  if (tableCheckPromise) {
    const result = await tableCheckPromise;
    return result;
  }
  
  // Iniciar nueva verificación
  tableCheckPromise = (async () => {
    try {
      const check = await queryWithRetry(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [TABLE_NAME]
      );

      tableChecked = check.rows?.[0]?.exists === true;
      // Guardar en cache
      cache.set(cacheKey, tableChecked, TTL.TABLE_CHECK);
      return tableChecked;
    } finally {
      // Limpiar la promise después de completar
      tableCheckPromise = null;
    }
  })();
  
  return await tableCheckPromise;
};

/**
 * Pre-cargar todas las reglas activas en memoria para evitar consultas repetidas
 */
const loadRulesCache = async () => {
  // Si ya están cargadas, retornar inmediatamente
  if (rulesCache !== null) return rulesCache;
  
  // Si hay una carga en progreso, esperar
  if (rulesCachePromise) {
    return await rulesCachePromise;
  }
  
  // Iniciar carga
  rulesCachePromise = (async () => {
    try {
      const hasTable = await ensureTableExists();
      if (!hasTable) {
        rulesCache = [];
        return rulesCache;
      }
      
      const result = await queryWithRetry(
        `SELECT * FROM ${TABLE_NAME} WHERE active = TRUE ORDER BY updated_at DESC`
      );
      
      rulesCache = result.rows || [];
      console.log(`✅ Pre-cargadas ${rulesCache.length} reglas automáticas en memoria`);
      return rulesCache;
    } catch (error) {
      console.error('Error cargando reglas en cache:', error);
      rulesCache = [];
      return rulesCache;
    } finally {
      rulesCachePromise = null;
    }
  })();
  
  return await rulesCachePromise;
};

/**
 * Invalidar cache de reglas (llamar cuando se crean/actualizan reglas)
 */
const invalidateRulesCache = () => {
  rulesCache = null;
  cache.invalidatePattern('^auto_cost_rule:');
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

  // Verificar cache primero
  const cacheKey = getAutoCostRuleKey(normalizedModel, normalizedBrand, normalizedShipment, tonnageValue);
  const cached = cache.get(cacheKey);
  if (cached !== null && cached !== undefined) {
    // Si el cache tiene un array vacío, retornarlo (está cacheado como "no encontrado" con TTL corto)
    // Si tiene reglas, retornarlas
    return cached;
  }

  // Pre-cargar reglas en memoria si no están cargadas
  const allRules = await loadRulesCache();
  
  console.log(`📚 Total de reglas cargadas: ${allRules.length}`, {
    normalizedModel,
    normalizedBrand,
    normalizedShipment,
    tonnageValue
  });
  
  // Filtrar reglas en memoria (más rápido que consulta a BD)
  const matchingRules = allRules
    .map(rule => {
      let matchScore = 0;
      
      // Verificar brand
      if (normalizedBrand && rule.brand && rule.brand.toUpperCase() !== normalizedBrand) {
        return null; // No coincide con brand
      }
      
      // Verificar shipment_method
      if (normalizedShipment && rule.shipment_method && rule.shipment_method.toUpperCase() !== normalizedShipment) {
        return null; // No coincide con shipment
      }
      
      // Verificar tonnage
      if (tonnageValue !== null) {
        if (rule.tonnage_min !== null && tonnageValue < rule.tonnage_min) return null;
        if (rule.tonnage_max !== null && tonnageValue > rule.tonnage_max) return null;
      }
      
      // Verificar model_patterns
      const modelPatterns = normalizePatterns(rule.model_patterns);
      if (modelPatterns.length === 0) {
        matchScore = 1; // Regla genérica (sin patrones específicos)
      } else {
        // Mejorar la búsqueda para incluir coincidencias más flexibles
        // Extraer el prefijo base del modelo (ej: "ZX200-3" -> "ZX200")
        const modelBase = normalizedModel.split('-')[0].split('_')[0]; // Separar por guión o underscore
        const modelPrefix3 = normalizedModel.substring(0, 3);
        const modelPrefix4 = normalizedModel.substring(0, 4);
        
        const exactMatch = modelPatterns.some(p => {
          const normalizedPattern = p.toUpperCase().trim();
          return normalizedPattern === normalizedModel;
        });
        
        // Coincidencia por prefijo completo del modelo base (ej: "ZX200" coincide con "ZX200-3")
        const baseMatch = modelPatterns.some(p => {
          const normalizedPattern = p.toUpperCase().trim();
          const patternBase = normalizedPattern.split('-')[0].split('_')[0];
          // El patrón coincide con el modelo base o viceversa
          return patternBase === modelBase || 
                 (modelBase.length >= 3 && normalizedPattern.startsWith(modelBase)) ||
                 (patternBase.length >= 3 && normalizedModel.startsWith(patternBase));
        });
        
        // Coincidencia por prefijo (uno contiene al otro)
        const prefixMatch = modelPatterns.some(p => {
          const normalizedPattern = p.toUpperCase().trim();
          return normalizedModel.startsWith(normalizedPattern) || normalizedPattern.startsWith(normalizedModel);
        });
        
        // Coincidencia por primeros 4 caracteres
        const prefix4Match = modelPatterns.some(p => {
          const normalizedPattern = p.toUpperCase().trim();
          return normalizedModel.substring(0, 4) === normalizedPattern.substring(0, 4);
        });
        
        // Coincidencia por primeros 3 caracteres (para casos como ZX200 vs ZX200-3)
        const prefix3Match = modelPatterns.some(p => {
          const normalizedPattern = p.toUpperCase().trim();
          return modelPrefix3 === normalizedPattern.substring(0, 3) && 
                 (normalizedModel.length >= 4 && normalizedPattern.length >= 4);
        });
        
        if (exactMatch) {
          matchScore = 3;
          console.log(`✅ EXACTO: Regla ${rule.id} (${rule.name || 'sin nombre'}) coincide exactamente con "${normalizedModel}"`);
        } else if (baseMatch) {
          matchScore = 2.5;
          console.log(`✅ BASE: Regla ${rule.id} (${rule.name || 'sin nombre'}) coincide por base "${modelBase}"`);
        } else if (prefixMatch) {
          matchScore = 2;
          console.log(`✅ PREFIJO: Regla ${rule.id} (${rule.name || 'sin nombre'}) coincide por prefijo`);
        } else if (prefix4Match) {
          matchScore = 1.5;
          console.log(`✅ PREF4: Regla ${rule.id} (${rule.name || 'sin nombre'}) coincide por 4 caracteres`);
        } else if (prefix3Match) {
          matchScore = 1;
          console.log(`⚠️ PREF3: Regla ${rule.id} (${rule.name || 'sin nombre'}) coincide por 3 caracteres (menos preciso)`);
        } else {
          // Log cuando no hay coincidencia
          console.log(`❌ Regla ${rule.id} (${rule.name || 'sin nombre'}) no coincide:`, {
            modelPatterns,
            normalizedModel,
            modelBase,
            ruleBrand: rule.brand,
            normalizedBrand
          });
          return null; // No coincide con ningún patrón
        }
      }
      
      return { ...rule, match_score: matchScore };
    })
    .filter(rule => rule !== null)
    .sort((a, b) => {
      // Ordenar por match_score descendente, luego por updated_at
      if (b.match_score !== a.match_score) {
        return b.match_score - a.match_score;
      }
      return new Date(b.updated_at) - new Date(a.updated_at);
    })
    .slice(0, 3);

  // Solo guardar en cache si hay reglas encontradas
  // Si no hay reglas, no cachear para permitir que se busque nuevamente si se agregan reglas
  if (matchingRules.length > 0) {
    cache.set(cacheKey, matchingRules, TTL.AUTO_COST_RULES);
  } else {
    // Cachear resultado vacío con TTL muy corto (30 segundos) para evitar búsquedas repetidas innecesarias
    // pero permitir que se actualice si se agregan reglas
    cache.set(cacheKey, [], 30); // 30 segundos en lugar de TTL.AUTO_COST_RULES
  }
  
  return matchingRules;
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
  // Extraer variables del request para usarlas en el catch
  let normalizedModel = '';
  let normalizedBrand = null;
  let normalizedShipment = null;
  let tonnageValue = null;

  // Usar cola para limitar concurrencia y evitar saturar conexiones
  try {
    const result = await autoCostsQueue.add(async () => {
      const hasTable = await ensureTableExists();
      if (!hasTable) {
        throw new Error('La tabla automatic_cost_rules no existe. Ejecuta la migración.');
      }

      const { purchase_id, model, brand = null, shipment = null, tonnage = null, force = false } = req.body;

      if (!purchase_id || !model) {
        throw new Error('purchase_id y model son requeridos');
      }

      // Asignar a variables del scope externo
      normalizedModel = (model || '').trim().toUpperCase();
      normalizedBrand = brand ? brand.trim().toUpperCase() : null;
      normalizedShipment = shipment ? shipment.trim().toUpperCase() : null;
      tonnageValue = tonnage;

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sessionId:'debug-session',
        runId:'run-apply',
        hypothesisId:'B1',
        location:'autoCosts.js:apply:start',
        message:'apply request',
        data:{purchase_id, normalizedModel, normalizedBrand, normalizedShipment, tonnage, force},
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion
    // #region agent log file
    if (DEBUG_LOG_PATH) {
      try {
        fs.appendFileSync(
          DEBUG_LOG_PATH,
          JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run-apply',
            hypothesisId: 'B-start-file',
            location: 'autoCosts.js:apply:start',
            message: 'apply request (file)',
            data: { purchase_id, normalizedModel, normalizedBrand, normalizedShipment, tonnage, force },
            timestamp: Date.now()
          }) + '\n'
        );
      } catch {}
    }
    // #endregion

    // Buscar primero en management_table (donde están las columnas inland, gastos_pto, flete)
    let managementRow = null;
    let currentCosts = null;
    let applyToPurchases = false;
    
    const mgmtResult = await queryWithRetry(
      'SELECT id, purchase_id, inland, gastos_pto, flete FROM management_table WHERE id = $1 OR purchase_id = $1',
      [purchase_id]
    );
    
    if (mgmtResult.rows.length > 0) {
      managementRow = mgmtResult.rows[0];
      currentCosts = managementRow;
      applyToPurchases = false;
    } else {
      // Si no está en management_table, verificar si existe en purchases
      const purchaseResult = await queryWithRetry(
        'SELECT id FROM purchases WHERE id = $1',
        [purchase_id]
      );
      
      if (purchaseResult.rows.length === 0) {
        throw new Error('Registro no encontrado en purchases o management_table');
      }
      
      // Si existe en purchases pero no en management_table, crear registro en management_table
      // Primero obtener datos básicos del purchase
      const purchaseData = await queryWithRetry(
        `SELECT p.id, p.machine_id, m.brand, m.model, m.serial, m.year, m.machine_type,
         p.supplier_name, p.shipment_type_v2 as shipment, p.incoterm, p.currency_type
         FROM purchases p
         LEFT JOIN machines m ON p.machine_id = m.id
         WHERE p.id = $1`,
        [purchase_id]
      );
      
      if (purchaseData.rows.length === 0) {
        throw new Error('No se pudieron obtener los datos del purchase');
      }
      
      const purchase = purchaseData.rows[0];
      
      // Crear registro en management_table si no existe
      // IMPORTANTE: management_table tiene UNIQUE(machine_id), no purchase_id
      // Por lo tanto, debemos incluir machine_id y usar ON CONFLICT (machine_id)
      if (!purchase.machine_id) {
        throw new Error('El purchase no tiene machine_id asociado');
      }
      
      const createMgmtResult = await queryWithRetry(
        `INSERT INTO management_table (
          machine_id, purchase_id, brand, model, serial, year, machine_type,
          supplier_name, shipment, incoterm, currency, inland, gastos_pto, flete
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 0, 0)
        ON CONFLICT (machine_id) DO UPDATE SET 
          purchase_id = COALESCE(EXCLUDED.purchase_id, management_table.purchase_id),
          updated_at = NOW()
        RETURNING id, machine_id, purchase_id, inland, gastos_pto, flete`,
        [
          purchase.machine_id,  // machine_id es requerido y es el constraint único
          purchase_id,
          purchase.brand,
          purchase.model,
          purchase.serial,
          purchase.year,
          purchase.machine_type,
          purchase.supplier_name,
          purchase.shipment,
          purchase.incoterm,
          purchase.currency_type
        ]
      );
      
      managementRow = createMgmtResult.rows[0];
      currentCosts = managementRow;
      applyToPurchases = false;
    }

      if (!force && currentCosts && (parseNumber(currentCosts.inland) > 0 || parseNumber(currentCosts.gastos_pto) > 0 || parseNumber(currentCosts.flete) > 0)) {
        throw new Error('El registro ya tiene valores. Usa force=true para sobrescribir.');
      }

    // Log de los parámetros que se están usando para buscar la regla
    console.log('🔍 Buscando regla automática con parámetros:', {
      purchase_id,
      normalizedModel,
      normalizedBrand,
      normalizedShipment,
      tonnage,
      force
    });

    const rules = await findBestRule({
      model: normalizedModel,
      brand: normalizedBrand,
      shipment_method: normalizedShipment,
      tonnage,
    });

    console.log('📋 Resultado de búsqueda de regla:', {
      purchase_id,
      rulesFound: rules?.length || 0,
      rules: rules?.map(r => ({ id: r.id, name: r.name, match_score: r.match_score })) || []
    });

    if (!rules || rules.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sessionId:'debug-session',
          runId:'run-apply',
          hypothesisId:'B2',
          location:'autoCosts.js:apply:noRule',
          message:'No rule found',
          data:{normalizedModel, normalizedBrand, normalizedShipment, tonnage},
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion
      // #region agent log file
      if (DEBUG_LOG_PATH) {
        try {
          fs.appendFileSync(
            DEBUG_LOG_PATH,
            JSON.stringify({
              sessionId: 'debug-session',
              runId: 'run-apply',
              hypothesisId: 'B-noRule-file',
              location: 'autoCosts.js:apply:noRule',
              message: 'No rule found (file)',
              data: { normalizedModel, normalizedBrand, normalizedShipment, tonnage },
              timestamp: Date.now()
            }) + '\n'
          );
        } catch {}
      }
      // #endregion
      
      // Construir mensaje informativo con los parámetros usados en la búsqueda
      const searchParams = [];
      if (normalizedModel) searchParams.push(`Modelo: ${normalizedModel}`);
      if (normalizedBrand) searchParams.push(`Marca: ${normalizedBrand}`);
      if (normalizedShipment) searchParams.push(`Método de embarque: ${normalizedShipment}`);
      if (tonnage !== null && tonnage !== undefined) searchParams.push(`Tonelaje: ${tonnage}`);
      
      const errorMessage = `No se encontró una regla automática configurada para ${searchParams.join(', ')}. Por favor, verifica que exista una regla configurada en el módulo de Gestión de Reglas Automáticas o contacta al administrador para crear una regla para este modelo.`;
      
      // Lanzar error con información útil para el usuario
      const notFoundError = new Error(errorMessage);
      notFoundError.name = 'RuleNotFoundError';
      throw notFoundError;
    }

    const rule = rules[0];

    const valuesToSet = {
      inland: parseNumber(rule.ocean_usd),
      gastos_pto: parseNumber(rule.gastos_pto_cop),
      flete: parseNumber(rule.flete_cop),
    };

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      sessionId:'debug-session',
      runId:'run-apply',
      hypothesisId:'H3',
      location:'autoCosts.js:apply:selectedRule',
      message:'Regla seleccionada',
      data:{purchase_id, normalizedModel, normalizedBrand, normalizedShipment, valuesToSet, rule},
      timestamp:Date.now()
    })
  }).catch(()=>{});
  // #endregion

    // Siempre actualizar management_table (donde están las columnas inland, gastos_pto, flete)
    // Los registros de purchases se sincronizan automáticamente a management_table
    // Nota: management_table NO tiene columnas *_verified, solo purchases las tiene
    const updateResult = await queryWithRetry(
      `UPDATE management_table SET 
        inland = $1,
        gastos_pto = $2,
        flete = $3,
        updated_at = NOW()
      WHERE id = $4 OR purchase_id = $4
      RETURNING id, purchase_id, inland, gastos_pto, flete`,
      [
        valuesToSet.inland,
        valuesToSet.gastos_pto,
        valuesToSet.flete,
        managementRow ? managementRow.id : purchase_id,
      ]
    );
    
      if (updateResult.rows.length === 0) {
        throw new Error('No se pudo actualizar el registro en management_table');
      }
      
      const updatedRow = updateResult.rows[0];

      return {
        rule,
        updates: updatedRow,
        candidates: rules
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error aplicando regla automática:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code
    });
    // #region agent log file
    if (DEBUG_LOG_PATH) {
      try {
        fs.appendFileSync(
          DEBUG_LOG_PATH,
          JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run-apply',
            hypothesisId: 'B-error-file',
            location: 'autoCosts.js:apply:catch',
            message: 'Error aplicando regla (file)',
            data: { error: error?.message || String(error), code: error?.code },
            timestamp: Date.now()
          }) + '\n'
        );
      } catch {}
    }
    // #endregion
    
    // Manejar errores específicos
    if (error.name === 'RuleNotFoundError' || error.message.includes('No se encontró una regla')) {
      return res.status(404).json({ 
        error: error.message,
        code: 'RULE_NOT_FOUND',
        searchParams: {
          model: normalizedModel || req.body?.model || null,
          brand: normalizedBrand || (req.body?.brand ? req.body.brand.trim().toUpperCase() : null),
          shipment: normalizedShipment || (req.body?.shipment ? req.body.shipment.trim().toUpperCase() : null),
          tonnage: tonnageValue !== null && tonnageValue !== undefined ? tonnageValue : req.body?.tonnage || null
        }
      });
    }
    if (error.message.includes('no existe')) {
      return res.status(503).json({ error: error.message });
    }
    if (error.message.includes('requeridos') || error.message.includes('no tiene')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('ya tiene valores')) {
      return res.status(409).json({ error: error.message });
    }
    
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

    const result = await queryWithRetry(
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

    const result = await queryWithRetry(
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

    // Invalidar cache de reglas
    invalidateRulesCache();

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

    const result = await queryWithRetry(
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

    // Invalidar cache de reglas
    invalidateRulesCache();

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
    const result = await queryWithRetry(`DELETE FROM ${TABLE_NAME} WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    // Invalidar cache de reglas
    invalidateRulesCache();

    res.json({ message: 'Regla eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar regla automática:', error);
    res.status(500).json({ error: 'Error al eliminar regla automática' });
  }
});

export default router;

