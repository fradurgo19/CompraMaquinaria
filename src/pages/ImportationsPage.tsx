/**
 * Página de Importaciones
 * Solo visible para usuario importaciones@partequipos.com
 * Vista de lista de compras con campos específicos editables
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Package, Truck, MapPin, Eye, Edit, History, Clock } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';

interface ImportationRow {
  id: string;
  machine_id?: string;
  mq: string;
  purchase_type: string;
  condition: string | null; // NUEVO o USADO
  shipment_type_v2: string;
  supplier_name: string;
  brand: string;
  model: string;
  serial: string;
  invoice_date: string;
  payment_date: string;
  location: string;
  port_of_embarkation: string;
  port_of_destination: string;
  shipment_departure_date: string;
  shipment_arrival_date: string;
  nationalization_date: string;
}

export const ImportationsPage = () => {
  const [importations, setImportations] = useState<ImportationRow[]>([]);
  const [filteredData, setFilteredData] = useState<ImportationRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    filterData();
  }, [searchTerm, importations]);

  const loadImportations = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ImportationRow[]>('/api/purchases');
      setImportations(data);
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

    setFilteredData(filtered);
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
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateForInput = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
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

  const requestFieldUpdate = (
    row: ImportationRow,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6 mb-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 opacity-5">
            <Truck className="w-32 h-32 text-gray-400" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-50 rounded-xl">
                <Package className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-gray-600 text-xs font-medium">Gestión de Importaciones</p>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Control de Embarques</h1>
              </div>
            </div>
            <p className="text-base text-gray-600 max-w-2xl">
              Administra fechas de embarque, llegada y nacionalización
            </p>
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
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por modelo, serie o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
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
              <div style={{ width: '3000px', height: '1px' }}></div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div ref={tableScrollRef} className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-brand-red to-primary-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MQ</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">TIPO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase bg-emerald-600">CONDICIÓN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SHIPMENT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PROVEEDOR</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MARCA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MODELO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SERIAL</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">AÑO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA FACTURA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA PAGO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">UBICACIÓN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PUERTO EMBARQUE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE SALIDA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE LLEGADA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PUERTO DE LLEGADA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">NACIONALIZACIÓN</th>
                    <th className="px-2 py-3 text-center text-xs font-semibold text-white uppercase sticky right-0 bg-brand-red z-10" style={{ minWidth: 140 }}>ACCIONES</th>
                  </tr>
                </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={18} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="px-4 py-8 text-center text-gray-500">
                      No hay importaciones registradas
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                        <InlineCell {...buildCellProps(row.id, 'mq')}>
                          <InlineFieldEditor
                            value={row.mq || ''}
                            placeholder="MQ"
                            onSave={(val) => requestFieldUpdate(row, 'mq', 'MQ', val)}
                          />
                        </InlineCell>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span className="text-gray-700">
                          {row.purchase_type === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : (row.purchase_type || '-')}
                        </span>
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
                      
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'shipment_type_v2')}>
                          <span>{row.shipment_type_v2 || '-'}</span>
                        </InlineCell>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">{row.supplier_name || '-'}</span>
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
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'invoice_date')}>
                          <span>{formatDate(row.invoice_date)}</span>
                        </InlineCell>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.payment_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'location')}>
                          <span className="text-gray-700">{row.location || '-'}</span>
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
                            value={row.shipment_departure_date ? new Date(row.shipment_departure_date).toISOString().split('T')[0] : ''}
                            type="date"
                            placeholder="Fecha embarque salida"
                            onSave={(val) =>
                              requestFieldUpdate(
                                row,
                                'shipment_departure_date',
                                'Fecha embarque salida',
                                typeof val === 'string' && val ? new Date(val).toISOString() : null,
                                {
                                  shipment_departure_date: typeof val === 'string' && val ? new Date(val).toISOString() : null,
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
                            value={row.shipment_arrival_date ? new Date(row.shipment_arrival_date).toISOString().split('T')[0] : ''}
                            type="date"
                            placeholder="Fecha embarque llegada"
                            onSave={(val) =>
                              requestFieldUpdate(
                                row,
                                'shipment_arrival_date',
                                'Fecha embarque llegada',
                                typeof val === 'string' && val ? new Date(val).toISOString() : null,
                                {
                                  shipment_arrival_date: typeof val === 'string' && val ? new Date(val).toISOString() : null,
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
                            placeholder="Puerto de destino"
                            onSave={(val) => requestFieldUpdate(row, 'port_of_destination', 'Puerto de destino', val)}
                          />
                        </InlineCell>
                      </td>
                      
                      {/* NACIONALIZACIÓN */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'nationalization_date')}>
                          <InlineFieldEditor
                            value={row.nationalization_date ? new Date(row.nationalization_date).toISOString().split('T')[0] : ''}
                            type="date"
                            placeholder="Fecha nacionalización"
                            onSave={(val) =>
                              requestFieldUpdate(
                                row,
                                'nationalization_date',
                                'Fecha nacionalización',
                                typeof val === 'string' && val ? new Date(val).toISOString() : null,
                                {
                                  nationalization_date: typeof val === 'string' && val ? new Date(val).toISOString() : null,
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
                      <td className="px-2 py-3 text-sm text-gray-700 sticky right-0 bg-white z-10" style={{ minWidth: 140 }}>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleEdit(row)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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
                    </motion.tr>
                  ))
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
                  <p className="text-xs text-gray-500">SHIPMENT</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Embarque Salida</label>
                  <input
                    type="date"
                    value={editData.shipment_departure_date || ''}
                    onChange={(e) => setEditData({ ...editData, shipment_departure_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Embarque Llegada</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nacionalización</label>
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
                <div className="pt-4">
                  <div className="bg-gradient-to-r from-indigo-50 to-gray-50 rounded-xl p-6 border border-indigo-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-3 rounded-lg shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Gestión de Archivos</h3>
                        <p className="text-sm text-gray-600">Fotos y documentos de la máquina en el módulo de Importaciones</p>
                      </div>
                    </div>
                    
                    <MachineFiles 
                      machineId={selectedRow.machine_id} 
                      allowUpload={true} 
                      allowDelete={true}
                      currentScope="IMPORTACIONES"
                      uploadExtraFields={{ scope: 'IMPORTACIONES' }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSave(selectedRow.id)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Guardar cambios
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
      </div>
    </div>
  );
};

