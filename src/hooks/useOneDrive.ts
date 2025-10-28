/**
 * Hook personalizado para gestión de OneDrive
 */

import { useState, useEffect } from 'react';
import oneDriveService from '../services/onedrive';

export function useOneDrive() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    setIsAuthenticated(oneDriveService.isAuthenticated());
  }, []);

  const authenticate = async () => {
    setIsAuthenticating(true);
    try {
      await oneDriveService.authenticate();
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error en autenticación OneDrive:', error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = () => {
    oneDriveService.logout();
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    isAuthenticating,
    authenticate,
    logout
  };
}

export function useOneDriveFiles(model?: string, serial?: string, subfolder?: 'Fotos' | 'Documentos') {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async () => {
    if (!model || !serial) return;

    setLoading(true);
    setError(null);

    try {
      const filesList = await oneDriveService.listFiles(model, serial, subfolder);
      setFiles(filesList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar archivos');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, targetSubfolder: 'Fotos' | 'Documentos') => {
    if (!model || !serial) throw new Error('Modelo y serial requeridos');

    setLoading(true);
    setError(null);

    try {
      await oneDriveService.uploadFile(model, serial, file, targetSubfolder);
      await loadFiles(); // Recargar lista
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    setLoading(true);
    setError(null);

    try {
      await oneDriveService.deleteFile(fileId);
      await loadFiles(); // Recargar lista
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar archivo');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async () => {
    if (!model || !serial) throw new Error('Modelo y serial requeridos');

    setLoading(true);
    setError(null);

    try {
      await oneDriveService.createMachineFolder(model, serial);
      await loadFiles(); // Recargar lista
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear carpeta');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (model && serial && oneDriveService.isAuthenticated()) {
      loadFiles();
    }
  }, [model, serial, subfolder]);

  return {
    files,
    loading,
    error,
    loadFiles,
    uploadFile,
    deleteFile,
    createFolder
  };
}


