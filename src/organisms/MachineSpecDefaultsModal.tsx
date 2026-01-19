/**
 * Modal para gestionar especificaciones por defecto de máquinas
 * Permite crear, editar y eliminar especificaciones por marca/modelo
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { Modal } from '../molecules/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { MachineSpecDefault } from '../types/database';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { BRAND_OPTIONS } from '../constants/brands';
import { MODEL_OPTIONS } from '../constants/models';
import { TONNAGE_RANGES, type TonnageRangeConfig } from '../constants/shoeWidthConfig';

interface MachineSpecDefaultsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TONELAGE_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  ...TONNAGE_RANGES.map(range => ({ value: range.range, label: `${range.range} TON` })),
];

const CABIN_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'CABINA CERRADA/AC', label: 'Cerrada / AC' },
  { value: 'CANOPY', label: 'Canopy' },
];

const ARM_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'ESTANDAR', label: 'Estandar' },
  { value: 'N/A', label: 'N/A' },
  { value: 'LONG ARM', label: 'Long Arm' },
];

export const MachineSpecDefaultsModal = ({ isOpen, onClose }: MachineSpecDefaultsModalProps) => {
  const [specs, setSpecs] = useState<MachineSpecDefault[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTonelage, setEditingTonelage] = useState<{ brand: string; tonelage: string } | null>(null);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    tonelage: '',
    spec_blade: false,
    spec_pip: false,
    spec_cabin: '',
    arm_type: '',
    shoe_width_mm: '',
  });

  // Obtener la configuración del rango de toneladas seleccionado
  const getSelectedRangeConfig = (): TonnageRangeConfig | null => {
    if (!formData.tonelage) return null;
    return TONNAGE_RANGES.find(range => range.range === formData.tonelage) || null;
  };

  const selectedRangeConfig = getSelectedRangeConfig();

  // Opciones de ancho de zapatas (lista o campo numérico)
  const shoeWidthOptions = selectedRangeConfig?.shoeWidthOptions
    ? selectedRangeConfig.shoeWidthOptions.map(val => ({ value: val.toString(), label: `${val} mm` }))
    : null;

  useEffect(() => {
    if (isOpen) {
      fetchSpecs();
    }
  }, [isOpen]);

  const fetchSpecs = async () => {
    try {
      setLoading(true);
      const data = await apiGet<MachineSpecDefault[]>('/api/machine-spec-defaults');
      setSpecs(data || []);
    } catch (error: any) {
      // Si la tabla no existe, simplemente mostrar lista vacía
      if (error?.message?.includes('no existe') || error?.code === '42P01') {
        setSpecs([]);
        return;
      }
      console.error('Error fetching specs:', error);
      showError('Error al cargar especificaciones');
      setSpecs([]);
    } finally {
      setLoading(false);
    }
  };

  // Agrupar especificaciones por brand y tonelage
  const groupedSpecs = useMemo(() => {
    const groups = new Map<string, { brand: string; tonelage: string; specs: MachineSpecDefault[] }>();
    
    specs.forEach(spec => {
      if (spec.brand && spec.tonelage) {
        const key = `${spec.brand}|${spec.tonelage}`;
        if (!groups.has(key)) {
          groups.set(key, { brand: spec.brand, tonelage: spec.tonelage, specs: [] });
        }
        groups.get(key)!.specs.push(spec);
      }
    });
    
    return Array.from(groups.values());
  }, [specs]);

  const handleEdit = (brand: string, tonelage: string) => {
    // Buscar todas las especificaciones del rango para cargar valores
    const rangeSpecs = specs.filter(s => s.brand === brand && s.tonelage === tonelage);
    const firstSpec = rangeSpecs[0];
    
    if (firstSpec) {
      setEditingTonelage({ brand, tonelage });
      // Mostrar todos los modelos existentes separados por coma
      const existingModels = rangeSpecs.map(s => s.model).join(', ');
      setFormData({
        brand: firstSpec.brand,
        model: existingModels, // Mostrar modelos existentes
        tonelage: firstSpec.tonelage || '',
        spec_blade: firstSpec.spec_blade || false,
        spec_pip: firstSpec.spec_pip || false,
        spec_cabin: firstSpec.spec_cabin || '',
        arm_type: firstSpec.arm_type || '',
        shoe_width_mm: firstSpec.shoe_width_mm?.toString() || '',
      });
    }
  };

  const handleCancel = () => {
    setEditingTonelage(null);
    setFormData({
      brand: '',
      model: '',
      tonelage: '',
      spec_blade: false,
      spec_pip: false,
      spec_cabin: '',
      arm_type: '',
      shoe_width_mm: '',
    });
  };

  const handleSave = async () => {
    if (!formData.brand) {
      showError('Marca es requerida');
      return;
    }

    try {
      setLoading(true);
      // Parsear shoe_width_mm correctamente (manejar string vacío, 0, y valores válidos)
      let shoeWidthValue: number | null = null;
      if (formData.shoe_width_mm && formData.shoe_width_mm.trim() !== '') {
        const parsed = parseFloat(formData.shoe_width_mm);
        if (!isNaN(parsed) && parsed > 0) {
          shoeWidthValue = parsed;
        }
      }
      
      if (editingTonelage) {
        // Modo edición: actualizar todos los modelos del rango y crear nuevos si se agregan
        const payload = {
          brand: formData.brand,
          tonelage: formData.tonelage || null,
          spec_blade: formData.spec_blade || false,
          spec_pip: formData.spec_pip || false,
          spec_cabin: formData.spec_cabin || null,
          arm_type: formData.arm_type || null,
          shoe_width_mm: shoeWidthValue,
        };
        
        // Actualizar modelos existentes del rango
        const response = await apiPut('/api/machine-spec-defaults/by-tonelage', payload);
        let updatedCount = response.updated || 0;
        
        // Procesar modelos nuevos (separados por coma)
        if (formData.model && formData.model.trim()) {
          const modelsList = formData.model.split(',').map(m => m.trim()).filter(m => m);
          const existingModels = specs
            .filter(s => s.brand === formData.brand && s.tonelage === formData.tonelage)
            .map(s => s.model);
          
          // Crear nuevas especificaciones para modelos que no existen
          const newModels = modelsList.filter(m => !existingModels.includes(m));
          
          for (const model of newModels) {
            try {
              await apiPost('/api/machine-spec-defaults', {
                ...payload,
                model: model,
              });
              updatedCount++;
            } catch (error) {
              console.error(`Error creando especificación para modelo ${model}:`, error);
            }
          }
        }
        
        showSuccess(`${updatedCount} especificación(es) actualizada(s) exitosamente`);
      } else {
        // Modo creación: crear nueva especificación
        if (!formData.model) {
          showError('Modelo es requerido para crear una nueva especificación');
          return;
        }
        
        const payload = {
          brand: formData.brand,
          model: formData.model,
          tonelage: formData.tonelage || null,
          spec_blade: formData.spec_blade || false,
          spec_pip: formData.spec_pip || false,
          spec_cabin: formData.spec_cabin || null,
          arm_type: formData.arm_type || null,
          shoe_width_mm: shoeWidthValue,
        };
        
        await apiPost('/api/machine-spec-defaults', payload);
        showSuccess('Especificación creada exitosamente');
      }
      handleCancel();
      fetchSpecs();
    } catch (error) {
      console.error('Error saving spec:', error);
      showError('Error al guardar especificación');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta especificación?')) return;

    try {
      setLoading(true);
      await apiDelete(`/api/machine-spec-defaults/${id}`);
      showSuccess('Especificación eliminada exitosamente');
      fetchSpecs();
    } catch (error) {
      console.error('Error deleting spec:', error);
      showError('Error al eliminar especificación');
    } finally {
      setLoading(false);
    }
  };

  const brandSelectOptions = BRAND_OPTIONS.map((brand) => ({ value: brand, label: brand }));

  // Función para autocompletar campos según el rango de toneladas seleccionado
  const handleTonelageChange = (value: string) => {
    const rangeConfig = TONNAGE_RANGES.find(range => range.range === value);
    
    if (rangeConfig) {
      const updates: Partial<typeof formData> = {
        tonelage: value,
        spec_cabin: rangeConfig.cabin || '',
        arm_type: rangeConfig.armType || '',
        spec_blade: rangeConfig.blade === true,
        spec_pip: rangeConfig.pip === true,
      };

      // Si hay un valor por defecto para shoe_width_mm, establecerlo
      if (rangeConfig.defaultShoeWidth) {
        updates.shoe_width_mm = rangeConfig.defaultShoeWidth.toString();
      } else if (rangeConfig.shoeWidthOptions && rangeConfig.shoeWidthOptions.length > 0) {
        // Si es una lista, no establecer valor por defecto
        updates.shoe_width_mm = '';
      } else {
        updates.shoe_width_mm = '';
      }

      setFormData({ ...formData, ...updates });
    } else {
      setFormData({ ...formData, tonelage: value });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestionar Especificaciones por Defecto">
      <div className="space-y-6">
        {/* Formulario Horizontal */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingTonelage ? 'Editar Especificación por Rango' : 'Nueva Especificación'}
          </h3>
          
          {/* Primera fila: Marca, Rango de Toneladas, y Modelo */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <Select
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                options={[{ value: '', label: 'Seleccionar...' }, ...brandSelectOptions]}
                disabled={!!editingTonelage}
              />
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rango de Toneladas</label>
              <Select
                value={formData.tonelage}
                onChange={(e) => handleTonelageChange(e.target.value)}
                options={TONELAGE_OPTIONS}
                disabled={!!editingTonelage}
              />
              {editingTonelage && (
                <p className="text-xs text-gray-500 mt-1">
                  Editando todos los modelos de este rango
                </p>
              )}
            </div>
            <div className="col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modelos {editingTonelage && '(separados por coma)'}
              </label>
              <Input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder={editingTonelage ? "Ej: ZX17U-2, ZX30U-3, ZX35U-5A" : "Ej: ZX17U-2, ZX30U-3"}
              />
              {editingTonelage ? (
                <p className="text-xs text-gray-500 mt-1">
                  Agrega más modelos separados por coma para incluirlos en este rango
                </p>
              ) : selectedRangeConfig && (
                <p className="text-xs text-gray-500 mt-1">
                  Modelos: {selectedRangeConfig.models.slice(0, 3).join(', ')}
                  {selectedRangeConfig.models.length > 3 && ` +${selectedRangeConfig.models.length - 3} más`}
                </p>
              )}
            </div>
          </div>

          {/* Segunda fila: Cabina, Tipo de Brazo, Ancho de Zapatas, Blade, PIP */}
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cabina</label>
              <Select
                value={formData.spec_cabin}
                onChange={(e) => setFormData({ ...formData, spec_cabin: e.target.value })}
                options={CABIN_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Brazo</label>
              <Select
                value={formData.arm_type}
                onChange={(e) => setFormData({ ...formData, arm_type: e.target.value })}
                options={ARM_TYPE_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ancho de Zapatas (mm)</label>
              {shoeWidthOptions ? (
                <Select
                  value={formData.shoe_width_mm}
                  onChange={(e) => setFormData({ ...formData, shoe_width_mm: e.target.value })}
                  options={[{ value: '', label: 'Seleccionar...' }, ...shoeWidthOptions]}
                />
              ) : (
                <Input
                  type="number"
                  value={formData.shoe_width_mm}
                  onChange={(e) => setFormData({ ...formData, shoe_width_mm: e.target.value })}
                  placeholder="Ej: 600"
                />
              )}
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={formData.spec_blade}
                  onChange={(e) => setFormData({ ...formData, spec_blade: e.target.checked })}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm text-gray-700">Blade</span>
              </label>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={formData.spec_pip}
                  onChange={(e) => setFormData({ ...formData, spec_pip: e.target.checked })}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm text-gray-700">PIP</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Save className="w-4 h-4" />
              {editingTonelage ? 'Actualizar Rango' : 'Guardar'}
            </Button>
            {editingTonelage && (
              <Button
                onClick={handleCancel}
                className="bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Lista de especificaciones agrupadas por rango */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Especificaciones Guardadas</h3>
          {loading && specs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Cargando...</p>
          ) : groupedSpecs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay especificaciones guardadas</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {groupedSpecs.map((group) => {
                const firstSpec = group.specs[0];
                return (
                  <div
                    key={`${group.brand}-${group.tonelage}`}
                    className="bg-white border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {group.brand} - {group.tonelage} TON
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {group.specs.length} modelo{group.specs.length !== 1 ? 's' : ''}: {group.specs.slice(0, 5).map(s => s.model).join(', ')}
                          {group.specs.length > 5 && ` +${group.specs.length - 5} más`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleEdit(group.brand, group.tonelage)}
                          className="bg-blue-500 text-white hover:bg-blue-600 px-3 py-1 text-xs"
                        >
                          Editar Rango
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 border-t pt-2 mt-2">
                      {firstSpec.spec_cabin && <span className="mr-2">Cab: {firstSpec.spec_cabin}</span>}
                      {firstSpec.arm_type && <span className="mr-2">Brazo: {firstSpec.arm_type}</span>}
                      {firstSpec.shoe_width_mm !== null && firstSpec.shoe_width_mm !== undefined && <span className="mr-2">Zapatas: {firstSpec.shoe_width_mm}mm</span>}
                      {firstSpec.spec_blade && <span className="mr-2">Blade</span>}
                      {firstSpec.spec_pip && <span>PIP</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

