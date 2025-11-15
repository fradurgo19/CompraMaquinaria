import { pool } from '../db/connection.js';

const CITY_TIME_OFFSETS = {
  TOKYO: 9,
  NEW_YORK: -5,
  CALIFORNIA: -8,
};

const HOUR_IN_MS = 60 * 60 * 1000;

const calculateColombiaTime = (auctionDate, localTime, city) => {
  if (!auctionDate || !localTime || !city) return null;
  const offset = CITY_TIME_OFFSETS[city];
  if (offset === undefined) return null;

  const [hoursStr, minutesStr] = localTime.split(':');
  if (hoursStr === undefined || minutesStr === undefined) return null;
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const baseDate = new Date(auctionDate);
  if (Number.isNaN(baseDate.getTime())) return null;

  const utcMs =
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate(),
      hours,
      minutes
    ) - offset * HOUR_IN_MS;

  return new Date(utcMs).toISOString();
};

async function run() {
  try {
    console.log('↗ Buscando preselecciones con hora local definida...');
    const { rows } = await pool.query(`
      SELECT id, auction_date, local_time, auction_city
      FROM preselections
      WHERE auction_date IS NOT NULL
        AND local_time IS NOT NULL
        AND auction_city IS NOT NULL
    `);

    let updated = 0;
    for (const row of rows) {
      const colombiaTime = calculateColombiaTime(row.auction_date, row.local_time, row.auction_city);
      if (!colombiaTime) continue;
      await pool.query('UPDATE preselections SET colombia_time = $1 WHERE id = $2', [colombiaTime, row.id]);
      updated += 1;
    }

    console.log(`✓ ${updated} registros actualizados con hora Colombia`);
  } catch (err) {
    console.error('❌ Error al recalcular horas de Colombia:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();

