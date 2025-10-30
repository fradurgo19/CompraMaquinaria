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
      scope: scope && ['GENERAL','LOGISTICA'].includes(scope) ? scope : 'GENERAL'
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
    const { file_type } = req.query; // Filtro opcional: FOTO o DOCUMENTO

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

    if (file_type && ['FOTO', 'DOCUMENTO'].includes(file_type)) {
      query += ' AND f.file_type = $2';
      params.push(file_type);
    }

    query += ' ORDER BY f.uploaded_at DESC';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo archivos:', error);
    res.status(500).json({ error: 'Error al obtener archivos' });
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

export default router;
