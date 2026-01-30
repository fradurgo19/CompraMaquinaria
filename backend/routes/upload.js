/**
 * Rutas de Upload Genérico
 * Maneja subidas de archivos genéricas (reservas de equipos, etc.)
 * En desarrollo: almacenamiento local
 * En producción: Supabase Storage
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import storageService from '../services/storage.service.js';

const router = express.Router();

const ALLOWED_UPLOAD_BUCKETS = new Set(['uploads', 'equipment-reservations']);

// Configuración de Multer para almacenamiento temporal (se subirá a Supabase o local después)
const storage = multer.memoryStorage(); // Usar memoria para poder subir a Supabase

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

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * POST /api/upload
 * Ruta genérica para subir archivos
 * Almacena archivos localmente y devuelve la URL
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    console.log('📁 POST /api/upload - Subiendo archivo genérico...');
    console.log('📦 Body:', req.body);
    console.log('📄 File:', req.file ? req.file.originalname : 'No file');
    
    if (!req.file) {
      console.log('❌ No se subió ningún archivo');
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const { folder, equipment_id } = req.body;
    
    // Determinar el bucket basado en el folder
    let bucketName = 'uploads'; // Default
    if (folder) {
      if (!ALLOWED_UPLOAD_BUCKETS.has(folder)) {
        return res.status(400).json({ error: 'folder inválido' });
      }
      bucketName = folder;
    }

    // Generar nombre único para el archivo
    const uniqueFileName = storageService.generateUniqueFileName(req.file.originalname);

    // Subir usando el servicio de almacenamiento
    // Si hay equipment_id, crear subcarpeta para organizar por equipo
    let safeEquipmentId = null;
    if (equipment_id) {
      try {
        safeEquipmentId = storageService.ensurePathSegment(equipment_id, 'equipment_id');
      } catch (pathError) {
        return res.status(400).json({ error: 'equipment_id inválido' });
      }
    }
    const subFolder = safeEquipmentId ? `equipment-${safeEquipmentId}` : null;
    
    const { url, path: filePath } = await storageService.uploadFile(
      req.file.buffer,
      uniqueFileName,
      bucketName,
      subFolder
    );
    
    console.log('✅ Archivo subido exitosamente:', {
      originalName: req.file.originalname,
      filename: uniqueFileName,
      size: req.file.size,
      url,
      path: filePath,
      bucket: bucketName
    });

    res.status(200).json({
      url,
      path: filePath,
      filename: uniqueFileName,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Error subiendo archivo genérico:', error);
    res.status(500).json({ error: 'Error al subir archivo', details: error.message });
  }
});

export default router;

