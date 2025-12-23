/**
 * Script para ejecutar migraciones SQL en la base de datos local
 * Uso: node backend/scripts/run-migration.js <archivo-migracion.sql>
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Error: Debes especificar el archivo de migración');
  console.log('Uso: node backend/scripts/run-migration.js <archivo-migracion.sql>');
  process.exit(1);
}

async function runMigration() {
  try {
    // Leer el archivo de migración
    const migrationPath = join(__dirname, '..', '..', 'supabase', 'migrations', migrationFile);
    console.log(`📄 Leyendo migración: ${migrationPath}`);
    
    const sql = readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Ejecutando migración...');
    
    // Ejecutar la migración
    await pool.query(sql);
    
    console.log('✅ Migración ejecutada exitosamente');
    
    // Verificar que las columnas se crearon
    const checkColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'new_purchases' 
      AND column_name IN ('usd_jpy_rate', 'trm_rate')
      ORDER BY column_name;
    `);
    
    if (checkColumns.rows.length > 0) {
      console.log('\n📊 Columnas verificadas:');
      checkColumns.rows.forEach(col => {
        console.log(`   ✓ ${col.column_name} (${col.data_type})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

