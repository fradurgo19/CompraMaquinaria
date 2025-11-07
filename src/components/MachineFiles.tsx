import { useEffect, useState } from 'react';
import { Image as ImageIcon, FileText, Download, Trash2, Upload, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { apiGet, apiUpload, apiDelete, API_URL } from '../services/api';
import { Button } from '../atoms/Button';
import { motion, AnimatePresence } from 'framer-motion';

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
  scope?: 'GENERAL' | 'LOGISTICA' | 'EQUIPOS' | 'SERVICIO';
}

interface MachineFilesProps {
  machineId: string | null | undefined;
  allowUpload?: boolean; // permite subir archivos
  allowDelete?: boolean; // permite eliminar archivos
  enablePhotos?: boolean; // muestra sección fotos
  enableDocs?: boolean; // muestra sección documentos
  uploadExtraFields?: Record<string, string>; // campos extra para adjuntar (p.ej. scope)
}

export const MachineFiles = ({ machineId, allowUpload = false, allowDelete = true, enablePhotos = true, enableDocs = true, uploadExtraFields = {} }: MachineFilesProps) => {
  const [photos, setPhotos] = useState<MachineFile[]>([]);
  const [docs, setDocs] = useState<MachineFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);
  const [docFiles, setDocFiles] = useState<FileList | null>(null);
  
  // Estado para modal de imagen ampliada
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const loadFiles = async () => {
    if (!machineId) return;
    setLoading(true);
    try {
      // Si uploadExtraFields tiene scope, filtrar por ese scope también
      const scope = uploadExtraFields?.scope;
      const url = scope 
        ? `/api/files/${machineId}?scope=${scope}`
        : `/api/files/${machineId}`;
      const all: MachineFile[] = await apiGet(url);
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
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId]);

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
  }, [isImageModalOpen, selectedImageIndex, photos.length]);

  const uploadSelected = async (type: 'FOTO' | 'DOCUMENTO') => {
    if (!machineId) return;
    const files = type === 'FOTO' ? photoFiles : docFiles;
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('machine_id', machineId);
        fd.append('file_type', type);
        Object.entries(uploadExtraFields).forEach(([k, v]) => fd.append(k, v));
        await apiUpload('/api/files', fd);
      }
      await loadFiles();
      setPhotoFiles(null);
      setDocFiles(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiDelete(`/api/files/${id}`);
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
      'LOGISTICA': { text: 'Logística', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      'EQUIPOS': { text: 'Equipos', color: 'bg-green-100 text-green-800 border-green-300' },
      'SERVICIO': { text: 'Servicio', color: 'bg-orange-100 text-orange-800 border-orange-300' },
      'GENERAL': { text: 'General', color: 'bg-gray-100 text-gray-800 border-gray-300' }
    };
    return labels[scope as keyof typeof labels] || labels['GENERAL'];
  };

  return (
    <div className="space-y-6">
      {/* Fotos */}
      {enablePhotos && (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-gray-700" /> Fotos
          </h4>
          {allowUpload && (
            <div className="flex items-center gap-2">
              <input type="file" multiple accept="image/*" onChange={(e) => setPhotoFiles(e.target.files)} />
              <Button size="sm" disabled={!photoFiles || !machineId || loading} className="flex items-center gap-1">
                <span onClick={() => uploadSelected('FOTO')} className="flex items-center gap-1">
                  <Upload className="w-4 h-4" /> Subir
                </span>
              </Button>
            </div>
          )}
        </div>

        {loading && <p className="text-sm text-gray-500">Cargando...</p>}
        {photos.length === 0 ? (
          <p className="text-sm text-gray-500">Sin fotos</p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {photos.map((p, index) => {
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
                  {/* Botones de acción en hover */}
                  {allowDelete && (
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
        )}
      </div>
      )}

      {/* Documentos */}
      {enableDocs && (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-700" /> Documentos
          </h4>
          {allowUpload && (
            <div className="flex items-center gap-2">
              <input type="file" multiple accept="application/pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={(e) => setDocFiles(e.target.files)} />
              <Button size="sm" disabled={!docFiles || !machineId || loading} className="flex items-center gap-1">
                <span onClick={() => uploadSelected('DOCUMENTO')} className="flex items-center gap-1">
                  <Upload className="w-4 h-4" /> Subir
                </span>
              </Button>
            </div>
          )}
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500">Sin documentos</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border">
            {docs.map((d) => {
              const moduleLabel = getModuleLabel(d.scope);
              return (
                <li key={d.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800">{d.file_name}</p>
                        {/* Etiqueta de módulo */}
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
                    <a href={downloadUrl(d.id)} target="_blank" rel="noreferrer" className="px-2 py-1 text-xs bg-white border rounded-md flex items-center gap-1"><Download className="w-3.5 h-3.5"/>Descargar</a>
                    {allowDelete && (
                      <button onClick={() => handleDelete(d.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded-md flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/>Borrar</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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

            {/* Imagen Principal */}
            <motion.div
              key={selectedImageIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative flex items-center justify-center"
              style={{ maxWidth: '90vw', maxHeight: '85vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={downloadUrl(photos[selectedImageIndex].id)}
                alt={photos[selectedImageIndex].file_name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                style={{ maxHeight: '85vh', maxWidth: '90vw' }}
              />
              
              {/* Información de la imagen */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <p className="font-semibold text-sm">{photos[selectedImageIndex].file_name}</p>
                    <p className="text-xs text-gray-300">
                      {new Date(photos[selectedImageIndex].uploaded_at).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <a
                    href={downloadUrl(photos[selectedImageIndex].id)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </a>
                </div>
              </div>

              {/* Etiqueta de módulo */}
              {photos[selectedImageIndex].scope && (
                <div className={`absolute top-4 left-4 px-3 py-1.5 text-sm font-semibold rounded-lg border-2 ${getModuleLabel(photos[selectedImageIndex].scope).color} backdrop-blur-sm`}>
                  {getModuleLabel(photos[selectedImageIndex].scope).text}
                </div>
              )}
            </motion.div>

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


