/**
 * Página de Consolidado - Dashboard Ejecutivo Premium
 * Tabla Digital con todos los campos
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Download, TrendingUp, DollarSign, Package, BarChart3, FileSpreadsheet, Edit, Eye, Wrench, Calculator, FileText, History, Clock, Plus, Layers, Save, X, Settings, Trash2, ChevronDown, ChevronUp, Image as ImageIcon, ChevronLeft, ChevronRight, ZoomIn, MessageSquare, Store, CreditCard } from 'lucide-react';
import { MachineFiles } from '../components/MachineFiles';
import { motion, AnimatePresence } from 'framer-motion';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { PriceSuggestion } from '../components/PriceSuggestion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Select } from '../atoms/Select';
import { Modal } from '../molecules/Modal';
import { apiGet, apiPut, apiPost, apiDelete, API_URL } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { useChangeDetection } from '../hooks/useChangeDetection';
import { useBatchModeGuard } from '../hooks/useBatchModeGuard';
import { useAuth } from '../context/AuthContext';
import { AUCTION_SUPPLIERS } from '../organisms/PreselectionForm';
import { BRAND_OPTIONS } from '../constants/brands';
import { MODEL_OPTIONS } from '../constants/models';
import { getModelsForBrand, getAllBrands } from '../utils/brandModelMapping';
import { BrandModelManager } from '../components/BrandModelManager';
import { AutoCostManager } from '../components/AutoCostManager';
import { applyAutoCostRule } from '../services/autoCostRules.service';

  const SHOW_TRASLADO_COLUMN = false;

export const ManagementPage = () => {
  const { user } = useAuth();
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
  // Estados locales para inputs formateados (mantener valor sin formato mientras se edita)
  const [localInputValues, setLocalInputValues] = useState<Record<string, string>>({});
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [creatingNewRow, setCreatingNewRow] = useState(false);
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { recordId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());
  const [specsPopoverOpen, setSpecsPopoverOpen] = useState<string | null>(null);
  const [editingSpecs, setEditingSpecs] = useState<Record<string, any>>({});
  const [serviceCommentsPopover, setServiceCommentsPopover] = useState<string | null>(null);
  const [commercialCommentsPopover, setCommercialCommentsPopover] = useState<string | null>(null);
  const [filesSectionExpanded, setFilesSectionExpanded] = useState(false);
  const [viewFilesSectionExpanded, setViewFilesSectionExpanded] = useState(false);
  const [photosModalOpen, setPhotosModalOpen] = useState(false);
  const [allPhotos, setAllPhotos] = useState<Array<{ id: string; file_path: string; file_name: string; scope?: string }>>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isBrandModelManagerOpen, setIsBrandModelManagerOpen] = useState(false);
  const [isAutoCostManagerOpen, setIsAutoCostManagerOpen] = useState(false);
  const [paymentPopoverOpen, setPaymentPopoverOpen] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any>>({});
  const [paymentLoading, setPaymentLoading] = useState(false);
  const autoCostAppliedRef = useRef<Set<string>>(new Set());
  const [dynamicBrands, setDynamicBrands] = useState<string[]>([]);
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  
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
  // Estado para almacenar las combinaciones marca-modelo indexadas
  const [brandModelMap, setBrandModelMap] = useState<Record<string, string[]>>({});

  const loadBrandModelCombinations = useCallback(async () => {
    try {
      const combinations = await apiGet<Record<string, string[]>>('/api/brands-and-models/combinations').catch(() => ({}));
      setBrandModelMap(combinations);
    } catch (error) {
      console.error('Error al cargar combinaciones marca-modelo:', error);
      setBrandModelMap({});
    }
  }, []);

  const loadBrandsAndModels = useCallback(async () => {
    try {
      const [brandsData, modelsData] = await Promise.all([
        apiGet<Array<{ name: string }>>('/api/brands-and-models/brands').catch(() => []),
        apiGet<Array<{ name: string }>>('/api/brands-and-models/models').catch(() => [])
      ]);
      setDynamicBrands(brandsData.map((b) => b.name));
      setDynamicModels(modelsData.map((m) => m.name));
    } catch (error) {
      console.error('Error al cargar marcas y modelos:', error);
      setDynamicBrands(BRAND_OPTIONS as unknown as string[]);
      setDynamicModels(MODEL_OPTIONS as unknown as string[]);
    }
  }, []);

  // Cargar combinaciones y catálogos al montar y al cerrar el gestor
  useEffect(() => {
    loadBrandModelCombinations();
    loadBrandsAndModels();
  }, [loadBrandModelCombinations, loadBrandsAndModels, isBrandModelManagerOpen]);

  // Todos los modelos combinados
  const allModels = useMemo(() => {
    const combined = [...MODEL_OPTIONS, ...dynamicModels];
    return Array.from(new Set(combined)).sort();
  }, [dynamicModels]);

  const allBrands = useMemo(() => {
    const combined = [...BRAND_OPTIONS, ...dynamicBrands];
    return Array.from(new Set(combined)).sort();
  }, [dynamicBrands]);

  const allBrandsFromCombinations = useMemo(() => {
    const brands = Object.keys(brandModelMap);
    const combined = [...allBrands, ...brands];
    return Array.from(new Set(combined)).sort();
  }, [allBrands, brandModelMap]);

  const brandOptions = useMemo(() => {
    const allBrandsList = getAllBrands(brandModelMap);
    const combined = new Set([...allBrandsList, ...allBrandsFromCombinations]);
    return Array.from(combined).map((b) => ({ value: b, label: b })).sort((a, b) => a.label.localeCompare(b.label));
  }, [brandModelMap, allBrandsFromCombinations]);

  // Función para obtener modelos filtrados por marca
  const getModelOptionsForBrand = useCallback((brand: string | null | undefined): Array<{ value: string; label: string }> => {
    const modelsForBrand = getModelsForBrand(brand, brandModelMap, allModels);
    return modelsForBrand.map((model) => ({ value: model, label: model }));
  }, [brandModelMap, allModels]);

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
    inland: 'OCEAN',
    gastos_pto: 'Gastos Puerto',
    flete: 'Traslados Nacionales',
    traslado: 'Traslado',
    repuestos: 'PPTO Reparación',
    service_value: 'Valor Servicio',
    inland_verified: 'Inland Verificado',
    gastos_pto_verified: 'Gastos Puerto Verificado',
    flete_verified: 'Traslados Nacionales Verificado',
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

  // Aplicar gastos automáticos a filas que tengan modelo y costos vacíos
  useEffect(() => {
    const applyMissingAutoCosts = async () => {
      const candidates = consolidado
        .filter((row) => row.model && shouldAutoFillCosts(row) && !autoCostAppliedRef.current.has(row.id as string))
        .slice(0, 5); // limitar para evitar rafagas grandes

      for (const row of candidates) {
        await handleApplyAutoCosts(row as Record<string, any>, { silent: true, force: true });
      }
    };

    if (!loading && consolidado.length > 0) {
      applyMissingAutoCosts();
    }
  }, [consolidado, loading]);

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

  const fetchPaymentDetails = async (purchaseId: string) => {
    if (!purchaseId) return null;
    if (paymentDetails[purchaseId]) return paymentDetails[purchaseId];
    try {
      setPaymentLoading(true);
      const data = await apiGet<any>(`/api/pagos/${purchaseId}`);
      setPaymentDetails(prev => ({ ...prev, [purchaseId]: data }));
      return data;
    } catch (error) {
      console.error('Error cargando pago:', error);
      showError('No se pudo cargar el detalle de pagos');
      return null;
    } finally {
      setPaymentLoading(false);
    }
  };

  const loadAllPhotos = async (machineId: string) => {
    try {
      const photos = await apiGet<Array<{ id: string; file_path: string; file_name: string; scope?: string }>>(`/api/files/${machineId}?file_type=FOTO`);
      setAllPhotos(photos);
      return photos.length > 0;
    } catch (error) {
      console.error('Error cargando fotos:', error);
      setAllPhotos([]);
      return false;
    }
  };

  const handleViewPhotos = async (row: Record<string, any>) => {
    if (row.machine_id) {
      const hasPhotos = await loadAllPhotos(row.machine_id);
      if (hasPhotos) {
        setSelectedPhotoIndex(0);
        setPhotosModalOpen(true);
      } else {
        showError('No hay fotos disponibles para esta máquina');
      }
    }
  };

  // Navegación con teclado para el modal de fotos
  useEffect(() => {
    if (!photosModalOpen || allPhotos.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPhotosModalOpen(false);
        setSelectedPhotoIndex(null);
      } else if (e.key === 'ArrowLeft' && allPhotos.length > 1) {
        setSelectedPhotoIndex((prev) => {
          if (prev === null || prev === 0) return allPhotos.length - 1;
          return prev - 1;
        });
      } else if (e.key === 'ArrowRight' && allPhotos.length > 1) {
        setSelectedPhotoIndex((prev) => {
          if (prev === null || prev === allPhotos.length - 1) return 0;
          return prev + 1;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photosModalOpen, allPhotos.length]);

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
      comentarios_servicio: row.comentarios_servicio,
      comentarios_comercial: row.comentarios_comercial,
    });
    // Limpiar valores locales de inputs al abrir modal
    setLocalInputValues({});
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
    const rawData = pendingUpdate?.data || editData;
    
    // Excluir campos de solo lectura que vienen de otras tablas
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { service_value, service_record_id, ...data } = rawData;

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
        brand: 'HITACHI',
        model: 'Modelo',
        serial: `NUEVO-${Date.now()}`,
        condition: 'USADO',
        incoterm: 'FOB',
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

  const getCurrencySymbol = (currency?: string | null): string => {
    if (!currency) return '$';
    const upperCurrency = currency.toUpperCase();
    if (upperCurrency === 'USD') return '$';
    if (upperCurrency === 'JPY') return '¥';
    if (upperCurrency === 'GBP') return '£';
    if (upperCurrency === 'EUR') return '€';
    return '$'; // Default
  };

  const formatCurrency = (value: number | null | undefined | string) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    const fixedValue = parseFloat(numValue.toFixed(2));
    return `$${fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyWithSymbol = (
    currency: string | null | undefined,
    value: number | null | undefined | string
  ): string => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : (typeof value === 'number' ? value : 0);
    if (isNaN(numValue)) return '-';
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const formatNumber = (value: number | null | undefined | string) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    const fixedValue = parseFloat(numValue.toFixed(2));
    return fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatShortCurrency = (value: number | string | null | undefined, currency: string = 'COP') => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(String(value)) : Number(value);
    if (isNaN(numValue) || !isFinite(numValue)) return '-';
    const formatted = numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const symbol = currency === 'COP' ? '$' : currency === 'USD' ? 'US$' : currency === 'JPY' ? '¥' : currency === 'EUR' ? '€' : '';
    return symbol ? `${symbol} ${formatted}` : formatted;
  };

  const getTasaPromedioPagos = (data: Record<string, any>) => {
    const tasas = [data?.pago1_tasa, data?.pago2_tasa, data?.pago3_tasa]
      .map((t) => (t === null || t === undefined ? null : Number(t)))
      .filter((t) => t !== null && !isNaN(t as number) && isFinite(t as number)) as number[];
    if (tasas.length === 0) return null;
    const avg = tasas.reduce((acc, t) => acc + t, 0) / tasas.length;
    return Number.isFinite(avg) ? avg : null;
  };

  // Helper para convertir string formateado a número
  const parseFormattedNumber = (value: string): number | null => {
    if (!value || value === '') return null;
    // Remover $ y espacios
    let cleaned = value.replace(/[$\s]/g, '');
    // Si hay coma, es formato colombiano (punto para miles, coma para decimales)
    if (cleaned.includes(',')) {
      // Remover puntos (separadores de miles)
      cleaned = cleaned.replace(/\./g, '');
      // Reemplazar coma por punto para parseFloat
      cleaned = cleaned.replace(',', '.');
    }
    const numValue = parseFloat(cleaned);
    return isNaN(numValue) ? null : numValue;
  };

  // Helper para formatear números para input (con $ y puntos de miles)
  const formatNumberForInput = (value: number | null | undefined | string): string => {
    if (value === null || value === undefined || value === '') return '';
    let numValue: number;
    if (typeof value === 'string') {
      // Si es string, puede estar formateado o no
      const parsed = parseFormattedNumber(value);
      if (parsed === null) return '';
      numValue = parsed;
    } else {
      numValue = value;
    }
    if (isNaN(numValue)) return '';
    return `$${numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const computeFobUsd = (row: Record<string, any>): number | null => {
    const fobOrigen = toNumber(row.exw_value_formatted || row.precio_fob);
    const contravalor = toNumber(row.usd_jpy_rate);
    if (!contravalor) return null;
    return fobOrigen / contravalor;
  };

  const computeCifUsd = (row: Record<string, any>): number | null => {
    const fobUsd = computeFobUsd(row);
    const ocean = toNumber(row.inland);
    if (fobUsd === null && !ocean) return null;
    return (fobUsd || 0) + ocean;
  };

  const computeCifLocal = (row: Record<string, any>): number | null => {
    const cifUsd = row.cif_usd ?? computeCifUsd(row);
    const trm = toNumber(row.trm_rate);
    if (!cifUsd || !trm) return null;
    return cifUsd * trm;
  };

  // Helper para obtener el valor del input (estado local si existe, sino formateado)
  const getInputValue = (fieldName: string, dataValue: number | null | undefined): string => {
    if (localInputValues[fieldName] !== undefined) {
      return localInputValues[fieldName];
    }
    return formatNumberForInput(dataValue);
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

  // Función para actualizar el estado local sin refrescar la página
  const updateConsolidadoLocal = (recordId: string, updates: Record<string, unknown>) => {
    setConsolidado((prev) => {
      const numericFields = ['pvp_est', 'precio_fob', 'inland', 'gastos_pto', 'flete', 'traslado', 'repuestos', 'service_value', 'cost_arancel', 'proyectado', 'exw_value', 'fob_value', 'trm', 'usd_rate', 'jpy_rate', 'usd_jpy_rate', 'trm_rate', 'fob_usd', 'valor_factura_proveedor', 'tasa'];
      
      // Mapeo de campos a sus campos _verified correspondientes
      const verifiedFieldsMap: Record<string, string> = {
        'inland': 'inland_verified',
        'gastos_pto': 'gastos_pto_verified',
        'flete': 'flete_verified',
        'traslado': 'traslado_verified',
        'repuestos': 'repuestos_verified',
      };
      
      return prev.map((row) => {
        if (row.id === recordId) {
          // Procesar updates para convertir valores numéricos correctamente
          const processedUpdates: Record<string, unknown> = {};
          Object.keys(updates).forEach((key) => {
            const value = updates[key];
            
            // Si es un campo numérico, procesarlo especialmente
            if (numericFields.includes(key)) {
              if (value !== null && value !== undefined && value !== '') {
                // Convertir a número si es string
                let numValue: number;
                if (typeof value === 'string') {
                  numValue = parseFloat(value);
                } else if (typeof value === 'number') {
                  numValue = value;
                } else {
                  numValue = Number(value);
                }
                
                // Asegurarse de que sea un número válido
                if (!isNaN(numValue) && isFinite(numValue)) {
                  processedUpdates[key] = numValue;
                  
                  // Si este campo tiene un campo _verified asociado, actualizarlo a false automáticamente
                  if (verifiedFieldsMap[key]) {
                    processedUpdates[verifiedFieldsMap[key]] = false;
                  }
                } else {
                  // Si no es un número válido, mantener el valor original del row
                  processedUpdates[key] = row[key];
                }
              } else {
                // Si es null/undefined/empty, mantenerlo como null
                processedUpdates[key] = null;
              }
            } else {
              // Para campos no numéricos, mantener el valor tal cual
              processedUpdates[key] = value;
            }
          });
          
          // Crear un nuevo objeto completamente nuevo para asegurar que React detecte el cambio
          // Usar spread operator para crear una copia profunda
          const updatedRow: Record<string, unknown> = {};
          
          // Copiar todas las propiedades del row original
          Object.keys(row).forEach((key) => {
            updatedRow[key] = row[key];
          });
          
          // Aplicar los updates procesados
          Object.keys(processedUpdates).forEach((key) => {
            updatedRow[key] = processedUpdates[key];
          });

          // Recalcular FOB USD en el estado local (FOB ORIGEN / CONTRAVALOR)
          updatedRow.fob_usd = computeFobUsd(updatedRow as Record<string, any>);
          // Recalcular CIF USD (FOB USD + OCEAN) y CIF Local (CIF USD * TRM COP)
          updatedRow.cif_usd = computeCifUsd(updatedRow as Record<string, any>);
          updatedRow.cif_local = computeCifLocal(updatedRow as Record<string, any>);
          
          // Forzar una nueva referencia del objeto para que React detecte el cambio
          return updatedRow as typeof row;
        }
        // Retornar una nueva referencia del objeto para forzar re-render
        return { ...row };
      });
    });
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
      return apiPut(`/api/management/${recordId}`, updates)
        .then(() => {
          // Actualizar estado local sin refrescar
          // Asegurarse de que los valores numéricos se parseen correctamente
          updateConsolidadoLocal(recordId, updates);
        })
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
          module_name: 'management',
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
      await apiPut(`/api/management/${pending.recordId}`, pending.updates);
      await apiPost('/api/change-logs', {
        table_name: 'purchases',
        record_id: pending.recordId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'management',
      });
      await loadChangeIndicators([pending.recordId]);
      // Actualizar estado local sin refrescar
      updateConsolidadoLocal(pending.recordId, pending.updates);
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
    record: Record<string, any>,
    fieldName: string
  ): string | number | boolean | null => {
    const value = record[fieldName];
    // Si el valor es 0, verificar si realmente es 0 o si es null/undefined convertido
    // Para campos numéricos, si el valor es 0 pero el campo originalmente era null/undefined,
    // debemos mantener null para que se capture correctamente en el historial
    if (value === 0) {
      // Verificar si el campo originalmente tenía un valor o era null/undefined
      // Si el campo no existe en el objeto original, asumimos que es null
      if (!(fieldName in record)) {
        return null;
      }
    }
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

  const requestFieldUpdate = async (
    row: Record<string, any>,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>
  ) => {
    // Obtener el valor actual del registro (valor real, no convertido)
    const currentValue = getRecordFieldValue(row, fieldName);
    
    // Normalizar valores para comparación (convertir 0 a null si el campo numérico estaba vacío)
    let normalizedCurrentValue = currentValue;
    const numericFields = ['pvp_est', 'precio_fob', 'inland', 'gastos_pto', 'flete', 'traslado', 'repuestos', 'service_value', 'cost_arancel', 'proyectado'];
    if (numericFields.includes(fieldName)) {
      // Si el valor es 0 y el campo puede ser null, verificar si realmente es 0 o null
      if (currentValue === 0 || currentValue === '0') {
        // Si el campo no existe o es explícitamente null/undefined, tratarlo como null
        if (row[fieldName] === null || row[fieldName] === undefined) {
          normalizedCurrentValue = null;
        }
      }
    }
    
    // MEJORA: Si el campo está vacío y se agrega un valor, NO solicitar control de cambios
    // Solo solicitar control de cambios cuando se MODIFICA un valor existente
    const isCurrentValueEmpty = isValueEmpty(normalizedCurrentValue);
    const isNewValueEmpty = isValueEmpty(newValue);
    
    // Si el campo estaba vacío y ahora se agrega un valor, guardar directamente sin control de cambios
    if (isCurrentValueEmpty && !isNewValueEmpty) {
      const updatesToApply = updates ?? { [fieldName]: newValue };
      // Agregar actualización de campo _verified si corresponde
      const verifiedFieldsMap: Record<string, string> = {
        'inland': 'inland_verified',
        'gastos_pto': 'gastos_pto_verified',
        'flete': 'flete_verified',
        'traslado': 'traslado_verified',
        'repuestos': 'repuestos_verified',
      };
      if (verifiedFieldsMap[fieldName]) {
        updatesToApply[verifiedFieldsMap[fieldName]] = false;
      }
      await apiPut(`/api/management/${row.id}`, updatesToApply);
      // Actualizar estado local usando la función helper
      updateConsolidadoLocal(row.id, updatesToApply);
      showSuccess('Dato actualizado');
      return;
    }
    
    // Si ambos están vacíos, no hay cambio real
    if (isCurrentValueEmpty && isNewValueEmpty) {
      return;
    }
    
    // Para otros casos (modificar un valor existente), usar control de cambios normal
    // Usar el valor normalizado para capturar correctamente el valor anterior
    return beginInlineChange(
      row,
      fieldName,
      fieldLabel,
      normalizedCurrentValue,
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
        
        // Si se cambió el modelo, auto-llenar especificaciones desde machine_spec_defaults
        if (fieldName === 'model' && row.brand && newValue) {
          try {
            const specs = await apiGet<{
              spec_blade?: boolean;
              spec_pip?: boolean;
              spec_cabin?: string;
              arm_type?: string;
              shoe_width_mm?: number;
            }>(`/api/machine-spec-defaults/by-model?brand=${encodeURIComponent(row.brand)}&model=${encodeURIComponent(newValue as string)}`);
            
            if (specs && Object.keys(specs).length > 0) {
              // Actualizar en machines con las especificaciones
              await apiPut(`/api/purchases/${row.id}/machine`, {
                shoe_width_mm: specs.shoe_width_mm || null,
                spec_pip: specs.spec_pip || false,
                spec_blade: specs.spec_blade || false,
                spec_cabin: specs.spec_cabin || null,
                arm_type: specs.arm_type || null
              });
              
              // Actualizar estado local con las especificaciones
              setConsolidado(prev => prev.map(r => 
                r.id === row.id 
                  ? { 
                      ...r, 
                      model: newValue,
                      track_width: specs.shoe_width_mm || r.track_width,
                      wet_line: specs.spec_pip ? 'SI' : (r.wet_line || 'No'),
                      blade: specs.spec_blade ? 'SI' : (r.blade || 'No'),
                      cabin_type: specs.spec_cabin || r.cabin_type,
                      arm_type: specs.arm_type || r.arm_type
                    }
                  : r
              ));
              
              showSuccess('Modelo y especificaciones actualizados correctamente');
              return;
            }
          } catch (specError) {
            console.warn('No se encontraron especificaciones por defecto:', specError);
            // Continuar con la actualización normal del modelo
          }
        }
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

      if (fieldName === 'model') {
        const normalizedModel = (typeof newValue === 'string' ? newValue : (newValue ?? '').toString()).toUpperCase();
        const updatedRow = { ...row, model: normalizedModel };
        const purchaseId = (row as any)?.purchase_id || row?.id;
        if (purchaseId) {
          autoCostAppliedRef.current.delete(purchaseId as string);
        }
        // Siempre recalcular gastos automáticos al cambiar el modelo (match por prefijo)
        await handleApplyAutoCosts(updatedRow, { silent: false, force: true });
        autoCostAppliedRef.current.add(row.id as string);
      }
    } catch (error) {
      console.error('Error actualizando campo:', error);
      showError('Error al actualizar el campo');
    }
  };

  const shouldAutoFillCosts = (row: Record<string, any>) => {
    return !toNumber(row.inland) && !toNumber(row.gastos_pto) && !toNumber(row.flete);
  };

  const handleApplyAutoCosts = async (
    row: Record<string, any>,
    options: { force?: boolean; silent?: boolean } = {}
  ) => {
    const purchaseId = (row as any)?.purchase_id || row?.id;
    if (!purchaseId) return;
    if (autoCostAppliedRef.current.has(purchaseId as string) && !options.force) {
      return;
    }
    const model = (row.model || '').trim().toUpperCase();
    if (!model) {
      if (!options.silent) {
        showError('Primero asigna un modelo para aplicar gastos automáticos');
      }
      return;
    }

    const brandValue = (row.brand || '').trim().toUpperCase() || null;
    const shipmentRaw = (row.shipment || row.shipment_type_v2 || '').trim().toUpperCase();
    const allowedShipment = ['RORO', '1X40', '1X20', 'LCL', 'AEREO'];
    const shipmentValue = allowedShipment.includes(shipmentRaw) ? shipmentRaw : null;
    let force = options.force ?? false;

    if (!force && !shouldAutoFillCosts(row)) {
      const confirmOverwrite = window.confirm('El registro ya tiene valores de OCEAN/Gastos/Traslados. ¿Deseas sobrescribirlos con la regla automática?');
      if (!confirmOverwrite) return;
      force = true;
    }

    try {
      const response = await applyAutoCostRule({
        purchase_id: purchaseId,
        model,
        brand: brandValue,
        shipment: shipmentValue,
        tonnage: row.tonelage || null,
        force,
      });

      if (response?.updates) {
        updateConsolidadoLocal(row.id, {
          inland: response.updates.inland,
          gastos_pto: response.updates.gastos_pto,
          flete: response.updates.flete,
          inland_verified: false,
          gastos_pto_verified: false,
          flete_verified: false,
        });
        autoCostAppliedRef.current.add(purchaseId as string);

        if (!options.silent) {
          const ruleLabel =
            response.rule?.name ||
            response.rule?.tonnage_label ||
            (response.rule?.model_patterns || []).join(', ');
          showSuccess(`Gastos automáticos aplicados ${ruleLabel ? `(${ruleLabel})` : ''}`);
        }
      }
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'No se pudo aplicar la regla automática';
      if (!options.silent) {
        showError(message);
      }
    }
  };

  // Guardar especificaciones editadas desde el popover
  const handleSaveSpecs = async (rowId: string) => {
    try {
      const specs = editingSpecs[rowId];
      if (!specs) return;

      // Actualizar en machines via purchases
      await apiPut(`/api/purchases/${rowId}/machine`, {
        shoe_width_mm: specs.shoe_width_mm || null,
        spec_pip: specs.spec_pip || false,
        spec_blade: specs.spec_blade || false,
        spec_cabin: specs.spec_cabin || null,
        arm_type: specs.arm_type || null,
        spec_pad: specs.spec_pad || null
      });

      // Actualizar estado local con los campos correctos
      setConsolidado(prev => prev.map(r => 
        r.id === rowId 
          ? { 
              ...r, 
              shoe_width_mm: specs.shoe_width_mm,
              spec_cabin: specs.spec_cabin,
              spec_pip: specs.spec_pip,
              spec_blade: specs.spec_blade,
              arm_type: specs.arm_type,
              spec_pad: specs.spec_pad,
              // Mantener compatibilidad con campos antiguos
              track_width: specs.shoe_width_mm,
              cabin_type: specs.spec_cabin,
              wet_line: specs.spec_pip ? 'SI' : 'No',
              blade: specs.spec_blade ? 'SI' : 'No'
            }
          : r
      ));

      setSpecsPopoverOpen(null);
      setEditingSpecs(prev => {
        const newState = { ...prev };
        delete newState[rowId];
        return newState;
      });
      
      showSuccess('Especificaciones actualizadas correctamente');
    } catch (error) {
      console.error('Error actualizando especificaciones:', error);
      showError('Error al actualizar especificaciones');
    }
  };

  // Abrir popover de specs y cargar datos actuales
  const handleOpenSpecsPopover = (row: Record<string, any>) => {
    setSpecsPopoverOpen(row.id);
    setEditingSpecs(prev => ({
      ...prev,
      [row.id]: {
        shoe_width_mm: row.shoe_width_mm || row.track_width || '',
        spec_cabin: row.spec_cabin || row.cabin_type || '',
        arm_type: row.arm_type || '',
        spec_pip: row.spec_pip !== undefined ? row.spec_pip : (row.wet_line === 'SI'),
        spec_blade: row.spec_blade !== undefined ? row.spec_blade : (row.blade === 'SI'),
        spec_pad: row.spec_pad || null
      }
    }));
  };

  // Verificar si el usuario es admin
  const isAdmin = () => {
    return user?.email === 'admin@partequipos.com';
  };

  // Eliminar registro de consolidado (solo admin)
  const handleDeleteRecord = async (rowId: string, mq: string) => {
    if (!isAdmin()) {
      showError('Solo el administrador puede eliminar registros');
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de eliminar el registro ${mq || rowId}?\n\nEsta acción eliminará el registro de TODOS los módulos (Compras, Logística, Servicio, Equipos, etc.) y NO SE PUEDE DESHACER.`
    );

    if (!confirmed) return;

    try {
      await apiDelete(`/api/purchases/${rowId}`);
      
      // Actualizar estado local
      setConsolidado(prev => prev.filter(r => r.id !== rowId));
      
      showSuccess('Registro eliminado exitosamente de todos los módulos');
    } catch (error) {
      console.error('Error eliminando registro:', error);
      showError('Error al eliminar registro');
    }
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
    moduleName: 'Consolidado'
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-teal-700 rounded-xl shadow-md p-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold text-white">Consolidado General</h1>
          </div>
            </div>
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
            <div className="mb-4">
              <div className="flex flex-col md:flex-row gap-3 items-center">
                {/* Botones a la izquierda */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreateNewRow}
                    disabled={creatingNewRow}
                    className="flex items-center gap-1.5 bg-[#cf1b22] hover:bg-[#a81820] text-white px-3 py-2"
                  >
                    <Plus className="w-4 h-4" />
                    {creatingNewRow ? 'Creando...' : 'Nueva'}
                  </Button>
            <Button
                    variant="secondary"
              size="sm"
                    onClick={() => showSuccess('Exportando a Excel...')}
                    className="flex items-center gap-1.5 px-3 py-2"
                  >
                    <Download className="w-4 h-4" />
                    Excel
            </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsBrandModelManagerOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2"
                  >
                    <Settings className="w-4 h-4" />
                    Marcas/Modelos
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsAutoCostManagerOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Gastos automáticos
                  </Button>
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

                {/* Campo de búsqueda reducido */}
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por modelo o serial..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm text-sm"
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

            {/* Tabla con scroll horizontal y vertical */}
            <div 
              ref={tableScrollRef} 
              className="overflow-x-auto overflow-y-scroll" 
              style={{ 
                height: 'calc(100vh - 300px)',
                minHeight: '500px',
                maxHeight: 'calc(100vh - 300px)'
              }}
            >
              <table className="w-full min-w-[2000px]">
                <thead>
                  <tr>
                    {/* Datos principales con filtros */}
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[140px] text-gray-800 bg-teal-100">
                      <div className="mb-1">PROVEEDOR</div>
                      <select
                        value={supplierFilter}
                        onChange={(e) => setSupplierFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueSuppliers.map(s => <option key={String(s)} value={String(s)}>{String(s)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[120px] text-gray-800 bg-teal-100">
                      <div className="mb-1">MARCA</div>
                      <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueBrands.map(b => <option key={String(b)} value={String(b)}>{String(b)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[140px] text-gray-800 bg-teal-100">
                      <div className="mb-1">MODELO</div>
                      <select
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueModels.map(m => <option key={String(m)} value={String(m)}>{String(m)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[120px] text-gray-800 bg-teal-100">
                      <div className="mb-1">SERIAL</div>
                      <select
                        value={serialFilter}
                        onChange={(e) => setSerialFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueSerials.map(s => <option key={String(s)} value={String(s)}>{String(s)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[100px] text-gray-800 bg-teal-100">
                      <div className="mb-1">AÑO</div>
                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueYears.map(y => <option key={String(y)} value={String(y)}>{String(y)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase min-w-[100px] text-gray-800 bg-teal-100">
                      <div className="mb-1">HORAS</div>
                      <select
                        value={hoursFilter}
                        onChange={(e) => setHoursFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueHours.map(h => <option key={String(h)} value={String(h)}>{String(h)}</option>)}
                      </select>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-800 bg-teal-100">Tipo Compra</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-800 bg-teal-100">Spec</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-800 bg-indigo-100">INCOTERM DE COMPRA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-800 bg-indigo-100">METODO EMBARQUE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-800 bg-indigo-100">CRCY</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-orange-100">CONTRAVALOR</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-orange-100">TRM (COP)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-orange-100">Tasa</th>
                    
                    {/* CAMPOS FINANCIEROS */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-indigo-100">FOB ORIGEN</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-indigo-100">FOB (USD)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">OCEAN (USD)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">CIF (USD)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">CIF Local (COP)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">Gastos Pto (COP)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">TRASLADOS NACIONALES (COP)</th>
                    {SHOW_TRASLADO_COLUMN && (
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">Traslado (COP)</th>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">PPTO DE REPARACION (COP)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-cyan-100">VALOR SERVICIO (COP)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">Cost. Arancel</th>
                    
                    {/* CAMPOS MANUALES - Proyecciones */}
                    {/* Proyectado - OCULTO */}
                    {/* <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-yellow-500/20">
                      <div className="flex items-center gap-1 justify-end">
                        Proyectado
                        <span className="text-yellow-300" title="Campo manual">✎</span>
                      </div>
                    </th> */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">
                      <div className="flex items-center gap-1 justify-end">
                        PVP Est.
                        <span className="text-gray-600" title="Campo manual">✎</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-800 bg-teal-100">
                      <div className="flex items-center gap-1">
                        Comentarios
                        <span className="text-gray-600" title="Campo manual">✎</span>
                      </div>
                    </th>
                    
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-800 sticky right-0 bg-teal-100 z-10">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={38} className="px-4 py-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-red border-t-transparent"></div>
                        <p className="text-gray-600 mt-4">Cargando consolidado...</p>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={38} className="px-4 py-12 text-center">
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
                              type="combobox"
                              placeholder="Buscar o escribir marca"
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
                              type="combobox"
                              placeholder="Buscar o escribir modelo"
                              options={getModelOptionsForBrand(row.brand)}
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
                          <span className="text-gray-700">
                            {row.tipo_compra === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : (row.tipo_compra || '-')}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-center relative">
                          <button
                            onClick={() => handleOpenSpecsPopover(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            {row.shoe_width_mm || row.track_width || row.spec_cabin || row.cabin_type || row.arm_type ? 'Editar' : 'Agregar'}
                          </button>
                          {specsPopoverOpen === row.id && editingSpecs[row.id] && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => {
                                  setSpecsPopoverOpen(null);
                                  setEditingSpecs(prev => {
                                    const newState = { ...prev };
                                    delete newState[row.id];
                                    return newState;
                                  });
                                }}
                              />
                              <div className="absolute left-1/2 transform -translate-x-1/2 mt-2 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200">
                                <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 px-4 py-2.5 rounded-t-lg">
                                  <h4 className="text-sm font-semibold text-white">Especificaciones Técnicas</h4>
                                </div>
                                <div className="p-4 space-y-3">
                                  {/* Fila 1: Ancho Zapatas | Tipo de Cabina */}
                                  <div className="grid grid-cols-2 gap-3">
                                  {/* Ancho Zapatas */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Ancho Zapatas (mm)
                                    </label>
                                    <input
                                      type="number"
                                      value={editingSpecs[row.id].shoe_width_mm || ''}
                                      onChange={(e) => setEditingSpecs(prev => ({
                                        ...prev,
                                        [row.id]: { ...prev[row.id], shoe_width_mm: e.target.value ? Number(e.target.value) : null }
                                      }))}
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                      placeholder="Ej: 600"
                                    />
                                  </div>

                                    {/* Tipo de Cabina */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Tipo de Cabina
                                    </label>
                                    <select
                                      value={editingSpecs[row.id].spec_cabin || ''}
                                      onChange={(e) => setEditingSpecs(prev => ({
                                        ...prev,
                                        [row.id]: { ...prev[row.id], spec_cabin: e.target.value }
                                      }))}
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                    >
                                      <option value="">Seleccionar...</option>
                                      <option value="CABINA CERRADA">Cabina Cerrada</option>
                                      <option value="CABINA CERRADA/AC">Cabina Cerrada / AC</option>
                                      <option value="CANOPY">Canopy</option>
                                      <option value="N/A">N/A</option>
                                    </select>
                                  </div>
                                  </div>

                                  {/* Fila 2: Blade | Tipo de Brazo */}
                                  <div className="grid grid-cols-2 gap-3">
                                    {/* Blade */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Blade (Hoja Topadora)
                                      </label>
                                      <select
                                        value={editingSpecs[row.id].spec_blade ? 'SI' : 'No'}
                                        onChange={(e) => setEditingSpecs(prev => ({
                                          ...prev,
                                          [row.id]: { ...prev[row.id], spec_blade: e.target.value === 'SI' }
                                        }))}
                                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                      >
                                        <option value="SI">SI</option>
                                        <option value="No">No</option>
                                    </select>
                                  </div>

                                  {/* Tipo de Brazo */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Tipo de Brazo
                                    </label>
                                    <select
                                      value={editingSpecs[row.id].arm_type || ''}
                                      onChange={(e) => setEditingSpecs(prev => ({
                                        ...prev,
                                        [row.id]: { ...prev[row.id], arm_type: e.target.value }
                                      }))}
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                    >
                                      <option value="">Seleccionar...</option>
                                      <option value="ESTANDAR">ESTANDAR</option>
                                      <option value="LONG ARM">LONG ARM</option>
                                      <option value="N/A">N/A</option>
                                    </select>
                                    </div>
                                  </div>

                                  {/* Fila 3: PIP | PAD */}
                                  <div className="grid grid-cols-2 gap-3">
                                  {/* PIP */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      PIP (Accesorios)
                                    </label>
                                    <select
                                      value={editingSpecs[row.id].spec_pip ? 'SI' : 'No'}
                                      onChange={(e) => setEditingSpecs(prev => ({
                                        ...prev,
                                        [row.id]: { ...prev[row.id], spec_pip: e.target.value === 'SI' }
                                      }))}
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                    >
                                      <option value="SI">SI</option>
                                      <option value="No">No</option>
                                    </select>
                                  </div>

                                    {/* PAD */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        PAD
                                    </label>
                                    {((row.condition || '').toUpperCase() === 'USADO') ? (
                                      <select
                                        value={editingSpecs[row.id].spec_pad || ''}
                                        onChange={(e) => setEditingSpecs(prev => ({
                                          ...prev,
                                          [row.id]: { ...prev[row.id], spec_pad: e.target.value }
                                        }))}
                                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                      >
                                        <option value="">Seleccionar...</option>
                                        <option value="Bueno">Bueno</option>
                                        <option value="Malo">Malo</option>
                                      </select>
                                    ) : (
                                      <div className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                                        N/A
                                      </div>
                                    )}
                                    </div>
                                  </div>

                                  {/* Botones */}
                                  <div className="flex gap-2 pt-2">
                                    <button
                                      onClick={() => handleSaveSpecs(row.id)}
                                      className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[#cf1b22] hover:bg-[#a01419] rounded-md transition-colors"
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSpecsPopoverOpen(null);
                                        setEditingSpecs(prev => {
                                          const newState = { ...prev };
                                          delete newState[row.id];
                                          return newState;
                                        });
                                      }}
                                      className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
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
                          {formatNumber(row.usd_jpy_rate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.trm_rate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatNumber(row.tasa)}
                        </td>

                        {/* CAMPOS FINANCIEROS */}
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <span className="text-gray-800 font-medium">
                            {formatCurrencyWithSymbol(row.currency, row.precio_fob)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.fob_usd ?? computeFobUsd(row))}
                        </td>
                        <td className={`relative px-4 py-3 text-sm text-right ${
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
                                placeholder="0.00"
                                displayFormatter={() => formatCurrencyWithSymbol('USD', row.inland)}
                                onSave={(val) => {
                                  const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                  return requestFieldUpdate(row, 'inland', 'OCEAN (USD)', numeric);
                                }}
                              />
                            </InlineCell>

                            <button
                              onClick={async () => {
                                if (paymentPopoverOpen === row.id) {
                                  setPaymentPopoverOpen(null);
                                  return;
                                }
                                await fetchPaymentDetails(row.id);
                                setPaymentPopoverOpen(row.id as string);
                              }}
                              className="p-1.5 rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                              title="Ver pagos y OCEAN"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>

                            {toNumber(row.inland) > 0 && (
                              <button
                                onClick={() => requestFieldUpdate(row, 'inland_verified', 'OCEAN Verificado', !row.inland_verified)}
                                className={`p-1 rounded ${row.inland_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                title={row.inland_verified ? 'Verificado' : 'Marcar como verificado'}
                              >
                                {row.inland_verified ? '✓' : '○'}
                              </button>
                            )}
                          </div>

                          {paymentPopoverOpen === row.id && (
                            <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] z-40">
                              <div className="bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden">
                                <div className="bg-gradient-to-r from-[#cf1b22] to-[#a01419] px-3 py-2 text-white flex items-center justify-between">
                                  <div className="flex flex-col gap-0.5">
                                    <p className="text-[11px] uppercase tracking-wide opacity-80">Pagos del equipo</p>
                                    <p className="text-sm font-semibold">{row.model} · MQ {row.mq || '-'}</p>
                                  </div>
                                  <button
                                    onClick={() => setPaymentPopoverOpen(null)}
                                    className="text-white/80 hover:text-white"
                                    title="Cerrar"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="p-3 space-y-2 text-xs text-gray-700">
                                  {paymentLoading ? (
                                    <div className="py-4 text-center text-gray-500">Cargando pagos...</div>
                                  ) : paymentDetails[row.id as string] ? (
                                    <>
                                      <div className="grid grid-cols-4 gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                                        <div>
                                          <p className="text-[10px] text-gray-500">Factura</p>
                                          <p className="font-semibold truncate">{paymentDetails[row.id as string].no_factura || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-gray-500">Proveedor</p>
                                          <p className="font-semibold truncate">{paymentDetails[row.id as string].proveedor || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-gray-500">Moneda</p>
                                          <p className="font-semibold truncate">{paymentDetails[row.id as string].moneda || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-gray-500">Fecha pago</p>
                                          <p className="font-semibold truncate">
                                            {paymentDetails[row.id as string].payment_date
                                              ? new Date(paymentDetails[row.id as string].payment_date).toLocaleDateString('es-CO')
                                              : '-'}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                                        <div>
                                          <p className="text-[10px] text-gray-500">OCEAN Pagos (USD)</p>
                                          <p className="font-semibold text-gray-900">
                                            {formatShortCurrency(paymentDetails[row.id as string].ocean_pagos, 'USD')}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-gray-500">TRM OCEAN (COP)</p>
                                          <p className="font-semibold text-gray-900">
                                            {formatShortCurrency(paymentDetails[row.id as string].trm_ocean, 'COP')}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p className="text-[10px] text-gray-500">Total Valor Girado</p>
                                          <p className="font-semibold">
                                            {formatShortCurrency(paymentDetails[row.id as string].total_valor_girado, 'COP')}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-gray-500">Tasa Promedio</p>
                                          <p className="font-semibold">
                                            {formatNumber(getTasaPromedioPagos(paymentDetails[row.id as string]))}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p className="text-[10px] text-gray-500">Contravalor</p>
                                          <p className="font-semibold">
                                            {formatShortCurrency(paymentDetails[row.id as string].usd_jpy_rate, paymentDetails[row.id as string].moneda || 'USD')}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-gray-500">TRM (COP)</p>
                                          <p className="font-semibold">
                                            {formatShortCurrency(paymentDetails[row.id as string].trm_rate, 'COP')}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="border-t pt-2">
                                        <p className="text-[10px] text-gray-500 mb-1 font-semibold uppercase">Observaciones</p>
                                        <p className="text-[11px] text-gray-700 whitespace-pre-wrap">
                                          {paymentDetails[row.id as string].observaciones_pagos || 'Sin observaciones'}
                                        </p>
                                      </div>

                                      <div className="border-t pt-2">
                                        <p className="text-[10px] text-gray-500 mb-1 font-semibold uppercase">Pagos parciales</p>
                                        <div className="grid grid-cols-3 gap-2">
                                          {[1,2,3].map((n) => {
                                            const prefix = `pago${n}_`;
                                            const data = paymentDetails[row.id as string];
                                            return (
                                              <div key={n} className="border border-gray-200 rounded-lg p-2">
                                                <p className="text-[10px] text-gray-500 mb-1">Pago {n}</p>
                                                <p className="text-[11px] text-gray-700">Moneda: <span className="font-semibold">{data[`${prefix}moneda`] || '-'}</span></p>
                                                <p className="text-[11px] text-gray-700">Contravalor: <span className="font-semibold">{formatShortCurrency(data[`${prefix}contravalor`], data[`${prefix}moneda`] || 'USD')}</span></p>
                                                <p className="text-[11px] text-gray-700">TRM: <span className="font-semibold">{formatShortCurrency(data[`${prefix}trm`], 'COP')}</span></p>
                                                <p className="text-[11px] text-gray-700">Valor girado: <span className="font-semibold">{formatShortCurrency(data[`${prefix}valor_girado`], 'COP')}</span></p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="py-4 text-center text-gray-500">Sin datos de pago</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.cif_usd ?? computeCifUsd(row))}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.cif_local ?? computeCifLocal(row))}
                        </td>
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
                                  return requestFieldUpdate(row, 'gastos_pto', 'Gastos Puerto', numeric);
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
                                  return requestFieldUpdate(row, 'flete', 'Traslados Nacionales', numeric);
                                }}
                              />
                            </InlineCell>
                            {toNumber(row.flete) > 0 && (
                              <button
                                onClick={() => requestFieldUpdate(row, 'flete_verified', 'Traslados Nacionales Verificado', !row.flete_verified)}
                                className={`p-1 rounded ${row.flete_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                title={row.flete_verified ? 'Verificado' : 'Marcar como verificado'}
                              >
                                {row.flete_verified ? '✓' : '○'}
                              </button>
                            )}
                          </div>
                        </td>
                    {SHOW_TRASLADO_COLUMN && (
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
                                return requestFieldUpdate(row, 'traslado', 'Traslado', numeric);
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
                    )}
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
                                    return requestFieldUpdate(row, 'repuestos', 'PPTO Reparación', numeric);
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
                                forcePopoverPosition="bottom"
                                onApply={(value) => requestFieldUpdate(row, 'repuestos', 'PPTO Reparación', value)}
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
                        {/* Proyectado - OCULTO */}
                        {/* <td className="px-4 py-3 text-sm text-gray-700 text-right">
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
                        </td> */}
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
                                forcePopoverPosition="bottom"
                                onApply={(value) => requestFieldUpdate(row, 'pvp_est', 'PVP Estimado', value)}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 relative">
                          <div className="flex items-center justify-center gap-1 relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setServiceCommentsPopover(serviceCommentsPopover === row.id ? null : row.id);
                                  setCommercialCommentsPopover(null);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Comentarios Servicio"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCommercialCommentsPopover(commercialCommentsPopover === row.id ? null : row.id);
                                  setServiceCommentsPopover(null);
                                }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Comentarios Comercial"
                              >
                                <Store className="w-3.5 h-3.5" />
                              </button>
                              
                              {/* Popover Comentarios Servicio */}
                              {serviceCommentsPopover === row.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setServiceCommentsPopover(null)}
                                    style={{ backgroundColor: 'transparent' }}
                                  />
                                  <div
                                    className="comments-popover absolute z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200"
                                    style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, transform: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="bg-[#50504f] text-white px-3 py-2 flex items-center justify-between rounded-t-lg">
                                      <span className="text-xs font-medium flex items-center gap-2">
                                        <Wrench className="w-3.5 h-3.5" />
                                        Comentarios Servicio
                                      </span>
                                      <button
                                        onClick={() => setServiceCommentsPopover(null)}
                                        className="hover:bg-white/20 rounded p-0.5"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="p-3">
                                      <textarea
                                        value={row.comentarios_servicio || ''}
                                        onChange={(e) => {
                                          const updated = consolidado.map(r => 
                                            r.id === row.id ? { ...r, comentarios_servicio: e.target.value } : r
                                          );
                                          setConsolidado(updated);
                                        }}
                                        placeholder="Escribir comentarios de servicio..."
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22] resize-none"
                                        rows={4}
                                      />
                                      <div className="flex gap-2 mt-2">
                                        <button
                                          onClick={async () => {
                                            try {
                                              await apiPut(`/api/management/${row.id}`, {
                                                comentarios_servicio: row.comentarios_servicio || null
                                              });
                                              showSuccess('Comentarios de servicio guardados');
                                              setServiceCommentsPopover(null);
                                            } catch (error) {
                                              showError('Error al guardar comentarios');
                                            }
                                          }}
                                          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-[#cf1b22] hover:bg-[#a01419] rounded transition-colors"
                                        >
                                          Guardar
                                        </button>
                                        <button
                                          onClick={() => setServiceCommentsPopover(null)}
                                          className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}
                              {/* Popover Comentarios Comercial */}
                              {commercialCommentsPopover === row.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setCommercialCommentsPopover(null)}
                                    style={{ backgroundColor: 'transparent' }}
                                  />
                                  <div
                                    className="comments-popover absolute z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200"
                                    style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, transform: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="bg-[#50504f] text-white px-3 py-2 flex items-center justify-between rounded-t-lg">
                                      <span className="text-xs font-medium flex items-center gap-2">
                                        <Store className="w-3.5 h-3.5" />
                                        Comentarios Comercial
                                      </span>
                                      <button
                                        onClick={() => setCommercialCommentsPopover(null)}
                                        className="hover:bg-white/20 rounded p-0.5"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="p-3">
                                      <textarea
                                        value={row.comentarios_comercial || ''}
                                        onChange={(e) => {
                                          const updated = consolidado.map(r => 
                                            r.id === row.id ? { ...r, comentarios_comercial: e.target.value } : r
                                          );
                                          setConsolidado(updated);
                                        }}
                                        placeholder="Escribir comentarios comerciales..."
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22] resize-none"
                                        rows={4}
                            />
                                      <div className="flex gap-2 mt-2">
                                        <button
                                          onClick={async () => {
                                            try {
                                              await apiPut(`/api/management/${row.id}`, {
                                                comentarios_comercial: row.comentarios_comercial || null
                                              });
                                              showSuccess('Comentarios comerciales guardados');
                                              setCommercialCommentsPopover(null);
                                            } catch (error) {
                                              showError('Error al guardar comentarios');
                                            }
                                          }}
                                          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-[#cf1b22] hover:bg-[#a01419] rounded transition-colors"
                                        >
                                          Guardar
                                        </button>
                                        <button
                                          onClick={() => setCommercialCommentsPopover(null)}
                                          className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}
                          </div>
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
                              onClick={() => handleApplyAutoCosts(row)}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Aplicar gastos automáticos"
                            >
                              <Calculator className="w-4 h-4" />
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
                            {isAdmin() && (
                              <button
                                onClick={() => handleDeleteRecord(row.id, row.mq)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar registro (solo admin)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
              {/* Espacio adicional al final para permitir scroll completo y ver popovers inferiores */}
              <div style={{ height: '300px', minHeight: '300px', width: '100%' }}></div>
            </div>
      </Card>
        </motion.div>

        {/* Modal de Edición */}
      <Modal
          isOpen={isEditModalOpen}
          onClose={handleCancel}
          title="Editar Registro"
        size="lg"
      >
          {currentRow && (
            <div className="space-y-4">
              {/* Encabezado registro - Diseño Premium Compacto */}
              <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 p-4 rounded-lg text-white shadow-md">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-red-100 mb-0.5">Editando Equipo</p>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold">
                      {currentRow.model} - S/N {currentRow.serial}
                    </p>
                      <button
                        onClick={() => handleViewPhotos(currentRow)}
                        className="p-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
                        title="Ver todas las fotos"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-white" />
                      </button>
                  </div>
                    {(currentRow.year || currentRow.hours || currentRow.model || currentRow.spec_cabin || currentRow.cabin_type || currentRow.arm_type || currentRow.shoe_width_mm || currentRow.track_width || currentRow.spec_pip !== undefined || currentRow.spec_blade !== undefined || currentRow.wet_line || currentRow.blade) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-red-50/90 font-normal">
                        {currentRow.year && (
                          <span className="flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded">
                            <span className="text-red-200/70">Año:</span>
                            <span className="font-medium">{currentRow.year}</span>
                          </span>
                        )}
                        {currentRow.hours && (
                          <span className="flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded">
                            <span className="text-red-200/70">Horas:</span>
                            <span className="font-medium">{currentRow.hours.toLocaleString('es-CO')}</span>
                          </span>
                        )}
                        {currentRow.model && (
                          <span className="flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded">
                            <span className="text-red-200/70">Modelo:</span>
                            <span className="font-medium">{currentRow.model}</span>
                          </span>
                        )}
                        {/* Especificaciones Técnicas */}
                        {(currentRow.spec_cabin || currentRow.cabin_type) && (
                          <span className="flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded">
                            <span className="text-red-200/70">Cabina:</span>
                            <span className="font-medium">{currentRow.spec_cabin || currentRow.cabin_type || '-'}</span>
                          </span>
                        )}
                        {currentRow.arm_type && (
                          <span className="flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded">
                            <span className="text-red-200/70">Brazo:</span>
                            <span className="font-medium">{currentRow.arm_type}</span>
                          </span>
                        )}
                        {(currentRow.shoe_width_mm || currentRow.track_width) && (
                          <span className="flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded">
                            <span className="text-red-200/70">Zapata:</span>
                            <span className="font-medium">{currentRow.shoe_width_mm || currentRow.track_width}{currentRow.shoe_width_mm || currentRow.track_width ? 'mm' : ''}</span>
                          </span>
                        )}
                        {(currentRow.spec_pip !== undefined || currentRow.wet_line) && (
                          <span className="flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded">
                            <span className="text-red-200/70">PIP:</span>
                            <span className="font-medium">
                              {currentRow.spec_pip === true || currentRow.wet_line === 'SI' ? 'SI' : (currentRow.spec_pip === false || currentRow.wet_line === 'No' ? 'NO' : '-')}
                            </span>
                          </span>
                        )}
                        {(currentRow.spec_blade !== undefined || currentRow.blade) && (
                          <span className="flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded">
                            <span className="text-red-200/70">Blade:</span>
                            <span className="font-medium">
                              {currentRow.spec_blade === true || currentRow.blade === 'SI' ? 'SI' : (currentRow.spec_blade === false || currentRow.blade === 'No' ? 'NO' : '-')}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Resumen de valores */}
              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 mb-0.5">PRECIO</p>
                  <p className="text-sm font-bold text-[#50504f]">{formatCurrency(currentRow.precio_fob)}</p>
                  </div>
                <div className="text-center border-x border-gray-200">
                  <p className="text-[10px] text-gray-500 mb-0.5">CIF USD</p>
                  <p className="text-sm font-bold text-[#50504f]">{formatCurrency(currentRow.cif_usd)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 mb-0.5">CIF LOCAL</p>
                  <p className="text-sm font-bold text-[#50504f]">{formatCurrency(currentRow.cif_local)}</p>
                </div>
              </div>

              {/* GASTOS OPERACIONALES */}
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <h4 className="text-xs font-semibold text-[#50504f] mb-2 pb-1.5 border-b border-gray-100">
                  GASTOS OPERACIONALES
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">OCEAN</label>
                    <input 
                      type="text" 
                      value={getInputValue('inland', editData.inland)} 
                      onChange={(e) => {
                        setLocalInputValues(prev => ({...prev, inland: e.target.value}));
                      }} 
                      onFocus={(e) => {
                        const numValue = editData.inland;
                        if (numValue !== null && numValue !== undefined) {
                          setLocalInputValues(prev => ({...prev, inland: numValue.toString()}));
                        }
                      }}
                      onBlur={(e) => {
                        const numValue = parseFormattedNumber(e.target.value);
                        setEditData({...editData, inland: numValue});
                        setLocalInputValues(prev => {
                          const newState = {...prev};
                          delete newState.inland;
                          return newState;
                        });
                      }}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" 
                      placeholder="$0,00" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Gastos Pto</label>
                    <input 
                      type="text" 
                      value={getInputValue('gastos_pto', editData.gastos_pto)} 
                      onChange={(e) => {
                        setLocalInputValues(prev => ({...prev, gastos_pto: e.target.value}));
                      }} 
                      onFocus={(e) => {
                        const numValue = editData.gastos_pto;
                        if (numValue !== null && numValue !== undefined) {
                          setLocalInputValues(prev => ({...prev, gastos_pto: numValue.toString()}));
                        }
                      }}
                      onBlur={(e) => {
                        const numValue = parseFormattedNumber(e.target.value);
                        setEditData({...editData, gastos_pto: numValue});
                        setLocalInputValues(prev => {
                          const newState = {...prev};
                          delete newState.gastos_pto;
                          return newState;
                        });
                      }}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" 
                      placeholder="$0,00" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Traslados Nacionales</label>
                    <input 
                      type="text" 
                      value={getInputValue('flete', editData.flete)} 
                      onChange={(e) => {
                        setLocalInputValues(prev => ({...prev, flete: e.target.value}));
                      }} 
                      onFocus={(e) => {
                        const numValue = editData.flete;
                        if (numValue !== null && numValue !== undefined) {
                          setLocalInputValues(prev => ({...prev, flete: numValue.toString()}));
                        }
                      }}
                      onBlur={(e) => {
                        const numValue = parseFormattedNumber(e.target.value);
                        setEditData({...editData, flete: numValue});
                        setLocalInputValues(prev => {
                          const newState = {...prev};
                          delete newState.flete;
                          return newState;
                        });
                      }}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" 
                      placeholder="$0,00" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Traslado</label>
                    <input 
                      type="text" 
                      value={getInputValue('traslado', editData.traslado)} 
                      onChange={(e) => {
                        setLocalInputValues(prev => ({...prev, traslado: e.target.value}));
                      }} 
                      onFocus={(e) => {
                        const numValue = editData.traslado;
                        if (numValue !== null && numValue !== undefined) {
                          setLocalInputValues(prev => ({...prev, traslado: numValue.toString()}));
                        }
                      }}
                      onBlur={(e) => {
                        const numValue = parseFormattedNumber(e.target.value);
                        setEditData({...editData, traslado: numValue});
                        setLocalInputValues(prev => {
                          const newState = {...prev};
                          delete newState.traslado;
                          return newState;
                        });
                      }}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" 
                      placeholder="$0,00" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Valor Servicio</label>
                    <span className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 text-gray-500 block">{formatCurrency(editData.service_value) || '-'}</span>
                  </div>
                </div>
              </div>

              {/* PPTO Reparación y venta */}
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <h4 className="text-xs font-semibold text-[#50504f] mb-2 pb-1.5 border-b border-gray-100">
                  PPTO Reparación y venta
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-600 mb-0.5">PPTO Reparación</label>
                      <input 
                        type="text" 
                        value={getInputValue('repuestos', editData.repuestos)} 
                        onChange={(e) => {
                          setLocalInputValues(prev => ({...prev, repuestos: e.target.value}));
                        }} 
                        onFocus={(e) => {
                          const numValue = editData.repuestos;
                          if (numValue !== null && numValue !== undefined) {
                            setLocalInputValues(prev => ({...prev, repuestos: numValue.toString()}));
                          }
                        }}
                        onBlur={(e) => {
                          const numValue = parseFormattedNumber(e.target.value);
                          setEditData({...editData, repuestos: numValue});
                          setLocalInputValues(prev => {
                            const newState = {...prev};
                            delete newState.repuestos;
                            return newState;
                          });
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" 
                        placeholder="$0,00" 
                      />
                    {currentRow && currentRow.model && (
                        <div className="mt-1">
                        <PriceSuggestion
                          type="repuestos"
                          model={currentRow.model}
                          year={currentRow.year}
                          hours={currentRow.hours}
                          autoFetch={true}
                            compact={true}
                            forcePopoverPosition="bottom"
                          onApply={(value) => setEditData({...editData, repuestos: value})}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                      <label className="flex items-center gap-1 text-[10px] font-medium text-gray-600 mb-0.5">
                        <Wrench className="w-3 h-3" />
                        Comentarios Servicio
                      </label>
                      <textarea 
                        value={editData.comentarios_servicio || ''} 
                        onChange={(e) => setEditData({...editData, comentarios_servicio: e.target.value})} 
                        rows={3} 
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" 
                        placeholder="Escribir comentarios de servicio..." 
                      />
                  </div>
                </div>
                  <div className="space-y-2">
                  <div>
                      <label className="block text-[10px] font-medium text-gray-600 mb-0.5">PVP Estimado</label>
                      <input 
                        type="text" 
                        value={getInputValue('pvp_est', editData.pvp_est)} 
                        onChange={(e) => {
                          setLocalInputValues(prev => ({...prev, pvp_est: e.target.value}));
                        }} 
                        onFocus={(e) => {
                          const numValue = editData.pvp_est;
                          if (numValue !== null && numValue !== undefined) {
                            setLocalInputValues(prev => ({...prev, pvp_est: numValue.toString()}));
                          }
                        }}
                        onBlur={(e) => {
                          const numValue = parseFormattedNumber(e.target.value);
                          setEditData({...editData, pvp_est: numValue});
                          setLocalInputValues(prev => {
                            const newState = {...prev};
                            delete newState.pvp_est;
                            return newState;
                          });
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" 
                        placeholder="$0,00" 
                      />
                    {currentRow && currentRow.model && (
                        <div className="mt-1">
                        <PriceSuggestion
                          type="pvp"
                          model={currentRow.model}
                          year={currentRow.year}
                          hours={currentRow.hours}
                          costoArancel={currentRow.cost_arancel}
                          autoFetch={true}
                            compact={true}
                            forcePopoverPosition="bottom"
                          onApply={(value) => setEditData({...editData, pvp_est: value})}
                        />
                      </div>
                    )}
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-[10px] font-medium text-gray-600 mb-0.5">
                        <Store className="w-3 h-3" />
                        Comentarios Comercial
                      </label>
                      <textarea 
                        value={editData.comentarios_comercial || ''} 
                        onChange={(e) => setEditData({...editData, comentarios_comercial: e.target.value})} 
                        rows={3} 
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22]" 
                        placeholder="Escribir comentarios comerciales..." 
                      />
                    </div>
                  </div>
                  </div>
                </div>
                
              {/* Costo Arancel */}
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-[10px] text-gray-500 mb-0.5">Costo Arancel (Automático)</p>
                  <p className="text-sm font-bold text-[#cf1b22]">{formatCurrency(currentRow.cost_arancel)}</p>
                </div>
              </div>

              {/* Archivos */}
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <button
                  onClick={() => setFilesSectionExpanded(!filesSectionExpanded)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-[#50504f] mb-2 hover:text-[#cf1b22] transition-colors"
                >
                  <span>📂 Gestión de Archivos</span>
                  {filesSectionExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {filesSectionExpanded && (
                  <MachineFiles 
                    machineId={currentRow.machine_id} 
                    allowUpload={true} 
                    allowDelete={true}
                    enablePhotos={true}
                    enableDocs={true}
                    currentScope="CONSOLIDADO"
                    uploadExtraFields={{ scope: 'CONSOLIDADO' }}
                  />
                )}
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <Button variant="secondary" onClick={handleCancel} className="px-4 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-[#50504f]">
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="px-4 py-1.5 text-xs bg-[#cf1b22] hover:bg-[#a81820] text-white">
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
                  <p className="text-sm font-bold text-indigo-700">{formatCurrencyWithSymbol(viewRow.currency, viewRow.precio_fob)}</p>
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
                  <p className="text-xs text-gray-500">OCEAN</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.inland)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gastos Pto</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.gastos_pto)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Traslados Nacionales</p>
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
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4 bg-gray-50 p-4 rounded-xl">
                {/* Proyectado - OCULTO */}
                {/* <div>
                  <p className="text-xs text-gray-500">Proyectado</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.proyectado)}</p>
                </div> */}
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
              <button
                onClick={() => setViewFilesSectionExpanded(!viewFilesSectionExpanded)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-800 mb-3 hover:text-[#cf1b22] transition-colors"
              >
                <span className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-700" /> 📂 Archivos de la Máquina
                </span>
                {viewFilesSectionExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {viewFilesSectionExpanded && (
              <div className="p-4 rounded-xl border bg-white">
                <MachineFiles 
                  machineId={viewRow.machine_id} 
                  allowUpload={false} 
                  allowDelete={false}
                  enablePhotos={true}
                  enableDocs={true}
                  currentScope="CONSOLIDADO"
                />
              </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Panel de Fotos - Superior Derecha */}
      <AnimatePresence>
        {photosModalOpen && allPhotos.length > 0 && selectedPhotoIndex !== null && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-4 right-4 z-[9999] w-96 bg-white rounded-lg shadow-2xl border-2 border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-white" />
                <span className="text-sm font-semibold text-white">Fotos ({selectedPhotoIndex + 1}/{allPhotos.length})</span>
              </div>
              <button
                onClick={() => {
                  setPhotosModalOpen(false);
                  setSelectedPhotoIndex(null);
                }}
                className="text-white hover:bg-white/20 rounded p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Imagen */}
            <div className="relative bg-gray-900 flex items-center justify-center h-80">
              <motion.img
                key={selectedPhotoIndex}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                src={`${API_URL}/api/files/download/${allPhotos[selectedPhotoIndex].id}`}
                alt={allPhotos[selectedPhotoIndex].file_name}
                className="max-w-full max-h-full object-contain"
              />

              {/* Botón Anterior */}
              {allPhotos.length > 1 && (
                <button
                  onClick={() => {
                    setSelectedPhotoIndex((prev) => (prev === null ? 0 : prev === 0 ? allPhotos.length - 1 : prev - 1));
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Botón Siguiente */}
              {allPhotos.length > 1 && (
                <button
                  onClick={() => {
                    setSelectedPhotoIndex((prev) => (prev === null ? 0 : prev === allPhotos.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Footer con nombre */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-700 truncate" title={allPhotos[selectedPhotoIndex].file_name}>
                {allPhotos[selectedPhotoIndex].file_name}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        {currentRow && (
          <ChangeHistory 
            tableName="purchases" 
            recordId={currentRow.id}
            purchaseId={currentRow.id}
          />
        )}
      </Modal>

      {/* Gestor de marcas y modelos */}
      <BrandModelManager
        isOpen={isBrandModelManagerOpen}
        onClose={() => setIsBrandModelManagerOpen(false)}
        onBrandsChange={(brands) => setDynamicBrands(brands)}
        onModelsChange={(models) => setDynamicModels(models)}
      />

      <AutoCostManager
        isOpen={isAutoCostManagerOpen}
        onClose={() => setIsAutoCostManagerOpen(false)}
      />

      </div>
    </div>
  );
};
