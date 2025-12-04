/**
 * Módulo de Equipos
 * Vista de máquinas para venta con datos de Logística y Consolidado
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, Package, Plus, RefreshCw, Eye, Edit, History, Clock, Layers, Save, X, CheckCircle, XCircle, FileText, Download, ExternalLink } from 'lucide-react';
import { apiGet, apiPut, apiPost, apiUpload } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { EquipmentModal } from '../organisms/EquipmentModal';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { Button } from '../atoms/Button';
import { EquipmentReservationForm } from '../components/EquipmentReservationForm';

interface EquipmentRow {
  id: string;
  purchase_id: string;
  machine_id?: string;
  
  // Datos de Logística
  supplier_name: string;
  brand: string;
  model: string;
  serial: string;
  shipment_departure_date: string;
  shipment_arrival_date: string;
  port_of_destination: string;
  nationalization_date: string;
  mc: string | null;
  condition: string | null; // NUEVO o USADO
  current_movement: string;
  current_movement_date: string;
  
  // Datos de Consolidado
  year: number;
  hours: number;
  invoice_date: string;
  pvp_est: number;
  comments: string;
  real_sale_price?: number;
  
  // Especificaciones
  full_serial: number;
  state: string;
  machine_type: string;
  wet_line: string;
  arm_type: string;
  track_width: number;
  bucket_capacity: number;
  warranty_months: number;
  warranty_hours: number;
  engine_brand: string;
  cabin_type: string;
  commercial_observations: string;
  
  // Fechas de Alistamiento (sincronizadas desde service_records)
  start_staging?: string | null;
  end_staging?: string | null;
  staging_type?: string | null;
  
  // Relación con new_purchases
  new_purchase_id?: string | null;
}

const MACHINE_TYPES = [
  'BRAZO LARGO 30 TON', 'GRUA HITACHI ZX75UR', 'ACOPLE RAPIDO 12TON', 'MARUJUN TELESCOPIC ARM',
  'MANDIBULA MINICARGADOR', 'ENGANCHE PARA EXCAVADORA 20TON', 'CHASIS LBX460', 'BRAZO LARGO 20 TON',
  'ALMEJA GIRATORIA 20TON', 'BALDE SH240-5', 'MOTOSOLDADOR MULTIQUIP', 'BALDE USADO 3TON',
  'BALDE USADO 20 TON', 'BRAZO ESTANDAR 20 TON', 'LINEA HUMEDA ZX200', 'LINEA HUMEDA SK210',
  'BROCA PARA AHOYADOR', 'BRAZO LARGO 16.5MTS', 'MARTILLO HIDRAULICO OKADA',
  'MASTIL DE PERFORACIÓN TECOP MCD45HP', 'BARREDORA PARA MINICARGADOR',
  'MONTACARGAS LIUGONG F7035M', 'RETROCARGADOR CASE 580N', 'PONTONES GET240D',
  'VIBROCOMPACTADORAMMANNASC70', 'EXCAVADORA LBX 210X3E', 'MINICARGADOR CASE SR200B',
  'ALIMENTADOR VIBRATORIO - ZSW600x150', 'EXCAVADORA KOBELCO SK330LC',
  'MINIEXCAVADORA HITACHI EX5-2', 'EXCAVADORA SUMITOMO SH210-5',
  'RETROCARGADOR CASE 575SV', 'EXCAVADORA HITACHI ZX75US-3', 'EXCAVADORA KUBOTA K70-3',
  'EXCAVADORA HITACHI ZX120-3', 'EXCAVADORA CASE CX240C-8',
  'EXCAVADORA HITACHI ZX210LC-5B', 'MINIEXCAVADORA YANMAR VIO35-7',
  'BALDE EXCAVADORA (ROCK DUTY)', 'RODILLO VIBRATORIO PARA MINICARGADOR',
  'BRAZO EXCAVADOR PARA MINICARGADOR', 'MOTONIVELADORA CASE 845B-2',
  'PULVERIZADORA NPK', 'MARTILLO HIDRAULICO FURUKAWA',
  'EXTENDEDORA DE ASFALTO SIMEX', 'CANGURO AMMANN ACR70D',
  'MINIEXCAVADORA YANMAR VIO17-1B', 'MINIEXCAVADORA YANMAR VIO35-6B',
  'VIBROCOMPACTADOR AMMANN ARX 26-2', 'MINICARGADOR CASE SR175B',
  'MINICARGADOR CASE SR220B', 'VIBROCOMPACTADOR CASE 1107EX',
  'EXCAVADORA YANMAR VIO80-1', 'EXCAVADORA HITACHI ZX130-5G',
  'BULLDOZER CATERPILLAR D3C', 'BULLDOZER KOMATSU D39PX',
  'EXCAVADORA YANMAR VIO70-3', 'MINIEXCAVADORA AIRMAN AX50U-3',
  'MINIEXCAVADORA HITACHI ZX30U-5A', 'MINIEXCAVADORA HITACHI ZX35U-5A',
  'EXCAVADORA LBX130X3E', 'EXCAVADORA KUBOTA K120-3',
  'EXCAVADORA SUMITOMO SH200-5', 'EXCAVADORA HITACHI ZX200-5',
  'EXCAVADORA HITACHI ZX210LCH-5G', 'EXCAVADORA HITACHI ZX135US-3',
  'MINICARGADOR CASE SR210B', 'EXCAVADORA HITACHI ZX350LC-5B',
  'EXCAVADORA HITACHI ZX75US-5B', 'EXCAVADORA HITACHI ZX200-6',
  'EXCAVADORA HITACHI ZX130-5B', 'EXCAVADORA HITACHI ZX225US-5B',
  'VOLQUETA * CHASIS MERCEDES-BENZ ATEGO 1726K', 'EXCAVADORA HITACHI ZX200-5B',
  'EXCAVADORA HITACHI ZX210K-5B', 'RETROCARGADOR CASE 580SV',
  'EXCAVADORA HITACHI ZX120-5B', 'MINIEXCAVADORA HITACHI ZX40U-5B',
  'EXCAVADORA HITACHI ZX330', 'EXCAVADORA HITACHI ZX200X-5B-U'
];

const STATES = ['Libre', 'Ok dinero y OC', 'Lista, Pendiente Entrega', 'Reservada', 'Disponible'];
const WET_LINE_OPTIONS = ['SI', 'No'];
const ARM_TYPE_OPTIONS = ['ESTANDAR', 'N/A'];
const ENGINE_BRANDS = ['N/A', 'ISUZU', 'MITSUBISHI', 'FPT', 'YANMAR', 'KUBOTA', 'PERKINS', 'CUMMINS', 'CATERPILLAR', 'KOMATSU'];
const CABIN_TYPES = ['N/A', 'CABINA CERRADA / AIRE ACONDICIONADO', 'CANOPY'];

export const EquipmentsPage = () => {
  const { userProfile } = useAuth();
  const [data, setData] = useState<EquipmentRow[]>([]);
  const [filteredData, setFilteredData] = useState<EquipmentRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRow | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewEquipment, setViewEquipment] = useState<EquipmentRow | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<EquipmentRow | null>(null);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { recordId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());
  const [reservationFormOpen, setReservationFormOpen] = useState(false);
  const [selectedEquipmentForReservation, setSelectedEquipmentForReservation] = useState<EquipmentRow | null>(null);
  const [equipmentReservations, setEquipmentReservations] = useState<Record<string, any[]>>({});
  const [viewReservationModalOpen, setViewReservationModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);

  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const pendingChangeRef = useRef<{
    recordId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  type InlineChangeItem = {
    field_name: string;
    field_label: string;
    old_value: string | number | null;
    new_value: string | number | null;
  };

  type InlineChangeIndicator = {
    id: string;
    fieldName: string;
    fieldLabel: string;
    oldValue: string | number | null;
    newValue: string | number | null;
    reason?: string;
    changedAt: string;
    moduleName?: string | null;
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = data.filter(
        (row) =>
          row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.serial.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(data);
    }
  }, [searchTerm, data]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await apiGet<EquipmentRow[]>('/api/equipments');
      setData(response);
      setFilteredData(response);
    } catch {
      showError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = () => {
    return userProfile?.role === 'comerciales' || userProfile?.role === 'jefe_comercial' || userProfile?.role === 'admin';
  };

  const canAdd = () => {
    return userProfile?.role === 'jefe_comercial' || userProfile?.role === 'admin';
  };

  const canSync = () => {
    return userProfile?.role === 'admin';
  };

  const isCommercial = () => {
    return userProfile?.role === 'comerciales';
  };

  const isJefeComercial = () => {
    return userProfile?.role === 'jefe_comercial' || userProfile?.role === 'admin';
  };

  const handleReserveEquipment = async (equipment: EquipmentRow) => {
    setSelectedEquipmentForReservation(equipment);
    
    // Cargar reserva existente si la hay
    await loadReservations(equipment.id);
    
    setReservationFormOpen(true);
  };

  const handleReservationSuccess = async () => {
    await fetchData();
    // Recargar reservas para el equipo
    if (selectedEquipmentForReservation) {
      await loadReservations(selectedEquipmentForReservation.id);
    }
  };

  const loadReservations = async (equipmentId: string) => {
    try {
      const reservations = await apiGet<any[]>(`/api/equipments/${equipmentId}/reservations`);
      setEquipmentReservations((prev) => ({
        ...prev,
        [equipmentId]: reservations,
      }));
    } catch (error) {
      console.error('Error al cargar reservas:', error);
    }
  };

  const handleApproveReservation = async (reservationId: string, equipmentId: string) => {
    try {
      await apiPut(`/api/equipments/reservations/${reservationId}/approve`, {});
      showSuccess('Reserva aprobada exitosamente');
      await fetchData();
      await loadReservations(equipmentId);
    } catch (error: any) {
      showError(error.message || 'Error al aprobar la reserva');
    }
  };

  const handleRejectReservation = async (reservationId: string, equipmentId: string) => {
    const reason = prompt('Ingresa la razón del rechazo (opcional):');
    try {
      await apiPut(`/api/equipments/reservations/${reservationId}/reject`, {
        rejection_reason: reason || null,
      });
      showSuccess('Reserva rechazada exitosamente');
      await fetchData();
      await loadReservations(equipmentId);
    } catch (error: any) {
      showError(error.message || 'Error al rechazar la reserva');
    }
  };

  // Cargar reservas pendientes para equipos cuando el usuario es jefe comercial
  useEffect(() => {
    if (isJefeComercial() && data.length > 0) {
      data.forEach((equipment) => {
        if ((equipment as any).pending_reservations_count > 0) {
          loadReservations(equipment.id);
        }
      });
    }
  }, [data, userProfile]);

  const handleSyncSpecs = async () => {
    if (!window.confirm('¿Deseas sincronizar las especificaciones de Equipos a Subasta y Consolidado? Este proceso puede tardar unos segundos.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiPost('/api/equipments/sync-specs', {});
      showSuccess(`Sincronización completada: ${response.synced} registros actualizados`);
      console.log('📊 Resultado sincronización:', response);
    } catch (error) {
      showError('Error al sincronizar especificaciones');
      console.error('Error en sincronización:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (row: EquipmentRow) => {
    setSelectedEquipment(row);
    setModalOpen(true);
  };

  const handleView = (row: EquipmentRow) => {
    setViewEquipment(row);
    setViewOpen(true);
  };


  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return '-';
    }
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return '$' + value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Funciones helper para estilos elegantes
  const getProveedorStyle = (proveedor: string | null | undefined) => {
    if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md whitespace-nowrap';
  };

  const getModeloStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md whitespace-nowrap';
  };

  const getSerialStyle = (serial: string | null | undefined) => {
    if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
  };

  const getYearStyle = (year: number | string | null | undefined) => {
    if (!year || year === '-' || year === '' || year === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md';
  };

  const getHoursStyle = (hours: number | string | null | undefined) => {
    if (!hours || hours === '-' || hours === '' || hours === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-md';
  };

  const getFechaStyle = (fecha: string | null | undefined) => {
    if (!fecha || fecha === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md';
  };

  const getPuertoStyle = (puerto: string | null | undefined) => {
    if (!puerto || puerto === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md';
  };

  const getNacionalizacionStyle = (fecha: string | null | undefined) => {
    if (!fecha || fecha === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md';
  };

  const getMovimientoStyle = (movimiento: string | null | undefined) => {
    if (!movimiento || movimiento === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md';
  };

  const getNumberStyle = (value: number | string | null | undefined) => {
    if (!value || value === '-' || value === '' || value === 0 || value === '0') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
  };

  const getTextoStyle = (texto: string | null | undefined) => {
    if (!texto || texto === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
  };

  const getEstadoStyle = (estado: string | null | undefined) => {
    if (!estado || estado === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    const upperEstado = estado.toUpperCase();
    if (upperEstado.includes('LIBRE') || upperEstado.includes('DISPONIBLE')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md';
    } else if (upperEstado.includes('RESERVADA')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 shadow-md';
    } else if (upperEstado.includes('OK')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-gray to-secondary-600 text-white shadow-md';
    }
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-gray-500 to-slate-500 text-white shadow-md';
  };

  // Funciones helper para inline editing
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.change-popover') && !target.closest('.change-indicator-btn')) {
        setOpenChangePopover(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const normalizeForCompare = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') return Number.isNaN(value) ? '' : value;
    if (typeof value === 'string') return value.trim().toLowerCase();
    if (typeof value === 'boolean') return value;
    return value;
  };

  /**
   * Determina si un valor está "vacío" (null, undefined, string vacío, etc.)
   * Esto se usa para decidir si agregar un valor inicial requiere control de cambios
   */
  const isValueEmpty = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (typeof value === 'number') return Number.isNaN(value);
    if (typeof value === 'boolean') return false; // Los booleanos nunca están "vacíos"
    return false;
  };

  const formatChangeValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return 'Sin valor';
    if (typeof value === 'number') return value.toLocaleString('es-CO');
    return String(value);
  };

  const getModuleLabel = (moduleName: string | null | undefined): string => {
    if (!moduleName) return '';
    const moduleMap: Record<string, string> = {
      'preseleccion': 'Preselección',
      'subasta': 'Subasta',
      'compras': 'Compras',
      'logistica': 'Logística',
      'equipos': 'Equipos',
      'servicio': 'Servicio',
      'importaciones': 'Importaciones',
      'pagos': 'Pagos',
    };
    return moduleMap[moduleName.toLowerCase()] || moduleName;
  };

  const mapValueForLog = (value: string | number | boolean | null | undefined): string | number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return value as string | number;
  };

  const getFieldIndicators = (
    indicators: Record<string, InlineChangeIndicator[]>,
    recordId: string,
    fieldName: string
  ) => {
    return (indicators[recordId] || []).filter((log) => log.fieldName === fieldName);
  };

  type InlineCellProps = {
    children: React.ReactNode;
    recordId?: string;
    fieldName?: string;
    indicators?: InlineChangeIndicator[];
    openPopover?: { recordId: string; fieldName: string } | null;
    onIndicatorClick?: (event: React.MouseEvent, recordId: string, fieldName: string) => void;
  };

  const InlineCell: React.FC<InlineCellProps> = ({
    children,
    recordId,
    fieldName,
    indicators,
    openPopover,
    onIndicatorClick,
  }) => {
    const hasIndicator = !!(recordId && fieldName && indicators && indicators.length);
    const isOpen =
      hasIndicator && openPopover?.recordId === recordId && openPopover.fieldName === fieldName;

    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">{children}</div>
          {hasIndicator && onIndicatorClick && (
            <button
              type="button"
              className="change-indicator-btn inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
              title="Ver historial de cambios"
              onClick={(e) => onIndicatorClick(e, recordId!, fieldName!)}
            >
              <Clock className="w-3 h-3" />
            </button>
          )}
        </div>
        {isOpen && indicators && (
          <div className="change-popover absolute z-30 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left">
            <p className="text-xs font-semibold text-gray-500 mb-2">Cambios recientes</p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {indicators.map((log) => {
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('equipos');
                return (
                  <div key={log.id} className="border border-gray-100 rounded-lg p-2 bg-gray-50 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-800">{log.fieldLabel}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                        {moduleLabel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Antes:{' '}
                      <span className="font-mono text-red-600">{formatChangeValue(log.oldValue)}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Ahora:{' '}
                      <span className="font-mono text-green-600">{formatChangeValue(log.newValue)}</span>
                    </p>
                    {log.reason && (
                      <p className="text-xs text-gray-600 mt-1 italic">"{log.reason}"</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(log.changedAt).toLocaleString('es-CO')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const queueInlineChange = (
    recordId: string,
    updates: Record<string, unknown>,
    changeItem: InlineChangeItem
  ) => {
    // Si el modo batch está activo, acumular cambios en lugar de abrir el modal
    if (batchModeEnabled) {
      setPendingBatchChanges((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(recordId);
        
        if (existing) {
          // Combinar updates y agregar el nuevo cambio
          const mergedUpdates = { ...existing.updates, ...updates };
          const mergedChanges = [...existing.changes, changeItem];
          newMap.set(recordId, {
            recordId,
            updates: mergedUpdates,
            changes: mergedChanges,
          });
        } else {
          newMap.set(recordId, {
            recordId,
            updates,
            changes: [changeItem],
          });
        }
        
        return newMap;
      });
      
      // En modo batch, guardar en BD inmediatamente para reflejar cambios visualmente
      // pero NO registrar en control de cambios hasta que se confirme
      return apiPut(`/api/equipments/${recordId}`, updates)
        .then(() => fetchData())
        .catch((error) => {
          console.error('Error guardando cambio en modo batch:', error);
          throw error;
        });
    }
    
    // Modo normal: abrir modal inmediatamente
    return new Promise<void>((resolve, reject) => {
      pendingChangeRef.current = {
        recordId,
        updates,
        changes: [changeItem],
      };
      pendingResolveRef.current = resolve;
      pendingRejectRef.current = reject;
      setChangeModalItems([changeItem]);
      setChangeModalOpen(true);
    });
  };

  const confirmBatchChanges = async (reason?: string) => {
    // Recuperar datos del estado
    const allUpdatesByRecord = new Map<string, { recordId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>();
    const allChanges: InlineChangeItem[] = [];
    
    pendingBatchChanges.forEach((batch) => {
      allChanges.push(...batch.changes);
      allUpdatesByRecord.set(batch.recordId, batch);
    });

    try {
      // Solo registrar cambios en el log (los datos ya están guardados en BD)
      const logPromises = Array.from(allUpdatesByRecord.values()).map(async (batch) => {
        // Registrar cambios en el log
        await apiPost('/api/change-logs', {
          table_name: 'equipments',
          record_id: batch.recordId,
          changes: batch.changes,
          change_reason: reason || null,
          module_name: 'equipos',
        });

        // Actualizar indicadores
        await loadChangeIndicators([batch.recordId]);
      });

      await Promise.all(logPromises);
      
      // Limpiar cambios pendientes
      setPendingBatchChanges(new Map());
      setChangeModalOpen(false);
      pendingChangeRef.current = null;
      
      showSuccess(`${allChanges.length} cambio(s) registrado(s) en control de cambios`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al registrar cambios';
      showError(message);
      throw error;
    }
  };

  const handleConfirmInlineChange = async (reason?: string) => {
    const pending = pendingChangeRef.current;
    if (!pending) return;
    
    // Si es modo batch, usar la función especial
    if (pending.recordId === 'BATCH_MODE') {
      await confirmBatchChanges(reason);
      return;
    }
    
    try {
      await apiPut(`/api/equipments/${pending.recordId}`, pending.updates);
      await apiPost('/api/change-logs', {
        table_name: 'equipments',
        record_id: pending.recordId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'equipos',
      });
      await loadChangeIndicators([pending.recordId]);
      showSuccess('Dato actualizado correctamente');
      await fetchData();
      pendingResolveRef.current?.();
    } catch (error) {
      showError('Error al actualizar el dato');
      pendingRejectRef.current?.(error);
      return;
    } finally {
      pendingChangeRef.current = null;
      pendingResolveRef.current = null;
      pendingRejectRef.current = null;
      setChangeModalOpen(false);
    }
  };

  const handleCancelInlineChange = () => {
    pendingRejectRef.current?.(new Error('CHANGE_CANCELLED'));
    pendingChangeRef.current = null;
    pendingResolveRef.current = null;
    pendingRejectRef.current = null;
    setChangeModalOpen(false);
  };

  const handleIndicatorClick = (
    event: React.MouseEvent,
    recordId: string,
    fieldName: string
  ) => {
    event.stopPropagation();
    setOpenChangePopover((prev) =>
      prev && prev.recordId === recordId && prev.fieldName === fieldName
        ? null
        : { recordId, fieldName }
    );
  };

  const getRecordFieldValue = (
    record: EquipmentRow,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    row: EquipmentRow,
    fieldName: string,
    fieldLabel: string,
    oldValue: string | number | boolean | null,
    newValue: string | number | boolean | null,
    updates: Record<string, unknown>
  ) => {
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) {
      return Promise.resolve();
    }
    return queueInlineChange(row.id, updates, {
      field_name: fieldName,
      field_label: fieldLabel,
      old_value: mapValueForLog(oldValue),
      new_value: mapValueForLog(newValue),
    });
  };

  const requestFieldUpdate = async (
    row: EquipmentRow,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>
  ) => {
    const currentValue = getRecordFieldValue(row, fieldName);
    
    // MEJORA: Si el campo está vacío y se agrega un valor, NO solicitar control de cambios
    // Solo solicitar control de cambios cuando se MODIFICA un valor existente
    const isCurrentValueEmpty = isValueEmpty(currentValue);
    const isNewValueEmpty = isValueEmpty(newValue);
    
    // Si el campo estaba vacío y ahora se agrega un valor, guardar directamente sin control de cambios
    if (isCurrentValueEmpty && !isNewValueEmpty) {
      const updatesToApply = updates ?? { [fieldName]: newValue };
      await apiPut(`/api/equipments/${row.id}`, updatesToApply);
      // Actualizar estado local
      setData(prev => prev.map(r => 
        r.id === row.id ? { ...r, ...updatesToApply } : r
      ));
      showSuccess('Dato actualizado');
      return;
    }
    
    // Si ambos están vacíos, no hay cambio real
    if (isCurrentValueEmpty && isNewValueEmpty) {
      return;
    }
    
    // Para otros casos (modificar un valor existente), usar control de cambios normal
    return beginInlineChange(
      row,
      fieldName,
      fieldLabel,
      currentValue,
      newValue,
      updates ?? { [fieldName]: newValue }
    );
  };

  // Guardar todos los cambios acumulados en modo batch
  const handleSaveBatchChanges = async () => {
    if (pendingBatchChanges.size === 0) {
      showError('No hay cambios pendientes para guardar');
      return;
    }

    // Agrupar todos los cambios para mostrar en el modal
    const allChanges: InlineChangeItem[] = [];
    pendingBatchChanges.forEach((batch) => {
      allChanges.push(...batch.changes);
    });

    // Abrir modal con todos los cambios
    setChangeModalItems(allChanges);

    // Configurar el pendingChangeRef para que handleConfirmInlineChange sepa que es batch
    pendingChangeRef.current = {
      recordId: 'BATCH_MODE',
      updates: {},
      changes: allChanges,
    };
    
    setChangeModalOpen(true);
  };

  // Cancelar todos los cambios pendientes
  const handleCancelBatchChanges = () => {
    if (pendingBatchChanges.size === 0) return;
    
    const totalChanges = Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0);
    const message = `¿Deseas cancelar ${totalChanges} cambio(s) pendiente(s)?\n\nNota: Los cambios ya están guardados en la base de datos, pero no se registrarán en el control de cambios.`;
    
    if (window.confirm(message)) {
      setPendingBatchChanges(new Map());
      showSuccess('Registro de cambios cancelado. Los datos permanecen guardados.');
    }
  };

  const buildCellProps = (recordId: string, field: string) => ({
    recordId,
    fieldName: field,
    indicators: getFieldIndicators(inlineChangeIndicators, recordId, field),
    openPopover: openChangePopover,
    onIndicatorClick: handleIndicatorClick,
  });

  // Cargar indicadores de cambios (desde equipments, purchases, service_records y new_purchases)
  const loadChangeIndicators = async (recordIds?: string[]) => {
    if (data.length === 0) return;
    
    try {
      const idsToLoad = recordIds || data.map(d => d.id);
      const purchaseIds = data.filter(d => d.purchase_id).map(d => d.purchase_id);
      const newPurchaseIds = data.filter(d => d.new_purchase_id).map(d => d.new_purchase_id as string);
      
      // Cargar cambios de equipments
      const equipmentsResponse = await apiPost<Record<string, Array<{
        id: string;
        field_name: string;
        field_label: string;
        old_value: string | number | null;
        new_value: string | number | null;
        change_reason: string | null;
        changed_at: string;
        module_name: string | null;
      }>>>('/api/change-logs/batch', {
        table_name: 'equipments',
        record_ids: idsToLoad,
      });
      
      // Cargar cambios de purchases (para campos como MC, movimiento, fechas)
      const purchasesResponse = purchaseIds.length > 0 ? await apiPost<Record<string, Array<{
        id: string;
        field_name: string;
        field_label: string;
        old_value: string | number | null;
        new_value: string | number | null;
        change_reason: string | null;
        changed_at: string;
        module_name: string | null;
      }>>>('/api/change-logs/batch', {
        table_name: 'purchases',
        record_ids: purchaseIds,
      }) : {};
      
      // Cargar cambios de service_records usando purchase_ids
      const serviceResponse = purchaseIds.length > 0 ? await apiPost<Record<string, Array<{
        id: string;
        field_name: string;
        field_label: string;
        old_value: string | number | null;
        new_value: string | number | null;
        change_reason: string | null;
        changed_at: string;
        module_name: string | null;
      }>>>('/api/change-logs/batch-by-purchase', {
        purchase_ids: purchaseIds,
      }) : {};
      
      // Cargar cambios de new_purchases usando el endpoint específico
      const newPurchasesResponse = newPurchaseIds.length > 0 ? await apiPost<Record<string, Array<{
        id: string;
        field_name: string;
        field_label: string;
        old_value: string | number | null;
        new_value: string | number | null;
        change_reason: string | null;
        changed_at: string;
        module_name: string | null;
      }>>>('/api/change-logs/batch-by-new-purchase', {
        new_purchase_ids: newPurchaseIds,
      }) : {};
      
      const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
      
      // Procesar cambios de equipments
      Object.entries(equipmentsResponse).forEach(([recordId, changes]) => {
        if (changes && changes.length > 0) {
          indicatorsMap[recordId] = changes.slice(0, 10).map((change) => ({
            id: change.id,
            fieldName: change.field_name,
            fieldLabel: change.field_label,
            oldValue: change.old_value,
            newValue: change.new_value,
            reason: change.change_reason || undefined,
            changedAt: change.changed_at,
            moduleName: change.module_name || null,
          }));
        }
      });
      
      // Procesar cambios de purchases y mapearlos al equipment correspondiente
      Object.entries(purchasesResponse).forEach(([purchaseId, changes]) => {
        const equipment = data.find(d => d.purchase_id === purchaseId);
        if (equipment && changes && changes.length > 0) {
          const existingIndicators = indicatorsMap[equipment.id] || [];
          const newIndicators = changes.slice(0, 10).map((change) => ({
            id: change.id,
            fieldName: change.field_name,
            fieldLabel: change.field_label,
            oldValue: change.old_value,
            newValue: change.new_value,
            reason: change.change_reason || undefined,
            changedAt: change.changed_at,
            moduleName: change.module_name || null,
          }));
          indicatorsMap[equipment.id] = [...existingIndicators, ...newIndicators]
            .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
            .slice(0, 10);
        }
      });
      
      // Procesar cambios de service_records y mapearlos al equipment correspondiente
      Object.entries(serviceResponse).forEach(([purchaseId, changes]) => {
        const equipment = data.find(d => d.purchase_id === purchaseId);
        if (equipment && changes && changes.length > 0) {
          const existingIndicators = indicatorsMap[equipment.id] || [];
          const newIndicators = changes.slice(0, 10).map((change) => ({
            id: change.id,
            fieldName: change.field_name,
            fieldLabel: change.field_label,
            oldValue: change.old_value,
            newValue: change.new_value,
            reason: change.change_reason || undefined,
            changedAt: change.changed_at,
            moduleName: change.module_name || null,
          }));
          indicatorsMap[equipment.id] = [...existingIndicators, ...newIndicators]
            .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
            .slice(0, 10);
        }
      });
      
      // Procesar cambios de new_purchases y mapearlos al equipment correspondiente
      Object.entries(newPurchasesResponse).forEach(([newPurchaseId, changes]) => {
        const equipment = data.find(d => d.new_purchase_id === newPurchaseId);
        if (equipment && changes && changes.length > 0) {
          const existingIndicators = indicatorsMap[equipment.id] || [];
          const newIndicators = changes.slice(0, 10).map((change) => ({
            id: change.id,
            fieldName: change.field_name,
            fieldLabel: change.field_label,
            oldValue: change.old_value,
            newValue: change.new_value,
            reason: change.change_reason || undefined,
            changedAt: change.changed_at,
            moduleName: change.module_name || 'compras_nuevos',
          }));
          indicatorsMap[equipment.id] = [...existingIndicators, ...newIndicators]
            .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
            .slice(0, 10);
        }
      });
      
      setInlineChangeIndicators(prev => ({ ...prev, ...indicatorsMap }));
    } catch (error) {
      console.error('Error al cargar indicadores de cambios:', error);
    }
  };

  useEffect(() => {
    if (!loading && data.length > 0) {
      loadChangeIndicators();
    }
  }, [data, loading]);

  const getPrecioStyle = (precio: number | null | undefined) => {
    if (!precio || precio === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md';
  };

  const getStagingStyle = (fecha: string | null | undefined) => {
    if (!fecha || fecha === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
  };

  // Sincronizar scroll superior con tabla
  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;

    if (!topScroll || !tableScroll) return;

    const handleTopScroll = () => {
      if (tableScroll && !tableScroll.contains(document.activeElement)) {
        tableScroll.scrollLeft = topScroll.scrollLeft;
      }
    };

    const handleTableScroll = () => {
      if (topScroll) {
        topScroll.scrollLeft = tableScroll.scrollLeft;
      }
    };

    topScroll.addEventListener('scroll', handleTopScroll);
    tableScroll.addEventListener('scroll', handleTableScroll);

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableScroll.removeEventListener('scroll', handleTableScroll);
    };
  }, []);

  const getKPIStats = () => {
    const total = data.length;
    const disponibles = data.filter((row) => row.state === 'Disponible').length;
    const reservadas = data.filter((row) => row.state === 'Reservada').length;
    const totalValue = data.reduce((sum, row) => {
      const value = typeof row.pvp_est === 'string' ? parseFloat(row.pvp_est) : (row.pvp_est || 0);
      return sum + value;
    }, 0);
    
    return {
      total,
      disponibles,
      reservadas,
      totalValue,
    };
  };

  const stats = getKPIStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Equipos</h1>
              <p className="text-gray-600">Gestión de equipos para venta</p>
            </div>
            <div className="flex gap-3">
              {canSync() && (
                <button 
                  onClick={handleSyncSpecs}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-brand-red to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Sincronizar especificaciones con Subasta y Consolidado"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Sincronizar Specs
                </button>
              )}
              {canAdd() && (
                <button 
                  onClick={() => {
                    setSelectedEquipment(null);
                    setModalOpen(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Agregar Equipo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Equipos</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Disponibles</p>
                <p className="text-3xl font-bold text-green-600">{stats.disponibles}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <Package className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Reservadas</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.reservadas}</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <Package className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Valor Total</p>
                <p className="text-3xl font-bold text-purple-600">
                  ${stats.totalValue?.toLocaleString('es-CO') || '0'}
                </p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <Package className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search y Toggle Modo Masivo */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por modelo o serie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Toggle Modo Masivo */}
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap">
              <input
                type="checkbox"
                checked={batchModeEnabled}
                onChange={(e) => {
                  setBatchModeEnabled(e.target.checked);
                  if (!e.target.checked && pendingBatchChanges.size > 0) {
                    if (window.confirm('¿Deseas guardar los cambios pendientes antes de desactivar el modo masivo?')) {
                      handleSaveBatchChanges();
                    } else {
                      handleCancelBatchChanges();
                    }
                  }
                }}
                className="w-4 h-4 text-[#cf1b22] focus:ring-[#cf1b22] border-gray-300 rounded"
              />
              <Layers className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Modo Masivo</span>
            </label>
          </div>
        </div>

        {/* Barra de Scroll Superior - Sincronizada */}
        <div className="mb-3">
          <div 
            ref={topScrollRef}
            className="overflow-x-auto bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
            style={{ height: '14px' }}
          >
            <div style={{ width: '5000px', height: '1px' }}></div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div ref={tableScrollRef} className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-brand-red to-primary-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MARCA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MODELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SERIE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">AÑO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">HORAS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">CONDICIÓN</th>
                  {!isCommercial() && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA FACTURA</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE SALIDA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE LLEGADA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase bg-yellow-600">MC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA DE MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">ESTADO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">OBS. COMERCIALES</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PVP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">INICIO ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FES</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">TIPO ALIST.</th>
                  <th className="px-2 py-3 text-center text-xs font-semibold text-white uppercase sticky right-0 bg-brand-red z-10" style={{ minWidth: 140 }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={isCommercial() ? 18 : 19} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={isCommercial() ? 18 : 19} className="px-4 py-8 text-center text-gray-500">
                      No hay equipos registrados
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => {
                    const hasPendingReservation = isJefeComercial() && 
                      equipmentReservations[row.id]?.some((r: any) => r.status === 'PENDING');
                    const hasAnsweredReservation = isCommercial() && 
                      equipmentReservations[row.id]?.some((r: any) => r.status === 'APPROVED' || r.status === 'REJECTED');
                    const rowBgColor = (hasPendingReservation || hasAnsweredReservation) ? 'bg-yellow-50 hover:bg-yellow-100' : 'bg-white hover:bg-gray-50';
                    
                    return (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`${rowBgColor} transition-colors`}
                      >
                        {/* MARCA */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-800 uppercase tracking-wide">{row.brand || '-'}</span>
                        </td>
                        
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          <span className="text-gray-800">{row.model || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-800 font-mono">{row.serial || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-700">{row.year || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-700">{row.hours ? row.hours.toLocaleString('es-CO') : '-'}</span>
                        </td>
                        
                        {/* CONDICIÓN */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {(() => {
                            const condition = row.condition || 'USADO';
                            const isNuevo = condition === 'NUEVO';
                            return (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  isNuevo
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {condition}
                              </span>
                            );
                          })()}
                        </td>
                        {!isCommercial() && (
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <InlineCell {...buildCellProps(row.id, 'invoice_date')}>
                              <span className="text-gray-700">{formatDate(row.invoice_date)}</span>
                            </InlineCell>
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'shipment_departure_date')}>
                            <span className="text-gray-700">{formatDate(row.shipment_departure_date)}</span>
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'shipment_arrival_date')}>
                            <span className="text-gray-700">{formatDate(row.shipment_arrival_date)}</span>
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'nationalization_date')}>
                            <span className="text-gray-700">{formatDate(row.nationalization_date)}</span>
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'mc')}>
                            <span className="text-gray-700">{row.mc || '-'}</span>
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'current_movement')}>
                            <span className="text-gray-700">{row.current_movement || '-'}</span>
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'current_movement_date')}>
                            <span className="text-gray-700">{formatDate(row.current_movement_date)}</span>
                          </InlineCell>
                        </td>
                        
                        {/* ESTADO */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'state')}>
                            <InlineFieldEditor
                              type="select"
                              value={row.state || ''}
                              placeholder="Estado"
                              options={STATES.map(s => ({ value: s, label: s }))}
                              displayFormatter={(val) => {
                                if (!val || val === '') return '-';
                                return <span className="text-gray-700">{String(val)}</span>;
                              }}
                              onSave={(val) => requestFieldUpdate(row, 'state', 'Estado', val)}
                            />
                          </InlineCell>
                        </td>
                        
                        {/* OBS. COMERCIALES */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'commercial_observations')}>
                            <InlineFieldEditor
                              value={row.commercial_observations || ''}
                              placeholder="Observaciones comerciales"
                              onSave={(val) => requestFieldUpdate(row, 'commercial_observations', 'Observaciones comerciales', val)}
                            />
                          </InlineCell>
                        </td>
                        
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'pvp_est')}>
                            <InlineFieldEditor
                              type="number"
                              value={row.pvp_est ?? ''}
                              placeholder="0"
                              displayFormatter={() => row.pvp_est ? formatNumber(row.pvp_est) : '-'}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'pvp_est', 'PVP', numeric);
                              }}
                            />
                          </InlineCell>
                        </td>
                        
                        {/* INICIO ALISTAMIENTO */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'start_staging')}>
                            {formatDate(row.start_staging || null) !== '-' ? (
                              <span className={getStagingStyle(formatDate(row.start_staging || null))}>
                                {formatDate(row.start_staging || null)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </InlineCell>
                        </td>
                        
                        {/* FES (FIN ALISTAMIENTO) */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'end_staging')}>
                            {formatDate(row.end_staging || null) !== '-' ? (
                              <span className={getStagingStyle(formatDate(row.end_staging || null))}>
                                {formatDate(row.end_staging || null)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </InlineCell>
                        </td>
                        
                        {/* TIPO ALISTAMIENTO */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'staging_type')}>
                            <InlineFieldEditor
                              type="select"
                              value={(row as any).staging_type || ''}
                              placeholder="Seleccionar"
                              options={[
                                { value: '', label: '-' },
                                { value: 'NORMAL', label: 'Normal' },
                                { value: 'ADICIONAL', label: 'Adicional' },
                              ]}
                              onSave={(val) =>
                                requestFieldUpdate(row, 'staging_type', 'Tipo Alistamiento', val || null)
                              }
                              displayFormatter={(val) => {
                                if (!val) return '-';
                                if (val === 'NORMAL') return 'Normal';
                                if (val === 'ADICIONAL') return 'Adicional';
                                return String(val);
                              }}
                            />
                          </InlineCell>
                        </td>
                        
                        <td className="px-2 py-3 sticky right-0 bg-white z-10" style={{ minWidth: 140 }}>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => handleView(row)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canEdit() && !isCommercial() && (
                              <button
                                onClick={() => handleEdit(row)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                console.log('🔍 Abriendo historial de Equipments:', row.id, 'Purchase ID:', row.purchase_id);
                                setHistoryRecord(row);
                                setIsHistoryOpen(true);
                              }}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Historial de cambios"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            {/* Botón de reservar para comerciales */}
                            {isCommercial() && (
                              <button
                                onClick={() => handleReserveEquipment(row)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  equipmentReservations[row.id]?.some((r: any) => r.status === 'APPROVED' || r.status === 'REJECTED')
                                    ? 'text-yellow-600 hover:bg-yellow-50'
                                    : 'text-[#cf1b22] hover:bg-red-50'
                                }`}
                                title={
                                  equipmentReservations[row.id]?.some((r: any) => r.status === 'APPROVED' || r.status === 'REJECTED')
                                    ? 'Ver respuesta de reserva'
                                    : (row as any).reservation_status === 'RESERVED'
                                    ? 'Equipo reservado'
                                    : 'Solicitar reserva'
                                }
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                            {/* Botón de ver reserva para jefe comercial */}
                            {isJefeComercial() && equipmentReservations[row.id]?.some((r: any) => r.status === 'PENDING') && (
                              equipmentReservations[row.id]
                                .filter((r: any) => r.status === 'PENDING')
                                .map((reservation: any) => (
                                  <button
                                    key={reservation.id}
                                    onClick={() => {
                                      setSelectedReservation({ ...reservation, equipment_id: row.id });
                                      setViewReservationModalOpen(true);
                                    }}
                                    className="p-1.5 text-[#cf1b22] hover:bg-red-50 rounded-lg transition-colors"
                                    title="Ver solicitud de reserva"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                ))
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <EquipmentModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEquipment(null);
        }}
        equipment={selectedEquipment}
        onSuccess={fetchData}
      />

      {/* View Modal */}
      <Modal
        isOpen={viewOpen}
        onClose={() => { setViewOpen(false); setViewEquipment(null); }}
        title="Detalle del Equipo"
        size="md"
      >
        {viewEquipment && (
          <div className="space-y-3">
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg">
              {!isCommercial() && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">PROVEEDOR</p>
                  {viewEquipment.supplier_name ? (
                    <span className="text-sm text-gray-900">
                      {viewEquipment.supplier_name}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">MODELO</p>
                {viewEquipment.model ? (
                  <span className="text-sm text-gray-900">
                    {viewEquipment.model}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">SERIE</p>
                {viewEquipment.serial ? (
                  <span className="text-sm text-gray-900">
                    {viewEquipment.serial}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">AÑO</p>
                {viewEquipment.year ? (
                  <span className="text-sm text-gray-900">
                    {viewEquipment.year}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">HORAS</p>
                {viewEquipment.hours ? (
                  <span className="text-sm text-gray-900">
                    {viewEquipment.hours.toLocaleString('es-CO')}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              {!isCommercial() && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">SERIE COMPLETA</p>
                  {viewEquipment.full_serial ? (
                    <span className="text-sm text-gray-900">
                      {formatNumber(viewEquipment.full_serial)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">ESTADO</p>
                {viewEquipment.state ? (
                  <span className="text-sm text-gray-900">
                    {viewEquipment.state}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">MOVIMIENTO</p>
                {viewEquipment.current_movement ? (
                  <span className="text-sm text-gray-900">
                    {viewEquipment.current_movement}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
            </div>

            {/* Logística */}
            <div className="border border-gray-200 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-800 mb-2">Logística</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">EMBARQUE SALIDA</p>
                  {formatDate(viewEquipment.shipment_departure_date) !== '-' ? (
                    <span className="text-sm text-gray-900">
                      {formatDate(viewEquipment.shipment_departure_date)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">EMBARQUE LLEGADA</p>
                  {formatDate(viewEquipment.shipment_arrival_date) !== '-' ? (
                    <span className="text-sm text-gray-900">
                      {formatDate(viewEquipment.shipment_arrival_date)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">PUERTO</p>
                  {viewEquipment.port_of_destination ? (
                    <span className="text-sm text-gray-900">
                      {viewEquipment.port_of_destination}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">NACIONALIZACIÓN</p>
                  {formatDate(viewEquipment.nationalization_date) !== '-' ? (
                    <span className="text-sm text-gray-900">
                      {formatDate(viewEquipment.nationalization_date)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">FECHA DE MOVIMIENTO</p>
                  {formatDate(viewEquipment.current_movement_date) !== '-' ? (
                    <span className="text-sm text-gray-900">
                      {formatDate(viewEquipment.current_movement_date)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Especificaciones */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-800 mb-2">Especificaciones</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tipo de Máquina</p>
                  {viewEquipment.machine_type ? (
                    <span className="text-sm text-gray-900">
                      {viewEquipment.machine_type}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Estado</p>
                  {viewEquipment.state ? (
                    <span className={getEstadoStyle(viewEquipment.state)}>
                      {viewEquipment.state}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Línea Húmeda</p>
                  {viewEquipment.wet_line ? (
                    <span className="text-sm text-gray-900">
                      {viewEquipment.wet_line}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tipo Brazo</p>
                  {viewEquipment.arm_type ? (
                    <span className="text-sm text-gray-900">
                      {viewEquipment.arm_type}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Ancho Zapatas</p>
                  {viewEquipment.track_width ? (
                    <span className="text-sm text-gray-900">
                      {formatNumber(viewEquipment.track_width)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Cap. Cucharón</p>
                  {viewEquipment.bucket_capacity ? (
                    <span className="text-sm text-gray-900">
                      {formatNumber(viewEquipment.bucket_capacity)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Garantía Meses</p>
                  {viewEquipment.warranty_months ? (
                    <span className="text-sm text-gray-900">
                      {formatNumber(viewEquipment.warranty_months)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Garantía Horas</p>
                  {viewEquipment.warranty_hours ? (
                    <span className="text-sm text-gray-900">
                      {formatNumber(viewEquipment.warranty_hours)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Marca Motor</p>
                  {viewEquipment.engine_brand ? (
                    <span className="text-sm text-gray-900">
                      {viewEquipment.engine_brand}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tipo Cabina</p>
                  {viewEquipment.cabin_type ? (
                    <span className="text-sm text-gray-900">
                      {viewEquipment.cabin_type}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Venta */}
            <div className="border border-gray-200 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-800 mb-2">Venta</h3>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">PVP</p>
                  {viewEquipment.pvp_est ? (
                    <span className="text-sm text-gray-900">
                      ${viewEquipment.pvp_est.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Observaciones Comerciales */}
            {viewEquipment.commercial_observations && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <h3 className="text-xs font-semibold text-gray-800 mb-2">Observaciones Comerciales</h3>
                <div>
                  <p className="text-xs text-gray-700">
                    {viewEquipment.commercial_observations}
                  </p>
                </div>
              </div>
            )}

            {/* Fechas de Alistamiento */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-800 mb-2">Alistamiento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">INICIO ALIST.</p>
                  {formatDate(viewEquipment.start_staging || null) !== '-' ? (
                    <span className="text-sm text-gray-900">
                      {formatDate(viewEquipment.start_staging || null)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">FES</p>
                  {formatDate(viewEquipment.end_staging || null) !== '-' ? (
                    <span className="text-sm text-gray-900">
                      {formatDate(viewEquipment.end_staging || null)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Archivos comerciales: solo ver */}
            {viewEquipment.machine_id && (
              <div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-[#cf1b22] p-2 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Material Comercial</h3>
                      <p className="text-xs text-gray-600">Fotos y documentos para clientes</p>
                    </div>
                  </div>
                  
                  <MachineFiles 
                    machineId={viewEquipment.machine_id}
                    allowUpload={false}
                    allowDelete={false}
                    currentScope="EQUIPOS"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de Historial */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Historial de Cambios - Todos los Módulos"
        size="lg"
      >
        {historyRecord && (
          <ChangeHistory 
            tableName="equipments" 
            recordId={historyRecord.id}
            purchaseId={historyRecord.purchase_id}
          />
        )}
      </Modal>

      {/* Modal de Formulario de Reserva */}
      {reservationFormOpen && selectedEquipmentForReservation && (
        <EquipmentReservationForm
          equipment={{
            id: selectedEquipmentForReservation.id,
            brand: selectedEquipmentForReservation.brand || '',
            model: selectedEquipmentForReservation.model || '',
            serial: selectedEquipmentForReservation.serial || '',
            condition: selectedEquipmentForReservation.condition || '',
            pvp_est: selectedEquipmentForReservation.pvp_est || null,
          }}
          existingReservation={
            equipmentReservations[selectedEquipmentForReservation.id]?.[0]?.status !== 'PENDING'
              ? equipmentReservations[selectedEquipmentForReservation.id]?.[0]
              : undefined
          }
          onClose={() => {
            setReservationFormOpen(false);
            setSelectedEquipmentForReservation(null);
          }}
          onSuccess={handleReservationSuccess}
        />
      )}

      {/* Modal de Visualización de Documentos de Reserva */}
      <Modal
        isOpen={viewReservationModalOpen}
        onClose={() => {
          setViewReservationModalOpen(false);
          setSelectedReservation(null);
        }}
        title="Solicitud de Reserva"
        size="md"
      >
        {selectedReservation && (
          <div className="space-y-4">
            {/* Header con estado */}
            <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 p-3 rounded-lg text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-90">Estado de la Solicitud</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${
                    selectedReservation.status === 'PENDING' 
                      ? 'bg-yellow-400 text-yellow-900'
                      : selectedReservation.status === 'APPROVED'
                      ? 'bg-green-400 text-green-900'
                      : 'bg-red-300 text-red-900'
                  }`}>
                    {selectedReservation.status === 'PENDING' ? 'PENDIENTE' : 
                     selectedReservation.status === 'APPROVED' ? 'APROBADA' : 'RECHAZADA'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-90">Fecha</p>
                  <p className="text-sm font-medium">
                    {selectedReservation.created_at 
                      ? new Date(selectedReservation.created_at).toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Documentos Adjuntos */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Documentos Adjuntos</h3>
              </div>
              <div className="p-3">
                {selectedReservation.documents && Array.isArray(selectedReservation.documents) && selectedReservation.documents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedReservation.documents.map((doc: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white p-2 rounded border border-gray-200 hover:border-[#cf1b22] transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 text-[#cf1b22] flex-shrink-0" />
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {doc.name || `Documento ${index + 1}`}
                          </p>
                        </div>
                        {doc.url && (
                          <div className="flex gap-1 ml-2">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-[#cf1b22] hover:bg-red-50 rounded transition-colors"
                              title="Ver documento"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={doc.url}
                              download
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Descargar documento"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic text-center py-2">No hay documentos adjuntos</p>
                )}
              </div>
            </div>

            {/* Comentarios */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Comentarios del Comercial</h3>
              </div>
              <div className="p-3">
                {selectedReservation.comments ? (
                  <p className="text-xs text-gray-700 whitespace-pre-wrap bg-white p-2 rounded border border-gray-200">
                    {selectedReservation.comments}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 italic text-center py-2">No hay comentarios</p>
                )}
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setViewReservationModalOpen(false);
                  setSelectedReservation(null);
                }}
                className="px-4 py-1.5 text-xs bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (selectedReservation) {
                    handleApproveReservation(selectedReservation.id, selectedReservation.equipment_id);
                    setViewReservationModalOpen(false);
                    setSelectedReservation(null);
                  }
                }}
                className="px-4 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Aprobar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (selectedReservation) {
                    handleRejectReservation(selectedReservation.id, selectedReservation.equipment_id);
                    setViewReservationModalOpen(false);
                    setSelectedReservation(null);
                  }
                }}
                className="px-4 py-1.5 text-xs bg-[#cf1b22] text-white hover:bg-red-700"
              >
                Rechazar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Control de Cambios para Inline Editing */}
      <ChangeLogModal
        isOpen={changeModalOpen}
        changes={changeModalItems}
        onConfirm={(reason) => {
          handleConfirmInlineChange(reason);
        }}
        onCancel={() => {
          handleCancelInlineChange();
        }}
      />

        {/* Botón flotante para guardar cambios en modo batch */}
        {batchModeEnabled && pendingBatchChanges.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden max-w-sm">
              {/* Header compacto con gradiente institucional */}
              <div className="bg-gradient-to-r from-[#cf1b22] to-[#8a1217] px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-md backdrop-blur-sm">
                    <Layers className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm truncate">Modo Masivo</h3>
                    <p className="text-white/90 text-[10px] font-medium truncate">
                      Cambios pendientes
                    </p>
                  </div>
                </div>
              </div>

              {/* Contenido compacto */}
              <div className="px-4 py-3 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex items-center justify-between gap-4">
                  {/* Estadísticas compactas */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-[#cf1b22] rounded-full animate-pulse"></div>
                      <div>
                        <p className="text-lg font-bold text-[#cf1b22] leading-tight">
                          {pendingBatchChanges.size}
                        </p>
                        <p className="text-[10px] text-gray-600 font-medium leading-tight">
                          {pendingBatchChanges.size === 1 ? 'Registro' : 'Registros'}
                        </p>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-gray-300"></div>
                    <div>
                      <p className="text-lg font-bold text-gray-800 leading-tight">
                        {Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0)}
                      </p>
                      <p className="text-[10px] text-gray-600 font-medium leading-tight">
                        {Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0) === 1 ? 'Campo' : 'Campos'}
                      </p>
                    </div>
                  </div>

                  {/* Botones de acción compactos */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleCancelBatchChanges}
                      variant="secondary"
                      className="px-3 py-1.5 text-xs font-semibold border border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50 transition-all duration-200 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      onClick={handleSaveBatchChanges}
                      className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#cf1b22] to-[#8a1217] hover:from-[#b8181e] hover:to-[#8a1217] text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-md flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Guardar</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Barra de progreso sutil */}
              <div className="h-0.5 bg-gray-100">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#cf1b22] to-[#8a1217]"
                  initial={{ width: 0 }}
                  animate={{ 
                    width: `${Math.min(100, (Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0) / 10) * 100)}%` 
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </motion.div>
        )}
    </div>
  );
};

