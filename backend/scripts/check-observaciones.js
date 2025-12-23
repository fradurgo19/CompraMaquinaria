/**
 * Script para verificar si observaciones_pagos existe en new_purchases
 */

import { pool } from '../db/connection.js';

async function checkColumn() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'new_purchases' 
      AND column_name = 'observaciones_pagos';
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ La columna observaciones_pagos NO existe en new_purchases');
    } else {
      console.log(`✓ La columna observaciones_pagos existe: ${result.rows[0].data_type}`);
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

