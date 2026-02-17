/**
 * Componente de Drag & Drop para mover fotos entre módulos
 * Usado específicamente en Equipos para material comercial
 */

import { useState } from 'react';
import { MoveRight, Check } from 'lucide-react';
import { apiPatch } from '../services/api';
import { showSuccess, showError } from './Toast';

interface MachineFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: 'FOTO' | 'DOCUMENTO';
  scope?: string;
}

interface MachineFilesDragDropProps {
  otherPhotos: MachineFile[]; // Fotos de otros módulos
  onFileMoved: () => void; // Callback para recargar archivos
}

export const MachineFilesDragDrop = ({
  otherPhotos,
  onFileMoved,
}: MachineFilesDragDropProps) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);

  const getFilePreviewUrl = (fileId: string): string => {
    const baseApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${baseApiUrl}/api/files/download/${encodeURIComponent(fileId)}`;
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const moveToEquipment = async () => {
    if (selectedFiles.size === 0) {
      showError('Selecciona al menos una foto');
      return;
    }

    setIsMoving(true);
    try {
      // Mover cada archivo seleccionado a scope EQUIPOS
      await Promise.all(
        Array.from(selectedFiles).map((fileId) =>
          apiPatch(`/api/files/${fileId}/scope`, { new_scope: 'EQUIPOS' })
        )
      );

      showSuccess(`${selectedFiles.size} foto(s) movida(s) a Material Comercial`);
      setSelectedFiles(new Set());
      onFileMoved();
    } catch (error) {
      console.error('Error moviendo archivos:', error);
      showError('Error al mover archivos');
    } finally {
      setIsMoving(false);
    }
  };

  if (otherPhotos.length === 0) {
    return null;
  }

  return (
    <div className="border-t pt-4 mt-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">
              📦 Fotos de Otros Módulos
            </h4>
            <p className="text-xs text-gray-600 mt-1">
              Selecciona fotos para moverlas a Material Comercial
            </p>
          </div>
          {selectedFiles.size > 0 && (
            <button
              onClick={moveToEquipment}
              disabled={isMoving}
              className="flex items-center gap-2 px-4 py-2 bg-[#cf1b22] text-white rounded-lg hover:bg-[#a01419] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isMoving ? (
                <>Moviendo...</>
              ) : (
                <>
                  <MoveRight className="w-4 h-4" />
                  Mover {selectedFiles.size} a Equipos
                </>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {otherPhotos.map((file) => {
            const isSelected = selectedFiles.has(file.id);
            const imageUrl = getFilePreviewUrl(file.id);

            return (
              <button
                type="button"
                key={file.id}
                onClick={() => toggleFileSelection(file.id)}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  isSelected
                    ? 'border-[#cf1b22] ring-2 ring-[#cf1b22] ring-offset-2'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={imageUrl}
                  alt={file.file_name}
                  className={`w-full h-32 object-cover ${isSelected ? 'opacity-75' : ''}`}
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-[#cf1b22] bg-opacity-30 flex items-center justify-center">
                    <div className="bg-white rounded-full p-2">
                      <Check className="w-6 h-6 text-[#cf1b22]" />
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 px-2 py-1">
                  <p className="text-white text-[10px] truncate">{file.file_name}</p>
                  {file.scope && (
                    <p className="text-blue-200 text-[9px] uppercase">{file.scope}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

