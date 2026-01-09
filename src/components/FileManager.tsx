/**
 * Componente Gestor de Archivos
 * Reemplaza OneDriveManager para uso local
 */

import { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Download, Image, FileText, X, Cloud, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../atoms/Button';
import { apiGet, apiUpload, apiDelete } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

interface MachineFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: 'FOTO' | 'DOCUMENTO';
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
  machine_model: string;
  machine_serial: string;
}

interface FileManagerProps {
  machineId: string;
  model: string;
  serial: string;
  onClose?: () => void;
}

export const FileManager = ({ machineId, model, serial, onClose }: FileManagerProps) => {
  const [activeTab, setActiveTab] = useState<'FOTO' | 'DOCUMENTO'>('FOTO');
  const [files, setFiles] = useState<MachineFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para modal de imagen ampliada
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [machineId, activeTab]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar todos los archivos una vez, no solo por tipo, para tener el estado completo
      const data = await apiGet<MachineFile[]>(`/api/files/${machineId}`);
      setFiles(data || []);
    } catch (err) {
      console.error('Error cargando archivos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar archivos');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const filesArray = Array.from(selectedFiles);
      
      // Optimización: Subir archivos en lotes pequeños para evitar sobrecarga
      const BATCH_SIZE = 5; // Subir 5 archivos a la vez
      const uploadedIds: string[] = [];
      
      for (let i = 0; i < filesArray.length; i += BATCH_SIZE) {
        const batch = filesArray.slice(i, i + BATCH_SIZE);
        
        // Subir batch en paralelo
        const batchPromises = batch.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('machine_id', machineId);
          formData.append('file_type', activeTab);

          const response = await apiUpload('/api/files', formData);
          return response?.id || null;
        });
        
        const batchResults = await Promise.all(batchPromises);
        uploadedIds.push(...batchResults.filter(id => id !== null) as string[]);
        
        // Pequeña pausa entre lotes para evitar sobrecargar el servidor
        if (i + BATCH_SIZE < filesArray.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Recargar archivos después de la subida
      await loadFiles();
      
      // Mostrar éxito
      if (uploadedIds.length > 0) {
        console.log(`✅ ${uploadedIds.length} archivo(s) subido(s) exitosamente`);
      }
    } catch (err) {
      console.error('❌ Error al subir archivo(s):', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al subir archivo(s)';
      setError(errorMessage);
      
      // Si hay error 403, mostrar mensaje más descriptivo
      if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        setError('Error de permisos (403). Verifica que tengas permisos para subir archivos o intenta recargar la página.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`¿Eliminar ${fileName}?`)) return;

    setLoading(true);
    try {
      await apiDelete(`/api/files/${fileId}`);
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar archivo');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImageFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
  };

  const getFileUrl = (file: any) => {
    // Siempre usar el endpoint de descarga que maneja correctamente Supabase Storage
    // Este endpoint redirige a la URL pública de Supabase si el bucket es público
    // o maneja la autenticación si el bucket es privado
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return `${apiUrl}/api/files/download/${file.id}`;
  };

  const getDownloadUrl = (fileId: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return `${apiUrl}/api/files/download/${fileId}`;
  };

  // Funciones para modal de imagen
  const openImageModal = (index: number) => {
    setSelectedImageIndex(index);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImageIndex(null);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedImageIndex === null) return;
    const photoFiles = displayFiles.filter(f => isImageFile(f.file_name));
    if (direction === 'prev') {
      setSelectedImageIndex(selectedImageIndex === 0 ? photoFiles.length - 1 : selectedImageIndex - 1);
    } else {
      setSelectedImageIndex(selectedImageIndex === photoFiles.length - 1 ? 0 : selectedImageIndex + 1);
    }
  };

  // Navegación con teclado
  useEffect(() => {
    if (!isImageModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeImageModal();
      } else if (e.key === 'ArrowLeft') {
        navigateImage('prev');
      } else if (e.key === 'ArrowRight') {
        navigateImage('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImageModalOpen, selectedImageIndex]);

  const displayFiles = files.filter(f => f.file_type === activeTab);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Archivos de Máquina</h3>
          <p className="text-sm text-gray-600">{model} - {serial}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('FOTO')}
          className={`flex-1 px-4 py-3 font-medium transition ${
            activeTab === 'FOTO'
              ? 'text-brand-red border-b-2 border-brand-red bg-red-50'
              : 'text-brand-gray hover:bg-gray-50'
          }`}
        >
          <Image className="w-4 h-4 inline mr-2" />
          Fotos
        </button>
        <button
          onClick={() => setActiveTab('DOCUMENTO')}
          className={`flex-1 px-4 py-3 font-medium transition ${
            activeTab === 'DOCUMENTO'
              ? 'text-brand-red border-b-2 border-brand-red bg-red-50'
              : 'text-brand-gray hover:bg-gray-50'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Documentos
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept={activeTab === 'FOTO' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx'}
            multiple={activeTab === 'FOTO'}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            size="sm"
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Subir {activeTab === 'FOTO' ? 'Fotos' : 'Documento'}
          </Button>
        </div>
        <div className="text-sm text-gray-600">
          {displayFiles.length} archivo(s)
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            <p className="text-gray-600 mt-2">Cargando...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {!loading && displayFiles.length === 0 && (
          <div className="text-center py-12">
            {activeTab === 'FOTO' ? (
              <Image className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            ) : (
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            )}
            <p className="text-gray-500">
              No hay {activeTab.toLowerCase()} todavía
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Sube archivos usando el botón de arriba
            </p>
          </div>
        )}

        {!loading && displayFiles.length > 0 && (
          <>
            {/* Vista de Fotos */}
            {activeTab === 'FOTO' && (
              <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {displayFiles.map((file, index) => (
                  <motion.div
                    key={file.id}
                    className="relative group cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => isImageFile(file.file_name) && openImageModal(index)}
                  >
                    <div className="relative border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:border-brand-red transition-all">
                      {isImageFile(file.file_name) ? (
                        <img
                          src={getFileUrl(file)}
                          alt={file.file_name}
                          className="w-full h-20 object-cover"
                        />
                      ) : (
                        <div className="w-full h-20 bg-gray-100 flex items-center justify-center">
                          <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      {/* Overlay con ícono de zoom */}
                      {isImageFile(file.file_name) && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                          <div className="bg-white/90 px-2 py-1 rounded-md flex items-center gap-1">
                            <ZoomIn className="w-3 h-3 text-brand-red" />
                            <span className="text-[10px] font-semibold text-brand-gray">Ampliar</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Botón de eliminar */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.id, file.file_name);
                      }}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Vista de Documentos */}
            {activeTab === 'DOCUMENTO' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayFiles.map((file) => (
                  <div
                    key={file.id}
                    className="border rounded-lg p-3 hover:shadow-md transition bg-white"
                  >
                    {/* Preview */}
                    <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                      <FileText className="w-12 h-12 text-gray-400" />
                    </div>

                    {/* File Info */}
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-800 truncate" title={file.file_name}>
                        {file.file_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.file_size)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                      <a
                        href={getDownloadUrl(file.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 px-2 py-1 bg-gradient-to-r from-brand-red to-primary-600 text-white rounded hover:from-primary-600 hover:to-primary-700 transition text-center text-xs font-semibold"
                        title="Abrir documento en nueva pestaña"
                      >
                        <Download className="w-3 h-3 inline" />
                      </a>
                      <button
                        onClick={() => handleDelete(file.id, file.file_name)}
                        className="flex-1 px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition text-xs"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3 inline" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-gray-50 border-t text-xs text-gray-600 text-center">
        <Cloud className="w-4 h-4 inline mr-1" />
        Archivos almacenados localmente
      </div>

      {/* Modal de Imagen Ampliada */}
      <AnimatePresence>
        {isImageModalOpen && selectedImageIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
            onClick={closeImageModal}
          >
            {/* Botón Cerrar */}
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all z-10 backdrop-blur-sm"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Contador de imágenes */}
            <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-semibold">
              {selectedImageIndex + 1} / {displayFiles.filter(f => isImageFile(f.file_name)).length}
            </div>

            {/* Botón Anterior */}
            {displayFiles.filter(f => isImageFile(f.file_name)).length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('prev');
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all backdrop-blur-sm"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {/* Botón Siguiente */}
            {displayFiles.filter(f => isImageFile(f.file_name)).length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('next');
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all backdrop-blur-sm"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            {/* Contenedor Principal con Imagen e Información Separados */}
            <div className="w-full h-full flex flex-col items-center justify-center px-4 py-16" onClick={(e) => e.stopPropagation()}>
              {/* Imagen Principal */}
              <motion.div
                key={selectedImageIndex}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative flex items-center justify-center mb-4 max-w-[85vw] max-h-[65vh]"
              >
                <img
                  src={getFileUrl(displayFiles[selectedImageIndex])}
                  alt={displayFiles[selectedImageIndex].file_name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              </motion.div>

              {/* Panel de Información y Acciones - Separado de la Imagen */}
              <div className="bg-black/60 backdrop-blur-lg rounded-xl p-4 max-w-4xl w-full mx-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-white">
                  <div className="flex-1 text-center md:text-left">
                    <p className="font-semibold text-base mb-1">{displayFiles[selectedImageIndex].file_name}</p>
                    <p className="text-sm text-gray-300">
                      {formatFileSize(displayFiles[selectedImageIndex].file_size)} • Subido el {new Date(displayFiles[selectedImageIndex].uploaded_at).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={getDownloadUrl(displayFiles[selectedImageIndex].id)}
                      download={displayFiles[selectedImageIndex].file_name}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg transition-all transform hover:scale-105 whitespace-nowrap"
                    >
                      <Download className="w-5 h-5" />
                      Descargar
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeImageModal();
                        handleDelete(displayFiles[selectedImageIndex].id, displayFiles[selectedImageIndex].file_name);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg transition-all transform hover:scale-105 whitespace-nowrap"
                    >
                      <Trash2 className="w-5 h-5" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Navegación con teclado hint */}
            {displayFiles.filter(f => isImageFile(f.file_name)).length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs">
                Usa las flechas ← → para navegar
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
