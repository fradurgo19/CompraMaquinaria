/**
 * Módulo de Logística
 * Vista de máquinas nacionalizadas con gestión de movimientos
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Truck, Package, Plus, Eye, Edit, History, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { MachineFiles } from '../components/MachineFiles';
import { apiGet, apiPost, apiPut } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { Modal } from '../molecules/Modal';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { MACHINE_TYPE_OPTIONS, formatMachineType } from '../constants/machineTypes';

interface LogisticsRow {
  id: string;
  mq: string;
  tipo: string;
  shipment: string;
  supplier_name: string;
  machine_type?: string | null;
  brand: string;
  model: string;
  serial: string;
  year: number | null;
  invoice_date: string;
  payment_date: string;
  shipment_departure_date: string;
  shipment_arrival_date: string;
  port_of_destination: string;
  nationalization_date: string;
  mc: string | null;
  condition: string | null; // NUEVO o USADO
  current_movement: string | null;
  current_movement_date: string | null;
  current_movement_plate: string | null;
}

interface MachineMovement {
  id: string;
  purchase_id: string;
  movement_description: string;
  movement_date: string;
  driver_name: string | null;
  movement_plate: string | null;
  created_at: string;
}

export const LogisticsPage = () => {
  const [data, setData] = useState<LogisticsRow[]>([]);
  const [filteredData, setFilteredData] = useState<LogisticsRow[]>([]);
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
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [selectedRowData, setSelectedRowData] = useState<LogisticsRow | null>(null);
  const [movements, setMovements] = useState<MachineMovement[]>([]);
  const [mcCode, setMcCode] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [movementDate, setMovementDate] = useState('');
  const [movementPlate, setMovementPlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<LogisticsRow | null>(null);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [filesSectionExpanded, setFilesSectionExpanded] = useState(false);

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

  // Valores únicos para filtros de columnas
  const uniqueSuppliers = useMemo(
    () => [...new Set(data.map(item => item.supplier_name).filter(Boolean))].sort() as string[],
    [data]
  );
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
  const uniqueMqs = useMemo(
    () => [...new Set(data.map(item => item.mq).filter(Boolean))].sort() as string[],
    [data]
  );

  useEffect(() => {
    let filtered = data;

    if (searchTerm) {
      filtered = filtered.filter(
        (row) =>
          row.mq.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.serial.toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [searchTerm, data, supplierFilter, brandFilter, modelFilter, serialFilter, yearFilter, mqFilter]);

  // Limpiar placa y conductor si el movimiento no es "SALIÓ"
  useEffect(() => {
    if (!movementDescription.includes('SALIÓ')) {
      setMovementPlate('');
      setDriverName('');
    }
  }, [movementDescription]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await apiGet<LogisticsRow[]>('/api/purchases');
      // Mostrar TODOS los registros sin restricciones
      setData(response);
      setFilteredData(response);
    } catch {
      showError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async (purchaseId: string) => {
    try {
      const response = await apiGet<MachineMovement[]>(`/api/movements/${purchaseId}`);
      setMovements(response);
    } catch {
      showError('Error al cargar los movimientos');
    }
  };

  const handleViewTimeline = async (row: LogisticsRow) => {
    setSelectedRow(row.id);
    setSelectedRowData(row);
    setMcCode(row.mc || ''); // Cargar el MC si ya existe
    await fetchMovements(row.id);
  };


  const handleSaveMC = async () => {
    if (!selectedRow || !mcCode || mcCode.trim() === '') {
      showError('Por favor ingrese el código MC');
      return;
    }

    try {
      await apiPut(`/api/purchases/${selectedRow}`, {
        mc: mcCode.trim().toUpperCase()
      });

      // Actualizar los datos locales
      if (selectedRowData) {
        setSelectedRowData({ ...selectedRowData, mc: mcCode.trim().toUpperCase() });
      }

      showSuccess('Código MC guardado exitosamente');
      await fetchData(); // Recargar la lista
    } catch (error) {
      console.error('Error al guardar MC:', error);
      showError('Error al guardar el código MC');
    }
  };

  const handleAddMovement = async () => {
    // ⚠️ VALIDACIÓN: Debe existir MC antes de permitir movimientos
    if (!selectedRowData?.mc || selectedRowData.mc.trim() === '') {
      showError('⚠️ Debe ingresar y guardar el código MC antes de poder registrar movimientos');
      return;
    }

    if (!selectedRow || !movementDescription || !movementDate) {
      showError('Por favor complete todos los campos del movimiento');
      return;
    }

    try {
      // Agregar movimiento
      const movementResult = await apiPost('/api/movements', {
        purchase_id: selectedRow,
        movement_description: movementDescription,
        movement_date: movementDate,
        driver_name: movementDescription.includes('SALIÓ') ? driverName : null,
        movement_plate: movementDescription.includes('SALIÓ') ? movementPlate : null,
      });

      // ✅ Obtener el purchase_id válido que se usó para crear el movimiento
      // Si el registro era de new_purchases, el backend creó un purchase automáticamente
      // Necesitamos usar ese purchase_id para actualizar los campos de movimiento
      let validPurchaseId = selectedRow;
      
      // Buscar purchase por mq (ya que puede haberse creado automáticamente)
      if (selectedRowData?.mq) {
        try {
          const purchases = await apiGet(`/api/purchases`);
          const matchingPurchase = purchases.find((p: LogisticsRow) => p.mq === selectedRowData.mq);
          if (matchingPurchase) {
            validPurchaseId = matchingPurchase.id;
            console.log(`✅ Purchase encontrado por MQ: ${validPurchaseId} para actualizar campos de movimiento`);
          }
        } catch (searchError) {
          console.warn('⚠️ No se pudo buscar purchase por MQ, usando selectedRow:', searchError);
        }
      }

      // Actualizar current_movement en purchases usando el purchase_id válido
      // Solo actualizar conductor y placa si el movimiento incluye "SALIÓ"
      try {
        const updateData: any = {
          current_movement: movementDescription,
          current_movement_date: movementDate,
        };
        
        // Solo agregar conductor y placa si el movimiento es de tipo "SALIÓ"
        if (movementDescription.includes('SALIÓ')) {
          updateData.current_movement_plate = movementPlate;
          updateData.driver_name = driverName;
        } else {
          // Si no es "SALIÓ", limpiar estos campos
          updateData.current_movement_plate = null;
          updateData.driver_name = null;
        }
        
        await apiPut(`/api/purchases/${validPurchaseId}`, updateData);
        console.log(`✅ Campos de movimiento actualizados en purchase: ${validPurchaseId}`);
      } catch (updateError) {
        console.error('Error al actualizar current_movement:', updateError);
        // Continuar aunque falle la actualización
      }

      showSuccess('Movimiento agregado exitosamente');
      setMovementDescription('');
      setMovementDate('');
      setMovementPlate('');
      setDriverName('');
      await fetchMovements(selectedRow);
      await fetchData(); // Recargar la lista para mostrar el último movimiento
    } catch (error) {
      console.error('Error al agregar el movimiento:', error);
      showError('Error al agregar el movimiento');
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
      // Para otros formatos, usar métodos locales sin conversión de zona horaria
      const dateObj = new Date(date);
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  // Funciones helper para estilos elegantes
  const getProveedorStyle = (proveedor: string | null | undefined) => {
    if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md';
  };

  const getModeloStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md whitespace-nowrap';
  };

  const getSerialStyle = (serial: string | null | undefined) => {
    if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
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
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('logistica');
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
        module_name: 'logistica',
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
    record: LogisticsRow,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    row: LogisticsRow,
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
    row: LogisticsRow,
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

  // Cargar indicadores de cambios
  const loadChangeIndicators = async (recordIds?: string[]) => {
    if (data.length === 0) return;
    
    try {
      const idsToLoad = recordIds || data.map(d => d.id);
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
    if (!loading && data.length > 0) {
      loadChangeIndicators();
    }
  }, [data, loading]);

  const getKPIStats = () => {
    const nationalized = data.filter((row) => row.nationalization_date);
    return {
      total: nationalized.length,
      withMovements: 0, // TODO: Implementar contador real cuando tengamos la data
    };
  };

  const stats = getKPIStats();

  // Función para determinar el color de fondo de la fila (consistente con compras)
  const getRowBackgroundByMovement = () => {
    return 'bg-white hover:bg-gray-50';
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
          <div className="bg-slate-700 rounded-xl shadow-md p-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold text-white">Logística</h1>
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
                <p className="text-sm font-medium text-brand-gray">Total Nacionalizadas</p>
                <p className="text-2xl font-bold text-brand-red">{stats.total}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Package className="w-6 h-6 text-brand-red" />
              </div>
            </div>
        </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Con Movimientos</p>
                <p className="text-2xl font-bold text-green-600">{stats.withMovements}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por MQ, modelo o serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Barra de Scroll Superior - Sincronizada */}
        <div className="mb-3">
          <div 
            ref={topScrollRef}
            className="overflow-x-auto bg-gradient-to-r from-blue-100 to-gray-100 rounded-lg shadow-inner"
            style={{ height: '14px' }}
          >
            <div style={{ width: '2500px', height: '1px' }}></div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div ref={tableScrollRef} className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">CONDICIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">SHIPMENT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">FECHA FACTURA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-orange-100">FECHA PAGO</th>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">ETD</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">ETA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">PUERTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-amber-100">FECHA NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">MC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">PLACA MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">CONDUCTOR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase bg-slate-100">FECHA DE MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase sticky right-0 bg-slate-100 z-10">ACCIONES</th>
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
                      No hay máquinas nacionalizadas
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`transition-colors ${getRowBackgroundByMovement()}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">{row.supplier_name || '-'}</span>
                      </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineFieldEditor
                        value={row.machine_type || ''}
                        type="select"
                        options={MACHINE_TYPE_OPTIONS}
                        placeholder="Tipo de máquina"
                        displayFormatter={(val) => formatMachineType(val) || 'Sin tipo'}
                        onSave={async (val) => {
                          await apiPut(`/api/purchases/${row.id}`, { machine_type: val || null });
                          await fetchData();
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-semibold">
                      <span className="text-gray-800 uppercase tracking-wide">{row.brand || '-'}</span>
                    </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        <span className="text-gray-800">{row.model || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span className="text-gray-800 font-mono">{row.serial || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'year')}>
                          <span className="text-gray-800">{(row as any).year || '-'}</span>
                        </InlineCell>
                      </td>
                      
                      {/* CONDICIÓN - NUEVO o USADO */}
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
                      
                      <td className="px-4 py-3 text-sm text-gray-700">{row.shipment || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'invoice_date')}>
                          <span>{formatDate(row.invoice_date)}</span>
                        </InlineCell>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'payment_date')}>
                          <span>{formatDate(row.payment_date)}</span>
                        </InlineCell>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-bold">{row.mq || '-'}</td>
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
                        <InlineCell {...buildCellProps(row.id, 'port_of_destination')}>
                          <span className="text-gray-700">{row.port_of_destination || '-'}</span>
                        </InlineCell>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'nationalization_date')}>
                          <span className="text-gray-700">{formatDate(row.nationalization_date)}</span>
                        </InlineCell>
                      </td>
                      
                      {/* MC - Código de Movimiento */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'mc')}>
                          <InlineFieldEditor
                            value={row.mc || ''}
                            placeholder="Código MC"
                            onSave={(val) => requestFieldUpdate(row, 'mc', 'Código MC', val)}
                            displayFormatter={(val) => {
                              if (!val || val === '') {
                                return <span className="px-2 py-1 rounded-lg text-xs bg-red-100 text-red-600 border border-red-300">Sin MC</span>;
                              }
                              return <span className="px-2 py-1 rounded-lg font-bold text-sm bg-yellow-100 text-yellow-900 border-2 border-yellow-400 shadow-sm">{String(val)}</span>;
                            }}
                          />
                        </InlineCell>
                      </td>
                      
                      {/* MOVIMIENTO - Mostrar último movimiento */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'current_movement')}>
                          <InlineFieldEditor
                            value={row.current_movement || ''}
                            placeholder="Movimiento actual"
                            onSave={(val) => requestFieldUpdate(row, 'current_movement', 'Movimiento actual', val)}
                          />
                        </InlineCell>
                      </td>
                      
                      {/* PLACA MOVIMIENTO */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'current_movement_plate')}>
                          <InlineFieldEditor
                            value={row.current_movement_plate || ''}
                            placeholder="Placa"
                            onSave={(val) => requestFieldUpdate(row, 'current_movement_plate', 'Placa', val)}
                            displayFormatter={(val) => {
                              if (!val || val === '') return '-';
                              return <span className="px-2 py-1 rounded-lg font-semibold text-sm bg-blue-100 text-blue-800 border border-blue-200">{String(val)}</span>;
                            }}
                          />
                        </InlineCell>
                      </td>
                      
                      {/* CONDUCTOR */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'driver_name')}>
                          <InlineFieldEditor
                            value={row.driver_name || ''}
                            placeholder="Conductor"
                            onSave={(val) => requestFieldUpdate(row, 'driver_name', 'Conductor', val)}
                            displayFormatter={(val) => {
                              if (!val || val === '') return '-';
                              return <span className="text-gray-800">{String(val)}</span>;
                            }}
                          />
                        </InlineCell>
                      </td>
                      
                      {/* FECHA DE MOVIMIENTO - Mostrar última fecha */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <InlineCell {...buildCellProps(row.id, 'current_movement_date')}>
                          <InlineFieldEditor
                            value={row.current_movement_date ? new Date(row.current_movement_date).toISOString().split('T')[0] : ''}
                            type="date"
                            placeholder="Fecha movimiento"
                            onSave={(val) =>
                              requestFieldUpdate(
                                row,
                                'current_movement_date',
                                'Fecha movimiento',
                                typeof val === 'string' && val ? new Date(val).toISOString() : null,
                                {
                                  current_movement_date: typeof val === 'string' && val ? new Date(val).toISOString() : null,
                                }
                              )
                            }
                            displayFormatter={(val) =>
                              val ? formatDate(String(val)) : '-'
                            }
                          />
                        </InlineCell>
                      </td>
                      
                      <td className="px-4 py-3 text-sm text-gray-700 sticky right-0 bg-white z-10" style={{ minWidth: 180 }}>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleViewTimeline(row)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              console.log('🔍 Abriendo historial de Logistics:', row.id, 'Purchase ID:', row.id);
                              setHistoryRecord(row);
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
        </div>

        {/* Modal de Trazabilidad */}
        {selectedRow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            >
              <div className="p-6 border-b">
                <div className="flex justify-between items-start">
                  <div>
                  <h2 className="text-2xl font-bold text-gray-900">Trazabilidad de Máquina</h2>
                    {selectedRowData && (
                      <div className="mt-2 flex gap-4 text-sm">
                        <span className="text-gray-600">
                          <span className="font-semibold text-gray-700">Modelo:</span> {selectedRowData.model || 'N/A'}
                        </span>
                        <span className="text-gray-600">
                          <span className="font-semibold text-gray-700">Serie:</span> {selectedRowData.serial || 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRow(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Formulario para agregar MC (Código de Movimiento) */}
                <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                  <h3 className="text-lg font-bold mb-2 text-yellow-900 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    Código MC (Requerido)
                  </h3>
                  <p className="text-xs text-yellow-800 mb-4">
                    Debe ingresar el código MC antes de poder registrar movimientos logísticos
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={mcCode}
                      onChange={(e) => setMcCode(e.target.value.toUpperCase())}
                      placeholder="Ingrese código MC (ej: MC-2024-001)"
                      className="flex-1 px-4 py-2 border-2 border-yellow-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 font-bold"
                      disabled={!!selectedRowData?.mc}
                    />
                    <button
                      onClick={handleSaveMC}
                      disabled={!!selectedRowData?.mc || !mcCode || mcCode.trim() === ''}
                      className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                        selectedRowData?.mc 
                          ? 'bg-green-500 text-white cursor-not-allowed' 
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      }`}
                    >
                      {selectedRowData?.mc ? '✓ MC Guardado' : 'Guardar MC'}
                    </button>
                  </div>
                  {selectedRowData?.mc && (
                    <p className="text-sm text-green-700 mt-2 font-semibold flex items-center gap-2">
                      <span className="text-xl">✓</span>
                      MC autorizado: <span className="px-3 py-1 bg-green-100 border-2 border-green-400 rounded-lg">{selectedRowData.mc}</span>
                    </p>
                  )}
                </div>

                {/* Formulario para agregar movimiento */}
                <div className={`mb-6 p-4 rounded-lg transition-all ${
                  selectedRowData?.mc 
                    ? 'bg-green-50 border-2 border-green-400' 
                    : 'bg-gray-100 border-2 border-gray-300 opacity-60'
                }`}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    {selectedRowData?.mc ? '✓' : '🔒'} Agregar Movimiento
                    {!selectedRowData?.mc && <span className="text-xs text-red-600 font-normal">(Requiere código MC)</span>}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción del Movimiento
                      </label>
                      <select
                        value={movementDescription}
                        onChange={(e) => setMovementDescription(e.target.value)}
                        disabled={!selectedRowData?.mc}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="PARQUEADERO CARTAGENA">PARQUEADERO CARTAGENA</option>
                        <option value="PARQUEADERO BUENAVENTURA">PARQUEADERO BUENAVENTURA</option>
                        <option value="EN GUARNE">EN GUARNE</option>
                        <option value="EN BOGOTÁ">EN BOGOTÁ</option>
                        <option value="EN BARRANQUILLA">EN BARRANQUILLA</option>
                        <option value="SALIÓ PARA CALI">SALIÓ PARA CALI</option>
                        <option value="SALIÓ PARA GUARNE">SALIÓ PARA GUARNE</option>
                        <option value="SALIÓ PARA BOGOTÁ">SALIÓ PARA BOGOTÁ</option>
                        <option value="ENTREGADO A CLIENTE">ENTREGADO A CLIENTE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Placa Movimiento {!movementDescription.includes('SALIÓ') && movementDescription && (
                          <span className="text-xs text-gray-500 italic">(Solo para movimientos de salida)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={movementPlate}
                        onChange={(e) => setMovementPlate(e.target.value)}
                        placeholder={movementDescription.includes('SALIÓ') ? "Ej: ABC123" : "Solo para SALIÓ"}
                        disabled={!selectedRowData?.mc || !movementDescription.includes('SALIÓ')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Conductor {!movementDescription.includes('SALIÓ') && movementDescription && (
                          <span className="text-xs text-gray-500 italic">(Solo para movimientos de salida)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder={movementDescription.includes('SALIÓ') ? "Nombre del conductor" : "Solo para SALIÓ"}
                        disabled={!selectedRowData?.mc || !movementDescription.includes('SALIÓ')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha del Movimiento
                      </label>
                      <input
                        type="date"
                        value={movementDate}
                        onChange={(e) => setMovementDate(e.target.value)}
                        disabled={!selectedRowData?.mc}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddMovement}
                    disabled={!selectedRowData?.mc}
                    className={`px-4 py-2 rounded flex items-center gap-2 font-semibold transition-all ${
                      selectedRowData?.mc
                        ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    {selectedRowData?.mc ? 'Agregar Movimiento' : '🔒 MC Requerido'}
                  </button>
                </div>

                {/* Línea de tiempo */}
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-red-300"></div>
                  <div className="space-y-4">
                    {movements.map((movement, index) => (
                      <div key={movement.id} className="relative flex items-start gap-4">
                        <div className="relative z-10">
                          <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center text-white font-bold">
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-900">{movement.movement_description}</h4>
                            <span className="text-sm text-gray-500">{formatDate(movement.movement_date)}</span>
                          </div>
                          {movement.movement_description?.includes('SALIÓ') && (movement.driver_name || movement.movement_plate) && (
                            <div className="mt-2 space-y-1 mb-2">
                              {movement.driver_name && (
                                <p className="text-sm text-gray-700">
                                  <span className="font-semibold">Conductor:</span> {movement.driver_name}
                                </p>
                              )}
                              {movement.movement_plate && (
                                <p className="text-sm text-gray-700">
                                  <span className="font-semibold">Vehículo:</span> {movement.movement_plate}
                                </p>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-gray-600">
                            Registrado: {new Date(movement.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Archivos de Logística */}
                <div className="mt-8">
                  {(() => {
                    const row = data.find(r => r.id === selectedRow);
                    const machineId = (row as any)?.machine_id;
                    return machineId ? (
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
                          machineId={machineId}
                          allowUpload={true}
                          allowDelete={true}
                          currentScope="LOGISTICA"
                          uploadExtraFields={{ scope: 'LOGISTICA' }}
                        />
                        )}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-yellow-400 p-3 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-yellow-900">Archivos no disponibles</h3>
                            <p className="text-sm text-yellow-800">No hay información de máquina asociada a este registro.</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Historial */}
        <Modal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          title="Historial de Cambios - Todos los Módulos"
          size="lg"
        >
          {historyRecord && (
            <ChangeHistory 
              tableName="purchases" 
              recordId={historyRecord.id}
              purchaseId={historyRecord.id}
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
    </div>
  );
};

