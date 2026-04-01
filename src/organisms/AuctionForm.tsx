/**
 * Formulario de Subasta - Actualizado para Backend Local
 */

import { useState, FormEvent, useEffect, useMemo } from 'react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { AuctionWithRelations } from '../types/database';
import { useMachines } from '../hooks/useMachines';
import { apiPost, apiPut } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../components/Toast';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { useChangeDetection } from '../hooks/useChangeDetection';
import { PriceSuggestion } from '../components/PriceSuggestion';
import { BRAND_OPTIONS } from '../constants/brands';
import { MODEL_OPTIONS } from '../constants/models';
import { getMachineSerialForDisplay, resolveSerialValueForSave } from '../utils/machineSerialDisplay';

/** YYYY-MM-DD para inputs type="date" (misma lógica que el ternario anterior, sin anidación). */
function formatAuctionDateInput(dateValue: string | Date | null | undefined): string {
  if (!dateValue) {
    return '';
  }
  if (typeof dateValue === 'string') {
    return dateValue.split('T')[0];
  }
  return new Date(dateValue).toISOString().split('T')[0];
}

/** Confirma transición GANADA → PERDIDA/PENDIENTE; false si el usuario cancela. */
function userAllowsGanadaStatusChange(
  auction: AuctionWithRelations | null | undefined,
  nextStatus: string
): boolean {
  if (auction?.status !== 'GANADA') {
    return true;
  }
  if (nextStatus !== 'PERDIDA' && nextStatus !== 'PENDIENTE') {
    return true;
  }
  const confirmMessage =
    `⚠️ ATENCIÓN: Estás cambiando esta subasta de GANADA a ${nextStatus}.\n\n` +
    `Esto eliminará automáticamente el registro de compra asociado.\n\n` +
    `¿Estás seguro de continuar?`;
  return globalThis.confirm(confirmMessage);
}

/** Subconjunto tipado de `formData` usado al persistir (helpers puros fuera del componente). */
interface AuctionPersistFormFields {
  date: string;
  lot: string;
  machine_id: string;
  brand: string;
  model: string;
  serial: string;
  year: string;
  hours: string;
  price_max: string;
  price_bought: string;
  purchase_type: string;
  supplier_id: string;
  status: string;
  comments: string;
  photos_folder_id: string;
  machine_type: string;
  wet_line: string;
  arm_type: string;
  track_width: string;
  bucket_capacity: string;
  warranty_months: string;
  warranty_hours: string;
  engine_brand: string;
  cabin_type: string;
  blade: string;
}

type AuctionChangeLogEntry = {
  field_name: string;
  field_label: string;
  old_value: string | number | null;
  new_value: string | number | null;
};

function buildNewMachinePayload(
  fd: AuctionPersistFormFields,
  storedMachineSerial: string | null | undefined
) {
  return {
    brand: fd.brand || null,
    model: fd.model,
    serial: resolveSerialValueForSave(storedMachineSerial, fd.serial),
    year: Number.parseInt(fd.year, 10),
    hours: Number.parseInt(fd.hours, 10) || 0,
    drive_folder_id: fd.photos_folder_id || null,
    machine_type: fd.machine_type || null,
    wet_line: fd.wet_line || null,
    arm_type: fd.arm_type || null,
    track_width: fd.track_width ? Number.parseFloat(fd.track_width) : null,
    bucket_capacity: fd.bucket_capacity ? Number.parseFloat(fd.bucket_capacity) : null,
    warranty_months: fd.warranty_months ? Number.parseInt(fd.warranty_months, 10) : null,
    warranty_hours: fd.warranty_hours ? Number.parseInt(fd.warranty_hours, 10) : null,
    engine_brand: fd.engine_brand || null,
    cabin_type: fd.cabin_type || null,
    blade: fd.blade || null,
  };
}

function buildAuctionUpdatePayload(
  fd: AuctionPersistFormFields,
  machineId: string,
  storedMachineSerial: string | null | undefined
) {
  return {
    date: fd.date,
    lot: fd.lot,
    machine_id: machineId,
    price_max: Number.parseFloat(fd.price_max),
    price_bought: fd.price_bought ? Number.parseFloat(fd.price_bought) : null,
    purchase_type: fd.purchase_type,
    supplier_id: fd.supplier_id,
    status: fd.status,
    comments: fd.comments || null,
    photos_folder_id: fd.photos_folder_id || null,
    brand: fd.brand || null,
    model: fd.model,
    serial: resolveSerialValueForSave(storedMachineSerial, fd.serial),
    year: Number.parseInt(fd.year, 10),
    hours: Number.parseInt(fd.hours, 10) || 0,
    machine_type: fd.machine_type || null,
    wet_line: fd.wet_line || null,
    arm_type: fd.arm_type || null,
    track_width: fd.track_width ? Number.parseFloat(fd.track_width) : null,
    bucket_capacity: fd.bucket_capacity ? Number.parseFloat(fd.bucket_capacity) : null,
    warranty_months: fd.warranty_months ? Number.parseInt(fd.warranty_months, 10) : null,
    warranty_hours: fd.warranty_hours ? Number.parseInt(fd.warranty_hours, 10) : null,
    engine_brand: fd.engine_brand || null,
    cabin_type: fd.cabin_type || null,
    blade: fd.blade || null,
  };
}

function buildAuctionCreatePayload(fd: AuctionPersistFormFields, machineId: string) {
  return {
    date: fd.date,
    lot: fd.lot,
    machine_id: machineId,
    price_max: Number.parseFloat(fd.price_max),
    price_bought: fd.price_bought ? Number.parseFloat(fd.price_bought) : null,
    purchase_type: fd.purchase_type,
    supplier_id: fd.supplier_id,
    status: fd.status,
    comments: fd.comments || null,
    photos_folder_id: fd.photos_folder_id || null,
  };
}

async function postAuctionChangeLogIfNeeded(
  auctionId: string,
  hasChanges: boolean,
  changes: AuctionChangeLogEntry[],
  changeReason: string | undefined
): Promise<void> {
  if (!hasChanges || changes.length === 0) {
    return;
  }
  try {
    await apiPost('/api/change-logs', {
      table_name: 'auctions',
      record_id: auctionId,
      changes,
      change_reason: changeReason || null,
    });
    console.log(`📝 ${changes.length} cambios registrados en Subasta`);
  } catch (logError) {
    console.error('Error registrando cambios:', logError);
  }
}

interface AuctionFormProps {
  auction?: AuctionWithRelations | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AuctionForm = ({ auction, onSuccess, onCancel }: AuctionFormProps) => {
  const { user } = useAuth();
  const { machines } = useMachines();

  const brandSelectOptions = useMemo(
    () => BRAND_OPTIONS.map((brand) => ({ value: brand, label: brand })),
    []
  );

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
    serial: getMachineSerialForDisplay(auction?.machine?.serial || ''),
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
  const [showChangeModal, setShowChangeModal] = useState(false);

  // Campos a monitorear para control de cambios
  const MONITORED_FIELDS = {
    date: 'Fecha de Subasta',
    lot: 'Lote',
    brand: 'Marca',
    model: 'Modelo',
    serial: 'Serial',
    year: 'Año',
    hours: 'Horas',
    price_max: 'Precio Máximo',
    price_bought: 'Precio Comprado',
    status: 'Estado',
    comments: 'Comentarios',
    machine_type: 'Tipo de Máquina',
    wet_line: 'Línea Húmeda',
    arm_type: 'Tipo de Brazo',
    track_width: 'Ancho Zapatas',
    bucket_capacity: 'Capacidad Cucharón',
    warranty_months: 'Garantía Meses',
    warranty_hours: 'Garantía Horas',
    engine_brand: 'Marca Motor',
    cabin_type: 'Tipo de Cabina',
    blade: 'Blade',
  };

  // Normalizar datos originales para coincidir con formData
  const normalizedOriginalData = useMemo(() => {
    if (!auction) return null;
    
    const dateFormatted = formatAuctionDateInput(auction.auction_date || auction.date);

    return {
      date: dateFormatted,
      lot: auction.lot_number || auction.lot || '',
      brand: auction.machine?.brand || '',
      model: auction.machine?.model || '',
      serial: getMachineSerialForDisplay(auction.machine?.serial || ''),
      year: auction.machine?.year?.toString() || '',
      hours: auction.machine?.hours?.toString() || '0',
      price_max: auction.max_price?.toString() || auction.price_max?.toString() || '',
      price_bought: auction.purchased_price?.toString() || auction.price_bought?.toString() || '',
      status: auction.status || 'PENDIENTE',
      comments: auction.comments || '',
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
    };
  }, [auction]);

  // Hook de detección de cambios (solo en modo edición)
  const { hasChanges, changes } = useChangeDetection(
    normalizedOriginalData, 
    auction ? formData : null, 
    MONITORED_FIELDS
  );

  // Actualizar formulario cuando cambie la subasta
  useEffect(() => {
    if (auction) {
      const dateFormatted = formatAuctionDateInput(auction.auction_date || auction.date);

      setFormData({
        date: dateFormatted,
        lot: auction.lot_number || auction.lot || '',
        machine_id: auction.machine_id || '',
        brand: auction.machine?.brand || '',
        model: auction.machine?.model || '',
        serial: getMachineSerialForDisplay(auction.machine?.serial || ''),
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
        serial: getMachineSerialForDisplay(machine.serial),
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

    // Si hay cambios y es una actualización, mostrar modal de control de cambios
    if (auction && hasChanges && changes.length > 0) {
      setShowChangeModal(true);
      return;
    }

    // Si no hay cambios, ejecutar el guardado directamente
    await saveAuction();
  };

  const saveAuction = async (changeReason?: string) => {
    if (!userAllowsGanadaStatusChange(auction, formData.status)) {
      return;
    }

    setLoading(true);
    try {
      let machineId = formData.machine_id;
      const persistFields = formData as AuctionPersistFormFields;

      if (isNewMachine || !machineId) {
        const machineData = buildNewMachinePayload(persistFields, auction?.machine?.serial);
        const response = await apiPost<{ id: string }>('/api/machines', machineData);
        machineId = response.id;
      }

      if (auction) {
        const updateData = buildAuctionUpdatePayload(persistFields, machineId, auction.machine?.serial);
        await apiPut(`/api/auctions/${auction.id}`, updateData);
        await postAuctionChangeLogIfNeeded(auction.id, hasChanges, changes as AuctionChangeLogEntry[], changeReason);
        showSuccess('Subasta actualizada exitosamente');
      } else {
        const createData = buildAuctionCreatePayload(persistFields, machineId);
        await apiPost('/api/auctions', createData);
        showSuccess('Subasta creada exitosamente');
      }

      setShowChangeModal(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving auction:', error);
      showError(error instanceof Error ? error.message : 'Error al guardar la subasta');
    } finally {
      setLoading(false);
    }
  };

  let primarySubmitLabel = 'Crear Subasta';
  if (loading) {
    primarySubmitLabel = 'Guardando...';
  } else if (auction) {
    primarySubmitLabel = 'Actualizar Subasta';
  }

  return (
    <>
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
                  label: `${m.model} - ${getMachineSerialForDisplay(m.serial)}`,
                }))
              ]}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Marca"
            value={formData.brand}
            onChange={(e) => handleChange('brand', e.target.value)}
            options={[{ value: '', label: 'Seleccione una marca' }, ...brandSelectOptions]}
            className="w-full"
          />

          <div>
            <Label required>Modelo</Label>
            <input
              list="common-models"
              value={formData.model}
              onChange={(e) => handleChange('model', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.model ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Seleccione o escriba el modelo"
              required
            />
            <datalist id="common-models">
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            {errors.model && (
              <p className="text-sm text-red-500 mt-1">{errors.model}</p>
            )}
          </div>

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
          <div className="md:col-span-2">
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
            
            {/* Sugerencia de Precio Automática */}
            {formData.model && (
              <div className="mt-3">
                <PriceSuggestion
                  type="auction"
                  model={formData.model}
                  year={formData.year ? Number.parseInt(formData.year, 10) : null}
                  hours={formData.hours ? Number.parseInt(formData.hours, 10) : null}
                  autoFetch={true}
                  onApply={(value) => handleChange('price_max', value.toString())}
                />
              </div>
            )}
          </div>

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
              { value: 'SUBASTA', label: 'BID' },
              { value: 'COMPRA_DIRECTA', label: 'CD' },
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
          {primarySubmitLabel}
        </Button>
      </div>
    </form>

      {/* Modal de Control de Cambios */}
      <ChangeLogModal
        isOpen={showChangeModal}
        changes={changes}
        onConfirm={(reason) => {
          setShowChangeModal(false);
          saveAuction(reason);
        }}
        onCancel={() => {
          setShowChangeModal(false);
          setLoading(false);
        }}
      />
    </>
  );
};
