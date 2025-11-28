/**
 * Componente para gestionar especificaciones por defecto de modelos
 * Permite agregar, editar y eliminar especificaciones técnicas
 */

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { MODEL_SPECIFICATIONS, ModelSpecs } from '../constants/equipmentSpecs';
import { showSuccess, showError } from './Toast';
import { apiGet, apiPost } from '../services/api';

interface ModelSpecsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (specs: ModelSpecs[]) => void;
}

export const ModelSpecsManager = ({ isOpen, onClose, onSave }: ModelSpecsManagerProps) => {
  const [specs, setSpecs] = useState<ModelSpecs[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<ModelSpecs>({
    model: '',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CANOPY',
      wet_line: 'SI',
      dozer_blade: 'SI',
      track_type: 'STEEL TRACK',
      track_width: '',
    },
  });

  // Cargar especificaciones desde el backend
  useEffect(() => {
    if (isOpen) {
      loadSpecs();
      setEditingIndex(null);
      setIsAdding(false);
    }
  }, [isOpen]);

  const loadSpecs = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ModelSpecs[]>('/api/model-specs');
      setSpecs(data || MODEL_SPECIFICATIONS);
    } catch (error) {
      console.error('Error cargando especificaciones:', error);
      // Si falla, usar las constantes por defecto
      setSpecs([...MODEL_SPECIFICATIONS]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingIndex(null);
    setFormData({
      model: '',
      condition: 'NUEVA',
      specs: {
        cabin_type: 'CANOPY',
        wet_line: 'SI',
        dozer_blade: 'SI',
        track_type: 'STEEL TRACK',
        track_width: '',
      },
    });
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setIsAdding(false);
    setFormData({ ...specs[index] });
  };

  const handleDelete = (index: number) => {
    if (window.confirm('¿Estás seguro de eliminar esta especificación?')) {
      const newSpecs = specs.filter((_, i) => i !== index);
      setSpecs(newSpecs);
    }
  };

  const handleSaveForm = () => {
    if (!formData.model.trim()) {
      showError('El modelo es requerido');
      return;
    }
    if (!formData.specs.track_width.trim()) {
      showError('El ancho de zapata es requerido');
      return;
    }

    if (isAdding) {
      // Verificar si el modelo ya existe
      const exists = specs.some(
        (s) => s.model.toUpperCase() === formData.model.toUpperCase() && s.condition === formData.condition
      );
      if (exists) {
        showError('Ya existe una especificación para este modelo y condición');
        return;
      }
      setSpecs([...specs, { ...formData }]);
      setIsAdding(false);
    } else if (editingIndex !== null) {
      const newSpecs = [...specs];
      newSpecs[editingIndex] = { ...formData };
      setSpecs(newSpecs);
      setEditingIndex(null);
    }
    setFormData({
      model: '',
      condition: 'NUEVA',
      specs: {
        cabin_type: 'CANOPY',
        wet_line: 'SI',
        dozer_blade: 'SI',
        track_type: 'STEEL TRACK',
        track_width: '',
      },
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setFormData({
      model: '',
      condition: 'NUEVA',
      specs: {
        cabin_type: 'CANOPY',
        wet_line: 'SI',
        dozer_blade: 'SI',
        track_type: 'STEEL TRACK',
        track_width: '',
      },
    });
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      await apiPost('/api/model-specs', { specs });
      onSave(specs);
      showSuccess('Especificaciones guardadas correctamente');
      onClose();
    } catch (error: unknown) {
      console.error('Error guardando especificaciones:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar especificaciones';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#cf1b22] via-red-700 to-red-800 rounded-t-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Gestionar Especificaciones por Defecto</h2>
              <p className="text-red-100 mt-1">Administra las especificaciones técnicas de los modelos</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-500">Cargando especificaciones...</p>
            </div>
          )}
          {/* Formulario de agregar/editar */}
          {(isAdding || editingIndex !== null) && (
            <div className="mb-6 p-4 border-2 border-[#cf1b22] rounded-xl bg-red-50">
              <h3 className="text-lg font-semibold text-[#cf1b22] mb-4">
                {isAdding ? 'Agregar Nueva Especificación' : 'Editar Especificación'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Modelo"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value.toUpperCase() })}
                  placeholder="Ej: ZX200-6"
                  required
                />
                <Select
                  label="Condición"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value as 'NUEVA' | 'USADA' })}
                  options={[
                    { value: 'NUEVA', label: 'NUEVA' },
                    { value: 'USADA', label: 'USADA' },
                  ]}
                  required
                />
                <Select
                  label="Tipo Cabina"
                  value={formData.specs.cabin_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      specs: { ...formData.specs, cabin_type: e.target.value },
                    })
                  }
                  options={[
                    { value: 'CANOPY', label: 'CANOPY' },
                    { value: 'CAB CERRADA', label: 'CAB CERRADA' },
                  ]}
                  required
                />
                <Select
                  label="Línea Húmeda"
                  value={formData.specs.wet_line}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      specs: { ...formData.specs, wet_line: e.target.value },
                    })
                  }
                  options={[
                    { value: 'SI', label: 'SI' },
                    { value: 'NO', label: 'NO' },
                  ]}
                  required
                />
                <Select
                  label="Hoja Topadora"
                  value={formData.specs.dozer_blade}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      specs: { ...formData.specs, dozer_blade: e.target.value },
                    })
                  }
                  options={[
                    { value: 'SI', label: 'SI' },
                    { value: 'NO', label: 'NO' },
                  ]}
                  required
                />
                <Select
                  label="Tipo Zapata"
                  value={formData.specs.track_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      specs: { ...formData.specs, track_type: e.target.value },
                    })
                  }
                  options={[
                    { value: 'STEEL TRACK', label: 'STEEL TRACK' },
                    { value: 'RUBBER TRACK', label: 'RUBBER TRACK' },
                  ]}
                  required
                />
                <Input
                  label="Ancho Zapata"
                  value={formData.specs.track_width}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      specs: { ...formData.specs, track_width: e.target.value },
                    })
                  }
                  placeholder="Ej: 230 mm"
                  required
                />
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={handleSaveForm}
                  className="bg-gradient-to-r from-[#cf1b22] to-red-700 hover:from-red-700 hover:to-red-800"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </Button>
                <Button onClick={handleCancel} variant="secondary">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Botón agregar */}
          {!isAdding && editingIndex === null && (
            <div className="mb-4">
              <Button
                onClick={handleAdd}
                className="bg-gradient-to-r from-[#cf1b22] to-red-700 hover:from-red-700 hover:to-red-800"
              >
                <Plus className="w-5 h-5 mr-2" />
                Agregar Nueva Especificación
              </Button>
            </div>
          )}

          {/* Lista de especificaciones */}
          {!loading && (
            <div className="space-y-3">
              {specs.map((spec, index) => (
              <div
                key={`${spec.model}-${spec.condition}-${index}`}
                className="border border-gray-200 rounded-lg p-4 hover:border-[#cf1b22] transition-colors bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-7 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Modelo</p>
                      <p className="font-semibold text-gray-800">{spec.model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Condición</p>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          spec.condition === 'NUEVA'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {spec.condition}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tipo Cabina</p>
                      <p className="text-sm text-gray-700">{spec.specs.cabin_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Línea Húmeda</p>
                      <p className="text-sm text-gray-700">{spec.specs.wet_line}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Hoja Topadora</p>
                      <p className="text-sm text-gray-700">{spec.specs.dozer_blade}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tipo Zapata</p>
                      <p className="text-sm text-gray-700">{spec.specs.track_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Ancho Zapata</p>
                      <p className="text-sm text-gray-700">{spec.specs.track_width}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(index)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={loading}
            className="bg-gradient-to-r from-[#cf1b22] to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
};

