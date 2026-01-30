/**
 * Rutas de Upload Genérico
 * Maneja subidas de archivos genéricas (reservas de equipos, etc.)
 * En desarrollo: almacenamiento local
 * En producción: Supabase Storage
 */

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { authenticateToken } from '../middleware/auth.js';
import { handleGenericFileUpload } from '../services/genericUploadHandler.js';

const router = express.Router();

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

router.use(authenticateToken);

/**
 * POST /api/upload
 * Ruta genérica para subir archivos
 */
router.post('/', upload.single('file'), (req, res) =>
  handleGenericFileUpload(req, res, 'POST /api/upload')
);

export default router;
