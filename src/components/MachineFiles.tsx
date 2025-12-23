import { useEffect, useState } from 'react';
import { Image as ImageIcon, FileText, Download, Trash2, Upload, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { apiGet, apiUpload, apiDelete, API_URL } from '../services/api';
import { Button } from '../atoms/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { showSuccess, showError } from './Toast';

interface MachineFile {
  id: string;
  machine_id: string;
  file_name: string;
  file_path: string;
  file_type: 'FOTO' | 'DOCUMENTO';
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  uploaded_by_email?: string;
  scope?: 'GENERAL' | 'SUBASTA' | 'COMPRAS' | 'IMPORTACIONES' | 'LOGISTICA' | 'EQUIPOS' | 'SERVICIO' | 'CONSOLIDADO';
}

interface MachineFilesProps {
  machineId: string | null | undefined;
  purchaseId?: string | null; // ID del purchase o new_purchase
  tableName?: string; // 'purchases' o 'new_purchases' para identificar origen
  allowUpload?: boolean; // permite subir archivos
  allowDelete?: boolean; // permite eliminar archivos
  enablePhotos?: boolean; // muestra sección fotos
  enableDocs?: boolean; // muestra sección documentos
  uploadExtraFields?: Record<string, string>; // campos extra para adjuntar (p.ej. scope)
  currentScope?: string; // módulo actual (ej: 'COMPRAS', 'SUBASTA') - solo permite eliminar archivos de este scope
  hideOtherModules?: boolean; // oculta secciones de otros módulos (solo muestra archivos del currentScope)
}

export const MachineFiles = ({ machineId, purchaseId, tableName, allowUpload = false, allowDelete = true, enablePhotos = true, enableDocs = true, uploadExtraFields = {}, currentScope, hideOtherModules = false }: MachineFilesProps) => {
  const [photos, setPhotos] = useState<MachineFile[]>([]);
  const [docs, setDocs] = useState<MachineFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);
  const [docFiles, setDocFiles] = useState<FileList | null>(null);
  
  // Estado para modal de imagen ampliada
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
  // Estados para drag & drop
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);

  const loadFiles = async () => {
    // Para new_purchases usamos purchaseId, para el resto usamos machineId
    const fileId = tableName === 'new_purchases' ? purchaseId : machineId;
    
    if (!fileId) return;
    setLoading(true);
    try {
      // Cargar TODOS los archivos (sin filtrar por scope)
      // para que se puedan ver archivos de módulos anteriores
      const endpoint = tableName === 'new_purchases' 
        ? `/api/files/new-purchases/${fileId}`
        : `/api/files/${fileId}`;
      
      const all: MachineFile[] = await apiGet(endpoint);
      setPhotos(all.filter(f => f.file_type === 'FOTO'));
      setDocs(all.filter(f => f.file_type === 'DOCUMENTO'));
    } catch {
      setPhotos([]);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log(`🔧 MachineFiles inicializado - machineId: ${machineId}, purchaseId: ${purchaseId}, tableName: ${tableName}, currentScope: ${currentScope}`);
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, purchaseId, tableName]);

  // Función para determinar si un archivo puede ser eliminado
  // Solo se pueden eliminar archivos del módulo actual (currentScope)
  const canDeleteFile = (file: MachineFile): boolean => {
    // Si allowDelete es false, no se puede eliminar nada
    if (!allowDelete) return false;
    
    // Si no hay currentScope definido, aplicar allowDelete normal (comportamiento legacy)
    if (!currentScope) return allowDelete;
    
    // Si hay currentScope, solo se pueden eliminar archivos de ese scope
    // Los archivos sin scope se consideran del módulo anterior, no se pueden eliminar
    return file.scope === currentScope;
  };

  // Navegación con teclado
  useEffect(() => {
    if (!isImageModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevenir comportamiento por defecto para evitar que se dispare el submit del formulario
      if (e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
      }
      
      if (e.key === 'Escape') {
        closeImageModal();
      } else if (e.key === 'ArrowLeft') {
        navigateImage('prev');
      } else if (e.key === 'ArrowRight') {
        navigateImage('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Usar capture phase para interceptar antes
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isImageModalOpen, selectedImageIndex, photos.length]);

  const uploadSelected = async (type: 'FOTO' | 'DOCUMENTO', fileList?: FileList) => {
    if (!machineId) {
      showError('No hay ID de máquina disponible. Guarda primero el registro.');
      return;
    }
    
    const files = fileList || (type === 'FOTO' ? photoFiles : docFiles);
    if (!files || files.length === 0) {
      showError('Por favor selecciona archivos para subir');
      return;
    }
    
    setLoading(true);
    try {
      const uploadedCount = files.length;
      
      // Determinar el endpoint según el tableName
      const isNewPurchase = tableName === 'new_purchases';
      const endpoint = isNewPurchase ? `/api/files/new-purchases/${purchaseId}` : '/api/files';
      const idField = isNewPurchase ? 'new_purchase_id' : 'machine_id';
      const idValue = isNewPurchase ? purchaseId : machineId;
      
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append(idField, idValue!);
        fd.append('file_type', type);
        Object.entries(uploadExtraFields).forEach(([k, v]) => fd.append(k, v));
        
        console.log(`📤 Subiendo archivo: ${file.name}, ${idField}: ${idValue}, type: ${type}, scope: ${uploadExtraFields.scope || 'N/A'}`);
        await apiUpload(endpoint, fd);
      }
      
      await loadFiles();
      setPhotoFiles(null);
      setDocFiles(null);
      
      showSuccess(`✅ ${uploadedCount} archivo(s) subido(s) exitosamente`);
      console.log(`✅ ${uploadedCount} archivo(s) de tipo ${type} subidos correctamente`);
    } catch (error) {
      console.error('❌ Error al subir archivos:', error);
      showError(error instanceof Error ? error.message : 'Error al subir archivos');
    } finally {
      setLoading(false);
    }
  };

  // Funciones para drag & drop
  const handleDragOver = (e: React.DragEvent, type: 'FOTO' | 'DOCUMENTO') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'FOTO') {
      setIsDraggingPhoto(true);
    } else {
      setIsDraggingDoc(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent, type: 'FOTO' | 'DOCUMENTO') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'FOTO') {
      setIsDraggingPhoto(false);
    } else {
      setIsDraggingDoc(false);
    }
  };

  const handleDrop = async (e: React.DragEvent, type: 'FOTO' | 'DOCUMENTO') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (type === 'FOTO') {
      setIsDraggingPhoto(false);
    } else {
      setIsDraggingDoc(false);
    }

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      await uploadSelected(type, droppedFiles);
    }
  };

  const handleDelete = async (id: string) => {
    const endpoint = tableName === 'new_purchases' 
      ? `/api/files/new-purchases/${id}` 
      : `/api/files/${id}`;
    await apiDelete(endpoint);
    await loadFiles();
  };

  const downloadUrl = (id: string) => `${API_URL}/api/files/download/${id}`;

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
    if (direction === 'prev') {
      setSelectedImageIndex(selectedImageIndex === 0 ? photos.length - 1 : selectedImageIndex - 1);
    } else {
      setSelectedImageIndex(selectedImageIndex === photos.length - 1 ? 0 : selectedImageIndex + 1);
    }
  };

  // Mapeo de colores para etiquetas de módulo
  const getModuleLabel = (scope?: string) => {
    const labels = {
      'SUBASTA': { text: 'Subasta', color: 'bg-purple-100 text-purple-800 border-purple-300' },
      'COMPRAS': { text: 'Compras', color: 'bg-red-100 text-red-800 border-red-300' },
      'IMPORTACIONES': { text: 'Importaciones', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
      'LOGISTICA': { text: 'Logística', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      'EQUIPOS': { text: 'Equipos', color: 'bg-green-100 text-green-800 border-green-300' },
      'SERVICIO': { text: 'Servicio', color: 'bg-orange-100 text-orange-800 border-orange-300' },
      'GENERAL': { text: 'General', color: 'bg-gray-100 text-gray-800 border-gray-300' }
    };
    return labels[scope as keyof typeof labels] || labels['GENERAL'];
  };

  // Agrupar archivos por scope para mostrarlos separados
  const currentPhotos = photos.filter(p => p.scope === currentScope);
  // Filtrar otras fotos: solo las que tienen scope definido y diferente al currentScope
  const otherPhotos = photos.filter(p => p.scope && p.scope !== currentScope);
  const currentDocs = docs.filter(d => d.scope === currentScope);
  // Filtrar otros documentos: solo los que tienen scope definido y diferente al currentScope
  const otherDocs = docs.filter(d => d.scope && d.scope !== currentScope);
  
  // Verificar si se deben ocultar los módulos anteriores (para usuarios comerciales)
  const shouldHideOtherModules = hideOtherModules === true || hideOtherModules === 'true';

  const renderPhotoGrid = (photosList: MachineFile[], startIndex: number) => {
    if (photosList.length === 0) return null;
    
    return (
      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {photosList.map((p, idx) => {
          const index = startIndex + idx;
          const moduleLabel = getModuleLabel(p.scope);
          return (
            <motion.div 
              key={p.id} 
              className="relative group cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openImageModal(index)}
            >
              <div className="relative border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:border-brand-red transition-all">
                <img 
                  src={downloadUrl(p.id)} 
                  alt={p.file_name} 
                  className="w-full h-20 object-cover" 
                />
                {/* Etiqueta de módulo */}
                {p.scope && (
                  <div className={`absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${moduleLabel.color}`}>
                    {moduleLabel.text.substring(0, 3)}
                  </div>
                )}
                {/* Overlay con ícono de zoom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                  <div className="bg-white/90 px-2 py-1 rounded-md flex items-center gap-1">
                    <ZoomIn className="w-3 h-3 text-brand-red"/>
                    <span className="text-[10px] font-semibold text-brand-gray">Ampliar</span>
                  </div>
                </div>
              </div>
              {/* Botones de acción en hover - Solo si pertenece al módulo actual */}
              {canDeleteFile(p) && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('¿Eliminar esta foto?')) {
                      handleDelete(p.id);
                    }
                  }} 
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-700"
                >
                  <Trash2 className="w-3 h-3"/>
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ========== SECCIÓN 1: ARCHIVOS DEL MÓDULO ACTUAL ========== */}
      {currentScope && (
        <div className="space-y-4">
          {/* Fotos del módulo actual */}
          {enablePhotos && (
          <div 
            className={`bg-white border-2 rounded-lg p-4 transition-all ${
              isDraggingPhoto 
                ? 'border-brand-red border-dashed bg-red-50 shadow-lg' 
                : 'border-red-200'
            }`}
            onDragOver={(e) => allowUpload && handleDragOver(e, 'FOTO')}
            onDragLeave={(e) => allowUpload && handleDragLeave(e, 'FOTO')}
            onDrop={(e) => allowUpload && handleDrop(e, 'FOTO')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-brand-red" />
                <div>
                  <h4 className="text-sm font-bold text-brand-red">
                    📸 Fotos de {getModuleLabel(currentScope).text}
                  </h4>
                  <p className="text-xs text-gray-600">
                    {allowUpload ? 'Arrastra archivos aquí o haz clic para seleccionar' : 'Archivos subidos en este módulo'}
                  </p>
                </div>
              </div>
              {allowUpload && (
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    onChange={(e) => setPhotoFiles(e.target.files)}
                    className="text-xs"
                  />
                  <Button size="sm" disabled={!photoFiles || !machineId || loading} className="flex items-center gap-1 bg-brand-red hover:bg-primary-600">
                    <span onClick={() => uploadSelected('FOTO')} className="flex items-center gap-1">
                      <Upload className="w-4 h-4" /> Subir
                    </span>
                  </Button>
                </div>
              )}
            </div>

            {isDraggingPhoto && allowUpload && (
              <div className="border-2 border-dashed border-brand-red rounded-lg p-8 mb-3 bg-red-50 text-center">
                <Upload className="w-12 h-12 text-brand-red mx-auto mb-2" />
                <p className="text-brand-red font-semibold">Suelta las fotos aquí</p>
                <p className="text-xs text-gray-600">Se subirán automáticamente</p>
              </div>
            )}

            {loading && <p className="text-sm text-gray-500">Cargando...</p>}
            {currentPhotos.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Sin fotos en este módulo</p>
            ) : (
              renderPhotoGrid(currentPhotos, 0)
            )}
          </div>
          )}

          {/* Documentos del módulo actual */}
          {enableDocs && (
          <div 
            className={`bg-white border-2 rounded-lg p-4 transition-all ${
              isDraggingDoc 
                ? 'border-brand-red border-dashed bg-red-50 shadow-lg' 
                : 'border-red-200'
            }`}
            onDragOver={(e) => allowUpload && handleDragOver(e, 'DOCUMENTO')}
            onDragLeave={(e) => allowUpload && handleDragLeave(e, 'DOCUMENTO')}
            onDrop={(e) => allowUpload && handleDrop(e, 'DOCUMENTO')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-red" />
                <div>
                  <h4 className="text-sm font-bold text-brand-red">
                    📄 Documentos de {getModuleLabel(currentScope).text}
                  </h4>
                  <p className="text-xs text-gray-600">
                    {allowUpload ? 'Arrastra archivos aquí o haz clic para seleccionar' : 'Archivos subidos en este módulo'}
                  </p>
                </div>
              </div>
              {allowUpload && (
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    multiple 
                    accept="application/pdf,.doc,.docx,.xls,.xlsx,image/*" 
                    onChange={(e) => setDocFiles(e.target.files)}
                    className="text-xs"
                  />
                  <Button size="sm" disabled={!docFiles || !machineId || loading} className="flex items-center gap-1 bg-brand-red hover:bg-primary-600">
                    <span onClick={() => uploadSelected('DOCUMENTO')} className="flex items-center gap-1">
                      <Upload className="w-4 h-4" /> Subir
                    </span>
                  </Button>
                </div>
              )}
            </div>

            {isDraggingDoc && allowUpload && (
              <div className="border-2 border-dashed border-brand-red rounded-lg p-8 mb-3 bg-red-50 text-center">
                <Upload className="w-12 h-12 text-brand-red mx-auto mb-2" />
                <p className="text-brand-red font-semibold">Suelta los documentos aquí</p>
                <p className="text-xs text-gray-600">Se subirán automáticamente</p>
              </div>
            )}

            {currentDocs.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Sin documentos en este módulo</p>
            ) : (
              <ul className="divide-y divide-gray-200 rounded-lg border border-red-100">
                {currentDocs.map((d) => {
                  const moduleLabel = getModuleLabel(d.scope);
                  return (
                    <li key={d.id} className="flex items-center justify-between px-3 py-2 hover:bg-red-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-brand-red" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800">{d.file_name}</p>
                            {d.scope && (
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${moduleLabel.color}`}>
                                {moduleLabel.text}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{new Date(d.uploaded_at).toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={downloadUrl(d.id)} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs bg-white border border-gray-300 hover:border-brand-red rounded-md flex items-center gap-1 transition-colors">
                          <Download className="w-3.5 h-3.5"/>Descargar
                        </a>
                        {canDeleteFile(d) && (
                          <button onClick={() => handleDelete(d.id)} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center gap-1 transition-colors">
                            <Trash2 className="w-3.5 h-3.5"/>Borrar
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          )}
        </div>
      )}

      {/* ========== SECCIÓN 2: ARCHIVOS DE MÓDULOS ANTERIORES ========== */}
      {/* Solo mostrar si NO se deben ocultar los módulos anteriores (ocultar para usuarios comerciales) */}
      {/* Verificación estricta: solo mostrar si shouldHideOtherModules es explícitamente false */}
      {shouldHideOtherModules === false && (otherPhotos.length > 0 || otherDocs.length > 0) && (
        <div className="space-y-4">
          {/* Fotos de módulos anteriores */}
          {enablePhotos && otherPhotos.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-gray-50 border-2 border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                <div>
                  <h4 className="text-sm font-bold text-purple-700">
                    📁 Fotos de Módulos Anteriores
                  </h4>
                  <p className="text-xs text-gray-600">Solo lectura - No se pueden eliminar desde aquí</p>
                </div>
              </div>
              {renderPhotoGrid(otherPhotos, currentPhotos.length)}
            </div>
          )}

          {/* Documentos de módulos anteriores */}
          {enableDocs && otherDocs.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-gray-50 border-2 border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-purple-600" />
                <div>
                  <h4 className="text-sm font-bold text-purple-700">
                    📁 Documentos de Módulos Anteriores
                  </h4>
                  <p className="text-xs text-gray-600">Solo lectura - No se pueden eliminar desde aquí</p>
                </div>
              </div>
              <ul className="divide-y divide-gray-200 rounded-lg border border-purple-100">
                {otherDocs.map((d) => {
                  const moduleLabel = getModuleLabel(d.scope);
                  return (
                    <li key={d.id} className="flex items-center justify-between px-3 py-2 hover:bg-purple-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800">{d.file_name}</p>
                            {d.scope && (
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${moduleLabel.color}`}>
                                {moduleLabel.text}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{new Date(d.uploaded_at).toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={downloadUrl(d.id)} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs bg-white border border-gray-300 hover:border-purple-600 rounded-md flex items-center gap-1 transition-colors">
                          <Download className="w-3.5 h-3.5"/>Descargar
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Modal de Imagen Ampliada */}
      <AnimatePresence>
        {isImageModalOpen && selectedImageIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
            onClick={closeImageModal}
            onKeyDown={(e) => {
              // Prevenir que las teclas de flecha disparen el submit del formulario
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            tabIndex={-1}
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
              {selectedImageIndex + 1} / {photos.length}
            </div>

            {/* Botón Anterior */}
            {photos.length > 1 && (
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
            {photos.length > 1 && (
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
                  src={downloadUrl(photos[selectedImageIndex].id)}
                  alt={photos[selectedImageIndex].file_name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
                
                {/* Etiqueta de módulo */}
                {photos[selectedImageIndex].scope && (
                  <div className={`absolute top-4 left-4 px-3 py-1.5 text-sm font-semibold rounded-lg border-2 ${getModuleLabel(photos[selectedImageIndex].scope).color} backdrop-blur-sm`}>
                    {getModuleLabel(photos[selectedImageIndex].scope).text}
                  </div>
                )}
              </motion.div>

              {/* Panel de Información y Acciones - Separado de la Imagen */}
              <div className="bg-black/60 backdrop-blur-lg rounded-xl p-4 max-w-4xl w-full mx-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-white">
                  <div className="flex-1 text-center md:text-left">
                    <p className="font-semibold text-base mb-1">{photos[selectedImageIndex].file_name}</p>
                    <p className="text-sm text-gray-300">
                      Subido el {new Date(photos[selectedImageIndex].uploaded_at).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <a
                    href={downloadUrl(photos[selectedImageIndex].id)}
                    download
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg transition-all transform hover:scale-105 whitespace-nowrap"
                  >
                    <Download className="w-5 h-5" />
                    Descargar
                  </a>
                </div>
              </div>
            </div>

            {/* Navegación con teclado hint */}
            {photos.length > 1 && (
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


