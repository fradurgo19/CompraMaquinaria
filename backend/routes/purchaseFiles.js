/**
 * Rutas de Archivos Privados de Compras (Purchase Files)
 * Sistema de carpetas privadas solo para usuarios de compras
 * Carpetas: LAVADO, SERIALES, DOCUMENTOS DEFINITIVOS, CARGUE, FACTURA PROFORMA
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../db/connection.js';
import { authenticateToken, canViewPurchases, canEditPurchases } from '../middleware/auth.js';

const router = express.Router();

// Configuración de Multer para almacenamiento temporal
// Nota: req.body no está disponible en destination, así que subimos a una carpeta temporal
// y luego movemos el archivo a la carpeta correcta después de recibir el body completo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const baseDir = path.join(process.cwd(), 'storage', 'purchases');
    const tempDir = path.join(baseDir, 'temp');
    
    // Asegurar que la carpeta base existe
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
      console.log('✅ Carpeta base creada:', baseDir);
    }
    
    // Asegurar que la carpeta temporal existe
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('✅ Carpeta temporal creada:', tempDir);
    }
    
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// GET /api/purchase-files/download/:id - Descargar archivo
// Requiere autenticación y permisos de compras
router.get('/download/:id', authenticateToken, canViewPurchases, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT pf.*, p.id as purchase_id
       FROM purchase_files pf
       JOIN purchases p ON pf.purchase_id = p.id
       WHERE pf.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const file = result.rows[0];
    const folderPath = file.folder.toLowerCase().replace(/\s+/g, '_');
    // file_path viene como "purchases/folder/filename", necesitamos extraer solo el filename
    const fileName = path.basename(file.file_path);
    const filePath = path.join(process.cwd(), 'storage', 'purchases', folderPath, fileName);

    console.log('🔍 Debug descarga archivo:');
    console.log('  - file_path (BD):', file.file_path);
    console.log('  - folder:', file.folder);
    console.log('  - folderPath:', folderPath);
    console.log('  - fileName:', fileName);
    console.log('  - filePath completo:', filePath);
    console.log('  - filePath existe:', fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
      console.log('❌ Archivo físico no encontrado:', filePath);
      // Intentar con la ruta completa del file_path
      const altPath = path.join(process.cwd(), 'storage', file.file_path);
      console.log('  - Intentando ruta alternativa:', altPath);
      if (fs.existsSync(altPath)) {
        console.log('  - ✅ Ruta alternativa encontrada, usando esta');
        const finalPath = path.resolve(altPath);
        if (file.file_type === 'FOTO' || file.mime_type?.startsWith('image/')) {
          res.setHeader('Content-Type', file.mime_type || 'image/jpeg');
          res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
          return res.sendFile(finalPath);
        } else {
          return res.download(finalPath, file.file_name);
        }
      }
      return res.status(404).json({ error: 'Archivo físico no encontrado', details: { filePath, altPath } });
    }

    const finalPath = path.resolve(filePath);
    // Para imágenes, usar sendFile con el MIME type correcto para que se muestren en <img>
    // Para otros archivos, usar download para forzar descarga
    if (file.file_type === 'FOTO' || file.mime_type?.startsWith('image/')) {
      console.log('✅ Sirviendo imagen de compras:', file.file_name, 'desde:', finalPath);
      res.setHeader('Content-Type', file.mime_type || 'image/jpeg');
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
      res.sendFile(finalPath);
    } else {
      console.log('✅ Descargando archivo de compras:', file.file_name);
      res.download(finalPath, file.file_name);
    }
  } catch (error) {
    console.error('Error descargando archivo de compras:', error);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

// Todas las rutas requieren autenticación y permisos de compras
router.use(authenticateToken);
router.use(canViewPurchases);

// GET /api/purchase-files/:purchaseId - Obtener archivos de una compra agrupados por carpeta
router.get('/:purchaseId', async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { folder, file_type } = req.query;

    let query = `
      SELECT 
        pf.*,
        up.email as uploaded_by_email,
        up.full_name as uploaded_by_name
      FROM purchase_files pf
      LEFT JOIN users_profile up ON pf.uploaded_by = up.id
      WHERE pf.purchase_id = $1
    `;

    const params = [purchaseId];
    let paramIndex = 2;

    if (folder && ['LAVADO', 'SERIALES', 'DOCUMENTOS DEFINITIVOS', 'CARGUE', 'FACTURA PROFORMA'].includes(folder)) {
      query += ` AND pf.folder = $${paramIndex}`;
      params.push(folder);
      paramIndex++;
    }

    if (file_type && ['FOTO', 'DOCUMENTO'].includes(file_type)) {
      query += ` AND pf.file_type = $${paramIndex}`;
      params.push(file_type);
      paramIndex++;
    }

    query += ' ORDER BY pf.folder, pf.file_type, pf.uploaded_at DESC';

    const result = await pool.query(query, params);

    // Agrupar por carpeta
    const grouped = {
      LAVADO: { FOTO: [], DOCUMENTO: [] },
      SERIALES: { FOTO: [], DOCUMENTO: [] },
      'DOCUMENTOS DEFINITIVOS': { FOTO: [], DOCUMENTO: [] },
      CARGUE: { FOTO: [], DOCUMENTO: [] },
      'FACTURA PROFORMA': { FOTO: [], DOCUMENTO: [] }
    };

    result.rows.forEach(file => {
      if (grouped[file.folder] && grouped[file.folder][file.file_type]) {
        grouped[file.folder][file.file_type].push(file);
      }
    });

    res.json(grouped);
  } catch (error) {
    console.error('Error obteniendo archivos de compra:', error);
    res.status(500).json({ error: 'Error al obtener archivos' });
  }
});

// POST /api/purchase-files/:purchaseId - Subir archivo a una compra
router.post('/:purchaseId', canEditPurchases, upload.single('file'), async (req, res) => {
  try {
    console.log('📁 POST /api/purchase-files/:purchaseId - Subiendo archivo...');
    console.log('📦 Body:', req.body);
    console.log('📄 File:', req.file ? req.file.originalname : 'No file');
    
    const { purchaseId } = req.params;
    const { userId } = req.user;
    const { file_type, folder } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    if (!file_type || !['FOTO', 'DOCUMENTO'].includes(file_type)) {
      return res.status(400).json({ error: 'file_type debe ser FOTO o DOCUMENTO' });
    }

    if (!folder || !['LAVADO', 'SERIALES', 'DOCUMENTOS DEFINITIVOS', 'CARGUE', 'FACTURA PROFORMA'].includes(folder)) {
      return res.status(400).json({ error: 'folder debe ser: LAVADO, SERIALES, DOCUMENTOS DEFINITIVOS, CARGUE o FACTURA PROFORMA' });
    }

    // Verificar que la compra existe
    const purchaseCheck = await pool.query('SELECT id FROM purchases WHERE id = $1', [purchaseId]);
    if (purchaseCheck.rows.length === 0) {
      // Eliminar archivo físico de la carpeta temporal si la compra no existe
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Archivo temporal eliminado (compra no existe):', req.file.path);
      }
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const folderPath = folder.toLowerCase().replace(/\s+/g, '_');
    
    // Verificar que el archivo se guardó correctamente en la carpeta temporal
    console.log('🔍 Debug subida archivo:');
    console.log('  - req.file.path (temporal):', req.file.path);
    console.log('  - req.file.filename:', req.file.filename);
    console.log('  - folderPath:', folderPath);
    console.log('  - Archivo temporal existe:', fs.existsSync(req.file.path));
    
    // Mover el archivo de la carpeta temporal a la carpeta correcta
    const baseDir = path.join(process.cwd(), 'storage', 'purchases');
    const targetDir = path.join(baseDir, folderPath);
    const targetPath = path.join(targetDir, req.file.filename);
    
    // Asegurar que la carpeta destino existe
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log('✅ Carpeta destino creada:', targetDir);
    }
    
    // Mover el archivo
    if (fs.existsSync(req.file.path)) {
      fs.renameSync(req.file.path, targetPath);
      console.log('✅ Archivo movido de temporal a:', targetPath);
      console.log('  - Archivo destino existe:', fs.existsSync(targetPath));
    } else {
      throw new Error('El archivo temporal no existe');
    }
    
    const fileData = {
      purchase_id: purchaseId,
      file_name: req.file.originalname,
      file_path: `purchases/${folderPath}/${req.file.filename}`,
      file_type,
      folder,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      uploaded_by: userId
    };

    const result = await pool.query(
      `INSERT INTO purchase_files 
       (purchase_id, file_name, file_path, file_type, folder, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        fileData.purchase_id,
        fileData.file_name,
        fileData.file_path,
        fileData.file_type,
        fileData.folder,
        fileData.file_size,
        fileData.mime_type,
        fileData.uploaded_by
      ]
    );

    console.log('✅ Archivo de compras subido exitosamente:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error subiendo archivo de compras:', error);
    // Si falla, intentar eliminar el archivo de donde esté
    if (req.file) {
      try {
        // Si el archivo ya fue movido, intentar eliminarlo de la carpeta destino
        const folderPath = req.body.folder ? req.body.folder.toLowerCase().replace(/\s+/g, '_') : 'temp';
        const baseDir = path.join(process.cwd(), 'storage', 'purchases');
        const filePath = path.join(baseDir, folderPath, req.file.filename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('🗑️ Archivo eliminado de carpeta destino:', filePath);
        } else if (fs.existsSync(req.file.path)) {
          // Si aún está en la carpeta temporal
          fs.unlinkSync(req.file.path);
          console.log('🗑️ Archivo eliminado de carpeta temporal:', req.file.path);
        }
      } catch (cleanupError) {
        console.error('⚠️ Error al limpiar archivo:', cleanupError);
      }
    }
    res.status(500).json({ error: 'Error al subir archivo', details: error.message });
  }
});

// DELETE /api/purchase-files/:id - Eliminar archivo
router.delete('/:id', canEditPurchases, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    // Verificar que el archivo existe
    const fileCheck = await pool.query(
      'SELECT * FROM purchase_files WHERE id = $1',
      [id]
    );

    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const file = fileCheck.rows[0];

    // Verificar permisos: solo el que subió o admin
    if (file.uploaded_by !== userId && role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este archivo' });
    }

    // Eliminar archivo físico
    const folderPath = file.folder.toLowerCase().replace(/\s+/g, '_');
    const filePath = path.join(process.cwd(), 'storage', 'purchases', folderPath, path.basename(file.file_path));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Eliminar de la base de datos
    await pool.query('DELETE FROM purchase_files WHERE id = $1', [id]);

    res.json({ message: 'Archivo eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando archivo de compras:', error);
    res.status(500).json({ error: 'Error al eliminar archivo' });
  }
});

export default router;

