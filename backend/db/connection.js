/**
 * Conexión a PostgreSQL / Supabase - Optimización Profesional
 * En producción usa Supabase (connection string con pooling)
 * En desarrollo usa PostgreSQL local
 * 
 * OPTIMIZACIÓN PARA MÚLTIPLES USUARIOS SIMULTÁNEOS (10+):
 * - Transaction Pooler de Supabase: hasta 200 conexiones simultáneas
 * - Pool por instancia serverless: 1 conexión (máxima capacidad)
 * - Sistema de semáforo para limitar conexiones concurrentes por instancia
 * - Timeouts ultra-agresivos para liberar conexiones rápidamente
 * - Retry automático con backoff exponencial para manejar MaxClients
 * - Gestión explícita de conexiones con pool.connect() + release garantizado
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

// Constantes de timeout accesibles globalmente
// Serverless: 8s para dar tiempo a cold start + TLS + red hasta Supabase (evitar "timeout exceeded when trying to connect")
const CONNECTION_TIMEOUT_MILLIS = isServerless ? 8000 : 2000; // 8 segundos para serverless, 2 segundos para desarrollo
const IDLE_TIMEOUT_MILLIS = isServerless ? 500 : (useConnectionString ? 10000 : 30000);

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
    idleTimeoutMillis: IDLE_TIMEOUT_MILLIS, // 500ms para serverless (liberar ultra-rápido), 10s para producción tradicional
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MILLIS, // 1 segundo para serverless, 2 segundos para desarrollo (ultra-agresivo para evitar esperas)
    allowExitOnIdle: true, // Permitir que el proceso termine cuando no hay conexiones (importante en serverless)
    statement_timeout: 20000, // 20 segundos timeout para queries individuales (reducido para liberar más rápido)
    query_timeout: 20000, // 20 segundos timeout para queries (reducido para liberar más rápido)
    // Configuración adicional para gestionar mejor las conexiones
    maxUses: isServerless ? 5000 : undefined, // Rotar conexiones después de 5000 usos en serverless (evitar conexiones stale, más agresivo)
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
    idleTimeoutMillis: IDLE_TIMEOUT_MILLIS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MILLIS,
  };
  
  console.log('✓ Usando PostgreSQL Local (Desarrollo)');
}

export const pool = new Pool(poolConfig);

// SEMÁFORO: Limitar conexiones simultáneas por instancia serverless
// Esto previene que múltiples requests en la misma instancia agoten el pool
const MAX_CONCURRENT_CONNECTIONS = isServerless ? 1 : 10;
let activeConnections = 0;
const connectionQueue = [];
const connectionWaitTimeout = isServerless ? 2000 : 5000; // Timeout para esperar conexión

// Función helper para esperar disponibilidad de conexión (semáforo)
async function waitForConnection() {
  return new Promise((resolve, reject) => {
    // Si hay espacio disponible, resolver inmediatamente
    if (activeConnections < MAX_CONCURRENT_CONNECTIONS) {
      activeConnections++;
      resolve();
      return;
    }
    
    // Si no hay espacio, agregar a la cola
    const queueItem = {
      resolve,
      reject,
      timeout: setTimeout(() => {
        // Remover de la cola si expira el timeout
        const index = connectionQueue.indexOf(queueItem);
        if (index > -1) {
          connectionQueue.splice(index, 1);
        }
        reject(new Error('Timeout esperando conexión disponible'));
      }, connectionWaitTimeout)
    };
    
    connectionQueue.push(queueItem);
  });
}

// Función helper para liberar conexión del semáforo
function releaseConnection() {
  activeConnections = Math.max(0, activeConnections - 1);
  
  // Procesar siguiente en la cola si hay
  if (connectionQueue.length > 0 && activeConnections < MAX_CONCURRENT_CONNECTIONS) {
    const next = connectionQueue.shift();
    clearTimeout(next.timeout);
    activeConnections++;
    next.resolve();
  }
}

// Estadísticas del pool (solo en desarrollo para debugging)
let poolStats = {
  totalQueries: 0,
  totalErrors: 0,
  totalRetries: 0,
  maxConcurrentReached: 0,
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
      console.log(`🔌 Conexión adquirida. Pool: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}, semáforo: ${activeConnections}/${MAX_CONCURRENT_CONNECTIONS}, cola: ${connectionQueue.length}`);
    } else {
      console.log('🔌 Conexión adquirida del pool');
    }
  }
  
  // Monitorear si se alcanza el máximo concurrente
  if (activeConnections >= MAX_CONCURRENT_CONNECTIONS) {
    poolStats.maxConcurrentReached++;
    if (!isProduction) {
      console.warn(`⚠️ Máximo concurrente alcanzado: ${activeConnections}/${MAX_CONCURRENT_CONNECTIONS}, cola: ${connectionQueue.length}`);
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

// Helper para ejecutar queries con retry automático mejorado y gestión explícita de conexiones
// Usa semáforo + pool.connect() explícitamente para garantizar que las conexiones se liberen correctamente
// CRÍTICO: En serverless, las conexiones deben liberarse inmediatamente después de cada query
export async function queryWithRetry(text, params, retries = 5) {
  let lastError;
  let client = null;
  let connectionAcquired = false;
  
  for (let i = 0; i < retries; i++) {
    try {
      // Esperar disponibilidad de conexión (semáforo)
      await waitForConnection();
      connectionAcquired = true;
      
      // En serverless, SIEMPRE usar pool.connect() explícitamente para mejor control
      // En producción tradicional, también usar pool.connect() para consistencia y mejor manejo de errores
      client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout obteniendo conexión del pool')), CONNECTION_TIMEOUT_MILLIS)
        )
      ]);
      
      try {
        const startTime = Date.now();
        const result = await client.query(text, params);
        const duration = Date.now() - startTime;
        
        // Log queries lentas (más de 2 segundos en producción, más de 1 segundo en desarrollo)
        const slowThreshold = isProduction ? 2000 : 1000;
        if (duration > slowThreshold) {
          console.warn(`⚠️ Query lenta: ${duration}ms - ${text.substring(0, 100)}...`);
        }
        
        return result;
      } finally {
        // CRÍTICO: Liberar la conexión inmediatamente después de la query
        // Esto es esencial en serverless para evitar agotar el pool
        if (client) {
          try {
            client.release();
          } catch (releaseError) {
            // Ignorar errores al liberar (puede estar ya liberado)
            if (!isProduction) {
              console.warn(`⚠️ Error al liberar cliente: ${releaseError.message}`);
            }
          }
          client = null;
        }
        
        // Liberar del semáforo
        if (connectionAcquired) {
          releaseConnection();
          connectionAcquired = false;
        }
      }
    } catch (error) {
      // Asegurar que el cliente se libere incluso si hay error
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          // Ignorar errores al liberar
        }
        client = null;
      }
      
      // Liberar del semáforo si se adquirió
      if (connectionAcquired) {
        releaseConnection();
        connectionAcquired = false;
      }
      
      lastError = error;
      poolStats.totalRetries++;
      
      // Errores recuperables: MaxClients, Max client connections, connection timeout, connection error
      const isRecoverableError = 
        error.message?.includes('MaxClients') ||
        error.message?.includes('Max client connections') ||
        error.message?.includes('too many clients') ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout') ||
        error.message?.includes('obteniendo conexión') ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'XX000' || // Error code de PostgreSQL para "Max client connections reached"
        error.code === '53300'; // Error code de PostgreSQL para "too many connections"
      
      // Si es error recuperable y no es el último intento, reintentar
      if (isRecoverableError && i < retries - 1) {
        // Backoff exponencial mejorado con jitter: 150ms, 300ms, 600ms, 1200ms, 2400ms
        // Aumentado un poco el tiempo inicial para dar más tiempo a que se liberen conexiones
        const baseDelay = Math.pow(2, i) * 150;
        const jitter = Math.random() * 100; // 0-100ms de jitter
        const delay = baseDelay + jitter;
        
        // En serverless, esperar más tiempo antes de reintentar
        const waitTime = isServerless ? delay + 100 : delay;
        
        if (!isProduction || i === 0) {
          console.warn(`⚠️ Error de conexión (Max clients?), reintentando en ${Math.round(waitTime)}ms (intento ${i + 1}/${retries}): ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
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

// Wrapper para pool.connect() que usa el semáforo
// CRÍTICO: Usar este wrapper en lugar de pool.connect() directamente para garantizar gestión correcta de conexiones
export async function connectWithSemaphore() {
  await waitForConnection();
  let client = null;
  let connectionAcquired = true;
  
  try {
    client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout obteniendo conexión del pool')), CONNECTION_TIMEOUT_MILLIS)
      )
    ]);
    
    // Crear un wrapper del cliente que libere del semáforo cuando se libere
    const originalRelease = client.release.bind(client);
    client.release = function(...args) {
      releaseConnection();
      connectionAcquired = false;
      return originalRelease(...args);
    };
    
    return client;
  } catch (error) {
    if (connectionAcquired) {
      releaseConnection();
    }
    throw error;
  }
}

// Función para obtener estadísticas del pool (útil para monitoreo)
export function getPoolStats() {
  return {
    ...poolStats,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    activeConnections,
    maxConcurrentConnections: MAX_CONCURRENT_CONNECTIONS,
    queueLength: connectionQueue.length,
  };
}

export default pool;

