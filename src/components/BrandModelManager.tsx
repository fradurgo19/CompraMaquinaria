/**
 * Componente para gestionar marcas y modelos dinámicamente
 * Permite agregar, editar y eliminar marcas y modelos
 */

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Save, Tag, Package } from 'lucide-react';
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
}

export const BrandModelManager = ({ 
  isOpen, 
  onClose, 
  onBrandsChange, 
  onModelsChange 
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

  useEffect(() => {
    if (isOpen) {
      fetchBrands();
      fetchModels();
    }
  }, [isOpen]);

  const fetchBrands = async () => {
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
  };

  const fetchModels = async () => {
    try {
      setLoading(true);
      const data = await apiGet<Model[]>('/api/brands-and-models/models');
      setModels(data || []);
      
      // Notificar cambios
      if (onModelsChange) {
        onModelsChange(data.map(m => m.name));
      }
    } catch (error) {
      console.error('Error al cargar modelos:', error);
      showError('Error al cargar modelos');
    } finally {
      setLoading(false);
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
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Error al guardar marca';
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
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Error al guardar modelo';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = async (id: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la marca "${name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await apiDelete(`/api/brands-and-models/brands/${id}`);
      showSuccess('Marca eliminada exitosamente');
      fetchBrands();
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Error al eliminar marca';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async (id: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar el modelo "${name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await apiDelete(`/api/brands-and-models/models/${id}`);
      showSuccess('Modelo eliminado exitosamente');
      fetchModels();
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Error al eliminar modelo';
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
            {loading && brands.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Cargando...</p>
            ) : brands.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay marcas guardadas</p>
            ) : (
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
            )}
          </div>
        )}

        {/* Lista de Modelos */}
        {activeTab === 'models' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Modelos Guardados</h3>
            {loading && models.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Cargando...</p>
            ) : models.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay modelos guardados</p>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

