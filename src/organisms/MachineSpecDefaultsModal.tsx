/**
 * Modal para gestionar especificaciones por defecto de máquinas
 * Permite crear, editar y eliminar especificaciones por marca/modelo
 */

import { useState, useEffect, useMemo } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '../molecules/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { MachineSpecDefault } from '../types/database';
import { apiGet, apiPost, apiPut } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { BRAND_OPTIONS } from '../constants/brands';
import { TONNAGE_RANGES, type TonnageRangeConfig } from '../constants/shoeWidthConfig';

interface MachineSpecDefaultsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MachineSpecFormData {
  brand: string;
  model: string;
  tonelage: string;
  spec_blade: boolean;
  spec_pip: boolean;
  spec_cabin: string;
  arm_type: string;
  shoe_width_mm: string;
}

interface MachineSpecPayload {
  brand: string;
  tonelage: string | null;
  spec_blade: boolean;
  spec_pip: boolean;
  spec_cabin: string | null;
  arm_type: string | null;
  shoe_width_mm: number | null;
}

interface UpdateByTonelageResponse {
  updated?: number;
}

const buildEmptyFormData = (): MachineSpecFormData => ({
  brand: '',
  model: '',
  tonelage: '',
  spec_blade: false,
  spec_pip: false,
  spec_cabin: '',
  arm_type: '',
  shoe_width_mm: '',
});

const getRangeDefaultShoeWidth = (rangeConfig: TonnageRangeConfig | null): number | null => {
  if (!rangeConfig) return null;
  if (rangeConfig.defaultShoeWidth != null) return rangeConfig.defaultShoeWidth;
  if (rangeConfig.shoeWidthOptions && rangeConfig.shoeWidthOptions.length > 0) {
    return rangeConfig.shoeWidthOptions[0];
  }
  return null;
};

/** Primer ancho de zapatas guardado en BD entre las filas del rango (no solo la primera fila). */
const resolveStoredShoeWidthFromSpecs = (rangeSpecs: MachineSpecDefault[]): number | null => {
  const found = rangeSpecs.find(
    (s) =>
      s.shoe_width_mm != null &&
      s.shoe_width_mm !== undefined &&
      Number.isFinite(Number(s.shoe_width_mm)) &&
      Number(s.shoe_width_mm) > 0
  );
  return found?.shoe_width_mm ?? null;
};

/**
 * Valor para mostrar "Zapatas: Nmm" en el resumen del grupo: BD → default del rango de toneladas.
 */
const resolveDisplayShoeWidthForGroup = (
  groupSpecs: MachineSpecDefault[],
  tonelage: string
): number | null => {
  const fromDb = resolveStoredShoeWidthFromSpecs(groupSpecs);
  if (fromDb != null) return fromDb;
  const rangeConfig = TONNAGE_RANGES.find((range) => range.range === tonelage) || null;
  return getRangeDefaultShoeWidth(rangeConfig);
};

const isMissingTableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const errorLike = error as { message?: unknown; code?: unknown };
  const message = typeof errorLike.message === 'string' ? errorLike.message.toLowerCase() : '';
  return message.includes('no existe') || errorLike.code === '42P01';
};

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

const TONELAGE_SORT_INDEX = TONNAGE_RANGES.reduce<Record<string, number>>((acc, range, index) => {
  acc[range.range] = index;
  return acc;
}, {});

const getTonelageSortIndex = (tonelage: string): number =>
  TONELAGE_SORT_INDEX[tonelage] ?? Number.MAX_SAFE_INTEGER;

const shouldHideLegacySavedSpec = (brand: string, tonelage: string): boolean => {
  const normalizedBrand = brand.trim().toUpperCase();
  const normalizedTonelage = tonelage.trim().toUpperCase().replaceAll(/\s+/g, ' ');
  const isLegacy20TonRange =
    normalizedTonelage.includes('20.0-ADELENTE TONELADAS') ||
    normalizedTonelage.includes('20.0-ADELANTE TONELADAS');
  return normalizedBrand === 'HITACHI' && isLegacy20TonRange;
};

export const MachineSpecDefaultsModal = ({ isOpen, onClose }: MachineSpecDefaultsModalProps) => {
  const [specs, setSpecs] = useState<MachineSpecDefault[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTonelage, setEditingTonelage] = useState<{ brand: string; tonelage: string } | null>(null);
  const [formData, setFormData] = useState<MachineSpecFormData>(buildEmptyFormData);
  const selectedRangeConfig = useMemo<TonnageRangeConfig | null>(() => {
    if (!formData.tonelage) return null;
    return TONNAGE_RANGES.find((range) => range.range === formData.tonelage) || null;
  }, [formData.tonelage]);

  // Opciones de ancho de zapatas (lista o campo numérico)
  const shoeWidthOptions = selectedRangeConfig?.shoeWidthOptions
    ? selectedRangeConfig.shoeWidthOptions.map((val) => ({ value: val.toString(), label: `${val} mm` }))
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
      setSpecs(data ?? []);
    } catch (error: unknown) {
      // Si la tabla no existe, simplemente mostrar lista vacía
      if (isMissingTableError(error)) {
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
    
    const sortedGroups = Array.from(groups.values());
    sortedGroups.sort((a, b) => {
      const tonelageDiff = getTonelageSortIndex(a.tonelage) - getTonelageSortIndex(b.tonelage);
      if (tonelageDiff !== 0) return tonelageDiff;
      return a.brand.localeCompare(b.brand, 'es', { sensitivity: 'base' });
    });

    return sortedGroups.filter((group) => !shouldHideLegacySavedSpec(group.brand, group.tonelage));
  }, [specs]);

  const handleEdit = (brand: string, tonelage: string) => {
    // Buscar todas las especificaciones del rango para cargar valores
    const rangeSpecs = specs.filter((s) => s.brand === brand && s.tonelage === tonelage);
    const firstSpec = rangeSpecs[0];
    
    if (firstSpec) {
      const rangeConfig = TONNAGE_RANGES.find((range) => range.range === firstSpec.tonelage);
      const fallbackShoeWidth = getRangeDefaultShoeWidth(rangeConfig || null);
      const storedShoe = resolveStoredShoeWidthFromSpecs(rangeSpecs);
      let resolvedShoeWidth = '';
      if (storedShoe != null) {
        resolvedShoeWidth = String(storedShoe);
      } else if (fallbackShoeWidth != null) {
        resolvedShoeWidth = String(fallbackShoeWidth);
      }

      setEditingTonelage({ brand, tonelage });
      // Mostrar todos los modelos existentes separados por coma
      const existingModels = rangeSpecs.map((s) => s.model).join(', ');
      setFormData({
        brand: firstSpec.brand,
        model: existingModels, // Mostrar modelos existentes
        tonelage: firstSpec.tonelage || '',
        spec_blade: firstSpec.spec_blade || false,
        spec_pip: firstSpec.spec_pip || false,
        spec_cabin: firstSpec.spec_cabin || '',
        arm_type: firstSpec.arm_type || '',
        shoe_width_mm: resolvedShoeWidth,
      });
    }
  };

  const handleCancel = () => {
    setEditingTonelage(null);
    setFormData(buildEmptyFormData());
  };

  const parseShoeWidthValue = (value: string): number | null => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return null;

    const parsedValue = Number.parseFloat(normalizedValue);
    if (Number.isNaN(parsedValue) || parsedValue <= 0) return null;
    return parsedValue;
  };

  const buildBasePayload = (shoeWidthValue: number | null): MachineSpecPayload => ({
    brand: formData.brand,
    tonelage: formData.tonelage || null,
    spec_blade: formData.spec_blade || false,
    spec_pip: formData.spec_pip || false,
    spec_cabin: formData.spec_cabin || null,
    arm_type: formData.arm_type || null,
    shoe_width_mm: shoeWidthValue,
  });

  const getNewModelsForRange = (): string[] => {
    const trimmedModels = formData.model.trim();
    if (!trimmedModels) return [];

    const modelsList = trimmedModels
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);

    const existingModels = new Set(
      specs
        .filter((spec) => spec.brand === formData.brand && spec.tonelage === formData.tonelage)
        .map((spec) => spec.model)
        .filter((model): model is string => Boolean(model))
    );

    return modelsList.filter((model) => !existingModels.has(model));
  };

  const createSpecsForModels = async (
    basePayload: MachineSpecPayload,
    models: string[]
  ): Promise<number> => {
    let createdCount = 0;

    for (const model of models) {
      try {
        await apiPost('/api/machine-spec-defaults', {
          ...basePayload,
          model,
        });
        createdCount += 1;
      } catch (error) {
        console.error(`Error creando especificación para modelo ${model}:`, error);
      }
    }

    return createdCount;
  };

  const handleSave = async () => {
    if (!formData.brand) {
      showError('Marca es requerida');
      return;
    }

    try {
      setLoading(true);
      const shoeWidthValue = parseShoeWidthValue(formData.shoe_width_mm);
      const basePayload = buildBasePayload(shoeWidthValue);

      if (editingTonelage) {
        const response = await apiPut<UpdateByTonelageResponse>(
          '/api/machine-spec-defaults/by-tonelage',
          basePayload
        );
        const updatedCount = response.updated ?? 0;
        const newModels = getNewModelsForRange();
        const createdCount = await createSpecsForModels(basePayload, newModels);
        showSuccess(`${updatedCount + createdCount} especificación(es) actualizada(s) exitosamente`);
      } else {
        const modelToCreate = formData.model.trim();
        if (!modelToCreate) {
          showError('Modelo es requerido para crear una nueva especificación');
          return;
        }

        await apiPost('/api/machine-spec-defaults', {
          ...basePayload,
          model: modelToCreate,
        });
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

  const brandSelectOptions = BRAND_OPTIONS.map((brand) => ({ value: brand, label: brand }));

  // Función para autocompletar campos según el rango de toneladas seleccionado
  const handleTonelageChange = (value: string) => {
    const rangeConfig = TONNAGE_RANGES.find((range) => range.range === value) || null;
    
    if (rangeConfig) {
      const defaultShoeWidth = getRangeDefaultShoeWidth(rangeConfig);
      const updates: Partial<typeof formData> = {
        tonelage: value,
        spec_cabin: rangeConfig.cabin || '',
        arm_type: rangeConfig.armType || '',
        spec_blade: rangeConfig.blade === true,
        spec_pip: rangeConfig.pip === true,
        shoe_width_mm: defaultShoeWidth === null ? '' : defaultShoeWidth.toString(),
      };

      setFormData({ ...formData, ...updates });
    } else {
      setFormData({ ...formData, tonelage: value });
    }
  };

  const fieldIds = {
    brand: 'machine-spec-defaults-brand',
    tonelage: 'machine-spec-defaults-tonelage',
    model: 'machine-spec-defaults-model',
    cabin: 'machine-spec-defaults-cabin',
    armType: 'machine-spec-defaults-arm-type',
    shoeWidth: 'machine-spec-defaults-shoe-width',
  };

  const groupedSpecsContent = (() => {
    if (loading && specs.length === 0) {
      return <p className="text-gray-500 text-center py-4">Cargando...</p>;
    }

    if (groupedSpecs.length === 0) {
      return <p className="text-gray-500 text-center py-4">No hay especificaciones guardadas</p>;
    }

    return (
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {groupedSpecs.map((group) => {
          const firstSpec = group.specs[0];
          const groupShoeWidthMm = resolveDisplayShoeWidthForGroup(group.specs, group.tonelage);
          const isSingleModel = group.specs.length === 1;
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
                    {group.specs.length} modelo{isSingleModel ? '' : 's'}: {group.specs.slice(0, 5).map((s) => s.model).join(', ')}
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
                {groupShoeWidthMm != null && (
                  <span className="mr-2">Zapatas: {groupShoeWidthMm}mm</span>
                )}
                {firstSpec.spec_blade && <span className="mr-2">Blade</span>}
                {firstSpec.spec_pip && <span>PIP</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  })();

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
              <label htmlFor={fieldIds.brand} className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <Select
                id={fieldIds.brand}
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                options={[{ value: '', label: 'Seleccionar...' }, ...brandSelectOptions]}
                disabled={!!editingTonelage}
              />
            </div>
            <div className="col-span-3">
              <label htmlFor={fieldIds.tonelage} className="block text-sm font-medium text-gray-700 mb-1">Rango de Toneladas</label>
              <Select
                id={fieldIds.tonelage}
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
              <label htmlFor={fieldIds.model} className="block text-sm font-medium text-gray-700 mb-1">
                Modelos {editingTonelage && '(separados por coma)'}
              </label>
              <Input
                id={fieldIds.model}
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
              <label htmlFor={fieldIds.cabin} className="block text-sm font-medium text-gray-700 mb-1">Cabina</label>
              <Select
                id={fieldIds.cabin}
                value={formData.spec_cabin}
                onChange={(e) => setFormData({ ...formData, spec_cabin: e.target.value })}
                options={CABIN_OPTIONS}
              />
            </div>
            <div>
              <label htmlFor={fieldIds.armType} className="block text-sm font-medium text-gray-700 mb-1">Tipo de Brazo</label>
              <Select
                id={fieldIds.armType}
                value={formData.arm_type}
                onChange={(e) => setFormData({ ...formData, arm_type: e.target.value })}
                options={ARM_TYPE_OPTIONS}
              />
            </div>
            <div>
              <label htmlFor={fieldIds.shoeWidth} className="block text-sm font-medium text-gray-700 mb-1">Ancho de Zapatas (mm)</label>
              {shoeWidthOptions ? (
                <Select
                  id={fieldIds.shoeWidth}
                  value={formData.shoe_width_mm}
                  onChange={(e) => setFormData({ ...formData, shoe_width_mm: e.target.value })}
                  options={[{ value: '', label: 'Seleccionar...' }, ...shoeWidthOptions]}
                />
              ) : (
                <Input
                  id={fieldIds.shoeWidth}
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
          {groupedSpecsContent}
        </div>
      </div>
    </Modal>
  );
};

