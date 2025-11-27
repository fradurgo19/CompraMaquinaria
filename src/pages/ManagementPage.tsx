/**
 * Página de Consolidado - Dashboard Ejecutivo Premium
 * Tabla Digital con todos los campos
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Download, TrendingUp, DollarSign, Package, BarChart3, FileSpreadsheet, Edit, Eye, Wrench, Calculator, FileText, History, Clock, Sparkles, Plus } from 'lucide-react';
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
import { AUCTION_SUPPLIERS } from '../organisms/PreselectionForm';
import { BRAND_OPTIONS } from '../constants/brands';
import { MODEL_OPTIONS } from '../constants/models';

export const ManagementPage = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [consolidado, setConsolidado] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // Filtros de columnas
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [serialFilter, setSerialFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [hoursFilter, setHoursFilter] = useState('');
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
  const [creatingNewRow, setCreatingNewRow] = useState(false);
  
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

  // Opciones para selects de compras directas
  const supplierOptions = useMemo(
    () => AUCTION_SUPPLIERS.map((s) => ({ value: s, label: s })),
    []
  );
  const brandOptions = useMemo(
    () => BRAND_OPTIONS.map((b) => ({ value: b, label: b })),
    []
  );
  const modelOptions = useMemo(
    () => MODEL_OPTIONS.map((m) => ({ value: m, label: m })),
    []
  );

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
    repuestos: 'PPTO Reparación',
    service_value: 'Valor Servicio',
    inland_verified: 'Inland Verificado',
    gastos_pto_verified: 'Gastos Puerto Verificado',
    flete_verified: 'Flete Verificado',
    traslado_verified: 'Traslado Verificado',
    repuestos_verified: 'PPTO Reparación Verificado',
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

  // Valores únicos para filtros de columnas
  const uniqueSuppliers = [...new Set(consolidado.map(item => item.supplier).filter(Boolean))].sort();
  const uniqueBrands = [...new Set(consolidado.map(item => item.brand).filter(Boolean))].sort();
  const uniqueModels = [...new Set(consolidado.map(item => item.model).filter(Boolean))].sort();
  const uniqueSerials = [...new Set(consolidado.map(item => item.serial).filter(Boolean))].sort();
  const uniqueYears = [...new Set(consolidado.map(item => item.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const uniqueHours = [...new Set(consolidado.map(item => item.hours).filter(Boolean))].sort((a, b) => Number(a) - Number(b));

  const filteredData = consolidado
    .filter((item) => {
      // Solo USADOS en Consolidado (filtrar NUEVO y NULL que venga de new_purchases)
      const condition = item.condition || 'USADO';
      return condition === 'USADO';
    })
    .filter((item) => {
      // Filtros de columnas
      if (supplierFilter && item.supplier !== supplierFilter) return false;
      if (brandFilter && item.brand !== brandFilter) return false;
      if (modelFilter && item.model !== modelFilter) return false;
      if (serialFilter && item.serial !== serialFilter) return false;
      if (yearFilter && String(item.year) !== yearFilter) return false;
      if (hoursFilter && String(item.hours) !== hoursFilter) return false;
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
      service_value: row.service_value,
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

  // Crear nueva fila de compra directa
  const handleCreateNewRow = async () => {
    setCreatingNewRow(true);
    try {
      const result = await apiPost('/api/purchases/direct', {
        supplier_name: 'Nuevo Proveedor',
        brand: 'Marca',
        model: 'Modelo',
        serial: `NUEVO-${Date.now()}`,
        condition: 'USADO',
        incoterm: 'EXW',
        currency_type: 'USD',
      });
      await loadConsolidado();
      showSuccess('Nuevo registro creado. Edite los campos directamente en la tabla.');
    } catch (error) {
      console.error('Error al crear registro:', error);
      showError('Error al crear el registro');
    } finally {
      setCreatingNewRow(false);
    }
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

  // Actualizar campos de compras directas (supplier, brand, model, serial, year, hours)
  const handleDirectPurchaseFieldUpdate = async (
    row: Record<string, any>,
    fieldName: string,
    newValue: string | number | null
  ) => {
    try {
      // Campos que van a machines
      const machineFields = ['brand', 'model', 'serial', 'year', 'hours'];
      // Campos que van a suppliers (solo supplier_name)
      
      if (machineFields.includes(fieldName)) {
        // Actualizar en machines via purchases
        await apiPut(`/api/purchases/${row.id}/machine`, { [fieldName]: newValue });
      } else if (fieldName === 'supplier_name') {
        // Actualizar supplier
        await apiPut(`/api/purchases/${row.id}/supplier`, { supplier_name: newValue });
      }
      
      // Actualizar estado local
      setConsolidado(prev => prev.map(r => 
        r.id === row.id 
          ? { ...r, [fieldName === 'supplier_name' ? 'supplier' : fieldName]: newValue }
          : r
      ));
      showSuccess('Campo actualizado correctamente');
    } catch (error) {
      console.error('Error actualizando campo:', error);
      showError('Error al actualizar el campo');
    }
  };

  const buildCellProps = (recordId: string, field: string) => ({
    recordId,
    fieldName: field,
    indicators: getFieldIndicators(inlineChangeIndicators, recordId, field),
    openPopover: openChangePopover,
    onIndicatorClick: handleIndicatorClick,
  });

  // Cargar indicadores de cambios (de purchases y service_records)
  const loadChangeIndicators = async (recordIds?: string[]) => {
    if (consolidado.length === 0) return;
    
    try {
      const idsToLoad = recordIds || consolidado.map(c => c.id as string);
      
      // Cargar cambios de purchases
      const purchaseResponse = await apiPost<Record<string, Array<{
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
      
      // Cargar cambios de service_records
      const serviceRecordIds = consolidado
        .filter(c => c.service_record_id)
        .map(c => c.service_record_id as string);
      
      let serviceResponse: Record<string, Array<{
        id: string;
        field_name: string;
        field_label: string;
        old_value: string | number | null;
        new_value: string | number | null;
        change_reason: string | null;
        changed_at: string;
        module_name: string | null;
      }>> = {};
      
      if (serviceRecordIds.length > 0) {
        serviceResponse = await apiPost<typeof serviceResponse>('/api/change-logs/batch', {
          table_name: 'service_records',
          record_ids: serviceRecordIds,
        });
      }
      
      // Crear mapa de service_record_id a purchase_id
      const serviceTourchaseMap: Record<string, string> = {};
      consolidado.forEach(c => {
        if (c.service_record_id) {
          serviceTourchaseMap[c.service_record_id as string] = c.id as string;
        }
      });
      
      const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
      
      // Procesar cambios de purchases
      Object.entries(purchaseResponse).forEach(([recordId, changes]) => {
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
      
      // Procesar cambios de service_records y asociarlos al purchase correspondiente
      Object.entries(serviceResponse).forEach(([serviceRecordId, changes]) => {
        const purchaseId = serviceTourchaseMap[serviceRecordId];
        if (purchaseId && changes && changes.length > 0) {
          const serviceChanges = changes.slice(0, 10).map((change) => ({
            id: change.id,
            fieldName: change.field_name,
            fieldLabel: change.field_label,
            oldValue: change.old_value,
            newValue: change.new_value,
            reason: change.change_reason || undefined,
            changedAt: change.changed_at,
            moduleName: change.module_name || null,
          }));
          
          if (indicatorsMap[purchaseId]) {
            indicatorsMap[purchaseId] = [...indicatorsMap[purchaseId], ...serviceChanges];
          } else {
            indicatorsMap[purchaseId] = serviceChanges;
          }
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
      'service_value',
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
                    size="sm"
                    onClick={handleCreateNewRow}
                    disabled={creatingNewRow}
                    className="flex items-center gap-2 bg-[#cf1b22] hover:bg-[#a81820] text-white"
                  >
                    <Plus className="w-4 h-4" />
                    {creatingNewRow ? 'Creando...' : '+'}
                  </Button>
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
                    {/* Datos principales con filtros */}
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[140px]">
                      <div className="mb-1">PROVEEDOR</div>
                      <select
                        value={supplierFilter}
                        onChange={(e) => setSupplierFilter(e.target.value)}
                        className="w-full min-w-[120px] px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueSuppliers.map(s => <option key={String(s)} value={String(s)}>{String(s)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[120px]">
                      <div className="mb-1">MARCA</div>
                      <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="w-full min-w-[100px] px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueBrands.map(b => <option key={String(b)} value={String(b)}>{String(b)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[140px]">
                      <div className="mb-1">MODELO</div>
                      <select
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        className="w-full min-w-[120px] px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueModels.map(m => <option key={String(m)} value={String(m)}>{String(m)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[120px]">
                      <div className="mb-1">SERIAL</div>
                      <select
                        value={serialFilter}
                        onChange={(e) => setSerialFilter(e.target.value)}
                        className="w-full min-w-[100px] px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueSerials.map(s => <option key={String(s)} value={String(s)}>{String(s)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[100px]">
                      <div className="mb-1">AÑO</div>
                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="w-full min-w-[80px] px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueYears.map(y => <option key={String(y)} value={String(y)}>{String(y)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[100px]">
                      <div className="mb-1">HORAS</div>
                      <select
                        value={hoursFilter}
                        onChange={(e) => setHoursFilter(e.target.value)}
                        className="w-full min-w-[80px] px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueHours.map(h => <option key={String(h)} value={String(h)}>{String(h)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-emerald-600">CONDICIÓN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Tipo Compra</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">INCOTERM DE COMPRA</th>
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
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">PPTO DE REPARACION</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">VALOR SERVICIO</th>
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
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={row.supplier || ''}
                              onSave={(val) => handleDirectPurchaseFieldUpdate(row, 'supplier_name', val)}
                              type="select"
                              placeholder="Proveedor"
                              options={supplierOptions}
                            />
                          ) : (
                            <span className="font-semibold text-gray-900">{row.supplier || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={row.brand || ''}
                              onSave={(val) => handleDirectPurchaseFieldUpdate(row, 'brand', val)}
                              type="select"
                              placeholder="Marca"
                              options={brandOptions}
                            />
                          ) : (
                            <span className="text-gray-800 uppercase tracking-wide">{row.brand || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={row.model || ''}
                              onSave={(val) => handleDirectPurchaseFieldUpdate(row, 'model', val)}
                              type="select"
                              placeholder="Modelo"
                              options={modelOptions}
                            />
                          ) : (
                            <span className="text-gray-800">{row.model || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={row.serial || ''}
                              onSave={(val) => handleDirectPurchaseFieldUpdate(row, 'serial', val)}
                              type="text"
                              placeholder="Serial"
                            />
                          ) : (
                            <span className="text-gray-800 font-mono">{row.serial || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={row.year || ''}
                              onSave={(val) => handleDirectPurchaseFieldUpdate(row, 'year', val)}
                              type="number"
                              placeholder="Año"
                            />
                          ) : (
                            <span className="text-gray-700">{row.year || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={row.hours || ''}
                              onSave={(val) => handleDirectPurchaseFieldUpdate(row, 'hours', val)}
                              type="number"
                              placeholder="Horas"
                            />
                          ) : (
                            <span className="text-gray-700">
                              {row.hours ? row.hours.toLocaleString('es-CO') : '-'}
                            </span>
                          )}
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
                          <InlineCell {...buildCellProps(row.id as string, 'incoterm')}>
                            <span className="text-gray-700">{row.tipo_incoterm || '-'}</span>
                          </InlineCell>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-700">{row.shipment || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.currency || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatNumber(row.tasa)}
                        </td>

                        {/* CAMPOS FINANCIEROS */}
                        <td className={`px-4 py-3 text-sm text-right ${
                          toNumber(row.precio_fob) > 0
                            ? (row.fob_total_verified || row.cif_usd_verified)
                              ? 'bg-green-100 text-green-800 font-semibold'
                              : 'text-gray-700'
                            : 'text-gray-700'
                        }`}>
                          {/* Mostrar indicadores de CIF o de los componentes de FOB */}
                          <div className="flex items-center justify-end gap-1">
                            <InlineCell {...buildCellProps(row.id as string, 'cif_usd')}>
                              <InlineCell {...buildCellProps(row.id as string, 'exw_value_formatted')}>
                                <InlineCell {...buildCellProps(row.id as string, 'fob_expenses')}>
                                  <InlineCell {...buildCellProps(row.id as string, 'disassembly_load_value')}>
                                    {formatCurrency(row.precio_fob)}
                                  </InlineCell>
                                </InlineCell>
                              </InlineCell>
                            </InlineCell>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${
                          toNumber(row.inland) > 0 
                            ? row.inland_verified 
                              ? 'bg-green-100' 
                              : 'bg-yellow-100'
                            : ''
                        }`}>
                          <div className="flex items-center justify-end gap-2">
                            <InlineCell {...buildCellProps(row.id as string, 'inland')}>
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.inland) || ''}
                                placeholder="0"
                                displayFormatter={() => formatCurrency(row.inland)}
                                onSave={(val) => {
                                  const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                  return requestFieldUpdate(row, 'inland', 'Inland', numeric, { inland_verified: false });
                                }}
                              />
                            </InlineCell>
                            {toNumber(row.inland) > 0 && (
                              <button
                                onClick={() => requestFieldUpdate(row, 'inland_verified', 'Inland Verificado', !row.inland_verified)}
                                className={`p-1 rounded ${row.inland_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                title={row.inland_verified ? 'Verificado' : 'Marcar como verificado'}
                              >
                                {row.inland_verified ? '✓' : '○'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.cif_usd)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(row.cif_local)}</td>
                        <td className={`px-4 py-3 text-sm text-right ${
                          toNumber(row.gastos_pto) > 0 
                            ? row.gastos_pto_verified 
                              ? 'bg-green-100' 
                              : 'bg-yellow-100'
                            : ''
                        }`}>
                          <div className="flex items-center justify-end gap-2">
                            <InlineCell {...buildCellProps(row.id as string, 'gastos_pto')}>
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.gastos_pto) || ''}
                                placeholder="0"
                                displayFormatter={() => formatCurrency(row.gastos_pto)}
                                onSave={(val) => {
                                  const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                  return requestFieldUpdate(row, 'gastos_pto', 'Gastos Puerto', numeric, { gastos_pto_verified: false });
                                }}
                              />
                            </InlineCell>
                            {toNumber(row.gastos_pto) > 0 && (
                              <button
                                onClick={() => requestFieldUpdate(row, 'gastos_pto_verified', 'Gastos Puerto Verificado', !row.gastos_pto_verified)}
                                className={`p-1 rounded ${row.gastos_pto_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                title={row.gastos_pto_verified ? 'Verificado' : 'Marcar como verificado'}
                              >
                                {row.gastos_pto_verified ? '✓' : '○'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${
                          toNumber(row.flete) > 0 
                            ? row.flete_verified 
                              ? 'bg-green-100' 
                              : 'bg-yellow-100'
                            : ''
                        }`}>
                          <div className="flex items-center justify-end gap-2">
                            <InlineCell {...buildCellProps(row.id as string, 'flete')}>
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.flete) || ''}
                                placeholder="0"
                                displayFormatter={() => formatCurrency(row.flete)}
                                onSave={(val) => {
                                  const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                  return requestFieldUpdate(row, 'flete', 'Flete', numeric, { flete_verified: false });
                                }}
                              />
                            </InlineCell>
                            {toNumber(row.flete) > 0 && (
                              <button
                                onClick={() => requestFieldUpdate(row, 'flete_verified', 'Flete Verificado', !row.flete_verified)}
                                className={`p-1 rounded ${row.flete_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                title={row.flete_verified ? 'Verificado' : 'Marcar como verificado'}
                              >
                                {row.flete_verified ? '✓' : '○'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${
                          toNumber(row.traslado) > 0 
                            ? row.traslado_verified 
                              ? 'bg-green-100' 
                              : 'bg-yellow-100'
                            : ''
                        }`}>
                          <div className="flex items-center justify-end gap-2">
                            <InlineCell {...buildCellProps(row.id as string, 'traslado')}>
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.traslado) || ''}
                                placeholder="0"
                                displayFormatter={() => formatCurrency(row.traslado)}
                                onSave={(val) => {
                                  const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                  return requestFieldUpdate(row, 'traslado', 'Traslado', numeric, { traslado_verified: false });
                                }}
                              />
                            </InlineCell>
                            {toNumber(row.traslado) > 0 && (
                              <button
                                onClick={() => requestFieldUpdate(row, 'traslado_verified', 'Traslado Verificado', !row.traslado_verified)}
                                className={`p-1 rounded ${row.traslado_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                title={row.traslado_verified ? 'Verificado' : 'Marcar como verificado'}
                              >
                                {row.traslado_verified ? '✓' : '○'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${
                          toNumber(row.repuestos) > 0 
                            ? row.repuestos_verified 
                              ? 'bg-green-100' 
                              : 'bg-yellow-100'
                            : ''
                        }`}>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-end gap-2">
                              <InlineCell {...buildCellProps(row.id as string, 'repuestos')}>
                                <InlineFieldEditor
                                  type="number"
                                  value={toNumber(row.repuestos) || ''}
                                  placeholder="0"
                                  displayFormatter={() => formatCurrency(row.repuestos)}
                                  onSave={(val) => {
                                    const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                    return requestFieldUpdate(row, 'repuestos', 'PPTO Reparación', numeric, { repuestos_verified: false });
                                  }}
                                />
                              </InlineCell>
                              {toNumber(row.repuestos) > 0 && (
                                <button
                                  onClick={() => requestFieldUpdate(row, 'repuestos_verified', 'PPTO Reparación Verificado', !row.repuestos_verified)}
                                  className={`p-1 rounded ${row.repuestos_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                  title={row.repuestos_verified ? 'Verificado' : 'Marcar como verificado'}
                                >
                                  {row.repuestos_verified ? '✓' : '○'}
                                </button>
                              )}
                            </div>
                            {row.model && (
                              <PriceSuggestion
                                type="repuestos"
                                model={row.model}
                                year={row.year}
                                hours={row.hours}
                                autoFetch={true}
                                compact={true}
                                onApply={(value) => requestFieldUpdate(row, 'repuestos', 'PPTO Reparación', value, { repuestos_verified: false })}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <InlineCell {...buildCellProps(row.id as string, 'service_value')}>
                            <span className="text-gray-700">{formatCurrency(row.service_value)}</span>
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
                          <div className="flex flex-col gap-1">
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
                            {row.model && (
                              <PriceSuggestion
                                type="pvp"
                                model={row.model}
                                year={row.year}
                                hours={row.hours}
                                costoArancel={row.cost_arancel}
                                autoFetch={true}
                                compact={true}
                                onApply={(value) => requestFieldUpdate(row, 'pvp_est', 'PVP Estimado', value)}
                              />
                            )}
                          </div>
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

              {/* Resumen de valores */}
              <div className="grid grid-cols-3 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">PRECIO</p>
                  <p className="text-lg font-bold text-[#50504f]">{formatCurrency(currentRow.precio_fob)}</p>
                </div>
                <div className="text-center border-x border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">CIF USD</p>
                  <p className="text-lg font-bold text-[#50504f]">{formatCurrency(currentRow.cif_usd)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">CIF LOCAL</p>
                  <p className="text-lg font-bold text-[#50504f]">{formatCurrency(currentRow.cif_local)}</p>
                </div>
              </div>

              {/* GASTOS OPERACIONALES */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-[#50504f] mb-3 pb-2 border-b border-gray-100">
                  GASTOS OPERACIONALES
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Inland</label>
                    <input type="number" value={editData.inland || ''} onChange={(e) => setEditData({...editData, inland: parseFloat(e.target.value)})} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Gastos Pto</label>
                    <input type="number" value={editData.gastos_pto || ''} onChange={(e) => setEditData({...editData, gastos_pto: parseFloat(e.target.value)})} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Flete</label>
                    <input type="number" value={editData.flete || ''} onChange={(e) => setEditData({...editData, flete: parseFloat(e.target.value)})} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Traslado</label>
                    <input type="number" value={editData.traslado || ''} onChange={(e) => setEditData({...editData, traslado: parseFloat(e.target.value)})} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">PPTO Reparación</label>
                    <input type="number" value={editData.repuestos || ''} onChange={(e) => setEditData({...editData, repuestos: parseFloat(e.target.value)})} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" placeholder="0.00" />
                    {currentRow && currentRow.model && (
                      <div className="mt-2">
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">Valor Servicio</label>
                    <span className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 block">{formatCurrency(editData.service_value) || '-'}</span>
                  </div>
                </div>
              </div>

              {/* PROYECCIÓN Y VENTA */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-[#50504f] mb-3 pb-2 border-b border-gray-100">
                  PROYECCIÓN Y VENTA
                </h4>
                
                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Costo Arancel (Automático)</p>
                  <p className="text-lg font-bold text-[#cf1b22]">{formatCurrency(currentRow.cost_arancel)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Proyectado</label>
                    <input type="number" value={editData.proyectado || ''} onChange={(e) => setEditData({...editData, proyectado: parseFloat(e.target.value)})} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">PVP Estimado</label>
                    <input type="number" value={editData.pvp_est || ''} onChange={(e) => setEditData({...editData, pvp_est: parseFloat(e.target.value)})} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" placeholder="0.00" />
                    {currentRow && currentRow.model && (
                      <div className="mt-2">
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
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Comentarios</label>
                  <textarea value={editData.comentarios || ''} onChange={(e) => setEditData({...editData, comentarios: e.target.value})} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" placeholder="Observaciones..." />
                </div>
              </div>

              {/* Archivos */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-[#50504f] mb-3">Archivos</h4>
                <MachineFiles machineId={currentRow.machine_id} allowUpload={true} />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="secondary" onClick={handleCancel} className="px-6 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-[#50504f]">
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="px-6 py-2 text-sm bg-[#cf1b22] hover:bg-[#a81820] text-white">
                  Guardar
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
                  <p className="text-xs text-gray-500">Valor Servicio</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.service_value)}</p>
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
                      const total = sum(viewRow.inland) + sum(viewRow.gastos_pto) + sum(viewRow.flete) + sum(viewRow.traslado) + sum(viewRow.repuestos) + sum(viewRow.service_value);
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
