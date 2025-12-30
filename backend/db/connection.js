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
  poolConfig = {
    connectionString: useConnectionString,
    ssl: {
      rejectUnauthorized: false // Supabase requiere SSL
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
  
  console.log('✓ Usando Supabase Database (Producción)');
} else {
  // Usar PostgreSQL local (desarrollo)
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'maquinaria_usada',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,
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
  console.error('Error en conexión PostgreSQL:', err);
});

// Función helper para obtener el rol del usuario
export async function getUserRole(userId) {
  const result = await pool.query(
    'SELECT role FROM users_profile WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.role || null;
}

export default pool;

