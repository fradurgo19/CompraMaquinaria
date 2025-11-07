/**
 * Formulario de Subasta - Actualizado para Backend Local
 */

import { useState, FormEvent, useEffect } from 'react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { AuctionWithRelations, PurchaseType, AuctionStatus } from '../types/database';
import { useSuppliers } from '../hooks/useSuppliers';
import { useMachines } from '../hooks/useMachines';
import { apiPost, apiPut } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../components/Toast';

interface AuctionFormProps {
  auction?: AuctionWithRelations | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AuctionForm = ({ auction, onSuccess, onCancel }: AuctionFormProps) => {
  const { user } = useAuth();
  const { suppliers } = useSuppliers();
  const { machines } = useMachines();

  // Lista específica de proveedores para subastas
  const auctionSuppliers = [
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

  // Convertir fecha a formato YYYY-MM-DD
  const getFormattedDate = () => {
    const dateValue = auction?.auction_date || auction?.date || '';
    if (!dateValue) return '';
    
    if (typeof dateValue === 'string') {
      return dateValue.split('T')[0];
    }
    
    return new Date(dateValue).toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    date: getFormattedDate(),
    lot: auction?.lot_number || auction?.lot || '',
    machine_id: auction?.machine_id || '',
    brand: auction?.machine?.brand || '',
    model: auction?.machine?.model || '',
    serial: auction?.machine?.serial || '',
    year: auction?.machine?.year?.toString() || '',
    hours: auction?.machine?.hours?.toString() || '0',
    price_max: auction?.max_price?.toString() || auction?.price_max?.toString() || '',
    price_bought: auction?.purchased_price?.toString() || auction?.price_bought?.toString() || '',
    purchase_type: auction?.purchase_type || 'SUBASTA',
    supplier_id: auction?.supplier_id || '',
    status: auction?.status || 'PENDIENTE',
    comments: auction?.comments || '',
    photos_folder_id: auction?.photos_folder_id || '',
    // Especificaciones técnicas
    machine_type: auction?.machine?.machine_type || '',
    wet_line: auction?.machine?.wet_line || '',
    arm_type: auction?.machine?.arm_type || '',
    track_width: auction?.machine?.track_width?.toString() || '',
    bucket_capacity: auction?.machine?.bucket_capacity?.toString() || '',
    warranty_months: auction?.machine?.warranty_months?.toString() || '',
    warranty_hours: auction?.machine?.warranty_hours?.toString() || '',
    engine_brand: auction?.machine?.engine_brand || '',
    cabin_type: auction?.machine?.cabin_type || '',
    blade: auction?.machine?.blade || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isNewMachine, setIsNewMachine] = useState(!auction);

  // Actualizar formulario cuando cambie la subasta
  useEffect(() => {
    if (auction) {
      // Convertir fecha
      const dateValue = auction.auction_date || auction.date;
      const dateFormatted = dateValue 
        ? (typeof dateValue === 'string' ? dateValue.split('T')[0] : new Date(dateValue).toISOString().split('T')[0])
        : '';
      
      setFormData({
        date: dateFormatted,
        lot: auction.lot_number || auction.lot || '',
        machine_id: auction.machine_id || '',
        brand: auction.machine?.brand || '',
        model: auction.machine?.model || '',
        serial: auction.machine?.serial || '',
        year: auction.machine?.year?.toString() || '',
        hours: auction.machine?.hours?.toString() || '0',
        price_max: auction.max_price?.toString() || auction.price_max?.toString() || '',
        price_bought: auction.purchased_price?.toString() || auction.price_bought?.toString() || '',
        purchase_type: auction.purchase_type || 'SUBASTA',
        supplier_id: auction.supplier_id || '',
        status: auction.status || 'PENDIENTE',
        comments: auction.comments || '',
        photos_folder_id: auction.photos_folder_id || '',
        // Especificaciones técnicas
        machine_type: auction.machine?.machine_type || '',
        wet_line: auction.machine?.wet_line || '',
        arm_type: auction.machine?.arm_type || '',
        track_width: auction.machine?.track_width?.toString() || '',
        bucket_capacity: auction.machine?.bucket_capacity?.toString() || '',
        warranty_months: auction.machine?.warranty_months?.toString() || '',
        warranty_hours: auction.machine?.warranty_hours?.toString() || '',
        engine_brand: auction.machine?.engine_brand || '',
        cabin_type: auction.machine?.cabin_type || '',
        blade: auction.machine?.blade || '',
      });
    }
  }, [auction]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleMachineSelect = (machineId: string) => {
    const machine = machines.find((m) => m.id === machineId);
    if (machine) {
      setFormData((prev) => ({
        ...prev,
        machine_id: machineId,
        brand: machine.brand || '',
        model: machine.model,
        serial: machine.serial,
        year: machine.year.toString(),
        hours: machine.hours.toString(),
        // Especificaciones técnicas
        machine_type: machine.machine_type || '',
        wet_line: machine.wet_line || '',
        arm_type: machine.arm_type || '',
        track_width: machine.track_width?.toString() || '',
        bucket_capacity: machine.bucket_capacity?.toString() || '',
        warranty_months: machine.warranty_months?.toString() || '',
        warranty_hours: machine.warranty_hours?.toString() || '',
        engine_brand: machine.engine_brand || '',
        cabin_type: machine.cabin_type || '',
        blade: machine.blade || '',
      }));
      setIsNewMachine(false);
    } else {
      setIsNewMachine(true);
      setFormData((prev) => ({
        ...prev,
        machine_id: '',
        brand: '',
        model: '',
        serial: '',
        year: '',
        hours: '0',
        // Resetear especificaciones
        machine_type: '',
        wet_line: '',
        arm_type: '',
        track_width: '',
        bucket_capacity: '',
        warranty_months: '',
        warranty_hours: '',
        engine_brand: '',
        cabin_type: '',
        blade: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = 'Fecha requerida';
    if (!formData.lot) newErrors.lot = 'Número de lote requerido';
    if (!formData.model) newErrors.model = 'Modelo requerido';
    if (!formData.serial) newErrors.serial = 'Serial requerido';
    if (!formData.year) newErrors.year = 'Año requerido';
    if (!formData.price_max) newErrors.price_max = 'Precio máximo requerido';
    if (!formData.supplier_id) newErrors.supplier_id = 'Proveedor requerido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !user) return;

    // Verificar si estamos cambiando de GANADA a PERDIDA o PENDIENTE
    if (auction && auction.status === 'GANADA') {
      if (formData.status === 'PERDIDA' || formData.status === 'PENDIENTE') {
        const confirmMessage = `⚠️ ATENCIÓN: Estás cambiando esta subasta de GANADA a ${formData.status}.\n\n` +
          `Esto eliminará automáticamente el registro de compra asociado.\n\n` +
          `¿Estás seguro de continuar?`;
        
        if (!window.confirm(confirmMessage)) {
          return; // Cancelar si el usuario no confirma
        }
      }
    }

    setLoading(true);
    try {
      let machineId = formData.machine_id;

      // Crear o actualizar máquina primero si es nueva
      if (isNewMachine || !machineId) {
        const machineData = {
          brand: formData.brand || null,
          model: formData.model,
          serial: formData.serial,
          year: parseInt(formData.year),
          hours: parseInt(formData.hours) || 0,
          drive_folder_id: formData.photos_folder_id || null,
          // Especificaciones técnicas
          machine_type: formData.machine_type || null,
          wet_line: formData.wet_line || null,
          arm_type: formData.arm_type || null,
          track_width: formData.track_width ? parseFloat(formData.track_width) : null,
          bucket_capacity: formData.bucket_capacity ? parseFloat(formData.bucket_capacity) : null,
          warranty_months: formData.warranty_months ? parseInt(formData.warranty_months) : null,
          warranty_hours: formData.warranty_hours ? parseInt(formData.warranty_hours) : null,
          engine_brand: formData.engine_brand || null,
          cabin_type: formData.cabin_type || null,
          blade: formData.blade || null,
        };

        const response = await apiPost<any>('/api/machines', machineData);
        machineId = response.id;
      }

      // Datos completos para actualizar (incluye campos de máquina)
      const updateData = {
        // Campos de subasta
        date: formData.date,
        lot: formData.lot,
        machine_id: machineId,
        price_max: parseFloat(formData.price_max),
        price_bought: formData.price_bought ? parseFloat(formData.price_bought) : null,
        purchase_type: formData.purchase_type,
        supplier_id: formData.supplier_id,
        status: formData.status,
        comments: formData.comments || null,
        photos_folder_id: formData.photos_folder_id || null,
        // Campos de máquina (para actualización)
        brand: formData.brand || null,
        model: formData.model,
        serial: formData.serial,
        year: parseInt(formData.year),
        hours: parseInt(formData.hours) || 0,
        // Especificaciones técnicas (para actualización de máquina)
        machine_type: formData.machine_type || null,
        wet_line: formData.wet_line || null,
        arm_type: formData.arm_type || null,
        track_width: formData.track_width ? parseFloat(formData.track_width) : null,
        bucket_capacity: formData.bucket_capacity ? parseFloat(formData.bucket_capacity) : null,
        warranty_months: formData.warranty_months ? parseInt(formData.warranty_months) : null,
        warranty_hours: formData.warranty_hours ? parseInt(formData.warranty_hours) : null,
        engine_brand: formData.engine_brand || null,
        cabin_type: formData.cabin_type || null,
        blade: formData.blade || null,
      };

      if (auction) {
        // Actualizar subasta existente
        await apiPut(`/api/auctions/${auction.id}`, updateData);
        showSuccess('Subasta actualizada exitosamente');
      } else {
        // Para crear, solo datos de subasta (la máquina ya se creó arriba)
        const createData = {
          date: formData.date,
          lot: formData.lot,
          machine_id: machineId,
          price_max: parseFloat(formData.price_max),
          price_bought: formData.price_bought ? parseFloat(formData.price_bought) : null,
          purchase_type: formData.purchase_type,
          supplier_id: formData.supplier_id,
          status: formData.status,
          comments: formData.comments || null,
          photos_folder_id: formData.photos_folder_id || null,
        };
        await apiPost('/api/auctions', createData);
        showSuccess('Subasta creada exitosamente');
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving auction:', error);
      showError(error instanceof Error ? error.message : 'Error al guardar la subasta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Fecha de Subasta"
          type="date"
          value={formData.date}
          onChange={(e) => handleChange('date', e.target.value)}
          error={errors.date}
          required
        />

        <Input
          label="Número de Lote"
          value={formData.lot}
          onChange={(e) => handleChange('lot', e.target.value)}
          error={errors.lot}
          required
        />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4 text-gray-800">Información de la Máquina</h3>

        {!auction && (
          <div className="mb-4">
            <Select
              label="Seleccionar Máquina Existente (opcional)"
              value={formData.machine_id}
              onChange={(e) => handleMachineSelect(e.target.value)}
              options={[
                { value: '', label: '-- Nueva Máquina --' },
                ...machines.map((m) => ({
                  value: m.id,
                  label: `${m.model} - ${m.serial}`,
                }))
              ]}
            />
          </div>
        )}

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
            error={errors.year}
            required
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
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4 text-brand-gray">Especificaciones Técnicas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Tipo de Máquina"
            value={formData.machine_type}
            onChange={(e) => handleChange('machine_type', e.target.value)}
            placeholder="Ej: EXCAVADORA"
          />

          <Select
            label="Línea Húmeda"
            value={formData.wet_line}
            onChange={(e) => handleChange('wet_line', e.target.value)}
            options={[
              { value: '', label: 'Seleccionar...' },
              { value: 'SI', label: 'SI' },
              { value: 'No', label: 'No' },
            ]}
          />

          <Select
            label="Tipo de Brazo"
            value={formData.arm_type}
            onChange={(e) => handleChange('arm_type', e.target.value)}
            options={[
              { value: '', label: 'Seleccionar...' },
              { value: 'ESTANDAR', label: 'ESTANDAR' },
              { value: 'N/A', label: 'N/A' },
            ]}
          />

          <Input
            label="Ancho de Zapatas (mm)"
            type="number"
            step="0.01"
            value={formData.track_width}
            onChange={(e) => handleChange('track_width', e.target.value)}
            placeholder="Ej: 600"
          />

          <Input
            label="Capacidad Cucharón (m³)"
            type="number"
            step="0.01"
            value={formData.bucket_capacity}
            onChange={(e) => handleChange('bucket_capacity', e.target.value)}
            placeholder="Ej: 0.8"
          />

          <Select
            label="Blade (Cuchilla)"
            value={formData.blade}
            onChange={(e) => handleChange('blade', e.target.value)}
            options={[
              { value: '', label: 'Seleccionar...' },
              { value: 'SI', label: 'SI' },
              { value: 'No', label: 'No' },
            ]}
          />

          <Input
            label="Garantía (Meses)"
            type="number"
            value={formData.warranty_months}
            onChange={(e) => handleChange('warranty_months', e.target.value)}
            placeholder="Ej: 6"
          />

          <Input
            label="Garantía (Horas)"
            type="number"
            value={formData.warranty_hours}
            onChange={(e) => handleChange('warranty_hours', e.target.value)}
            placeholder="Ej: 1000"
          />

          <Select
            label="Marca del Motor"
            value={formData.engine_brand}
            onChange={(e) => handleChange('engine_brand', e.target.value)}
            options={[
              { value: '', label: 'Seleccionar...' },
              { value: 'N/A', label: 'N/A' },
              { value: 'ISUZU', label: 'ISUZU' },
              { value: 'MITSUBISHI', label: 'MITSUBISHI' },
              { value: 'FPT', label: 'FPT' },
              { value: 'YANMAR', label: 'YANMAR' },
              { value: 'KUBOTA', label: 'KUBOTA' },
              { value: 'PERKINS', label: 'PERKINS' },
              { value: 'CUMMINS', label: 'CUMMINS' },
              { value: 'CATERPILLAR', label: 'CATERPILLAR' },
              { value: 'KOMATSU', label: 'KOMATSU' },
            ]}
          />

          <Select
            label="Tipo de Cabina"
            value={formData.cabin_type}
            onChange={(e) => handleChange('cabin_type', e.target.value)}
            options={[
              { value: '', label: 'Seleccionar...' },
              { value: 'N/A', label: 'N/A' },
              { value: 'CABINA CERRADA / AIRE ACONDICIONADO', label: 'CABINA CERRADA / A/C' },
              { value: 'CANOPY', label: 'CANOPY' },
            ]}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4 text-gray-800">Detalles de la Subasta</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Precio Máximo (USD)"
            type="number"
            step="0.01"
            value={formData.price_max}
            onChange={(e) => handleChange('price_max', e.target.value)}
            error={errors.price_max}
            required
            placeholder="50000"
          />

          <Input
            label="Precio de Compra (USD)"
            type="number"
            step="0.01"
            value={formData.price_bought}
            onChange={(e) => handleChange('price_bought', e.target.value)}
            placeholder="48000"
          />

          <Select
            label="Tipo de Compra"
            value={formData.purchase_type}
            onChange={(e) => handleChange('purchase_type', e.target.value)}
            options={[
              { value: 'SUBASTA', label: 'Subasta' },
              { value: 'COMPRA_DIRECTA', label: 'Compra Directa' },
            ]}
            required
          />

          <Select
            label="Proveedor"
            value={formData.supplier_id}
            onChange={(e) => handleChange('supplier_id', e.target.value)}
            options={[
              { value: '', label: '-- Seleccionar Proveedor --' },
              ...auctionSuppliers.map((supplier) => ({ 
                value: supplier, 
                label: supplier 
              }))
            ]}
            error={errors.supplier_id}
            required
          />

          <Select
            label="Estado"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            options={[
              { value: 'PENDIENTE', label: 'Pendiente' },
              { value: 'GANADA', label: 'Ganada' },
              { value: 'PERDIDA', label: 'Perdida' },
            ]}
            required
          />
        </div>

        <div className="mt-4">
          <Label>Comentarios</Label>
          <textarea
            value={formData.comments}
            onChange={(e) => handleChange('comments', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red transition-all"
            placeholder="Observaciones sobre la subasta..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-4 border-t pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={loading}
          className="bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700"
        >
          {loading ? 'Guardando...' : auction ? 'Actualizar Subasta' : 'Crear Subasta'}
        </Button>
      </div>
    </form>
  );
};
