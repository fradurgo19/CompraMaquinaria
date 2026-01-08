/**
 * Página de Importaciones
 * Solo visible para usuario importaciones@partequipos.com
 * Vista de lista de compras con campos específicos editables
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import React from 'react';
import { Search, Calendar, Package, Truck, MapPin, Edit, History, Clock, Layers, Save, X, ChevronDown, ChevronRight, ChevronUp, MoreVertical, Move, Unlink } from 'lucide-react';
import { apiGet, apiPut, apiPost, apiDelete } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { useBatchModeGuard } from '../hooks/useBatchModeGuard';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';
import { PurchaseFiles } from '../components/PurchaseFiles';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { Button } from '../atoms/Button';

import { MACHINE_TYPE_OPTIONS, formatMachineType } from '../constants/machineTypes';

interface ImportationRow {
  id: string;
  machine_id?: string;
  mq: string;
  purchase_type: string;
  condition: string | null; // NUEVO o USADO
  shipment_type_v2: string;
  supplier_name: string;
  machine_type?: string | null;
  brand: string;
  model: string;
  serial: string;
  year?: number | null;
  invoice_date: string;
  payment_date: string;
  location: string;
  port_of_embarkation: string;
  port_of_destination: string;
  shipment_departure_date: string;
  shipment_arrival_date: string;
  nationalization_date: string;
  created_at?: string;
}

export const ImportationsPage = () => {
  const [importations, setImportations] = useState<ImportationRow[]>([]);
  const [filteredData, setFilteredData] = useState<ImportationRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  // Filtros de columnas
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [machineTypeFilter, setMachineTypeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [serialFilter, setSerialFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [mqFilter, setMqFilter] = useState('');
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ImportationRow>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ImportationRow | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [filesSectionExpanded, setFilesSectionExpanded] = useState(false);
  const [privateFilesSectionExpanded, setPrivateFilesSectionExpanded] = useState(false);
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [expandedMQs, setExpandedMQs] = useState<Set<string>>(new Set());
  const [editingGroupMQ, setEditingGroupMQ] = useState<string | null>(null);
  const [newGroupMQ, setNewGroupMQ] = useState<string>('');
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { recordId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [moveToMQModal, setMoveToMQModal] = useState<{
    open: boolean;
    purchaseIds: string[];
    currentMQ?: string;
  }>({ open: false, purchaseIds: [] });
  const [selectedImportationIds, setSelectedImportationIds] = useState<Set<string>>(new Set());

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
    loadImportations();
  }, []);

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

  // Valores únicos para filtros de columnas
  const uniqueSuppliers = useMemo(
    () => [...new Set(importations.map(item => item.supplier_name).filter(Boolean))].sort() as string[],
    [importations]
  );
  const uniqueBrands = useMemo(
    () => [...new Set(importations.map(item => item.brand).filter(Boolean))].sort() as string[],
    [importations]
  );
  const uniqueMachineTypes = useMemo(
    () => [...new Set(importations.map(item => item.machine_type).filter(Boolean))].sort() as string[],
    [importations]
  );
  const uniqueModels = useMemo(
    () => [...new Set(importations.map(item => item.model).filter(Boolean))].sort() as string[],
    [importations]
  );
  const uniqueSerials = useMemo(
    () => [...new Set(importations.map(item => item.serial).filter(Boolean))].sort() as string[],
    [importations]
  );
  const uniqueYears = useMemo(
    () => [...new Set(importations.map(item => (item as any).year || (item as any).machine?.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a)) as (number | string)[],
    [importations]
  );
  const uniqueMqs = useMemo(
    () => [...new Set(importations.map(item => item.mq).filter(Boolean))].sort() as string[],
    [importations]
  );

  useEffect(() => {
    filterData();
  }, [searchTerm, importations, supplierFilter, brandFilter, modelFilter, serialFilter, yearFilter, mqFilter]);

  const loadImportations = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ImportationRow[]>('/api/purchases');
      setImportations(data);
      setSelectedImportationIds(new Set());
    } catch (err) {
      console.error('Error cargando importaciones:', err);
      showError('Error al cargar las importaciones');
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = importations;

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtros de columnas
    if (supplierFilter && filtered.some(item => item.supplier_name === supplierFilter)) {
      filtered = filtered.filter(item => item.supplier_name === supplierFilter);
    }
    if (brandFilter && filtered.some(item => item.brand === brandFilter)) {
      filtered = filtered.filter(item => item.brand === brandFilter);
    }
    if (machineTypeFilter && filtered.some(item => item.machine_type === machineTypeFilter)) {
      filtered = filtered.filter(item => item.machine_type === machineTypeFilter);
    }
    if (modelFilter && filtered.some(item => item.model === modelFilter)) {
      filtered = filtered.filter(item => item.model === modelFilter);
    }
    if (serialFilter && filtered.some(item => item.serial === serialFilter)) {
      filtered = filtered.filter(item => item.serial === serialFilter);
    }
    if (yearFilter && filtered.some(item => String(item.year) === yearFilter)) {
      filtered = filtered.filter(item => String(item.year) === yearFilter);
    }
    if (mqFilter && filtered.some(item => item.mq === mqFilter)) {
      filtered = filtered.filter(item => item.mq === mqFilter);
    }

    setFilteredData(filtered);
  };

  // Selección múltiple (como en compras)
  const toggleImportationSelection = (purchaseId: string) => {
    setSelectedImportationIds((prev) => {
      const next = new Set(prev);
      if (next.has(purchaseId)) {
        next.delete(purchaseId);
      } else {
        next.add(purchaseId);
      }
      return next;
    });
  };

  const toggleAllImportationsSelection = () => {
    if (selectedImportationIds.size === filteredData.length) {
      setSelectedImportationIds(new Set());
    } else {
      setSelectedImportationIds(new Set(filteredData.map((item) => item.id)));
    }
  };

  // Agrupar importaciones por MQ
  const groupedImportations = useMemo(() => {
    type GroupMeta = {
      importations: ImportationRow[];
    };

    const groups = new Map<string, GroupMeta>();
    const ungrouped: ImportationRow[] = [];

    filteredData.forEach((importation) => {
      if (importation.mq && importation.mq.trim() !== '') {
        const mq = importation.mq.trim();
        if (!groups.has(mq)) {
          groups.set(mq, { importations: [] });
        }
        groups.get(mq)!.importations.push(importation);
      } else {
        ungrouped.push(importation);
      }
    });

    const grouped = Array.from(groups.entries())
      .map(([mq, meta]) => ({
        mq,
        importations: meta.importations.sort((a, b) => {
          // Ordenar por fecha de creación descendente
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        }),
        totalImportations: meta.importations.length,
      }))
      .sort((a, b) => {
        // Ordenar grupos por fecha de creación del primer registro (más reciente primero)
        const dateA = new Date(a.importations[0]?.created_at || 0).getTime();
        const dateB = new Date(b.importations[0]?.created_at || 0).getTime();
        return dateB - dateA;
      });

    // Ordenar ungrouped por created_at descendente
    const sortedUngrouped = ungrouped.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    return { grouped, ungrouped: sortedUngrouped };
  }, [filteredData]);

  const toggleMQExpansion = (mq: string) => {
    setExpandedMQs((prev) => {
      const next = new Set(prev);
      if (next.has(mq)) {
        next.delete(mq);
      } else {
        next.add(mq);
      }
      return next;
    });
  };

  // Función para actualizar MQ de todo un grupo
  const handleUpdateGroupMQ = async (mq: string) => {
    if (!newGroupMQ || newGroupMQ.trim() === '') {
      showError('El MQ no puede estar vacío');
      return;
    }

    try {
      const group = groupedImportations.grouped.find(g => g.mq === mq);
      if (!group) return;

      // Actualizar todos los registros del grupo con el nuevo MQ
      await Promise.all(
        group.importations.map(imp => 
          apiPut(`/api/purchases/${imp.id}`, { mq: newGroupMQ.trim() })
        )
      );

      showSuccess(`MQ actualizado para ${group.importations.length} registro(s)`);
      setEditingGroupMQ(null);
      setNewGroupMQ('');
      await loadImportations();
    } catch (error) {
      showError('Error al actualizar MQ del grupo');
    }
  };

  // Función para desagrupar una importación
  const handleUngroupImportation = async (purchaseId: string) => {
    try {
      await apiDelete(`/api/purchases/ungroup-mq/${purchaseId}`);
      showSuccess('Importación desagrupada exitosamente');
      setActionMenuOpen(null);
      await loadImportations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al desagrupar importación';
      showError(message);
    }
  };

  // Función para desagrupar múltiples importaciones
  const handleUngroupMultiple = async (purchaseIds: string[]) => {
    try {
      await Promise.all(purchaseIds.map(id => apiDelete(`/api/purchases/ungroup-mq/${id}`)));
      showSuccess(`${purchaseIds.length} importación(es) desagrupada(s) exitosamente`);
      setActionMenuOpen(null);
      setSelectedImportationIds(new Set());
      await loadImportations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al desagrupar importaciones';
      showError(message);
    }
  };

  // Función para abrir modal de mover a otro MQ
  const handleOpenMoveToMQ = (purchaseIds: string[], currentMQ?: string) => {
    setMoveToMQModal({ open: true, purchaseIds, currentMQ });
    setActionMenuOpen(null);
  };

  // Función para mover importaciones a otro MQ
  const handleMoveToMQ = async (targetMQ: string) => {
    try {
      if (!targetMQ || targetMQ.trim() === '') {
        showError('El MQ destino no puede estar vacío');
        return;
      }

      await apiPost('/api/purchases/group-by-mq', {
        purchase_ids: moveToMQModal.purchaseIds,
        mq: targetMQ.trim()
      });

      showSuccess(`${moveToMQModal.purchaseIds.length} importación(es) movida(s) al MQ ${targetMQ}`);
      setMoveToMQModal({ open: false, purchaseIds: [] });
      setSelectedImportationIds(new Set());
      await loadImportations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al mover importaciones';
      showError(message);
    }
  };

  const handleEdit = (row: ImportationRow) => {
    setSelectedRow(row);
    setEditingRow(row.id);
    setEditData({
      mq: row.mq || '',
      port_of_destination: row.port_of_destination || '',
      shipment_departure_date: formatDateForInput(row.shipment_departure_date),
      shipment_arrival_date: formatDateForInput(row.shipment_arrival_date),
      nationalization_date: formatDateForInput(row.nationalization_date),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (id: string) => {
    // Guardar directamente (el control de cambios se maneja con inline editing)
    await saveChanges();
  };

  const saveChanges = async (changeReason?: string) => {
    const id = pendingUpdate?.id || selectedRow?.id;
    const data = pendingUpdate?.data || editData;

    try {
      // Actualizar en purchases
      await apiPut(`/api/purchases/${id}`, data);

      setEditingRow(null);
      setIsModalOpen(false);
      setShowChangeModal(false);
      setSelectedRow(null);
      setPendingUpdate(null);
      await loadImportations();
      showSuccess('Datos de importación actualizados correctamente');
    } catch {
      showError('Error al actualizar los datos');
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
    setIsModalOpen(false);
    setSelectedRow(null);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      // Si ya viene en formato YYYY-MM-DD, usarlo directamente
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      }
      // Si viene como fecha ISO completa, extraer solo la parte de fecha
      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        const dateOnly = dateStr.split('T')[0];
        const [year, month, day] = dateOnly.split('-');
        return `${day}/${month}/${year}`;
      }
      // Crear fecha en zona horaria local para evitar problemas de UTC
      const date = new Date(dateStr);
      // Usar métodos locales en lugar de toLocaleDateString para evitar cambios de día
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
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
      // Usar métodos locales en lugar de toISOString para evitar cambios de día
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  // Funciones helper para estilos elegantes
  const getProveedorStyle = (proveedor: string | null | undefined) => {
    if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md whitespace-nowrap';
  };

  const getMarcaStyle = (marca: string | null | undefined) => {
    if (!marca || marca === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md';
  };

  const getModeloStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md whitespace-nowrap';
  };

  const getSerialStyle = (serial: string | null | undefined) => {
    if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
  };

  const getUbicacionStyle = (ubicacion: string | null | undefined) => {
    if (!ubicacion || ubicacion === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
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

  // Función para determinar el color de fondo de la fila (consistente con compras)
  const getRowBackgroundStyle = () => {
    return 'bg-white hover:bg-gray-50';
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
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('importaciones');
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
      return apiPut(`/api/purchases/${recordId}`, updates)
        .then(() => loadImportations())
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
          table_name: 'purchases',
          record_id: batch.recordId,
          changes: batch.changes,
          change_reason: reason || null,
          module_name: 'importaciones',
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
      await apiPut(`/api/purchases/${pending.recordId}`, pending.updates);
      await apiPost('/api/change-logs', {
        table_name: 'purchases',
        record_id: pending.recordId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'importaciones',
      });
      await loadChangeIndicators([pending.recordId]);
      showSuccess('Dato actualizado correctamente');
      await loadImportations();
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
    record: ImportationRow,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    row: ImportationRow,
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
    row: ImportationRow,
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
      await apiPut(`/api/purchases/${row.id}`, updatesToApply);
      // Actualizar estado local
      setImportations(prev => prev.map(r => 
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
    moduleName: 'Importaciones'
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

  // Cargar indicadores de cambios
  const loadChangeIndicators = async (recordIds?: string[]) => {
    if (importations.length === 0) return;
    
    try {
      const idsToLoad = recordIds || importations.map(i => i.id);
      const response = await apiPost<Record<string, Array<{
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
        record_ids: idsToLoad,
      });
      
      const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
      
      Object.entries(response).forEach(([recordId, changes]) => {
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
      
      setInlineChangeIndicators(prev => ({ ...prev, ...indicatorsMap }));
    } catch (error) {
      console.error('Error al cargar indicadores de cambios:', error);
    }
  };

  useEffect(() => {
    if (!loading && importations.length > 0) {
      loadChangeIndicators();
    }
  }, [importations, loading]);

  // Función helper para renderizar una fila de importación
  const renderImportationRow = (row: ImportationRow) => (
    <>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={selectedImportationIds.has(row.id)}
          onChange={() => toggleImportationSelection(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-[#cf1b22] focus:ring-[#cf1b22] border-gray-300 rounded"
        />
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
        <span className="font-semibold text-gray-900">{row.supplier_name || '-'}</span>
      </td>
  <td className="px-4 py-3 text-sm text-gray-700">
    <InlineFieldEditor
      value={row.machine_type || ''}
      type="select"
      placeholder="Tipo de máquina"
      options={MACHINE_TYPE_OPTIONS}
      displayFormatter={(val) => formatMachineType(val) || 'Sin tipo'}
      onSave={(val) => handleInlineSave(row.id, 'machine_type', 'Tipo de máquina', val)}
    />
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        <span className="text-gray-800 uppercase tracking-wide">{row.brand || '-'}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
        <span className="text-gray-800">{row.model || '-'}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
        <span className="text-gray-800 font-mono">{row.serial || '-'}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        <span className="text-gray-800">{row.year || '-'}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 font-mono">
        <InlineCell {...buildCellProps(row.id, 'mq')}>
          <InlineFieldEditor
            value={row.mq || ''}
            placeholder="MQ"
            onSave={(val) => requestFieldUpdate(row, 'mq', 'MQ', val)}
          />
        </InlineCell>
      </td>
      {/* TIPO - OCULTO */}
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
      
      <td className="px-4 py-3 text-sm text-gray-700">
        <InlineCell {...buildCellProps(row.id, 'shipment_type_v2')}>
          <span>{row.shipment_type_v2 || '-'}</span>
        </InlineCell>
      </td>
      
      {/* PUERTO EMBARQUE */}
      <td className="px-4 py-3 text-sm text-gray-700">
        <InlineCell {...buildCellProps(row.id, 'port_of_embarkation')}>
          <span className="text-gray-700">{row.port_of_embarkation || '-'}</span>
        </InlineCell>
      </td>
      
      {/* EMBARQUE SALIDA */}
      <td className="px-4 py-3 text-sm text-gray-700">
        <InlineCell {...buildCellProps(row.id, 'shipment_departure_date')}>
          <InlineFieldEditor
            value={formatDateForInput(row.shipment_departure_date)}
            type="date"
            placeholder="ETD"
            onSave={(val) =>
              requestFieldUpdate(
                row,
                'shipment_departure_date',
                'Fecha embarque salida',
                typeof val === 'string' && val ? val : null,
                {
                  shipment_departure_date: typeof val === 'string' && val ? val : null,
                }
              )
            }
            displayFormatter={(val) =>
              val ? formatDate(String(val)) : '-'
            }
          />
        </InlineCell>
      </td>
      
      {/* EMBARQUE LLEGADA */}
      <td className="px-4 py-3 text-sm text-gray-700">
        <InlineCell {...buildCellProps(row.id, 'shipment_arrival_date')}>
          <InlineFieldEditor
            value={formatDateForInput(row.shipment_arrival_date)}
            type="date"
            placeholder="ETA"
            onSave={(val) =>
              requestFieldUpdate(
                row,
                'shipment_arrival_date',
                'Fecha embarque llegada',
                typeof val === 'string' && val ? val : null,
                {
                  shipment_arrival_date: typeof val === 'string' && val ? val : null,
                }
              )
            }
            displayFormatter={(val) =>
              val ? formatDate(String(val)) : '-'
            }
          />
        </InlineCell>
      </td>
      
      {/* PUERTO */}
      <td className="px-4 py-3 text-sm text-gray-700">
        <InlineCell {...buildCellProps(row.id, 'port_of_destination')}>
          <InlineFieldEditor
            value={row.port_of_destination || ''}
            type="select"
            placeholder="Puerto de llegada"
            options={[
              { value: 'BUENAVENTURA', label: 'BUENAVENTURA' },
              { value: 'CARTAGENA', label: 'CARTAGENA' },
              { value: 'SANTA MARTA', label: 'SANTA MARTA' },
            ]}
            onSave={(val) => requestFieldUpdate(row, 'port_of_destination', 'Puerto de llegada', val)}
          />
        </InlineCell>
      </td>
      
      {/* FECHA NACIONALIZACIÓN */}
      <td className="px-4 py-3 text-sm text-gray-700">
        <InlineCell {...buildCellProps(row.id, 'nationalization_date')}>
          <InlineFieldEditor
            value={formatDateForInput(row.nationalization_date)}
            type="date"
            placeholder="Fecha nacionalización"
            onSave={(val) =>
              requestFieldUpdate(
                row,
                'nationalization_date',
                'Fecha nacionalización',
                typeof val === 'string' && val ? val : null,
                {
                  nationalization_date: typeof val === 'string' && val ? val : null,
                }
              )
            }
            displayFormatter={(val) =>
              val ? formatDate(String(val)) : '-'
            }
          />
        </InlineCell>
      </td>
      
      {/* Acciones */}
      <td className="px-2 py-3 text-sm text-gray-700 sticky right-0 bg-white z-10" style={{ minWidth: 100 }}>
        <div className="flex items-center gap-1 justify-end">
          {/* Menú de acciones para desagrupar/mover (solo si tiene MQ) */}
          {row.mq && (
            <div className="relative action-menu-container" style={{ zIndex: 10000, position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActionMenuOpen(actionMenuOpen === row.id ? null : row.id);
                }}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Opciones de MQ"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {actionMenuOpen === row.id && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-2xl border border-gray-300" style={{ zIndex: 100000, position: 'absolute' }}>
                  <div className="py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(null);
                        handleOpenMoveToMQ([row.id], row.mq);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <Move className="w-4 h-4 text-gray-500" />
                      Mover a otro MQ
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(null);
                        if (confirm(`¿Desagrupar esta importación del MQ ${row.mq}?`)) {
                          handleUngroupImportation(row.id);
                        }
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <Unlink className="w-4 h-4 text-red-500" />
                      Desagrupar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => handleEdit(row)}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedRow(row);
              setIsHistoryOpen(true);
            }}
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Historial de cambios"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </td>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-amber-800 rounded-xl shadow-md p-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold text-white">Control de Embarques</h1>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-brand-gray">
            <Package className="w-8 h-8 text-blue-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">Total Importaciones</p>
            <p className="text-3xl font-bold text-gray-900">{importations.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <Calendar className="w-8 h-8 text-yellow-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">En Tránsito</p>
            <p className="text-3xl font-bold text-yellow-600">
              {importations.filter(i => i.shipment_departure_date && !i.shipment_arrival_date).length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <Truck className="w-8 h-8 text-green-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">Llegadas</p>
            <p className="text-3xl font-bold text-green-600">
              {importations.filter(i => i.shipment_arrival_date).length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-brand-red">
            <MapPin className="w-8 h-8 text-purple-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">Nacionalizadas</p>
            <p className="text-3xl font-bold text-purple-600">
              {importations.filter(i => i.nationalization_date).length}
            </p>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-xl p-6"
        >
          {/* Search y Toggle Modo Masivo */}
          <div className="mb-6 space-y-3">
            {selectedImportationIds.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleOpenMoveToMQ(Array.from(selectedImportationIds))}
                  className="flex items-center gap-2 bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-md text-sm px-4 py-2"
                >
                  <Move className="w-4 h-4" />
                  Mover a MQ ({selectedImportationIds.size})
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const withMQ = filteredData
                      .filter(item => selectedImportationIds.has(item.id) && item.mq && item.mq.trim() !== '')
                      .map(item => item.id);
                    if (withMQ.length === 0) {
                      showError('Selecciona importaciones que tengan MQ para desagrupar');
                      return;
                    }
                    if (confirm(`¿Desagrupar ${withMQ.length} importación(es)?`)) {
                      handleUngroupMultiple(withMQ);
                    }
                  }}
                  className="flex items-center gap-2 text-sm px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Unlink className="w-4 h-4" />
                  Desagrupar ({selectedImportationIds.size})
                </Button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por modelo, serie o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
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
              <div style={{ width: '3000px', height: '1px' }}></div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div ref={tableScrollRef} className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-800 uppercase bg-amber-100">
                      <input
                        type="checkbox"
                        checked={selectedImportationIds.size > 0 && selectedImportationIds.size === filteredData.length}
                        onChange={toggleAllImportationsSelection}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-[#cf1b22] focus:ring-[#cf1b22] border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
                      <div className="flex flex-col gap-1">
                        <span>PROVEEDOR</span>
                        <select
                          value={supplierFilter}
                          onChange={(e) => setSupplierFilter(e.target.value)}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Todos</option>
                          {uniqueSuppliers.map(supplier => (
                            <option key={supplier || ''} value={supplier || ''}>{supplier}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
                      <div className="flex flex-col gap-1">
                        <span>TIPO MÁQUINA</span>
                        <select
                          value={machineTypeFilter}
                          onChange={(e) => setMachineTypeFilter(e.target.value)}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Todos</option>
                          {uniqueMachineTypes.map(type => (
                            <option key={type || ''} value={type || ''}>{formatMachineType(type)}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
                      <div className="flex flex-col gap-1">
                        <span>MARCA</span>
                        <select
                          value={brandFilter}
                          onChange={(e) => setBrandFilter(e.target.value)}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Todos</option>
                          {uniqueBrands.map(brand => (
                            <option key={brand || ''} value={brand || ''}>{brand}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
                      <div className="flex flex-col gap-1">
                        <span>SERIAL</span>
                        <select
                          value={serialFilter}
                          onChange={(e) => setSerialFilter(e.target.value)}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Todos</option>
                          {uniqueSerials.map(serial => (
                            <option key={serial || ''} value={serial || ''}>{serial}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">
                      <div className="flex flex-col gap-1">
                        <span>MQ</span>
                        <select
                          value={mqFilter}
                          onChange={(e) => setMqFilter(e.target.value)}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Todos</option>
                          {uniqueMqs.map(mq => (
                            <option key={mq || ''} value={mq || ''}>{mq}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                    {/* <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">TIPO</th> */}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">CONDICIÓN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-indigo-100">MODALIDAD EMBARQUE</th>
                    {/* <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">FECHA FACTURA</th> */}
                    {/* <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">FECHA PAGO</th> */}
                    {/* <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">UBICACIÓN</th> */}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-indigo-100">PUERTO EMBARQUE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">ETD</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">ETA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">PUERTO DE LLEGADA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">FECHA NACIONALIZACIÓN</th>
                    <th className="px-2 py-3 text-center text-xs font-semibold text-gray-800 uppercase sticky right-0 bg-amber-100 z-10" style={{ minWidth: 140 }}>ACCIONES</th>
                  </tr>
                </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : groupedImportations.grouped.length === 0 && groupedImportations.ungrouped.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                      No hay importaciones registradas
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Grupos de MQ */}
                    {groupedImportations.grouped.map((group, groupIndex) => {
                      const isExpanded = expandedMQs.has(group.mq);
                      const isEditingMQ = editingGroupMQ === group.mq;
                      
                      return (
                        <React.Fragment key={group.mq}>
                          {/* Fila de Grupo MQ */}
                          <motion.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: groupIndex * 0.05 }}
                            className="bg-white border-y border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => toggleMQExpansion(group.mq)}
                          >
                          <td colSpan={15} className="px-4 py-4">
                              <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                  <Package className="w-5 h-5 text-brand-red" />
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-500 font-semibold tracking-wide">
                                      MQ
                                    </p>
                                    {isEditingMQ ? (
                                      <div className="flex items-center gap-2 mt-1">
                                        <input
                                          type="text"
                                          value={newGroupMQ}
                                          onChange={(e) => setNewGroupMQ(e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.stopPropagation();
                                              handleUpdateGroupMQ(group.mq);
                                            } else if (e.key === 'Escape') {
                                              e.stopPropagation();
                                              setEditingGroupMQ(null);
                                              setNewGroupMQ('');
                                            }
                                          }}
                                          className="px-2 py-1 text-lg font-semibold text-gray-900 font-mono border border-brand-red rounded focus:outline-none focus:ring-2 focus:ring-brand-red"
                                          autoFocus
                                        />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUpdateGroupMQ(group.mq);
                                          }}
                                          className="px-3 py-1 bg-brand-red text-white text-xs rounded hover:bg-red-700"
                                        >
                                          Guardar
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingGroupMQ(null);
                                            setNewGroupMQ('');
                                          }}
                                          className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <p className="text-lg font-semibold text-gray-900 font-mono">{group.mq}</p>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingGroupMQ(group.mq);
                                            setNewGroupMQ(group.mq);
                                          }}
                                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                                        >
                                          Editar MQ
                                        </button>
                                      </>
                                    )}
                                    <p className="text-sm text-gray-500">
                                      {group.totalImportations} {group.totalImportations === 1 ? 'importación' : 'importaciones'}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="h-12 w-px bg-gray-300"></div>
                                
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                  )}
                                  <span className="text-xs text-gray-500">
                                    {isExpanded ? 'Contraer' : 'Expandir'}
                                  </span>
                                </div>

                                {/* Menú de acciones para el grupo */}
                                <div className="relative action-menu-container ml-auto" style={{ zIndex: 10000, position: 'relative' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionMenuOpen(actionMenuOpen === group.mq ? null : group.mq);
                                    }}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Opciones de MQ"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                  
                                  {actionMenuOpen === group.mq && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-2xl border border-gray-300" style={{ zIndex: 100000, position: 'absolute' }}>
                                      <div className="py-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActionMenuOpen(null);
                                            handleOpenMoveToMQ(group.importations.map(imp => imp.id), group.mq);
                                          }}
                                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                        >
                                          <Move className="w-4 h-4 text-gray-500" />
                                          Mover todo el grupo a otro MQ
                                        </button>
                                        <div className="border-t border-gray-200 my-1"></div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActionMenuOpen(null);
                                            if (confirm(`¿Desagrupar todas las ${group.totalImportations} importaciones del MQ ${group.mq}?`)) {
                                              handleUngroupMultiple(group.importations.map(imp => imp.id));
                                            }
                                          }}
                                          className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors whitespace-nowrap"
                                        >
                                          <Unlink className="w-4 h-4 text-red-500 flex-shrink-0" />
                                          <span className="truncate">Desagrupar todo el grupo</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </motion.tr>

                          {/* Filas de Importaciones dentro del MQ (cuando está expandido) */}
                          {isExpanded &&
                            group.importations.map((row, rowIndex) => (
                              <motion.tr
                                key={row.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: rowIndex * 0.03 }}
                                className="bg-gray-100 hover:bg-gray-150 transition-colors border-b border-gray-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {renderImportationRow(row)}
                              </motion.tr>
                            ))}
                        </React.Fragment>
                      );
                    })}

                    {/* Filas sin agrupar */}
                    {groupedImportations.ungrouped.map((row) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white hover:bg-gray-50 transition-colors"
                      >
                        {renderImportationRow(row)}
                      </motion.tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </motion.div>
        {/* Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCancel}
          title="Editar Importación"
          size="md"
        >
          {selectedRow && (
            <div className="space-y-4">
              {/* Resumen del registro */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">MODALIDAD EMBARQUE</p>
                  <p className="text-sm font-semibold">{selectedRow.shipment_type_v2 || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">PROVEEDOR</p>
                  <p className="text-sm font-semibold">{selectedRow.supplier_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">MODELO</p>
                  <p className="text-sm font-semibold">{selectedRow.model || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">SERIAL</p>
                  <p className="text-sm font-semibold font-mono">{selectedRow.serial || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">FECHA FACTURA</p>
                  <p className="text-sm">{selectedRow.invoice_date ? new Date(selectedRow.invoice_date).toLocaleDateString('es-CO') : '-'}</p>
                </div>
              </div>
              
              {/* Campo MQ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MQ</label>
                <input
                  type="text"
                  value={editData.mq || ''}
                  onChange={(e) => setEditData({ ...editData, mq: e.target.value })}
                  placeholder="Ejemplo: MQ001"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ETD (Embarque Salida)</label>
                  <input
                    type="date"
                    value={editData.shipment_departure_date || ''}
                    onChange={(e) => setEditData({ ...editData, shipment_departure_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ETA (Embarque Llegada)</label>
                  <input
                    type="date"
                    value={editData.shipment_arrival_date || ''}
                    onChange={(e) => setEditData({ ...editData, shipment_arrival_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puerto de Llegada</label>
                  <select
                    value={editData.port_of_destination || ''}
                    onChange={(e) => setEditData({ ...editData, port_of_destination: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  >
                    <option value="">-</option>
                    <option value="BUENAVENTURA">BUENAVENTURA</option>
                    <option value="CARTAGENA">CARTAGENA</option>
                    <option value="SANTA MARTA">SANTA MARTA</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Nacionalización</label>
                  <input
                    type="date"
                    value={editData.nationalization_date || ''}
                    onChange={(e) => setEditData({ ...editData, nationalization_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  />
                </div>
              </div>

              {/* Archivos de Importaciones */}
              {selectedRow.machine_id && (
                <div className="pt-4 space-y-3">
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <button
                      onClick={() => setFilesSectionExpanded(!filesSectionExpanded)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-[#50504f] mb-2 hover:text-[#cf1b22] transition-colors"
                    >
                      <span>📂 Gestión de Archivos</span>
                      {filesSectionExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {filesSectionExpanded && (
                    <MachineFiles 
                      machineId={selectedRow.machine_id} 
                      allowUpload={true} 
                      allowDelete={true}
                      currentScope="IMPORTACIONES"
                      uploadExtraFields={{ scope: 'IMPORTACIONES' }}
                    />
                    )}
                  </div>

                  {/* Archivos Privados de Compras - Solo visualización para usuarios de importaciones */}
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <button
                      onClick={() => setPrivateFilesSectionExpanded(!privateFilesSectionExpanded)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-[#50504f] mb-2 hover:text-[#cf1b22] transition-colors"
                    >
                      <span>📁 Archivos Privados de Compras</span>
                      {privateFilesSectionExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {privateFilesSectionExpanded && (
                      <PurchaseFiles 
                        purchaseId={selectedRow.id}
                        allowUpload={false}
                        allowDelete={false}
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={handleCancel}
                  className="px-4 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-[#50504f] rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSave(selectedRow.id)}
                  className="px-4 py-1.5 text-xs bg-[#cf1b22] hover:bg-[#a81820] text-white rounded-lg"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal de Control de Cambios - No se usa, el control de cambios se maneja con inline editing */}

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

        {/* Modal de Historial */}
        <Modal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          title="Historial de Cambios - Todos los Módulos"
          size="lg"
        >
          {selectedRow && (
            <ChangeHistory 
              tableName="purchases" 
              recordId={selectedRow.id}
              purchaseId={selectedRow.id}
            />
          )}
        </Modal>

        {/* Modal para mover importaciones a otro MQ */}
        <Modal
          isOpen={moveToMQModal.open}
          onClose={() => setMoveToMQModal({ open: false, purchaseIds: [] })}
          title="Mover importaciones a otro MQ"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MQ Destino
              </label>
              <input
                type="text"
                placeholder="Ej: PDTE-6534"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      handleMoveToMQ(value);
                    }
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setMoveToMQModal({ open: false, purchaseIds: [] })}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const input = document.querySelector('input[placeholder*="MQ"]') as HTMLInputElement;
                  const value = input?.value.trim() || '';
                  if (value) {
                    handleMoveToMQ(value);
                  } else {
                    showError('Por favor ingrese un MQ válido');
                  }
                }}
                className="bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700"
              >
                Mover {moveToMQModal.purchaseIds.length} importación(es)
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

