import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import pool from '../db/connection.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * Función para parsear fechas en diferentes formatos
 * Soporta: DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, YYYY-MM-DD, DD/MM/YY, etc.
 */
function parseDateString(dateStr) {
  if (!dateStr) return null;
  
  try {
    // Formato ISO: YYYY-MM-DD (ya válido)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Formato: DD/MM/YYYY o DD-MM-YYYY
    const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      // Validar fecha
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // Formato: DD/MM/YY o DD-MM-YY (año corto)
    const dmyShortMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (dmyShortMatch) {
      const day = dmyShortMatch[1].padStart(2, '0');
      const month = dmyShortMatch[2].padStart(2, '0');
      let year = parseInt(dmyShortMatch[3]);
      // Asumir siglo: 00-49 = 2000-2049, 50-99 = 1950-1999
      year = year < 50 ? 2000 + year : 1900 + year;
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // Formato: YYYY/MM/DD o YYYY-MM-DD
    const ymdMatch = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // Formato: MM/DD/YYYY (formato USA)
    const mdyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (mdyMatch) {
      const month = mdyMatch[1].padStart(2, '0');
      const day = mdyMatch[2].padStart(2, '0');
      const year = mdyMatch[3];
      // Intentar como MM/DD/YYYY si DD/MM/YYYY falló
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime()) && parseInt(day) <= 31 && parseInt(month) <= 12) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // Intentar parsear con Date constructor como último recurso
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Si nada funcionó, retornar null
    console.warn(`No se pudo parsear fecha: "${dateStr}"`);
    return null;
  } catch (error) {
    console.error(`Error parseando fecha "${dateStr}":`, error);
    return null;
  }
}

// Configurar multer para subida de archivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
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

    let imported = 0;
    let errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Mapear columnas (flexible para diferentes nombres)
        const model = row.MODELO || row.Modelo || row.model || row.Model;
        const brand = row.MARCA || row.Marca || row.brand || row.Brand;
        const serial = row.SERIE || row.Serie || row.Serial || row.SERIAL;
        const year = parseInt(row.AÑO || row.Año || row.YEAR || row.Year || row.year);
        const hours = parseInt(row.HORAS || row.Horas || row.HOURS || row.Hours || row.hours);
        const precio = parseFloat(row.PRECIO || row.Precio || row.PRECIO_COMPRADO || row.precio);
        const fecha = row.FECHA || row.Fecha || row.FECHA_SUBASTA || row.fecha_subasta || null;
        const proveedor = row.PROVEEDOR || row.Proveedor || row.SUPPLIER || row.supplier;
        const lotNumber = row.LOT || row.Lot || row.LOTE || row.Lote || row.lot_number;

        if (!model) {
          errors.push(`Fila ${i + 2}: Modelo es requerido`);
          continue;
        }

        // Procesar fecha si existe - Soporta múltiples formatos
        let fechaSubasta = null;
        if (fecha) {
          if (fecha instanceof Date) {
            // Fecha como objeto Date
            fechaSubasta = fecha.toISOString().split('T')[0];
          } else if (typeof fecha === 'number') {
            // Excel serial date (número)
            const excelDate = new Date((fecha - 25569) * 86400 * 1000);
            fechaSubasta = excelDate.toISOString().split('T')[0];
          } else if (typeof fecha === 'string' && fecha.trim()) {
            // Fecha como string - Intentar parsear diferentes formatos
            fechaSubasta = parseDateString(fecha.trim());
          }
        }

        await pool.query(`
          INSERT INTO auction_price_history 
          (model, brand, serial, year, hours, precio_comprado, fecha_subasta, proveedor, lot_number, imported_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [model, brand, serial, year, hours, precio, fechaSubasta, proveedor, lotNumber, req.user.id]);

        imported++;
      } catch (error) {
        errors.push(`Fila ${i + 2}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error importando histórico de subastas:', error);
    res.status(500).json({ error: 'Error al importar archivo', details: error.message });
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

    let imported = 0;
    let errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Mapear columnas según la estructura del Excel
        const provee = row.PROVEE || row.Proveedor || row.PROVEEDOR;
        const modelo = row.MODELO || row.Modelo || row.MODEL;
        const serie = row.SERIE || row.Serie || row.SERIAL;
        const anio = parseInt(row.AÑO || row.Año || row.YEAR || row.Year);
        const hour = parseInt(row.HOUR || row.Hours || row.HORAS || row.Horas);
        const precio = parseFloat(row.PRECIO || row.Precio);
        const inland = parseFloat(row.INLAND || row.Inland || 0);
        const cifUsd = parseFloat(row['CIF /USD'] || row['CIF/USD'] || row.CIF_USD || 0);
        const cif = parseFloat(row.CIF || row.Cif || 0);
        const gastosPto = parseFloat(row['GASTOS PTO'] || row.GASTOS_PTO || row.gastos_pto || 0);
        const flete = parseFloat(row.FLETE || row.Flete || 0);
        const trasld = parseFloat(row.TRASLD || row.Traslado || row.TRASLADO || 0);
        const rptos = parseFloat(row.RPTOS || row.Repuestos || row.REPUESTOS || 0);
        const proyectado = parseFloat(row.proyectado || row.PROYECTADO || row.Proyectado || 0);
        const pvpEst = parseFloat(row['PVP EST'] || row.PVP_EST || row.pvp_est || 0);

        if (!modelo) {
          errors.push(`Fila ${i + 2}: Modelo es requerido`);
          continue;
        }

        await pool.query(`
          INSERT INTO pvp_history 
          (provee, modelo, serie, anio, hour, precio, inland, cif_usd, cif, gastos_pto, flete, trasld, rptos, proyectado, pvp_est, imported_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [provee, modelo, serie, anio, hour, precio, inland, cifUsd, cif, gastosPto, flete, trasld, rptos, proyectado, pvpEst, req.user.id]);

        imported++;
      } catch (error) {
        errors.push(`Fila ${i + 2}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error importando histórico de PVP:', error);
    res.status(500).json({ error: 'Error al importar archivo', details: error.message });
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
        MIN(year) as oldest_year,
        MAX(year) as newest_year,
        AVG(precio_comprado) as avg_price,
        MIN(precio_comprado) as min_price,
        MAX(precio_comprado) as max_price
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
        'MARCA': 'KOMATSU',
        'SERIE': '320145',
        'AÑO': 2019,
        'HORAS': 6500,
        'PRECIO': 47000,
        'FECHA': '26/02/2024',
        'PROVEEDOR': 'RITCHIE BROS',
        'LOT': 'LOT-12345'
      },
      {
        'MODELO': 'ZX200-5',
        'MARCA': 'HITACHI',
        'SERIE': '456789',
        'AÑO': 2018,
        'HORAS': 7200,
        'PRECIO': 65000,
        'FECHA': '15/08/2023',
        'PROVEEDOR': 'IRONPLANET',
        'LOT': 'LOT-67890'
      },
      {
        'MODELO': 'CAT320D',
        'MARCA': 'CATERPILLAR',
        'SERIE': '789012',
        'AÑO': 2020,
        'HORAS': 5800,
        'PRECIO': 55000,
        'FECHA': '',
        'PROVEEDOR': 'GREEN AUCTION',
        'LOT': 'LOT-45678'
      }
    ];
    
    // Crear hoja
    const ws = xlsx.utils.json_to_sheet(data);
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 15 }, // MODELO
      { wch: 15 }, // MARCA
      { wch: 12 }, // SERIE
      { wch: 8 },  // AÑO
      { wch: 10 }, // HORAS
      { wch: 12 }, // PRECIO
      { wch: 15 }, // FECHA
      { wch: 20 }, // PROVEEDOR
      { wch: 12 }  // LOT
    ];
    
    xlsx.utils.book_append_sheet(wb, ws, 'Histórico Subastas');
    
    // Crear hoja de instrucciones
    const instructions = [
      { 'INSTRUCCIONES': '1. Complete los datos siguiendo el formato de los ejemplos' },
      { 'INSTRUCCIONES': '2. MODELO es obligatorio' },
      { 'INSTRUCCIONES': '3. FECHA puede estar vacía o en formato: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD' },
      { 'INSTRUCCIONES': '4. PRECIO debe ser el valor pagado en la subasta' },
      { 'INSTRUCCIONES': '5. Puede agregar todas las filas que necesite' },
      { 'INSTRUCCIONES': '6. Borre las filas de ejemplo antes de importar sus datos' }
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
        'PVP EST': 75000
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
        'PVP EST': 95000
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
        'PVP EST': 82000
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
      { wch: 12 }  // PVP EST
    ];
    
    xlsx.utils.book_append_sheet(wb, ws, 'Histórico PVP');
    
    // Crear hoja de instrucciones
    const instructions = [
      { 'INSTRUCCIONES': '1. Complete los datos siguiendo el formato de los ejemplos' },
      { 'INSTRUCCIONES': '2. MODELO es obligatorio' },
      { 'INSTRUCCIONES': '3. AÑO debe ser el año de compra (no se requiere fecha completa)' },
      { 'INSTRUCCIONES': '4. RPTOS y PVP EST son importantes para las sugerencias' },
      { 'INSTRUCCIONES': '5. Los demás campos ayudan al cálculo pero no son obligatorios' },
      { 'INSTRUCCIONES': '6. Puede agregar todas las filas que necesite' },
      { 'INSTRUCCIONES': '7. Borre las filas de ejemplo antes de importar sus datos' },
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

