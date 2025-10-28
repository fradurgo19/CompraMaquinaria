/**
 * Componente Gestor de Archivos OneDrive
 * Permite subir, ver y eliminar fotos y documentos de máquinas
 */

import { useState, useRef } from 'react';
import { Upload, Trash2, Download, Image, FileText, Folder, X, ExternalLink } from 'lucide-react';
import { Button } from '../atoms/Button';
import { useOneDrive, useOneDriveFiles } from '../hooks/useOneDrive';

interface OneDriveManagerProps {
  model: string;
  serial: string;
  onClose?: () => void;
}

export const OneDriveManager = ({ model, serial, onClose }: OneDriveManagerProps) => {
  const { isAuthenticated, isAuthenticating, authenticate } = useOneDrive();
  const [activeTab, setActiveTab] = useState<'Fotos' | 'Documentos'>('Fotos');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    loading,
    error,
    uploadFile,
    deleteFile,
    createFolder,
    loadFiles
  } = useOneDriveFiles(model, serial, activeTab);

  // Filtrar solo archivos (no carpetas)
  const displayFiles = files.filter(f => f.isFile);

  const handleAuthenticate = async () => {
    try {
      await authenticate();
      await loadFiles();
    } catch (error) {
      console.error('Error autenticando:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadFile(file, activeTab);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error subiendo archivo:', error);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`¿Eliminar ${fileName}?`)) return;

    try {
      await deleteFile(fileId);
    } catch (error) {
      console.error('Error eliminando archivo:', error);
    }
  };

  const handleCreateFolder = async () => {
    try {
      await createFolder();
    } catch (error) {
      console.error('Error creando carpeta:', error);
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

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="text-center">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Conectar con OneDrive
          </h3>
          <p className="text-gray-600 mb-4">
            Para gestionar fotos y documentos de la máquina<br />
            <span className="font-medium">{model} - {serial}</span>
          </p>
          <Button
            onClick={handleAuthenticate}
            disabled={isAuthenticating}
            className="mx-auto"
          >
            {isAuthenticating ? 'Conectando...' : 'Conectar OneDrive'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
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
          onClick={() => setActiveTab('Fotos')}
          className={`flex-1 px-4 py-3 font-medium transition ${
            activeTab === 'Fotos'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Image className="w-4 h-4 inline mr-2" />
          Fotos ({files.filter(f => f.isFile && isImageFile(f.name)).length})
        </button>
        <button
          onClick={() => setActiveTab('Documentos')}
          className={`flex-1 px-4 py-3 font-medium transition ${
            activeTab === 'Documentos'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Documentos ({files.filter(f => f.isFile && !isImageFile(f.name)).length})
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
            accept={activeTab === 'Fotos' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx'}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            size="sm"
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Subir {activeTab === 'Fotos' ? 'Foto' : 'Documento'}
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
            {activeTab === 'Fotos' ? (
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
                  {isImageFile(file.name) && file.downloadUrl ? (
                    <img
                      src={file.downloadUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-12 h-12 text-gray-400" />
                  )}
                </div>

                {/* File Info */}
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-800 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  {file.downloadUrl && (
                    <a
                      href={file.downloadUrl}
                      download={file.name}
                      className="flex-1 px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-center text-xs"
                      title="Descargar"
                    >
                      <Download className="w-3 h-3 inline" />
                    </a>
                  )}
                  {file.webUrl && (
                    <a
                      href={file.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition text-center text-xs"
                      title="Ver en OneDrive"
                    >
                      <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(file.id, file.name)}
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
        📁 Los archivos se guardan en OneDrive/MaquinariaUsada/{model} - {serial}/{activeTab}
      </div>
    </div>
  );
};


