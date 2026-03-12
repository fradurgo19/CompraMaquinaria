import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import pool from '../db/connection.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/** Regex: DD/MM/YYYY o DD-MM-YYYY (grupos: day, month, year) */
const DMY_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
/** Regex: DD/MM/YY o DD-MM-YY */
const DMY_SHORT_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/;
/** Regex: YYYY/MM/DD o YYYY-MM-DD */
const YMD_RE = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/;

function tryDmy(dateStr) {
  const m = DMY_RE.exec(dateStr);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3];
  const date = new Date(`${year}-${month}-${day}`);
  return Number.isFinite(date.getTime()) ? `${year}-${month}-${day}` : null;
}

function tryDmyShort(dateStr) {
  const m = DMY_SHORT_RE.exec(dateStr);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  let year = Number.parseInt(m[3], 10);
  year = year < 50 ? 2000 + year : 1900 + year;
  const date = new Date(`${year}-${month}-${day}`);
  return Number.isFinite(date.getTime()) ? `${year}-${month}-${day}` : null;
}

function tryYmd(dateStr) {
  const m = YMD_RE.exec(dateStr);
  if (!m) return null;
  const year = m[1];
  const month = m[2].padStart(2, '0');
  const day = m[3].padStart(2, '0');
  const date = new Date(`${year}-${month}-${day}`);
  return Number.isFinite(date.getTime()) ? `${year}-${month}-${day}` : null;
}

function tryMdy(dateStr) {
  const m = DMY_RE.exec(dateStr);
  if (!m) return null;
  const month = m[1].padStart(2, '0');
  const day = m[2].padStart(2, '0');
  const year = m[3];
  const dayNum = Number.parseInt(day, 10);
  const monthNum = Number.parseInt(month, 10);
  if (dayNum > 31 || monthNum > 12) return null;
  const date = new Date(`${year}-${month}-${day}`);
  return Number.isFinite(date.getTime()) ? `${year}-${month}-${day}` : null;
}

/**
 * Parsea fecha en varios formatos.
 * Soporta: DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, YYYY-MM-DD, DD/MM/YY, etc.
 * @param {string} dateStr - Cadena de fecha
 * @returns {string|null} ISO date YYYY-MM-DD o null
 */
function parseDateString(dateStr) {
  if (!dateStr) return null;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const dmy = tryDmy(dateStr);
    if (dmy) return dmy;
    const dmyShort = tryDmyShort(dateStr);
    if (dmyShort) return dmyShort;
    const ymd = tryYmd(dateStr);
    if (ymd) return ymd;
    const mdy = tryMdy(dateStr);
    if (mdy) return mdy;
    const parsedDate = new Date(dateStr);
    if (Number.isFinite(parsedDate.getTime())) {
      const y = parsedDate.getFullYear();
      const mStr = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(parsedDate.getDate()).padStart(2, '0');
      return `${y}-${mStr}-${dStr}`;
    }
    console.warn(`No se pudo parsear fecha: "${dateStr}"`);
    return null;
  } catch (err) {
    console.error(`Error parseando fecha "${dateStr}":`, err);
    return null;
  }
}

/**
 * Normaliza valor a entero o null.
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return (Number.isNaN(parsed) || !Number.isFinite(parsed)) ? null : parsed;
}

/**
 * Normaliza valor a float. Opción allowZero para rechazar <=0; defaultVal para valor por defecto cuando no numérico.
 * @param {unknown} value
 * @param {{ allowZero?: boolean, defaultVal?: number | null }} opts - allowZero=false rechaza <=0; defaultVal para PVP
 * @returns {number|null}
 */
function normalizeFloat(value, opts = {}) {
  const { allowZero = true, defaultVal = null } = opts;
  if (value === null || value === undefined || value === '') return defaultVal;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return defaultVal;
  if (!allowZero && parsed <= 0) return null;
  return parsed;
}

function parseAuctionFecha(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha.toISOString().split('T')[0];
  if (typeof fecha === 'number') {
    const excelDate = new Date((fecha - 25569) * 86400 * 1000);
    return excelDate.toISOString().split('T')[0];
  }
  if (typeof fecha === 'string' && fecha.trim()) return parseDateString(fecha.trim());
  return null;
}

/**
 * Parsea una fila de Excel a objeto de histórico de subasta. Lanza si falta modelo.
 * @param {object} row - Fila del sheet
 * @returns {object} { model, brand, serial, year, hours, precio, fechaSubasta, proveedor, lotNumber, moneda, estado }
 */
function parseAuctionRow(row) {
  const model = row.MODELO || row.Modelo || row.model || row.Model;
  if (!model) throw new Error('Modelo es requerido');

  let year = normalizeInt(row.AÑO || row.Año || row.YEAR || row.Year || row.year);
  if (year && year > 10000) {
    const excelDate = new Date((year - 25569) * 86400 * 1000);
    year = excelDate.getFullYear();
    if (year < 1980 || year > 2030) year = null;
  } else if (year && (year < 1980 || year > 2030)) {
    year = null;
  }

  const rawMoneda = (row.MONEDA || row.Moneda || row.CURRENCY || row.currency || '').toString().trim().toUpperCase();
  const moneda = ['JPY', 'USD', 'EUR'].includes(rawMoneda) ? rawMoneda : null;
  const rawEstado = (row.ESTADO || row.Estado || row.STATUS || row.status || 'GANADA').toString().trim().toUpperCase();
  const estado = ['GANADA', 'PERDIDA'].includes(rawEstado) ? rawEstado : 'GANADA';

  return {
    model,
    brand: row.MARCA || row.Marca || row.brand || row.Brand || null,
    serial: row.SERIE || row.Serie || row.Serial || row.SERIAL || null,
    year,
    hours: normalizeInt(row.HORAS || row.Horas || row.HOURS || row.Hours || row.hours),
    precio: normalizeFloat(row.PRECIO || row.Precio || row.PRECIO_COMPRADO || row.precio, { allowZero: false }),
    fechaSubasta: parseAuctionFecha(row.FECHA || row.Fecha || row.FECHA_SUBASTA || row.fecha_subasta || null),
    proveedor: row.PROVEEDOR || row.Proveedor || row.SUPPLIER || row.supplier || null,
    lotNumber: row.LOT || row.Lot || row.LOTE || row.Lote || row.lot_number || null,
    moneda,
    estado
  };
}

/**
 * Parsea una fila de Excel a objeto de histórico PVP. Lanza si falta modelo.
 */
function parsePvpRow(row) {
  const modelo = row.MODELO || row.Modelo || row.MODEL;
  if (!modelo) throw new Error('Modelo es requerido');

  const defaultNum = { defaultVal: 0 };
  return {
    provee: row.PROVEE || row.Proveedor || row.PROVEEDOR || null,
    modelo,
    serie: row.SERIE || row.Serie || row.SERIAL || null,
    anio: normalizeInt(row.AÑO || row.Año || row.YEAR || row.Year),
    hour: normalizeInt(row.HOUR || row.Hours || row.HORAS || row.Horas),
    precio: normalizeFloat(row.PRECIO || row.Precio),
    inland: normalizeFloat(row.INLAND || row.Inland, defaultNum),
    cifUsd: normalizeFloat(row['CIF /USD'] || row['CIF/USD'] || row.CIF_USD, defaultNum),
    cif: normalizeFloat(row.CIF || row.Cif, defaultNum),
    gastosPto: normalizeFloat(row['GASTOS PTO'] || row.GASTOS_PTO || row.gastos_pto, defaultNum),
    flete: normalizeFloat(row.FLETE || row.Flete, defaultNum),
    trasld: normalizeFloat(row.TRASLD || row.Traslado || row.TRASLADO, defaultNum),
    rptos: normalizeFloat(row.RPTOS || row.Repuestos || row.REPUESTOS, defaultNum),
    proyectado: normalizeFloat(row.proyectado || row.PROYECTADO || row.Proyectado, defaultNum),
    pvpEst: normalizeFloat(row['PVP EST'] || row.PVP_EST || row.pvp_est, defaultNum)
  };
}

const BATCH_SIZE = 25;
const SMALL_BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100;

async function runOneAuctionBatch(batch, userId) {
  const values = [];
  const params = [];
  let paramCounter = 1;
  batch.forEach((row) => {
    values.push(`($${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++})`);
    params.push(row.model, row.brand, row.serial, row.year, row.hours, row.precio, row.fechaSubasta, row.proveedor, row.lotNumber, row.moneda, row.estado, userId);
  });
  await pool.query(`
    INSERT INTO auction_price_history 
    (model, brand, serial, year, hours, precio_comprado, fecha_subasta, proveedor, lot_number, moneda, estado, imported_by)
    VALUES ${values.join(', ')}
  `, params);
}

async function runAuctionFallback(validRows, userId, errors) {
  let imported = 0;
  for (let i = 0; i < validRows.length; i += SMALL_BATCH_SIZE) {
    const smallBatch = validRows.slice(i, i + SMALL_BATCH_SIZE);
    try {
      await runOneAuctionBatch(smallBatch, userId);
      imported += smallBatch.length;
    } catch (fallbackErr) {
      console.error('Error en batch insert Auction (fallback por fila):', fallbackErr);
      for (const row of smallBatch) {
        try {
          await pool.query(`
            INSERT INTO auction_price_history 
            (model, brand, serial, year, hours, precio_comprado, fecha_subasta, proveedor, lot_number, moneda, estado, imported_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [row.model, row.brand, row.serial, row.year, row.hours, row.precio, row.fechaSubasta, row.proveedor, row.lotNumber, row.moneda, row.estado, userId]);
          imported++;
        } catch (singleErr) {
          const msg = singleErr instanceof Error ? singleErr.message : String(singleErr);
          errors.push(`Error insertando ${row.model}: ${msg}`);
        }
      }
    }
  }
  return imported;
}

async function insertAuctionBatches(validRows, userId, errors) {
  if (validRows.length === 0) return 0;
  try {
    let imported = 0;
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE);
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      await runOneAuctionBatch(batch, userId);
      imported += batch.length;
      if (i + BATCH_SIZE < validRows.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      if (currentBatch % 10 === 0 || currentBatch === totalBatches) {
        console.log(`Auction Import: Procesados ${imported}/${validRows.length} registros (batch ${currentBatch}/${totalBatches})`);
      }
    }
    return imported;
  } catch (batchErr) {
    console.error('Error en batch insert Auction:', batchErr);
    return runAuctionFallback(validRows, userId, errors);
  }
}

async function runOnePvpBatch(batch, userId) {
  const values = [];
  const params = [];
  let paramCounter = 1;
  batch.forEach((row) => {
    values.push(`($${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++}, $${paramCounter++})`);
    params.push(row.provee, row.modelo, row.serie, row.anio, row.hour, row.precio, row.inland, row.cifUsd, row.cif, row.gastosPto, row.flete, row.trasld, row.rptos, row.proyectado, row.pvpEst, userId);
  });
  await pool.query(`
    INSERT INTO pvp_history 
    (provee, modelo, serie, anio, hour, precio, inland, cif_usd, cif, gastos_pto, flete, trasld, rptos, proyectado, pvp_est, imported_by)
    VALUES ${values.join(', ')}
  `, params);
}

async function runPvpFallback(validRows, userId, errors) {
  let imported = 0;
  for (let i = 0; i < validRows.length; i += SMALL_BATCH_SIZE) {
    const smallBatch = validRows.slice(i, i + SMALL_BATCH_SIZE);
    try {
      await runOnePvpBatch(smallBatch, userId);
      imported += smallBatch.length;
    } catch (fallbackErr) {
      console.error('Error en batch insert PVP (fallback por fila):', fallbackErr);
      for (const row of smallBatch) {
        try {
          await pool.query(`
            INSERT INTO pvp_history 
            (provee, modelo, serie, anio, hour, precio, inland, cif_usd, cif, gastos_pto, flete, trasld, rptos, proyectado, pvp_est, imported_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `, [row.provee, row.modelo, row.serie, row.anio, row.hour, row.precio, row.inland, row.cifUsd, row.cif, row.gastosPto, row.flete, row.trasld, row.rptos, row.proyectado, row.pvpEst, userId]);
          imported++;
        } catch (singleErr) {
          const msg = singleErr instanceof Error ? singleErr.message : String(singleErr);
          errors.push(`Error insertando ${row.modelo}: ${msg}`);
        }
      }
    }
  }
  return imported;
}

async function insertPvpBatches(validRows, userId, errors) {
  if (validRows.length === 0) return 0;
  try {
    let imported = 0;
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE);
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      await runOnePvpBatch(batch, userId);
      imported += batch.length;
      if (i + BATCH_SIZE < validRows.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      if (currentBatch % 10 === 0 || currentBatch === totalBatches) {
        console.log(`PVP Import: Procesados ${imported}/${validRows.length} registros (batch ${currentBatch}/${totalBatches})`);
      }
    }
    return imported;
  } catch (batchErr) {
    console.error('Error en batch insert PVP:', batchErr);
    return runPvpFallback(validRows, userId, errors);
  }
}

// Configurar multer para subida de archivos (límite 10 MB para evitar DoS por contenido excesivo)
const MAX_FILE_SIZE_MB = 10;
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV'));
    }
  }
});

/**
 * POST /api/price-history/import-auction
 * Importar histórico de subastas desde Excel
 */
router.post('/import-auction', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const validRows = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      try {
        validRows.push(parseAuctionRow(data[i]));
      } catch (rowErr) {
        const msg = rowErr instanceof Error ? rowErr.message : String(rowErr);
        errors.push(`Fila ${i + 2}: ${msg}`);
      }
    }

    const imported = await insertAuctionBatches(validRows, req.user.id, errors);

    res.json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error importando histórico de subastas:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      severity: error.severity
    });
    
    // Retornar error más descriptivo
    const errorMessage = error.code === 'XX000' && error.message?.includes('MaxClients')
      ? 'Error: Se alcanzó el límite de conexiones. Por favor, intenta con un archivo más pequeño o divide el archivo en partes.'
      : error.message || 'Error al importar archivo';
    
    res.status(500).json({ 
      error: 'Error al importar archivo',
      details: errorMessage,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

/**
 * POST /api/price-history/import-pvp
 * Importar histórico de PVP desde Excel
 */
router.post('/import-pvp', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const validRows = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      try {
        validRows.push(parsePvpRow(data[i]));
      } catch (rowErr) {
        const msg = rowErr instanceof Error ? rowErr.message : String(rowErr);
        errors.push(`Fila ${i + 2}: ${msg}`);
      }
    }

    const imported = await insertPvpBatches(validRows, req.user.id, errors);

    res.json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error importando histórico de PVP:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      severity: error.severity
    });
    
    // Retornar error más descriptivo
    const errorMessage = error.code === 'XX000' && error.message?.includes('MaxClients')
      ? 'Error: Se alcanzó el límite de conexiones. Por favor, intenta con un archivo más pequeño o divide el archivo en partes.'
      : error.message || 'Error al importar archivo';
    
    res.status(500).json({ 
      error: 'Error al importar archivo',
      details: errorMessage,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

/**
 * GET /api/price-history/auction-stats
 * Estadísticas de histórico de subastas
 */
router.get('/auction-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT model) as unique_models,
        MIN(year) FILTER (WHERE year IS NOT NULL AND year >= 1980 AND year <= 2030) as oldest_year,
        MAX(year) FILTER (WHERE year IS NOT NULL AND year >= 1980 AND year <= 2030) as newest_year,
        AVG(precio_comprado) FILTER (WHERE precio_comprado IS NOT NULL AND precio_comprado > 0) as avg_price,
        MIN(precio_comprado) FILTER (WHERE precio_comprado IS NOT NULL AND precio_comprado > 0) as min_price,
        MAX(precio_comprado) FILTER (WHERE precio_comprado IS NOT NULL AND precio_comprado > 0) as max_price
      FROM auction_price_history
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/price-history/pvp-stats
 * Estadísticas de histórico de PVP
 */
router.get('/pvp-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT modelo) as unique_models,
        MIN(anio) as oldest_year,
        MAX(anio) as newest_year,
        AVG(pvp_est) as avg_pvp,
        AVG(rptos) as avg_rptos
      FROM pvp_history
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * DELETE /api/price-history/auction
 * Limpiar histórico de subastas
 */
router.delete('/auction', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM auction_price_history');
    res.json({ success: true, message: 'Histórico de subastas eliminado' });
  } catch (error) {
    console.error('Error eliminando histórico:', error);
    res.status(500).json({ error: 'Error al eliminar histórico' });
  }
});

/**
 * DELETE /api/price-history/pvp
 * Limpiar histórico de PVP
 */
router.delete('/pvp', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM pvp_history');
    res.json({ success: true, message: 'Histórico de PVP eliminado' });
  } catch (error) {
    console.error('Error eliminando histórico:', error);
    res.status(500).json({ error: 'Error al eliminar histórico' });
  }
});

/**
 * GET /api/price-history/template-auction
 * Descargar template de Excel para Subastas
 */
router.get('/template-auction', authenticateToken, requireAdmin, (req, res) => {
  try {
    // Crear workbook
    const wb = xlsx.utils.book_new();
    
    // Datos de ejemplo
    const data = [
      {
        'MODELO': 'PC200-8',
        'SERIE': '320145',
        'AÑO': 2019,
        'HORAS': 6500,
        'PRECIO': 47000,
        'FECHA': '26/02/2024',
        'PROVEEDOR': 'RITCHIE BROS',
        'LOT': 'LOT-12345',
        'MONEDA': 'USD',
        'ESTADO': 'GANADA'
      },
      {
        'MODELO': 'ZX200-5',
        'SERIE': '456789',
        'AÑO': 2018,
        'HORAS': 7200,
        'PRECIO': 65000,
        'FECHA': '15/08/2023',
        'PROVEEDOR': 'IRONPLANET',
        'LOT': 'LOT-67890',
        'MONEDA': 'JPY',
        'ESTADO': 'GANADA'
      },
      {
        'MODELO': 'CAT320D',
        'SERIE': '789012',
        'AÑO': 2020,
        'HORAS': 5800,
        'PRECIO': 55000,
        'FECHA': '',
        'PROVEEDOR': 'GREEN AUCTION',
        'LOT': 'LOT-45678',
        'MONEDA': 'EUR',
        'ESTADO': 'PERDIDA'
      }
    ];
    
    // Crear hoja
    const ws = xlsx.utils.json_to_sheet(data);
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 15 }, // MODELO
      { wch: 12 }, // SERIE
      { wch: 8 },  // AÑO
      { wch: 10 }, // HORAS
      { wch: 12 }, // PRECIO
      { wch: 15 }, // FECHA
      { wch: 20 }, // PROVEEDOR
      { wch: 12 }, // LOT
      { wch: 8 },  // MONEDA
      { wch: 10 }  // ESTADO
    ];
    
    xlsx.utils.book_append_sheet(wb, ws, 'Histórico Subastas');
    
    // Crear hoja de instrucciones
    const instructions = [
      { 'INSTRUCCIONES': '1. Complete los datos siguiendo el formato de los ejemplos' },
      { 'INSTRUCCIONES': '2. MODELO es obligatorio' },
      { 'INSTRUCCIONES': '3. FECHA puede estar vacía o en formato: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD' },
      { 'INSTRUCCIONES': '4. PRECIO debe ser el valor pagado en la subasta' },
      { 'INSTRUCCIONES': '5. MONEDA: JPY, USD o EUR (opcional). La sugerencia mostrará la moneda en preselección.' },
      { 'INSTRUCCIONES': '6. ESTADO: GANADA o PERDIDA. Solo las subastas GANADA se usan para la sugerencia de precio.' },
      { 'INSTRUCCIONES': '7. Puede agregar todas las filas que necesite' },
      { 'INSTRUCCIONES': '8. Borre las filas de ejemplo antes de importar sus datos' }
    ];
    const wsInst = xlsx.utils.json_to_sheet(instructions);
    wsInst['!cols'] = [{ wch: 80 }];
    xlsx.utils.book_append_sheet(wb, wsInst, 'Instrucciones');
    
    // Generar buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Enviar archivo
    res.setHeader('Content-Disposition', 'attachment; filename=Template_Subastas.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error generando template:', error);
    res.status(500).json({ error: 'Error al generar template' });
  }
});

/**
 * GET /api/price-history/template-pvp
 * Descargar template de Excel para PVP
 */
router.get('/template-pvp', authenticateToken, requireAdmin, (req, res) => {
  try {
    // Crear workbook
    const wb = xlsx.utils.book_new();
    
    // Datos de ejemplo
    const data = [
      {
        'PROVEE': 'EIKOH',
        'MODELO': 'PC200-8',
        'SERIE': '320145',
        'AÑO': 2019,
        'HOUR': 6500,
        'PRECIO': 42000,
        'INLAND': 800,
        'CIF /USD': 850,
        'CIF': 45000,
        'GASTOS PTO': 2500,
        'FLETE': 3000,
        'TRASLD': 1500,
        'RPTOS': 15000,
        'proyectado': 67000,
        'PVP EST': 75000,
        'FECHA': 2023
      },
      {
        'PROVEE': 'KATA',
        'MODELO': 'ZX200-5',
        'SERIE': '456789',
        'AÑO': 2018,
        'HOUR': 7200,
        'PRECIO': 58000,
        'INLAND': 900,
        'CIF /USD': 950,
        'CIF': 62000,
        'GASTOS PTO': 2800,
        'FLETE': 3200,
        'TRASLD': 1600,
        'RPTOS': 18000,
        'proyectado': 88000,
        'PVP EST': 95000,
        'FECHA': 2023
      },
      {
        'PROVEE': 'SOGO',
        'MODELO': 'CAT320D',
        'SERIE': '789012',
        'AÑO': 2020,
        'HOUR': 5800,
        'PRECIO': 48000,
        'INLAND': 850,
        'CIF /USD': 900,
        'CIF': 52000,
        'GASTOS PTO': 2600,
        'FLETE': 3100,
        'TRASLD': 1550,
        'RPTOS': 16000,
        'proyectado': 75000,
        'PVP EST': 82000,
        'FECHA': 2022
      }
    ];
    
    // Crear hoja
    const ws = xlsx.utils.json_to_sheet(data);
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 12 }, // PROVEE
      { wch: 15 }, // MODELO
      { wch: 12 }, // SERIE
      { wch: 8 },  // AÑO
      { wch: 10 }, // HOUR
      { wch: 12 }, // PRECIO
      { wch: 10 }, // INLAND
      { wch: 12 }, // CIF /USD
      { wch: 12 }, // CIF
      { wch: 12 }, // GASTOS PTO
      { wch: 10 }, // FLETE
      { wch: 10 }, // TRASLD
      { wch: 12 }, // RPTOS
      { wch: 12 }, // proyectado
      { wch: 12 }, // PVP EST
      { wch: 8 }   // FECHA
    ];
    
    xlsx.utils.book_append_sheet(wb, ws, 'Histórico PVP');
    
    // Crear hoja de instrucciones
    const instructions = [
      { 'INSTRUCCIONES': '1. Complete los datos siguiendo el formato de los ejemplos' },
      { 'INSTRUCCIONES': '2. MODELO es obligatorio' },
      { 'INSTRUCCIONES': '3. AÑO debe ser el año de la máquina (ej: 2019)' },
      { 'INSTRUCCIONES': '4. FECHA debe ser el año de compra (ej: 2023, 2024)' },
      { 'INSTRUCCIONES': '5. RPTOS y PVP EST son importantes para las sugerencias' },
      { 'INSTRUCCIONES': '6. Los demás campos ayudan al cálculo pero no son obligatorios' },
      { 'INSTRUCCIONES': '7. Puede agregar todas las filas que necesite' },
      { 'INSTRUCCIONES': '8. Borre las filas de ejemplo antes de importar sus datos' },
      { 'INSTRUCCIONES': '' },
      { 'INSTRUCCIONES': 'NOTA: Respete exactamente los nombres de las columnas' }
    ];
    const wsInst = xlsx.utils.json_to_sheet(instructions);
    wsInst['!cols'] = [{ wch: 80 }];
    xlsx.utils.book_append_sheet(wb, wsInst, 'Instrucciones');
    
    // Generar buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Enviar archivo
    res.setHeader('Content-Disposition', 'attachment; filename=Template_PVP_Repuestos.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error generando template:', error);
    res.status(500).json({ error: 'Error al generar template' });
  }
});

export default router;

