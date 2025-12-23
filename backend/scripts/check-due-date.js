/**
 * Script para verificar si due_date existe en purchases
 */

import { pool } from '../db/connection.js';

async function checkColumn() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'purchases' 
      AND column_name = 'due_date';
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ La columna due_date NO existe en purchases');
    } else {
      console.log(`✓ La columna due_date existe: ${result.rows[0].data_type}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkColumn();

