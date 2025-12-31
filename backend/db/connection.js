/**
 * Conexión a PostgreSQL / Supabase
 * En producción usa Supabase (connection string con pooling)
 * En desarrollo usa PostgreSQL local
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Determinar si estamos en producción (Vercel) o desarrollo
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
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
  
  poolConfig = {
    connectionString: transactionPoolerUrl,
    ssl: {
      rejectUnauthorized: false // Supabase requiere SSL
    },
    max: 5, // Transaction pooler permite más conexiones, podemos usar más
    min: 0, // No mantener conexiones mínimas
    idleTimeoutMillis: 10000, // 10 segundos de idle
    connectionTimeoutMillis: 2000, // 2 segundos timeout
    allowExitOnIdle: true, // Permitir que el proceso termine cuando no hay conexiones
  };
  
  console.log('✓ Usando Supabase Database (Producción) - Transaction Pooler (puerto 6543) - Pool: 5 conexiones máx');
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

pool.on('connect', () => {
  console.log('✓ Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error en conexión PostgreSQL:', err.message);
  // No lanzar error para evitar que el proceso termine
});

// Manejar errores de pool agotado
pool.on('acquire', (client) => {
  // Log solo en desarrollo para debugging
  if (!isProduction) {
    console.log('🔌 Conexión adquirida del pool');
  }
});

pool.on('remove', (client) => {
  // Log solo en desarrollo para debugging
  if (!isProduction) {
    console.log('🔌 Conexión removida del pool');
  }
});

// Helper para ejecutar queries con retry automático
// Con Transaction pooler, los errores de MaxClients deberían ser raros, pero mantenemos retry por seguridad
export async function queryWithRetry(text, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(text, params);
    } catch (error) {
      // Si es error de MaxClients o conexión, esperar un poco y reintentar
      if ((error.message?.includes('MaxClients') || error.message?.includes('connection')) && i < retries - 1) {
        // Backoff exponencial: 100ms, 200ms, 400ms
        const delay = Math.pow(2, i) * 100;
        console.warn(`⚠️ Error de conexión, reintentando en ${delay}ms (intento ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// Función helper para obtener el rol del usuario
export async function getUserRole(userId) {
  const result = await pool.query(
    'SELECT role FROM users_profile WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.role || null;
}

export default pool;

