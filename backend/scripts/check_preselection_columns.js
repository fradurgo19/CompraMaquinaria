import { pool } from '../db/connection.js';

const columns = [
  'auction_type',
  'auction_country',
  'currency',
  'location',
  'final_price',
  'shoe_width_mm',
  'spec_pip',
  'spec_blade',
  'spec_cabin',
  'local_time',
  'auction_city',
  'colombia_time',
];

async function run() {
  try {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'preselections'
         AND column_name = ANY($1::text[])
       ORDER BY column_name`,
      [columns]
    );

    console.log('Columnas encontradas:', result.rows.map((r) => r.column_name));
  } catch (err) {
    console.error('Error verificando columnas:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();

