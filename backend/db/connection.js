/**
 * Conexión a PostgreSQL / Supabase
 * En producción usa Supabase (connection string con pooling)
 * En desarrollo usa PostgreSQL local
 * 
 * Optimizado para soportar 15 usuarios simultáneos en Vercel Serverless
 * - Transaction Pooler de Supabase: hasta 200 conexiones simultáneas
 * - Pool por instancia serverless: 3 conexiones máx (optimizado para serverless)
 * - Timeouts ajustados para serverless (instancias efímeras)
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Determinar si estamos en producción (Vercel) o desarrollo
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const isServerless = process.env.VERCEL === '1';

// Priorizar DATABASE_URL (Vercel/Supabase) sobre configuración individual
const useConnectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

let poolConfig;

if (useConnectionString) {
  // Usar Supabase con Transaction pooler (puerto 6543) en lugar de Session pooler (puerto 5432)
  // Transaction pooler permite hasta 200 conexiones simultáneas vs 5 del Session pooler
  // Ideal para Vercel serverless donde cada función puede tener su propia conexión
  // NOTA: Transaction pooler no soporta transacciones, pero la mayoría de queries no las necesitan
  
  // Convertir connection string de Session pooler (5432) a Transaction pooler (6543)
  let transactionPoolerUrl = useConnectionString;
  if (transactionPoolerUrl.includes(':5432/')) {
    transactionPoolerUrl = transactionPoolerUrl.replace(':5432/', ':6543/');
  } else if (transactionPoolerUrl.includes(':5432')) {
    transactionPoolerUrl = transactionPoolerUrl.replace(':5432', ':6543');
  }
  
  // Para serverless (Vercel), usar SOLO 1 conexión por instancia para maximizar capacidad
  // El Transaction Pooler de Supabase tiene un límite de 200 conexiones totales
  // Con 1 conexión por instancia: máximo 200 instancias simultáneas (límite del pool)
  // Esto es crítico para evitar "Max client connections reached"
  // CRÍTICO: Reducir a 1 conexión por instancia serverless para permitir más instancias simultáneas
  const maxConnections = isServerless ? 1 : 10;
  
  poolConfig = {
    connectionString: transactionPoolerUrl,
    ssl: {
      rejectUnauthorized: false // Supabase requiere SSL
    },
    max: maxConnections, // CRÍTICO: 1 conexión por instancia serverless para maximizar capacidad
    min: 0, // No mantener conexiones mínimas (serverless es efímero)
    idleTimeoutMillis: isServerless ? 1000 : 10000, // 1s para serverless (liberar muy rápido), 10s para producción tradicional
    connectionTimeoutMillis: 1500, // 1.5 segundos timeout (más agresivo para evitar esperas)
    allowExitOnIdle: true, // Permitir que el proceso termine cuando no hay conexiones (importante en serverless)
    statement_timeout: 25000, // 25 segundos timeout para queries individuales (reducido)
    query_timeout: 25000, // 25 segundos timeout para queries (reducido)
    // Configuración adicional para gestionar mejor las conexiones
    maxUses: isServerless ? 7500 : undefined, // Rotar conexiones después de 7500 usos en serverless (evitar conexiones stale)
  };
  
  const poolType = isServerless ? `Serverless (${maxConnections} conexiones máx)` : `Producción (${maxConnections} conexiones máx)`;
  console.log(`✓ Usando Supabase Database (Producción) - Transaction Pooler (puerto 6543) - Pool: ${poolType}`);
} else {
  // Usar PostgreSQL local (desarrollo)
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'maquinaria_usada',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 10, // Mantener más alto para desarrollo local
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
  
  console.log('✓ Usando PostgreSQL Local (Desarrollo)');
}

export const pool = new Pool(poolConfig);

// Estadísticas del pool (solo en desarrollo para debugging)
let poolStats = {
  totalQueries: 0,
  totalErrors: 0,
  totalRetries: 0,
};

pool.on('connect', () => {
  if (!isProduction) {
    console.log('✓ Conectado a PostgreSQL');
  }
});

pool.on('error', (err) => {
  poolStats.totalErrors++;
  console.error('❌ Error en conexión PostgreSQL:', err.message);
  // En caso de error "Max client connections", intentar liberar conexiones idle
  if (err.message?.includes('Max client connections') || err.message?.includes('too many clients')) {
    // El pool debería manejar esto automáticamente con idleTimeoutMillis
    // Pero logueamos para monitoreo
    if (isServerless && !isProduction) {
      console.warn(`⚠️ Max client connections alcanzado. Pool stats: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}`);
    }
  }
  // No lanzar error para evitar que el proceso termine
});

pool.on('acquire', (client) => {
  poolStats.totalQueries++;
  // Log solo en desarrollo para debugging
  if (!isProduction) {
    if (isServerless) {
      console.log(`🔌 Conexión adquirida. Pool: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}`);
    } else {
      console.log('🔌 Conexión adquirida del pool');
    }
  }
});

pool.on('remove', (client) => {
  // Log solo en desarrollo para debugging
  if (!isProduction) {
    console.log('🔌 Conexión removida del pool');
  }
});

// Evento cuando se libera una conexión (útil para monitoreo)
pool.on('release', (client, err) => {
  if (err && !isProduction) {
    console.warn(`⚠️ Error al liberar conexión: ${err.message}`);
  }
});

// Helper para ejecutar queries con retry automático mejorado
// Con Transaction pooler, los errores de MaxClients deberían ser raros, pero mantenemos retry por seguridad
export async function queryWithRetry(text, params, retries = 5) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      const startTime = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - startTime;
      
      // Log queries lentas en desarrollo (más de 1 segundo)
      if (!isProduction && duration > 1000) {
        console.warn(`⚠️ Query lenta: ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      poolStats.totalRetries++;
      
      // Errores recuperables: MaxClients, Max client connections, connection timeout, connection error
      const isRecoverableError = 
        error.message?.includes('MaxClients') ||
        error.message?.includes('Max client connections') ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout') ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'XX000'; // Error code de PostgreSQL para "Max client connections reached"
      
      // Si es error recuperable y no es el último intento, reintentar
      if (isRecoverableError && i < retries - 1) {
        // Backoff exponencial con jitter: 200ms, 400ms, 800ms, 1600ms, 3200ms
        const baseDelay = Math.pow(2, i) * 200;
        const jitter = Math.random() * 200; // 0-200ms de jitter
        const delay = baseDelay + jitter;
        
        if (!isProduction) {
          console.warn(`⚠️ Error de conexión, reintentando en ${Math.round(delay)}ms (intento ${i + 1}/${retries}): ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Si no es recuperable o es el último intento, lanzar error
      throw error;
    }
  }
  
  // Si llegamos aquí, todos los reintentos fallaron
  throw lastError;
}

// Función helper para obtener el rol del usuario
export async function getUserRole(userId) {
  const result = await queryWithRetry(
    'SELECT role FROM users_profile WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.role || null;
}

// Función para obtener estadísticas del pool (útil para monitoreo)
export function getPoolStats() {
  return {
    ...poolStats,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

export default pool;

