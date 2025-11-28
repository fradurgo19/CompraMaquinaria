/**
 * Página de COMPRAS NUEVOS - Diseño Premium Empresarial
 * Módulo para Jefe Comercial, Admin y Gerencia
 */

import { useState, useRef, useEffect } from 'react';
import { Plus, Search, Package, DollarSign, Truck, Eye, Pencil, Trash2, FileText, Clock } from 'lucide-react';
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
import { apiPut, apiPost } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { EQUIPMENT_TYPES, getDefaultSpecsForModel, ModelSpecs, EquipmentSpecs } from '../constants/equipmentSpecs';
import { BRAND_OPTIONS } from '../constants/brands';
import { MODEL_OPTIONS } from '../constants/models';
import { AUCTION_SUPPLIERS } from '../organisms/PreselectionForm';
import { ModelSpecsManager } from '../components/ModelSpecsManager';
import { Settings } from 'lucide-react';
import { apiGet } from '../services/api';

export const NewPurchasesPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<NewPurchase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<NewPurchase>>({});
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [isSpecsManagerOpen, setIsSpecsManagerOpen] = useState(false);
  const [dynamicSpecs, setDynamicSpecs] = useState<ModelSpecs[]>([]);
  
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

  const { newPurchases, isLoading, refetch, createNewPurchase, updateNewPurchase, deleteNewPurchase } = useNewPurchases();
  const { user } = useAuth();

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

    topScroll.addEventListener('scroll', handleTopScroll);
    tableScroll.addEventListener('scroll', handleTableScroll);

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableScroll.removeEventListener('scroll', handleTableScroll);
    };
  }, []);

  const filteredPurchases = newPurchases.filter((purchase) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        purchase.mq?.toLowerCase().includes(search) ||
        purchase.model?.toLowerCase().includes(search) ||
        purchase.serial?.toLowerCase().includes(search) ||
        purchase.supplier_name?.toLowerCase().includes(search)
      );
    }
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

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-CO', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
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
    if (!formData.mq || !formData.supplier_name || !formData.model || !formData.serial) {
      showError('Por favor complete los campos requeridos: MQ, Proveedor, Modelo, Serial');
      return;
    }

    try {
      if (selectedPurchase) {
        await updateNewPurchase(selectedPurchase.id, formData);
        showSuccess('Compra actualizada correctamente');
      } else {
        await createNewPurchase(formData);
        showSuccess('Compra creada correctamente');
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
      await apiPut(`/api/new-purchases/${pending.recordId}`, pending.updates);
      await apiPost('/api/change-logs', {
        table_name: 'new_purchases',
        record_id: pending.recordId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'compras_nuevos',
      });
      await loadChangeIndicators([pending.recordId]);
      showSuccess('Dato actualizado correctamente');
      await refetch();
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
  const getSpecsForModel = (model: string, condition?: string): EquipmentSpecs | null => {
    if (!model) return null;
    
    const normalizedModel = model.trim().toUpperCase();
    const normalizedCondition = condition?.trim().toUpperCase();
    
    // Primero buscar en especificaciones dinámicas (BD)
    if (dynamicSpecs.length > 0) {
      let match = dynamicSpecs.find(
        (spec) => spec.model.toUpperCase() === normalizedModel
      );
      
      if (normalizedCondition && match) {
        const conditionMatch = match.condition === normalizedCondition;
        if (!conditionMatch) {
          match = dynamicSpecs.find(
            (spec) =>
              spec.model.toUpperCase() === normalizedModel &&
              spec.condition === normalizedCondition
          ) || match;
        }
      }
      
      if (match) {
        return match.specs;
      }
    }
    
    // Si no se encuentra en BD, usar constantes
    return getDefaultSpecsForModel(model, condition);
  };

  const requestFieldUpdate = (
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
    
    return beginInlineChange(
      purchase,
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
        className="bg-gradient-to-r from-[#cf1b22] via-red-700 to-red-800 rounded-2xl shadow-2xl p-4 md:p-6 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
          <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
              <Package className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Compras Nuevos</h1>
              <p className="text-red-100 mt-1">Gestión de equipos nuevos</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => setIsSpecsManagerOpen(true)}
              className="bg-white/20 text-white hover:bg-white/30 border border-white/30"
            >
              <Settings className="w-5 h-5 mr-2" />
              Especificaciones
            </Button>
            <Button onClick={handleCreate} className="bg-white text-[#cf1b22] hover:bg-gray-50">
              <Plus className="w-5 h-5 mr-2" />
              Nueva Compra
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-[#cf1b22] to-red-700 rounded-xl p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Equipos Nuevos</p>
              <p className="text-3xl font-bold mt-1">{totalNew}</p>
            </div>
            <Package className="w-12 h-12 opacity-30" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#50504f] to-gray-700 rounded-xl p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-200 text-sm">Equipos Usados</p>
              <p className="text-3xl font-bold mt-1">{totalUsed}</p>
            </div>
            <Package className="w-12 h-12 opacity-30" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-[#cf1b22] to-red-600 rounded-xl p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">En Tránsito</p>
              <p className="text-3xl font-bold mt-1">{inTransit}</p>
            </div>
            <Truck className="w-12 h-12 opacity-30" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-[#50504f] to-gray-800 rounded-xl p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-200 text-sm">Valor Total</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalValue)}</p>
            </div>
            <DollarSign className="w-12 h-12 opacity-30" />
          </div>
        </motion.div>
      </div>

      {/* Buscador */}
      <div className="flex items-center space-x-4 bg-white rounded-xl p-4 shadow-md">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por MQ, Modelo, Serial, Proveedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 outline-none text-gray-700"
        />
      </div>

      {/* Scroll superior sincronizado */}
      <div className="mb-3">
        <div
          ref={topScrollRef}
          className="overflow-x-auto flex-1 bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
          style={{ height: '14px' }}
        >
          <div style={{ width: '3600px', height: '1px' }}></div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div ref={tableScrollRef} className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-[#cf1b22] to-red-700 text-white">
                <th className="px-4 py-3 text-left font-semibold text-sm">ÑO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">MARCA</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">PROVEEDOR</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">OC</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">TIPO EQUIPO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">TIPO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">MODELO</th>
                <th className="px-4 py-3 text-left font-semibold text-sm min-w-[500px]">Especificaciones</th>
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
                <th className="px-4 py-3 text-left font-semibold text-sm">MQ</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">SERIE</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">CONDICIÓN</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">EMBARQUE SALIDA</th>
                <th className="px-4 py-3 text-left font-semibold text-sm">EMBARQUE LLEGADA</th>
                <th className="px-4 py-3 text-left font-semibold text-sm sticky right-0 bg-[#cf1b22] z-10">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={26} className="text-center py-8 text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={26} className="text-center py-8 text-gray-500">
                    No hay compras registradas
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase, idx) => (
                  <tr
                    key={purchase.id}
                    className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-200"
                  >
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'brand')}>
                        <InlineFieldEditor
                          value={purchase.brand || ''}
                          type="select"
                          placeholder="Marca"
                          options={BRAND_OPTIONS.map(brand => ({ value: brand, label: brand }))}
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
                          options={AUCTION_SUPPLIERS.map(supplier => ({ value: supplier, label: supplier }))}
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
                          options={MODEL_OPTIONS.map(model => ({ value: model, label: model }))}
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
                            { value: 'KOBE', label: 'KOBE' },
                            { value: 'YOKOHAMA', label: 'YOKOHAMA' },
                            { value: 'SAVANNA', label: 'SAVANNA' },
                            { value: 'JACKSONVILLE', label: 'JACKSONVILLE' },
                            { value: 'CANADA', label: 'CANADA' },
                            { value: 'MIAMI', label: 'MIAMI' },
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
                          value={purchase.payment_date ? new Date(purchase.payment_date).toISOString().split('T')[0] : ''}
                          type="date"
                          placeholder="Fecha pago"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
                              'payment_date',
                              'Fecha pago',
                              typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              {
                                payment_date: typeof val === 'string' && val ? new Date(val).toISOString() : null,
                              }
                            )
                          }
                          displayFormatter={(val) =>
                            val ? formatDate(String(val)) : '-'
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
                          value={purchase.shipment_departure_date ? new Date(purchase.shipment_departure_date).toISOString().split('T')[0] : ''}
                          type="date"
                          placeholder="Fecha embarque salida"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
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
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <InlineCell {...buildCellProps(purchase.id, 'shipment_arrival_date')}>
                        <InlineFieldEditor
                          value={purchase.shipment_arrival_date ? new Date(purchase.shipment_arrival_date).toISOString().split('T')[0] : ''}
                          type="date"
                          placeholder="Fecha embarque llegada"
                          onSave={(val) =>
                            requestFieldUpdate(
                              purchase,
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
            {/* MQ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MQ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.mq || ''}
                onChange={(e) => setFormData({ ...formData, mq: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                required
              />
            </div>

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
              <input
                type="text"
                value={formData.supplier_name || ''}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                required
              />
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
              <input
                type="text"
                value={formData.brand || ''}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
              />
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modelo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.model || ''}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                required
              />
            </div>

            {/* Serial */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serial <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.serial || ''}
                onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                required
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
              />
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
    </div>
  );
};

