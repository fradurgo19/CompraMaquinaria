/**
 * Modal de Control de Cambios
 * Muestra cambios detectados y permite agregar razón (opcional).
 * Usa formatChangeValue para old_value y new_value con puntos de mil (es-CO) en todos los módulos.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '../atoms/Button';
import { formatChangeValue } from '../utils/formatChangeValue';

interface ChangeItem {
  field_name: string;
  field_label: string;
  old_value: string | number | null;
  new_value: string | number | null;
}

interface ChangeLogModalProps {
  isOpen: boolean;
  changes: ChangeItem[];
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export const ChangeLogModal = ({ isOpen, changes, onConfirm, onCancel }: ChangeLogModalProps) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason || undefined);
    setReason('');
  };

  const handleSkip = () => {
    onConfirm(undefined);
    setReason('');
  };

  if (changes.length === 0) return null;

  // Agrupar cambios por campo para mostrar más compacto
  const groupedChanges = changes.reduce((acc, change) => {
    const key = change.field_label;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(change);
    return acc;
  }, {} as Record<string, ChangeItem[]>);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Modal - Más alto y con mejor estructura */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] border border-gray-200"
          >
            {/* Header - Sticky con colores institucionales */}
            <div className="bg-gradient-to-r from-[#cf1b22] to-[#8a1217] px-4 py-3 text-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <div>
                    <h2 className="text-lg font-semibold">Control de Cambios</h2>
                    <p className="text-xs text-white/90">{changes.length} cambio(s) detectado(s)</p>
                  </div>
                </div>
                <button
                  onClick={onCancel}
                  className="text-white/80 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body - Con scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Lista de Cambios - Más compacta */}
              <div className="space-y-2">
                {Object.entries(groupedChanges).map(([fieldLabel, fieldChanges], groupIndex) => (
                  <div
                    key={groupIndex}
                    className="bg-amber-50/50 border border-amber-200 rounded-lg p-2.5"
                  >
                    <p className="text-xs font-semibold text-gray-800 mb-1.5">{fieldLabel}</p>
                    <div className="space-y-1">
                      {fieldChanges.map((change, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500 min-w-[45px]">Antes:</span>
                          <span className="font-mono bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-[11px] flex-1 truncate">
                            {formatChangeValue(change.old_value)}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-gray-500 min-w-[45px]">Ahora:</span>
                          <span className="font-mono bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[11px] flex-1 truncate">
                            {formatChangeValue(change.new_value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Razón del Cambio (Opcional) */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex-shrink-0">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Razón del cambio (opcional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Ej: Corrección de error, actualización de datos..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] resize-none"
                />
              </div>
            </div>

            {/* Footer - Sticky siempre visible */}
            <div className="bg-gray-50 px-4 py-3 border-t flex justify-end gap-2 flex-shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                className="px-4 py-2 text-sm"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSkip}
                className="px-4 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white"
              >
                Sin Razón
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 text-sm bg-gradient-to-r from-[#cf1b22] to-[#8a1217] hover:from-[#b8181e] hover:to-[#7a1015] text-white shadow-md hover:shadow-lg transition-all duration-200"
              >
                Guardar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

