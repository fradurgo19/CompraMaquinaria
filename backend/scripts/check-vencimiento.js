/**
 * Script para verificar vencimiento en purchases
 */

import { pool } from '../db/connection.js';

async function checkVencimiento() {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        invoice_date, 
        due_date, 
        (invoice_date + INTERVAL '10 days')::date as calc_venc
      FROM purchases 
      WHERE invoice_date IS NOT NULL 
      ORDER BY updated_at DESC 
      LIMIT 5;
    `);
    
    console.log('Registros de purchases con invoice_date:');
    result.rows.forEach(row => {
      console.log(`  ID: ${row.id}`);
      console.log(`    invoice_date: ${row.invoice_date}`);
      console.log(`    due_date (guardado): ${row.due_date || 'NULL'}`);
      console.log(`    calc_venc (calculado): ${row.calc_venc || 'NULL'}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkVencimiento();

