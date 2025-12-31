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
  // Usar Supabase con connection string (incluye pooling)
  // Formato: postgresql://postgres.xxx:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres
  // IMPORTANTE: Supabase Session pooler tiene límite de 5 conexiones simultáneas
  // Reducir a 2 para dejar margen y evitar MaxClientsInSessionMode
  poolConfig = {
    connectionString: useConnectionString,
    ssl: {
      rejectUnauthorized: false // Supabase requiere SSL
    },
    max: 1, // Reducir a 1 conexión para evitar MaxClientsInSessionMode (Session pooler tiene límite de 5)
    min: 0, // No mantener conexiones mínimas
    idleTimeoutMillis: 5000, // Reducir tiempo de idle para liberar conexiones más rápido (5 segundos)
    connectionTimeoutMillis: 500, // Timeout más corto (500ms)
    allowExitOnIdle: true, // Permitir que el proceso termine cuando no hay conexiones
  };
  
  console.log('✓ Usando Supabase Database (Producción) - Pool: 2 conexiones máx');
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
export async function queryWithRetry(text, params, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(text, params);
    } catch (error) {
      // Si es error de MaxClients, esperar un poco y reintentar
      if (error.message?.includes('MaxClients') && i < retries - 1) {
        // Backoff exponencial más agresivo: 200ms, 400ms, 800ms, 1600ms, 3200ms
        const delay = Math.pow(2, i) * 200;
        console.warn(`⚠️ MaxClients error, reintentando en ${delay}ms (intento ${i + 1}/${retries})`);
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

