import express from 'express';
import { queryWithRetry } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/price-suggestions/auction
 * Sugerir precio máximo para subasta
 */
router.post('/auction', authenticateToken, async (req, res) => {
  try {
    const { model, year, hours, hours_range = 1000, years_range = 1 } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Modelo es requerido' });
    }

    // PASO 1: Buscar en históricos de Excel
    const historicalQuery = await queryWithRetry(`
      SELECT 
        precio_comprado,
        year,
        hours,
        fecha_subasta,
        model,
        brand,
        CASE 
          WHEN model = $1 THEN 100
          WHEN model LIKE $1 || '%' OR $1 LIKE model || '%' THEN 90
          WHEN SPLIT_PART($1, '-', 1) = SPLIT_PART(model, '-', 1) THEN 85
          WHEN POSITION(SPLIT_PART($1, '-', 1) IN model) > 0 OR POSITION(SPLIT_PART(model, '-', 1) IN $1) > 0 THEN 80
          ELSE 70
        END as relevance_score,
        ABS(year - COALESCE($2, year)) as year_diff,
        ABS(hours - COALESCE($3, hours)) as hours_diff,
        CASE 
          WHEN fecha_subasta IS NOT NULL THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, fecha_subasta))
          WHEN year IS NOT NULL THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, MAKE_DATE(year, 1, 1)))
          ELSE NULL
        END as years_ago
      FROM auction_price_history
      WHERE 
        precio_comprado IS NOT NULL
        AND (
          model = $1 
          OR model LIKE $1 || '%'
          OR $1 LIKE model || '%'
          OR POSITION(SPLIT_PART($1, '-', 1) IN model) > 0
          OR POSITION(SPLIT_PART(model, '-', 1) IN $1) > 0
          OR SPLIT_PART($1, '-', 1) = SPLIT_PART(model, '-', 1)
        )
        AND ($2 IS NULL OR year BETWEEN $2 - $4 AND $2 + $4)
        AND ($3 IS NULL OR hours BETWEEN $3 - $5 AND $3 + $5)
      ORDER BY 
        relevance_score DESC,
        years_ago ASC,
        year_diff ASC,
        hours_diff ASC
      LIMIT 20
    `, [model, year || null, hours || null, years_range, hours_range]);

    // PASO 2: Buscar en BD actual (subastas ganadas en la app)
    const currentQuery = await queryWithRetry(`
      SELECT 
        a.price_max,
        m.year,
        m.hours,
        a.created_at,
        m.model,
        100 as relevance_score,
        ABS(m.year - COALESCE($2, m.year)) as year_diff,
        ABS(m.hours - COALESCE($3, m.hours)) as hours_diff
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      WHERE 
        a.status = 'GANADA'
        AND a.price_max IS NOT NULL
        AND m.model IS NOT NULL
        AND (
          m.model = $1
          OR m.model LIKE $1 || '%'
          OR $1 LIKE m.model || '%'
          OR POSITION(SPLIT_PART($1, '-', 1) IN m.model) > 0
          OR POSITION(SPLIT_PART(m.model, '-', 1) IN $1) > 0
          OR SPLIT_PART($1, '-', 1) = SPLIT_PART(m.model, '-', 1)
        )
        AND ($2 IS NULL OR m.year BETWEEN $2 - $4 AND $2 + $4)
        AND ($3 IS NULL OR m.hours BETWEEN $3 - $5 AND $3 + $5)
      ORDER BY 
        a.created_at DESC,
        year_diff ASC,
        hours_diff ASC
      LIMIT 10
    `, [model, year || null, hours || null, years_range, hours_range]);

    const historicalRecords = historicalQuery.rows;
    const currentRecords = currentQuery.rows;

    if (historicalRecords.length === 0 && currentRecords.length === 0) {
      return res.json({
        suggested_price: null,
        confidence: 'SIN_DATOS',
        message: 'No hay datos históricos suficientes para sugerir precio',
        sources: {
          historical: 0,
          current: 0
        }
      });
    }

    // CÁLCULO DE PRECIO SUGERIDO
    let suggestedPrice = null;
    let confidence = 'BAJA';
    let priceRange = { min: null, max: null };

    // Calcular precio de históricos con ponderación por relevancia y antigüedad
    let historicalPrice = null;
    if (historicalRecords.length > 0) {
      let sumaPonderada = 0;
      let sumaPesos = 0;

      historicalRecords.forEach(record => {
        const peso = (record.relevance_score / 100) * (1 / (record.years_ago + 1));
        sumaPonderada += record.precio_comprado * peso;
        sumaPesos += peso;
      });

      historicalPrice = sumaPonderada / sumaPesos;
    }

    // Calcular precio de registros actuales
    let currentPrice = null;
    if (currentRecords.length > 0) {
      const sum = currentRecords.reduce((acc, r) => acc + parseFloat(r.price_max), 0);
      currentPrice = sum / currentRecords.length;
    }

    // Combinar precios según disponibilidad
    if (historicalPrice && currentPrice) {
      suggestedPrice = (historicalPrice * 0.7) + (currentPrice * 0.3);
      confidence = (historicalRecords.length + currentRecords.length) >= 5 ? 'ALTA' : 'MEDIA';
    } else if (historicalPrice) {
      suggestedPrice = historicalPrice;
      confidence = historicalRecords.length >= 5 ? 'ALTA' : 'MEDIA';
    } else if (currentPrice) {
      suggestedPrice = currentPrice;
      confidence = currentRecords.length >= 3 ? 'MEDIA' : 'BAJA';
    }

    // Calcular rango
    const allPrices = [
      ...historicalRecords.map(r => r.precio_comprado),
      ...currentRecords.map(r => parseFloat(r.price_max))
    ];
    
    if (allPrices.length > 0) {
      priceRange.min = Math.min(...allPrices);
      priceRange.max = Math.max(...allPrices);
    }

    res.json({
      suggested_price: suggestedPrice ? Math.round(suggestedPrice) : null,
      confidence,
      confidence_score: (historicalRecords.length + currentRecords.length),
      price_range: priceRange,
      sources: {
        historical: historicalRecords.length,
        current: currentRecords.length,
        total: historicalRecords.length + currentRecords.length
      },
      sample_records: {
        historical: historicalRecords.slice(0, 5).map(r => ({
          model: r.model,
          year: r.year,
          hours: r.hours,
          price: r.precio_comprado,
          date: r.fecha_subasta,
          relevance: r.relevance_score
        })),
        current: currentRecords.slice(0, 3).map(r => ({
          model: r.model,
          year: r.year,
          hours: r.hours,
          price: r.price_max,
          date: r.created_at
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error calculando sugerencia de subasta:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({ 
      error: 'Error al calcular sugerencia', 
      details: error.message
    });
  }
});

/**
 * POST /api/price-suggestions/pvp
 * Sugerir PVP estimado para consolidado
 */
router.post('/pvp', authenticateToken, async (req, res) => {
  try {
    const { model, year, hours, costo_arancel, hours_range = 2000, years_range = 3 } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Modelo es requerido' });
    }

    // PASO 1: Buscar en históricos de Excel
    const historicalQuery = await queryWithRetry(`
      SELECT 
        pvp_est,
        proyectado,
        anio as year,
        hour as hours,
        modelo as model,
        anio as fecha,
        CASE 
          WHEN modelo = $1 THEN 100
          WHEN modelo LIKE $1 || '%' THEN 90
          WHEN POSITION(SPLIT_PART($1, '-', 1) IN modelo) > 0 THEN 80
        END as relevance_score,
        ABS(anio - COALESCE($2, anio)) as year_diff,
        ABS(hour - COALESCE($3, hour)) as hours_diff,
        CASE 
          WHEN anio IS NOT NULL AND anio >= 1980 AND anio <= 2030 THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, MAKE_DATE(anio, 1, 1)))
          ELSE NULL
        END as years_ago
      FROM pvp_history
      WHERE 
        pvp_est IS NOT NULL
        AND pvp_est > 0
        AND (
          modelo = $1 
          OR modelo LIKE $1 || '%'
          OR POSITION(SPLIT_PART($1, '-', 1) IN modelo) > 0
        )
        AND ($2 IS NULL OR anio BETWEEN $2 - $4 AND $2 + $4)
        AND ($3 IS NULL OR hour BETWEEN $3 - $5 AND $3 + $5)
      ORDER BY 
        relevance_score DESC,
        years_ago ASC NULLS LAST,
        year_diff ASC,
        hours_diff ASC
      LIMIT 20
    `, [model, year || null, hours || null, years_range, hours_range]);

    // PASO 2: Buscar en BD actual (purchases con pvp_est ingresado manualmente)
    const currentQuery = await queryWithRetry(`
      SELECT 
        p.pvp_est,
        -- Calcular cost_arancel igual que en consolidado
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
        ) as costo_arancel,
        m.year,
        m.hours,
        m.model,
        100 as relevance_score,
        ABS(m.year - COALESCE($2, m.year)) as year_diff,
        ABS(m.hours - COALESCE($3, m.hours)) as hours_diff,
        p.created_at
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE 
        p.pvp_est IS NOT NULL
        AND p.pvp_est > 0
        AND m.model IS NOT NULL
        AND m.year IS NOT NULL
        AND m.year > 0
        AND m.hours IS NOT NULL
        AND (
          m.model = $1
          OR m.model LIKE $1 || '%'
        )
        AND ($2 IS NULL OR m.year BETWEEN $2 - $4 AND $2 + $4)
        AND ($3 IS NULL OR m.hours BETWEEN $3 - $5 AND $3 + $5)
      ORDER BY 
        p.created_at DESC,
        year_diff ASC,
        hours_diff ASC
      LIMIT 10
    `, [model, year || null, hours || null, years_range, hours_range]);

    const historicalRecords = historicalQuery.rows;
    const currentRecords = currentQuery.rows;

    if (historicalRecords.length === 0 && currentRecords.length === 0) {
      return res.json({
        suggested_pvp: null,
        confidence: 'SIN_DATOS',
        message: 'No hay datos históricos suficientes para sugerir PVP',
        sources: {
          historical: 0,
          current: 0
        }
      });
    }

    // CÁLCULO DE PVP SUGERIDO
    let suggestedPvp = null;
    let confidence = 'BAJA';
    let priceRange = { min: null, max: null };
    let suggestedMargin = null;

    // Calcular PVP de históricos con ponderación por relevancia y antigüedad
    let historicalPvp = null;
    if (historicalRecords.length > 0) {
      let sumaPonderada = 0;
      let sumaPesos = 0;

      historicalRecords.forEach(record => {
        // Peso base por relevancia del modelo
        let peso = record.relevance_score / 100;
        
        // Si tiene fecha, ajustar peso por antigüedad (más reciente = más peso)
        if (record.years_ago !== null && record.years_ago !== undefined) {
          peso *= (1 / (record.years_ago + 1));
        }
        
        sumaPonderada += record.pvp_est * peso;
        sumaPesos += peso;
      });

      historicalPvp = sumaPonderada / sumaPesos;
    }

    // Calcular PVP de registros actuales
    let currentPvp = null;
    if (currentRecords.length > 0) {
      const sum = currentRecords.reduce((acc, r) => acc + parseFloat(r.pvp_est), 0);
      currentPvp = sum / currentRecords.length;
    }

    // Combinar PVPs
    if (historicalPvp && currentPvp) {
      suggestedPvp = (historicalPvp * 0.6) + (currentPvp * 0.4);
      confidence = (historicalRecords.length + currentRecords.length) >= 5 ? 'ALTA' : 'MEDIA';
    } else if (historicalPvp) {
      suggestedPvp = historicalPvp;
      confidence = historicalRecords.length >= 5 ? 'ALTA' : 'MEDIA';
    } else if (currentPvp) {
      suggestedPvp = currentPvp;
      confidence = currentRecords.length >= 3 ? 'MEDIA' : 'BAJA';
    }

    // Calcular margen si se proporciona costo_arancel
    if (suggestedPvp && costo_arancel && costo_arancel > 0) {
      suggestedMargin = ((suggestedPvp / costo_arancel) - 1) * 100;
    }

    // Calcular rango
    const allPvps = [
      ...historicalRecords.map(r => r.pvp_est),
      ...currentRecords.map(r => parseFloat(r.pvp_est))
    ];
    
    if (allPvps.length > 0) {
      priceRange.min = Math.min(...allPvps);
      priceRange.max = Math.max(...allPvps);
    }

    res.json({
      suggested_pvp: suggestedPvp ? Math.round(suggestedPvp) : null,
      suggested_margin: suggestedMargin ? parseFloat(suggestedMargin.toFixed(2)) : null,
      confidence,
      confidence_score: (historicalRecords.length + currentRecords.length),
      price_range: priceRange,
      sources: {
        historical: historicalRecords.length,
        current: currentRecords.length,
        total: historicalRecords.length + currentRecords.length
      },
      sample_records: {
        historical: historicalRecords.slice(0, 5).map(r => ({
          model: r.model,
          year: r.year,
          hours: r.hours,
          pvp: r.pvp_est,
          relevance: r.relevance_score
        })),
        current: currentRecords.slice(0, 3).map(r => ({
          model: r.model,
          year: r.year,
          hours: r.hours,
          pvp: r.pvp_est,
          date: r.created_at
        }))
      }
    });

  } catch (error) {
    console.error('Error calculando sugerencia de PVP:', error);
    res.status(500).json({ error: 'Error al calcular sugerencia', details: error.message });
  }
});

/**
 * POST /api/price-suggestions/repuestos
 * Sugerir valor de repuestos para consolidado
 */
router.post('/repuestos', authenticateToken, async (req, res) => {
  try {
    const { model, year, hours, hours_range = 2000, years_range = 3 } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Modelo es requerido' });
    }

    // PASO 1: Buscar en históricos de Excel
    const historicalQuery = await queryWithRetry(`
      SELECT 
        rptos,
        anio as year,
        hour as hours,
        modelo as model,
        anio as fecha,
        CASE 
          WHEN modelo = $1 THEN 100
          WHEN modelo LIKE $1 || '%' THEN 90
          WHEN POSITION(SPLIT_PART($1, '-', 1) IN modelo) > 0 THEN 80
        END as relevance_score,
        ABS(anio - COALESCE($2, anio)) as year_diff,
        ABS(hour - COALESCE($3, hour)) as hours_diff,
        CASE 
          WHEN anio IS NOT NULL AND anio >= 1980 AND anio <= 2030 THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, MAKE_DATE(anio, 1, 1)))
          ELSE NULL
        END as years_ago
      FROM pvp_history
      WHERE 
        rptos IS NOT NULL
        AND rptos > 0
        AND (
          modelo = $1 
          OR modelo LIKE $1 || '%'
          OR POSITION(SPLIT_PART($1, '-', 1) IN modelo) > 0
        )
        AND ($2 IS NULL OR anio BETWEEN $2 - $4 AND $2 + $4)
        AND ($3 IS NULL OR hour BETWEEN $3 - $5 AND $3 + $5)
      ORDER BY 
        relevance_score DESC,
        years_ago ASC NULLS LAST,
        year_diff ASC,
        hours_diff ASC
      LIMIT 20
    `, [model, year || null, hours || null, years_range, hours_range]);

    // PASO 2: Buscar en BD actual (purchases tiene repuestos)
    const currentQuery = await queryWithRetry(`
      SELECT 
        p.repuestos as rptos,
        m.year,
        m.hours,
        m.model,
        100 as relevance_score,
        ABS(m.year - COALESCE($2, m.year)) as year_diff,
        ABS(m.hours - COALESCE($3, m.hours)) as hours_diff,
        p.created_at
      FROM purchases p
      LEFT JOIN machines m ON p.machine_id = m.id
      WHERE 
        p.repuestos IS NOT NULL
        AND p.repuestos > 0
        AND m.model IS NOT NULL
        AND m.year IS NOT NULL
        AND m.year > 0
        AND m.hours IS NOT NULL
        AND (
          m.model = $1
          OR m.model LIKE $1 || '%'
        )
        AND ($2 IS NULL OR m.year BETWEEN $2 - $4 AND $2 + $4)
        AND ($3 IS NULL OR m.hours BETWEEN $3 - $5 AND $3 + $5)
      ORDER BY 
        p.created_at DESC,
        year_diff ASC,
        hours_diff ASC
      LIMIT 10
    `, [model, year || null, hours || null, years_range, hours_range]);

    const historicalRecords = historicalQuery.rows;
    const currentRecords = currentQuery.rows;

    if (historicalRecords.length === 0 && currentRecords.length === 0) {
      return res.json({
        suggested_rptos: null,
        confidence: 'SIN_DATOS',
        message: 'No hay datos históricos suficientes para sugerir repuestos',
        sources: {
          historical: 0,
          current: 0
        }
      });
    }

    // CÁLCULO DE REPUESTOS SUGERIDOS
    let suggestedRptos = null;
    let confidence = 'BAJA';
    let priceRange = { min: null, max: null };

    // Calcular repuestos de históricos con ponderación por relevancia y antigüedad
    let historicalRptos = null;
    if (historicalRecords.length > 0) {
      let sumaPonderada = 0;
      let sumaPesos = 0;

      historicalRecords.forEach(record => {
        // Peso base por relevancia del modelo
        let peso = record.relevance_score / 100;
        
        // Si tiene fecha, ajustar peso por antigüedad (más reciente = más peso)
        if (record.years_ago !== null && record.years_ago !== undefined) {
          peso *= (1 / (record.years_ago + 1));
        }
        
        sumaPonderada += record.rptos * peso;
        sumaPesos += peso;
      });

      historicalRptos = sumaPonderada / sumaPesos;
    }

    // Calcular repuestos de registros actuales
    let currentRptos = null;
    if (currentRecords.length > 0) {
      const sum = currentRecords.reduce((acc, r) => acc + parseFloat(r.rptos), 0);
      currentRptos = sum / currentRecords.length;
    }

    // Combinar valores
    if (historicalRptos && currentRptos) {
      suggestedRptos = (historicalRptos * 0.6) + (currentRptos * 0.4);
      confidence = (historicalRecords.length + currentRecords.length) >= 5 ? 'ALTA' : 'MEDIA';
    } else if (historicalRptos) {
      suggestedRptos = historicalRptos;
      confidence = historicalRecords.length >= 5 ? 'ALTA' : 'MEDIA';
    } else if (currentRptos) {
      suggestedRptos = currentRptos;
      confidence = currentRecords.length >= 3 ? 'MEDIA' : 'BAJA';
    }

    // Calcular rango
    const allRptos = [
      ...historicalRecords.map(r => r.rptos),
      ...currentRecords.map(r => parseFloat(r.rptos))
    ];
    
    if (allRptos.length > 0) {
      priceRange.min = Math.min(...allRptos);
      priceRange.max = Math.max(...allRptos);
    }

    res.json({
      suggested_rptos: suggestedRptos ? Math.round(suggestedRptos) : null,
      confidence,
      confidence_score: (historicalRecords.length + currentRecords.length),
      price_range: priceRange,
      sources: {
        historical: historicalRecords.length,
        current: currentRecords.length,
        total: historicalRecords.length + currentRecords.length
      },
      sample_records: {
        historical: historicalRecords.slice(0, 5).map(r => ({
          model: r.model,
          year: r.year,
          hours: r.hours,
          rptos: r.rptos,
          relevance: r.relevance_score
        })),
        current: currentRecords.slice(0, 3).map(r => ({
          model: r.model,
          year: r.year,
          hours: r.hours,
          rptos: r.rptos,
          date: r.created_at
        }))
      }
    });

  } catch (error) {
    console.error('Error calculando sugerencia de repuestos:', error);
    res.status(500).json({ error: 'Error al calcular sugerencia', details: error.message });
  }
});

export default router;

