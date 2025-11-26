/**
 * Página de Consolidado - Dashboard Ejecutivo Premium
 * Tabla Digital con todos los campos
 */

import { useState, useEffect, useRef } from 'react';
import { Search, Download, TrendingUp, DollarSign, Package, BarChart3, FileSpreadsheet, Edit, Eye, Wrench, Calculator, FileText, History, Clock } from 'lucide-react';
import { MachineFiles } from '../components/MachineFiles';
import { motion } from 'framer-motion';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { PriceSuggestion } from '../components/PriceSuggestion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Select } from '../atoms/Select';
import { Modal } from '../molecules/Modal';
import { apiGet, apiPut, apiPost } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { useChangeDetection } from '../hooks/useChangeDetection';

export const ManagementPage = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [consolidado, setConsolidado] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [salesStateFilter, setSalesStateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentRow, setCurrentRow] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewRow, setViewRow] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  
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

  // Campos a monitorear para control de cambios
  const MONITORED_FIELDS = {
    inland: 'Inland',
    gastos_pto: 'Gastos Puerto',
    flete: 'Flete',
    traslado: 'Traslado',
    repuestos: 'Repuestos',
    mant_ejec: 'Mantenimiento Ejecutado',
    proyectado: 'Valor Proyectado',
    pvp_est: 'PVP Estimado',
    comentarios: 'Comentarios',
    sales_state: 'Estado de Ventas',
  };

  // Hook de detección de cambios (solo cuando hay datos)
  const { hasChanges, changes } = useChangeDetection(
    currentRow && isEditModalOpen ? currentRow : null, 
    currentRow && isEditModalOpen ? editData : null, 
    MONITORED_FIELDS
  );

  useEffect(() => {
    loadConsolidado();
  }, []);

  const loadConsolidado = async () => {
    setLoading(true);
    try {
      const data = await apiGet<Array<Record<string, unknown>>>('/api/management');
      setConsolidado(data);
    } catch (err) {
      console.error('Error cargando consolidado:', err);
      showError('Error al cargar el consolidado');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = consolidado
    .filter((item) => {
      // Solo USADOS en Consolidado (filtrar NUEVO y NULL que venga de new_purchases)
      const condition = item.condition || 'USADO';
      return condition === 'USADO';
    })
    .filter((item) => {
      if (salesStateFilter && item.sales_state !== salesStateFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          item.model?.toLowerCase().includes(search) ||
          item.serial?.toLowerCase().includes(search)
        );
      }
      return true;
    });

  // Función helper para convertir valores a número
  const toNumber = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined || value === '') return 0;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? 0 : num;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEdit = (row: Record<string, any>) => {
    setCurrentRow(row);
    setEditData({
      sales_state: row.sales_state,
      inland: row.inland,
      gastos_pto: row.gastos_pto,
      flete: row.flete,
      traslado: row.traslado,
      repuestos: row.repuestos,
      mant_ejec: row.mant_ejec,
      proyectado: row.proyectado,
      pvp_est: row.pvp_est,
      comentarios: row.comentarios,
    });
    setIsEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!currentRow) return;

    // Si hay cambios, mostrar modal de control de cambios
    if (hasChanges && changes.length > 0) {
      setPendingUpdate({ id: currentRow.id, data: editData });
      setShowChangeModal(true);
      return;
    }

    // Si no hay cambios, guardar directamente
    await saveChanges();
  };

  const saveChanges = async (changeReason?: string) => {
    const id = pendingUpdate?.id || currentRow?.id;
    const data = pendingUpdate?.data || editData;

    try {
      await apiPut(`/api/management/${id}`, data);

      // Registrar cambios en el log si hay
      if (hasChanges && changes.length > 0) {
        try {
          await apiPost('/api/change-logs', {
            table_name: 'purchases',
            record_id: id,
            changes,
            change_reason: changeReason || null,
            module_name: 'management',
          });
          console.log(`📝 ${changes.length} cambios registrados en Consolidado`);
        } catch (logError) {
          console.error('Error registrando cambios:', logError);
        }
      }

      setIsEditModalOpen(false);
      setShowChangeModal(false);
      setCurrentRow(null);
      setEditData({});
      setPendingUpdate(null);
      await loadConsolidado();
      showSuccess('Registro actualizado correctamente');
    } catch {
      showError('Error al actualizar el registro');
    }
  };

  // Ver registro (modal de vista)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleView = (row: Record<string, any>) => {
    setViewRow(row);
    setIsViewModalOpen(true);
  };

  const closeView = () => {
    setIsViewModalOpen(false);
    setViewRow(null);
  };

  const handleCancel = () => {
    setIsEditModalOpen(false);
    setCurrentRow(null);
    setEditData({});
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

  const formatCurrency = (value: number | null | undefined | string) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    const fixedValue = parseFloat(numValue.toFixed(2));
    return `$${fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const formatNumber = (value: number | null | undefined | string) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    const fixedValue = parseFloat(numValue.toFixed(2));
    return fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      'management': 'Consolidado',
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
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('management');
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

  const handleConfirmInlineChange = async (reason?: string) => {
    const pending = pendingChangeRef.current;
    if (!pending) return;
    try {
      await apiPut(`/api/management/${pending.recordId}`, pending.updates);
      await apiPost('/api/change-logs', {
        table_name: 'purchases',
        record_id: pending.recordId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'management',
      });
      await loadChangeIndicators([pending.recordId]);
      showSuccess('Dato actualizado correctamente');
      await loadConsolidado();
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
    record: Record<string, any>,
    fieldName: string
  ): string | number | boolean | null => {
    const value = record[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    row: Record<string, any>,
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

  const requestFieldUpdate = (
    row: Record<string, any>,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>
  ) => {
    const currentValue = getRecordFieldValue(row, fieldName);
    return beginInlineChange(
      row,
      fieldName,
      fieldLabel,
      currentValue,
      newValue,
      updates ?? { [fieldName]: newValue }
    );
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
    if (consolidado.length === 0) return;
    
    try {
      const idsToLoad = recordIds || consolidado.map(c => c.id as string);
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
    if (!loading && consolidado.length > 0) {
      loadChangeIndicators();
    }
  }, [consolidado, loading]);

  // Funciones helper para estilos de colores
  const getShipmentStyle = (shipment: string | null | undefined) => {
    if (!shipment) return 'text-gray-400';
    const upperShipment = shipment.toUpperCase();
    if (upperShipment.includes('RORO')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
    } else if (upperShipment.includes('1X40')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md';
    }
    return 'text-gray-700';
  };

  const getTipoCompraStyle = (tipoCompra: string | null | undefined) => {
    if (!tipoCompra) return 'text-gray-400';
    const upperTipo = tipoCompra.toUpperCase();
    if (upperTipo.includes('SUBASTA')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md';
    } else if (upperTipo.includes('COMPRA_DIRECTA') || upperTipo.includes('COMPRA DIRECTA')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md';
    }
    return 'text-gray-700';
  };

  const getIncotermStyle = (incoterm: string | null | undefined) => {
    if (!incoterm) return 'text-gray-400';
    const upperIncoterm = incoterm.toUpperCase();
    if (upperIncoterm === 'EXW') {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md';
    } else if (upperIncoterm === 'FOB') {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md';
    }
    return 'text-gray-700';
  };

  // Funciones helper para estilos elegantes de datos básicos
  const getModeloStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md whitespace-nowrap';
  };

  const getSerialStyle = (serial: string | null | undefined) => {
    if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
  };

  const getYearStyle = (year: number | string | null | undefined) => {
    if (!year || year === '-' || year === '') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md';
  };

  const getHoursStyle = (hours: number | string | null | undefined) => {
    if (!hours || hours === '-' || hours === '' || hours === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-md';
  };

  const getProveedorStyle = (proveedor: string | null | undefined) => {
    if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md whitespace-nowrap';
  };

  const getMarcaStyle = (marca: string | null | undefined) => {
    if (!marca || marca === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
  };

  // Función para determinar el color de fondo de la fila según la completitud de datos
  const getRowBackgroundByCompleteness = (row: any) => {
    // Campos a validar (deben tener valores > 0 y no ser null/undefined/vacío)
    const fieldsToCheck = [
      'gastos_pto',
      'flete',
      'traslado',
      'repuestos',
      'mant_ejec',
      'inland',
      'proyectado',
      'pvp_est',
      'comentarios'
    ];

    // Verificar si todos los campos tienen valores válidos
    const allFieldsComplete = fieldsToCheck.every(field => {
      const value = row[field];
      
      // Para comentarios, solo verificar que no esté vacío
      if (field === 'comentarios') {
        return value && value !== '' && value !== '-' && value !== null && value !== undefined;
      }
      
      // Para campos numéricos, verificar que sean > 0
      if (value === null || value === undefined || value === '' || value === '-') {
        return false;
      }
      
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      return !isNaN(numValue) && numValue > 0;
    });

    // Fondo blanco para todas las filas (consistente con compras)
    return 'bg-white hover:bg-gray-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-gray-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-brand-red via-primary-600 to-brand-gray rounded-2xl shadow-2xl p-4 md:p-6 mb-6 text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 opacity-10">
            <BarChart3 className="w-32 h-32" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <p className="text-white/80 text-xs font-medium">Vista Ejecutiva</p>
                <h1 className="text-2xl md:text-3xl font-bold">Consolidado General</h1>
              </div>
            </div>
            <p className="text-base text-white/90 max-w-2xl">
              Control financiero integral con actualización automática desde subastas y compras
            </p>
          </div>
        </motion.div>

        {/* Tabla Consolidado */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            {/* Toolbar */}
            <div className="mb-6">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Tabla Consolidado</h2>
                <div className="flex gap-3">
            <Button
                    variant="secondary"
              size="sm"
                    onClick={() => showSuccess('Exportando a Excel...')}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar Excel
            </Button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por modelo o serial..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                    />
                  </div>
                </div>

                <Select
                  value={salesStateFilter}
                  onChange={(e) => setSalesStateFilter(e.target.value)}
                  options={[
                    { value: '', label: 'Todos los estados' },
                    { value: 'OK', label: '✓ OK' },
                    { value: 'X', label: '✗ X' },
                    { value: 'BLANCO', label: '○ Pendiente' },
                  ]}
                  className="min-w-[180px]"
                />
              </div>
            </div>

            {/* Barra de Scroll Superior - Sincronizada */}
            <div className="mb-3">
              <div 
                ref={topScrollRef}
                className="overflow-x-auto bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
                style={{ height: '14px' }}
              >
                <div style={{ width: '3500px', height: '1px' }}></div>
              </div>
            </div>

            {/* Tabla con scroll horizontal */}
            <div ref={tableScrollRef} className="overflow-x-auto">
              <table className="w-full min-w-[2000px]">
                <thead className="bg-gradient-to-r from-brand-red to-primary-600 text-white">
                  <tr>
                    {/* Datos principales */}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">PROVEEDOR</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">MARCA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">MODELO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">SERIAL</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">AÑO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">HORAS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-emerald-600">CONDICIÓN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Tipo Compra</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Incoterm</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">SHIPMENT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-red-600">CRCY</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Tasa</th>
                    
                    {/* CAMPOS FINANCIEROS */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-brand-red/20">PRECIO</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Inland</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CIF USD</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CIF Local</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Gastos Pto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Flete</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Traslado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Repuestos</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Mant. Ejec.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Cost. Arancel</th>
                    
                    {/* CAMPOS MANUALES - Proyecciones */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-yellow-500/20">
                      <div className="flex items-center gap-1 justify-end">
                        Proyectado
                        <span className="text-yellow-300" title="Campo manual">✎</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-yellow-500/20">
                      <div className="flex items-center gap-1 justify-end">
                        PVP Est.
                        <span className="text-yellow-300" title="Campo manual">✎</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-yellow-500/20">
                      <div className="flex items-center gap-1">
                        Comentarios
                        <span className="text-yellow-300" title="Campo manual">✎</span>
                      </div>
                    </th>
                    
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase sticky right-0 bg-brand-red">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={34} className="px-4 py-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-red border-t-transparent"></div>
                        <p className="text-gray-600 mt-4">Cargando consolidado...</p>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={34} className="px-4 py-12 text-center">
                        <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-lg">No hay datos en el consolidado</p>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row, index) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`transition-colors ${getRowBackgroundByCompleteness(row)}`}
                      >
                        {/* Datos principales */}
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          <span className="font-semibold text-gray-900">{row.supplier || '-'}</span>
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
                          <span className="text-gray-700">{row.year || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-700">
                            {row.hours ? row.hours.toLocaleString('es-CO') : '-'}
                            </span>
                        </td>
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
                          <span className="text-gray-700">
                            {row.tipo_compra === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : (row.tipo_compra || '-')}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-700">{row.tipo_incoterm || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-700">{row.shipment || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.currency || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatNumber(row.tasa)}
                        </td>

                        {/* CAMPOS FINANCIEROS */}
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.precio_fob)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <InlineCell {...buildCellProps(row.id as string, 'inland')}>
                            <InlineFieldEditor
                              type="number"
                              value={toNumber(row.inland) || ''}
                              placeholder="0"
                              displayFormatter={() => formatCurrency(row.inland)}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'inland', 'Inland', numeric);
                              }}
                            />
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.cif_usd)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(row.cif_local)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <InlineCell {...buildCellProps(row.id as string, 'gastos_pto')}>
                            <InlineFieldEditor
                              type="number"
                              value={toNumber(row.gastos_pto) || ''}
                              placeholder="0"
                              displayFormatter={() => formatCurrency(row.gastos_pto)}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'gastos_pto', 'Gastos Puerto', numeric);
                              }}
                            />
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <InlineCell {...buildCellProps(row.id as string, 'flete')}>
                            <InlineFieldEditor
                              type="number"
                              value={toNumber(row.flete) || ''}
                              placeholder="0"
                              displayFormatter={() => formatCurrency(row.flete)}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'flete', 'Flete', numeric);
                              }}
                            />
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <InlineCell {...buildCellProps(row.id as string, 'traslado')}>
                            <InlineFieldEditor
                              type="number"
                              value={toNumber(row.traslado) || ''}
                              placeholder="0"
                              displayFormatter={() => formatCurrency(row.traslado)}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'traslado', 'Traslado', numeric);
                              }}
                            />
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <InlineCell {...buildCellProps(row.id as string, 'repuestos')}>
                            <InlineFieldEditor
                              type="number"
                              value={toNumber(row.repuestos) || ''}
                              placeholder="0"
                              displayFormatter={() => formatCurrency(row.repuestos)}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'repuestos', 'Repuestos', numeric);
                              }}
                            />
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <InlineCell {...buildCellProps(row.id as string, 'mant_ejec')}>
                            <InlineFieldEditor
                              type="number"
                              value={toNumber(row.mant_ejec) || ''}
                              placeholder="0"
                              displayFormatter={() => formatCurrency(row.mant_ejec)}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'mant_ejec', 'Mantenimiento Ejecutado', numeric);
                              }}
                            />
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(row.cost_arancel)}</td>

                        {/* CAMPOS MANUALES: Proyecciones */}
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <InlineCell {...buildCellProps(row.id as string, 'proyectado')}>
                            <InlineFieldEditor
                              type="number"
                              value={toNumber(row.proyectado) || ''}
                              placeholder="0"
                              displayFormatter={() => formatCurrency(row.proyectado)}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'proyectado', 'Valor Proyectado', numeric);
                              }}
                            />
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <InlineCell {...buildCellProps(row.id as string, 'pvp_est')}>
                            <InlineFieldEditor
                              type="number"
                              value={toNumber(row.pvp_est) || ''}
                              placeholder="0"
                              displayFormatter={() => formatCurrency(row.pvp_est)}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'pvp_est', 'PVP Estimado', numeric);
                              }}
                            />
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <InlineCell {...buildCellProps(row.id as string, 'comentarios')}>
                            <InlineFieldEditor
                              value={row.comentarios || ''}
                              placeholder="Comentarios"
                              onSave={(val) => requestFieldUpdate(row, 'comentarios', 'Comentarios', val)}
                            />
                          </InlineCell>
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 sticky right-0 bg-white border-l-2 border-gray-200">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleView(row)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(row)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setCurrentRow(row);
                                setIsHistoryOpen(true);
                              }}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Historial de cambios"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
      </Card>
        </motion.div>

        {/* Modal de Edición */}
      <Modal
          isOpen={isEditModalOpen}
          onClose={handleCancel}
          title="Editar Registro - Consolidado General"
        size="xl"
      >
          {currentRow && (
            <div className="space-y-6">
              {/* Encabezado registro - Diseño Premium */}
              <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 p-6 rounded-xl text-white shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-red-100 mb-1">Editando Equipo</p>
                    <p className="text-lg font-bold">
                      {currentRow.model} - S/N {currentRow.serial}
                    </p>
                  </div>
                </div>
              </div>

              {/* Resumen de valores - Tarjetas Premium */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-indigo-600" />
                    <p className="text-xs font-semibold text-indigo-700">PRECIO</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-700">{formatCurrency(currentRow.precio_fob)}</p>
                </div>
                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    <p className="text-xs font-semibold text-purple-700">CIF USD</p>
                  </div>
                  <p className="text-2xl font-bold text-purple-700">{formatCurrency(currentRow.cif_usd)}</p>
                </div>
                <div className="p-5 rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-300 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-[#50504f]" />
                    <p className="text-xs font-semibold text-[#50504f]">CIF LOCAL</p>
                  </div>
                  <p className="text-2xl font-bold text-[#50504f]">{formatCurrency(currentRow.cif_local)}</p>
                </div>
              </div>

              {/* Estado de venta - Card Destacada */}
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-5 rounded-xl border border-yellow-200">
                <label className="block text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Estado de Venta
                </label>
                <select
                  value={editData.sales_state || ''}
                  onChange={(e) => setEditData({...editData, sales_state: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white text-lg font-semibold"
                >
                  <option value="">Seleccionar estado...</option>
                  <option value="OK">✅ OK</option>
                  <option value="X">❌ X</option>
                  <option value="BLANCO">⚪ BLANCO</option>
                </select>
              </div>

              {/* GASTOS - Sección Premium */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200">
                <h4 className="text-sm font-semibold text-indigo-800 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  GASTOS OPERACIONALES
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      💰 Inland
                    </label>
                    <input type="number" value={editData.inland || ''} onChange={(e) => setEditData({...editData, inland: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      🚢 Gastos Pto
                    </label>
                    <input type="number" value={editData.gastos_pto || ''} onChange={(e) => setEditData({...editData, gastos_pto: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      📦 Flete
                    </label>
                    <input type="number" value={editData.flete || ''} onChange={(e) => setEditData({...editData, flete: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      🚚 Traslado
                    </label>
                    <input type="number" value={editData.traslado || ''} onChange={(e) => setEditData({...editData, traslado: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      🔧 Repuestos
                    </label>
                    <input type="number" value={editData.repuestos || ''} onChange={(e) => setEditData({...editData, repuestos: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                    
                    {/* Sugerencia de Repuestos */}
                    {currentRow && currentRow.model && (
                      <div className="mt-3">
                        <PriceSuggestion
                          type="repuestos"
                          model={currentRow.model}
                          year={currentRow.year}
                          hours={currentRow.hours}
                          autoFetch={true}
                          onApply={(value) => setEditData({...editData, repuestos: value})}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      ⚙️ Mant. Ejec.
                    </label>
                    <input type="number" value={editData.mant_ejec || ''} onChange={(e) => setEditData({...editData, mant_ejec: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* ARANCEL Y VENTA - Sección Premium */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-xl border border-green-200">
                <h4 className="text-sm font-semibold text-green-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  PROYECCIÓN Y VENTA
                </h4>
                
                {/* Costo Arancel - Solo lectura */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 rounded-xl bg-white border-2 border-green-300 shadow-sm">
                    <p className="text-xs text-green-700 font-semibold mb-1">Costo Arancel (Automático)</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(currentRow.cost_arancel)}</p>
                  </div>
                </div>
                
                {/* Campos editables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                      📊 Proyectado
                    </label>
                    <input type="number" value={editData.proyectado || ''} onChange={(e) => setEditData({...editData, proyectado: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white text-lg font-semibold" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                      💵 PVP Estimado
                    </label>
                    <input type="number" value={editData.pvp_est || ''} onChange={(e) => setEditData({...editData, pvp_est: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white text-lg font-semibold" placeholder="0.00" />
                    
                    {/* Sugerencia de PVP Estimado */}
                    {currentRow && currentRow.model && (
                      <div className="mt-3">
                        <PriceSuggestion
                          type="pvp"
                          model={currentRow.model}
                          year={currentRow.year}
                          hours={currentRow.hours}
                          costoArancel={currentRow.cost_arancel}
                          autoFetch={true}
                          onApply={(value) => setEditData({...editData, pvp_est: value})}
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Comentarios */}
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    📝 Comentarios
                  </label>
                  <textarea value={editData.comentarios || ''} onChange={(e) => setEditData({...editData, comentarios: e.target.value})} rows={4} className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="Ingrese observaciones del equipo..." />
                </div>
              </div>

              {/* Archivos de la Máquina (subir / eliminar) */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Archivos de la Máquina</h4>
                <div className="p-4 rounded-xl border bg-white">
                  <MachineFiles machineId={currentRow.machine_id} allowUpload={true} />
                </div>
              </div>

              {/* Botones - Diseño Empresarial */}
              <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-200">
                <Button variant="secondary" onClick={handleCancel} className="px-8 py-3 text-base bg-gray-100 hover:bg-gray-200 text-[#50504f] font-semibold">
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="px-8 py-3 text-base bg-gradient-to-r from-[#cf1b22] to-red-700 hover:from-red-800 hover:to-red-900 text-white font-semibold shadow-lg">
                  💾 Guardar Cambios
                </Button>
              </div>
            </div>
        )}
      </Modal>
      
      {/* Modal de Vista (Ver) */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={closeView}
        title="Ver Registro - Consolidado"
        size="xl"
      >
        {viewRow && (
          <div className="space-y-6">
            {/* DATOS DE LA MAQUINA */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-700" /> DATOS DE LA MAQUINA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">PROVEEDOR</p>
                  <p className="text-sm font-semibold">{viewRow.supplier || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Modelo</p>
                  <p className="text-sm font-semibold">{viewRow.model || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Serial</p>
                  <p className="text-sm font-semibold font-mono">{viewRow.serial || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Año</p>
                  <p className="text-sm font-semibold">{viewRow.year || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Horas</p>
                  <p className="text-sm font-semibold">{viewRow.hours ? Number(viewRow.hours).toLocaleString('es-CO') : '-'}</p>
                </div>
              </div>
            </div>

            {/* TIPO Y VALOR DE COMPRA */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-indigo-600" /> TIPO Y VALOR DE COMPRA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 rounded-xl border">
                <div>
                  <p className="text-xs text-gray-500">Tipo Compra</p>
                  <p className="text-sm font-semibold">{viewRow.tipo_compra || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Incoterm</p>
                  <p className="text-sm font-semibold">{viewRow.tipo_incoterm || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CRCY</p>
                  <p className="text-sm font-semibold text-red-600">{viewRow.currency || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tasa</p>
                  <p className="text-sm font-semibold">{formatNumber(viewRow.tasa)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">PRECIO</p>
                  <p className="text-sm font-bold text-indigo-700">{formatCurrency(viewRow.precio_fob)}</p>
                </div>
              </div>
            </div>

            {/* CIF */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" /> CIF
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">CIF USD</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.cif_usd)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CIF Local</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.cif_local)}</p>
                </div>
              </div>
            </div>

            {/* GASTOS */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" /> GASTOS
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border">
                <div>
                  <p className="text-xs text-gray-500">Inland</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.inland)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gastos Pto</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.gastos_pto)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Flete</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.flete)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Traslado</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.traslado)}</p>
                </div>
              </div>
            </div>

            {/* REPARACIÓN */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-gray-700" /> REPARACIÓN
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">Repuestos</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.repuestos)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Mant. Ejec.</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.mant_ejec)}</p>
                </div>
              </div>
            </div>

            {/* TOTAL GASTO */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-green-700" /> TOTAL GASTO
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border">
                <div>
                  <p className="text-xs text-gray-500">Total Gasto</p>
                  <p className="text-sm font-bold text-green-700">
                    {(() => {
                      const sum = (val: unknown) => {
                        const v = typeof val === 'string' ? parseFloat(val) : (val as number) || 0;
                        return isNaN(v) ? 0 : v;
                      };
                      const total = sum(viewRow.inland) + sum(viewRow.gastos_pto) + sum(viewRow.flete) + sum(viewRow.traslado) + sum(viewRow.repuestos) + sum(viewRow.mant_ejec);
                      return total > 0 ? `$${total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cost. Arancel</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.cost_arancel)}</p>
                </div>
              </div>
            </div>

            {/* VENTA */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> VENTA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">Proyectado</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.proyectado)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">PVP Est.</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.pvp_est)}</p>
                </div>
              </div>
            </div>

            {/* COMENTARIOS */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-700" /> COMENTARIOS
              </h3>
              <div className="p-4 rounded-xl border">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewRow.comentarios || '-'}</p>
              </div>
            </div>

            {/* Archivos */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-700" /> Archivos de la Máquina
              </h3>
              <div className="p-4 rounded-xl border bg-white">
                <MachineFiles machineId={viewRow.machine_id} allowUpload={false} />
              </div>
            </div>
          </div>
        )}
      </Modal>

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
        }}
      />

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

      {/* Modal de Historial */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Historial de Cambios - Todos los Módulos"
        size="lg"
      >
        {currentRow && (
          <ChangeHistory 
            tableName="purchases" 
            recordId={currentRow.id}
            purchaseId={currentRow.id}
          />
        )}
      </Modal>
      </div>
    </div>
  );
};
