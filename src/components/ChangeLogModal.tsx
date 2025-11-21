/**
 * Modal de Control de Cambios
 * Muestra cambios detectados y permite agregar razón (opcional)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, FileText } from 'lucide-react';
import { Button } from '../atoms/Button';

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

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return 'Sin valor';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    
    // Formatear números con separadores
    if (typeof value === 'number') {
      return value.toLocaleString('es-CO');
    }
    
    // Si es string numérico, formatearlo
    if (typeof value === 'string' && !isNaN(parseFloat(value))) {
      const num = parseFloat(value);
      return num.toLocaleString('es-CO');
    }
    
    return String(value);
  };

  const handleConfirm = () => {
    onConfirm(reason || undefined);
    setReason('');
  };

  const handleSkip = () => {
    onConfirm(undefined);
    setReason('');
  };

  if (changes.length === 0) return null;

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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">Control de Cambios</h2>
                </div>
                <button
                  onClick={onCancel}
                  className="text-white/80 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4">
              {/* Lista de Cambios */}
              <div className="space-y-2 mb-4">
                {changes.map((change, index) => (
                  <div
                    key={index}
                    className="bg-amber-50 border-l-3 border-amber-400 rounded-md p-3"
                  >
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">{change.field_label}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex-1">
                        <span className="text-gray-500">Antes: </span>
                        <span className="font-mono bg-red-50 text-red-700 px-2 py-0.5 rounded">
                          {formatValue(change.old_value)}
                        </span>
                      </div>
                      <span className="text-gray-400">→</span>
                      <div className="flex-1">
                        <span className="text-gray-500">Ahora: </span>
                        <span className="font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded">
                          {formatValue(change.new_value)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Razón del Cambio (Opcional) */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Razón del cambio (opcional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Ej: Corrección de error..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 border-t flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                className="px-4 py-1.5 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSkip}
                className="px-4 py-1.5 text-xs bg-gray-500 hover:bg-gray-600"
              >
                Sin Razón
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-1.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
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

