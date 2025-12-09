import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Calendar, AlertCircle, CheckCircle, Clock, Eye, Edit, History, Layers, Save, X } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../services/api';
import { ChangeHistory } from '../components/ChangeHistory';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { Card } from '../molecules/Card';
import { DataTable } from '../organisms/DataTable';
import { Modal } from '../molecules/Modal';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { Spinner } from '../atoms/Spinner';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { showSuccess, showError } from '../components/Toast';

interface Pago {
  id: string;
  mq: string;
  condition: string;
  no_factura: string;
  fecha_factura: string;
  vencimiento: string | null;
  proveedor: string;
  empresa: string;
  moneda: string;
  tasa: number;
  trm_rate: number | null;
  usd_jpy_rate: number | null;
  payment_date: string | null;
  valor_factura_proveedor: number;
  observaciones_pagos: string;
  pendiente_a: string;
  fecha_vto_fact: string;
  modelo: string;
  serie: string;
}

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

const PagosPage: React.FC = () => {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPendiente, setFilterPendiente] = useState('');
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Pago>>({});
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { pagoId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());

  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const pendingChangeRef = useRef<{
    pagoId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  // Opciones para Pendiente A
  const pendienteOptions = [
    'PROVEEDORES MAQUITECNO',
    'PROVEEDORES PARTEQUIPOS MAQUINARIA',
    'PROVEEDORES SOREMAQ'
  ];

  useEffect(() => {
    fetchPagos();
  }, []);

  // Cargar indicadores de cambios desde el backend
  useEffect(() => {
    const loadChangeIndicators = async () => {
      if (pagos.length === 0) return;
      
      try {
        const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
        
        // Cargar cambios para cada pago
        await Promise.all(
          pagos.map(async (pago) => {
            try {
              const changes = await apiGet<Array<{
                id: string;
                field_name: string;
                field_label: string;
                old_value: string | number | null;
                new_value: string | number | null;
                change_reason: string | null;
                changed_at: string;
                module_name: string | null;
              }>>(`/api/change-logs/purchases/${pago.id}`);
              
              if (changes && changes.length > 0) {
                indicatorsMap[pago.id] = changes.slice(0, 10).map((change) => ({
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
            } catch {
              // Silenciar errores individuales (puede que no haya cambios)
              console.debug('No se encontraron cambios para pago:', pago.id);
            }
          })
        );
        
        setInlineChangeIndicators(indicatorsMap);
      } catch (error) {
        console.error('Error al cargar indicadores de cambios:', error);
      }
    };
    
    if (!loading && pagos.length > 0) {
      loadChangeIndicators();
    }
  }, [pagos, loading]);

  const fetchPagos = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/pagos');
      setPagos(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar pagos');
      console.error('Error fetching pagos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pago: Pago) => {
    setSelectedPago(pago);
    setEditData({
      fecha_factura: pago.fecha_factura,
      proveedor: pago.proveedor,
      no_factura: pago.no_factura,
      mq: pago.mq,
      moneda: pago.moneda,
      tasa: pago.tasa,
      trm_rate: pago.trm_rate,
      usd_jpy_rate: pago.usd_jpy_rate,
      payment_date: pago.payment_date,
      valor_factura_proveedor: pago.valor_factura_proveedor,
      observaciones_pagos: pago.observaciones_pagos,
      pendiente_a: pago.pendiente_a,
      fecha_vto_fact: pago.fecha_vto_fact
    });
    setIsEditModalOpen(true);
  };

  const handleView = (pago: Pago) => {
    setSelectedPago(pago);
    setIsViewModalOpen(true);
  };

  const handleViewHistory = (pago: Pago) => {
    setSelectedPago(pago);
    setIsChangeLogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPago) return;

    try {
      // Solo enviar los campos editables: Contravalor, TRM, Fecha de Pago y Observaciones
      await apiPut(`/api/pagos/${selectedPago.id}`, {
        trm_rate: editData.trm_rate ?? null,
        usd_jpy_rate: editData.usd_jpy_rate ?? null,
        payment_date: editData.payment_date || null,
        observaciones_pagos: editData.observaciones_pagos || null
      });

      setIsEditModalOpen(false);
      fetchPagos();
    } catch (err: any) {
      console.error('Error updating pago:', err);
      alert('Error al actualizar el pago');
    }
  };

  // Funciones para manejar cambios inline
  const getFieldIndicators = (
    indicators: Record<string, InlineChangeIndicator[]>,
    recordId: string,
    fieldName: string
  ) => {
    return (indicators[recordId] || []).filter((log) => log.fieldName === fieldName);
  };

  const getModuleLabel = (moduleName: string | null | undefined): string => {
    if (!moduleName) return 'Pagos';
    const moduleMap: Record<string, string> = {
      'compras': 'Compras',
      'pagos': 'Pagos',
      'preselections': 'Preselección',
      'auctions': 'Subastas',
      'management': 'Consolidado',
      'logistics': 'Logística',
      'importations': 'Importaciones',
      'equipments': 'Equipos',
      'service': 'Servicio',
    };
    return moduleMap[moduleName.toLowerCase()] || moduleName;
  };

  const formatChangeValue = (value: string | number | null): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') return value.toLocaleString('es-CO');
    return String(value);
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
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('pagos');
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

  const normalizeForCompare = (value: string | number | boolean | null): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
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

  const mapValueForLog = (value: string | number | boolean | null): string | number | null => {
    return value;
  };

  const queueInlineChange = (
    pagoId: string,
    updates: Record<string, unknown>,
    changeItem: InlineChangeItem
  ) => {
    // Si el modo batch está activo, acumular cambios en lugar de abrir el modal
    if (batchModeEnabled) {
      setPendingBatchChanges((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(pagoId);
        
        if (existing) {
          // Combinar updates y agregar el nuevo cambio
          const mergedUpdates = { ...existing.updates, ...updates };
          const mergedChanges = [...existing.changes, changeItem];
          newMap.set(pagoId, {
            pagoId,
            updates: mergedUpdates,
            changes: mergedChanges,
          });
        } else {
          newMap.set(pagoId, {
            pagoId,
            updates,
            changes: [changeItem],
          });
        }
        
        return newMap;
      });
      
      // En modo batch, guardar en BD inmediatamente para reflejar cambios visualmente
      // pero NO registrar en control de cambios hasta que se confirme
      return apiPut(`/api/pagos/${pagoId}`, updates)
        .then(() => fetchPagos())
        .catch((error) => {
          console.error('Error guardando cambio en modo batch:', error);
          throw error;
        });
    }
    
    // Modo normal: abrir modal inmediatamente
    return new Promise<void>((resolve, reject) => {
      pendingChangeRef.current = {
        pagoId,
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
    const allUpdatesByPago = new Map<string, { pagoId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>();
    const allChanges: InlineChangeItem[] = [];
    
    pendingBatchChanges.forEach((batch) => {
      allChanges.push(...batch.changes);
      allUpdatesByPago.set(batch.pagoId, batch);
    });

    try {
      // Solo registrar cambios en el log (los datos ya están guardados en BD)
      const logPromises = Array.from(allUpdatesByPago.values()).map(async (batch) => {
        // Registrar cambios en el log
        await apiPost('/api/change-logs', {
          table_name: 'purchases',
          record_id: batch.pagoId,
          changes: batch.changes,
          change_reason: reason || null,
          module_name: 'pagos',
        });

        // Actualizar indicadores
        batch.changes.forEach((change) => {
          const indicator: InlineChangeIndicator = {
            id: `${batch.pagoId}-${change.field_name}-${Date.now()}`,
            fieldName: change.field_name,
            fieldLabel: change.field_label,
            oldValue: change.old_value,
            newValue: change.new_value,
            reason,
            changedAt: new Date().toISOString(),
          };
          setInlineChangeIndicators((prev) => ({
            ...prev,
            [batch.pagoId]: [indicator, ...(prev[batch.pagoId] || [])].slice(0, 10),
          }));
        });
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
    if (pending.pagoId === 'BATCH_MODE') {
      await confirmBatchChanges(reason);
      return;
    }
    
    try {
      await apiPut(`/api/pagos/${pending.pagoId}`, pending.updates);
      await apiPost('/api/change-logs', {
        table_name: 'purchases',
        record_id: pending.pagoId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'pagos',
      });
      const indicator: InlineChangeIndicator = {
        id: `${pending.pagoId}-${Date.now()}`,
        fieldName: pending.changes[0].field_name,
        fieldLabel: pending.changes[0].field_label,
        oldValue: pending.changes[0].old_value,
        newValue: pending.changes[0].new_value,
        reason,
        changedAt: new Date().toISOString(),
      };
      setInlineChangeIndicators((prev) => ({
        ...prev,
        [pending.pagoId]: [indicator, ...(prev[pending.pagoId] || [])].slice(0, 10),
      }));
      pendingResolveRef.current?.();
      showSuccess('Dato actualizado');
      fetchPagos();
    } catch (error) {
      pendingRejectRef.current?.(error);
      showError('Error al actualizar el dato');
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
    record: Pago,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    pago: Pago,
    fieldName: string,
    fieldLabel: string,
    oldValue: string | number | boolean | null,
    newValue: string | number | boolean | null,
    updates: Record<string, unknown>
  ) => {
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) {
      return Promise.resolve();
    }
    return queueInlineChange(pago.id, updates, {
      field_name: fieldName,
      field_label: fieldLabel,
      old_value: mapValueForLog(oldValue),
      new_value: mapValueForLog(newValue),
    });
  };

  const requestFieldUpdate = async (
    pago: Pago,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>
  ) => {
    const currentValue = getRecordFieldValue(pago, fieldName);
    
    // MEJORA: Si el campo está vacío y se agrega un valor, NO solicitar control de cambios
    // Solo solicitar control de cambios cuando se MODIFICA un valor existente
    const isCurrentValueEmpty = isValueEmpty(currentValue);
    const isNewValueEmpty = isValueEmpty(newValue);
    
    // Si el campo estaba vacío y ahora se agrega un valor, guardar directamente sin control de cambios
    if (isCurrentValueEmpty && !isNewValueEmpty) {
      const updatesToApply = updates ?? { [fieldName]: newValue };
      await apiPut(`/api/pagos/${pago.id}`, updatesToApply);
      // Actualizar estado local
      setPagos(prev => prev.map(r => 
        r.id === pago.id ? { ...r, ...updatesToApply } : r
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
      pago,
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
      pagoId: 'BATCH_MODE',
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

  // Filtrado
  const filteredPagos = pagos.filter((pago) => {
    const matchesSearch =
      searchTerm === '' ||
      pago.mq?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pago.proveedor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pago.no_factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pago.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pago.serie?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPendiente =
      filterPendiente === '' || pago.pendiente_a === filterPendiente;

    return matchesSearch && matchesPendiente;
  });

  // Configuración de columnas
  const columns = [
    {
      key: 'fecha_factura',
      label: 'FECHA FACTURA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">
          {row.fecha_factura ? new Date(row.fecha_factura).toLocaleDateString('es-CO') : '-'}
        </span>
      )
    },
    {
      key: 'vencimiento',
      label: 'VENCIMIENTO',
      sortable: true,
      render: (row: Pago) => {
        // ✅ Solo mostrar para registros de new_purchases (condition === 'NUEVO')
        if (row.condition === 'NUEVO') {
          return (
            <span className="text-sm text-gray-700">
              {row.vencimiento ? new Date(row.vencimiento).toLocaleDateString('es-CO') : '-'}
            </span>
          );
        }
        return <span className="text-sm text-gray-400">-</span>;
      }
    },
    {
      key: 'proveedor',
      label: 'PROVEEDOR',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.proveedor || '-'}</span>
      )
    },
    {
      key: 'empresa',
      label: 'EMPRESA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.empresa || '-'}</span>
      )
    },
    {
      key: 'no_factura',
      label: 'NO. FACTURA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.no_factura || '-'}</span>
      )
    },
    {
      key: 'mq',
      label: 'MQ',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.mq || '-'}</span>
      )
    },
    {
      key: 'condition',
      label: 'CONDICIÓN',
      sortable: true,
      render: (row: Pago) => {
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
      }
    },
    {
      key: 'modelo',
      label: 'MODELO',
      sortable: true,
      render: (row: Pago) => <span className="text-sm text-gray-700">{row.modelo || '-'}</span>
    },
    {
      key: 'serie',
      label: 'SERIE',
      sortable: true,
      render: (row: Pago) => <span className="text-sm text-gray-700">{row.serie || '-'}</span>
    },
    {
      key: 'moneda',
      label: 'MONEDA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.moneda || '-'}</span>
      )
    },
    {
      key: 'usd_jpy_rate',
      label: 'CONTRAVALOR',
      sortable: true,
      render: (row: Pago) => (
        <InlineCell {...buildCellProps(row.id, 'usd_jpy_rate')}>
          <InlineFieldEditor
            type="number"
            value={row.usd_jpy_rate ?? null}
            placeholder="PDTE"
            displayFormatter={() =>
              row.usd_jpy_rate !== null && row.usd_jpy_rate !== undefined
                ? row.usd_jpy_rate.toLocaleString('es-CO')
                : 'PDTE'
            }
            onSave={(val) => {
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              return requestFieldUpdate(row, 'usd_jpy_rate', 'Contravalor', numeric);
            }}
          />
        </InlineCell>
      )
    },
    {
      key: 'trm_rate',
      label: 'TRM',
      sortable: true,
      render: (row: Pago) => (
        <InlineCell {...buildCellProps(row.id, 'trm_rate')}>
          <InlineFieldEditor
            type="number"
            value={row.trm_rate ?? null}
            placeholder="PDTE"
            displayFormatter={() =>
              row.trm_rate !== null && row.trm_rate !== undefined
                ? row.trm_rate.toLocaleString('es-CO')
                : 'PDTE'
            }
            onSave={(val) => {
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              return requestFieldUpdate(row, 'trm_rate', 'TRM', numeric);
            }}
          />
        </InlineCell>
      )
    },
    {
      key: 'payment_date',
      label: 'FECHA DE PAGO',
      sortable: true,
      render: (row: Pago) => (
        <InlineCell {...buildCellProps(row.id, 'payment_date')}>
          <InlineFieldEditor
            type="date"
            value={row.payment_date ? new Date(row.payment_date).toISOString().split('T')[0] : null}
            placeholder="PDTE"
            displayFormatter={() =>
              row.payment_date
                ? new Date(row.payment_date).toLocaleDateString('es-CO')
                : 'PDTE'
            }
            onSave={(val) => {
              return requestFieldUpdate(row, 'payment_date', 'Fecha de Pago', val);
            }}
          />
        </InlineCell>
      )
    },
    {
      key: 'actions',
      label: 'ACCIONES',
      sortable: false,
      render: (row: Pago) => (
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
            onClick={() => handleViewHistory(row)}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Historial de cambios"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  // Color coding de filas - mismo estilo que compras
  const getRowClassName = (row: Pago) => {
    return 'bg-white hover:bg-gray-50';
  };

  // Sincronizar scroll superior con tabla
  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;

    if (!topScroll || !tableScroll) return;

    const handleTopScroll = () => {
      if (tableScroll) {
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
  }, [filteredPagos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Pagos</h1>
            <p className="text-sm text-gray-600">Gestión de pagos a proveedores</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-semibold uppercase">Total Pagos</p>
              <p className="text-2xl font-bold text-blue-800">{filteredPagos.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-semibold uppercase">Con Valor</p>
              <p className="text-2xl font-bold text-green-800">
                {filteredPagos.filter(p => p.valor_factura_proveedor && p.valor_factura_proveedor > 0).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600 font-semibold uppercase">Próximos a Vencer</p>
              <p className="text-2xl font-bold text-orange-800">
                {filteredPagos.filter(p => {
                  if (!p.fecha_vto_fact) return false;
                  const dias = Math.ceil((new Date(p.fecha_vto_fact).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  return dias > 0 && dias <= 7;
                }).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 font-semibold uppercase">Vencidos</p>
              <p className="text-2xl font-bold text-red-800">
                {filteredPagos.filter(p => {
                  if (!p.fecha_vto_fact) return false;
                  const dias = Math.ceil((new Date(p.fecha_vto_fact).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  return dias < 0;
                }).length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Buscar"
            placeholder="MQ, proveedor, factura, modelo, serie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            label="Filtrar por Pendiente A"
            value={filterPendiente}
            onChange={(e) => setFilterPendiente(e.target.value)}
            options={[
              { value: '', label: 'Todos' },
              ...pendienteOptions.map(opt => ({ value: opt, label: opt }))
            ]}
          />
        </div>
        {/* Toggle Modo Masivo */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="flex items-center gap-2 cursor-pointer">
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
      </Card>

      {error && (
        <Card className="p-4 bg-red-50 border-l-4 border-red-500">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {/* Tabla */}
      <Card>
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

        <DataTable
          columns={columns}
          data={filteredPagos}
          rowClassName={getRowClassName}
          scrollRef={tableScrollRef}
        />
      </Card>

      {/* Modal Ver */}
      {selectedPago && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title={`Ver Pago - ${selectedPago.mq || 'Sin MQ'}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">MQ</p>
                <p className="text-lg font-bold text-brand-red">{selectedPago.mq || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">No. Factura</p>
                <p className="text-lg font-semibold text-indigo-600">{selectedPago.no_factura || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Fecha Factura</p>
                <p className="text-sm">
                  {selectedPago.fecha_factura ? new Date(selectedPago.fecha_factura).toLocaleDateString('es-CO') : '-'}
                </p>
              </div>
              {/* ✅ VENCIMIENTO: Solo para registros de new_purchases */}
              {selectedPago.condition === 'NUEVO' && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Vencimiento</p>
                  <p className="text-sm">
                    {selectedPago.vencimiento ? new Date(selectedPago.vencimiento).toLocaleDateString('es-CO') : '-'}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Proveedor</p>
                <p className="text-sm font-medium">{selectedPago.proveedor || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Empresa</p>
                <p className="text-sm font-medium">{selectedPago.empresa || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Modelo</p>
                <p className="text-sm">{selectedPago.modelo || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Serie</p>
                <p className="text-sm">{selectedPago.serie || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Moneda</p>
                <p className="text-sm font-semibold text-purple-600">{selectedPago.moneda || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Contravalor</p>
                <p className="text-sm font-semibold text-gray-800">
                  {selectedPago.usd_jpy_rate !== null && selectedPago.usd_jpy_rate !== undefined
                    ? selectedPago.usd_jpy_rate.toLocaleString('es-CO')
                    : 'PDTE'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">TRM</p>
                <p className="text-sm font-semibold text-gray-800">
                  {selectedPago.trm_rate !== null && selectedPago.trm_rate !== undefined
                    ? selectedPago.trm_rate.toLocaleString('es-CO')
                    : 'PDTE'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Fecha de Pago</p>
                <p className="text-sm text-gray-700">
                  {selectedPago.payment_date
                    ? new Date(selectedPago.payment_date).toLocaleDateString('es-CO')
                    : 'PDTE'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Tasa</p>
                <p className="text-sm">{selectedPago.tasa ? selectedPago.tasa.toLocaleString('es-CO') : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Valor Factura</p>
                <p className="text-lg font-bold text-green-600">
                  {selectedPago.valor_factura_proveedor
                    ? `$${selectedPago.valor_factura_proveedor.toLocaleString('es-CO')}`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Pendiente A</p>
                <p className="text-sm font-medium">{selectedPago.pendiente_a || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase font-semibold">Fecha Vencimiento</p>
                <p className="text-sm">
                  {selectedPago.fecha_vto_fact ? new Date(selectedPago.fecha_vto_fact).toLocaleDateString('es-CO') : '-'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase font-semibold">Observaciones</p>
                <p className="text-sm text-gray-700">{selectedPago.observaciones_pagos || '-'}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Editar */}
      {selectedPago && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Editar Pago - ${selectedPago.mq || 'Sin MQ'}${selectedPago.modelo ? ` | ${selectedPago.modelo}` : ''}${selectedPago.serie ? ` | ${selectedPago.serie}` : ''}`}
        >
          <div className="space-y-4">
            {/* Información de solo lectura */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Información del Pago</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">MQ</p>
                  <p className="text-gray-800 font-medium">{selectedPago.mq || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">No. Factura</p>
                  <p className="text-gray-800 font-medium">{selectedPago.no_factura || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Proveedor</p>
                  <p className="text-gray-800 font-medium">{selectedPago.proveedor || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Empresa</p>
                  <p className="text-gray-800 font-medium">{selectedPago.empresa || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Moneda</p>
                  <p className="text-gray-800 font-medium">{selectedPago.moneda || '-'}</p>
                </div>
              </div>
            </div>

            {/* Campos editables */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Contravalor"
                type="number"
                value={editData.usd_jpy_rate ?? ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    usd_jpy_rate: e.target.value === '' ? null : parseFloat(e.target.value)
                  })
                }
              />
              <Input
                label="TRM"
                type="number"
                value={editData.trm_rate ?? ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    trm_rate: e.target.value === '' ? null : parseFloat(e.target.value)
                  })
                }
              />
              <Input
                label="Fecha de Pago"
                type="date"
                value={editData.payment_date ? new Date(editData.payment_date).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditData({ ...editData, payment_date: e.target.value || null })}
              />
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={editData.observaciones_pagos || ''}
                  onChange={(e) => setEditData({ ...editData, observaciones_pagos: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Historial de Cambios */}
      {selectedPago && (
        <Modal
          isOpen={isChangeLogOpen}
          onClose={() => setIsChangeLogOpen(false)}
          title={`Historial de Cambios - ${selectedPago.mq || 'Pago'}`}
        >
          <ChangeHistory
            tableName="purchases"
            recordId={selectedPago.id}
          />
        </Modal>
      )}

      {/* Modal de Control de Cambios */}
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

export default PagosPage;

