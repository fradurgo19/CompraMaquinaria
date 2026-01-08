/**
 * Modal para gestionar especificaciones por defecto de máquinas
 * Permite crear, editar y eliminar especificaciones por marca/modelo
 */

import { useState, useEffect } from 'react';
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

interface MachineSpecDefaultsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CAPACIDAD_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'MINIS', label: 'MINIS' },
  { value: 'MEDIANAS', label: 'MEDIANAS' },
  { value: 'GRANDES', label: 'GRANDES' },
];

const TONELAGE_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: '1.7-5.5 TONELADAS', label: '1.7-5.5 T' },
  { value: '7.5-13.5 TONELADAS', label: '7.5-13.5 T' },
  { value: '20.0-ADELANTE TONELADAS', label: '20.0-ADELANTE T' },
];

const CABIN_OPTIONS = [
  { value: 'CABINA CERRADA/AC', label: 'Cabina cerrada / AC' },
  { value: 'CANOPY', label: 'Canopy' },
];

const ARM_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'ESTANDAR', label: 'ESTANDAR' },
  { value: 'N/A', label: 'N/A' },
  { value: 'LONG ARM', label: 'LONG ARM' },
];

export const MachineSpecDefaultsModal = ({ isOpen, onClose }: MachineSpecDefaultsModalProps) => {
  const [specs, setSpecs] = useState<MachineSpecDefault[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    capacidad: '',
    tonelage: '',
    spec_blade: false,
    spec_pip: false,
    spec_cabin: '',
    arm_type: '',
    shoe_width_mm: '',
  });

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

  const handleEdit = (spec: MachineSpecDefault) => {
    setEditingId(spec.id);
    setFormData({
      brand: spec.brand,
      model: spec.model,
      capacidad: spec.capacidad || '',
      tonelage: spec.tonelage || '',
      spec_blade: spec.spec_blade || false,
      spec_pip: spec.spec_pip || false,
      spec_cabin: spec.spec_cabin || '',
      arm_type: spec.arm_type || '',
      shoe_width_mm: spec.shoe_width_mm?.toString() || '',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      brand: '',
      model: '',
      capacidad: '',
      tonelage: '',
      spec_blade: false,
      spec_pip: false,
      spec_cabin: '',
      arm_type: '',
      shoe_width_mm: '',
    });
  };

  const handleSave = async () => {
    if (!formData.brand || !formData.model) {
      showError('Marca y modelo son requeridos');
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
      
      const payload = {
        ...formData,
        shoe_width_mm: shoeWidthValue,
      };
      
      if (editingId) {
        await apiPut(`/api/machine-spec-defaults/${editingId}`, payload);
        showSuccess('Especificación actualizada exitosamente');
      } else {
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
  const modelSelectOptions = MODEL_OPTIONS.map((model) => ({ value: model, label: model }));

  // Función para autocompletar campos según capacidad
  const applyCapacidadDefaults = (capacidad: string) => {
    const updates: Partial<typeof formData> = {};
    
    if (capacidad === 'MINIS') {
      updates.tonelage = '1.7-5.5 TONELADAS';
      updates.spec_blade = true;
      updates.spec_pip = true;
      // Cabina: CANOPY o CABINA CERRADA (no autocompletar, dejar que el usuario elija)
      // Tipo de Brazo: no especificado
    } else if (capacidad === 'MEDIANAS') {
      updates.tonelage = '7.5-13.5 TONELADAS';
      updates.spec_pip = true;
      updates.spec_cabin = 'CABINA CERRADA/AC';
      updates.arm_type = 'LONG ARM';
      // Blade: algunas sí otras no (no autocompletar)
    } else if (capacidad === 'GRANDES') {
      updates.tonelage = '20.0-ADELANTE TONELADAS';
      updates.spec_blade = true;
      updates.spec_pip = true;
      updates.spec_cabin = 'CABINA CERRADA/AC';
      updates.arm_type = 'LONG ARM';
    }
    
    return updates;
  };

  // Función para autocompletar campos según tonelaje
  const applyTonelageDefaults = (tonelage: string) => {
    const updates: Partial<typeof formData> = {};
    
    if (tonelage === '1.7-5.5 TONELADAS') {
      updates.capacidad = 'MINIS';
      updates.spec_blade = true;
      updates.spec_pip = true;
    } else if (tonelage === '7.5-13.5 TONELADAS') {
      updates.capacidad = 'MEDIANAS';
      updates.spec_pip = true;
      updates.spec_cabin = 'CABINA CERRADA/AC';
      updates.arm_type = 'LONG ARM';
    } else if (tonelage === '20.0-ADELANTE TONELADAS') {
      updates.capacidad = 'GRANDES';
      updates.spec_blade = true;
      updates.spec_pip = true;
      updates.spec_cabin = 'CABINA CERRADA/AC';
      updates.arm_type = 'LONG ARM';
    }
    
    return updates;
  };

  const handleCapacidadChange = (value: string) => {
    const updates = applyCapacidadDefaults(value);
    setFormData({ ...formData, capacidad: value, ...updates });
  };

  const handleTonelageChange = (value: string) => {
    const updates = applyTonelageDefaults(value);
    setFormData({ ...formData, tonelage: value, ...updates });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestionar Especificaciones por Defecto">
      <div className="space-y-6">
        {/* Formulario */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-900">
            {editingId ? 'Editar Especificación' : 'Nueva Especificación'}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <Select
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                options={[{ value: '', label: 'Seleccionar...' }, ...brandSelectOptions]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <Input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="Ej: ZX17, ZX30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
              <Select
                value={formData.capacidad}
                onChange={(e) => handleCapacidadChange(e.target.value)}
                options={CAPACIDAD_OPTIONS}
              />
              {formData.capacidad && (
                <p className="text-xs text-gray-500 mt-1">
                  {formData.capacidad === 'MINIS' && 'Modelos: ZX17, ZX30, ZX40, ZX50'}
                  {formData.capacidad === 'MEDIANAS' && 'Modelos: ZX75, ZX120, ZX135'}
                  {formData.capacidad === 'GRANDES' && 'Modelos: ZX200, ZX240, ZX250, ZX300, ZX330+'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tonelaje</label>
              <Select
                value={formData.tonelage}
                onChange={(e) => handleTonelageChange(e.target.value)}
                options={TONELAGE_OPTIONS}
              />
            </div>
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
              <Input
                type="number"
                value={formData.shoe_width_mm}
                onChange={(e) => setFormData({ ...formData, shoe_width_mm: e.target.value })}
                placeholder="Ej: 600"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.spec_blade}
                  onChange={(e) => setFormData({ ...formData, spec_blade: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Blade</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.spec_pip}
                  onChange={(e) => setFormData({ ...formData, spec_pip: e.target.checked })}
                  className="rounded"
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
              {editingId ? 'Actualizar' : 'Guardar'}
            </Button>
            {editingId && (
              <Button
                onClick={handleCancel}
                className="bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Lista de especificaciones */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Especificaciones Guardadas</h3>
          {loading && specs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Cargando...</p>
          ) : specs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay especificaciones guardadas</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {specs.map((spec) => (
                <div
                  key={spec.id}
                  className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {spec.brand} - {spec.model}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {spec.capacidad && <span className="mr-2">Cap: {spec.capacidad}</span>}
                      {spec.tonelage && <span className="mr-2">Ton: {spec.tonelage}</span>}
                      {spec.spec_blade && <span className="mr-2">Blade</span>}
                      {spec.spec_pip && <span className="mr-2">PIP</span>}
                      {spec.spec_cabin && <span className="mr-2">Cab: {spec.spec_cabin}</span>}
                      {spec.arm_type && <span className="mr-2">Brazo: {spec.arm_type}</span>}
                      {spec.shoe_width_mm !== null && spec.shoe_width_mm !== undefined && <span>Zapatas: {spec.shoe_width_mm}mm</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(spec)}
                      className="bg-blue-500 text-white hover:bg-blue-600 px-3 py-1 text-xs"
                    >
                      Editar
                    </Button>
                    <Button
                      onClick={() => handleDelete(spec.id)}
                      className="bg-red-500 text-white hover:bg-red-600 px-3 py-1 text-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

