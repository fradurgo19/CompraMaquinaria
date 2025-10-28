/**
 * Rutas para gestión de OneDrive
 */

import express from 'express';
import multer from 'multer';
import oneDriveService from '../services/onedrive.service.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Configurar multer para manejar uploads en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB máximo
  }
});

// Middleware de autenticación
router.use(authenticateToken);

/**
 * POST /api/onedrive/create-folder
 * Crear carpeta para una máquina
 */
router.post('/create-folder', async (req, res) => {
  try {
    const { model, serial, accessToken } = req.body;
    
    if (!model || !serial) {
      return res.status(400).json({ error: 'Modelo y serial son requeridos' });
    }

    if (!accessToken) {
      return res.status(401).json({ error: 'Token de OneDrive requerido' });
    }

    const folder = await oneDriveService.createMachineFolder(accessToken, model, serial);
    
    res.json({
      success: true,
      folder: {
        id: folder.id,
        name: folder.name,
        webUrl: folder.webUrl
      }
    });
  } catch (error) {
    console.error('Error creando carpeta:', error);
    res.status(500).json({ error: 'Error al crear carpeta en OneDrive' });
  }
});

/**
 * POST /api/onedrive/upload
 * Subir archivo a OneDrive
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { model, serial, subfolder, accessToken } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    if (!model || !serial) {
      return res.status(400).json({ error: 'Modelo y serial son requeridos' });
    }

    if (!accessToken) {
      return res.status(401).json({ error: 'Token de OneDrive requerido' });
    }

    // Construir ruta de la carpeta
    const basePath = `/MaquinariaUsada/${model} - ${serial}`;
    const folderPath = subfolder ? `${basePath}/${subfolder}` : basePath;

    const uploadedFile = await oneDriveService.uploadFile(
      accessToken,
      folderPath,
      file.originalname,
      file.buffer,
      file.mimetype
    );

    res.json({
      success: true,
      file: {
        id: uploadedFile.id,
        name: uploadedFile.name,
        size: uploadedFile.size,
        webUrl: uploadedFile.webUrl
      }
    });
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

/**
 * GET /api/onedrive/files/:model/:serial
 * Listar archivos de una máquina
 */
router.get('/files/:model/:serial', async (req, res) => {
  try {
    const { model, serial } = req.params;
    const { subfolder, accessToken } = req.query;

    if (!accessToken) {
      return res.status(401).json({ error: 'Token de OneDrive requerido' });
    }

    const basePath = `/MaquinariaUsada/${model} - ${serial}`;
    const folderPath = subfolder ? `${basePath}/${subfolder}` : basePath;

    const files = await oneDriveService.listFiles(accessToken, folderPath);

    res.json({
      success: true,
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        createdDateTime: f.createdDateTime,
        webUrl: f.webUrl,
        downloadUrl: f['@microsoft.graph.downloadUrl'],
        isFolder: !!f.folder,
        isFile: !!f.file
      }))
    });
  } catch (error) {
    console.error('Error listando archivos:', error);
    res.status(500).json({ error: 'Error al listar archivos' });
  }
});

/**
 * GET /api/onedrive/folder/:model/:serial
 * Obtener información de la carpeta de una máquina
 */
router.get('/folder/:model/:serial', async (req, res) => {
  try {
    const { model, serial } = req.params;
    const { accessToken } = req.query;

    if (!accessToken) {
      return res.status(401).json({ error: 'Token de OneDrive requerido' });
    }

    const folder = await oneDriveService.getMachineFolder(accessToken, model, serial);

    if (!folder) {
      return res.json({
        success: true,
        exists: false,
        folder: null
      });
    }

    res.json({
      success: true,
      exists: true,
      folder: {
        id: folder.id,
        name: folder.name,
        webUrl: folder.webUrl,
        createdDateTime: folder.createdDateTime
      }
    });
  } catch (error) {
    console.error('Error obteniendo carpeta:', error);
    res.status(500).json({ error: 'Error al obtener carpeta' });
  }
});

/**
 * DELETE /api/onedrive/file/:fileId
 * Eliminar un archivo
 */
router.delete('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(401).json({ error: 'Token de OneDrive requerido' });
    }

    const success = await oneDriveService.deleteFile(accessToken, fileId);

    res.json({ success });
  } catch (error) {
    console.error('Error eliminando archivo:', error);
    res.status(500).json({ error: 'Error al eliminar archivo' });
  }
});

/**
 * GET /api/onedrive/search
 * Buscar carpetas de máquinas
 */
router.get('/search', async (req, res) => {
  try {
    const { term, accessToken } = req.query;

    if (!accessToken) {
      return res.status(401).json({ error: 'Token de OneDrive requerido' });
    }

    const folders = await oneDriveService.searchMachineFolders(accessToken, term || '');

    res.json({
      success: true,
      folders: folders.map(f => ({
        id: f.id,
        name: f.name,
        webUrl: f.webUrl,
        createdDateTime: f.createdDateTime
      }))
    });
  } catch (error) {
    console.error('Error buscando carpetas:', error);
    res.status(500).json({ error: 'Error al buscar carpetas' });
  }
});

/**
 * POST /api/onedrive/share/:fileId
 * Obtener link para compartir un archivo
 */
router.post('/share/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(401).json({ error: 'Token de OneDrive requerido' });
    }

    const shareUrl = await oneDriveService.getShareLink(accessToken, fileId);

    if (!shareUrl) {
      return res.status(500).json({ error: 'Error al crear link para compartir' });
    }

    res.json({
      success: true,
      shareUrl
    });
  } catch (error) {
    console.error('Error compartiendo archivo:', error);
    res.status(500).json({ error: 'Error al compartir archivo' });
  }
});

export default router;

