/**
 * Componente de Archivos Privados de Compras
 * Sistema de carpetas: LAVADO, SERIALES, DOCUMENTOS DEFINITIVOS, CARGUE
 * Solo visible para usuarios de compras (eliana, gerencia, admin)
 */

import { useEffect, useState, useCallback } from 'react';
import { Image as ImageIcon, FileText, Download, Trash2, Upload, X, ChevronLeft, ChevronRight, ChevronDown, ZoomIn } from 'lucide-react';
import { apiGet, apiUpload, apiDelete, API_URL } from '../services/api';
import { Button } from '../atoms/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { showSuccess, showError } from './Toast';
import { useAuth } from '../context/AuthContext';

interface PurchaseFile {
  id: string;
  purchase_id: string;
  file_name: string;
  file_path: string;
  file_type: 'FOTO' | 'DOCUMENTO';
  folder: 'LAVADO' | 'SERIALES' | 'DOCUMENTOS DEFINITIVOS' | 'CARGUE' | 'FACTURA PROFORMA';
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  uploaded_by_email?: string;
  uploaded_by_name?: string;
}

interface PurchaseFilesProps {
  purchaseId: string | null | undefined;
  allowUpload?: boolean;
  allowDelete?: boolean;
}

const FOLDERS = [
  { value: 'LAVADO', label: 'LAVADO', icon: '🧼' },
  { value: 'SERIALES', label: 'SERIALES', icon: '🔢' },
  { value: 'DOCUMENTOS DEFINITIVOS', label: 'DOCUMENTOS DEFINITIVOS', icon: '📋' },
  { value: 'CARGUE', label: 'CARGUE', icon: '📦' },
  { value: 'FACTURA PROFORMA', label: 'FACTURA PROFORMA', icon: '📄' }
] as const;

const DEFAULT_FILES_STATE: Record<string, { FOTO: PurchaseFile[]; DOCUMENTO: PurchaseFile[] }> = {
  LAVADO: { FOTO: [], DOCUMENTO: [] },
  SERIALES: { FOTO: [], DOCUMENTO: [] },
  'DOCUMENTOS DEFINITIVOS': { FOTO: [], DOCUMENTO: [] },
  CARGUE: { FOTO: [], DOCUMENTO: [] },
  'FACTURA PROFORMA': { FOTO: [], DOCUMENTO: [] }
};

export const PurchaseFiles = ({ purchaseId, allowUpload = true, allowDelete = true }: PurchaseFilesProps) => {
  const { userProfile } = useAuth();
  
  // Mostrar para usuarios de compras (pueden editar) o usuarios de importaciones (solo lectura)
  // También permitir a sdonado@partequiposusa.com ver archivos privados
  const userEmail = userProfile?.email?.toLowerCase() || '';
  const canView = userProfile?.role === 'eliana' || userProfile?.role === 'gerencia' || userProfile?.role === 'admin' || 
                  userEmail === 'sdonado@partequiposusa.com' ||
                  (userProfile?.role === 'importaciones' && !allowUpload && !allowDelete);
  
  const [files, setFiles] = useState<Record<string, { FOTO: PurchaseFile[]; DOCUMENTO: PurchaseFile[] }>>({
    LAVADO: { FOTO: [], DOCUMENTO: [] },
    SERIALES: { FOTO: [], DOCUMENTO: [] },
    'DOCUMENTOS DEFINITIVOS': { FOTO: [], DOCUMENTO: [] },
    CARGUE: { FOTO: [], DOCUMENTO: [] },
    'FACTURA PROFORMA': { FOTO: [], DOCUMENTO: [] }
  });
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [fileInputs, setFileInputs] = useState<Record<string, FileList | null>>({});
  
  // Estado para modal de imagen ampliada
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [currentImageFolder, setCurrentImageFolder] = useState<string>('LAVADO');
  
  // Estado para cache de URLs de imágenes (blob URLs)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const loadFiles = useCallback(async () => {
    if (!purchaseId) return;
    setLoading(true);
    try {
      const data = await apiGet<Record<string, { FOTO: PurchaseFile[]; DOCUMENTO: PurchaseFile[] }>>(
        `/api/purchase-files/${purchaseId}`
      );
      setFiles(data ?? DEFAULT_FILES_STATE);
    } catch (err) {
      console.error('Error cargando archivos de compras:', err);
      setFiles(DEFAULT_FILES_STATE);
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileSelect = (folder: string, fileType: 'FOTO' | 'DOCUMENTO', e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      setFileInputs(prev => ({ ...prev, [`${folder}-${fileType}`]: fileList }));
    }
  };

  const showUploadResultMessage = (failedCount: number, successCount: number) => {
    if (failedCount === 0) {
      showSuccess(`✅ ${successCount} archivo(s) subido(s) exitosamente`);
    } else if (successCount > 0) {
      showError(`⚠️ ${successCount} archivo(s) subido(s), pero ${failedCount} fallaron. Verifica los permisos y reintenta.`);
    } else {
      showError('❌ Error al subir archivos. Verifica que tengas permisos y que los archivos sean válidos.');
    }
  };

  const showUploadErrorMessage = (errorMessage: string) => {
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      showError('Error de permisos (403). Verifica que tengas permisos para subir archivos. Recarga la página si el problema persiste.');
    } else {
      showError(errorMessage);
    }
  };

  const uploadOneFile = async (
    purchaseIdArg: string,
    file: File,
    folder: string,
    fileType: 'FOTO' | 'DOCUMENTO'
  ): Promise<{ success: boolean; id?: string; url?: string | null }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_type', fileType);
      formData.append('folder', folder);
      const response = await apiUpload<{ id?: string; url?: string }>(
        `/api/purchase-files/${purchaseIdArg}`,
        formData
      );
      if (response?.id) {
        return { success: true, id: response.id, url: response.url ?? null };
      }
      return { success: false };
    } catch (error) {
      console.error(`❌ Error subiendo archivo ${file.name}:`, error);
      return { success: false };
    }
  };

  const uploadFiles = async (folder: string, fileType: 'FOTO' | 'DOCUMENTO') => {
    if (!purchaseId) {
      showError('No hay ID de compra disponible');
      return;
    }

    const key = `${folder}-${fileType}`;
    const fileList = fileInputs[key];
    if (!fileList || fileList.length === 0) {
      showError('Por favor selecciona archivos para subir');
      return;
    }

    setLoading(true);
    try {
      const filesArray = Array.from(fileList);
      const uploadedFileIds: string[] = [];
      let failedCount = 0;
      const BATCH_SIZE = 5;

      for (let i = 0; i < filesArray.length; i += BATCH_SIZE) {
        const batch = filesArray.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((file) => uploadOneFile(purchaseId, file, folder, fileType))
        );

        batchResults.forEach((result) => {
          if (result.success && result.id) {
            uploadedFileIds.push(result.id);
            const id = result.id;
            const url = result.url;
            if (fileType === 'FOTO' && id && url) {
              setImageUrls((prev) => ({ ...prev, [id]: url }));
            }
          } else {
            failedCount++;
          }
        });

        if (i + BATCH_SIZE < filesArray.length) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      setFileInputs((prev) => ({ ...prev, [key]: null }));
      
      // Recargar archivos después de la subida
      await loadFiles();
      
      // Cargar imágenes inmediatamente después de subirlas (solo las que no se cargaron automáticamente)
      if (fileType === 'FOTO' && uploadedFileIds.length > 0) {
        console.log('🖼️ Cargando imágenes recién subidas:', uploadedFileIds);
        // Esperar un momento para que el servidor procese los archivos
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Cargar solo las imágenes que no tienen URL en cache
        const photosToLoad = uploadedFileIds.filter(id => !imageUrls[id]);
        if (photosToLoad.length > 0) {
          const loadPromises = photosToLoad.map(async (fileId) => {
            try {
              const url = await getImageUrl(fileId);
              if (url) {
                setImageUrls(prev => ({ ...prev, [fileId]: url }));
                console.log('✅ Imagen cargada:', fileId);
              }
            } catch (error) {
              console.error('❌ Error cargando imagen:', fileId, error);
            }
          });
          
          await Promise.all(loadPromises);
        }
      }
      
      showUploadResultMessage(failedCount, uploadedFileIds.length);
    } catch (err) {
      console.error('❌ Error subiendo archivos:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al subir archivos';
      showUploadErrorMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`¿Eliminar ${fileName}?`)) return;

    setLoading(true);
    try {
      await apiDelete(`/api/purchase-files/${fileId}`);
      await loadFiles();
      showSuccess('Archivo eliminado exitosamente');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error al eliminar archivo');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDownloadUrl = (fileId: string) => `${API_URL}/api/purchase-files/download/${fileId}`;

  /** Descarga un archivo enviando el token en la misma pestaña; evita que se descargue el JSON de error 401. */
  const downloadFileWithAuth = async (fileId: string, fileName: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      showError('Necesitas iniciar sesión para descargar.');
      return;
    }
    try {
      const response = await fetch(getDownloadUrl(fileId), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'follow'
      });
      if (!response.ok) {
        const text = await response.text();
        let message = 'No se pudo descargar el archivo.';
        try {
          const json = JSON.parse(text) as { error?: string };
          if (json?.error) message = json.error;
        } catch {
          if (text) message = text;
        }
        showError(message);
        return;
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'archivo';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error al descargar:', err);
      showError(err instanceof Error ? err.message : 'Error al descargar el archivo.');
    }
  };

  // Función para obtener URL de imagen con autenticación (blob URL)
  const getImageUrl = async (fileId: string): Promise<string> => {
    // Si ya tenemos la URL en cache, usarla
    if (imageUrls[fileId]) {
      console.log('📦 Usando imagen en cache:', fileId);
      return imageUrls[fileId];
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ No hay token de autenticación');
        return '';
      }
      
      console.log('🔄 Cargando imagen:', fileId);
      const downloadUrl = `${API_URL}/api/purchase-files/download/${fileId}`;
      console.log('  - URL:', downloadUrl);
      
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('  - Status:', response.status);
      console.log('  - Content-Type:', response.headers.get('Content-Type'));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error al cargar imagen:', response.status, errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const blob = await response.blob();
      console.log('  - Blob size:', blob.size, 'bytes');
      console.log('  - Blob type:', blob.type);
      
      if (!blob || blob.size === 0) {
        console.error('❌ Blob vacío o inválido');
        return '';
      }
      
      const url = URL.createObjectURL(blob);
      console.log('  - Blob URL creada:', url.substring(0, 50) + '...');
      
      // Guardar en cache
      setImageUrls(prev => ({ ...prev, [fileId]: url }));
      
      console.log('✅ Imagen cargada exitosamente:', fileId);
      return url;
    } catch (error) {
      console.error('❌ Error al cargar imagen:', fileId, error);
      return ''; // Retornar string vacío si falla
    }
  };
  
  // Limpiar blob URLs al desmontar
  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach((url) => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imageUrls]);
  
  // Cargar imágenes cuando se cargan los archivos
  useEffect(() => {
    if (purchaseId && Object.keys(files).length > 0) {
      console.log('📸 Cargando imágenes automáticamente...');
      // Cargar todas las imágenes de todas las carpetas
      const allPhotos: PurchaseFile[] = [];
      Object.values(files).forEach(folderFiles => {
        allPhotos.push(...folderFiles.FOTO);
      });
      
      console.log('  - Total de fotos encontradas:', allPhotos.length);
      
      // Cargar imágenes en paralelo, pero solo las que no están en cache
      const photosToLoad = allPhotos.filter((photo) => !imageUrls[photo.id]);
      console.log('  - Fotos a cargar:', photosToLoad.length);
      
      if (photosToLoad.length > 0) {
        const loadPromises = photosToLoad.map((photo) => loadAndCachePhoto(photo.id));
        Promise.all(loadPromises).then((results) => {
          const loaded = results.filter((r) => r != null).length;
          console.log(`✅ ${loaded}/${photosToLoad.length} imágenes cargadas`);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, purchaseId]);

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folder)) {
        newSet.delete(folder);
      } else {
        newSet.add(folder);
      }
      return newSet;
    });
  };

  // Funciones para modal de imagen
  const openImageModal = (folder: string, _fileType: 'FOTO' | 'DOCUMENTO', index: number) => {
    setCurrentImageFolder(folder);
    setSelectedImageIndex(index);
    setIsImageModalOpen(true);
    
    // Asegurar que la imagen esté cargada
    const currentImages = files[folder]?.FOTO || [];
    if (currentImages[index] && !imageUrls[currentImages[index].id]) {
      getImageUrl(currentImages[index].id).then(url => {
        if (url) {
          setImageUrls(prev => ({ ...prev, [currentImages[index].id]: url }));
        }
      });
    }
  };

  const getCurrentImages = (): PurchaseFile[] => files[currentImageFolder]?.FOTO ?? [];

  const closeImageModal = useCallback(() => {
    setIsImageModalOpen(false);
    setSelectedImageIndex(null);
    setCurrentImageFolder('LAVADO');
  }, []);

  const navigateImage = useCallback(
    (direction: 'prev' | 'next') => {
      const currentImages = files[currentImageFolder]?.FOTO ?? [];
      if (selectedImageIndex === null || currentImages.length === 0) return;

      let newIndex: number;
      if (direction === 'prev') {
        newIndex = selectedImageIndex === 0 ? currentImages.length - 1 : selectedImageIndex - 1;
      } else {
        newIndex = selectedImageIndex === currentImages.length - 1 ? 0 : selectedImageIndex + 1;
      }

      setSelectedImageIndex(newIndex);

      const nextPhoto = currentImages[newIndex];
      if (nextPhoto && !imageUrls[nextPhoto.id]) {
        getImageUrl(nextPhoto.id).then((url) => {
          if (url) {
            setImageUrls((prev) => ({ ...prev, [nextPhoto.id]: url }));
          }
        });
      }
    },
    // getImageUrl omitted to avoid callback churn; it is stable in practice
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentImageFolder, files, selectedImageIndex, imageUrls]
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

  const loadAndCachePhoto = (photoId: string): Promise<string | null> =>
    getImageUrl(photoId)
      .then((url) => {
        if (url) setImageUrls((prev) => ({ ...prev, [photoId]: url }));
        return url;
      })
      .catch((error) => {
        console.error('Error cargando foto:', photoId, error);
        return null;
      });

  const handlePhotoLoadError = (photoId: string) => {
    console.error('Error cargando imagen:', photoId);
    getImageUrl(photoId).then((url) => {
      if (url) {
        setImageUrls((prev) => ({ ...prev, [photoId]: url }));
      }
    });
  };

  const renderPhotoGrid = (photos: PurchaseFile[], folder: string) => {
    if (photos.length === 0) return null;

    return (
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
        {photos.map((photo, idx) => {
          const imgSrc = imageUrls[photo.id] ?? '';

          return (
            <motion.div
              key={photo.id}
              className="relative group cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openImageModal(folder, 'FOTO', idx)}
            >
              <div className="relative border border-gray-300 rounded-md overflow-hidden shadow-sm hover:shadow-md hover:border-[#cf1b22] transition-all">
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={photo.file_name}
                    className="w-full h-16 object-cover"
                    onError={() => handlePhotoLoadError(photo.id)}
                  />
                ) : (
                  <div className="w-full h-16 bg-gray-200 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-gray-400 animate-pulse" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-0.5">
                  <div className="bg-white/90 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <ZoomIn className="w-2.5 h-2.5 text-[#cf1b22]"/>
                    <span className="text-[9px] font-semibold text-gray-700">Ver</span>
                  </div>
                </div>
                {allowDelete && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (globalThis.confirm('¿Eliminar esta foto?')) {
                        handleDelete(photo.id, photo.file_name);
                      }
                    }} 
                    className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-2.5 h-2.5"/>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  // No mostrar si el usuario no tiene permisos
  if (!canView) {
    return null;
  }

  if (!purchaseId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">Guarda primero el registro de compra para poder subir archivos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {FOLDERS.map((folder) => {
        const isExpanded = expandedFolders.has(folder.value);
        const folderFiles = files[folder.value] || { FOTO: [], DOCUMENTO: [] };
        const hasFiles = folderFiles.FOTO.length > 0 || folderFiles.DOCUMENTO.length > 0;

        return (
          <div key={folder.value} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Header de Carpeta */}
            <button
              onClick={() => toggleFolder(folder.value)}
              className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                )}
                <div className="text-left">
                  <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <span>{folder.icon}</span>
                    {folder.label}
                  </h4>
                  <p className="text-[10px] text-gray-500">
                    {folderFiles.FOTO.length} foto(s) • {folderFiles.DOCUMENTO.length} documento(s)
                  </p>
                </div>
              </div>
              {hasFiles && (
                <span className="px-2 py-0.5 bg-[#cf1b22] text-white text-[10px] font-semibold rounded-full">
                  {folderFiles.FOTO.length + folderFiles.DOCUMENTO.length}
                </span>
              )}
            </button>

            {/* Contenido de Carpeta */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 space-y-3">
                    {/* Sección FOTOS */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-gray-600" />
                          <h5 className="text-xs font-semibold text-gray-700">📸 Fotos</h5>
                        </div>
                        {allowUpload && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="file"
                              multiple
                              accept=".png,.jpg,.jpeg,.PNG,.JPG,.JPEG"
                              onChange={(e) => handleFileSelect(folder.value, 'FOTO', e)}
                              className="text-[10px]"
                            />
                            <Button
                              size="sm"
                              disabled={!fileInputs[`${folder.value}-FOTO`] || loading}
                              onClick={() => uploadFiles(folder.value, 'FOTO')}
                              className="flex items-center gap-1 bg-[#cf1b22] hover:bg-[#a01419] text-xs px-2 py-1"
                            >
                              <Upload className="w-3 h-3" /> Subir
                            </Button>
                          </div>
                        )}
                      </div>
                      {loading && <p className="text-xs text-gray-500">Cargando...</p>}
                      {folderFiles.FOTO.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">Sin fotos en esta carpeta</p>
                      ) : (
                        renderPhotoGrid(folderFiles.FOTO, folder.value)
                      )}
                    </div>

                    {/* Sección DOCUMENTOS */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-gray-600" />
                          <h5 className="text-xs font-semibold text-gray-700">📄 Documentos</h5>
                        </div>
                        {allowUpload && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="file"
                              multiple
                              accept=".pdf,application/pdf,.doc,.docx,.xls,.xlsx"
                              onChange={(e) => handleFileSelect(folder.value, 'DOCUMENTO', e)}
                              className="text-[10px]"
                            />
                            <Button
                              size="sm"
                              disabled={!fileInputs[`${folder.value}-DOCUMENTO`] || loading}
                              onClick={() => uploadFiles(folder.value, 'DOCUMENTO')}
                              className="flex items-center gap-1 bg-[#cf1b22] hover:bg-[#a01419] text-xs px-2 py-1"
                            >
                              <Upload className="w-3 h-3" /> Subir
                            </Button>
                          </div>
                        )}
                      </div>
                      {folderFiles.DOCUMENTO.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">Sin documentos en esta carpeta</p>
                      ) : (
                        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                          {folderFiles.DOCUMENTO.map((doc) => (
                            <li key={doc.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-100 transition-colors">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-gray-600" />
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-800">{doc.file_name}</p>
                                  <p className="text-[10px] text-gray-500">
                                    {formatFileSize(doc.file_size)} • {new Date(doc.uploaded_at).toLocaleString('es-CO')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => downloadFileWithAuth(doc.id, doc.file_name)}
                                  className="px-2 py-1 text-[10px] bg-white border border-gray-300 hover:border-[#cf1b22] rounded-md flex items-center gap-1 transition-colors"
                                >
                                  <Download className="w-3 h-3"/>Descargar
                                </button>
                                {allowDelete && (
                                  <button
                                    onClick={() => handleDelete(doc.id, doc.file_name)}
                                    className="px-2 py-1 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center gap-1 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3"/>Borrar
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

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
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all z-10 backdrop-blur-sm"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-semibold">
              {selectedImageIndex + 1} / {getCurrentImages().length}
            </div>

            {getCurrentImages().length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage('prev');
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all backdrop-blur-sm"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage('next');
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all backdrop-blur-sm"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            <button
              type="button"
              className="w-full h-full flex flex-col items-center justify-center px-4 py-16 bg-transparent border-0 cursor-default text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                key={selectedImageIndex}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative flex items-center justify-center mb-4 max-w-[85vw] max-h-[65vh]"
              >
                {imageUrls[getCurrentImages()[selectedImageIndex].id] ? (
                  <img
                    src={imageUrls[getCurrentImages()[selectedImageIndex].id]}
                    alt={getCurrentImages()[selectedImageIndex].file_name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-200 flex items-center justify-center rounded-lg">
                    <ImageIcon className="w-16 h-16 text-gray-400 animate-pulse" />
                  </div>
                )}
              </motion.div>

              <div className="bg-black/60 backdrop-blur-lg rounded-xl p-4 max-w-4xl w-full mx-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-white">
                  <div className="flex-1 text-center md:text-left">
                    <p className="font-semibold text-base mb-1">{getCurrentImages()[selectedImageIndex].file_name}</p>
                    <p className="text-sm text-gray-300">
                      Carpeta: {currentImageFolder} • Subido el {new Date(getCurrentImages()[selectedImageIndex].uploaded_at).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const current = getCurrentImages()[selectedImageIndex];
                      downloadFileWithAuth(current.id, current.file_name);
                    }}
                    className="bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg transition-all transform hover:scale-105 whitespace-nowrap"
                  >
                    <Download className="w-5 h-5" />
                    Descargar
                  </button>
                </div>
              </div>
            </button>

            {getCurrentImages().length > 1 && (
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

