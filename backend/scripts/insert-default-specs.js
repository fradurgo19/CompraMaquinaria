/**
 * Script para insertar especificaciones por defecto de máquinas
 * Uso: node backend/scripts/insert-default-specs.js
 */

import { pool } from '../db/connection.js';

const defaultSpecs = [
  { brand: 'YANMAR', model: 'VIO17-1B', capacidad: 'MINIS', spec_blade: true, spec_pip: true, spec_cabin: 'CANOPY', shoe_width_mm: 230, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX17U-5A', capacidad: 'MINIS', spec_blade: true, spec_pip: true, spec_cabin: 'CANOPY', shoe_width_mm: 230, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX30U-5A', capacidad: 'MINIS', spec_blade: true, spec_pip: true, spec_cabin: 'CANOPY', shoe_width_mm: 300, arm_type: 'ESTANDAR' },
  { brand: 'YANMAR', model: 'VIO35-7', capacidad: 'MINIS', spec_blade: true, spec_pip: true, spec_cabin: 'CANOPY', shoe_width_mm: 300, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX40U-5B', capacidad: 'MINIS', spec_blade: true, spec_pip: true, spec_cabin: 'CANOPY', shoe_width_mm: 350, arm_type: 'ESTANDAR' },
  { brand: 'YANMAR', model: 'VIO50-7', capacidad: 'MINIS', spec_blade: true, spec_pip: true, spec_cabin: 'CABINA CERRADA', shoe_width_mm: 400, arm_type: 'ESTANDAR' },
  { brand: 'AIRMAN', model: 'AX50-3', capacidad: 'MINIS', spec_blade: true, spec_pip: true, spec_cabin: 'CANOPY', shoe_width_mm: 400, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX75US-5B', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 450, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX75USK-5B', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 450, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX75-7', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 450, arm_type: 'ESTANDAR' },
  { brand: 'YANMAR', model: 'VIO80-7', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 450, arm_type: 'ESTANDAR' },
  { brand: 'LIUGONG', model: '909F', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 450, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX120-6', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 600, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX135US-6', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 500, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX135USK-5B', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 500, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX135US-5B', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 500, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX130-5B', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 700, arm_type: 'ESTANDAR' },
  { brand: 'LIUGONG', model: '915F', capacidad: 'MEDIANAS', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 600, arm_type: 'ESTANDAR' },
  { brand: 'LIUGONG', model: '920F', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 800, arm_type: 'ESTANDAR' },
  { brand: 'LIUGONG', model: '922F', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 800, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX200-6', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 600, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX200LC-5B', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 700, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX225USR-6', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 600, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX210LC-5B', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 800, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX350LC-6N', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 800, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX350H-5B', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 800, arm_type: 'ESTANDAR' },
  { brand: 'HITACHI', model: 'ZX350LC-5B', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 800, arm_type: 'ESTANDAR' },
  { brand: 'LIUGONG', model: '933F', capacidad: 'GRANDES', spec_blade: false, spec_pip: false, spec_cabin: 'CABINA CERRADA / AIRE ACONDICIONADO', shoe_width_mm: 800, arm_type: 'ESTANDAR' },
];

async function insertDefaultSpecs() {
  try {
    console.log('Iniciando inserción de especificaciones por defecto...\n');

    // Verificar si la tabla existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ La tabla machine_spec_defaults no existe. Por favor ejecuta la migración primero.');
      process.exit(1);
    }

    // Verificar si la columna shoe_width_mm existe
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'machine_spec_defaults'
        AND column_name = 'shoe_width_mm'
      );
    `);

    const hasShoeWidthColumn = columnCheck.rows[0].exists;

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const spec of defaultSpecs) {
      try {
        let query, params;

        if (hasShoeWidthColumn) {
          query = `
            INSERT INTO machine_spec_defaults (
              brand, model, capacidad, spec_blade, spec_pip, spec_cabin, shoe_width_mm, arm_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (brand, model) 
            DO UPDATE SET
              capacidad = EXCLUDED.capacidad,
              spec_blade = EXCLUDED.spec_blade,
              spec_pip = EXCLUDED.spec_pip,
              spec_cabin = EXCLUDED.spec_cabin,
              shoe_width_mm = EXCLUDED.shoe_width_mm,
              arm_type = EXCLUDED.arm_type,
              updated_at = NOW()
            RETURNING *;
          `;
          params = [
            spec.brand,
            spec.model,
            spec.capacidad,
            spec.spec_blade,
            spec.spec_pip,
            spec.spec_cabin,
            spec.shoe_width_mm,
            spec.arm_type,
          ];
        } else {
          query = `
            INSERT INTO machine_spec_defaults (
              brand, model, capacidad, spec_blade, spec_pip, spec_cabin, arm_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (brand, model) 
            DO UPDATE SET
              capacidad = EXCLUDED.capacidad,
              spec_blade = EXCLUDED.spec_blade,
              spec_pip = EXCLUDED.spec_pip,
              spec_cabin = EXCLUDED.spec_cabin,
              arm_type = EXCLUDED.arm_type,
              updated_at = NOW()
            RETURNING *;
          `;
          params = [
            spec.brand,
            spec.model,
            spec.capacidad,
            spec.spec_blade,
            spec.spec_pip,
            spec.spec_cabin,
            spec.arm_type,
          ];
        }

        // Verificar si existe primero
        const existsResult = await pool.query(
          'SELECT id FROM machine_spec_defaults WHERE brand = $1 AND model = $2',
          [spec.brand, spec.model]
        );
        
        const exists = existsResult.rows.length > 0;
        
        await pool.query(query, params);
        
        if (exists) {
          updated++;
          console.log(`↻ Actualizado: ${spec.brand} - ${spec.model}`);
        } else {
          inserted++;
          console.log(`✓ Insertado: ${spec.brand} - ${spec.model}`);
        }
      } catch (error) {
        errors++;
        console.error(`✗ Error en ${spec.brand} - ${spec.model}:`, error.message);
      }
    }

    console.log(`\n✅ Proceso completado:`);
    console.log(`   - Insertados: ${inserted}`);
    console.log(`   - Actualizados: ${updated}`);
    console.log(`   - Errores: ${errors}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

insertDefaultSpecs();

