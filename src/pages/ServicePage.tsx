import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Wrench, Eye, Edit, History, Clock, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../services/api';
import { ServiceRecord } from '../types/database';
import { showError, showSuccess } from '../components/Toast';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { MACHINE_TYPE_OPTIONS, formatMachineType } from '../constants/machineTypes';
import { useChangeDetection } from '../hooks/useChangeDetection';
import { formatChangeValue } from '../utils/formatChangeValue';
import { getMachineSerialForDisplay } from '../utils/machineSerialDisplay';

type ServiceFormState = {
  start_staging: string;
  end_staging: string;
  service_value: number;
  staging_type: string;
};

type ChangeFieldValue = string | number | null;
type EditableFieldValue = string | number | boolean | null | undefined;

type InlineChangeItem = {
  field_name: string;
  field_label: string;
  old_value: ChangeFieldValue;
  new_value: ChangeFieldValue;
};

type InlineChangeIndicator = {
  id: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: ChangeFieldValue;
  newValue: ChangeFieldValue;
  reason?: string;
  changedAt: string;
  moduleName?: string | null;
};

type InlineCellProps = {
  children: React.ReactNode;
  recordId?: string;
  fieldName?: string;
  indicators?: InlineChangeIndicator[];
  openPopover?: { recordId: string; fieldName: string } | null;
  onIndicatorClick?: (event: React.MouseEvent, recordId: string, fieldName: string) => void;
};

type EditingSpecsByRow = Record<string, Record<string, EditableFieldValue>>;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatMachineTypeDisplayValue = (value: unknown): string => {
  if (value == null) return 'Sin tipo';
  const machineType = typeof value === 'string' ? value : String(value);
  return formatMachineType(machineType) || 'Sin tipo';
};

type BatchChangeLogItem = {
  id: string;
  field_name: string;
  field_label: string;
  old_value: ChangeFieldValue;
  new_value: ChangeFieldValue;
  change_reason: string | null;
  changed_at: string;
  module_name: string | null;
};

export const ServicePage = () => {
  const [data, setData] = useState<ServiceRecord[]>([]);
  const [filtered, setFiltered] = useState<ServiceRecord[]>([]);
  const [search, setSearch] = useState('');
  // Filtros de columnas
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [machineTypeFilter, setMachineTypeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [serialFilter, setSerialFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const mqFilter = '';
  const [form, setForm] = useState<ServiceFormState>({
    start_staging: '', 
    end_staging: '',
    service_value: 0,
    staging_type: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [current, setCurrent] = useState<ServiceRecord | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; data: ServiceFormState } | null>(null);
  const [originalForm, setOriginalForm] = useState<ServiceFormState | null>(null);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [filesSectionExpanded, setFilesSectionExpanded] = useState(false);
  const [specsPopoverOpen, setSpecsPopoverOpen] = useState<string | null>(null);
  const [editingSpecs, setEditingSpecs] = useState<EditingSpecsByRow>({});

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

  // Cache básico en memoria para evitar recargas innecesarias
  const serviceCacheRef = useRef<{
    data: ServiceRecord[];
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 30000; // 30 segundos de caché

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

  const toNumeric = useCallback((value: unknown): number => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const cleaned = value.replaceAll(/[^\d.,-]/g, '');
      if (!cleaned) return 0;

      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      const decimalIndex = Math.max(lastComma, lastDot);

      const normalized =
        decimalIndex >= 0
          ? `${cleaned.slice(0, decimalIndex).replaceAll(/[^\d-]/g, '')}.${cleaned
              .slice(decimalIndex + 1)
              .replaceAll(/[^\d]/g, '')}`
          : cleaned.replaceAll(/[^\d-]/g, '');
      const num = Number(normalized);
      return Number.isFinite(num) ? num : 0;
    }
    return 0;
  }, []);

  const formatCurrencyCOP = useCallback((value: number | null | undefined) => {
    const numeric = toNumeric(value);
    if (!Number.isFinite(numeric)) return '$0';
    return `$${numeric.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [toNumeric]);

  // Valores únicos para filtros de columnas
  const uniqueSuppliers = useMemo(
    () =>
      [...new Set(data.map(item => item.supplier_name).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' })) as string[],
    [data]
  );
  const uniqueBrands = useMemo(
    () =>
      [...new Set(data.map(item => item.brand).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' })) as string[],
    [data]
  );
  const uniqueMachineTypes = useMemo(
    () =>
      [...new Set(data.map(item => item.machine_type).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' })) as string[],
    [data]
  );
  const uniqueModels = useMemo(
    () =>
      [...new Set(data.map(item => item.model).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' })) as string[],
    [data]
  );
  const uniqueSerials = useMemo(() => {
    const vals = data
      .map((item) => getMachineSerialForDisplay(item.serial))
      .filter((s): s is string => Boolean(s));
    return [...new Set(vals)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [data]);
  const uniqueYears = useMemo(
    () => [...new Set(data.map(item => item.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a)) as number[],
    [data]
  );
  const totalServiceValue = useMemo(
    () => filtered.reduce((sum, r) => sum + toNumeric(r.service_value), 0),
    [filtered, toNumeric]
  );

  useEffect(() => {
    let result = data;
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.model || '').toLowerCase().includes(s) ||
          getMachineSerialForDisplay(r.serial || '').toLowerCase().includes(s) ||
          (r.supplier_name || '').toLowerCase().includes(s)
      );
    }

    // Filtros de columnas
    if (supplierFilter && result.some(item => item.supplier_name === supplierFilter)) {
      result = result.filter(item => item.supplier_name === supplierFilter);
    }
    if (brandFilter && result.some(item => item.brand === brandFilter)) {
      result = result.filter(item => item.brand === brandFilter);
    }
    if (machineTypeFilter && result.some(item => item.machine_type === machineTypeFilter)) {
      result = result.filter(item => item.machine_type === machineTypeFilter);
    }
    if (modelFilter && result.some(item => item.model === modelFilter)) {
      result = result.filter(item => item.model === modelFilter);
    }
    if (serialFilter && result.some((item) => getMachineSerialForDisplay(item.serial) === serialFilter)) {
      result = result.filter((item) => getMachineSerialForDisplay(item.serial) === serialFilter);
    }
    if (yearFilter && result.some(item => String(item.year) === yearFilter)) {
      result = result.filter(item => String(item.year) === yearFilter);
    }
    if (mqFilter && result.some(item => item.mq === mqFilter)) {
      result = result.filter(item => item.mq === mqFilter);
    }

    setFiltered(result);
  }, [search, data, supplierFilter, brandFilter, machineTypeFilter, modelFilter, serialFilter, yearFilter, mqFilter]);

  const load = async (forceRefresh = false) => {
    // Verificar caché si no se fuerza refresh
    if (!forceRefresh && serviceCacheRef.current) {
      const cacheAge = Date.now() - serviceCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        setData(serviceCacheRef.current.data);
        setFiltered(serviceCacheRef.current.data);
        return;
      }
    }
    
    try {
      const rows = await apiGet<ServiceRecord[]>('/api/service');
      
      // Actualizar caché
      serviceCacheRef.current = {
        data: rows,
        timestamp: Date.now(),
      };
      
      setData(rows);
      setFiltered(rows);
    } catch {
      showError('Error al cargar Servicio');
      // Si hay error pero tenemos caché, usar datos en caché
      if (serviceCacheRef.current) {
        setData(serviceCacheRef.current.data);
        setFiltered(serviceCacheRef.current.data);
      }
    }
  };

  const startEdit = (row: ServiceRecord) => {
    setCurrent(row);
    const formValues = {
      start_staging: row.start_staging ? new Date(row.start_staging).toISOString().split('T')[0] : '',
      end_staging: row.end_staging ? new Date(row.end_staging).toISOString().split('T')[0] : '',
      service_value: row.service_value ?? 0,
      staging_type: row.staging_type ?? '',
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

    try {
      await apiPut(`/api/service/${id}`, data);

      // Registrar cambios en el log si hay
      if (hasChanges && changes.length > 0) {
        try {
          const logPayload = {
            table_name: 'service_records',
            record_id: id,
            changes,
            change_reason: changeReason || null,
            module_name: 'servicio',
          };
          await apiPost('/api/change-logs', logPayload);
        } catch {
          // El guardado principal ya se aplicó; el log de auditoría es secundario
        }
      }

      setIsModalOpen(false);
      setShowChangeModal(false);
      setCurrent(null);
      setPendingUpdate(null);
      setOriginalForm(null);
      await load(true); // Forzar refresh después de actualizar
      showSuccess('Alistamiento actualizado');
    } catch {
      showError('Error al guardar');
    }
  };

  const cancel = () => {
    setForm({ start_staging: '', end_staging: '', service_value: 0, staging_type: '' });
    setIsModalOpen(false);
    setCurrent(null);
  };

  const fdate = (d?: string | null) => {
    if (!d) return '-';
    try {
      // Si viene como fecha ISO completa, extraer solo la parte de fecha
      if (typeof d === 'string' && d.includes('T')) {
        const dateOnly = d.split('T')[0];
        const [year, month, day] = dateOnly.split('-');
        return `${day}/${month}/${year}`;
      }
      // Si viene como YYYY-MM-DD, formatear directamente sin conversión de zona horaria
      if (typeof d === 'string' && ISO_DATE_PATTERN.test(d)) {
        const [year, month, day] = d.split('-');
        return `${day}/${month}/${year}`;
      }
      // Para otros formatos, usar métodos UTC sin conversión de zona horaria
      const dateObj = new Date(d);
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
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

  const mapValueForLog = (value: EditableFieldValue): ChangeFieldValue => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return value;
  };

  const getFieldIndicators = (
    indicators: Record<string, InlineChangeIndicator[]>,
    recordId: string,
    fieldName: string
  ) => {
    return (indicators[recordId] || []).filter((log) => log.fieldName === fieldName);
  };

  const InlineCell: React.FC<InlineCellProps> = ({
    children,
    recordId,
    fieldName,
    indicators,
    openPopover,
    onIndicatorClick,
  }) => { // NOSONAR - Componente local de render para celdas con popover.
    const hasIndicator = Boolean(recordId && fieldName && indicators?.length);
    const isOpen =
      hasIndicator && openPopover?.recordId === recordId && openPopover?.fieldName === fieldName;

    const handleIndicatorButtonClick = (event: React.MouseEvent) => {
      if (!recordId || !fieldName || !onIndicatorClick) return;
      onIndicatorClick(event, recordId, fieldName);
    };

    return (
      <div className="relative">
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">{children}</div>
          {hasIndicator && onIndicatorClick && (
            <button
              type="button"
              className="change-indicator-btn inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
              title="Ver historial de cambios"
              onClick={handleIndicatorButtonClick}
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
      await load(true); // Forzar refresh después de actualizar campo inline
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
      prev?.recordId === recordId && prev?.fieldName === fieldName
        ? null
        : { recordId, fieldName }
    );
  };

  const getRecordFieldValue = (
    record: ServiceRecord,
    fieldName: string
  ): EditableFieldValue => {
    const typedRecord: Record<string, EditableFieldValue> = record as unknown as Record<
      string,
      EditableFieldValue
    >;
    const value = typedRecord[fieldName];
    return value ?? null;
  };

  const beginInlineChange = (
    row: ServiceRecord,
    fieldName: string,
    fieldLabel: string,
    oldValue: EditableFieldValue,
    newValue: EditableFieldValue,
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
    row: ServiceRecord,
    fieldName: string,
    fieldLabel: string,
    newValue: EditableFieldValue,
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
      await apiPut(`/api/service/${row.id}`, updatesToApply);
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

  const buildCellProps = (recordId: string, field: string) => ({
    recordId,
    fieldName: field,
    indicators: getFieldIndicators(inlineChangeIndicators, recordId, field),
    openPopover: openChangePopover,
    onIndicatorClick: handleIndicatorClick,
  });

  const handleOpenSpecsPopover = (row: ServiceRecord) => { // NOSONAR - Mantiene compatibilidad entre specs de máquinas y new_purchases.
    setSpecsPopoverOpen(row.id);
    
    // Detectar si viene de new_purchases
    const isNewPurchase = !!row.new_purchase_id;
    
    if (isNewPurchase) {
      // Popover para new_purchases
      const npValue = row.np_track_width;
      const eqValue = row.track_width;
      
      // Calcular track_width: priorizar np_track_width de new_purchases
      let trackWidthValue: number | null = null;
      
      // Si np_track_width existe y es válido (puede ser 0)
      if (npValue !== null && npValue !== undefined) {
        // Si es string, intentar extraer número (por si viene "600mm")
        let numValue: number;
        if (typeof npValue === 'string') {
          // Extraer solo números del string
          const numericPart = npValue.replaceAll(/[^\d.]/g, '');
          numValue = Number(numericPart);
        } else {
          numValue = Number(npValue);
        }
        
        if (!Number.isNaN(numValue)) {
          trackWidthValue = numValue;
        }
      }
      
      // Si no hay valor de new_purchases, usar el de equipments
      if (trackWidthValue === null && eqValue !== null && eqValue !== undefined) {
        const numValue = Number(eqValue);
        if (!Number.isNaN(numValue)) {
          trackWidthValue = numValue;
        }
      }
      
      setEditingSpecs(prev => ({
        ...prev,
        [row.id]: {
          source: 'new_purchases',
          cabin_type: row.np_cabin_type || row.cabin_type || '',
          wet_line: row.np_wet_line || row.wet_line || '',
          dozer_blade: row.np_dozer_blade || '',
          track_type: row.np_track_type || '',
          track_width: trackWidthValue,
          arm_type: row.np_arm_type || row.arm_type || '',
          spec_pad: row.spec_pad ?? null
        }
      }));
    } else {
      // Popover para otros módulos (preselección, subasta, consolidado)
      setEditingSpecs(prev => ({
        ...prev,
        [row.id]: {
          source: 'machines',
          shoe_width_mm: row.shoe_width_mm ?? row.track_width ?? '',
          spec_cabin: row.spec_cabin || row.cabin_type || '',
          arm_type: row.machine_arm_type || row.arm_type || '',
          spec_pip: row.spec_pip ?? (row.wet_line === 'SI'),
          spec_blade: row.spec_blade ?? (row.blade === 'SI'),
          spec_pad: row.spec_pad ?? null
        }
      }));
    }
  };


  // Cargar indicadores de cambios (desde service_records y purchases)
  const loadChangeIndicators = useCallback(async (recordIds?: string[]) => {
    if (data.length === 0) return;
    
    try {
      const idsToLoad = recordIds || data.map(d => d.id);
      const purchaseIds = data.filter(d => d.purchase_id).map(d => d.purchase_id);
      
      // Cargar cambios de service_records
      const serviceResponse = await apiPost<Record<string, BatchChangeLogItem[]>>('/api/change-logs/batch', {
        table_name: 'service_records',
        record_ids: idsToLoad,
      });
      
      // Cargar cambios de purchases (para campos como MC, movimiento, fechas de embarque)
      const purchaseResponse = purchaseIds.length > 0 ? await apiPost<Record<string, BatchChangeLogItem[]>>('/api/change-logs/batch', {
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
    } catch {
      // Indicadores opcionales: fallo silencioso para no bloquear la tabla
    }
  }, [data]);

  useEffect(() => {
    if (data.length > 0) {
      void loadChangeIndicators();
    }
  }, [data, loadChangeIndicators]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-slate-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-cyan-500 rounded-xl shadow-md p-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold text-[#1A1A1A]">Servicio</h1>
          </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-red">
            <div className="flex items-center justify-between">
          <div>
                <p className="text-sm font-medium text-brand-gray">Total Registros</p>
                <p className="text-2xl font-bold text-brand-red">{filtered.length}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Wrench className="w-6 h-6 text-brand-red" />
              </div>
          </div>
        </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Con FES</p>
                <p className="text-2xl font-bold text-green-600">
                  {filtered.filter(r => r.end_staging).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">En Alistamiento</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {filtered.filter(r => r.start_staging && !r.end_staging).length}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Settings className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-gray">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Total Valor Servicio</p>
                <p className="text-2xl font-bold text-brand-gray">
                  {formatCurrencyCOP(totalServiceValue)}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <Wrench className="w-6 h-6 text-brand-gray" />
              </div>
            </div>
          </div>
        </motion.div>

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

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div 
              ref={tableScrollRef} 
              className="overflow-x-auto overflow-y-scroll" 
              style={{ 
                height: 'calc(100vh - 300px)',
                minHeight: '500px',
              }}
            >
              <table className="w-full min-w-[2800px] divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">
                    <div className="flex flex-col gap-1">
                      <span>TIPO MÁQUINA</span>
                      <select
                        value={machineTypeFilter}
                        onChange={(e) => setMachineTypeFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueMachineTypes.map(t => (
                          <option key={t || ''} value={t || ''}>{formatMachineType(t)}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">CONDICIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">
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
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-800 uppercase bg-cyan-100">SPEC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">ETD</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">ETA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">PUERTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">FECHA NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">MC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">FECHA MOV.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">INICIO ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">FES</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">TIPO ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-teal-100">REPUESTOS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-teal-100">
                    Comentarios
                    {' '}
                    <span className="text-gray-600" title="Campo manual">✎</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">VALOR SERVICIO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-cyan-100">DIFERENCIA</th>
                  <th className="px-2 py-3 text-center text-xs font-semibold text-gray-800 uppercase sticky right-0 bg-cyan-100 z-10" style={{ minWidth: 140 }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((r) => {
                  const repuestos = toNumeric(r.repuestos);
                  const servicioValue = toNumeric(r.service_value);
                  const diferencia = repuestos - servicioValue;
                  return (
                  <tr key={r.id} className={`transition-colors ${getRowBackgroundStyle()}`}>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineFieldEditor
                        value={r.machine_type || ''}
                        type="select"
                        options={MACHINE_TYPE_OPTIONS}
                        placeholder="Tipo de máquina"
                        displayFormatter={(val) => formatMachineTypeDisplayValue(val)}
                        onSave={(val) => requestFieldUpdate(r, 'machine_type', 'Tipo de máquina', val)}
                      />
                    </td>
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
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{getMachineSerialForDisplay(r.serial) || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'year')}>
                        <span className="text-gray-800">{r.year ?? '-'}</span>
                      </InlineCell>
                    </td>
                    
                    {/* SPEC */}
                    <td className="px-4 py-3 text-sm text-gray-700 relative">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            handleOpenSpecsPopover(r);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Ver
                        </button>
                        {specsPopoverOpen === r.id && editingSpecs[r.id] && (
                          <>
                            <button
                              type="button"
                              aria-label="Cerrar especificaciones"
                              className="fixed inset-0 z-40"
                              onClick={() => {
                                setSpecsPopoverOpen(null);
                                setEditingSpecs(prev => {
                                  const newState = { ...prev };
                                  delete newState[r.id];
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
                            >
                              <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 px-4 py-2.5 rounded-t-lg">
                                <h4 className="text-sm font-semibold text-white">Especificaciones Técnicas (Solo Lectura)</h4>
                              </div>
                              <div className="p-4 space-y-3">
                                {editingSpecs[r.id].source === 'new_purchases' ? (
                                  <>
                                    {/* Popover para NEW_PURCHASES - Solo Lectura - Layout 2 columnas */}
                                    {/* Fila 1: Ancho (mm) | Cab (Cabina) */}
                                    <div className="grid grid-cols-2 gap-3">
                                      {/* Ancho (mm) */}
                                    <div>
                                      <p className="block text-xs font-medium text-gray-700 mb-1">
                                          Ancho (mm)
                                      </p>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                          {editingSpecs[r.id].track_width !== null && editingSpecs[r.id].track_width !== undefined 
                                            ? String(editingSpecs[r.id].track_width)
                                            : '-'}
                                      </div>
                                    </div>

                                      {/* Cab (Cabina) */}
                                    <div>
                                      <p className="block text-xs font-medium text-gray-700 mb-1">
                                          Cab (Cabina)
                                      </p>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                          {editingSpecs[r.id].cabin_type || '-'}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Fila 2: Hoja | Brazo */}
                                    <div className="grid grid-cols-2 gap-3">
                                    {/* Hoja (Dozer Blade) */}
                                    <div>
                                      <p className="block text-xs font-medium text-gray-700 mb-1">
                                        Hoja (Dozer Blade)
                                      </p>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                        {editingSpecs[r.id].dozer_blade || '-'}
                                      </div>
                                    </div>

                                      {/* Brazo */}
                                      <div>
                                        <p className="block text-xs font-medium text-gray-700 mb-1">
                                          Brazo
                                        </p>
                                        <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                          {editingSpecs[r.id].arm_type || '-'}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Fila 3: L.H (Línea Húmeda) | Zap */}
                                    <div className="grid grid-cols-2 gap-3">
                                      {/* L.H (Línea Húmeda) */}
                                      <div>
                                        <p className="block text-xs font-medium text-gray-700 mb-1">
                                          L.H (Línea Húmeda)
                                        </p>
                                        <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                          {editingSpecs[r.id].wet_line || '-'}
                                        </div>
                                      </div>

                                    {/* Zap (Tipo de Zapata) */}
                                    <div>
                                      <p className="block text-xs font-medium text-gray-700 mb-1">
                                        Zap (Tipo de Zapata)
                                      </p>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                        {editingSpecs[r.id].track_type || '-'}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Fila 4: PAD */}
                                    <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="block text-xs font-medium text-gray-700 mb-1">
                                          PAD
                                      </p>
                                        <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                          {((r.condition || '').toUpperCase() === 'USADO')
                                            ? (editingSpecs[r.id].spec_pad || '-')
                                            : 'N/A'}
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {/* Popover para OTROS MÓDULOS - Solo Lectura - Layout 2 columnas */}
                                    {/* Fila 1: Ancho Zapatas | Tipo de Cabina */}
                                    <div className="grid grid-cols-2 gap-3">
                                    {/* Ancho Zapatas */}
                                    <div>
                                      <p className="block text-xs font-medium text-gray-700 mb-1">
                                        Ancho Zapatas (mm)
                                      </p>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                        {editingSpecs[r.id].shoe_width_mm || '-'}
                                      </div>
                                    </div>

                                      {/* Tipo de Cabina */}
                                    <div>
                                      <p className="block text-xs font-medium text-gray-700 mb-1">
                                        Tipo de Cabina
                                      </p>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                        {editingSpecs[r.id].spec_cabin || '-'}
                                      </div>
                                    </div>
                                    </div>

                                    {/* Fila 2: Blade | Tipo de Brazo */}
                                    <div className="grid grid-cols-2 gap-3">
                                      {/* Blade */}
                                      <div>
                                        <p className="block text-xs font-medium text-gray-700 mb-1">
                                          Blade (Hoja Topadora)
                                        </p>
                                        <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                          {editingSpecs[r.id].spec_blade ? 'SI' : 'NO'}
                                        </div>
                                      </div>

                                    {/* Tipo de Brazo */}
                                    <div>
                                      <p className="block text-xs font-medium text-gray-700 mb-1">
                                        Tipo de Brazo
                                      </p>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                        {editingSpecs[r.id].arm_type || '-'}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Fila 3: PIP | PAD */}
                                    <div className="grid grid-cols-2 gap-3">
                                    {/* PIP */}
                                    <div>
                                      <p className="block text-xs font-medium text-gray-700 mb-1">
                                        PIP (Accesorios)
                                      </p>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                        {editingSpecs[r.id].spec_pip ? 'SI' : 'NO'}
                                      </div>
                                    </div>

                                    {/* PAD */}
                                    <div>
                                      <p className="block text-xs font-medium text-gray-700 mb-1">
                                          PAD
                                      </p>
                                      <div className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                        {((r.condition || '').toUpperCase() === 'USADO')
                                          ? (editingSpecs[r.id].spec_pad || '-')
                                          : 'N/A'}
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Botón Cerrar */}
                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={() => {
                                      setSpecsPopoverOpen(null);
                                      setEditingSpecs(prev => {
                                        const newState = { ...prev };
                                        delete newState[r.id];
                                        return newState;
                                      });
                                    }}
                                    className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                  >
                                    Cerrar
                                  </button>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    
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
                                start_staging:
                                  typeof val === 'string' && val ? new Date(val).toISOString() : null,
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
                                end_staging:
                                  typeof val === 'string' && val ? new Date(val).toISOString() : null,
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
                          value={r.staging_type ?? ''}
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
                      {formatCurrencyCOP(repuestos)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(r.id, 'comentarios')}>
                        <InlineFieldEditor
                          value={r.comentarios ?? ''}
                          placeholder="Comentarios"
                          onSave={(val) => requestFieldUpdate(r, 'comentarios', 'Comentarios', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-semibold">
                      <InlineCell {...buildCellProps(r.id, 'service_value')}>
                        <InlineFieldEditor
                          type="number"
                          value={servicioValue || ''}
                          placeholder="0.00"
                          displayFormatter={() => formatCurrencyCOP(servicioValue)}
                          onSave={(val) => {
                            let numeric: number | null = null;
                            if (typeof val === 'number') {
                              numeric = val;
                            } else if (val !== null) {
                              numeric = Number(val);
                            }
                            return requestFieldUpdate(r, 'service_value', 'Valor Servicio', numeric);
                          }}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-bold">
                      {formatCurrencyCOP(diferencia)}
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
            {/* Espacio adicional al final para permitir scroll completo y ver popovers inferiores */}
            <div style={{ height: '300px', minHeight: '300px', width: '100%' }}></div>
          </div>
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
                <p className="text-sm font-semibold font-mono">{getMachineSerialForDisplay(current.serial) || '-'}</p>
              </div>
            </div>

            {/* Fechas y Valores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="service-start-staging" className="block text-sm font-medium text-gray-700 mb-1">Inicio Alistamiento</label>
                <input
                  id="service-start-staging"
                  type="date"
                  value={form.start_staging}
                  onChange={(e) => setForm({ ...form, start_staging: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label htmlFor="service-end-staging" className="block text-sm font-medium text-gray-700 mb-1">FES (Fin Alistamiento)</label>
                <input
                  id="service-end-staging"
                  type="date"
                  value={form.end_staging}
                  onChange={(e) => setForm({ ...form, end_staging: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label htmlFor="service-value" className="block text-sm font-medium text-gray-700 mb-1">Valor Servicio (USD)</label>
                <input 
                  id="service-value"
                  type="number" 
                  value={form.service_value} 
                  onChange={(e) => setForm({ ...form, service_value: Number.parseFloat(e.target.value) || 0 })} 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500" 
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label htmlFor="service-staging-type" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Alistamiento</label>
                <select
                  id="service-staging-type"
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
                    machineId={current.machine_id}
                    allowUpload={true}
                    allowDelete={true}
                    currentScope="SERVICIO"
                    uploadExtraFields={{ scope: 'SERVICIO' }}
                  />
                  )}
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


