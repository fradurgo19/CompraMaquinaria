/**
 * Formulario de Compra (Nueva Versión)
 * Eliana diligencia manualmente con info de correo y pagos a proveedores
 */

import { useState, FormEvent, useEffect } from 'react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../components/Toast';
import { apiGet, apiPost, apiPut } from '../services/api';
import { apiUpload } from '../services/api';
import { MachineFiles } from './MachineFiles';
import { ChangeLogModal } from './ChangeLogModal';
import { useChangeDetection } from '../hooks/useChangeDetection';

// Lista de proveedores específica para purchases
const PURCHASE_SUPPLIERS = [
  'TOZAI',
  'ONAGA',
  'THI / J&F',
  'THI',
  'NDT',
  'NDT / J&F',
  'WAKITA',
  'GREENAUCT / J&F',
  'HITACHI',
  'JEN/TRANSFERIDO A ONAGA',
  'NORI',
  'GREENAUCT',
  'PQ USA / RITCHIE BROS',
  'JEN',
  'KATAGIRI',
  'KANEHARU',
  'AOI',
  'JTF SHOJI',
  'SOGO',
  'REIBRIDGE INC',
  'DIESEL TRADING CO',
  'PQ USA / RITCHIE BROS CANADA',
  'PQ USA / ROYAL',
  'PQ USA / MULTISERVICIOS',
  'NORI/JEN'
];

const SHIPMENT_TYPES = ['1X40', 'RORO'];
const LOCATIONS = [
  'KOBE', 'YOKOHAMA', 'NARITA', 'HAKATA', 'FUJI', 'TOMAKOMAI', 
  'SAKURA', 'LEBANON', 'LAKE WORTH', 'NAGOYA', 'HOKKAIDO', 
  'OSAKA', 'ALBERTA', 'FLORIDA', 'KASHIBA', 'HYOGO', 'MIAMI'
];
const CURRENCIES = ['JPY', 'USD', 'EUR'];
const INCOTERMS = ['EXW', 'FOB'];
const PORTS = ['KOBE', 'YOKOHAMA', 'SAVANNA', 'JACKSONVILLE', 'CANADA', 'MIAMI'];
const REPORT_STATUSES = ['OK', 'PDTE'];
const CPD_OPTIONS = ['NACIONALIZACION EN PUERTO', 'NACIONALIZACION EN ZONA FRANCA'];

interface PurchaseFormProps {
  purchase?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PurchaseFormNew = ({ purchase, onSuccess, onCancel }: PurchaseFormProps) => {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFromAuction, setIsFromAuction] = useState(false);
  const [tempMachineId, setTempMachineId] = useState<string | null>(purchase?.machine_id || null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);

  const [formData, setFormData] = useState({
    // Columnas manuales
    mq: purchase?.mq || '',
    shipment_type_v2: purchase?.shipment_type_v2 || '1X40',
    supplier_name: purchase?.supplier_name || '',
    invoice_date: purchase?.invoice_date || '',
    
    // De auctions (solo ganadas) - opcional
    auction_id: purchase?.auction_id || '',
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
    
    // Tasas y fechas
    usd_jpy_rate: purchase?.usd_jpy_rate || '',
    trm_rate: purchase?.trm_rate || '',
    payment_date: purchase?.payment_date || '',
    shipment_departure_date: purchase?.shipment_departure_date || '',
    shipment_arrival_date: purchase?.shipment_arrival_date || '',
    
    // Estados de reporte
    sales_reported: purchase?.sales_reported || 'PDTE',
    commerce_reported: purchase?.commerce_reported || 'PDTE',
    luis_lemus_reported: purchase?.luis_lemus_reported || 'PDTE',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Campos a monitorear para control de cambios
  const MONITORED_FIELDS = {
    port_of_embarkation: 'Puerto de Embarque',
    location: 'Ubicación',
    exw_value_formatted: 'Valor EXW',
    fob_expenses: 'Gastos FOB + Lavado',
    disassembly_load_value: 'Desensamblaje + Cargue',
    incoterm: 'Incoterm',
    currency_type: 'Tipo de Moneda',
    cpd: 'CPD',
  };

  // Hook de detección de cambios
  const { hasChanges, changes } = useChangeDetection(
    purchase, 
    formData, 
    MONITORED_FIELDS
  );

  useEffect(() => {
    loadAuctions();
  }, []);

  useEffect(() => {
    // Sincronizar formData cuando cambia el purchase
    if (purchase) {
      // Formatear fechas a YYYY-MM-DD para inputs de tipo date
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          return date.toISOString().split('T')[0];
        } catch {
          return dateStr;
        }
      };

      // Obtener model y serial: primero del nivel superior (JOIN), luego de machine
      const purchaseAny = purchase as any;
      const model = purchaseAny.model || purchase.machine?.model || '';
      const serial = purchaseAny.serial || purchase.machine?.serial || '';

      setFormData({
        mq: purchase.mq || '',
        shipment_type_v2: purchase.shipment_type_v2 || '1X40',
        supplier_name: purchase.supplier_name || '',
        invoice_date: formatDate(purchase.invoice_date),
        auction_id: purchase.auction_id || '',
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
        usd_jpy_rate: purchase.usd_jpy_rate || '',
        trm_rate: purchase.trm_rate || '',
        payment_date: formatDate(purchase.payment_date),
        shipment_departure_date: formatDate(purchase.shipment_departure_date),
        shipment_arrival_date: formatDate(purchase.shipment_arrival_date),
        sales_reported: purchase.sales_reported || 'PDTE',
        commerce_reported: purchase.commerce_reported || 'PDTE',
        luis_lemus_reported: purchase.luis_lemus_reported || 'PDTE',
      });
    }
  }, [purchase]);

  useEffect(() => {
    // Si se selecciona una subasta, llenar automáticamente modelo y serial
    if (formData.auction_id && auctions.length > 0) {
      const auction = auctions.find(a => a.id === formData.auction_id);
      if (auction) {
        setFormData(prev => ({
          ...prev,
          model: auction.machine?.model || '',
          serial: auction.machine?.serial || '',
        }));
        setIsFromAuction(true); // Deshabilitar campos cuando viene de subasta
      }
    } else if (!formData.auction_id) {
      setIsFromAuction(false); // Habilitar campos para compra manual
    }
  }, [formData.auction_id, auctions]);

  useEffect(() => {
    // Detectar si ya existe compra editando
    if (purchase?.auction_id) {
      setIsFromAuction(true); // Si tiene auction_id, deshabilitar
    }
  }, [purchase]);

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

  const loadAuctions = async () => {
    try {
      const data = await apiGet<any[]>('/api/auctions');
      console.log('📊 Todas las subastas:', data.length);
      console.log('📊 Estados:', data.map(a => a.status));
      
      // Solo subastas ganadas
      const wonAuctions = data.filter(a => a.status === 'GANADA');
      console.log('✅ Subastas ganadas:', wonAuctions.length);
      setAuctions(wonAuctions);
    } catch (error) {
      console.error('Error cargando subastas:', error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validar que modelo y serial estén llenos
    if (!formData.model || !formData.serial) {
      showError('Modelo y Serial son requeridos');
      return;
    }

    // Si es edición y hay cambios, mostrar modal de control de cambios
    if (purchase && hasChanges && changes.length > 0) {
      const payload = {
        ...formData,
        created_by: user?.id,
        auction_id: formData.auction_id || null,
      };
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
      let payload = pendingUpdate || {
        ...formData,
        created_by: user?.id,
        auction_id: formData.auction_id || null,
      };

      // Si NO viene de subasta Y es una compra nueva (no edición), crear máquina primero
      if (!formData.auction_id && !purchase) {
        console.log('📦 Creando máquina nueva (compra manual nueva)...');
        try {
          const machineData = {
            model: formData.model,
            serial: formData.serial,
            year: 0, // Valor por defecto
            hours: 0, // Valor por defecto
          };
          
          const newMachine = await apiPost<any>('/api/machines', machineData);
          payload.machine_id = newMachine.id;
          setTempMachineId(newMachine.id);
        } catch (error) {
          console.error('Error creando máquina:', error);
          showError('Error al crear la máquina. ¿El serial ya existe?');
          setLoading(false);
          return;
        }
      } else if (!formData.auction_id && purchase) {
        // Si es edición de compra COMPRA_DIRECTA, NO crear máquina nueva, usar la existente
        console.log('📝 Editando compra COMPRA_DIRECTA - usando máquina existente');
        payload.machine_id = purchase.machine_id; // Usar el machine_id existente
      }

      // Establecer purchase_type
      payload.purchase_type = payload.auction_id ? 'SUBASTA' : 'COMPRA_DIRECTA';
      
      // Asegurar que campos obligatorios no sean NULL
      if (!payload.supplier_id) {
        payload.supplier_id = payload.supplier_name || 'SIN_PROVEEDOR';
      }
      if (!payload.supplier_name) {
        payload.supplier_name = payload.supplier_id || 'SIN_PROVEEDOR';
      }
      if (!payload.incoterm) {
        payload.incoterm = 'EXW'; // Valor por defecto
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
      
      console.log('📝 Payload final:', {
        auction_id: payload.auction_id,
        machine_id: payload.machine_id,
        supplier_id: payload.supplier_id,
        supplier_name: payload.supplier_name,
        model: payload.model,
        serial: payload.serial,
        incoterm: payload.incoterm
      });

      if (purchase) {
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sección 1: Información Básica */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Información Básica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Tipo de Envío"
            value={formData.shipment_type_v2}
            onChange={(e) => handleChange('shipment_type_v2', e.target.value)}
            options={SHIPMENT_TYPES.map(type => ({ value: type, label: type }))}
          />
          <Select
            label="Proveedor"
            value={formData.supplier_name}
            onChange={(e) => handleChange('supplier_name', e.target.value)}
            options={[
              { value: '', label: '-- Seleccionar Proveedor --' },
              ...PURCHASE_SUPPLIERS.map(s => ({ value: s, label: s }))
            ]}
            required
          />
          <Input
            label="Fecha de Factura"
            type="date"
            value={formData.invoice_date}
            onChange={(e) => handleChange('invoice_date', e.target.value)}
          />
        </div>
      </div>

      {/* Sección 2: Máquina */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Información de Máquina</h3>
        
        {/* Opción: Seleccionar subasta ganada (Opcional) */}
        <div className="mb-4">
          <Select
            label="¿Proviene de Subasta Ganada? (Opcional)"
            value={formData.auction_id}
            onChange={(e) => {
              handleChange('auction_id', e.target.value);
            }}
            options={[
              { value: '', label: '-- Compra Nueva (Sin Subasta) --' },
              ...auctions.map(a => ({
                value: a.id,
                label: `${a.machine?.model || '-'} - S/N ${a.machine?.serial || '-'} - Lote: ${a.lot_number || '-'}`
              }))
            ]}
          />
          {isFromAuction && (
            <p className="text-sm text-blue-600 mt-2">
              ℹ️ Campos modelo y serial bloqueados (datos de subasta)
            </p>
          )}
        </div>

        {/* Campos modelo y serial */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Modelo"
            value={formData.model}
            onChange={(e) => handleChange('model', e.target.value)}
            disabled={isFromAuction}
            placeholder="Modelo de la máquina"
          />
          <Input
            label="Serial"
            value={formData.serial}
            onChange={(e) => handleChange('serial', e.target.value)}
            disabled={isFromAuction}
            placeholder="Número de serie"
          />
        </div>
      </div>

      {/* Sección 3: Ubicación y Puerto */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Ubicación y Puerto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <Select
            label="CPD"
            value={formData.cpd}
            onChange={(e) => handleChange('cpd', e.target.value)}
            options={[
              { value: '', label: '-- Seleccionar --' },
              ...CPD_OPTIONS.map(cpd => ({ value: cpd, label: cpd }))
            ]}
          />
        </div>
      </div>

      {/* Sección 4: Valores Monetarios */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Valores Monetarios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Valor EXW + Buyer's Premium"
            value={formData.exw_value_formatted}
            onChange={(e) => handleChange('exw_value_formatted', e.target.value)}
            placeholder="Ej: ¥6,510,000.00"
          />
          <div>
            <Input
              label={
                <span className="flex items-center gap-2">
                  Gastos FOB + Lavado
                  {formData.incoterm === 'FOB' && (
                    <span className="text-xs text-gray-500 italic">(Solo para EXW)</span>
                  )}
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
                  {formData.incoterm === 'FOB' && (
                    <span className="text-xs text-gray-500 italic">(Solo para EXW)</span>
                  )}
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


      {/* Sección 6: Reportes */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Estados de Reporte</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <div className="border-b pb-6">
          <div className="bg-gradient-to-r from-red-50 to-gray-50 rounded-xl p-6 border border-red-100 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-gradient-to-br from-brand-red to-primary-600 p-3 rounded-lg shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Gestión de Archivos</h3>
                <p className="text-sm text-gray-600">Fotos y documentos de la máquina en el módulo de Compras</p>
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
        <div className="border-b pb-6">
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-400 p-3 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-yellow-900">Archivos no disponibles</h3>
                <p className="text-sm text-yellow-800">Guarda primero el registro para poder agregar archivos.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-4 border-t pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : purchase ? 'Actualizar Compra' : 'Crear Compra'}
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

