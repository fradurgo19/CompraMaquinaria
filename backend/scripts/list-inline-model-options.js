/**
 * Lista completa de opciones del select inline "Modelo" en /management.
 * Combina: MODEL_OPTIONS (constante) + nombres de la tabla `models`.
 * Uso: desde backend/ → node scripts/list-inline-model-options.js
 *
 * Mantener MODEL_OPTIONS en sync con src/constants/models.ts
 */

import { pool } from '../db/connection.js';

const MODEL_OPTIONS = [
  'ARM BOOM ZX200',
  'AX50U-3',
  'C12R',
  'C12R-B',
  'CABIN',
  'CABIN ZX200',
  'CAB_ZX120-5',
  'CD10R-1',
  'COVER TANK ZX200',
  'CYLINDER',
  'D3C',
  'DAT300 RS',
  'DENYO DLW-300LS S',
  'DLW-300LS',
  'EX5-2',
  'FINAL DRIVE',
  'K-120-3',
  'K120-3',
  'K70-3 (ZX70-3)',
  'SH200-5',
  'SH75X-3B',
  'SWING MOTOR',
  'SWIN MOTOR',
  'TANK COVERS',
  'WELDER, DAT-300RS',
  'ZX17U-2',
  'ZX17U-5A',
  'ZX30U-5A',
  'ZX40U-3',
  'ZX40U-5A',
  'ZX40U-5B',
  'ZX50U-5B',
  'ZX70-3',
  'ZX75US-3',
  'ZX75US-5B',
  'ZX75US-A',
  'ZX75USK-3',
  'ZX75USK-5B',
  'ZX120-3',
  'ZX120-5B',
  'ZX120-6',
  'ZX130-5G',
  'ZX130K-6',
  'ZX130L-5B',
  'ZX135US',
  'ZX135US-3',
  'ZX135US-5B',
  'ZX135US-6',
  'ZX135US-6N',
  'ZX135USK-5B',
  'ZX135USK-6',
  'ZX200-3',
  'ZX200-5B',
  'ZX200-5G',
  'ZX200-6',
  'ZX200LC-6',
  'ZX200X-5B',
  'ZX210 LC',
  'ZX210H-6',
  'ZX210K-5B',
  'ZX210K-6',
  'ZX210LC-6',
  'ZX210LCH-5B',
  'ZX210LCH-5G',
  'ZX210LCK-6',
  'ZX225US-3',
  'ZX225US-5B',
  'ZX225US-6',
  'ZX225USR-3',
  'ZX225USR-5B',
  'ZX225USR-6',
  'ZX225USRLC-5B',
  'ZX225USRLCK-6',
  'ZX225USRK-5B',
  'ZX225USRK-6',
  'ZX240-6',
  'ZX240LC-5B',
  'ZX240LC-6',
  'ZX250K-6',
  'ZX300 LC-6',
  'ZX300-6A',
  'ZX300LC-6N',
  'ZX330-5B',
  'ZX330-6',
  'ZX330LC-5B',
  'ZX345US LC-6N',
  'ZX350-5B',
  'ZX350H-5B',
  'ZX350H-6',
  'ZX350K-5B',
  'ZX350K-6',
  'ZX350LC-6',
  'ZX350LC-6N',
  'ZX350LCK-6',
  'ZX490H-6',
  'ZX490LCH-5A',
];

async function main() {
  let dbNames = [];
  try {
    const result = await pool.query(
      'SELECT id, name, created_at, updated_at FROM models ORDER BY name ASC'
    );
    dbNames = result.rows.map((r) => r.name);
    console.log('--- Registros en tabla `models` ---');
    console.log(JSON.stringify(result.rows, null, 2));
    console.log('');
  } catch (err) {
    console.error('Error al consultar tabla models:', err.message);
  }

  const combined = [...MODEL_OPTIONS, ...dbNames];
  const fullList = Array.from(new Set(combined)).sort((a, b) => a.localeCompare(b));

  console.log('--- Lista completa (select inline Modelo): cantidad =', fullList.length, '---');
  fullList.forEach((name, i) => console.log(`${i + 1}. ${name}`));

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
