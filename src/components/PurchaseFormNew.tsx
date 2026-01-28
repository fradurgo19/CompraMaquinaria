/**
 * Formulario de Compra (Nueva Versión)
 * Eliana diligencia manualmente con info de correo y pagos a proveedores
 */

import { useState, FormEvent, useEffect, useMemo } from 'react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../components/Toast';
import { apiPost, apiPut } from '../services/api';
import { MachineFiles } from './MachineFiles';
import { ChangeLogModal } from './ChangeLogModal';
import { useChangeDetection } from '../hooks/useChangeDetection';
import { PurchaseWithRelations } from '../types/database';

// Lista de proveedores específica para new-purchases (módulo independiente)
// Solo estos proveedores específicos - SOLO para compras nuevas
export const NEW_PURCHASE_SUPPLIERS = [
  'HITACHI',
  'CASE',
  'YANMAR',
  'DYNAPAC',
  'LIUGONG',
  'AMMANN',
  'GREENAUCT / J&F',
  'JEN/TRANSFERIDO A ONAGA',
  'NDT / J&F',
  'NORI/JEN',
  'PQ USA / MULTISERVICIOS',
  'PQ USA / RITCHIE BROS',
  'PQ USA / RITCHIE BROS CANADA',
  'PQ USA / ROYAL',
  'REIBRIDGE INC',
  'THI / J&F',
];

const SHIPMENT_TYPES = ['1X40', 'RORO'];
const LOCATIONS = [
  'NARITA', 'KOBE', 'YOKOHAMA', 'HAKATA', 'TOMAKOMAI', 
  'LAKE WORTH', 'SAKURA', 'LEBANON', 'FUJI', 'NAGOYA', 
  'HOKKAIDO', 'OSAKA', 'ALBERTA', 'FLORIDA', 'HYOGO', 
  'KASHIBA', 'MIAMI', 'BOSTON'
];
const CURRENCIES = ['JPY', 'USD', 'EUR'];
const INCOTERMS = ['FOB', 'EXY', 'CIF'];
const PORTS = [
  'AMBERES',
  'AMSTERDAM',
  'BALTIMORE',
  'CANADA',
  'HAKATA',
  'JACKSONVILLE',
  'KOBE',
  'MIAMI',
  'NAGOYA',
  'SAVANNA',
  'TIANJIN',
  'YOKOHAMA',
  'ZEEBRUGE',
];
const REPORT_STATUSES = ['OK', 'PDTE'];
// EMPRESA_OPTIONS removido - campo empresa ahora se maneja solo por backend
// CPD ahora es un checkbox: VERDE o ROJA

interface PurchaseFormProps {
  purchase?: PurchaseWithRelations | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PurchaseFormNew = ({ purchase, onSuccess, onCancel }: PurchaseFormProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tempMachineId, setTempMachineId] = useState<string | null>(purchase?.machine_id || null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<Record<string, unknown> | null>(null);

  const [formData, setFormData] = useState({
    shipment_type_v2: purchase?.shipment_type_v2 || '1X40',
    supplier_name: purchase?.supplier_name || '',
    invoice_date: purchase?.invoice_date || '',
    
    model: purchase?.model || '',
    serial: purchase?.serial || '',
    
    // Documentación
    purchase_order: purchase?.purchase_order || '',
    invoice_number: purchase?.invoice_number || '',
    
    // Ubicación y moneda
    location: purchase?.location || '',
    currency_type: purchase?.currency_type || 'JPY',
    incoterm: purchase?.incoterm || 'EXW',
    port_of_embarkation: purchase?.port_of_embarkation || '',
    cpd: purchase?.cpd || '',
    
    // Valores monetarios
    exw_value_formatted: purchase?.exw_value_formatted || '',
    fob_expenses: purchase?.fob_expenses || '',
    disassembly_load_value: purchase?.disassembly_load_value || 0,
    
    // Estados de reporte
    sales_reported: purchase?.sales_reported || 'PDTE',
    commerce_reported: purchase?.commerce_reported || 'PDTE',
    luis_lemus_reported: purchase?.luis_lemus_reported || 'PDTE',
    
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Campos a monitorear para control de cambios
  const MONITORED_FIELDS = {
    supplier_name: 'Proveedor',
    shipment_type_v2: 'Tipo de Envío',
    invoice_date: 'Fecha de Factura',
    purchase_order: 'Orden de Compra',
    invoice_number: 'No. Factura Proforma',
    location: 'Ubicación',
    port_of_embarkation: 'Puerto de Embarque',
    currency_type: 'Moneda',
    incoterm: 'Incoterm',
    cpd: 'CPD',
    exw_value_formatted: 'Valor + BP',
    fob_expenses: 'Gastos FOB + Lavado',
    disassembly_load_value: 'Desensamblaje + Cargue',
    sales_reported: 'Reportado a Ventas',
    commerce_reported: 'Reportado a Comercio',
    luis_lemus_reported: 'Reporte a Luis Lemus',
  };

  // Hook de detección de cambios
  const { hasChanges, changes } = useChangeDetection(
    purchase, 
    formData, 
    MONITORED_FIELDS
  );

  const EDITABLE_FIELDS: Array<keyof typeof formData> = [
    'supplier_name',
    'shipment_type_v2',
    'invoice_date',
    'purchase_order',
    'invoice_number',
    'location',
    'currency_type',
    'incoterm',
    'port_of_embarkation',
    'cpd',
    'exw_value_formatted',
    'fob_expenses',
    'disassembly_load_value',
    'sales_reported',
    'commerce_reported',
    'luis_lemus_reported',
  ];

  const buildEditPayload = () => {
    return EDITABLE_FIELDS.reduce<Record<string, unknown>>((acc, field) => {
      acc[field] = formData[field];
      return acc;
    }, {});
  };

  useEffect(() => {
    // Sincronizar formData cuando cambia el purchase
    if (purchase) {
      console.log('🔄 Cargando purchase para editar:', {
        id: purchase.id,
        supplier_name: purchase.supplier_name
      });
      
      // Formatear fechas a YYYY-MM-DD para inputs de tipo date
      const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          return date.toISOString().split('T')[0];
        } catch {
          return dateStr;
        }
      };

      // Obtener model y serial: primero del nivel superior (JOIN), luego de machine
      const model = purchase.model || purchase.machine?.model || '';
      const serial = purchase.serial || purchase.machine?.serial || '';
      
      // Asegurar que supplier_name se cargue correctamente, incluso si no está en la lista
      const supplierName = purchase.supplier_name || purchase.supplier?.name || '';
      
      setFormData(prev => ({
        ...prev,
        shipment_type_v2: purchase.shipment_type_v2 || '1X40',
        supplier_name: supplierName, // Usar el valor exacto de la BD
        invoice_date: formatDate(purchase.invoice_date),
        model: model,
        serial: serial,
        purchase_order: purchase.purchase_order || '',
        invoice_number: purchase.invoice_number || '',
        location: purchase.location || '',
        currency_type: purchase.currency_type || 'JPY',
        incoterm: purchase.incoterm || 'EXW',
        port_of_embarkation: purchase.port_of_embarkation || '',
        cpd: purchase.cpd || '',
        exw_value_formatted: purchase.exw_value_formatted || '',
        fob_expenses: purchase.fob_expenses || '',
        disassembly_load_value: purchase.disassembly_load_value || 0,
        sales_reported: purchase.sales_reported || 'PDTE',
        commerce_reported: purchase.commerce_reported || 'PDTE',
        luis_lemus_reported: purchase.luis_lemus_reported || 'PDTE',
      }));
      
      console.log('✅ FormData actualizado con supplier_name:', supplierName);
    }
  }, [purchase]);

  const supplierOptions = useMemo(() => {
    const currentSupplier = formData.supplier_name;
    
    const supplierList = NEW_PURCHASE_SUPPLIERS;
    const hasCurrentInList = supplierList.includes(currentSupplier);

    const options = supplierList.map(s => ({ value: s, label: s }));

    // Si hay un proveedor actual que no está en la lista, agregarlo al inicio
    if (currentSupplier && currentSupplier !== '' && !hasCurrentInList) {
      return [
        {
          value: currentSupplier,
          label: `${currentSupplier} (actual)`
        },
        ...options
      ];
    }

    return options;
  }, [formData.supplier_name]);

  useEffect(() => {
    // Limpiar campos cuando Incoterm cambia a FOB
    if (formData.incoterm === 'FOB') {
      setFormData(prev => ({
        ...prev,
        fob_expenses: '',
        disassembly_load_value: 0
      }));
    }
  }, [formData.incoterm]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validar que modelo esté lleno (serial es opcional)
    if (!purchase && !formData.model) {
      showError('Modelo es requerido');
      return;
    }

    // Si es edición y hay cambios, mostrar modal de control de cambios
    if (purchase && hasChanges && changes.length > 0) {
      const payload = buildEditPayload();
      setPendingUpdate(payload);
      setShowChangeModal(true);
      return; // Pausar hasta que el usuario confirme
    }

    // Si no hay cambios o es creación nueva, continuar normal
    await saveChanges();
  };

  const saveChanges = async (changeReason?: string) => {
    setLoading(true);
    try {
      if (purchase) {
        const payload = pendingUpdate || buildEditPayload();
        await apiPut(`/api/purchases/${purchase.id}`, payload);
        
        // Registrar cambios en el log si hay cambios detectados
        if (hasChanges && changes.length > 0) {
          try {
            await apiPost('/api/change-logs', {
              table_name: 'purchases',
              record_id: purchase.id,
              changes: changes,
              change_reason: changeReason || null
            });
            console.log(`📝 ${changes.length} cambios registrados en el log de auditoría`);
          } catch (logError) {
            console.error('Error registrando cambios en log:', logError);
            // No bloquear la actualización si falla el log
          }
        }
        
        showSuccess('Compra actualizada exitosamente');
      } else {
        const payload: Record<string, unknown> = {
          ...formData,
          created_by: user?.id,
        };

        console.log('📦 Creando máquina nueva (compra manual nueva)...');
        try {
          const machineData = {
            model: formData.model,
            serial: formData.serial || null, // Serial es opcional
            year: 0, // Valor por defecto
            hours: 0, // Valor por defecto
          };

          const newMachine = await apiPost<{ id: string }>('/api/machines', machineData);
          payload.machine_id = newMachine.id;
          setTempMachineId(newMachine.id);
        } catch (error) {
          console.error('Error creando máquina:', error);
          showError('Error al crear la máquina. ¿El serial ya existe?');
          setLoading(false);
          return;
        }

        // Establecer purchase_type
        payload.purchase_type = 'COMPRA_DIRECTA';
        
        // Establecer incoterm automáticamente según tipo
        if (!payload.incoterm) {
          payload.incoterm = 'FOB';
        }
        
        // Asegurar que campos obligatorios no sean NULL
        if (!payload.supplier_id) {
          payload.supplier_id = payload.supplier_name || 'SIN_PROVEEDOR';
        }
        if (!payload.supplier_name) {
          payload.supplier_name = payload.supplier_id || 'SIN_PROVEEDOR';
        }
        if (!payload.invoice_date) {
          payload.invoice_date = new Date().toISOString().split('T')[0]; // Fecha de hoy
        }
        if (!payload.payment_status) {
          payload.payment_status = 'PENDIENTE';
        }
        if (payload.trm === undefined || payload.trm === null) {
          payload.trm = 0;
        }

        await apiPost('/api/purchases', payload);
        showSuccess('Compra creada exitosamente');
      }

      // Cerrar modal de cambios y limpiar estado
      setShowChangeModal(false);
      setPendingUpdate(null);

      // Los archivos se suben directamente desde el componente MachineFiles
      onSuccess();
    } catch (error) {
      console.error('Error guardando compra:', error);
      showError(error instanceof Error ? error.message : 'Error al guardar compra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
      {/* Sección 1: Información Básica */}
      <div className="border-b border-gray-200 pb-3">
        <h3 className="text-sm font-semibold mb-3 text-gray-700 uppercase tracking-wide">Información Básica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="Proveedor *"
            value={formData.supplier_name || ''}
            onChange={(e) => {
              console.log('🔄 Cambiando supplier_name:', e.target.value);
              handleChange('supplier_name', e.target.value);
            }}
            options={[
              { value: '', label: '-- Seleccionar Proveedor --' },
              ...supplierOptions
            ]}
            required
          />
          {!purchase ? (
            <Input
              label="Modelo"
              value={formData.model}
              onChange={(e) => handleChange('model', e.target.value)}
              placeholder="Modelo de la máquina"
              required
            />
          ) : null}
          <Select
            label="Tipo de Envío"
            value={formData.shipment_type_v2}
            onChange={(e) => handleChange('shipment_type_v2', e.target.value)}
            options={SHIPMENT_TYPES.map(type => ({ value: type, label: type }))}
          />
          <Input
            label="Fecha de Factura"
            type="date"
            value={formData.invoice_date}
            onChange={(e) => handleChange('invoice_date', e.target.value)}
          />
          <Input
            label="Orden de Compra"
            value={formData.purchase_order}
            onChange={(e) => handleChange('purchase_order', e.target.value)}
            placeholder="Orden de compra"
          />
          <Input
            label="No. Factura Proforma"
            value={formData.invoice_number}
            onChange={(e) => handleChange('invoice_number', e.target.value)}
            placeholder="No. Factura Proforma"
          />
        </div>
        {formData.supplier_name && !NEW_PURCHASE_SUPPLIERS.includes(formData.supplier_name) ? (
          <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
            <strong>Nota:</strong> El proveedor "{formData.supplier_name}" no está en la lista estándar pero se mantendrá.
          </p>
        ) : null}
      </div>

      {/* Sección 2: Ubicación y Puerto */}
      <div className="border-b border-gray-200 pb-3">
        <h3 className="text-sm font-semibold mb-3 text-gray-700 uppercase tracking-wide">Ubicación y Puerto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="Ubicación de Máquina"
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            options={[
              { value: '', label: '-- Seleccionar --' },
              ...LOCATIONS.map(loc => ({ value: loc, label: loc }))
            ]}
          />
          <Select
            label="Moneda"
            value={formData.currency_type}
            onChange={(e) => handleChange('currency_type', e.target.value)}
            options={CURRENCIES.map(curr => ({ value: curr, label: curr }))}
          />
          <Select
            label="Incoterm"
            value={formData.incoterm}
            onChange={(e) => handleChange('incoterm', e.target.value)}
            options={INCOTERMS.map(inc => ({ value: inc, label: inc }))}
          />
          <Select
            label="Puerto de Embarque"
            value={formData.port_of_embarkation}
            onChange={(e) => handleChange('port_of_embarkation', e.target.value)}
            options={[
              { value: '', label: '-- Seleccionar --' },
              ...PORTS.map(port => ({ value: port, label: port }))
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">CPD</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleChange('cpd', 'VERDE')}
                className={`
                  w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg
                  transition-all duration-200
                  ${formData.cpd?.toUpperCase() === 'VERDE' 
                    ? 'bg-green-500 text-white shadow-md' 
                    : 'bg-gray-200 text-gray-400 hover:bg-green-100'
                  }
                `}
                title="Verde"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => handleChange('cpd', 'ROJA')}
                className={`
                  w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg
                  transition-all duration-200
                  ${formData.cpd?.toUpperCase() === 'ROJA' || formData.cpd?.toUpperCase() === 'X'
                    ? 'bg-red-500 text-white shadow-md' 
                    : 'bg-gray-200 text-gray-400 hover:bg-red-100'
                  }
                `}
                title="Roja"
              >
                ✗
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 4: Valores Monetarios */}
      <div className="border-b border-gray-200 pb-3">
        <h3 className="text-sm font-semibold mb-3 text-gray-700 uppercase tracking-wide">Valores Monetarios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Valor + BP"
            value={formData.exw_value_formatted}
            onChange={(e) => handleChange('exw_value_formatted', e.target.value)}
            placeholder="Ej: ¥6,510,000.00"
          />
          <div>
            <Input
              label={
                <span className="flex items-center gap-2">
                  Gastos FOB + Lavado
                  {formData.incoterm === 'FOB' ? (
                    <span className="text-xs text-gray-500 italic">(Solo para EXW)</span>
                  ) : null}
                </span>
              }
              value={formData.fob_expenses}
              onChange={(e) => handleChange('fob_expenses', e.target.value)}
              placeholder={formData.incoterm === 'FOB' ? 'No aplica para FOB' : 'Descripción de gastos'}
              disabled={formData.incoterm === 'FOB'}
            />
          </div>
          <div>
            <Input
              label={
                <span className="flex items-center gap-2">
                  Desensamblaje + Cargue
                  {formData.incoterm === 'FOB' ? (
                    <span className="text-xs text-gray-500 italic">(Solo para EXW)</span>
                  ) : null}
                </span>
              }
              type="number"
              value={formData.disassembly_load_value}
              onChange={(e) => handleChange('disassembly_load_value', e.target.value)}
              placeholder={formData.incoterm === 'FOB' ? 'No aplica para FOB' : '0'}
              disabled={formData.incoterm === 'FOB'}
            />
          </div>
        </div>
      </div>

      {/* Sección 5: Reportes */}
      <div className="border-b border-gray-200 pb-3">
        <h3 className="text-sm font-semibold mb-3 text-gray-700 uppercase tracking-wide">Estados de Reporte</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select
            label="Reportado a Ventas"
            value={formData.sales_reported}
            onChange={(e) => handleChange('sales_reported', e.target.value)}
            options={REPORT_STATUSES.map(status => ({ value: status, label: status }))}
          />
          <Select
            label="Reportado a Comercio"
            value={formData.commerce_reported}
            onChange={(e) => handleChange('commerce_reported', e.target.value)}
            options={REPORT_STATUSES.map(status => ({ value: status, label: status }))}
          />
          <Select
            label="Reporte a Luis Lemus"
            value={formData.luis_lemus_reported}
            onChange={(e) => handleChange('luis_lemus_reported', e.target.value)}
            options={REPORT_STATUSES.map(status => ({ value: status, label: status }))}
          />
        </div>
      </div>

      {/* Sección 6B: Archivos de la Máquina */}
      {(tempMachineId || purchase?.machine_id) ? (
        <div className="border-b border-gray-200 pb-3">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-brand-red p-2 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Gestión de Archivos</h3>
                <p className="text-xs text-gray-500">Fotos y documentos de la máquina</p>
              </div>
            </div>
            
            <MachineFiles 
              machineId={tempMachineId || purchase?.machine_id} 
              allowUpload={true}
              allowDelete={true}
              currentScope="COMPRAS"
              uploadExtraFields={{ scope: 'COMPRAS' }}
            />
          </div>
        </div>
      ) : (
        <div className="border-b border-gray-200 pb-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="bg-yellow-400 p-2 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-yellow-900">Archivos no disponibles</p>
                <p className="text-xs text-yellow-700">Guarda primero el registro para agregar archivos.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 border-t border-gray-200 pt-3 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="text-sm px-4 py-2">
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="text-sm px-4 py-2">
          {loading ? 'Guardando...' : purchase ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>

    {/* Modal de Control de Cambios */}
    <ChangeLogModal
      isOpen={showChangeModal}
      changes={changes}
      onConfirm={(reason) => {
        setShowChangeModal(false);
        saveChanges(reason);
      }}
      onCancel={() => {
        setShowChangeModal(false);
        setPendingUpdate(null);
        setLoading(false);
      }}
    />
    </>
  );
};

