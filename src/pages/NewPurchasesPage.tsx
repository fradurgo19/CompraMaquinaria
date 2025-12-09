/**
 * Página de COMPRAS NUEVOS - Diseño Premium Empresarial
 * Módulo para Jefe Comercial, Admin y Gerencia
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Search, Package, DollarSign, Truck, Eye, Pencil, Trash2, FileText, Clock, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Modal } from '../molecules/Modal';
import { NewPurchase } from '../types/database';
import { useNewPurchases } from '../hooks/useNewPurchases';
import { showSuccess, showError } from '../components/Toast';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { apiPost, apiPut } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { EQUIPMENT_TYPES, getDefaultSpecsForModel, ModelSpecs, EquipmentSpecs } from '../constants/equipmentSpecs';
import { BRAND_OPTIONS } from '../constants/brands';
import { MODEL_OPTIONS } from '../constants/models';
import { AUCTION_SUPPLIERS } from '../organisms/PreselectionForm';
import { ModelSpecsManager } from '../components/ModelSpecsManager';
import { Settings, Layers, Save, X } from 'lucide-react';
import { apiGet } from '../services/api';

export const NewPurchasesPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<NewPurchase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [purchaseOrderFilter, setPurchaseOrderFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [mqFilter, setMqFilter] = useState('');
  const [formData, setFormData] = useState<Partial<NewPurchase> & { quantity?: number }>({});
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [isSpecsManagerOpen, setIsSpecsManagerOpen] = useState(false);
  const [dynamicSpecs, setDynamicSpecs] = useState<ModelSpecs[]>([]);
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { recordId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());
  
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

  const { newPurchases, isLoading, createNewPurchase, updateNewPurchase, deleteNewPurchase, refetch } = useNewPurchases();
  const { user } = useAuth();

  // Listas únicas para selects de edición inline
  const uniqueSuppliers = useMemo(
    () => [...new Set(newPurchases.map(p => p.supplier_name).filter(Boolean))].sort() as string[],
    [newPurchases]
  );
  const uniqueBrands = useMemo(
    () => [...new Set(newPurchases.map(p => p.brand).filter(Boolean))].sort() as string[],
    [newPurchases]
  );
  const uniqueModels = useMemo(
    () => [...new Set(newPurchases.map(p => p.model).filter(Boolean))].sort() as string[],
    [newPurchases]
  );

  // Lista combinada de modelos: uniqueModels + MODEL_OPTIONS + modelos de especificaciones, ordenada alfabéticamente
  const allModels = useMemo(() => {
    const modelsSet = new Set<string>();
    
    // Agregar modelos de newPurchases
    uniqueModels.forEach(model => modelsSet.add(model));
    
    // Agregar modelos de MODEL_OPTIONS
    MODEL_OPTIONS.forEach(model => modelsSet.add(model));
    
    // Agregar modelos de especificaciones dinámicas
    dynamicSpecs.forEach(spec => {
      if (spec.model) {
        modelsSet.add(spec.model);
      }
    });
    
    // Ordenar alfabéticamente
    return Array.from(modelsSet).sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }));
  }, [uniqueModels, dynamicSpecs]);
  const uniquePurchaseOrders = useMemo(
    () => [...new Set(newPurchases.map(p => p.purchase_order).filter(Boolean))].sort() as string[],
    [newPurchases]
  );
  const uniqueMqs = useMemo(
    () => [...new Set(newPurchases.map(p => p.mq).filter(Boolean))].sort() as string[],
    [newPurchases]
  );

  // Sincronizar scroll
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

    // Actualizar el ancho del scroll superior cuando cambie el ancho de la tabla
    const updateScrollWidth = () => {
      if (tableScroll && topScroll) {
        const scrollWidth = tableScroll.scrollWidth;
        const scrollDiv = topScroll.querySelector('div');
        if (scrollDiv) {
          scrollDiv.style.width = `${scrollWidth}px`;
        }
      }
    };

    // Actualizar inicialmente y cuando cambie el tamaño
    updateScrollWidth();
    const resizeObserver = new ResizeObserver(updateScrollWidth);
    if (tableScroll) {
      resizeObserver.observe(tableScroll);
    }

    topScroll.addEventListener('scroll', handleTopScroll);
    tableScroll.addEventListener('scroll', handleTableScroll);

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableScroll.removeEventListener('scroll', handleTableScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  const filteredPurchases = newPurchases.filter((purchase) => {
    // Filtro de búsqueda general
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !purchase.mq?.toLowerCase().includes(search) &&
        !purchase.model?.toLowerCase().includes(search) &&
        !purchase.serial?.toLowerCase().includes(search) &&
        !purchase.supplier_name?.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    
    // Filtros de columnas
    if (brandFilter && purchase.brand !== brandFilter) return false;
    if (purchaseOrderFilter && purchase.purchase_order !== purchaseOrderFilter) return false;
    if (modelFilter && purchase.model !== modelFilter) return false;
    if (mqFilter && purchase.mq !== mqFilter) return false;
    
    return true;
  });

  // Estadísticas
  const totalNew = filteredPurchases.filter(p => p.condition === 'NUEVO').length;
  const totalUsed = filteredPurchases.filter(p => p.condition === 'USADO').length;
  const totalValue = filteredPurchases.reduce((sum, p) => sum + (p.value || 0), 0);
  const inTransit = filteredPurchases.filter(p => 
    p.shipment_departure_date && !p.shipment_arrival_date
  ).length;

  const formatCurrency = (value: number | null | undefined, currency = 'USD') => {
    if (value === null || value === undefined) return '-';
    const numValue = Number(value);
    if (isNaN(numValue)) return '-';
    // Permitir mostrar 0 si el valor es explícitamente 0
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
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

  const handleCreate = () => {
    setSelectedPurchase(null);
    setFormData({
      type: 'COMPRA DIRECTA',
      condition: 'NUEVO',
      currency: 'USD',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (purchase: NewPurchase) => {
    setSelectedPurchase(purchase);
    setFormData(purchase);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta compra?')) return;
    
    try {
      await deleteNewPurchase(id);
      showSuccess('Compra eliminada correctamente');
    } catch (error: any) {
      showError(error.message || 'Error al eliminar compra');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!formData.supplier_name || !formData.model || !formData.serial) {
      showError('Por favor complete los campos requeridos: Proveedor, Modelo, Serial');
      return;
    }

    try {
      if (selectedPurchase) {
        await updateNewPurchase(selectedPurchase.id, formData);
        showSuccess('Compra actualizada correctamente');
      } else {
        // Asegurar que quantity sea un número válido
        const quantity = formData.quantity && typeof formData.quantity === 'number' && formData.quantity >= 1 
          ? formData.quantity 
          : 1;
        
        // Crear el objeto de datos con quantity validado
        const purchaseData = { ...formData, quantity };
        
        const result = await createNewPurchase(purchaseData);
        
        if (quantity > 1 && result?.pdf_path) {
          showSuccess(`${quantity} compras creadas correctamente. PDF de orden de compra generado.`);
          // Descargar PDF usando petición autenticada
          try {
            const token = localStorage.getItem('token');
            const pdfUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/new-purchases/${result.purchases?.[0]?.id}/pdf`;
            const response = await fetch(pdfUrl, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `orden-compra-${result.purchases?.[0]?.purchase_order || 'OC'}.pdf`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            }
          } catch (pdfError) {
            console.error('Error descargando PDF:', pdfError);
            // No bloquear el flujo si falla la descarga del PDF
          }
        } else if (quantity > 1) {
          showSuccess(`${quantity} compras creadas correctamente.`);
        } else {
        showSuccess('Compra creada correctamente');
        }
      }
      
      setIsModalOpen(false);
      setFormData({});
      setSelectedPurchase(null);
    } catch (error: any) {
      showError(error.message || 'Error al guardar compra');
    }
  };

  const handleViewFiles = (purchase: NewPurchase) => {
    setSelectedPurchase(purchase);
    setIsViewOpen(true);
  };

  const handleViewHistory = (purchase: NewPurchase) => {
    setSelectedPurchase(purchase);
    setIsHistoryOpen(true);
  };

  const getConditionBadge = (condition: string | null) => {
    if (condition === 'NUEVO') {
      return 'px-3 py-1 rounded-full font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md';
    }
    return 'px-3 py-1 rounded-full font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md';
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
      'new-purchases': 'Compras Nuevas',
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
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('new-purchases');
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
      // Calcular los mergedUpdates usando el estado actual ANTES de actualizar
      // Esto asegura que guardemos TODOS los cambios acumulados, no solo el actual
      setPendingBatchChanges((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(recordId);
        
        // Calcular mergedUpdates y mergedChanges
        // IMPORTANTE: Combinar correctamente para que TODOS los campos anteriores se mantengan
        // El spread operator {...existing.updates, ...updates} ya hace esto correctamente
        const mergedUpdates: Record<string, unknown> = existing 
          ? { ...existing.updates, ...updates }
          : updates;
        const mergedChanges: InlineChangeItem[] = existing
          ? [...existing.changes, changeItem]
          : [changeItem];
        
        // Debug: Log para verificar que los updates se están combinando correctamente
        if (existing) {
          console.log('🔄 Combinando updates para', recordId, {
            existing: existing.updates,
            nuevos: updates,
            combinados: mergedUpdates
          });
        }
        
        newMap.set(recordId, {
          recordId,
          updates: mergedUpdates,
          changes: mergedChanges,
        });
        
        // Guardar en BD con TODOS los cambios acumulados (asíncrono, no bloquea)
        // IMPORTANTE: Usar apiPut directamente para evitar múltiples refetches que causan condiciones de carrera
        // El refetch completo se hará cuando se confirme el batch completo
        apiPut<NewPurchase>(`/api/new-purchases/${recordId}`, mergedUpdates)
          .then((updated) => {
            // Actualizar el estado local directamente para evitar condiciones de carrera
            // Esto asegura que la UI refleje inmediatamente los cambios sin esperar refetch completo
            console.log('✅ Guardado en BD:', recordId, mergedUpdates, 'Actualizado:', updated);
          })
          .catch((error) => {
            console.error('Error guardando cambio en modo batch:', error);
            // Si falla, remover el cambio del estado pendiente
            setPendingBatchChanges((prevState) => {
              const revertedMap = new Map(prevState);
              const revertedExisting = revertedMap.get(recordId);
              if (revertedExisting) {
                // Revertir al estado anterior si había uno
                if (revertedExisting.changes.length > 1) {
                  // Remover el último cambio
                  const revertedChanges = revertedExisting.changes.slice(0, -1);
                  // Recalcular updates sin el último cambio
                  const revertedUpdates: Record<string, unknown> = {};
                  revertedChanges.forEach((change) => {
                    revertedUpdates[change.field_name] = change.new_value;
                  });
                  revertedMap.set(recordId, {
                    recordId,
                    updates: revertedUpdates,
                    changes: revertedChanges,
                  });
                } else {
                  // Si solo había un cambio, remover completamente
                  revertedMap.delete(recordId);
                }
              }
              return revertedMap;
            });
          });
        
        return newMap;
      });
      
      // Retornar una promesa resuelta inmediatamente (el guardado es asíncrono)
      return Promise.resolve();
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
          table_name: 'new_purchases',
          record_id: batch.recordId,
          changes: batch.changes,
          change_reason: reason || null,
          module_name: 'compras_nuevos',
        });

        // Actualizar indicadores
        await loadChangeIndicators([batch.recordId]);
      });

      await Promise.all(logPromises);
      
      // Refrescar datos después de registrar cambios en el log
      await refetch();
      
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
      // Usar updateNewPurchase para mantener consistencia y actualizar el estado
      await updateNewPurchase(pending.recordId, pending.updates as Partial<NewPurchase>);
      
      // Registrar cambios en el log
      await apiPost('/api/change-logs', {
        table_name: 'new_purchases',
        record_id: pending.recordId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'compras_nuevos',
      });
      
      // Actualizar indicadores de cambios
      await loadChangeIndicators([pending.recordId]);
      
      showSuccess('Dato actualizado correctamente');
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
    record: NewPurchase,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    purchase: NewPurchase,
    fieldName: string,
    fieldLabel: string,
    oldValue: string | number | boolean | null,
    newValue: string | number | boolean | null,
    updates: Record<string, unknown>
  ) => {
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) {
      return Promise.resolve();
    }
    return queueInlineChange(purchase.id, updates, {
      field_name: fieldName,
      field_label: fieldLabel,
      old_value: mapValueForLog(oldValue),
      new_value: mapValueForLog(newValue),
    });
  };

  // Función mejorada para obtener especificaciones (primero BD, luego constantes)
  // Busca coincidencia exacta primero, luego por los primeros 4 caracteres
  const getSpecsForModel = (model: string, condition?: string): EquipmentSpecs | null => {
    if (!model) return null;
    
    const normalizedModel = model.trim().toUpperCase();
    const normalizedCondition = condition?.trim().toUpperCase();
    const modelPrefix = normalizedModel.substring(0, 4); // Primeros 4 caracteres
    
    // Primero buscar en especificaciones dinámicas (BD)
    if (dynamicSpecs.length > 0) {
      // 1. Buscar coincidencia exacta primero
      let match = dynamicSpecs.find(
        (spec) => spec.model.toUpperCase() === normalizedModel
      );
      
      // 2. Si no hay coincidencia exacta, buscar por los primeros 4 caracteres
      if (!match && modelPrefix.length >= 4) {
        match = dynamicSpecs.find(
          (spec) => spec.model.toUpperCase().substring(0, 4) === modelPrefix
        );
      }
      
      // 3. Si hay match y se especificó condición, intentar encontrar match con condición
      if (normalizedCondition && match) {
        const conditionMatch = match.condition === normalizedCondition;
        if (!conditionMatch) {
          // Buscar match exacto con condición
          const exactMatchWithCondition = dynamicSpecs.find(
            (spec) =>
              spec.model.toUpperCase() === normalizedModel &&
              spec.condition === normalizedCondition
          );
          
          // Si no hay match exacto con condición, buscar por prefijo con condición
          const prefixMatchWithCondition = !exactMatchWithCondition && modelPrefix.length >= 4
            ? dynamicSpecs.find(
                (spec) =>
                  spec.model.toUpperCase().substring(0, 4) === modelPrefix &&
                  spec.condition === normalizedCondition
              )
            : null;
          
          match = exactMatchWithCondition || prefixMatchWithCondition || match;
        }
      }
      
      if (match) {
        return match.specs;
      }
    }
    
    // Si no se encuentra en BD, usar constantes
    return getDefaultSpecsForModel(model, condition);
  };

  const requestFieldUpdate = async (
    purchase: NewPurchase,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>
  ) => {
    const currentValue = getRecordFieldValue(purchase, fieldName);
    
    // Si se cambia el modelo, establecer especificaciones por defecto
    if (fieldName === 'model' && typeof newValue === 'string' && newValue) {
      const defaultSpecs = getSpecsForModel(newValue, purchase.condition);
      if (defaultSpecs) {
        const specUpdates: Record<string, unknown> = {
          [fieldName]: newValue,
          cabin_type: defaultSpecs.cabin_type,
          wet_line: defaultSpecs.wet_line,
          dozer_blade: defaultSpecs.dozer_blade,
          track_type: defaultSpecs.track_type,
          track_width: defaultSpecs.track_width,
        };
        
        // Si el modo masivo está activo, siempre usar control de cambios
        if (batchModeEnabled) {
          return beginInlineChange(
            purchase,
            fieldName,
            fieldLabel,
            currentValue,
            newValue,
            specUpdates
          );
        }
        
        // MEJORA: Si el campo estaba vacío y ahora se agrega un valor, guardar directamente
        const isCurrentValueEmpty = isValueEmpty(currentValue);
        if (isCurrentValueEmpty) {
          // Guardar directamente sin control de cambios
          await updateNewPurchase(purchase.id, specUpdates as Partial<NewPurchase>);
          showSuccess('Dato actualizado');
          return;
        }
        
        // Si el modelo ya tenía un valor, usar control de cambios
        return beginInlineChange(
          purchase,
          fieldName,
          fieldLabel,
          currentValue,
          newValue,
          specUpdates
        );
      }
    }
    
    // MEJORA: Si el modo masivo está activo, siempre usar control de cambios
    // para que los cambios se acumulen en pendingBatchChanges
    if (batchModeEnabled) {
      return beginInlineChange(
        purchase,
        fieldName,
        fieldLabel,
        currentValue,
        newValue,
        updates ?? { [fieldName]: newValue }
      );
    }
    
    // MEJORA: Si el campo está vacío y se agrega un valor, NO solicitar control de cambios
    // Solo solicitar control de cambios cuando se MODIFICA un valor existente
    const isCurrentValueEmpty = isValueEmpty(currentValue);
    const isNewValueEmpty = isValueEmpty(newValue);
    
    // Si el campo estaba vacío y ahora se agrega un valor, guardar directamente sin control de cambios
    if (isCurrentValueEmpty && !isNewValueEmpty) {
      const updatesToApply = updates ?? { [fieldName]: newValue };
      await updateNewPurchase(purchase.id, updatesToApply as Partial<NewPurchase>);
      showSuccess('Dato actualizado');
      return;
    }
    
    // Si ambos están vacíos, no hay cambio real
    if (isCurrentValueEmpty && isNewValueEmpty) {
      return;
    }
    
    // Para otros casos (modificar un valor existente), usar control de cambios normal
    return beginInlineChange(
      purchase,
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


  // Cargar indicadores de cambios
  const loadChangeIndicators = async (recordIds?: string[]) => {
    if (newPurchases.length === 0) return;
    
    try {
      const idsToLoad = recordIds || newPurchases.map(p => p.id);
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
        table_name: 'new_purchases',
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
    if (!isLoading && newPurchases.length > 0) {
      loadChangeIndicators();
    }
  }, [newPurchases, isLoading]);

  // Cargar especificaciones dinámicas desde el backend
  useEffect(() => {
    const loadDynamicSpecs = async () => {
      try {
        const specs = await apiGet<ModelSpecs[]>('/api/model-specs');
        setDynamicSpecs(specs || []);
      } catch (error) {
        console.error('Error cargando especificaciones dinámicas:', error);
        setDynamicSpecs([]);
      }
    };
    loadDynamicSpecs();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#cf1b22] via-red-700 to-red-800 rounded-xl shadow-lg p-3 md:p-4 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Compras Nuevos</h1>
              <p className="text-red-100 text-sm mt-0.5">Gestión de equipos nuevos</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-[#cf1b22] to-red-700 rounded-lg p-3 text-white shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-xs">Equipos Nuevos</p>
              <p className="text-2xl font-bold mt-0.5">{totalNew}</p>
            </div>
            <Package className="w-8 h-8 opacity-30" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#50504f] to-gray-700 rounded-lg p-3 text-white shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-200 text-xs">Equipos Usados</p>
              <p className="text-2xl font-bold mt-0.5">{totalUsed}</p>
            </div>
            <Package className="w-8 h-8 opacity-30" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-[#cf1b22] to-red-600 rounded-lg p-3 text-white shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-xs">En Tránsito</p>
              <p className="text-2xl font-bold mt-0.5">{inTransit}</p>
            </div>
            <Truck className="w-8 h-8 opacity-30" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-[#50504f] to-gray-800 rounded-lg p-3 text-white shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-200 text-xs">Valor Total</p>
              <p className="text-xl font-bold mt-0.5">{formatCurrency(totalValue)}</p>
            </div>
            <DollarSign className="w-8 h-8 opacity-30" />
          </div>
        </motion.div>
      </div>

      {/* Buscador y Toggle Modo Masivo */}
      <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-md">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por MQ, Modelo, Serial, Proveedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 outline-none text-gray-700"
        />
        {/* Botones: ESPECIFICACIONES, NUEVA COMPRA y MODO MASIVO */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsSpecsManagerOpen(true)}
            className="bg-[#cf1b22] text-white hover:bg-red-700 text-sm px-3 py-1.5"
          >
            <Settings className="w-4 h-4 mr-1.5" />
            Especificaciones
          </Button>
          <Button onClick={handleCreate} className="bg-[#cf1b22] text-white hover:bg-red-700 text-sm px-3 py-1.5">
            <Plus className="w-4 h-4 mr-1.5" />
            Nueva Compra
          </Button>
          {/* Toggle Modo Masivo */}
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap">
            <input
              type="checkbox"
              checked={batchModeEnabled}
              onChange={async (e) => {
                const newValue = e.target.checked;
                
                // Si se está desactivando y hay cambios pendientes, preguntar primero
                if (!newValue && pendingBatchChanges.size > 0) {
                  const shouldSave = window.confirm('¿Deseas guardar los cambios pendientes antes de desactivar el modo masivo?');
                  if (shouldSave) {
                    await handleSaveBatchChanges();
                    // Esperar a que se complete el guardado antes de desactivar
                    setBatchModeEnabled(false);
                  } else {
                    handleCancelBatchChanges();
                    // Desactivar después de cancelar
                    setBatchModeEnabled(false);
                  }
                } else {
                  // Si se está activando o no hay cambios pendientes, cambiar directamente
                  setBatchModeEnabled(newValue);
                }
              }}
              className="w-4 h-4 text-[#cf1b22] focus:ring-[#cf1b22] border-gray-300 rounded"
            />
            <Layers className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Modo Masivo</span>
          </label>
        </div>
      </div>

      {/* Scroll superior sincronizado */}
      <div className="mb-3">
        <div
          ref={topScrollRef}
          className="overflow-x-auto flex-1 bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
          style={{ height: '14px' }}
        >
          <div style={{ width: '4000px', height: '1px' }}></div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div ref={tableScrollRef} className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-[#cf1b22] to-red-700 text-white">
                <th className="px-4 py-3 text-left font-semibold text-sm">AÑO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">
                  <div className="flex flex-col gap-1">
                    <span>MARCA</span>
                    <select
                      value={brandFilter}
                      onChange={(e) => setBrandFilter(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {uniqueBrands.map(brand => (
                        <option key={brand || ''} value={brand || ''}>{brand}</option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-sm">PROVEEDOR</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">
                  <div className="flex flex-col gap-1">
                    <span>OC</span>
                    <select
                      value={purchaseOrderFilter}
                      onChange={(e) => setPurchaseOrderFilter(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {uniquePurchaseOrders.map(oc => (
                        <option key={oc || ''} value={oc || ''}>{oc}</option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-sm">TIPO EQUIPO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">TIPO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">
                  <div className="flex flex-col gap-1">
                    <span>MODELO</span>
                    <select
                      value={modelFilter}
                      onChange={(e) => setModelFilter(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {allModels.map(model => (
                        <option key={model || ''} value={model || ''}>{model}</option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-sm min-w-[500px]">ESPECIFICACIONES</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">INCOTERM</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">UBICACIÓN</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">PUERTO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">MONEDA</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">VALOR</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">FLETES</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">FINANCE</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">VALOR TOTAL</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">FACTURA</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">F. FACTURA</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">VENCIMIENTO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">F. PAGO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">CONTRAVALOR</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">TRM</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">
                  <div className="flex flex-col gap-1">
                    <span>MQ</span>
                    <select
                      value={mqFilter}
                      onChange={(e) => setMqFilter(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {uniqueMqs.map(mq => (
                        <option key={mq || ''} value={mq || ''}>{mq}</option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-sm">EMPRESA</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">SERIE</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">CONDICIÓN</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">EDD</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">EDA</th>
                <th className="px-4 py-3 text-left font-semibold text-sm sticky right-0 bg-[#cf1b22] z-10">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={30} className="text-center py-8 text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={30} className="text-center py-8 text-gray-500">
                    No hay compras registradas
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase, idx) => (
                  <tr
                    key={purchase.id}
                    className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-200"
                  >
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'year')}>
                        <InlineFieldEditor
                          value={purchase.year ? String(purchase.year) : ''}
                          type="number"
                          placeholder="Año"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
                              'year',
                              'Año',
                              typeof val === 'number' ? val : (typeof val === 'string' && val ? parseInt(val) : null),
                              {
                                year: typeof val === 'number' ? val : (typeof val === 'string' && val ? parseInt(val) : null),
                              }
                            )
                          }
                          displayFormatter={(val) =>
                            val ? String(val) : '-'
                          }
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'brand')}>
                        <InlineFieldEditor
                          value={purchase.brand || ''}
                          type="select"
                          placeholder="Marca"
                          options={[
                            ...uniqueBrands.map(brand => ({ value: brand, label: brand })),
                            ...BRAND_OPTIONS.filter(b => !uniqueBrands.includes(b)).map(brand => ({ value: brand, label: brand }))
                          ]}
                          onSave={(val) => requestFieldUpdate(purchase, 'brand', 'Marca', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'supplier_name')}>
                        <InlineFieldEditor
                          value={purchase.supplier_name || ''}
                          type="select"
                          placeholder="Proveedor"
                          options={[
                            ...uniqueSuppliers.map(supplier => ({ value: supplier, label: supplier })),
                            ...AUCTION_SUPPLIERS.filter(s => !uniqueSuppliers.includes(s)).map(supplier => ({ value: supplier, label: supplier }))
                          ]}
                          onSave={(val) => requestFieldUpdate(purchase, 'supplier_name', 'Proveedor', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'purchase_order')}>
                        <InlineFieldEditor
                          value={purchase.purchase_order || ''}
                          placeholder="Orden de compra"
                          onSave={(val) => requestFieldUpdate(purchase, 'purchase_order', 'Orden de compra', val)}
                          readOnly
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'equipment_type')}>
                        <InlineFieldEditor
                          value={purchase.equipment_type || ''}
                          type="select"
                          placeholder="Tipo Equipo"
                          options={EQUIPMENT_TYPES.map(type => ({ value: type, label: type }))}
                          onSave={(val) => requestFieldUpdate(purchase, 'equipment_type', 'Tipo Equipo', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'type')}>
                        <InlineFieldEditor
                          value={purchase.type || ''}
                          type="select"
                          placeholder="Tipo"
                          options={[
                            { value: 'COMPRA DIRECTA', label: 'COMPRA DIRECTA' },
                            { value: 'SUBASTA', label: 'SUBASTA' },
                          ]}
                          onSave={(val) => requestFieldUpdate(purchase, 'type', 'Tipo', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'model')}>
                        <InlineFieldEditor
                          value={purchase.model || ''}
                          type="select"
                          placeholder="Modelo"
                          options={allModels.map(model => ({ value: model, label: model }))}
                          onSave={(val) => requestFieldUpdate(purchase, 'model', 'Modelo', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 min-w-[500px]">
                      <div className="flex flex-row gap-3 items-center flex-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 whitespace-nowrap font-medium">Cab:</span>
                          <InlineCell {...buildCellProps(purchase.id, 'cabin_type')}>
                            <InlineFieldEditor
                              value={purchase.cabin_type || ''}
                              type="select"
                              placeholder="Cabina"
                              inputClassName="min-w-[90px] max-w-[110px] px-2 py-1 text-[11px]"
                              className="min-w-[90px]"
                              options={[
                                { value: 'CANOPY', label: 'CANOPY' },
                                { value: 'CAB CERRADA', label: 'CAB CERRADA' },
                              ]}
                              onSave={(val) => requestFieldUpdate(purchase, 'cabin_type', 'Tipo Cabina', val)}
                            />
                          </InlineCell>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 whitespace-nowrap font-medium">L.H:</span>
                          <InlineCell {...buildCellProps(purchase.id, 'wet_line')}>
                            <InlineFieldEditor
                              value={purchase.wet_line || ''}
                              type="select"
                              placeholder="L.H"
                              inputClassName="min-w-[50px] max-w-[60px] px-2 py-1 text-[11px]"
                              className="min-w-[50px]"
                              options={[
                                { value: 'SI', label: 'SI' },
                                { value: 'NO', label: 'NO' },
                              ]}
                              onSave={(val) => requestFieldUpdate(purchase, 'wet_line', 'Línea Húmeda', val)}
                            />
                          </InlineCell>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 whitespace-nowrap font-medium">Hoja:</span>
                          <InlineCell {...buildCellProps(purchase.id, 'dozer_blade')}>
                            <InlineFieldEditor
                              value={purchase.dozer_blade || ''}
                              type="select"
                              placeholder="Hoja"
                              inputClassName="min-w-[50px] max-w-[60px] px-2 py-1 text-[11px]"
                              className="min-w-[50px]"
                              options={[
                                { value: 'SI', label: 'SI' },
                                { value: 'NO', label: 'NO' },
                              ]}
                              onSave={(val) => requestFieldUpdate(purchase, 'dozer_blade', 'Hoja Topadora', val)}
                            />
                          </InlineCell>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 whitespace-nowrap font-medium">Zap:</span>
                          <InlineCell {...buildCellProps(purchase.id, 'track_type')}>
                            <InlineFieldEditor
                              value={purchase.track_type || ''}
                              type="select"
                              placeholder="Zapata"
                              inputClassName="min-w-[100px] max-w-[120px] px-2 py-1 text-[11px]"
                              className="min-w-[100px]"
                              options={[
                                { value: 'STEEL TRACK', label: 'STEEL TRACK' },
                                { value: 'RUBBER TRACK', label: 'RUBBER TRACK' },
                              ]}
                              onSave={(val) => requestFieldUpdate(purchase, 'track_type', 'Tipo Zapata', val)}
                            />
                          </InlineCell>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 whitespace-nowrap font-medium">Ancho:</span>
                          <InlineCell {...buildCellProps(purchase.id, 'track_width')}>
                            <InlineFieldEditor
                              value={purchase.track_width || ''}
                              placeholder="Ancho"
                              inputClassName="min-w-[70px] max-w-[90px] px-2 py-1 text-[11px]"
                              className="min-w-[70px]"
                              onSave={(val) => requestFieldUpdate(purchase, 'track_width', 'Ancho Zapata', val)}
                            />
                          </InlineCell>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'incoterm')}>
                        <InlineFieldEditor
                          value={purchase.incoterm || ''}
                          type="select"
                          placeholder="Incoterm"
                          options={[
                            { value: 'EXW', label: 'EXW' },
                            { value: 'EXY', label: 'EXY' },
                            { value: 'FOB', label: 'FOB' },
                            { value: 'CIF', label: 'CIF' },
                          ]}
                          onSave={(val) => requestFieldUpdate(purchase, 'incoterm', 'Incoterm', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'machine_location')}>
                        <InlineFieldEditor
                          value={purchase.machine_location || ''}
                          type="select"
                          placeholder="Ubicación"
                          options={[
                            { value: 'KOBE', label: 'KOBE' },
                            { value: 'YOKOHAMA', label: 'YOKOHAMA' },
                            { value: 'NARITA', label: 'NARITA' },
                            { value: 'HAKATA', label: 'HAKATA' },
                            { value: 'FUJI', label: 'FUJI' },
                            { value: 'TOMAKOMAI', label: 'TOMAKOMAI' },
                            { value: 'SAKURA', label: 'SAKURA' },
                            { value: 'LEBANON', label: 'LEBANON' },
                            { value: 'LAKE WORTH', label: 'LAKE WORTH' },
                            { value: 'NAGOYA', label: 'NAGOYA' },
                            { value: 'HOKKAIDO', label: 'HOKKAIDO' },
                            { value: 'OSAKA', label: 'OSAKA' },
                            { value: 'ALBERTA', label: 'ALBERTA' },
                            { value: 'FLORIDA', label: 'FLORIDA' },
                            { value: 'KASHIBA', label: 'KASHIBA' },
                            { value: 'HYOGO', label: 'HYOGO' },
                            { value: 'MIAMI', label: 'MIAMI' },
                          ]}
                          onSave={(val) => requestFieldUpdate(purchase, 'machine_location', 'Ubicación', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'port_of_loading')}>
                        <InlineFieldEditor
                          value={purchase.port_of_loading || ''}
                          type="select"
                          placeholder="Puerto"
                          options={[
                            { value: 'BUENAVENTURA', label: 'BUENAVENTURA' },
                            { value: 'CARTAGENA', label: 'CARTAGENA' },
                            { value: 'SANTA MARTA', label: 'SANTA MARTA' },
                          ]}
                          onSave={(val) => requestFieldUpdate(purchase, 'port_of_loading', 'Puerto', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'currency')}>
                        <InlineFieldEditor
                          value={purchase.currency || ''}
                          type="select"
                          placeholder="Moneda"
                          options={[
                            { value: 'JPY', label: 'JPY' },
                            { value: 'USD', label: 'USD' },
                            { value: 'EUR', label: 'EUR' },
                          ]}
                          onSave={(val) => requestFieldUpdate(purchase, 'currency', 'Moneda', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#cf1b22]">
                      <InlineCell {...buildCellProps(purchase.id, 'value')}>
                        <InlineFieldEditor
                          type="number"
                          value={purchase.value ?? ''}
                          placeholder="0"
                          displayFormatter={() => formatCurrency(purchase.value, purchase.currency)}
                          onSave={(val) => {
                            const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                            return requestFieldUpdate(purchase, 'value', 'Valor', numeric);
                          }}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'shipping_costs')}>
                        <InlineFieldEditor
                          type="number"
                          value={purchase.shipping_costs ?? ''}
                          placeholder="0"
                          displayFormatter={() => formatCurrency(purchase.shipping_costs, purchase.currency)}
                          onSave={(val) => {
                            const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                            return requestFieldUpdate(purchase, 'shipping_costs', 'Fletes', numeric);
                          }}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'finance_costs')}>
                        <InlineFieldEditor
                          type="number"
                          value={purchase.finance_costs ?? ''}
                          placeholder="0"
                          displayFormatter={() => formatCurrency(purchase.finance_costs, purchase.currency)}
                          onSave={(val) => {
                            const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                            return requestFieldUpdate(purchase, 'finance_costs', 'Finance', numeric);
                          }}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#cf1b22]">
                      {(() => {
                        // Convertir null/undefined a 0 para el cálculo
                        const value = purchase.value ?? 0;
                        const shipping = purchase.shipping_costs ?? 0;
                        const finance = purchase.finance_costs ?? 0;
                        
                        // Verificar si al menos uno de los campos tiene un valor
                        const hasAnyValue = 
                          (purchase.value !== null && purchase.value !== undefined) ||
                          (purchase.shipping_costs !== null && purchase.shipping_costs !== undefined) ||
                          (purchase.finance_costs !== null && purchase.finance_costs !== undefined);
                        
                        // Si no hay ningún valor, mostrar '-'
                        if (!hasAnyValue) {
                          return '-';
                        }
                        
                        // Calcular el total
                        const total = Number(value) + Number(shipping) + Number(finance);
                        
                        // Si el total es NaN, mostrar '-'
                        if (isNaN(total)) {
                          return '-';
                        }
                        
                        // Mostrar el valor formateado (incluso si es 0)
                        return formatCurrency(total, purchase.currency);
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'invoice_number')}>
                        <InlineFieldEditor
                          value={purchase.invoice_number || ''}
                          placeholder="No. Factura"
                          onSave={(val) => requestFieldUpdate(purchase, 'invoice_number', 'No. Factura', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'invoice_date')}>
                        <InlineFieldEditor
                          value={purchase.invoice_date ? new Date(purchase.invoice_date).toISOString().split('T')[0] : ''}
                          type="date"
                          placeholder="Fecha factura"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
                              'invoice_date',
                              'Fecha factura',
                              typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              {
                                invoice_date: typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              }
                            )
                          }
                          displayFormatter={(val) =>
                            val ? formatDate(String(val)) : '-'
                          }
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'due_date')}>
                        <InlineFieldEditor
                          value={purchase.due_date ? new Date(purchase.due_date).toISOString().split('T')[0] : ''}
                          type="date"
                          placeholder="Vencimiento"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
                              'due_date',
                              'Vencimiento',
                              typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              {
                                due_date: typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              }
                            )
                          }
                          displayFormatter={(val) =>
                            val ? formatDate(String(val)) : '-'
                          }
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'payment_date')}>
                        <InlineFieldEditor
                          value={formatDateForInput(purchase.payment_date)}
                          type="date"
                          placeholder="Fecha pago"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
                              'payment_date',
                              'Fecha pago',
                              typeof val === 'string' && val ? val : null,
                              {
                                payment_date: typeof val === 'string' && val ? val : null,
                              }
                            )
                          }
                          displayFormatter={(val) =>
                            val ? formatDate(String(val)) : '-'
                          }
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'usd_jpy_rate')}>
                        <InlineFieldEditor
                          value={purchase.usd_jpy_rate ? String(purchase.usd_jpy_rate) : ''}
                          type="number"
                          placeholder="Contravalor"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
                              'usd_jpy_rate',
                              'Contravalor',
                              typeof val === 'number' ? val : (typeof val === 'string' && val ? parseFloat(val) : null),
                              {
                                usd_jpy_rate: typeof val === 'number' ? val : (typeof val === 'string' && val ? parseFloat(val) : null),
                              }
                            )
                          }
                          displayFormatter={(val) =>
                            val ? new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val)) : '-'
                          }
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'trm_rate')}>
                        <InlineFieldEditor
                          value={purchase.trm_rate ? String(purchase.trm_rate) : ''}
                          type="number"
                          placeholder="TRM"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
                              'trm_rate',
                              'TRM',
                              typeof val === 'number' ? val : (typeof val === 'string' && val ? parseFloat(val) : null),
                              {
                                trm_rate: typeof val === 'number' ? val : (typeof val === 'string' && val ? parseFloat(val) : null),
                              }
                            )
                          }
                          displayFormatter={(val) =>
                            val ? new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val)) : '-'
                          }
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#cf1b22]">
                      <InlineCell {...buildCellProps(purchase.id, 'mq')}>
                        <InlineFieldEditor
                          value={purchase.mq || ''}
                          placeholder="MQ"
                          onSave={(val) => requestFieldUpdate(purchase, 'mq', 'MQ', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'empresa')}>
                        <InlineFieldEditor
                          value={purchase.empresa || ''}
                          type="select"
                          placeholder="Empresa"
                          options={[
                            { value: 'Partequipos Maquinaria', label: 'Partequipos Maquinaria' },
                            { value: 'Maquitecno', label: 'Maquitecno' }
                          ]}
                          onSave={(val) => requestFieldUpdate(purchase, 'empresa', 'Empresa', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'serial')}>
                        <InlineFieldEditor
                          value={purchase.serial || ''}
                          placeholder="Serial"
                          onSave={(val) => requestFieldUpdate(purchase, 'serial', 'Serial', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'condition')}>
                        <InlineFieldEditor
                          value={purchase.condition || ''}
                          type="select"
                          placeholder="Condición"
                          options={[
                            { value: 'NUEVO', label: 'NUEVO' },
                            { value: 'USADO', label: 'USADO' },
                          ]}
                          displayFormatter={(val) => {
                            const condition = val || 'NUEVO';
                            const isNuevo = condition === 'NUEVO';
                            return (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  isNuevo
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {String(condition)}
                              </span>
                            );
                          }}
                          onSave={(val) => requestFieldUpdate(purchase, 'condition', 'Condición', val)}
                        />
                      </InlineCell>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'shipment_departure_date')}>
                        <InlineFieldEditor
                          value={formatDateForInput(purchase.shipment_departure_date)}
                          type="date"
                          placeholder="Fecha embarque salida"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
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
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'shipment_arrival_date')}>
                        <InlineFieldEditor
                          value={formatDateForInput(purchase.shipment_arrival_date)}
                          type="date"
                          placeholder="Fecha embarque llegada"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
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
                    <td className="px-4 py-3 text-sm text-gray-700 sticky right-0 bg-white z-10 shadow-lg">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(purchase)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewFiles(purchase)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Ver archivos"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewHistory(purchase)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Historial"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {purchase.purchase_order_pdf_path && (
                          <button
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('token');
                                const pdfUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/new-purchases/${purchase.id}/pdf`;
                                const response = await fetch(pdfUrl, {
                                  headers: {
                                    'Authorization': `Bearer ${token}`
                                  }
                                });
                                if (response.ok) {
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `orden-compra-${purchase.purchase_order || purchase.mq}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                } else {
                                  showError('Error al descargar el PDF');
                                }
                              } catch (error) {
                                console.error('Error descargando PDF:', error);
                                showError('Error al descargar el PDF');
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Ver PDF Orden de Compra"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(purchase.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Formulario */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setFormData({});
          setSelectedPurchase(null);
        }}
        title={selectedPurchase ? 'Editar Compra Nueva' : 'Nueva Compra'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <input
                type="text"
                value={formData.type || 'COMPRA DIRECTA'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
              />
            </div>

            {/* Proveedor */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.supplier_name || ''}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                required
              >
                <option value="">Seleccionar...</option>
                {AUCTION_SUPPLIERS.map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </div>

            {/* Condición */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condición</label>
              <select
                value={formData.condition || 'NUEVO'}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
              >
                <option value="NUEVO">NUEVO</option>
                <option value="USADO">USADO</option>
              </select>
            </div>

            {/* Marca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <select
                value={formData.brand || ''}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
              >
                <option value="">Seleccionar...</option>
                {BRAND_OPTIONS.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modelo <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.model || ''}
                onChange={(e) => {
                  const selectedModel = e.target.value;
                  const defaultSpecs = getSpecsForModel(selectedModel, formData.condition);
                  
                  if (defaultSpecs) {
                    // Autocargar especificaciones si existen para este modelo
                    setFormData({ 
                      ...formData, 
                      model: selectedModel,
                      cabin_type: defaultSpecs.cabin_type,
                      wet_line: defaultSpecs.wet_line,
                      dozer_blade: defaultSpecs.dozer_blade,
                      track_type: defaultSpecs.track_type,
                      track_width: defaultSpecs.track_width
                    });
                    showSuccess(`Especificaciones cargadas automáticamente para ${selectedModel}`);
                  } else {
                    setFormData({ ...formData, model: selectedModel });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                required
              >
                <option value="">Seleccionar...</option>
                {allModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Las especificaciones se cargarán automáticamente si existe una coincidencia exacta o si los primeros 4 caracteres del modelo coinciden con alguna configuración
              </p>
            </div>

            {/* Serial */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serial
              </label>
              <input
                type="text"
                value={formData.serial || ''}
                onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
              />
            </div>

            {/* Cantidad - Solo para nuevas compras */}
            {!selectedPurchase && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.quantity ?? 1}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Permitir campo vacío para edición manual
                    if (val === '') {
                      setFormData({ ...formData, quantity: '' as any });
                    } else {
                      const num = Math.max(1, Math.min(100, parseInt(val) || 1));
                      setFormData({ ...formData, quantity: num });
                    }
                  }}
                  onBlur={(e) => {
                    // Si está vacío al salir del campo, poner 1
                    if (e.target.value === '') {
                      setFormData({ ...formData, quantity: 1 });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                  placeholder="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Si ingresa más de 1, se crearán múltiples registros con la misma marca y modelo
                </p>
              </div>
            )}

            {/* Año */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input
                type="number"
                value={formData.machine_year || ''}
                onChange={(e) => setFormData({ ...formData, machine_year: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                placeholder="Ej: 2024"
                min="1990"
                max="2030"
              />
            </div>

            {/* Orden de Compra */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden de Compra</label>
              <input
                type="text"
                value={formData.purchase_order || ''}
                onChange={(e) => setFormData({ ...formData, purchase_order: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                placeholder="Se genera automáticamente PTQ###-AA"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                Se genera automáticamente al crear la compra
              </p>
            </div>

            {/* Empresa */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empresa <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.empresa || ''}
                onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                required
              >
                <option value="">-- Seleccionar Empresa --</option>
                <option value="Partequipos Maquinaria">Partequipos Maquinaria</option>
                <option value="Maquitecno">Maquitecno</option>
              </select>
            </div>

            {/* Número de Factura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Factura</label>
              <input
                type="text"
                value={formData.invoice_number || ''}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
              />
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
              <input
                type="number"
                value={formData.value || ''}
                onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setFormData({});
                setSelectedPurchase(null);
              }}
              className="bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#cf1b22] text-white hover:bg-red-700">
              {selectedPurchase ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Archivos */}
      {selectedPurchase && (
        <Modal
          isOpen={isViewOpen}
          onClose={() => {
            setIsViewOpen(false);
            setSelectedPurchase(null);
          }}
          title={`Archivos - ${selectedPurchase.mq}`}
        >
          {/* Botón para ver PDF de orden de compra si existe */}
          {selectedPurchase.purchase_order_pdf_path && (
            <div className="mb-4 p-4 bg-gradient-to-r from-[#cf1b22] to-[#8a1217] rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-white" />
                  <div>
                    <p className="text-white font-semibold">Orden de Compra Masiva</p>
                    <p className="text-white/80 text-sm">PDF disponible para descarga</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const pdfUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/new-purchases/${selectedPurchase.id}/pdf`;
                      const response = await fetch(pdfUrl, {
                        headers: {
                          'Authorization': `Bearer ${token}`
                        }
                      });
                      if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `orden-compra-${selectedPurchase.purchase_order || selectedPurchase.mq}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } else {
                        showError('Error al descargar el PDF');
                      }
                    } catch (error) {
                      console.error('Error descargando PDF:', error);
                      showError('Error al descargar el PDF');
                    }
                  }}
                  className="px-4 py-2 bg-white text-[#cf1b22] rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Ver PDF</span>
                </button>
              </div>
            </div>
          )}
          <MachineFiles 
            purchaseId={selectedPurchase.id}
            machineId={null}
            tableName="new_purchases"
            allowUpload={true}
            allowDelete={true}
            enablePhotos={true}
            enableDocs={true}
            uploadExtraFields={{ scope: 'COMPRAS_NUEVOS' }}
            currentScope="COMPRAS_NUEVOS"
          />
        </Modal>
      )}

      {/* Modal de Historial */}
      {selectedPurchase && (
        <Modal
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setSelectedPurchase(null);
          }}
          title={`Historial de Cambios - ${selectedPurchase.mq}`}
        >
          <ChangeHistory 
            tableName="new_purchases"
            recordId={selectedPurchase.id}
          />
        </Modal>
      )}

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
      <ModelSpecsManager
        isOpen={isSpecsManagerOpen}
        onClose={() => setIsSpecsManagerOpen(false)}
        onSave={async () => {
          // Las especificaciones ya se guardaron en el backend
          // Recargar las especificaciones dinámicas
          try {
            const updatedSpecs = await apiGet<ModelSpecs[]>('/api/model-specs');
            setDynamicSpecs(updatedSpecs || []);
          } catch (error) {
            console.error('Error recargando especificaciones:', error);
          }
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

