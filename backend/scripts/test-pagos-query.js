/**
 * Script para probar el query de pagos
 */

import { pool } from '../db/connection.js';

async function testQuery() {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.mq,
        p.invoice_date as fecha_factura,
        -- ✅ VENCIMIENTO: obtener due_date de purchases o calcular automáticamente
        CASE 
          WHEN p.due_date IS NOT NULL THEN p.due_date
          WHEN p.invoice_date IS NOT NULL THEN (p.invoice_date + INTERVAL '10 days')::date
          ELSE NULL
        END as vencimiento,
        p.supplier_name as proveedor
      FROM purchases p
      WHERE p.condition IN ('USADO', 'NUEVO')
        AND p.invoice_date IS NOT NULL
      ORDER BY p.updated_at DESC
      LIMIT 3;
    `);
    
    console.log('Resultados del query de pagos (purchases):');
    result.rows.forEach(row => {
      console.log(`  MQ: ${row.mq || 'N/A'}`);
      console.log(`    fecha_factura: ${row.fecha_factura}`);
      console.log(`    vencimiento: ${row.vencimiento || 'NULL'}`);
      console.log(`    proveedor: ${row.proveedor || 'N/A'}`);
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

testQuery();

