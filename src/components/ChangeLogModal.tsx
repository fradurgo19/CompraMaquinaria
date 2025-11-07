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
            className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Control de Cambios</h2>
                    <p className="text-white/90 text-sm">Se detectaron {changes.length} cambio(s) en este registro</p>
                  </div>
                </div>
                <button
                  onClick={onCancel}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {/* Lista de Cambios */}
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Cambios Detectados:
                </h3>
                {changes.map((change, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm"
                  >
                    <p className="font-semibold text-gray-900 mb-2">{change.field_label}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Valor Anterior:</p>
                        <p className="font-mono bg-red-100 text-red-800 px-3 py-2 rounded border border-red-300">
                          {formatValue(change.old_value)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Valor Nuevo:</p>
                        <p className="font-mono bg-green-100 text-green-800 px-3 py-2 rounded border border-green-300">
                          {formatValue(change.new_value)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Razón del Cambio (Opcional) */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Razón del Cambio (Opcional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Ej: Corrección de error en factura, Actualización solicitada por proveedor..."
                  className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                />
                <p className="text-xs text-gray-600 mt-2">
                  💡 Puedes guardar sin razón, pero es recomendable documentar cambios importantes
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                className="px-6"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSkip}
                className="px-6 bg-gray-600 hover:bg-gray-700"
              >
                Guardar sin Razón
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                className="px-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
              >
                Guardar con Razón
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

