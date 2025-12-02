/**
 * Rutas de Archivos (Files)
 * Maneja uploads, descargas y eliminación de fotos/documentos
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Configuración de Multer para almacenamiento local
// En producción cambiar a Supabase Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'storage', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
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

// Todas las rutas requieren autenticación EXCEPTO descarga
// (La autenticación de descarga se maneja en la ruta específica)

// GET /api/files/download/:id - Descargar archivo (sin autenticación JWT)
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM machine_files WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const file = result.rows[0];
    const filePath = path.join(process.cwd(), 'storage', file.file_path);

    if (!fs.existsSync(filePath)) {
      console.log('❌ Archivo físico no encontrado:', filePath);
      return res.status(404).json({ error: 'Archivo físico no encontrado' });
    }

    console.log('✅ Sirviendo archivo:', file.file_name);
    res.download(filePath, file.file_name);
  } catch (error) {
    console.error('Error descargando archivo:', error);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// POST /api/files - Subir archivo
router.post('/', upload.single('file'), async (req, res) => {
  try {
    console.log('📁 POST /api/files - Subiendo archivo...');
    console.log('📦 Body:', req.body);
    console.log('📄 File:', req.file ? req.file.originalname : 'No file');
    
    const { userId } = req.user;
    const { machine_id, file_type, scope } = req.body;

    if (!req.file) {
      console.log('❌ No se subió ningún archivo');
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    if (!machine_id || !file_type) {
      console.log('❌ Faltan machine_id o file_type:', { machine_id, file_type });
      return res.status(400).json({ error: 'machine_id y file_type son requeridos' });
    }

    if (!['FOTO', 'DOCUMENTO'].includes(file_type)) {
      console.log('❌ file_type inválido:', file_type);
      return res.status(400).json({ error: 'file_type debe ser FOTO o DOCUMENTO' });
    }

    const fileData = {
      machine_id,
      file_name: req.file.originalname,
      file_path: `uploads/${req.file.filename}`, // Sin la barra inicial
      file_type,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      uploaded_by: userId,
      scope: scope && ['GENERAL', 'SUBASTA', 'COMPRAS', 'IMPORTACIONES', 'LOGISTICA', 'EQUIPOS', 'SERVICIO'].includes(scope) ? scope : 'GENERAL'
    };

    const result = await pool.query(
      `INSERT INTO machine_files 
       (machine_id, file_name, file_path, file_type, file_size, mime_type, uploaded_by, scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        fileData.machine_id,
        fileData.file_name,
        fileData.file_path,
        fileData.file_type,
        fileData.file_size,
        fileData.mime_type,
        fileData.uploaded_by,
        fileData.scope
      ]
    );

    console.log('✅ Archivo subido exitosamente:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error subiendo archivo:', error);
    // Si falla la inserción, eliminar el archivo subido
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Error al subir archivo', details: error.message });
  }
});

// GET /api/files/:machine_id - Obtener archivos de una máquina
router.get('/:machine_id', async (req, res) => {
  try {
    const { machine_id } = req.params;
    const { file_type, scope } = req.query; // Filtros opcionales

    let query = `
      SELECT f.*, 
             m.model as machine_model, 
             m.serial as machine_serial,
             u.email as uploaded_by_email
      FROM machine_files f
      JOIN machines m ON f.machine_id = m.id
      LEFT JOIN auth.users u ON f.uploaded_by = u.id
      WHERE f.machine_id = $1
    `;

    const params = [machine_id];
    let paramIndex = 2;

    if (file_type && ['FOTO', 'DOCUMENTO'].includes(file_type)) {
      query += ` AND f.file_type = $${paramIndex}`;
      params.push(file_type);
      paramIndex++;
    }

    if (scope && ['GENERAL', 'SUBASTA', 'COMPRAS', 'IMPORTACIONES', 'LOGISTICA', 'EQUIPOS', 'SERVICIO'].includes(scope)) {
      query += ` AND f.scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }

    query += ' ORDER BY f.uploaded_at DESC';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo archivos:', error);
    res.status(500).json({ error: 'Error al obtener archivos' });
  }
});

// GET /api/files/by-module/:machine_id - Obtener archivos agrupados por módulo
router.get('/by-module/:machine_id', async (req, res) => {
  try {
    const { machine_id } = req.params;

    const result = await pool.query(`
      SELECT 
        f.scope as module,
        f.file_type,
        json_agg(json_build_object(
          'id', f.id,
          'file_name', f.file_name,
          'file_path', f.file_path,
          'file_size', f.file_size,
          'mime_type', f.mime_type,
          'uploaded_at', f.uploaded_at,
          'uploaded_by', f.uploaded_by,
          'uploaded_by_email', u.email
        ) ORDER BY f.uploaded_at DESC) as files,
        COUNT(*) as total_files
      FROM machine_files f
      LEFT JOIN auth.users u ON f.uploaded_by = u.id
      WHERE f.machine_id = $1
      GROUP BY f.scope, f.file_type
      ORDER BY f.scope, f.file_type
    `, [machine_id]);

    // Reorganizar resultado en estructura más útil
    const grouped = {};
    result.rows.forEach(row => {
      if (!grouped[row.module]) {
        grouped[row.module] = {
          FOTO: [],
          DOCUMENTO: []
        };
      }
      grouped[row.module][row.file_type] = row.files;
    });

    res.json(grouped);
  } catch (error) {
    console.error('Error obteniendo archivos por módulo:', error);
    res.status(500).json({ error: 'Error al obtener archivos por módulo' });
  }
});

// DELETE /api/files/:id - Eliminar archivo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    // Verificar que el archivo existe
    const fileCheck = await pool.query(
      'SELECT * FROM machine_files WHERE id = $1',
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
    const filePath = path.join(process.cwd(), 'storage', file.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Eliminar de la base de datos
    await pool.query('DELETE FROM machine_files WHERE id = $1', [id]);

    res.json({ message: 'Archivo eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando archivo:', error);
    res.status(500).json({ error: 'Error al eliminar archivo' });
  }
});

// =====================================================
// ENDPOINTS PARA NEW_PURCHASE_FILES (Sistema separado para equipos NUEVOS)
// =====================================================

/**
 * GET /api/files/new-purchases/:newPurchaseId
 * Obtener archivos de una compra nueva
 */
router.get('/new-purchases/:newPurchaseId', authenticateToken, async (req, res) => {
  try {
    const { newPurchaseId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        npf.*,
        up.email as uploaded_by_email,
        up.full_name as uploaded_by_name
      FROM new_purchase_files npf
      LEFT JOIN users_profile up ON npf.uploaded_by = up.id
      WHERE npf.new_purchase_id = $1
      ORDER BY npf.file_type, npf.uploaded_at DESC
    `, [newPurchaseId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo archivos de compra nueva:', error);
    res.status(500).json({ error: 'Error al obtener archivos' });
  }
});

/**
 * POST /api/files/new-purchases/:newPurchaseId
 * Subir archivos a una compra nueva
 */
router.post('/new-purchases/:newPurchaseId', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { newPurchaseId } = req.params;
    const files = req.files;
    const userId = req.user.id;
    const { file_type, scope = 'COMPRAS_NUEVOS' } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron archivos' });
    }

    const uploadedFiles = [];

    for (const file of files) {
      const result = await pool.query(`
        INSERT INTO new_purchase_files (
          new_purchase_id, file_name, file_path, file_type,
          file_size, mime_type, uploaded_by, scope
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        newPurchaseId,
        file.originalname,
        `uploads/${file.filename}`,
        file_type || 'DOCUMENTO',
        file.size,
        file.mimetype,
        userId,
        scope
      ]);

      uploadedFiles.push(result.rows[0]);
    }

    res.status(201).json({
      message: 'Archivos subidos exitosamente',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Error subiendo archivos de compra nueva:', error);
    res.status(500).json({ error: 'Error al subir archivos' });
  }
});

/**
 * DELETE /api/files/new-purchases/:fileId
 * Eliminar archivo de compra nueva
 */
router.delete('/new-purchases/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    // Verificar que existe
    const fileCheck = await pool.query(
      'SELECT * FROM new_purchase_files WHERE id = $1',
      [fileId]
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
    const filePath = path.join(process.cwd(), 'storage', file.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Eliminar de la base de datos
    await pool.query('DELETE FROM new_purchase_files WHERE id = $1', [fileId]);

    res.json({ message: 'Archivo eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando archivo de compra nueva:', error);
    res.status(500).json({ error: 'Error al eliminar archivo' });
  }
});

/**
 * POST /api/files/upload
 * Ruta genérica para subir archivos (usada por EquipmentReservationForm y otros)
 * Almacena archivos localmente y devuelve la URL
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('📁 POST /api/files/upload - Subiendo archivo genérico...');
    console.log('📦 Body:', req.body);
    console.log('📄 File:', req.file ? req.file.originalname : 'No file');
    
    if (!req.file) {
      console.log('❌ No se subió ningún archivo');
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const { folder, equipment_id } = req.body;
    
    // Construir la URL del archivo
    // En desarrollo: URL local, en producción podría ser Cloudinary o Supabase Storage
    const fileUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/uploads/${req.file.filename}`;
    
    // También guardar la ruta relativa para referencia
    const filePath = `uploads/${req.file.filename}`;

    console.log('✅ Archivo subido exitosamente:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      url: fileUrl,
      path: filePath
    });

    res.status(200).json({
      url: fileUrl,
      path: filePath,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Error subiendo archivo genérico:', error);
    // Si falla, eliminar el archivo subido
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error eliminando archivo temporal:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Error al subir archivo', details: error.message });
  }
});

export default router;
