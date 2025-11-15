import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrations = [
  '2025-11-14_add_preselection_inline_fields.sql',
  '2025-11-15_add_colombia_time_to_preselections.sql',
];

async function run() {
  try {
    for (const file of migrations) {
      const absolutePath = path.resolve(__dirname, '..', 'migrations', file);
      const sql = fs.readFileSync(absolutePath, 'utf-8');
      console.log(`↗ Ejecutando ${file}`);
      await pool.query(sql);
      console.log(`✓ ${file} aplicada`);
    }
    console.log('🎉 Migraciones completadas');
  } catch (err) {
    console.error('❌ Error ejecutando migraciones:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();

