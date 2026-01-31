/**
 * Componente para gestionar marcas y modelos dinámicamente
 * Permite agregar, editar y eliminar marcas y modelos
 */

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Edit2, Save, Tag, Package } from 'lucide-react';
import { Modal } from '../molecules/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/api';
import { showSuccess, showError } from './Toast';

interface Brand {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Model {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface BrandModelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onBrandsChange?: (brands: string[]) => void;
  onModelsChange?: (models: string[]) => void;
  // Mapeo manual marca -> modelos (sugerencias locales)
  customBrandModelMap?: Record<string, string[]>;
  onCustomMapChange?: (map: Record<string, string[]>) => void;
  // Marcas favoritas por contexto (para filtrar en selects)
  favoriteBrands?: string[];
  onFavoriteBrandsChange?: (brands: string[]) => void;
  contextLabel?: string; // Ej: "Consolidado", "Compras Nuevos"
}

export const BrandModelManager = ({ 
  isOpen, 
  onClose, 
  onBrandsChange, 
  onModelsChange,
  customBrandModelMap,
  onCustomMapChange,
  favoriteBrands,
  onFavoriteBrandsChange,
  contextLabel
}: BrandModelManagerProps) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'brands' | 'models'>('brands');
  
  // Estados para formularios
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState({ name: '' });
  const [modelForm, setModelForm] = useState({ name: '' });
  const [localCustomMap, setLocalCustomMap] = useState<Record<string, string[]>>(customBrandModelMap || {});
  const [localFavorites, setLocalFavorites] = useState<string[]>(favoriteBrands || []);
  const [selectedBrandForMap, setSelectedBrandForMap] = useState<string>('');
  const [selectedModelsForBrand, setSelectedModelsForBrand] = useState<string[]>([]);

  const fetchBrands = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<Brand[]>('/api/brands-and-models/brands');
      setBrands(data || []);
      
      // Notificar cambios
      if (onBrandsChange) {
        onBrandsChange(data.map(b => b.name));
      }
    } catch (error) {
      console.error('Error al cargar marcas:', error);
      showError('Error al cargar marcas');
    } finally {
      setLoading(false);
    }
  }, [onBrandsChange]);

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<Model[]>('/api/brands-and-models/models');
      setModels(data || []);

      if (onModelsChange) {
        onModelsChange(data.map(m => m.name));
      }
    } catch (error) {
      console.error('Error al cargar modelos:', error);
      showError('Error al cargar modelos');
    } finally {
      setLoading(false);
    }
  }, [onModelsChange]);

  useEffect(() => {
    if (isOpen) {
      fetchBrands();
      fetchModels();
      setLocalCustomMap(customBrandModelMap || {});
      setLocalFavorites(favoriteBrands || []);
    }
  }, [isOpen, customBrandModelMap, favoriteBrands, fetchBrands, fetchModels]);

  const handleSaveBrandModelMap = () => {
    if (!selectedBrandForMap) {
      showError('Selecciona una marca para asignar modelos');
      return;
    }
    const updated = {
      ...localCustomMap,
      [selectedBrandForMap]: Array.from(new Set(selectedModelsForBrand)).sort((a, b) => a.localeCompare(b)),
    };
    setLocalCustomMap(updated);
    if (onCustomMapChange) {
      onCustomMapChange(updated);
    }
    showSuccess('Relación marca/modelos guardada');
  };

  const getErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object' && 'response' in error) {
      const resp = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      if (typeof resp === 'string') return resp;
    }
    if (error instanceof Error) return error.message;
    return '';
  };

  const toggleFavorite = (brand: string) => {
    const updated = localFavorites.includes(brand)
      ? localFavorites.filter((b) => b !== brand)
      : [...localFavorites, brand];
    setLocalFavorites(updated);
    if (onFavoriteBrandsChange) {
      onFavoriteBrandsChange(updated);
    }
  };

  const handleEditBrand = (brand: Brand) => {
    setEditingBrandId(brand.id);
    setBrandForm({ name: brand.name });
  };

  const handleEditModel = (model: Model) => {
    setEditingModelId(model.id);
    setModelForm({ name: model.name });
  };

  const handleCancelEdit = () => {
    setEditingBrandId(null);
    setEditingModelId(null);
    setBrandForm({ name: '' });
    setModelForm({ name: '' });
  };

  const handleSaveBrand = async () => {
    if (!brandForm.name.trim()) {
      showError('El nombre de la marca es requerido');
      return;
    }

    try {
      setLoading(true);
      if (editingBrandId) {
        await apiPut(`/api/brands-and-models/brands/${editingBrandId}`, brandForm);
        showSuccess('Marca actualizada exitosamente');
      } else {
        await apiPost('/api/brands-and-models/brands', brandForm);
        showSuccess('Marca creada exitosamente');
      }
      handleCancelEdit();
      fetchBrands();
    } catch (error: unknown) {
      const message = getErrorMessage(error) || 'Error al guardar marca';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveModel = async () => {
    if (!modelForm.name.trim()) {
      showError('El nombre del modelo es requerido');
      return;
    }

    try {
      setLoading(true);
      if (editingModelId) {
        await apiPut(`/api/brands-and-models/models/${editingModelId}`, modelForm);
        showSuccess('Modelo actualizado exitosamente');
      } else {
        await apiPost('/api/brands-and-models/models', modelForm);
        showSuccess('Modelo creado exitosamente');
      }
      handleCancelEdit();
      fetchModels();
    } catch (error: unknown) {
      const message = getErrorMessage(error) || 'Error al guardar modelo';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = async (id: string, name: string) => {
    if (!globalThis.confirm(`¿Estás seguro de eliminar la marca "${name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await apiDelete(`/api/brands-and-models/brands/${id}`);
      showSuccess('Marca eliminada exitosamente');
      fetchBrands();
    } catch (error: unknown) {
      const message = getErrorMessage(error) || 'Error al eliminar marca';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async (id: string, name: string) => {
    if (!globalThis.confirm(`¿Estás seguro de eliminar el modelo "${name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await apiDelete(`/api/brands-and-models/models/${id}`);
      showSuccess('Modelo eliminado exitosamente');
      fetchModels();
    } catch (error: unknown) {
      const message = getErrorMessage(error) || 'Error al eliminar modelo';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestionar Marcas y Modelos">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => {
              setActiveTab('brands');
              handleCancelEdit();
            }}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'brands'
                ? 'text-[#cf1b22] border-b-2 border-[#cf1b22]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              <span>Marcas ({brands.length})</span>
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab('models');
              handleCancelEdit();
            }}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'models'
                ? 'text-[#cf1b22] border-b-2 border-[#cf1b22]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span>Modelos ({models.length})</span>
            </div>
          </button>
        </div>

        {/* Formulario de Marca */}
        {activeTab === 'brands' && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 p-4 rounded-lg border border-red-100">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#cf1b22]" />
              {editingBrandId ? 'Editar Marca' : 'Nueva Marca'}
            </h3>
            
            <div className="flex gap-2">
              <Input
                type="text"
                value={brandForm.name}
                onChange={(e) => setBrandForm({ name: e.target.value.toUpperCase() })}
                placeholder="Ej: CATERPILLAR"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveBrand();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <Button
                onClick={handleSaveBrand}
                disabled={loading || !brandForm.name.trim()}
                className="bg-[#cf1b22] text-white hover:bg-primary-700 flex items-center gap-2 px-4"
              >
                <Save className="w-4 h-4" />
                {editingBrandId ? 'Actualizar' : 'Agregar'}
              </Button>
              {editingBrandId && (
                <Button
                  onClick={handleCancelEdit}
                  className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Formulario de Modelo */}
        {activeTab === 'models' && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#cf1b22]" />
              {editingModelId ? 'Editar Modelo' : 'Nuevo Modelo'}
            </h3>
            
            <div className="flex gap-2">
              <Input
                type="text"
                value={modelForm.name}
                onChange={(e) => setModelForm({ name: e.target.value })}
                placeholder="Ej: ZX200-6"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveModel();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <Button
                onClick={handleSaveModel}
                disabled={loading || !modelForm.name.trim()}
                className="bg-[#cf1b22] text-white hover:bg-primary-700 flex items-center gap-2 px-4"
              >
                <Save className="w-4 h-4" />
                {editingModelId ? 'Actualizar' : 'Agregar'}
              </Button>
              {editingModelId && (
                <Button
                  onClick={handleCancelEdit}
                  className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lista de Marcas */}
        {activeTab === 'brands' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Marcas Guardadas</h3>
            {(() => {
              if (loading && brands.length === 0) return <p className="text-gray-500 text-center py-4">Cargando...</p>;
              if (brands.length === 0) return <p className="text-gray-500 text-center py-4">No hay marcas guardadas</p>;
              return (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{brand.name}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEditBrand(brand)}
                        disabled={loading}
                        className="bg-blue-500 text-white hover:bg-blue-600 px-3 py-1 text-xs flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        Editar
                      </Button>
                      <Button
                        onClick={() => handleDeleteBrand(brand.id, brand.name)}
                        disabled={loading}
                        className="bg-red-500 text-white hover:bg-red-600 px-3 py-1 text-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              );
            })()}
          </div>
        )}

        {/* Lista de Modelos */}
        {activeTab === 'models' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Modelos Guardados</h3>
            {(() => {
              if (loading && models.length === 0) return <p className="text-gray-500 text-center py-4">Cargando...</p>;
              if (models.length === 0) return <p className="text-gray-500 text-center py-4">No hay modelos guardados</p>;
              return (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{model.name}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEditModel(model)}
                        disabled={loading}
                        className="bg-blue-500 text-white hover:bg-blue-600 px-3 py-1 text-xs flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        Editar
                      </Button>
                      <Button
                        onClick={() => handleDeleteModel(model.id, model.name)}
                        disabled={loading}
                        className="bg-red-500 text-white hover:bg-red-600 px-3 py-1 text-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              );
            })()}
          </div>
        )}

        {/* Asignar modelos a marca (sugerencias locales) */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#cf1b22]" />
            Asignar modelos a marca (solo sugerencias locales)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="brand-select-map" className="block text-xs font-medium text-gray-600 mb-1">Marca</label>
              <select
                id="brand-select-map"
                value={selectedBrandForMap}
                onChange={(e) => setSelectedBrandForMap(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            <fieldset className="border-0 p-0 m-0">
              <legend className="block text-xs font-medium text-gray-600 mb-1">Modelos</legend>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
                {models.map((m) => {
                  const checked = selectedModelsForBrand.includes(m.name);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) {
                            setSelectedModelsForBrand(selectedModelsForBrand.filter((x) => x !== m.name));
                          } else {
                            setSelectedModelsForBrand([...selectedModelsForBrand, m.name]);
                          }
                        }}
                      />
                      <span>{m.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveBrandModelMap}
              className="bg-[#cf1b22] text-white hover:bg-primary-700 flex items-center gap-2 px-4"
              disabled={loading}
            >
              <Save className="w-4 h-4" />
              Guardar relación
            </Button>
            {selectedBrandForMap && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedModelsForBrand(localCustomMap[selectedBrandForMap] || []);
                }}
              >
                Cargar asignados
              </Button>
            )}
          </div>
          {selectedBrandForMap && localCustomMap[selectedBrandForMap] && localCustomMap[selectedBrandForMap].length > 0 && (
            <div className="text-sm text-gray-700">
              <strong>Asignados:</strong> {localCustomMap[selectedBrandForMap].join(', ')}
            </div>
          )}
        </div>

        {/* Marcas favoritas (para priorizar en selects) */}
        <div className="border-t pt-4 space-y-2">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#cf1b22]" />
            Marcas frecuentes {contextLabel ? `(${contextLabel})` : ''}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {brands.map((b) => {
              const checked = localFavorites.includes(b.name);
              return (
                <label key={b.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFavorite(b.name)}
                  />
                  <span>{b.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};

