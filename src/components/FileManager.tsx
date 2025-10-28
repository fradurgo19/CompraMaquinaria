/**
 * Componente Gestor de Archivos
 * Reemplaza OneDriveManager para uso local
 */

import { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Download, Image, FileText, X, Cloud } from 'lucide-react';
import { Button } from '../atoms/Button';
import { apiGet, apiUpload, apiDelete } from '../services/api';

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

  useEffect(() => {
    loadFiles();
  }, [machineId, activeTab]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<MachineFile[]>(`/api/files/${machineId}?file_type=${activeTab}`);
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar archivos');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('machine_id', machineId);
      formData.append('file_type', activeTab);

      await apiUpload('/api/files', formData);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo');
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

  const getFileUrl = (filePath: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    // filePath ya viene como "uploads/filename.jpg" de la BD
    return `${apiUrl}/${filePath}`;
  };

  const getDownloadUrl = (fileId: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return `${apiUrl}/api/files/download/${fileId}`;
  };

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
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Image className="w-4 h-4 inline mr-2" />
          Fotos ({files.filter(f => f.file_type === 'FOTO').length})
        </button>
        <button
          onClick={() => setActiveTab('DOCUMENTO')}
          className={`flex-1 px-4 py-3 font-medium transition ${
            activeTab === 'DOCUMENTO'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Documentos ({files.filter(f => f.file_type === 'DOCUMENTO').length})
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
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            size="sm"
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Subir {activeTab === 'FOTO' ? 'Foto' : 'Documento'}
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayFiles.map((file) => (
              <div
                key={file.id}
                className="border rounded-lg p-3 hover:shadow-md transition bg-white"
              >
                {/* Preview */}
                <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                  {isImageFile(file.file_name) ? (
                    <img
                      src={getFileUrl(file.file_path)}
                      alt={file.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-12 h-12 text-gray-400" />
                  )}
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
                    download={file.file_name}
                    className="flex-1 px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-center text-xs"
                    title="Descargar"
                  >
                    <Download className="w-3 h-3 inline" />
                  </a>
                  <button
                    onClick={() => handleDelete(file.id, file.file_name)}
                    className="flex-1 px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-xs"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3 h-3 inline" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-gray-50 border-t text-xs text-gray-600 text-center">
        <Cloud className="w-4 h-4 inline mr-1" />
        Archivos almacenados localmente
      </div>
    </div>
  );
};
