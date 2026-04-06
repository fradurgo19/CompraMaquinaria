/**
 * Componente Gestor de Archivos (almacenamiento local / backend)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Trash2, Download, Image, FileText, X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
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

type UploadProgress = { current: number; total: number };

type PreparedUploadFiles = {
  files: File[];
  compressedCount: number;
  skippedBySizeCount: number;
};

type UploadBatchResult = {
  uploadedIds: string[];
  failedCount: number;
};

type DeleteBatchResult = {
  deletedCount: number;
  failedCount: number;
};

const MAX_SERVERLESS_SAFE_IMAGE_BYTES = Math.floor(3.5 * 1024 * 1024); // margen para multipart en Vercel
const MAX_IMAGE_DIMENSION_PX = 2048;
const INITIAL_JPEG_QUALITY = 0.82;
const MIN_JPEG_QUALITY = 0.46;
const DIMENSION_REDUCE_FACTOR = 0.82;
const MAX_COMPRESSION_ROUNDS = 4;

function isCompressibleImage(file: File): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/gif';
}

function buildCompressedImageName(originalName: string): string {
  const dotIndex = originalName.lastIndexOf('.');
  const base = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
  return `${base}.jpg`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new globalThis.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (error: string | Event) => {
      URL.revokeObjectURL(url);
      reject(
        error instanceof Error
          ? error
          : new Error(`No se pudo cargar la imagen "${file.name}"`)
      );
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function createCompressedFile(blob: Blob, originalName: string): File {
  return new File([blob], buildCompressedImageName(originalName), {
    type: 'image/jpeg',
    lastModified: Date.now()
  });
}

async function findBestJpegBlob(
  canvas: HTMLCanvasElement,
  currentBest: Blob | null
): Promise<{ safeBlob: Blob | null; bestBlob: Blob | null }> {
  let bestBlob = currentBest;
  let safeBlob: Blob | null = null;

  for (let quality = INITIAL_JPEG_QUALITY; quality >= MIN_JPEG_QUALITY; quality -= 0.12) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!blob) continue;
    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
    if (blob.size <= MAX_SERVERLESS_SAFE_IMAGE_BYTES) {
      safeBlob = blob;
      break;
    }
  }

  return { safeBlob, bestBlob };
}

async function compressImageForUpload(file: File): Promise<File> {
  if (!isCompressibleImage(file) || file.size <= MAX_SERVERLESS_SAFE_IMAGE_BYTES) return file;

  const image = await loadImageFromFile(file);
  const longestSide = Math.max(image.width, image.height);
  const initialScale = longestSide > MAX_IMAGE_DIMENSION_PX ? MAX_IMAGE_DIMENSION_PX / longestSide : 1;
  let targetWidth = Math.max(1, Math.round(image.width * initialScale));
  let targetHeight = Math.max(1, Math.round(image.height * initialScale));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  let bestBlob: Blob | null = null;

  for (let round = 0; round < MAX_COMPRESSION_ROUNDS; round++) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const result = await findBestJpegBlob(canvas, bestBlob);
    bestBlob = result.bestBlob;
    if (result.safeBlob) {
      return createCompressedFile(result.safeBlob, file.name);
    }

    targetWidth = Math.max(1, Math.round(targetWidth * DIMENSION_REDUCE_FACTOR));
    targetHeight = Math.max(1, Math.round(targetHeight * DIMENSION_REDUCE_FACTOR));
  }

  if (bestBlob && bestBlob.size < file.size) {
    return createCompressedFile(bestBlob, file.name);
  }

  return file;
}

async function prepareFilesForUpload(
  originalFiles: File[],
  fileType: 'FOTO' | 'DOCUMENTO'
): Promise<PreparedUploadFiles> {
  if (fileType !== 'FOTO') {
    return {
      files: originalFiles,
      compressedCount: 0,
      skippedBySizeCount: 0
    };
  }

  let compressedCount = 0;
  const processedFiles = await Promise.all(
    originalFiles.map(async (file) => {
      try {
        const compressed = await compressImageForUpload(file);
        if (compressed !== file) compressedCount += 1;
        return compressed;
      } catch {
        return file;
      }
    })
  );

  const filesWithinLimit = processedFiles.filter((file) => file.size <= MAX_SERVERLESS_SAFE_IMAGE_BYTES);
  return {
    files: filesWithinLimit,
    compressedCount,
    skippedBySizeCount: processedFiles.length - filesWithinLimit.length
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveUploadErrorMessage(errorMessage: string): string {
  if (errorMessage.includes('413') || errorMessage.includes('Payload Too Large') || errorMessage.includes('Content Too Large')) {
    return 'Una o más fotos superan el límite permitido por el servidor (413). Reduce tamaño o resolución e intenta de nuevo.';
  }
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'Error de permisos (403). Verifica que tengas permisos para subir archivos o intenta recargar la página.';
  }
  return errorMessage;
}

function resolveUploadFeedback(uploadedCount: number, failedCount: number, skippedBySizeCount: number): string | null {
  if (failedCount === 0) {
    if (skippedBySizeCount > 0) {
      return `${skippedBySizeCount} archivo(s) se omitieron por tamaño. Reduce tamaño o usa formato JPG.`;
    }
    return null;
  }
  if (uploadedCount > 0) {
    return `⚠️ ${uploadedCount} archivo(s) subidos, pero ${failedCount} fallaron. Verifica tamaño/permisos y reintenta.`;
  }
  return '❌ Error al subir archivos. Verifica tamaño, permisos y formato.';
}

async function uploadFilesInBatches(args: {
  files: File[];
  machineId: string;
  fileType: 'FOTO' | 'DOCUMENTO';
  onProgress: (current: number, total: number) => void;
}): Promise<UploadBatchResult> {
  const { files, machineId, fileType, onProgress } = args;
  const BATCH_SIZE = 5;
  const uploadedIds: string[] = [];
  let failedCount = 0;
  let completedCount = 0;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (file) => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('machine_id', machineId);
        formData.append('file_type', fileType);
        const response = await apiUpload<{ id?: string }>('/api/files', formData);
        return response?.id ?? null;
      } catch (error) {
        console.error(`❌ Error subiendo archivo ${file.name}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach((id) => {
      if (id) {
        uploadedIds.push(id);
      } else {
        failedCount += 1;
      }
      completedCount += 1;
    });
    onProgress(completedCount, files.length);

    if (i + BATCH_SIZE < files.length) {
      await wait(300);
    }
  }

  return { uploadedIds, failedCount };
}

async function deleteFilesInBatches(fileIds: string[]): Promise<DeleteBatchResult> {
  const BATCH_SIZE = 10;
  let deletedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < fileIds.length; i += BATCH_SIZE) {
    const batch = fileIds.slice(i, i + BATCH_SIZE);
    const deleteResults = await Promise.allSettled(batch.map((fileId) => apiDelete(`/api/files/${fileId}`)));

    deleteResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        deletedCount += 1;
      } else {
        failedCount += 1;
      }
    });

    if (i + BATCH_SIZE < fileIds.length) {
      await wait(150);
    }
  }

  return { deletedCount, failedCount };
}

export const FileManager = ({ machineId, model, serial, onClose }: FileManagerProps) => {
  const [activeTab, setActiveTab] = useState<'FOTO' | 'DOCUMENTO'>('FOTO');
  const [files, setFiles] = useState<MachineFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para modal de imagen ampliada
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<MachineFile[]>(`/api/files/${machineId}`);
      setFiles(data ?? []);
    } catch (err) {
      console.error('Error cargando archivos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar archivos');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    loadFiles();
  }, [machineId, activeTab, loadFiles]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const originalFiles = Array.from(selectedFiles);
    setLoading(true);
    setError(null);

    try {
      const prepared = await prepareFilesForUpload(originalFiles, activeTab);
      const filesToUpload = prepared.files;

      if (filesToUpload.length === 0) {
        setError('Las fotos seleccionadas superan el tamaño permitido para el servidor. Reduce tamaño o resolución e intenta de nuevo.');
        return;
      }

      setUploadProgress({ current: 0, total: filesToUpload.length });

      const uploadResult = await uploadFilesInBatches({
        files: filesToUpload,
        machineId,
        fileType: activeTab,
        onProgress: (current, total) => setUploadProgress({ current, total })
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await loadFiles();

      const feedback = resolveUploadFeedback(
        uploadResult.uploadedIds.length,
        uploadResult.failedCount,
        prepared.skippedBySizeCount
      );
      if (feedback) {
        setError(feedback);
      }

      if (uploadResult.uploadedIds.length > 0) {
        console.log(`✅ ${uploadResult.uploadedIds.length} archivo(s) subido(s) exitosamente`);
      }
      if (prepared.compressedCount > 0 && uploadResult.failedCount === 0) {
        console.log(`🗜️ ${prepared.compressedCount} foto(s) comprimida(s) antes de subir`);
      }
    } catch (err) {
      console.error('❌ Error al subir archivo(s):', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al subir archivo(s)';
      setError(resolveUploadErrorMessage(errorMessage));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setLoading(false);
      setUploadProgress(null);
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

  const handleDeleteAllPhotos = async () => {
    const photosToDelete = files.filter((file) => file.file_type === 'FOTO');
    if (photosToDelete.length === 0) return;

    const confirmed = confirm(
      `¿Eliminar TODAS las fotos (${photosToDelete.length})?\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const result = await deleteFilesInBatches(photosToDelete.map((file) => file.id));
      await loadFiles();

      if (result.failedCount > 0) {
        const message = result.deletedCount > 0
          ? `Se eliminaron ${result.deletedCount} foto(s), pero ${result.failedCount} no se pudieron eliminar.`
          : 'No se pudieron eliminar las fotos. Intenta nuevamente.';
        setError(message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar todas las fotos');
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

  const getFileUrl = (file: MachineFile) => {
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

  const displayFiles = files.filter((f) => f.file_type === activeTab);

  const closeImageModal = useCallback(() => {
    setIsImageModalOpen(false);
    setSelectedImageIndex(null);
  }, []);

  const navigateImage = useCallback(
    (direction: 'prev' | 'next') => {
      if (selectedImageIndex === null) return;
      const photoFiles = files.filter((f) => f.file_type === activeTab && isImageFile(f.file_name));
      if (direction === 'prev') {
        setSelectedImageIndex(selectedImageIndex === 0 ? photoFiles.length - 1 : selectedImageIndex - 1);
      } else {
        setSelectedImageIndex(selectedImageIndex === photoFiles.length - 1 ? 0 : selectedImageIndex + 1);
      }
    },
    [selectedImageIndex, files, activeTab]
  );

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

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [isImageModalOpen, closeImageModal, navigateImage]);

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
        <div className="flex items-center gap-2">
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
          {activeTab === 'FOTO' && displayFiles.length > 0 && (
            <Button
              onClick={handleDeleteAllPhotos}
              disabled={loading}
              size="sm"
              type="button"
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
              title="Eliminar todas las fotos de esta máquina"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar todas
            </Button>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {displayFiles.length} archivo(s)
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (() => {
          const fileTypeLabel = activeTab === 'FOTO' ? 'fotos' : 'archivos';
          const message = uploadProgress
            ? `Subiendo ${uploadProgress.current} de ${uploadProgress.total} ${fileTypeLabel}...`
            : 'Cargando...';
          return (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
              <p className="text-gray-600 mt-2">{message}</p>
            </div>
          );
        })()}

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
            <button
              type="button"
              className="w-full h-full flex flex-col items-center justify-center px-4 py-16 bg-transparent border-0 cursor-default text-left"
              onClick={(e) => e.stopPropagation()}
            >
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
            </button>

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
