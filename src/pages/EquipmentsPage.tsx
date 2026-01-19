/**
 * Módulo de Equipos
 * Vista de máquinas para venta con datos de Logística y Consolidado
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Package, Eye, Edit, History, Clock, Layers, Save, X, FileText, ExternalLink, Settings, Trash2, ChevronDown, ChevronUp, Filter, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiGet, apiPut, apiPost, apiDelete } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { useBatchModeGuard } from '../hooks/useBatchModeGuard';
import { useAuth } from '../context/AuthContext';
import { EquipmentModal } from '../organisms/EquipmentModal';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { Button } from '../atoms/Button';
import { EquipmentReservationForm } from '../components/EquipmentReservationForm';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatMachineType } from '../constants/machineTypes';
import { ReservationTimeline } from '../components/ReservationTimeline';
import { formatChangeValue } from '../utils/formatChangeValue';

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
  
  // Fecha límite de reserva
  reservation_deadline_date?: string | null;
  
  // Relación con new_purchases
  new_purchase_id?: string | null;
  
  // Columnas de reserva
  cliente?: string | null;
  asesor?: string | null;
}

type EquipmentReservation = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  equipment_id?: string;
  first_checklist_date?: string | null;
  consignacion_10_millones?: boolean | null;
  porcentaje_10_valor_maquina?: boolean | null;
  firma_documentos?: boolean | null;
  rejection_reason?: string | null;
  approved_by?: string | null;
  rejected_by?: string | null;
  cliente?: string | null;
  asesor?: string | null;
  comments?: string | null;
  documents?: Array<{ url?: string | null; name?: string | null; type?: string | null }>;
  approved_at?: string | null;
  rejected_at?: string | null;
  approved_by_name?: string | null;
  rejected_by_name?: string | null;
  created_at?: string;
};

const STATES = ['Libre', 'Lista, Pendiente Entrega', 'Separada', 'Reservada', 'Vendida'];

export const EquipmentsPage = () => {
  const { userProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<EquipmentRow[]>([]);
  const [filteredData, setFilteredData] = useState<EquipmentRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  // Filtros de columnas
  const [brandFilter, setBrandFilter] = useState('');
  const [machineTypeFilter, setMachineTypeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [serialFilter, setSerialFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [hoursFilter, setHoursFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [etdFilter, setEtdFilter] = useState('');
  const [etaFilter, setEtaFilter] = useState('');
  const [nationalizationFilter, setNationalizationFilter] = useState('');
  const [mcFilter, setMcFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [locationDateFilter, setLocationDateFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [clienteFilter, setClienteFilter] = useState('');
  const [asesorFilter, setAsesorFilter] = useState('');
  const [pvpFilter, setPvpFilter] = useState('');
  const [startStagingFilter, setStartStagingFilter] = useState('');
  const [endStagingFilter, setEndStagingFilter] = useState('');
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
  const [filesSectionExpanded, setFilesSectionExpanded] = useState(false);
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { recordId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());
  const [reservationFormOpen, setReservationFormOpen] = useState(false);
  const [selectedEquipmentForReservation, setSelectedEquipmentForReservation] = useState<EquipmentRow | null>(null);
  const [equipmentReservations, setEquipmentReservations] = useState<Record<string, EquipmentReservation[]>>({});
  const [viewReservationModalOpen, setViewReservationModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterModalType, setFilterModalType] = useState<'disponibles' | 'reservadas' | 'nuevas' | 'usadas' | null>(null);
  const [filterModalCondition, setFilterModalCondition] = useState<'all' | 'NUEVO' | 'USADO'>('all');
  const [selectedReservation, setSelectedReservation] = useState<EquipmentReservation | null>(null);
  const [specsPopoverOpen, setSpecsPopoverOpen] = useState<string | null>(null);
  const isSpecEditor = false; // SPEC solo lectura para todos los usuarios
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingSpecs, setEditingSpecs] = useState<Record<string, any>>({});
  const [timelinePopoverOpen, setTimelinePopoverOpen] = useState<string | null>(null);
  const [movementsData, setMovementsData] = useState<Record<string, Array<{
    id: string;
    movement_description: string;
    movement_date: string;
    driver_name: string | null;
    movement_plate: string | null;
    created_at: string;
  }>>>({});
  const [reservationFocus, setReservationFocus] = useState<{
    equipmentId: string | null;
    serial: string | null;
    model: string | null;
  }>({ equipmentId: null, serial: null, model: null });
  const [focusPurchaseId, setFocusPurchaseId] = useState<string | null>(null);
  
  // Cache básico en memoria para evitar recargas innecesarias
  const equipmentsCacheRef = useRef<{
    data: EquipmentRow[];
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 30000; // 30 segundos de caché
  const [notificationFocusActive, setNotificationFocusActive] = useState(false);

  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(4000);
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

  // Detectar navegación desde notificaciones para enfocar una reserva específica
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const equipmentId = params.get('reservationEquipmentId');
    const serial = params.get('serial');
    const model = params.get('model');
    const purchaseId = params.get('purchaseId');

    if (equipmentId || serial || model) {
      setReservationFocus({
        equipmentId: equipmentId || null,
        serial: serial || null,
        model: model || null,
      });
    } else if (reservationFocus.equipmentId || reservationFocus.serial || reservationFocus.model) {
      setReservationFocus({ equipmentId: null, serial: null, model: null });
    }

    if (purchaseId) {
      setFocusPurchaseId(purchaseId);
      setNotificationFocusActive(true);
    } else {
      setFocusPurchaseId(null);
      setNotificationFocusActive(false);
    }
  }, [location.search, reservationFocus.equipmentId, reservationFocus.serial, reservationFocus.model]);

  // Valores únicos para filtros de columnas
  const uniqueBrands = useMemo(
    () => [...new Set(data.map(item => item.brand).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueMachineTypes = useMemo(
    () => [...new Set(data.map(item => item.machine_type).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueModels = useMemo(
    () => [...new Set(data.map(item => item.model).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueSerials = useMemo(
    () => [...new Set(data.map(item => item.serial).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueYears = useMemo(
    () => [...new Set(data.map(item => item.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a)) as number[],
    [data]
  );
  const uniqueHours = useMemo(
    () => [...new Set(data.map(item => item.hours).filter(Boolean))].sort((a, b) => Number(a) - Number(b)) as number[],
    [data]
  );
  const uniqueConditions = useMemo(
    () => [...new Set(data.map(item => item.condition).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueMCs = useMemo(
    () => [...new Set(data.map(item => item.mc).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueLocations = useMemo(
    () => [...new Set(data.map(item => item.current_movement).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueStates = useMemo(
    () => [...new Set(data.map(item => item.state).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueClientes = useMemo(
    () => [...new Set(data.map(item => item.cliente).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueAsesores = useMemo(
    () => [...new Set(data.map(item => item.asesor).filter(Boolean))].sort() as string[],
    [data]
  );

  // Ajustar ancho del scroll superior al ancho real de la tabla
  useEffect(() => {
    const updateWidth = () => {
      const tableEl = tableRef.current;
      if (!tableEl) return;
      const width = tableEl.scrollWidth || tableEl.offsetWidth || 4000;
      setTableWidth(width);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    if (tableRef.current) {
      resizeObserver.observe(tableRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [filteredData]);

  useEffect(() => {
    const focusActive = !!(reservationFocus.equipmentId || reservationFocus.serial || reservationFocus.model);
    let result = data;
    
    // Filtro por notificación (Orden de Compra SAP)
    if (notificationFocusActive && focusPurchaseId) {
      result = data.filter((row) => row.purchase_id === focusPurchaseId);
    } else if (focusActive) {
      result = data.filter((row) =>
        (reservationFocus.equipmentId && row.id === reservationFocus.equipmentId) ||
        (reservationFocus.serial && row.serial?.toLowerCase() === reservationFocus.serial.toLowerCase()) ||
        (reservationFocus.model && row.model?.toLowerCase() === reservationFocus.model.toLowerCase())
      );
    } else {
    if (searchTerm) {
      result = result.filter(
        (row) =>
          row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.serial.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtros de columnas
    if (brandFilter && result.some(item => item.brand === brandFilter)) {
      result = result.filter(item => item.brand === brandFilter);
    }
    if (machineTypeFilter && result.some(item => item.machine_type === machineTypeFilter)) {
      result = result.filter(item => item.machine_type === machineTypeFilter);
    }
    if (modelFilter && result.some(item => item.model === modelFilter)) {
      result = result.filter(item => item.model === modelFilter);
    }
    if (serialFilter && result.some(item => item.serial === serialFilter)) {
      result = result.filter(item => item.serial === serialFilter);
    }
    if (yearFilter && result.some(item => String(item.year) === yearFilter)) {
      result = result.filter(item => String(item.year) === yearFilter);
    }
    if (hoursFilter && result.some(item => String(item.hours) === hoursFilter)) {
      result = result.filter(item => String(item.hours) === hoursFilter);
    }
    if (conditionFilter && result.some(item => item.condition === conditionFilter)) {
      result = result.filter(item => item.condition === conditionFilter);
    }
    if (stateFilter && result.some(item => item.state === stateFilter)) {
      result = result.filter(item => item.state === stateFilter);
    }
    if (clienteFilter && result.some(item => item.cliente === clienteFilter)) {
      result = result.filter(item => item.cliente === clienteFilter);
    }
    if (asesorFilter && result.some(item => item.asesor === asesorFilter)) {
      result = result.filter(item => item.asesor === asesorFilter);
    }
    }

    // Filtrado por purchaseId proveniente de notificación (Orden de Compra SAP)
    if (notificationFocusActive && focusPurchaseId) {
      result = result.filter((item) => item.purchase_id === focusPurchaseId);
    }

    // Ordenar según las reglas especificadas
    result.sort((a, b) => {
      const aHasETD = !!(a.shipment_departure_date && a.shipment_departure_date !== '-');
      const bHasETD = !!(b.shipment_departure_date && b.shipment_departure_date !== '-');
      const aIsReserved = a.state === 'Reservada';
      const bIsReserved = b.state === 'Reservada';
      const aIsUsed = a.condition === 'USADO';
      const bIsUsed = b.condition === 'USADO';
      
      // 1. Primero los equipos con reserva (amarillo) - por encima de todo
      if (aIsReserved && !bIsReserved) return -1;
      if (!aIsReserved && bIsReserved) return 1;
      
      // Si ambos tienen reserva, aplicar las mismas reglas de ordenamiento
      // Si ninguno tiene reserva, continuar con las reglas normales
      
      // 2. Equipos USADOS con ETD
      if (aIsUsed && aHasETD && !(bIsUsed && bHasETD)) return -1;
      if (!(aIsUsed && aHasETD) && bIsUsed && bHasETD) return 1;
      
      // 3. Equipos NUEVOS con ETD
      if (!aIsUsed && aHasETD && !(!bIsUsed && bHasETD)) return -1;
      if (!(!aIsUsed && aHasETD) && !bIsUsed && bHasETD) return 1;
      
      // 4. Equipos sin ETD: primero USADOS, luego NUEVOS
      if (!aHasETD && !bHasETD) {
        if (aIsUsed && !bIsUsed) return -1;
        if (!aIsUsed && bIsUsed) return 1;
      }
      
      // Si ambos tienen ETD o ambos no tienen ETD, mantener orden original
      return 0;
    });

    setFilteredData(result);
  }, [searchTerm, data, brandFilter, machineTypeFilter, modelFilter, serialFilter, yearFilter, hoursFilter, conditionFilter, etdFilter, etaFilter, nationalizationFilter, mcFilter, locationFilter, locationDateFilter, stateFilter, clienteFilter, asesorFilter, pvpFilter, startStagingFilter, endStagingFilter, reservationFocus, notificationFocusActive, focusPurchaseId]);

  const fetchData = async (forceRefresh = false) => {
    // Verificar caché si no se fuerza refresh
    if (!forceRefresh && equipmentsCacheRef.current) {
      const cacheAge = Date.now() - equipmentsCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        console.log('📦 [Equipments] Usando datos del caché (edad:', Math.round(cacheAge / 1000), 's)');
        setData(equipmentsCacheRef.current.data);
        setFilteredData(equipmentsCacheRef.current.data);
        setLoading(false);
        return;
      }
    }
    
    try {
      setLoading(true);
      const response = await apiGet<EquipmentRow[]>('/api/equipments');
      
      // Actualizar caché
      equipmentsCacheRef.current = {
        data: response,
        timestamp: Date.now(),
      };
      
      setData(response);
      setFilteredData(response);
    } catch {
      showError('Error al cargar los datos');
      // Si hay error pero tenemos caché, usar datos en caché
      if (equipmentsCacheRef.current) {
        console.log('⚠️ [Equipments] Usando datos del caché debido a error');
        setData(equipmentsCacheRef.current.data);
        setFilteredData(equipmentsCacheRef.current.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const canEdit = () => {
    return userProfile?.role === 'comerciales' || userProfile?.role === 'jefe_comercial' || userProfile?.role === 'admin';
  };

  const isCommercial = () => {
    return userProfile?.role === 'comerciales';
  };

  const isJefeComercial = () => {
    return userProfile?.role === 'jefe_comercial' || userProfile?.role === 'admin';
  };

  const isAdmin = () => {
    return userProfile?.role === 'admin';
  };

  const handleDeleteEquipment = async (equipment: EquipmentRow) => {
    if (!window.confirm(`¿Está seguro de eliminar el equipo ${equipment.model} - ${equipment.serial}?`)) {
      return;
    }

    try {
      await apiDelete(`/api/equipments/${equipment.id}`);
      showSuccess('Equipo eliminado exitosamente');
      await fetchData(true); // Forzar refresh después de actualizar
    } catch (error) {
      console.error('Error al eliminar equipo:', error);
      showError('Error al eliminar el equipo');
    }
  };

  const handleReserveEquipment = async (equipment: EquipmentRow) => {
    // Validar que el equipo esté disponible para reserva
    if (equipment.state !== 'Libre') {
      showError(`El equipo no está disponible para reserva. Estado actual: ${equipment.state}. Solo se pueden crear reservas cuando el equipo está "Libre".`);
      return;
    }
    
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
      const reservations = await apiGet<EquipmentReservation[]>(`/api/equipments/${equipmentId}/reservations`);
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
      await fetchData(true); // Forzar refresh después de actualizar
      await loadReservations(equipmentId);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      showError((error as any).message || 'Error al aprobar la reserva');
    }
  };

  const handleRejectReservation = async (reservationId: string, equipmentId: string) => {
    const reason = prompt('Ingresa la razón del rechazo (opcional):');
    try {
      await apiPut(`/api/equipments/reservations/${reservationId}/reject`, {
        rejection_reason: reason || null,
      });
      showSuccess('Reserva rechazada exitosamente');
      await fetchData(true); // Forzar refresh después de actualizar
      await loadReservations(equipmentId);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      showError((error as any).message || 'Error al rechazar la reserva');
    }
  };

  // Cargar reservas para equipos cuando el usuario es jefe comercial (todas las reservas, no solo PENDING)
  useEffect(() => {
    if (isJefeComercial() && data.length > 0) {
      data.forEach((equipment) => {
        // Cargar reservas para todos los equipos que tengan reservas (cualquier estado)
        const reservationMeta = equipment as {
          total_reservations_count?: number;
          pending_reservations_count?: number;
        };
        const totalReservations =
          reservationMeta.total_reservations_count ??
          reservationMeta.pending_reservations_count ??
          0;
        if (totalReservations > 0 || equipment.state === 'Separada' || equipment.state === 'Reservada') {
          loadReservations(equipment.id);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, userProfile]);

  const handleEdit = (row: EquipmentRow) => {
    setSelectedEquipment(row);
    setModalOpen(true);
  };

  const handleView = (row: EquipmentRow) => {
    setViewEquipment(row);
    setViewOpen(true);
  };


  const fetchMovements = async (purchaseId: string) => {
    try {
      const movements = await apiGet<Array<{
        id: string;
        movement_description: string;
        movement_date: string;
        driver_name: string | null;
        movement_plate: string | null;
        created_at: string;
      }>>(`/api/movements/${purchaseId}`);
      
      setMovementsData(prev => ({
        ...prev,
        [purchaseId]: movements,
      }));
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
      setMovementsData(prev => ({
        ...prev,
        [purchaseId]: [],
      }));
    }
  };

  const handleTimelineClick = async (e: React.MouseEvent, row: EquipmentRow) => {
    e.stopPropagation();
    const purchaseId = row.purchase_id;
    
    if (timelinePopoverOpen === purchaseId) {
      setTimelinePopoverOpen(null);
    } else {
      setTimelinePopoverOpen(purchaseId);
      if (!movementsData[purchaseId]) {
        await fetchMovements(purchaseId);
      }
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      // Si viene como fecha ISO completa, extraer solo la parte de fecha
      if (typeof date === 'string' && date.includes('T')) {
        const dateOnly = date.split('T')[0];
        const [year, month, day] = dateOnly.split('-');
        return `${day}/${month}/${year}`;
      }
      // Si viene como YYYY-MM-DD, formatear directamente sin conversión de zona horaria
      if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year}`;
      }
      // Para otros formatos, usar métodos UTC sin conversión de zona horaria
      const dateObj = new Date(date);
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const formatDateForInput = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      // Si ya viene en formato YYYY-MM-DD, usarlo directamente
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      // Si viene como fecha ISO completa, extraer solo la parte de fecha
      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      // Crear fecha en zona horaria local para evitar problemas de UTC
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    // Formato con puntos de mil (formato colombiano: 1.000.000,00)
    return '$' + value.toLocaleString('es-CO', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2,
      useGrouping: true
    });
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
      if (!target.closest('.timeline-popover') && !target.closest('.timeline-popover-btn')) {
        setTimelinePopoverOpen(null);
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
        .then(() => fetchData(true)) // Forzar refresh después de guardar cambios en batch
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
      await fetchData(true); // Forzar refresh después de actualizar
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

  const handleOpenSpecsPopover = (row: EquipmentRow) => {
    setSpecsPopoverOpen(row.id);
    
    // Detectar si viene de new_purchases
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isNewPurchase = !!(row as any).new_purchase_id;
    
    if (isNewPurchase) {
      // Popover para new_purchases
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const npValue = (row as any).np_track_width;
      const eqValue = row.track_width;
      
      // Debug: verificar valores recibidos
      console.log('🔍 Debug SPEC new_purchases - track_width:', {
        np_track_width: npValue,
        np_track_width_type: typeof npValue,
        track_width: eqValue,
        track_width_type: typeof eqValue,
        row_id: row.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new_purchase_id: (row as any).new_purchase_id,
        full_row: row
      });
      
      // Calcular track_width: priorizar np_track_width de new_purchases
      let trackWidthValue: number | null = null;
      
      // Si np_track_width existe y es válido (puede ser 0)
      if (npValue !== null && npValue !== undefined) {
        // Si es string, intentar extraer número (por si viene "600mm")
        let numValue: number;
        if (typeof npValue === 'string') {
          // Extraer solo números del string
          const numericPart = npValue.replace(/[^\d.]/g, '');
          numValue = Number(numericPart);
        } else {
          numValue = Number(npValue);
        }
        
        if (!isNaN(numValue)) {
          trackWidthValue = numValue;
        }
      }
      
      // Si no hay valor de new_purchases, usar el de equipments
      if (trackWidthValue === null && eqValue !== null && eqValue !== undefined) {
        const numValue = Number(eqValue);
        if (!isNaN(numValue)) {
          trackWidthValue = numValue;
        }
      }
      
      console.log('🔍 trackWidthValue calculado:', trackWidthValue);
      
      // Nota: Se usan 'as any' porque los datos vienen de new_purchases con campos np_* que no están en EquipmentRow
      setEditingSpecs(prev => ({
        ...prev,
        [row.id]: {
          source: 'new_purchases',
          cabin_type: (row as unknown as { np_cabin_type?: string }).np_cabin_type || row.cabin_type || '',
          wet_line: (row as unknown as { np_wet_line?: string }).np_wet_line || row.wet_line || '',
          dozer_blade: (row as unknown as { np_dozer_blade?: string }).np_dozer_blade || '',
          track_type: (row as unknown as { np_track_type?: string }).np_track_type || '',
          track_width: trackWidthValue,
          arm_type: (row as unknown as { np_arm_type?: string }).np_arm_type || row.arm_type || '',
          // PAD no aplica para new_purchases (nuevos): usar spec_pad si existe en machines/equipments
          spec_pad: (row as unknown as { spec_pad?: string }).spec_pad || null
        }
      }));
    } else {
      // Popover para otros módulos (preselección, subasta, consolidado)
      // Nota: Se usan 'as any' porque los datos vienen de diferentes módulos con estructuras diferentes
      setEditingSpecs(prev => ({
        ...prev,
        [row.id]: {
          source: 'machines',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          shoe_width_mm: (row as any).shoe_width_mm || row.track_width || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          spec_cabin: (row as any).spec_cabin || row.cabin_type || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          arm_type: (row as any).machine_arm_type || row.arm_type || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          spec_pip: (row as any).spec_pip !== undefined ? (row as any).spec_pip : (row.wet_line === 'SI'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          spec_blade: (row as any).spec_blade !== undefined ? (row as any).spec_blade : ((row as any).blade === 'SI'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          spec_pad: (row as any).spec_pad || null
        }
      }));
    }
  };

  const handleSaveSpecs = async (rowId: string) => {
    if (!isSpecEditor) return; // Solo permitir guardar cuando hay permisos de edición
    try {
      const specs = editingSpecs[rowId];
      if (!specs) return;

      const row = data.find(r => r.id === rowId);
      if (!row) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isNewPurchase = !!(row as any).new_purchase_id;

      if (isNewPurchase) {
        // Actualizar en new_purchases
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newPurchaseId = (row as any).new_purchase_id;
        await apiPut(`/api/new-purchases/${newPurchaseId}`, {
          cabin_type: specs.cabin_type || null,
          wet_line: specs.wet_line || null,
          dozer_blade: specs.dozer_blade || null,
          track_type: specs.track_type || null,
          track_width: specs.track_width || null,
          arm_type: specs.arm_type || null
        });
      } else {
        // Actualizar en machines via equipments
        await apiPut(`/api/equipments/${rowId}/machine`, {
          shoe_width_mm: specs.shoe_width_mm || null,
          spec_pip: specs.spec_pip || false,
          spec_blade: specs.spec_blade || false,
          spec_cabin: specs.spec_cabin || null,
          arm_type: specs.arm_type || null
        });
      }

      setSpecsPopoverOpen(null);
      setEditingSpecs(prev => {
        const newState = { ...prev };
        delete newState[rowId];
        return newState;
      });
      
      showSuccess('Especificaciones guardadas correctamente');
      await fetchData(true); // Forzar refresh después de actualizar
    } catch (error) {
      console.error('Error guardando especificaciones:', error);
      showError('Error al guardar especificaciones');
    }
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
  const handleSaveBatchChanges = useCallback(async () => {
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
  }, [pendingBatchChanges, setChangeModalItems, setChangeModalOpen]);

  // Protección contra pérdida de datos en modo masivo
  useBatchModeGuard({
    batchModeEnabled,
    pendingBatchChanges,
    onSave: handleSaveBatchChanges,
    moduleName: 'Equipos'
  });

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
  const loadChangeIndicators = useCallback(async (recordIds?: string[]) => {
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
  }, [data]);

  useEffect(() => {
    if (!loading && data.length > 0) {
      loadChangeIndicators();
    }
  }, [data, loading, loadChangeIndicators]);


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
    const disponibles = data.filter((row) => row.state === 'Libre');
    const reservadas = data.filter((row) => row.state === 'Reservada');
    
    const disponiblesNuevas = disponibles.filter((row) => row.condition === 'NUEVO').length;
    const disponiblesUsadas = disponibles.filter((row) => row.condition === 'USADO').length;
    const reservadasNuevas = reservadas.filter((row) => row.condition === 'NUEVO').length;
    const reservadasUsadas = reservadas.filter((row) => row.condition === 'USADO').length;
    
    const totalNuevas = data.filter((row) => row.condition === 'NUEVO').length;
    const totalUsadas = data.filter((row) => row.condition === 'USADO').length;
    
    const totalValue = data.reduce((sum, row) => {
      const value = typeof row.pvp_est === 'string' ? parseFloat(row.pvp_est) : (row.pvp_est || 0);
      return sum + value;
    }, 0);
    
    return {
      total,
      disponibles: disponibles.length,
      disponiblesNuevas,
      disponiblesUsadas,
      reservadas: reservadas.length,
      reservadasNuevas,
      reservadasUsadas,
      totalNuevas,
      totalUsadas,
      totalValue,
    };
  };

  const stats = getKPIStats();

  const parseDate = useCallback((value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const getStockBaseDate = useCallback((row: EquipmentRow) => {
    return (
      parseDate(row.nationalization_date) ||
      parseDate(row.shipment_arrival_date) ||
      parseDate(row.shipment_departure_date) ||
      parseDate(row.start_staging ?? null) ||
      parseDate(row.invoice_date) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parseDate((row as any).created_at) ||
      parseDate(row.current_movement_date)
    );
  }, [parseDate]);

  const calculateStockDays = useCallback((row: EquipmentRow) => {
    const baseDate = getStockBaseDate(row);
    if (!baseDate) return null;
    const diffMs = Date.now() - baseDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }, [getStockBaseDate]);

  const buildExportRow = useCallback((row: EquipmentRow) => {
    const stockDays = calculateStockDays(row);
    return {
      Estado: row.state || '',
      Condición: row.condition || '',
      'Tipo Máquina': formatMachineType(row.machine_type) || row.machine_type || '',
      Marca: row.brand || '',
      Modelo: row.model || '',
      Serie: row.serial || '',
      MQ: (row as unknown as { mq?: string })?.mq || '',
      'PVP Estimado': row.pvp_est ?? '',
      Ubicación: row.current_movement || '',
      'Fecha Ubicación': row.current_movement_date || '',
      ETD: row.shipment_departure_date || '',
      ETA: row.shipment_arrival_date || '',
      Nacionalización: row.nationalization_date || '',
      'Inicio Alist.': row.start_staging || '',
      'Fin Alist.': row.end_staging || '',
      Cliente: row.cliente || '',
      Asesor: row.asesor || '',
      'Fecha límite reserva': row.reservation_deadline_date || '',
      'Días en stock': stockDays ?? '',
    };
  }, [calculateStockDays]);

  const handleExportReport = useCallback(() => {
    if (!filteredData || filteredData.length === 0) {
      showError('No hay datos para exportar');
      return;
    }

    const reservas = filteredData.filter((row) => ['Reservada', 'Separada'].includes(row.state));
    const nuevas = filteredData.filter((row) => (row.condition || '').toUpperCase() === 'NUEVO');
    const usadas = filteredData.filter((row) => (row.condition || '').toUpperCase() === 'USADO');

    const stockLargo = filteredData
      .filter((row) => row.state !== 'Vendida')
      .map((row) => ({ row, stockDays: calculateStockDays(row) ?? -1 }))
      .sort((a, b) => (b.stockDays ?? -1) - (a.stockDays ?? -1))
      .map(({ row }) => row);

    const wb = XLSX.utils.book_new();

    const appendSheet = (name: string, rows: EquipmentRow[]) => {
      const sheetData = rows.map(buildExportRow);
      const ws = XLSX.utils.json_to_sheet(sheetData);
      ws['!cols'] = [
        { wch: 12 }, // Estado
        { wch: 12 }, // Condición
        { wch: 16 }, // Tipo Máquina
        { wch: 14 }, // Marca
        { wch: 18 }, // Modelo
        { wch: 16 }, // Serie
        { wch: 10 }, // MQ
        { wch: 12 }, // PVP Estimado
        { wch: 18 }, // Ubicación
        { wch: 16 }, // Fecha Ubicación
        { wch: 12 }, // ETD
        { wch: 12 }, // ETA
        { wch: 14 }, // Nacionalización
        { wch: 16 }, // Inicio Alist
        { wch: 16 }, // Fin Alist
        { wch: 18 }, // Cliente
        { wch: 16 }, // Asesor
        { wch: 18 }, // Fecha límite reserva
        { wch: 14 }, // Días en stock
      ];
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    appendSheet('Reservas', reservas);
    appendSheet('Nuevas', nuevas);
    appendSheet('Usadas', usadas);
    appendSheet('Stock_Largo', stockLargo);

    const fecha = new Date().toISOString().split('T')[0];
    const filename = `Equipos_Report_${fecha}.xlsx`;
    XLSX.writeFile(wb, filename);
    showSuccess(`Reporte generado: ${filename}`);
  }, [filteredData, buildExportRow, calculateStockDays]);

  // Función para detectar si hay filtros activos
  const hasActiveFilters = () => {
    return !!(
      searchTerm ||
      brandFilter ||
      modelFilter ||
      serialFilter ||
      yearFilter ||
      hoursFilter ||
      conditionFilter ||
      etdFilter ||
      etaFilter ||
      nationalizationFilter ||
      mcFilter ||
      locationFilter ||
      locationDateFilter ||
      stateFilter ||
      pvpFilter ||
      startStagingFilter ||
      endStagingFilter ||
      reservationFocus.equipmentId ||
      reservationFocus.serial ||
      reservationFocus.model ||
      notificationFocusActive
    );
  };

  // Función para limpiar todos los filtros
  const clearAllFilters = () => {
    setSearchTerm('');
    setBrandFilter('');
    setModelFilter('');
    setSerialFilter('');
    setYearFilter('');
    setHoursFilter('');
    setConditionFilter('');
    setEtdFilter('');
    setEtaFilter('');
    setNationalizationFilter('');
    setMcFilter('');
    setLocationFilter('');
    setLocationDateFilter('');
    setStateFilter('');
    setClienteFilter('');
    setAsesorFilter('');
    setPvpFilter('');
    setStartStagingFilter('');
    setEndStagingFilter('');
    if (reservationFocus.equipmentId || reservationFocus.serial || reservationFocus.model) {
      setReservationFocus({ equipmentId: null, serial: null, model: null });
    }
    setNotificationFocusActive(false);
    setFocusPurchaseId(null);
    navigate('/equipments', { replace: true }); // limpiar query params (purchaseId, etc.)
  };

  // Obtener etiquetas de filtros activos
  const getActiveFilterLabels = (): string[] => {
    const labels: string[] = [];
    if (stateFilter) labels.push(`Estado: ${stateFilter}`);
    if (conditionFilter) labels.push(`Condición: ${conditionFilter}`);
    if (clienteFilter) labels.push(`Cliente: ${clienteFilter}`);
    if (asesorFilter) labels.push(`Asesor: ${asesorFilter}`);
    if (brandFilter) labels.push(`Marca: ${brandFilter}`);
    if (modelFilter) labels.push(`Modelo: ${modelFilter}`);
    if (serialFilter) labels.push(`Serie: ${serialFilter}`);
    if (yearFilter) labels.push(`Año: ${yearFilter}`);
    if (hoursFilter) labels.push(`Horas: ${hoursFilter}`);
    if (etdFilter) labels.push(`ETD: ${etdFilter}`);
    if (etaFilter) labels.push(`ETA: ${etaFilter}`);
    if (nationalizationFilter) labels.push(`Nacionalización: ${nationalizationFilter}`);
    if (mcFilter) labels.push(`MC: ${mcFilter}`);
    if (locationFilter) labels.push(`Ubicación: ${locationFilter}`);
    if (locationDateFilter) labels.push(`Fecha Ubicación: ${locationDateFilter}`);
    if (pvpFilter) labels.push(`PVP: ${pvpFilter}`);
    if (startStagingFilter) labels.push(`Inicio Alist.: ${startStagingFilter}`);
    if (endStagingFilter) labels.push(`Fin Alist.: ${endStagingFilter}`);
    if (searchTerm) labels.push(`Búsqueda: "${searchTerm}"`);
    if (reservationFocus.equipmentId || reservationFocus.serial || reservationFocus.model) {
      const pieces = [];
      if (reservationFocus.serial) pieces.push(`Serie: ${reservationFocus.serial}`);
      if (reservationFocus.model) pieces.push(`Modelo: ${reservationFocus.model}`);
      labels.push(`Solicitud de reserva ${pieces.join(' - ')}`.trim());
    }
    return labels;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="rounded-xl shadow-md p-3" style={{ backgroundColor: '#cf1b22' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
                <h1 className="text-lg font-semibold text-white">Equipos General</h1>
            </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
          >
          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-red">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Total Equipos</p>
                <p className="text-2xl font-bold text-brand-red">{stats.total}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Package className="w-6 h-6 text-brand-red" />
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500 cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => {
              setStateFilter('Libre');
              setConditionFilter('');
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-gray">Libre</p>
                <p className="text-2xl font-bold text-green-600">{stats.disponibles}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  <span className="text-blue-600 font-medium">Nuevas: {stats.disponiblesNuevas}</span>
                  <span className="text-orange-600 font-medium">Usadas: {stats.disponiblesUsadas}</span>
              </div>
              </div>
              <div 
                className="p-3 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterModalType('disponibles');
                  setFilterModalCondition('all');
                  setFilterModalOpen(true);
                }}
              >
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-yellow-500 cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => {
              setStateFilter('Reservada');
              setConditionFilter('');
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-gray">Reservadas</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.reservadas}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  <span className="text-blue-600 font-medium">Nuevas: {stats.reservadasNuevas}</span>
                  <span className="text-orange-600 font-medium">Usadas: {stats.reservadasUsadas}</span>
              </div>
              </div>
              <div 
                className="p-3 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterModalType('reservadas');
                  setFilterModalCondition('all');
                  setFilterModalOpen(true);
                }}
              >
                <Package className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-gray">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-gray">Valor Total</p>
                <p className="text-2xl font-bold text-brand-gray break-words">
                  ${stats.totalValue?.toLocaleString('es-CO') || '0'}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg flex-shrink-0 ml-3">
                <Package className="w-6 h-6 text-brand-gray" />
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500 cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => {
              setConditionFilter('NUEVO');
              setStateFilter('');
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-gray">Solo Nuevas</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalNuevas}</p>
              </div>
              <div 
                className="p-3 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterModalType('nuevas');
                  setFilterModalCondition('NUEVO');
                  setFilterModalOpen(true);
                }}
              >
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-orange-500 cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => {
              setConditionFilter('USADO');
              setStateFilter('');
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-gray">Solo Usadas</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totalUsadas}</p>
              </div>
              <div 
                className="p-3 bg-orange-100 rounded-lg hover:bg-orange-200 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterModalType('usadas');
                  setFilterModalCondition('USADO');
                  setFilterModalOpen(true);
                }}
              >
                <Package className="w-6 h-6 text-orange-600" />
              </div>
            </div>
        </div>
        </motion.div>

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
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-gray-600" />
              Exportar Excel
            </button>
            {/* Toggle Modo Masivo */}
            <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap">
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

        {/* Indicador de Filtros Activos */}
        {hasActiveFilters() && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-brand-red rounded-lg shadow-sm px-3 py-2 mb-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-brand-red flex-shrink-0" />
                <span className="text-xs font-semibold text-brand-red">Filtros:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {getActiveFilterLabels().slice(0, 4).map((label, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 bg-white border border-brand-red/30 rounded text-[10px] text-brand-red font-medium"
                    >
                      {label}
                    </span>
                  ))}
                  {getActiveFilterLabels().length > 4 && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-white border border-brand-red/30 rounded text-[10px] text-brand-red font-medium">
                      +{getActiveFilterLabels().length - 4}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-2 py-1 bg-brand-red text-white rounded text-[10px] font-medium hover:bg-red-700 transition-colors whitespace-nowrap flex-shrink-0"
              >
                <XCircle className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Barra de Scroll Superior - Sincronizada */}
        <div className="mb-3">
          <div 
            ref={topScrollRef}
            className="overflow-x-auto bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
            style={{ height: '14px' }}
          >
            <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div 
            ref={tableScrollRef} 
            className="overflow-x-auto overflow-y-scroll" 
            style={{ 
              height: 'calc(100vh - 300px)',
              minHeight: '500px',
              maxHeight: 'calc(100vh - 300px)'
            }}
          >
            <table ref={tableRef} className="min-w-full divide-y divide-gray-200">
              <thead className="sticky top-0 z-20">
                <tr className="bg-red-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>TIPO MÁQUINA</span>
                      <select
                        value={machineTypeFilter}
                        onChange={(e) => setMachineTypeFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueMachineTypes.map(type => (
                          <option key={type || ''} value={type || ''}>{formatMachineType(type) || type}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>MARCA</span>
                      <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todas</option>
                        {uniqueBrands.map(brand => (
                          <option key={brand || ''} value={brand || ''}>{brand}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>MODELO</span>
                      <select
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueModels.map(model => (
                          <option key={model || ''} value={model || ''}>{model}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>SERIE</span>
                      <select
                        value={serialFilter}
                        onChange={(e) => setSerialFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todas</option>
                        {uniqueSerials.map(serial => (
                          <option key={serial || ''} value={serial || ''}>{serial}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>AÑO</span>
                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueYears.map(year => (
                          <option key={String(year)} value={String(year)}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>HORAS</span>
                      <select
                        value={hoursFilter}
                        onChange={(e) => setHoursFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todas</option>
                        {uniqueHours.map(hours => (
                          <option key={String(hours)} value={String(hours)}>{hours}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>CONDICIÓN</span>
                      <select
                        value={conditionFilter}
                        onChange={(e) => setConditionFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todas</option>
                        {uniqueConditions.map(condition => (
                          <option key={condition || ''} value={condition || ''}>{condition}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-800 uppercase bg-red-100">SPEC</th>
                  {!isCommercial() && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>CLIENTE</span>
                      <select
                        value={clienteFilter}
                        onChange={(e) => setClienteFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueClientes.map((cliente) => (
                          <option key={cliente || ''} value={cliente || ''}>{cliente}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>ESTADO</span>
                      <select
                        value={stateFilter}
                        onChange={(e) => setStateFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueStates.map(state => (
                          <option key={state || ''} value={state || ''}>{state}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  {!isCommercial() && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">
                    <div className="flex flex-col gap-1">
                      <span>ASESOR</span>
                      <select
                        value={asesorFilter}
                        onChange={(e) => setAsesorFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueAsesores.map((asesor) => (
                          <option key={asesor || ''} value={asesor || ''}>{asesor}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-red-100">FECHA LIMITE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
                    <div className="flex flex-col gap-1">
                      <span>ETD</span>
                      <select
                        value={etdFilter}
                        onChange={(e) => setEtdFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        <option value="CON_ETD">Con ETD</option>
                        <option value="SIN_ETD">Sin ETD</option>
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
                    <div className="flex flex-col gap-1">
                      <span>ETA</span>
                      <select
                        value={etaFilter}
                        onChange={(e) => setEtaFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        <option value="CON_ETA">Con ETA</option>
                        <option value="SIN_ETA">Sin ETA</option>
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
                    <div className="flex flex-col gap-1">
                      <span>FECHA NACIONALIZACIÓN</span>
                      <select
                        value={nationalizationFilter}
                        onChange={(e) => setNationalizationFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        <option value="CON_FECHA">Con fecha</option>
                        <option value="SIN_FECHA">Sin fecha</option>
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">
                    <div className="flex flex-col gap-1">
                      <span>MC</span>
                      <select
                        value={mcFilter}
                        onChange={(e) => setMcFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueMCs.map(mc => (
                          <option key={mc || ''} value={mc || ''}>{mc}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">
                    <div className="flex flex-col gap-1">
                      <span>UBICACIÓN</span>
                      <select
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todas</option>
                        {uniqueLocations.map(location => (
                          <option key={location || ''} value={location || ''}>{location}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">
                    <div className="flex flex-col gap-1">
                      <span>FECHA UBICACIÓN</span>
                      <select
                        value={locationDateFilter}
                        onChange={(e) => setLocationDateFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        <option value="CON_FECHA">Con fecha</option>
                        <option value="SIN_FECHA">Sin fecha</option>
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-teal-100">OBS. COMERCIALES</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-teal-100">
                    <div className="flex flex-col gap-1">
                      <span>PVP</span>
                      <select
                        value={pvpFilter}
                        onChange={(e) => setPvpFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        <option value="CON_PVP">Con PVP</option>
                        <option value="SIN_PVP">Sin PVP</option>
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">
                    <div className="flex flex-col gap-1">
                      <span>INICIO ALIST.</span>
                      <select
                        value={startStagingFilter}
                        onChange={(e) => setStartStagingFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        <option value="CON_FECHA">Con fecha</option>
                        <option value="SIN_FECHA">Sin fecha</option>
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">
                    <div className="flex flex-col gap-1">
                      <span>FES</span>
                      <select
                        value={endStagingFilter}
                        onChange={(e) => setEndStagingFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        <option value="CON_FECHA">Con fecha</option>
                        <option value="SIN_FECHA">Sin fecha</option>
                      </select>
                    </div>
                  </th>
                  <th
                    className="px-2 py-3 text-center text-xs font-semibold text-gray-800 uppercase sticky top-0 right-0 bg-red-100 z-40 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]"
                    style={{ minWidth: 140 }}
                  >
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={20} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="px-4 py-8 text-center text-gray-500">
                      No hay equipos registrados
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => {
                    const hasPendingReservation = isJefeComercial() &&
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      equipmentReservations[row.id]?.some((r: any) => r.status === 'PENDING');
                    const hasAnsweredReservation = isCommercial() &&
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      equipmentReservations[row.id]?.some((r: any) => r.status === 'APPROVED' || r.status === 'REJECTED');
                    const isReserved = row.state === 'Reservada';
                    const isSeparada = row.state === 'Separada';
                    const isAvailableForReservation = row.state === 'Libre';
                    const hasETD = !!(row.shipment_departure_date && row.shipment_departure_date !== '-');
                    
                    // Color de fondo según las reglas:
                    // - Reservados: amarillo
                    // - Con ETD: blanco
                    // - Sin ETD: gris
                    let rowBgColor = 'bg-white hover:bg-gray-50';
                    if (isReserved || hasPendingReservation || hasAnsweredReservation) {
                      rowBgColor = 'bg-yellow-50 hover:bg-yellow-100';
                    } else if (!hasETD) {
                      rowBgColor = 'bg-gray-100 hover:bg-gray-150';
                    }
                    
                    return (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                        className={`${rowBgColor} transition-colors`}
                      >
                      {/* TIPO MÁQUINA */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span className="text-gray-800">{formatMachineType(row.machine_type) || row.machine_type || '-'}</span>
                      </td>
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
                      
                        {/* SPEC */}
                        <td className="px-4 py-3 text-sm text-gray-700 relative">
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                handleOpenSpecsPopover(row);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              <Settings className="w-3.5 h-3.5" />
              Ver
                            </button>
                            {specsPopoverOpen === row.id && editingSpecs[row.id] && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => {
                                    setSpecsPopoverOpen(null);
                                    setEditingSpecs(prev => {
                                      const newState = { ...prev };
                                      delete newState[row.id];
                                      return newState;
                                    });
                                  }}
                                  style={{ 
                                    pointerEvents: 'auto',
                                    backgroundColor: 'transparent'
                                  }}
                                />
                                <div 
                                  className="absolute left-1/2 transform -translate-x-1/2 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200"
                                  style={{ 
                                    top: '100%',
                                    marginTop: '4px',
                                    pointerEvents: 'auto'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 px-4 py-2.5 rounded-t-lg">
                                    <h4 className="text-sm font-semibold text-white">
                                      Especificaciones Técnicas{!isSpecEditor && ' (Solo Lectura)'}
                                    </h4>
                                  </div>
                                  <div className="p-4 space-y-3">
                                    {editingSpecs[row.id].source === 'new_purchases' ? (
                                      <>
                                        {/* Popover para NEW_PURCHASES - Layout 2 columnas */}
                                        {/* Fila 1: Ancho (mm) | Cab (Cabina) */}
                                        <div className="grid grid-cols-2 gap-3">
                                          {/* Ancho (mm) */}
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Ancho (mm)
                                            </label>
                                            {isSpecEditor ? (
                                              <input
                                                type="number"
                                                value={editingSpecs[row.id].track_width !== null && editingSpecs[row.id].track_width !== undefined 
                                                  ? String(editingSpecs[row.id].track_width)
                                                  : ''}
                                                onChange={(e) => setEditingSpecs(prev => ({
                                                  ...prev,
                                                  [row.id]: { ...prev[row.id], track_width: e.target.value ? Number(e.target.value) : null }
                                                }))}
                                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                                placeholder="Ej: 600"
                                              />
                                            ) : (
                                              <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                                {editingSpecs[row.id].track_width !== null && editingSpecs[row.id].track_width !== undefined 
                                                  ? String(editingSpecs[row.id].track_width)
                                                  : '-'}
                                              </div>
                                            )}
                                          </div>

                                        {/* Cab (Cabina) */}
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Cab (Cabina)
                                          </label>
                                          {isSpecEditor ? (
                                            <select
                                              value={editingSpecs[row.id].cabin_type || ''}
                                              onChange={(e) => setEditingSpecs(prev => ({
                                                ...prev,
                                                [row.id]: { ...prev[row.id], cabin_type: e.target.value }
                                              }))}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                            >
                                              <option value="">Seleccionar...</option>
                                              <option value="CABINA CERRADA">Cabina Cerrada</option>
                                              <option value="CABINA CERRADA/AC">Cabina Cerrada / AC</option>
                                              <option value="CANOPY">Canopy</option>
                                              <option value="N/A">N/A</option>
                                            </select>
                                          ) : (
                                            <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                              {editingSpecs[row.id].cabin_type || '-'}
                                            </div>
                                          )}
                                          </div>
                                        </div>

                                        {/* Fila 2: Hoja | Brazo */}
                                        <div className="grid grid-cols-2 gap-3">
                                          {/* Hoja (Dozer Blade) */}
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Hoja (Dozer Blade)
                                          </label>
                                          {isSpecEditor ? (
                                            <select
                                                value={editingSpecs[row.id].dozer_blade || ''}
                                              onChange={(e) => setEditingSpecs(prev => ({
                                                ...prev,
                                                  [row.id]: { ...prev[row.id], dozer_blade: e.target.value }
                                              }))}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                            >
                                              <option value="">Seleccionar...</option>
                                              <option value="SI">SI</option>
                                              <option value="NO">NO</option>
                                            </select>
                                          ) : (
                                            <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                                {editingSpecs[row.id].dozer_blade || '-'}
                                            </div>
                                          )}
                                        </div>

                                          {/* Brazo */}
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Brazo
                                            </label>
                                            {isSpecEditor ? (
                                              <select
                                                value={editingSpecs[row.id].arm_type || ''}
                                                onChange={(e) => setEditingSpecs(prev => ({
                                                  ...prev,
                                                  [row.id]: { ...prev[row.id], arm_type: e.target.value }
                                                }))}
                                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                              >
                                                <option value="">Seleccionar...</option>
                                                <option value="ESTANDAR">ESTANDAR</option>
                                                <option value="LONG ARM">LONG ARM</option>
                                                <option value="N/A">N/A</option>
                                              </select>
                                            ) : (
                                              <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                                {editingSpecs[row.id].arm_type || '-'}
                                            </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Fila 3: L.H (Línea Húmeda) | Zap */}
                                        <div className="grid grid-cols-2 gap-3">
                                          {/* L.H (Línea Húmeda) */}
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                              L.H (Línea Húmeda)
                                          </label>
                                          {isSpecEditor ? (
                                            <select
                                                value={editingSpecs[row.id].wet_line || ''}
                                              onChange={(e) => setEditingSpecs(prev => ({
                                                ...prev,
                                                  [row.id]: { ...prev[row.id], wet_line: e.target.value }
                                              }))}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                            >
                                              <option value="">Seleccionar...</option>
                                              <option value="SI">SI</option>
                                              <option value="NO">NO</option>
                                            </select>
                                          ) : (
                                            <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                                {editingSpecs[row.id].wet_line || '-'}
                                            </div>
                                          )}
                                        </div>

                                        {/* Zap (Tipo de Zapata) */}
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Zap (Tipo de Zapata)
                                          </label>
                                          {isSpecEditor ? (
                                            <input
                                              type="text"
                                              value={editingSpecs[row.id].track_type || ''}
                                              onChange={(e) => setEditingSpecs(prev => ({
                                                ...prev,
                                                [row.id]: { ...prev[row.id], track_type: e.target.value }
                                              }))}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                              placeholder="Ej: STEEL TRACK"
                                            />
                                          ) : (
                                            <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                              {editingSpecs[row.id].track_type || '-'}
                                            </div>
                                          )}
                                          </div>
                                        </div>

                                        {/* Fila 4: PAD */}
                                        <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              PAD
                                          </label>
                                            <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                              {((row.condition || '').toUpperCase() === 'USADO')
                                                ? (editingSpecs[row.id].spec_pad || '-')
                                                : 'N/A'}
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        {/* Popover para OTROS MÓDULOS - Layout 2 columnas */}
                                        {/* Fila 1: Ancho Zapatas | Tipo de Cabina */}
                                        <div className="grid grid-cols-2 gap-3">
                                        {/* Ancho Zapatas */}
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Ancho Zapatas (mm)
                                          </label>
                                          {isSpecEditor ? (
                                            <input
                                              type="number"
                                              value={editingSpecs[row.id].shoe_width_mm || ''}
                                              onChange={(e) => setEditingSpecs(prev => ({
                                                ...prev,
                                                [row.id]: { ...prev[row.id], shoe_width_mm: e.target.value ? Number(e.target.value) : null }
                                              }))}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                              placeholder="Ej: 600"
                                            />
                                          ) : (
                                            <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                              {editingSpecs[row.id].shoe_width_mm || '-'}
                                            </div>
                                          )}
                                        </div>

                                          {/* Tipo de Cabina */}
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Tipo de Cabina
                                          </label>
                                          {isSpecEditor ? (
                                            <select
                                              value={editingSpecs[row.id].spec_cabin || ''}
                                              onChange={(e) => setEditingSpecs(prev => ({
                                                ...prev,
                                                [row.id]: { ...prev[row.id], spec_cabin: e.target.value }
                                              }))}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                            >
                                              <option value="">Seleccionar...</option>
                                      <option value="CABINA CERRADA">Cabina Cerrada</option>
                                      <option value="CABINA CERRADA/AC">Cabina Cerrada / AC</option>
                                              <option value="CANOPY">Canopy</option>
                                              <option value="N/A">N/A</option>
                                            </select>
                                          ) : (
                                            <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                              {editingSpecs[row.id].spec_cabin || '-'}
                                            </div>
                                          )}
                                        </div>
                                        </div>

                                        {/* Fila 2: Blade | Tipo de Brazo */}
                                        <div className="grid grid-cols-2 gap-3">
                                          {/* Blade */}
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Blade (Hoja Topadora)
                                            </label>
                                          {isSpecEditor ? (
                                              <select
                                                value={editingSpecs[row.id].spec_blade ? 'SI' : 'No'}
                                                onChange={(e) => setEditingSpecs(prev => ({
                                                  ...prev,
                                                  [row.id]: { ...prev[row.id], spec_blade: e.target.value === 'SI' }
                                                }))}
                                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                              >
                                                <option value="SI">SI</option>
                                                <option value="No">No</option>
                                              </select>
                                            ) : (
                                              <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                                {editingSpecs[row.id].spec_blade ? 'SI' : 'NO'}
                                              </div>
                                            )}
                                          </div>

                                        {/* Tipo de Brazo */}
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Tipo de Brazo
                                          </label>
                                          {isSpecEditor ? (
                                            <select
                                              value={editingSpecs[row.id].arm_type || ''}
                                              onChange={(e) => setEditingSpecs(prev => ({
                                                ...prev,
                                                [row.id]: { ...prev[row.id], arm_type: e.target.value }
                                              }))}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                            >
                                              <option value="">Seleccionar...</option>
                                              <option value="ESTANDAR">ESTANDAR</option>
                                              <option value="LONG ARM">LONG ARM</option>
                                              <option value="N/A">N/A</option>
                                            </select>
                                          ) : (
                                            <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                              {editingSpecs[row.id].arm_type || '-'}
                                            </div>
                                          )}
                                          </div>
                                        </div>

                                        {/* Fila 3: PIP | PAD */}
                                        <div className="grid grid-cols-2 gap-3">
                                        {/* PIP */}
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            PIP (Accesorios)
                                          </label>
                                          {isSpecEditor ? (
                                            <select
                                              value={editingSpecs[row.id].spec_pip ? 'SI' : 'No'}
                                              onChange={(e) => setEditingSpecs(prev => ({
                                                ...prev,
                                                [row.id]: { ...prev[row.id], spec_pip: e.target.value === 'SI' }
                                              }))}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                            >
                                              <option value="SI">SI</option>
                                              <option value="No">No</option>
                                            </select>
                                          ) : (
                                            <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                              {editingSpecs[row.id].spec_pip ? 'SI' : 'NO'}
                                            </div>
                                          )}
                                        </div>

                                    {/* PAD */}
                                        <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                              PAD
                                          </label>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                        {((row.condition || '').toUpperCase() === 'USADO')
                                          ? (editingSpecs[row.id].spec_pad || '-')
                                          : 'N/A'}
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    {/* Botones */}
                                    <div className="flex gap-2 pt-2">
                                      {!isSpecEditor && (
                                        <button
                                          onClick={() => {
                                            setSpecsPopoverOpen(null);
                                            setEditingSpecs(prev => {
                                              const newState = { ...prev };
                                              delete newState[row.id];
                                              return newState;
                                            });
                                          }}
                                          className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                        >
                                          Cerrar
                                        </button>
                                      )}
                                      {isSpecEditor && (
                                        <>
                                        <button
                                          onClick={() => handleSaveSpecs(row.id)}
                                          className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[#cf1b22] hover:bg-[#a01419] rounded-md transition-colors"
                                        >
                                          Guardar
                                        </button>
                                      <button
                                        onClick={() => {
                                          setSpecsPopoverOpen(null);
                                          setEditingSpecs(prev => {
                                            const newState = { ...prev };
                                            delete newState[row.id];
                                            return newState;
                                          });
                                        }}
                                            className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                      >
                                            Cancelar
                                      </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                      </td>
                      
                        {/* CLIENTE */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-800">{row.cliente || '-'}</span>
                        </td>
                      
                        {/* ESTADO */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'state')}>
                            {isCommercial() ? (
                              <span className="text-gray-700">{row.state || '-'}</span>
                            ) : (
                            <InlineFieldEditor
                              type="select"
                              value={row.state || ''}
                              placeholder="Estado"
                              options={STATES.map(s => ({ value: s, label: s }))}
                              displayFormatter={(val) => {
                                if (!val || val === '') return '-';
                                return <span className="text-gray-700">{String(val)}</span>;
                              }}
                              onSave={async (val) => {
                                const updates: Record<string, unknown> = { state: val };
                                const wasReservedOrSeparated = row.state === 'Reservada' || row.state === 'Separada';
                                const isFreeNow = val === 'Libre';
                                
                                // Si cambia de "Libre" a "Reservada", calcular fecha límite (20 días)
                                if (row.state === 'Libre' && val === 'Reservada') {
                                  const deadlineDate = new Date();
                                  deadlineDate.setDate(deadlineDate.getDate() + 20);
                                  updates.reservation_deadline_date = deadlineDate.toISOString().split('T')[0];
                                } else if (isJefeComercial() && wasReservedOrSeparated && isFreeNow) {
                                  // Solo jefe comercial: al liberar, quitar fecha límite de reserva
                                  updates.reservation_deadline_date = null;
                                } else if (val !== 'Reservada') {
                                  // Otros cambios: limpiar fecha límite
                                  updates.reservation_deadline_date = null;
                                }
                                
                                return requestFieldUpdate(row, 'state', 'Estado', val, updates);
                              }}
                            />
                            )}
                          </InlineCell>
                      </td>
                      
                        {/* ASESOR */}
                        {!isCommercial() && (
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-800">{row.asesor || '-'}</span>
                        </td>
                        )}

                        {/* FECHA LIMITE */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id, 'reservation_deadline_date')}>
                            {isJefeComercial() ? (
                              <InlineFieldEditor
                                type="date"
                                value={formatDateForInput(row.reservation_deadline_date || null)}
                                placeholder="Fecha límite"
                                onSave={(val) =>
                                  requestFieldUpdate(
                                    row,
                                    'reservation_deadline_date',
                                    'Fecha límite',
                                    typeof val === 'string' && val ? val : null,
                                    {
                                      reservation_deadline_date: typeof val === 'string' && val ? val : null,
                                    }
                                  )
                                }
                                displayFormatter={(val) =>
                                  val ? formatDate(String(val)) : '-'
                                }
                              />
                            ) : (
                              <span className="text-gray-700">{formatDate(row.reservation_deadline_date || null)}</span>
                            )}
                          </InlineCell>
                      </td>
                      
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
                          <div className="flex items-center gap-2">
                          <InlineCell {...buildCellProps(row.id, 'current_movement_date')}>
                            <span className="text-gray-700">{formatDate(row.current_movement_date)}</span>
                          </InlineCell>
                            <button
                              onClick={(e) => handleTimelineClick(e, row)}
                              className="timeline-popover-btn p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors relative"
                              title="Ver línea de tiempo de movimientos"
                            >
                              <Clock className="w-4 h-4" />
                              {timelinePopoverOpen === row.purchase_id && movementsData[row.purchase_id] && (
                                <div className="timeline-popover absolute z-50 mt-2 right-0 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-left" style={{ top: '100%' }} onClick={(e) => e.stopPropagation()}>
                                  <p className="text-xs font-semibold text-gray-500 mb-3">Línea de Tiempo de Movimientos</p>
                                  <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {movementsData[row.purchase_id].length === 0 ? (
                                      <p className="text-sm text-gray-400 text-center py-4">No hay movimientos registrados</p>
                                    ) : (
                                      movementsData[row.purchase_id].map((movement, index) => (
                                        <div key={movement.id} className="relative flex items-start gap-3">
                                          <div className="relative z-10">
                                            <div className="w-6 h-6 bg-brand-red rounded-full flex items-center justify-center text-white font-bold text-xs">
                                              {index + 1}
                                            </div>
                                          </div>
                                          <div className="flex-1 bg-gray-50 rounded-lg p-3">
                                            <div className="flex justify-between items-start mb-1">
                                              <h4 className="font-semibold text-gray-900 text-sm">{movement.movement_description}</h4>
                                              <span className="text-xs text-gray-500">{formatDate(movement.movement_date)}</span>
                                            </div>
                                            {movement.movement_description?.includes('SALIÓ') && (movement.driver_name || movement.movement_plate) && (
                                              <div className="mt-2 space-y-1">
                                                {movement.driver_name && (
                                                  <p className="text-xs text-gray-600">
                                                    <span className="font-semibold">Conductor:</span> {movement.driver_name}
                                                  </p>
                                                )}
                                                {movement.movement_plate && (
                                                  <p className="text-xs text-gray-600">
                                                    <span className="font-semibold">Vehículo:</span> {movement.movement_plate}
                                                  </p>
                                                )}
                                              </div>
                                            )}
                                            <p className="text-xs text-gray-500 mt-2">
                                              Registrado: {new Date(movement.created_at).toLocaleDateString('es-CO', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                            </p>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </button>
                          </div>
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
                              disabled={!isJefeComercial()}
                              displayFormatter={() => row.pvp_est !== null && row.pvp_est !== undefined
                                ? `$ ${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(row.pvp_est))}`
                                : '-'
                              }
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
                        
                      
                      <td className="px-2 py-3 sticky right-0 bg-white z-30" style={{ minWidth: 140 }}>
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
                          {/* Botón de eliminar solo para admin */}
                          {isAdmin() && (
                            <button
                              onClick={() => handleDeleteEquipment(row)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar equipo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                            {/* Botón de reservar para comerciales */}
                            {isCommercial() && (
                              <button
                              onClick={() => handleReserveEquipment(row)}
                              disabled={!isAvailableForReservation || isReserved || isSeparada}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  !isAvailableForReservation || isReserved || isSeparada
                                    ? 'text-gray-400 cursor-not-allowed'
                                    :
                                    equipmentReservations[row.id]?.some((r) => r.status === 'APPROVED' || r.status === 'REJECTED')
                                      ? 'text-yellow-600 hover:bg-yellow-50'
                                      : 'text-[#cf1b22] hover:bg-red-50'
                                }`}
                                title={
                                  !isAvailableForReservation || isReserved || isSeparada
                                    ? `Equipo no disponible. Estado: ${row.state}. Solo se pueden crear reservas cuando el equipo está "Libre".`
                                    :
                                    equipmentReservations[row.id]?.some((r) => r.status === 'APPROVED' || r.status === 'REJECTED')
                                      ? 'Ver respuesta de reserva'
                                      : 'Solicitar reserva'
                                }
                              >
                                <Package className="w-4 h-4" />
                              </button>
                            )}
                            {/* Botón de ver reserva para jefe comercial - Mostrar todas las reservas (PENDING, APPROVED, REJECTED) */}
                            {isJefeComercial() && 
                              equipmentReservations[row.id] && equipmentReservations[row.id].length > 0 && (
                              equipmentReservations[row.id]
                                .map((reservation: EquipmentReservation) => (
                                  <button
                                    key={reservation.id}
                                    onClick={() => {
                                      setSelectedReservation({ ...reservation, equipment_id: row.id });
                                      setViewReservationModalOpen(true);
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      reservation.status === 'PENDING'
                                        ? 'text-[#cf1b22] hover:bg-red-50'
                                        : reservation.status === 'APPROVED'
                                        ? 'text-green-600 hover:bg-green-50'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                    title={`Ver solicitud de reserva (${reservation.status === 'PENDING' ? 'PENDIENTE' : reservation.status === 'APPROVED' ? 'APROBADA' : 'RECHAZADA'})`}
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
            {/* Espacio adicional al final para permitir scroll completo y ver popovers inferiores */}
            <div style={{ height: '300px', minHeight: '300px', width: '100%' }}></div>
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
                  <p className="text-xs text-gray-500 mb-1">ETD</p>
                  {formatDate(viewEquipment.shipment_departure_date) !== '-' ? (
                    <span className="text-sm text-gray-900">
                      {formatDate(viewEquipment.shipment_departure_date)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">ETA</p>
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
                  <p className="text-xs text-gray-500 mb-1">FECHA NACIONALIZACIÓN</p>
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
                      {`$ ${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(viewEquipment.pvp_est))}`}
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
                  <button
                    onClick={() => setFilesSectionExpanded(!filesSectionExpanded)}
                    className="w-full flex items-center justify-between gap-2 mb-2 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                    <div className="bg-[#cf1b22] p-2 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                      <div className="text-left">
                      <h3 className="text-sm font-semibold text-gray-900">Material Comercial</h3>
                      <p className="text-xs text-gray-600">Fotos y documentos para clientes</p>
                    </div>
                  </div>
                    {filesSectionExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                  
                  {filesSectionExpanded && (
                  <MachineFiles 
                    machineId={viewEquipment.machine_id}
                    allowUpload={false}
                    allowDelete={false}
                    currentScope="EQUIPOS"
                    hideOtherModules={isCommercial() || isJefeComercial()}
                  />
                  )}
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
            cliente: selectedEquipmentForReservation.cliente || null,
            asesor: selectedEquipmentForReservation.asesor || null,
          }}
          existingReservation={(() => {
            const res = equipmentReservations[selectedEquipmentForReservation.id]?.[0];
            if (!res) return undefined;
            const normalizeBool = (value: boolean | null | undefined) =>
              value === null || value === undefined ? undefined : Boolean(value);
            return {
              ...res,
              comments: res.comments ?? null,
              documents: res.documents ?? [],
              consignacion_10_millones: normalizeBool(res.consignacion_10_millones),
              porcentaje_10_valor_maquina: normalizeBool(res.porcentaje_10_valor_maquina),
              firma_documentos: normalizeBool(res.firma_documentos),
            };
          })()}
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
            {/* Timeline de Separaciones y Reservas - Solo para jefecomercial */}
            {isJefeComercial() && selectedReservation.equipment_id && (
              <ReservationTimeline equipmentId={selectedReservation.equipment_id} />
            )}

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
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Documentos Adjuntos</h3>
                {selectedReservation.documents && Array.isArray(selectedReservation.documents) && selectedReservation.documents.length > 0 && (
                  <span className="text-xs text-gray-600">
                    {selectedReservation.documents.length} documento{selectedReservation.documents.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="p-3">
                {selectedReservation.documents && Array.isArray(selectedReservation.documents) && selectedReservation.documents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedReservation.documents.map((doc, index: number) => (
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

            {/* Checklist para jefecomercial */}
            {isJefeComercial() && selectedReservation.status === 'PENDING' && (
              <div className="border border-yellow-200 rounded-lg overflow-hidden bg-yellow-50">
                <div className="bg-yellow-100 px-3 py-2 border-b border-yellow-200">
                  <h3 className="text-xs font-semibold text-yellow-900 uppercase tracking-wide">Checklist de Aprobación</h3>
                </div>
                <div className="p-3 space-y-3">
                  {(() => {
                    const daysSinceCreation = selectedReservation.created_at 
                      ? Math.floor((new Date().getTime() - new Date(selectedReservation.created_at).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    const hasExceeded10Days = daysSinceCreation > 10;
                    const allChecked = selectedReservation.consignacion_10_millones && 
                                      selectedReservation.porcentaje_10_valor_maquina && 
                                      selectedReservation.firma_documentos;
                    
                    return (
                      <>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedReservation.consignacion_10_millones || false}
                            onChange={async (e) => {
                              try {
                                await apiPut(`/api/equipments/reservations/${selectedReservation.id}/update-checklist`, {
                                  consignacion_10_millones: e.target.checked
                                });
                                // Actualizar estado local
                                setSelectedReservation({
                                  ...selectedReservation,
                                  consignacion_10_millones: e.target.checked
                                });
                                if (selectedReservation.equipment_id) {
                                  await loadReservations(selectedReservation.equipment_id);
                                }
                                await fetchData(true);
                              } catch {
                                showError('Error al actualizar checklist');
                              }
                            }}
                            className="w-5 h-5 text-[#cf1b22] border-gray-300 rounded focus:ring-[#cf1b22]"
                            disabled={hasExceeded10Days}
                          />
                          <span className={`text-sm ${hasExceeded10Days ? 'text-gray-400' : 'text-gray-700'}`}>
                            Consignación de 10 millones
                          </span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedReservation.porcentaje_10_valor_maquina || false}
                            onChange={async (e) => {
                              try {
                                await apiPut(`/api/equipments/reservations/${selectedReservation.id}/update-checklist`, {
                                  porcentaje_10_valor_maquina: e.target.checked
                                });
                                setSelectedReservation({
                                  ...selectedReservation,
                                  porcentaje_10_valor_maquina: e.target.checked
                                });
                                if (selectedReservation.equipment_id) {
                                  await loadReservations(selectedReservation.equipment_id);
                                }
                                await fetchData(true);
                              } catch {
                                showError('Error al actualizar checklist');
                              }
                            }}
                            className="w-5 h-5 text-[#cf1b22] border-gray-300 rounded focus:ring-[#cf1b22]"
                            disabled={hasExceeded10Days}
                          />
                          <span className={`text-sm ${hasExceeded10Days ? 'text-gray-400' : 'text-gray-700'}`}>
                            10% Valor de la máquina
                          </span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedReservation.firma_documentos || false}
                            onChange={async (e) => {
                              try {
                                await apiPut(`/api/equipments/reservations/${selectedReservation.id}/update-checklist`, {
                                  firma_documentos: e.target.checked
                                });
                                setSelectedReservation({
                                  ...selectedReservation,
                                  firma_documentos: e.target.checked
                                });
                                if (selectedReservation.equipment_id) {
                                  await loadReservations(selectedReservation.equipment_id);
                                }
                                await fetchData(true);
                              } catch {
                                showError('Error al actualizar checklist');
                              }
                            }}
                            className="w-5 h-5 text-[#cf1b22] border-gray-300 rounded focus:ring-[#cf1b22]"
                            disabled={hasExceeded10Days}
                          />
                          <span className={`text-sm ${hasExceeded10Days ? 'text-gray-400' : 'text-gray-700'}`}>
                            Checklist Firma de Documentos
                          </span>
                        </label>
                        {hasExceeded10Days && !allChecked && (
                          <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800">
                            ⚠️ Han pasado más de 10 días y el checklist no está completo. La máquina será liberada automáticamente.
                          </div>
                        )}
                        {!hasExceeded10Days && (
                          <div className="mt-3 text-xs text-gray-600">
                            Días transcurridos desde el primer checklist: {daysSinceCreation} / 10 días límite
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

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
              {isJefeComercial() && selectedReservation.status === 'PENDING' && (
                <Button
                  variant="primary"
                  onClick={() => {
                    if (selectedReservation) {
                    if (selectedReservation.equipment_id) {
                      handleApproveReservation(selectedReservation.id, selectedReservation.equipment_id);
                    }
                      setViewReservationModalOpen(false);
                      setSelectedReservation(null);
                    }
                  }}
                  disabled={(() => {
                    const daysSinceCreation = selectedReservation.created_at 
                      ? Math.floor((new Date().getTime() - new Date(selectedReservation.created_at).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    const hasExceeded10Days = daysSinceCreation > 10;
                    const allChecked = selectedReservation.consignacion_10_millones && 
                                      selectedReservation.porcentaje_10_valor_maquina && 
                                      selectedReservation.firma_documentos;
                    return !allChecked || hasExceeded10Days;
                  })()}
                  className={`px-4 py-1.5 text-xs ${
                    (() => {
                      const daysSinceCreation = selectedReservation.created_at 
                        ? Math.floor((new Date().getTime() - new Date(selectedReservation.created_at).getTime()) / (1000 * 60 * 60 * 24))
                        : 0;
                      const hasExceeded10Days = daysSinceCreation > 10;
                      const allChecked = selectedReservation.consignacion_10_millones && 
                                        selectedReservation.porcentaje_10_valor_maquina && 
                                        selectedReservation.firma_documentos;
                      return allChecked && !hasExceeded10Days
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-gray-400 text-gray-200 cursor-not-allowed';
                    })()
                  }`}
                >
                  Aprobar
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => {
                  if (selectedReservation) {
                    if (selectedReservation.equipment_id) {
                      handleRejectReservation(selectedReservation.id, selectedReservation.equipment_id);
                    }
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

        {/* Modal de Filtrado de Equipos */}
        {filterModalOpen && filterModalType && (
          <Modal
            isOpen={filterModalOpen}
            onClose={() => {
              setFilterModalOpen(false);
              setFilterModalType(null);
              setFilterModalCondition('all');
            }}
            title={
              filterModalType === 'disponibles' ? 'Equipos Libres' :
              filterModalType === 'reservadas' ? 'Equipos Reservadas' :
              filterModalType === 'nuevas' ? 'Equipos Nuevas' :
              'Equipos Usadas'
            }
          >
            <div className="space-y-4">
              {/* Filtros de condición - Solo mostrar si no es "nuevas" o "usadas" */}
              {(filterModalType === 'disponibles' || filterModalType === 'reservadas') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterModalCondition('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterModalCondition === 'all'
                        ? 'bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterModalCondition('NUEVO')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterModalCondition === 'NUEVO'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Nuevas
                  </button>
                  <button
                    onClick={() => setFilterModalCondition('USADO')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterModalCondition === 'USADO'
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Usadas
                  </button>
                </div>
              )}

              {/* Lista de equipos */}
              <div className="max-h-[60vh] overflow-y-auto">
                {(() => {
                  const filtered = data.filter((row) => {
                    // Si es "nuevas" o "usadas", solo filtrar por condición
                    if (filterModalType === 'nuevas' || filterModalType === 'usadas') {
                      return row.condition === filterModalCondition;
                    }
                    // Si es "disponibles" o "reservadas", filtrar por estado y condición
                    const stateMatch = filterModalType === 'disponibles' 
                      ? row.state === 'Libre' 
                      : row.state === 'Reservada';
                    const conditionMatch = filterModalCondition === 'all' 
                      ? true 
                      : row.condition === filterModalCondition;
                    return stateMatch && conditionMatch;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">
                          No hay equipos{' '}
                          {filterModalType === 'disponibles' ? 'disponibles' :
                           filterModalType === 'reservadas' ? 'reservadas' :
                           filterModalType === 'nuevas' ? 'nuevas' : 'usadas'}
                          {filterModalCondition !== 'all' && filterModalType !== 'nuevas' && filterModalType !== 'usadas' && ` ${filterModalCondition.toLowerCase()}`}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filtered.map((row) => (
                        <div
                          key={row.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => {
                            setViewEquipment(row);
                            setViewOpen(true);
                            setFilterModalOpen(false);
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-gray-900">
                                {row.model || '-'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Serie: {row.serial || '-'}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                row.condition === 'NUEVO'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {row.condition || 'N/A'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-gray-500">Año</p>
                              <p className="font-medium text-gray-900">{row.year || '-'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Horas</p>
                              <p className="font-medium text-gray-900">
                                {row.hours ? row.hours.toLocaleString('es-CO') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">PVP</p>
                              <p className="font-medium text-gray-900">
                                {row.pvp_est ? formatNumber(row.pvp_est) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Estado</p>
                              <p className="font-medium text-gray-900">{row.state || '-'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Resumen */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Mostrando{' '}
                  <span className="font-semibold text-gray-900">
                    {(() => {
                      const filtered = data.filter((row) => {
                        // Si es "nuevas" o "usadas", solo filtrar por condición
                        if (filterModalType === 'nuevas' || filterModalType === 'usadas') {
                          return row.condition === filterModalCondition;
                        }
                        // Si es "disponibles" o "reservadas", filtrar por estado y condición
                        const stateMatch = filterModalType === 'disponibles' 
                          ? row.state === 'Libre' 
                          : row.state === 'Reservada';
                        const conditionMatch = filterModalCondition === 'all' 
                          ? true 
                          : row.condition === filterModalCondition;
                        return stateMatch && conditionMatch;
                      });
                      return filtered.length;
                    })()}
                  </span>{' '}
                  equipo(s)
                </p>
              </div>
            </div>
          </Modal>
        )}
    </div>
  );
};

