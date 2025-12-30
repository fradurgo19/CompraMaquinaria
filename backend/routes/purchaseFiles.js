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
import storageService from '../services/storage.service.js';

const router = express.Router();

// Configuración de Multer para almacenamiento en memoria (se subirá a Supabase Storage)
const storage = multer.memoryStorage();

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
    
    // Si está en producción y usa Supabase Storage, redirigir a la URL pública
    if (process.env.NODE_ENV === 'production' || process.env.SUPABASE_STORAGE_ENABLED === 'true') {
      // file_path puede venir como "purchases/folder/filename" o solo "folder/filename"
      // Necesitamos extraer la ruta relativa dentro del bucket
      let filePathInBucket = file.file_path;
      if (filePathInBucket.startsWith('purchases/')) {
        filePathInBucket = filePathInBucket.replace('purchases/', '');
      }
      const publicUrl = storageService.getPublicUrl('purchase-files', filePathInBucket);
      return res.redirect(publicUrl);
    }
    
    // Desarrollo local: servir desde disco
    const folderPath = file.folder.toLowerCase().replace(/\s+/g, '_');
    const fileName = path.basename(file.file_path);
    const filePath = path.join(process.cwd(), 'storage', 'purchases', folderPath, fileName);

    if (!fs.existsSync(filePath)) {
      const altPath = path.join(process.cwd(), 'storage', file.file_path);
      if (fs.existsSync(altPath)) {
        const finalPath = path.resolve(altPath);
        if (file.file_type === 'FOTO' || file.mime_type?.startsWith('image/')) {
          res.setHeader('Content-Type', file.mime_type || 'image/jpeg');
          res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
          return res.sendFile(finalPath);
        } else {
          return res.download(finalPath, file.file_name);
        }
      }
      return res.status(404).json({ error: 'Archivo físico no encontrado' });
    }

    const finalPath = path.resolve(filePath);
    if (file.file_type === 'FOTO' || file.mime_type?.startsWith('image/')) {
      res.setHeader('Content-Type', file.mime_type || 'image/jpeg');
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
      res.sendFile(finalPath);
    } else {
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
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    // Generar nombre único para el archivo
    const fileExtension = path.extname(req.file.originalname);
    const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
    
    // Subir archivo usando storageService (Supabase Storage o local)
    const bucketName = 'purchase-files';
    const folderPath = folder.toLowerCase().replace(/\s+/g, '_');
    const subFolder = `purchase-${purchaseId}/${folderPath}`;
    
    const { url, path: filePath } = await storageService.uploadFile(
      req.file.buffer,
      uniqueFileName,
      bucketName,
      subFolder
    );
    
    const fileData = {
      purchase_id: purchaseId,
      file_name: req.file.originalname,
      file_path: filePath, // Ruta relativa dentro del bucket
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
    res.status(201).json({ ...result.rows[0], url }); // Incluir URL pública
  } catch (error) {
    console.error('❌ Error subiendo archivo de compras:', error);
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

    // Eliminar archivo usando storageService
    try {
      // file_path puede venir como "purchases/folder/filename" o solo "folder/filename"
      let filePathInBucket = file.file_path;
      if (filePathInBucket.startsWith('purchases/')) {
        filePathInBucket = filePathInBucket.replace('purchases/', '');
      }
      await storageService.deleteFile('purchase-files', filePathInBucket);
    } catch (deleteError) {
      console.warn('⚠️ Error eliminando archivo físico (puede que ya no exista):', deleteError.message);
      // Continuar con la eliminación de la BD aunque falle la eliminación física
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

