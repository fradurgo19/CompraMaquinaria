/**
 * Formulario de Preselección
 * Módulo previo a subastas para evaluación de equipos
 */

import { useState, FormEvent, useEffect } from 'react';
import { Input } from '../atoms/Input';
import { Button } from '../atoms/Button';
import { PreselectionWithRelations } from '../types/database';
import { apiPost, apiPut } from '../services/api';
import { showSuccess, showError } from '../components/Toast';

interface PreselectionFormProps {
  preselection?: PreselectionWithRelations | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// Lista de proveedores de subastas
const AUCTION_SUPPLIERS = [
  'KANEHARU',
  'KENKI HIT',
  'JEN CORP',
  'EIKOH',
  'KATA',
  'SOGO',
  'TOYOKAMI',
  'HITACHI',
  'WAKITA',
  'GUIA',
  'ONAGA',
  'THI',
  'GREEN AUCTION',
  'JEN',
  'HIT',
  'TOZAI',
  'RICHIE BROS',
  'KIXNET',
  'PROXYBID',
  'GIOA'
];

export const PreselectionForm = ({ preselection, onSuccess, onCancel }: PreselectionFormProps) => {
  const [formData, setFormData] = useState({
    supplier_name: preselection?.supplier_name || '',
    auction_date: preselection?.auction_date?.split('T')[0] || '',
    lot_number: preselection?.lot_number || '',
    brand: preselection?.brand || '',
    model: preselection?.model || '',
    serial: preselection?.serial || '',
    year: preselection?.year?.toString() || '',
    hours: preselection?.hours?.toString() || '',
    suggested_price: preselection?.suggested_price?.toString() || '',
    auction_url: preselection?.auction_url || '',
    comments: preselection?.comments || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.supplier_name) newErrors.supplier_name = 'Proveedor requerido';
    if (!formData.auction_date) newErrors.auction_date = 'Fecha requerida';
    if (!formData.lot_number) newErrors.lot_number = 'Número de lote requerido';
    if (!formData.model) newErrors.model = 'Modelo requerido';
    if (!formData.serial) newErrors.serial = 'Serial requerido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showError('Por favor completa los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        supplier_name: formData.supplier_name,
        auction_date: formData.auction_date,
        lot_number: formData.lot_number,
        brand: formData.brand || null,
        model: formData.model,
        serial: formData.serial,
        year: formData.year ? parseInt(formData.year) : null,
        hours: formData.hours ? parseInt(formData.hours) : null,
        suggested_price: formData.suggested_price ? parseFloat(formData.suggested_price) : null,
        auction_url: formData.auction_url || null,
        comments: formData.comments || null,
      };

      if (preselection) {
        await apiPut(`/api/preselections/${preselection.id}`, payload);
        showSuccess('Preselección actualizada exitosamente');
      } else {
        await apiPost('/api/preselections', payload);
        showSuccess('Preselección creada exitosamente');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error al guardar preselección:', error);
      showError(error.message || 'Error al guardar preselección');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sección: Información de la Subasta */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-medium mb-4 text-gray-800">Información de la Subasta</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.supplier_name}
              onChange={(e) => handleChange('supplier_name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.supplier_name ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            >
              <option value="">-- Seleccionar Proveedor --</option>
              {AUCTION_SUPPLIERS.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
            {errors.supplier_name && (
              <p className="text-red-500 text-xs mt-1">{errors.supplier_name}</p>
            )}
          </div>

          <Input
            label="Fecha de Subasta"
            type="date"
            value={formData.auction_date}
            onChange={(e) => handleChange('auction_date', e.target.value)}
            error={errors.auction_date}
            required
          />

          <Input
            label="Número de Lote"
            value={formData.lot_number}
            onChange={(e) => handleChange('lot_number', e.target.value)}
            error={errors.lot_number}
            required
            placeholder="Ej: LOT-001"
          />

          <Input
            label="URL de la Subasta"
            type="url"
            value={formData.auction_url}
            onChange={(e) => handleChange('auction_url', e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      {/* Sección: Información del Equipo */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-medium mb-4 text-gray-800">Información del Equipo</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Marca"
            value={formData.brand}
            onChange={(e) => handleChange('brand', e.target.value)}
            placeholder="Ej: CAT, KOMATSU, HITACHI"
          />

          <Input
            label="Modelo"
            value={formData.model}
            onChange={(e) => handleChange('model', e.target.value)}
            error={errors.model}
            required
            placeholder="Ej: PC200-8, 320D"
          />

          <Input
            label="Serial"
            value={formData.serial}
            onChange={(e) => handleChange('serial', e.target.value)}
            error={errors.serial}
            required
            placeholder="Ej: ABC12345"
          />

          <Input
            label="Año"
            type="number"
            value={formData.year}
            onChange={(e) => handleChange('year', e.target.value)}
            min="1990"
            max="2025"
            placeholder="Ej: 2020"
          />

          <Input
            label="Horas de Operación"
            type="number"
            value={formData.hours}
            onChange={(e) => handleChange('hours', e.target.value)}
            min="0"
            placeholder="Ej: 5000"
          />

          <Input
            label="Precio Sugerido (USD)"
            type="number"
            step="0.01"
            value={formData.suggested_price}
            onChange={(e) => handleChange('suggested_price', e.target.value)}
            placeholder="45000"
          />
        </div>
      </div>

      {/* Sección: Comentarios */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Comentarios
        </label>
        <textarea
          value={formData.comments}
          onChange={(e) => handleChange('comments', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Observaciones sobre el equipo..."
        />
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
        >
          {loading ? 'Guardando...' : preselection ? 'Actualizar' : 'Crear Preselección'}
        </Button>
      </div>
    </form>
  );
};

