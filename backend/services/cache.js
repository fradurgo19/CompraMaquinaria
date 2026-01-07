/**
 * Sistema de cache en memoria para optimizar consultas a la base de datos
 * Reduce significativamente el consumo de recursos en Supabase y Vercel
 */

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Obtener valor del cache
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Verificar si expiró
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Guardar valor en cache con TTL opcional
   * @param {string} key - Clave única
   * @param {*} value - Valor a cachear
   * @param {number} ttlMs - Tiempo de vida en milisegundos (opcional)
   */
  set(key, value, ttlMs = null) {
    const item = {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
      createdAt: Date.now()
    };
    
    this.cache.set(key, item);
    
    // Si tiene TTL, programar limpieza automática
    if (ttlMs) {
      // Limpiar timer anterior si existe
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }
      
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttlMs);
      
      this.timers.set(key, timer);
    }
    
    return value;
  }

  /**
   * Eliminar del cache
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * Limpiar todo el cache
   */
  clear() {
    // Limpiar todos los timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Invalidar cache por patrón (útil para invalidar múltiples claves relacionadas)
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
    return keysToDelete.length;
  }
}

// Instancia global del cache
const cache = new MemoryCache();

// TTLs predefinidos (en milisegundos)
const TTL = {
  PRICE_SUGGESTION: 5 * 60 * 1000,      // 5 minutos - sugerencias de precio
  AUTO_COST_RULES: 30 * 60 * 1000,     // 30 minutos - reglas automáticas
  TABLE_CHECK: 60 * 60 * 1000,         // 1 hora - verificaciones de tablas
  HISTORICAL_DATA: 15 * 60 * 1000,     // 15 minutos - datos históricos
};

/**
 * Generar clave de cache para sugerencia de precio
 */
function getPriceSuggestionKey(type, model, year, hours, extra = {}) {
  const extraStr = Object.keys(extra)
    .sort()
    .map(k => `${k}:${extra[k]}`)
    .join('|');
  return `price_suggestion:${type}:${model}:${year || 'null'}:${hours || 'null'}:${extraStr}`;
}

/**
 * Generar clave de cache para reglas automáticas
 */
function getAutoCostRuleKey(model, brand, shipment, tonnage) {
  return `auto_cost_rule:${model}:${brand || 'null'}:${shipment || 'null'}:${tonnage || 'null'}`;
}

/**
 * Generar clave de cache para verificación de tabla
 */
function getTableCheckKey(tableName) {
  return `table_check:${tableName}`;
}

export {
  cache,
  TTL,
  getPriceSuggestionKey,
  getAutoCostRuleKey,
  getTableCheckKey
};
