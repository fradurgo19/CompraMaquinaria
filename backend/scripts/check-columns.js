/**
 * Script para verificar columnas en new_purchases
 */

import { pool } from '../db/connection.js';

async function checkColumns() {
  try {
    // Verificar columnas de pagos
    const pagoColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'new_purchases' 
      AND column_name LIKE 'pago%' 
      ORDER BY column_name;
    `);
    
    console.log('Columnas de pagos en new_purchases:');
    if (pagoColumns.rows.length === 0) {
      console.log('  ❌ No se encontraron columnas de pagos');
    } else {
      pagoColumns.rows.forEach(col => {
        console.log(`  ✓ ${col.column_name} (${col.data_type})`);
      });
    }
    
    // Verificar total_valor_girado
    const totalColumn = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'new_purchases' 
      AND column_name = 'total_valor_girado';
    `);
    
    console.log('\nColumna total_valor_girado:');
    if (totalColumn.rows.length === 0) {
      console.log('  ❌ No existe');
    } else {
      totalColumn.rows.forEach(col => {
        console.log(`  ✓ ${col.column_name} (${col.data_type})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkColumns();

