/**
 * Handler genérico para subida de archivos (folder + equipment_id).
 * Usado por POST /api/upload y POST /api/files/upload para evitar duplicación.
 */

import storageService from './storage.service.js';

const ALLOWED_UPLOAD_BUCKETS = new Set(['uploads', 'equipment-reservations']);

const getValidatedEquipmentId = (equipmentId) => {
  try {
    return storageService.ensurePathSegment(equipmentId, 'equipment_id');
  } catch (error) {
    console.warn('equipment_id inválido:', error?.message || error);
    return null;
  }
};

/**
 * Procesa subida genérica de archivo (bucket + equipment_id opcional).
 * @param {object} req - Request con req.file y req.body { folder, equipment_id }
 * @param {object} res - Response
 * @param {string} logPrefix - Prefijo para logs (ej: 'POST /api/upload')
 */
export async function handleGenericFileUpload(req, res, logPrefix = 'POST /upload') {
  try {
    console.log(`📁 ${logPrefix} - Subiendo archivo genérico...`);
    console.log('📦 Body:', req.body);
    console.log('📄 File:', req.file ? req.file.originalname : 'No file');

    if (!req.file) {
      console.log('❌ No se subió ningún archivo');
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const { folder, equipment_id } = req.body;

    let bucketName = 'uploads';
    if (folder) {
      if (!ALLOWED_UPLOAD_BUCKETS.has(folder)) {
        return res.status(400).json({ error: 'folder inválido' });
      }
      bucketName = folder;
    }

    const uniqueFileName = storageService.generateUniqueFileName(req.file.originalname);

    let safeEquipmentId = null;
    if (equipment_id) {
      safeEquipmentId = getValidatedEquipmentId(equipment_id);
      if (!safeEquipmentId) {
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
}
