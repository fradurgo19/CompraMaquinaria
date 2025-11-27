import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, Wrench, Eye, Edit, History, Clock } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../services/api';
import { ServiceRecord } from '../types/database';
import { showError, showSuccess } from '../components/Toast';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { useChangeDetection } from '../hooks/useChangeDetection';

export const ServicePage = () => {
  const [data, setData] = useState<ServiceRecord[]>([]);
  const [filtered, setFiltered] = useState<ServiceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ start_staging: string; end_staging: string; service_value: number; staging_type: string }>({ 
    start_staging: '', 
    end_staging: '',
    service_value: 0,
    staging_type: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [current, setCurrent] = useState<ServiceRecord | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [originalForm, setOriginalForm] = useState<{ start_staging: string; end_staging: string; service_value: number; staging_type: string } | null>(null);
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

  // Sincronizar scroll horizontal
  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;
    if (!topScroll || !tableScroll) return;

    const syncTopToTable = () => {
      if (tableScroll) tableScroll.scrollLeft = topScroll.scrollLeft;
    };
    const syncTableToTop = () => {
      if (topScroll) topScroll.scrollLeft = tableScroll.scrollLeft;
    };

    topScroll.addEventListener('scroll', syncTopToTable);
    tableScroll.addEventListener('scroll', syncTableToTop);

    return () => {
      topScroll.removeEventListener('scroll', syncTopToTable);
      tableScroll.removeEventListener('scroll', syncTableToTop);
    };
  }, []);

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
    start_staging: 'Inicio Alistamiento',
    end_staging: 'FES',
    service_value: 'Valor Servicio',
    staging_type: 'Tipo Alistamiento',
  };

  // Hook de detección de cambios
  const { hasChanges, changes } = useChangeDetection(
    originalForm, 
    form, 
    MONITORED_FIELDS
  );

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!search) return setFiltered(data);
    const s = search.toLowerCase();
    setFiltered(
      data.filter(r => (r.model || '').toLowerCase().includes(s) || (r.serial || '').toLowerCase().includes(s) || (r.supplier_name || '').toLowerCase().includes(s))
    );
  }, [search, data]);

  const load = async () => {
    try {
      const rows = await apiGet<ServiceRecord[]>('/api/service');
      setData(rows);
      setFiltered(rows);
    } catch {
      showError('Error al cargar Servicio');
    }
  };

  const startEdit = (row: ServiceRecord) => {
    setEditing(row.id);
    setCurrent(row);
    const formValues = {
      start_staging: row.start_staging ? new Date(row.start_staging).toISOString().split('T')[0] : '',
      end_staging: row.end_staging ? new Date(row.end_staging).toISOString().split('T')[0] : '',
      service_value: (row as any).service_value || 0,
      staging_type: (row as any).staging_type || '',
    };
    setForm(formValues);
    setOriginalForm(formValues); // Guardar valores originales
    setIsModalOpen(true);
  };

  const save = async (id: string) => {
    // Si hay cambios, mostrar modal de control de cambios
    if (hasChanges && changes.length > 0) {
      setPendingUpdate({ id, data: form });
      setShowChangeModal(true);
      return;
    }

    // Si no hay cambios, guardar directamente
    await saveChanges();
  };

  const saveChanges = async (changeReason?: string) => {
    const id = pendingUpdate?.id || current?.id;
    const data = pendingUpdate?.data || form;

    console.log('💾 Guardando cambios en Service...');
    console.log('  - ID:', id);
    console.log('  - Data:', data);
    console.log('  - hasChanges:', hasChanges);
    console.log('  - changes:', changes);

    try {
      await apiPut(`/api/service/${id}`, data);

      // Registrar cambios en el log si hay
      if (hasChanges && changes.length > 0) {
        console.log('📝 Intentando registrar cambios en change_logs...');
        try {
          const logPayload = {
            table_name: 'service_records',
            record_id: id,
            changes,
            change_reason: changeReason || null,
            module_name: 'servicio',
          };
          console.log('  - Payload:', logPayload);
          
          const result = await apiPost('/api/change-logs', logPayload);
          console.log(`✅ ${changes.length} cambios registrados en Servicio`, result);
        } catch (logError) {
          console.error('❌ Error registrando cambios:', logError);
        }
      } else {
        console.log('⚠️ No hay cambios para registrar (hasChanges:', hasChanges, 'changes.length:', changes.length, ')');
      }

      setEditing(null);
      setIsModalOpen(false);
      setShowChangeModal(false);
      setCurrent(null);
      setPendingUpdate(null);
      setOriginalForm(null);
      await load();
      showSuccess('Alistamiento actualizado');
    } catch {
      showError('Error al guardar');
    }
  };

  const cancel = () => {
    setEditing(null);
    setForm({ start_staging: '', end_staging: '', service_value: 0, staging_type: '' });
    setIsModalOpen(false);
    setCurrent(null);
  };

  const fdate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-CO') : '-');

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
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('servicio');
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
      await apiPut(`/api/service/${pending.recordId}`, pending.updates);
      await apiPost('/api/change-logs', {
        table_name: 'service_records',
        record_id: pending.recordId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'servicio',
      });
      await loadChangeIndicators([pending.recordId]);
      showSuccess('Dato actualizado correctamente');
      await load();
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
    record: ServiceRecord,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    row: ServiceRecord,
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
    row: ServiceRecord,
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

  // Cargar indicadores de cambios (desde service_records y purchases)
  const loadChangeIndicators = async (recordIds?: string[]) => {
    if (data.length === 0) return;
    
    try {
      const idsToLoad = recordIds || data.map(d => d.id);
      const purchaseIds = data.filter(d => d.purchase_id).map(d => d.purchase_id);
      
      // Cargar cambios de service_records
      const serviceResponse = await apiPost<Record<string, Array<{
        id: string;
        field_name: string;
        field_label: string;
        old_value: string | number | null;
        new_value: string | number | null;
        change_reason: string | null;
        changed_at: string;
        module_name: string | null;
      }>>>('/api/change-logs/batch', {
        table_name: 'service_records',
        record_ids: idsToLoad,
      });
      
      // Cargar cambios de purchases (para campos como MC, movimiento, fechas de embarque)
      const purchaseResponse = purchaseIds.length > 0 ? await apiPost<Record<string, Array<{
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
      
      const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
      
      // Procesar cambios de service_records
      Object.entries(serviceResponse).forEach(([recordId, changes]) => {
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
      
      // Procesar cambios de purchases y mapearlos al service_record correspondiente
      Object.entries(purchaseResponse).forEach(([purchaseId, changes]) => {
        // Encontrar el service_record que corresponde a este purchase_id
        const serviceRecord = data.find(d => d.purchase_id === purchaseId);
        if (serviceRecord && changes && changes.length > 0) {
          const existingIndicators = indicatorsMap[serviceRecord.id] || [];
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
          // Combinar y ordenar por fecha
          indicatorsMap[serviceRecord.id] = [...existingIndicators, ...newIndicators]
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
    if (data.length > 0) {
      loadChangeIndicators();
    }
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-slate-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-2 bg-white rounded-xl shadow">
            <Wrench className="w-7 h-7 text-teal-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Servicio</h1>
            <p className="text-gray-600">Alistamiento y preparación de máquinas</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por modelo, serial o proveedor..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Barra de Scroll Superior - Sincronizada */}
          <div className="mb-3">
            <div 
              ref={topScrollRef}
              className="overflow-x-auto bg-gradient-to-r from-teal-100 to-gray-100 rounded-lg shadow-inner"
              style={{ height: '14px' }}
            >
              <div style={{ width: '2800px', height: '1px' }}></div>
            </div>
          </div>

          <div ref={tableScrollRef} className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full min-w-[2800px] divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-brand-red to-primary-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PROVEEDOR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MARCA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">CONDICIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MODELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SERIAL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMB. SALIDA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMB. LLEGADA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PUERTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase bg-yellow-600">MC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA MOV.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">INICIO ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FES</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">TIPO ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">REPUESTOS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">VALOR SERVICIO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">DIFERENCIA</th>
                  <th className="px-2 py-3 text-center text-xs font-semibold text-white uppercase sticky right-0 bg-brand-red z-10" style={{ minWidth: 140 }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((r) => {
                  const repuestos = (r as any).repuestos || 0;
                  const servicioValue = (r as any).service_value || 0;
                  const diferencia = repuestos - servicioValue;
                  return (
                  <tr key={r.id} className={`transition-colors ${getRowBackgroundStyle()}`}>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-semibold">{r.brand || '-'}</td>
                    
                    {/* CONDICIÓN */}
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {(() => {
                        const condition = r.condition || 'USADO';
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
                    
                    <td className="px-4 py-3 text-sm text-gray-700 font-semibold whitespace-nowrap">{r.model || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{r.serial || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'shipment_departure_date')}>
                        <span>{fdate(r.shipment_departure_date)}</span>
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'shipment_arrival_date')}>
                        <span>{fdate(r.shipment_arrival_date)}</span>
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'port_of_destination')}>
                        <span>{r.port_of_destination || '-'}</span>
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'nationalization_date')}>
                        <span>{fdate(r.nationalization_date)}</span>
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'mc')}>
                        <span className="text-gray-700">{r.mc || '-'}</span>
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'current_movement')}>
                        <span>{r.current_movement || '-'}</span>
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'current_movement_date')}>
                        <span>{fdate(r.current_movement_date)}</span>
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'start_staging')}>
                        <InlineFieldEditor
                          value={r.start_staging ? new Date(r.start_staging).toISOString().split('T')[0] : ''}
                          type="date"
                          placeholder="Inicio alistamiento"
                          onSave={(val) =>
                            requestFieldUpdate(
                              r,
                              'start_staging',
                              'Inicio Alistamiento',
                              typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              {
                                start_staging: typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              }
                            )
                          }
                          displayFormatter={(val) =>
                            val ? fdate(String(val)) : '-'
                          }
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'end_staging')}>
                        <InlineFieldEditor
                          value={r.end_staging ? new Date(r.end_staging).toISOString().split('T')[0] : ''}
                          type="date"
                          placeholder="Fin alistamiento"
                          onSave={(val) =>
                            requestFieldUpdate(
                              r,
                              'end_staging',
                              'FES',
                              typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              {
                                end_staging: typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              }
                            )
                          }
                          displayFormatter={(val) =>
                            val ? fdate(String(val)) : '-'
                          }
                        />
                      </InlineCell>
                    </td>
                    {/* TIPO ALISTAMIENTO */}
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'staging_type')}>
                        <InlineFieldEditor
                          type="select"
                          value={(r as any).staging_type || ''}
                          placeholder="Seleccionar"
                          options={[
                            { value: '', label: '-' },
                            { value: 'NORMAL', label: 'Normal' },
                            { value: 'ADICIONAL', label: 'Adicional' },
                          ]}
                          onSave={(val) =>
                            requestFieldUpdate(r, 'staging_type', 'Tipo Alistamiento', val || null)
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
                    <td className="px-4 py-3 text-sm text-gray-700 font-semibold">
                      ${repuestos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-semibold">
                      <InlineCell {...buildCellProps(r.id, 'service_value')}>
                        <InlineFieldEditor
                          type="number"
                          value={servicioValue || ''}
                          placeholder="0.00"
                          displayFormatter={() => `$${servicioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          onSave={(val) => {
                            const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                            return requestFieldUpdate(r, 'service_value', 'Valor Servicio', numeric);
                          }}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-bold">
                      ${diferencia.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-700 sticky right-0 bg-white z-10" style={{ minWidth: 140 }}>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => startEdit(r)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEdit(r)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            console.log('🔍 Abriendo historial de Service:', r.id, r);
                            setCurrent(r);
                            setIsHistoryOpen(true);
                          }}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Historial de cambios"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
      <Modal isOpen={isModalOpen} onClose={cancel} title="Editar Alistamiento" size="md">
        {current && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl">
              <div>
                <p className="text-xs text-gray-500">Proveedor</p>
                <p className="text-sm font-semibold">{current.supplier_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Marca</p>
                <p className="text-sm font-semibold">{current.brand || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Modelo</p>
                <p className="text-sm font-semibold">{current.model || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Serial</p>
                <p className="text-sm font-semibold font-mono">{current.serial || '-'}</p>
              </div>
            </div>

            {/* Fechas y Valores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inicio Alistamiento</label>
                <input type="date" value={form.start_staging} onChange={(e) => setForm({ ...form, start_staging: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">FES (Fin Alistamiento)</label>
                <input type="date" value={form.end_staging} onChange={(e) => setForm({ ...form, end_staging: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Servicio (USD)</label>
                <input 
                  type="number" 
                  value={form.service_value} 
                  onChange={(e) => setForm({ ...form, service_value: parseFloat(e.target.value) || 0 })} 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500" 
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Alistamiento</label>
                <select
                  value={form.staging_type}
                  onChange={(e) => setForm({ ...form, staging_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">- Seleccionar -</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ADICIONAL">Adicional</option>
                </select>
              </div>
            </div>

            {/* Archivos específicos de Servicio */}
            {current.machine_id && (
              <div className="pt-4">
                <div className="bg-gradient-to-r from-orange-50 to-gray-50 rounded-xl p-6 border border-orange-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-lg shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Gestión de Archivos</h3>
                      <p className="text-sm text-gray-600">Fotos y documentos de la máquina en el módulo de Servicio</p>
                    </div>
                  </div>
                  
                  <MachineFiles 
                    machineId={current.machine_id}
                    allowUpload={true}
                    allowDelete={true}
                    currentScope="SERVICIO"
                    uploadExtraFields={{ scope: 'SERVICIO' }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={cancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={() => save(current.id)} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Guardar</button>
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

      {/* Modal de Historial */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Historial de Cambios - Todos los Módulos"
        size="lg"
      >
        {current && (
          <ChangeHistory 
            tableName="service_records" 
            recordId={current.id}
            purchaseId={current.purchase_id}
          />
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
    </div>
  );
};


