/**
 * Conexión a PostgreSQL 17
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'maquinaria_usada',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

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

