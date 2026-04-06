/**
 * Página de Consolidado - Dashboard Ejecutivo Premium
 * Tabla Digital con todos los campos
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Download, TrendingUp, DollarSign, Package, BarChart3, FileSpreadsheet, Edit, Eye, Wrench, Calculator, History, Clock, Plus, Layers, Save, X, Settings, Trash2, ChevronDown, ChevronUp, Image as ImageIcon, ChevronLeft, ChevronRight, Store, CreditCard, FilterX, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { MachineFiles } from '../components/MachineFiles';
import { motion, AnimatePresence } from 'framer-motion';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ModelFilter } from '../components/ModelFilter';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { PriceSuggestion } from '../components/PriceSuggestion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
// Select removido - no se usa actualmente
import { Modal } from '../molecules/Modal';
import { apiGet, apiPut, apiPost, apiDelete, API_URL } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { useChangeDetection } from '../hooks/useChangeDetection';
import { useBatchModeGuard } from '../hooks/useBatchModeGuard';
import { useAuth } from '../context/AuthContext';
import { AUCTION_SUPPLIERS } from '../constants/auctionSuppliers';
import { MODEL_OPTIONS } from '../constants/models';
import { BrandModelManager } from '../components/BrandModelManager';
import { AutoCostManager } from '../components/AutoCostManager';
import { applyAutoCostRule } from '../services/autoCostRules.service';
import { MACHINE_TYPE_OPTIONS_FOCUSED_UI, formatMachineType, machineTypeMatchesFilter } from '../constants/machineTypes';
import {
  getBrandsFromIndex,
  getModelsFromIndex,
} from '../constants/machineTypeBrandModelIndex';
import {
  getShipmentPolicyByTonnage,
  normalizeShipmentMethod,
} from '../constants/shipmentMethodByTonnage';
import { formatChangeValue as formatChangeValueFromUtil } from '../utils/formatChangeValue';
import { getMachineSerialForDisplay, resolveSerialValueForSave } from '../utils/machineSerialDisplay';
import { getShoeWidthConfigForModel, TONNAGE_RANGES } from '../constants/shoeWidthConfig';
import { ManagementInlineCell } from '../components/ManagementInlineCell';
// Opciones de año (2010 -> año actual + 1)
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2009 + 1 }, (_, i) => {
  const year = 2010 + i;
  return { value: year.toString(), label: year.toString() };
});

  const SHOW_TRASLADO_COLUMN = false;

// Función helper para formatear tipo de compra para visualización
const formatTipoCompra = (tipo: string | null | undefined): string => {
  if (!tipo || tipo === '-') return '-';
  const upperTipo = tipo.toUpperCase();
  if (upperTipo.includes('SUBASTA')) {
    return 'BID';
  } else if (upperTipo.includes('COMPRA_DIRECTA') || upperTipo.includes('COMPRA DIRECTA')) {
    return 'CD';
  }
  return tipo;
};

function sanitizeSuggestionNumericInput(rawValue: string): string {
  return rawValue.trim().replaceAll(/[^\d,.-]/g, '');
}

function normalizeSuggestionMixedSeparators(cleaned: string): string {
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  return lastComma > lastDot
    ? cleaned.replaceAll('.', '').replaceAll(',', '.')
    : cleaned.replaceAll(',', '');
}

function normalizeSuggestionCommaOnly(cleaned: string): string {
  const hasThousandsComma = /^-?\d{1,3}(,\d{3})+$/.test(cleaned);
  return hasThousandsComma ? cleaned.replaceAll(',', '') : cleaned.replaceAll(',', '.');
}

function normalizeSuggestionDotOnly(cleaned: string): string {
  const hasThousandsDot = /^-?\d{1,3}(\.\d{3})+$/.test(cleaned);
  return hasThousandsDot ? cleaned.replaceAll('.', '') : cleaned;
}

function normalizeSuggestionNumericString(cleaned: string): string {
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  if (hasDot && hasComma) return normalizeSuggestionMixedSeparators(cleaned);
  if (hasComma) return normalizeSuggestionCommaOnly(cleaned);
  if (hasDot) return normalizeSuggestionDotOnly(cleaned);
  return cleaned;
}

function parseSuggestionNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = sanitizeSuggestionNumericInput(value);
  if (!cleaned) return null;
  const normalized = normalizeSuggestionNumericString(cleaned);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// Mapeo de proveedor a moneda para asignación automática
const normalizeSupplierForCurrencyLookup = (supplier: string): string => (
  supplier
    .toUpperCase()
    .replace(/^\d+\s+/, '')
    .replaceAll(/\s*\/\s*/g, ' / ')
    .replaceAll(/\s+/g, ' ')
    .trim()
);

const SUPPLIER_CURRENCY_ENTRIES: Array<[string, string]> = [
  ['GREEN', 'JPY'],
  ['GUIA', 'JPY'],
  ['HCMJ', 'JPY'],
  ['JEN', 'JPY'],
  ['KANEHARU', 'JPY'],
  ['KIXNET', 'JPY'],
  ['NORI', 'JPY'],
  ['ONAGA', 'JPY'],
  ['SOGO', 'JPY'],
  ['THI', 'JPY'],
  ['TOZAI', 'JPY'],
  ['WAKITA', 'JPY'],
  ['YUMAC', 'JPY'],
  ['AOI', 'JPY'],
  ['NDT', 'JPY'],
  ['EUROAUCTIONS / UK', 'GBP'],
  ['EUROAUCTIONS / GER', 'EUR'],
  ['EUROAUCTIONS / ESP', 'EUR'],
  ['HCMJ / KANAMOTO', 'JPY'],
  ['HCMJ / ONAGA', 'JPY'],
  ['YUVASA', 'JPY'],
  ['YUASA', 'JPY'],
  ['RITCHIE / USA / PE USA', 'USD'],
  ['RITCHIE / CAN / PE USA', 'CAD'],
  ['RITCHIE / ESP', 'EUR'],
  ['ROYAL - PROXY / USA / PE USA', 'USD'],
  ['ACME / USA / PE USA', 'USD'],
  ['GDF', 'JPY'],
  ['GOSHO', 'JPY'],
  ['JTF', 'JPY'],
  ['KATAGIRI', 'JPY'],
  ['MONJI', 'JPY'],
  ['REIBRIDGE', 'JPY'],
  ['IRON PLANET / USA / PE USA', 'USD'],
  ['IRON PLANET / BOOM', 'USD'],
  ['IRON PLANET / BOOM & BUCKET', 'USD'],
  ['IRON PLANET / BOOM & BUCKET / USA / PE USA', 'USD'],
  ['MULTISERVICIOS / USA', 'USD'],
  ['MULTISERVICIOS / USA / PE USA', 'USD'],
  ['TOYOKAMI', 'JPY'],
  ['SHOJI', 'JPY'],
  ['YIWU ELI TRADING COMPANY / CHINA', 'USD'],
  ['E&F / USA / PE USA', 'USD'],
  ['DIESEL', 'JPY'],
];

const SUPPLIER_CURRENCY_MAP: Record<string, string> = SUPPLIER_CURRENCY_ENTRIES.reduce<Record<string, string>>(
  (acc, [supplier, currency]) => {
    acc[normalizeSupplierForCurrencyLookup(supplier)] = currency;
    return acc;
  },
  {}
);

// Constantes para actualización local de consolidado (evitar recreación y reducir complejidad)
const NUMERIC_FIELDS_CONSOLIDADO = new Set(['pvp_est', 'precio_fob', 'inland', 'gastos_pto', 'flete', 'traslado', 'repuestos', 'service_value', 'cost_arancel', 'proyectado', 'exw_value', 'fob_value', 'trm', 'usd_rate', 'jpy_rate', 'usd_jpy_rate', 'trm_rate', 'fob_usd', 'valor_factura_proveedor', 'tasa']);
const VERIFIED_FIELDS_MAP_CONSOLIDADO: Record<string, string> = {
  inland: 'inland_verified',
  gastos_pto: 'gastos_pto_verified',
  flete: 'flete_verified',
  traslado: 'traslado_verified',
  repuestos: 'repuestos_verified',
  precio_fob: 'fob_total_verified',
  exw_value_formatted: 'fob_total_verified',
  fob_expenses: 'fob_total_verified',
  disassembly_load_value: 'fob_total_verified',
};

// Función helper para obtener la moneda de un proveedor
const getCurrencyForSupplier = (supplier: string | null | undefined): string | null => {
  if (!supplier) return null;
  const normalizedSupplier = normalizeSupplierForCurrencyLookup(String(supplier));
  const mappedCurrency = SUPPLIER_CURRENCY_MAP[normalizedSupplier] || null;
  console.log('🔍 Buscando currency para proveedor:', { supplier, normalizedSupplier, mapped: mappedCurrency });
  return mappedCurrency;
};

// Tipo base para registros de consolidado - permite acceso indexado
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConsolidadoRecord = Record<string, any>;

// Tipo para detalles de pago
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PaymentDetails = Record<string, any>;

// Tipo para especificaciones en edición
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditingSpecs = Record<string, any>;

// Tipo para datos de actualización pendiente
type PendingUpdate = {
  id: string | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
} | null;


export const ManagementPage = () => { // NOSONAR - Componente orquestador grande; complejidad aceptada para preservar flujo actual
  const { user } = useAuth();
  const [consolidado, setConsolidado] = useState<Array<ConsolidadoRecord>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // Filtros de columnas
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [machineTypeFilter, setMachineTypeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [serialFilter, setSerialFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [hoursFilter, setHoursFilter] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState<ConsolidadoRecord | null>(null);
  const [viewRow, setViewRow] = useState<ConsolidadoRecord | null>(null);
  const [editData, setEditData] = useState<ConsolidadoRecord>({});
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate>(null);
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
  const [editingSpecs, setEditingSpecs] = useState<EditingSpecs>({});
  const [specDefaultsCache, setSpecDefaultsCache] = useState<Record<string, {
    shoe_width_mm?: number | null;
    spec_cabin?: string | null;
    arm_type?: string | null;
    spec_pip?: boolean | null;
    spec_blade?: boolean | null;
    spec_pad?: string | null;
  }>>({});
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
  const [paymentDetails, setPaymentDetails] = useState<Record<string, PaymentDetails>>({});
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [serviceValuePopover, setServiceValuePopover] = useState<string | null>(null);
  /** Id de la última fila editada (inline); se usa para resaltar sutilmente la fila y que el usuario no se pierda */
  const [lastEditedRowId, setLastEditedRowId] = useState<string | null>(null);
  const getPurchaseKey = useCallback(
    (row: ConsolidadoRecord) => (row.purchase_id || row.id) as string | undefined,
    []
  );
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [favoriteBrands, setFavoriteBrands] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('favoriteBrands_management');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(3500);
  const loadChangeIndicatorsRef = useRef<((recordIds?: string[]) => Promise<void>) | null>(null);
  const pendingChangeRef = useRef<{
    recordId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  // Management: listado completo de proveedores de subasta (incluye tipo DIRECTO; sin ocultar como en otros módulos)
  const supplierOptions = useMemo(
    () => [...AUCTION_SUPPLIERS].sort((a, b) => a.localeCompare(b, 'es')).map((s) => ({ value: s, label: s })),
    []
  );
  const loadBrandsAndModels = useCallback(async () => {
    try {
      const modelsData = await apiGet<Array<{ name: string }>>('/api/brands-and-models/models').catch(() => []);
      setDynamicModels(modelsData.map((m) => m.name));
    } catch {
      setDynamicModels(MODEL_OPTIONS as unknown as string[]);
    }
  }, []);

  useEffect(() => {
    loadBrandsAndModels();
  }, [loadBrandsAndModels, isBrandModelManagerOpen]);

  const hasTopLayerOpen = useMemo(
    () =>
      isEditModalOpen ||
      isViewModalOpen ||
      isHistoryOpen ||
      isBrandModelManagerOpen ||
      isAutoCostManagerOpen ||
      showChangeModal ||
      changeModalOpen ||
      photosModalOpen ||
      Boolean(specsPopoverOpen) ||
      Boolean(serviceCommentsPopover) ||
      Boolean(commercialCommentsPopover) ||
      Boolean(paymentPopoverOpen) ||
      Boolean(serviceValuePopover),
    [
      isEditModalOpen,
      isViewModalOpen,
      isHistoryOpen,
      isBrandModelManagerOpen,
      isAutoCostManagerOpen,
      showChangeModal,
      changeModalOpen,
      photosModalOpen,
      specsPopoverOpen,
      serviceCommentsPopover,
      commercialCommentsPopover,
      paymentPopoverOpen,
      serviceValuePopover,
    ]
  );

  // Si se abre un modal/popover de capa superior, cerrar cualquier editor inline activo
  // para evitar superposición visual sobre formularios principales.
  useEffect(() => {

    if (!hasTopLayerOpen) return;
    globalThis.dispatchEvent(new Event('inline-field-editor-force-close'));
  }, [hasTopLayerOpen]);

  // Todos los modelos combinados
  const allModels = useMemo(() => {
    const combined = [...MODEL_OPTIONS, ...dynamicModels];
    return Array.from(new Set(combined)).sort((a, b) => a.localeCompare(b));
  }, [dynamicModels]);
  
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
    changedByName?: string | null;
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
  // ELIMINADO: Ya no se aplican auto-costs automáticamente
  // El usuario debe hacer clic en el botón de "Aplicar gastos automáticos" para activarlos
  // Esto evita saturar la base de datos con múltiples consultas al cargar la página

  // Cache básico en memoria para evitar recargas innecesarias
  const consolidadoCacheRef = useRef<{
    data: Array<Record<string, unknown>>;
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 30000; // 30 segundos de caché

  const loadConsolidado = async (forceRefresh = false) => {
    // Verificar caché si no se fuerza refresh
    if (!forceRefresh && consolidadoCacheRef.current) {
      const cacheAge = Date.now() - consolidadoCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        setConsolidado(consolidadoCacheRef.current.data);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const data = await apiGet<Array<Record<string, unknown>>>('/api/management');
      
      // Actualizar caché
      consolidadoCacheRef.current = {
        data,
        timestamp: Date.now(),
      };
      
      setConsolidado(data);
    } catch {
      showError('Error al cargar el consolidado');
      // Si hay error pero tenemos caché, usar datos en caché
      if (consolidadoCacheRef.current) {
        setConsolidado(consolidadoCacheRef.current.data);
      }
    } finally {
      setLoading(false);
    }
  };

  /** Igualdad estable para filtros de columna (espacios / tipos numéricos vs select string). */
  const columnFilterEquals = useCallback((raw: unknown, selected: string): boolean =>
    String(raw ?? '').trim() === String(selected ?? '').trim(), []);

  // Función helper para aplicar todos los filtros activos (excepto el campo que estamos calculando)
  const applyFilters = useCallback((data: ConsolidadoRecord[], excludeField?: string) => {
    const passesSupplier = (item: ConsolidadoRecord) =>
      !supplierFilter || columnFilterEquals(item.supplier, supplierFilter);
    const passesBrand = (item: ConsolidadoRecord) =>
      !brandFilter || columnFilterEquals(item.brand, brandFilter);
    const passesMachineType = (item: ConsolidadoRecord) =>
      !machineTypeFilter || machineTypeMatchesFilter(item.machine_type, machineTypeFilter);
    const passesModel = (item: ConsolidadoRecord) => {
      if (modelFilter.length === 0) return true;
      const normalizedModel = item.model ? String(item.model).trim() : '';
      return !!normalizedModel && modelFilter.includes(normalizedModel);
    };
    const passesSerial = (item: ConsolidadoRecord) =>
      !serialFilter || columnFilterEquals(getMachineSerialForDisplay(item.serial), serialFilter);
    const passesYear = (item: ConsolidadoRecord) =>
      !yearFilter || columnFilterEquals(item.year, yearFilter);
    const passesHours = (item: ConsolidadoRecord) =>
      !hoursFilter || columnFilterEquals(item.hours, hoursFilter);

    return data.filter((item) => {
      if (excludeField !== 'supplier' && !passesSupplier(item)) return false;
      if (excludeField !== 'brand' && !passesBrand(item)) return false;
      if (excludeField !== 'machine_type' && !passesMachineType(item)) return false;
      if (excludeField !== 'model' && !passesModel(item)) return false;
      if (excludeField !== 'serial' && !passesSerial(item)) return false;
      if (excludeField !== 'year' && !passesYear(item)) return false;
      if (excludeField !== 'hours' && !passesHours(item)) return false;
      return true;
    });
  }, [
    supplierFilter,
    brandFilter,
    machineTypeFilter,
    modelFilter,
    serialFilter,
    yearFilter,
    hoursFilter,
    columnFilterEquals,
  ]);

  // Base de datos filtrada por condición USADO (para usar en todos los filtros)
  const baseData = useMemo(() => {
    return consolidado.filter((item) => {
      const condition = item.condition || 'USADO';
      return condition === 'USADO';
    });
  }, [consolidado]);

  // uniqueSuppliers debe filtrarse por todos los demás filtros activos
  const uniqueSuppliers = useMemo(() => {
    const filteredData = applyFilters(baseData, 'supplier');
    const suppliers = filteredData
      .map(item => item.supplier)
      .filter(Boolean)
      .map(s => String(s).trim())
      .filter(s => s !== '' && s !== '-');
    return [...new Set(suppliers)].sort((a, b) => a.localeCompare(b));
  }, [baseData, applyFilters]);

  // Tipos presentes en los datos según los demás filtros (cascada bidireccional con proveedor, marca, etc.).
  const uniqueMachineTypes = useMemo(() => {
    const filteredData = applyFilters(baseData, 'machine_type');
    const distinct = [
      ...new Set(
        filteredData
          .map((item) => item.machine_type)
          .filter(Boolean)
          .map((t) => String(t).trim())
          .filter((t) => t !== '' && t !== '-')
      ),
    ];
    const focusedValues = MACHINE_TYPE_OPTIONS_FOCUSED_UI.map((o) => o.value);
    const orderedFocused = focusedValues.filter((fv) =>
      distinct.some((d) => machineTypeMatchesFilter(d, fv))
    );
    const extras = distinct
      .filter((d) => !focusedValues.some((fv) => machineTypeMatchesFilter(d, fv)))
      .sort((a, b) => a.localeCompare(b));
    return [...orderedFocused, ...extras];
  }, [baseData, applyFilters]);

  // uniqueBrands debe filtrarse por todos los demás filtros activos
  const uniqueBrands = useMemo(() => {
    const filteredData = applyFilters(baseData, 'brand');
    const brands = filteredData
      .map(item => item.brand)
      .filter(Boolean)
      .map(b => String(b).trim())
      .filter(b => b !== '' && b !== '-');
    return [...new Set(brands)].sort((a, b) => a.localeCompare(b));
  }, [baseData, applyFilters]);

  // uniqueModels debe filtrarse por todos los demás filtros activos
  const uniqueModels = useMemo(() => {
    const filteredData = applyFilters(baseData, 'model');
    const models = filteredData
      .map(item => item.model)
      .filter(Boolean)
      .map(m => String(m).trim())
      .filter(m => m !== '' && m !== '-');
    return [...new Set(models)].sort((a, b) => a.localeCompare(b));
  }, [baseData, applyFilters]);

  // Limpiar modelos seleccionados que ya no estén disponibles según filtros activos
  useEffect(() => {
    if (modelFilter.length === 0) return;
    const availableModels = new Set(uniqueModels);
    const validModels = modelFilter.filter((m) => availableModels.has(m));
    if (validModels.length !== modelFilter.length) {
      setModelFilter(validModels);
    }
  }, [modelFilter, uniqueModels]);

  // uniqueSerials debe filtrarse por todos los demás filtros activos
  const uniqueSerials = useMemo(() => {
    const filteredData = applyFilters(baseData, 'serial');
    const serials = filteredData
      .map((item) => getMachineSerialForDisplay(item.serial))
      .filter(Boolean)
      .map((s) => String(s).trim())
      .filter((s) => s !== '' && s !== '-');
    return [...new Set(serials)].sort((a, b) => a.localeCompare(b));
  }, [baseData, applyFilters]);

  // uniqueYears debe filtrarse por todos los demás filtros activos
  const uniqueYears = useMemo(() => {
    const filteredData = applyFilters(baseData, 'year');
    const years = filteredData
      .map(item => item.year)
      .filter(Boolean);
    return [...new Set(years)].sort((a, b) => Number(b) - Number(a));
  }, [baseData, applyFilters]);

  // uniqueHours debe filtrarse por todos los demás filtros activos
  const uniqueHours = useMemo(() => {
    const filteredData = applyFilters(baseData, 'hours');
    const hours = filteredData
      .map(item => item.hours)
      .filter(Boolean);
    return [...new Set(hours)].sort((a, b) => Number(a) - Number(b));
  }, [baseData, applyFilters]);

  useEffect(() => {
    if (!supplierFilter) return;
    const ok = uniqueSuppliers.some((s) => columnFilterEquals(s, supplierFilter));
    if (!ok) setSupplierFilter('');
  }, [supplierFilter, uniqueSuppliers, columnFilterEquals]);

  useEffect(() => {
    if (!machineTypeFilter) return;
    const ok = uniqueMachineTypes.some((t) => machineTypeMatchesFilter(t, machineTypeFilter));
    if (!ok) setMachineTypeFilter('');
  }, [machineTypeFilter, uniqueMachineTypes]);

  useEffect(() => {
    if (!brandFilter) return;
    const ok = uniqueBrands.some((b) => columnFilterEquals(b, brandFilter));
    if (!ok) setBrandFilter('');
  }, [brandFilter, uniqueBrands, columnFilterEquals]);

  useEffect(() => {
    if (!serialFilter) return;
    const ok = uniqueSerials.some((s) => columnFilterEquals(s, serialFilter));
    if (!ok) setSerialFilter('');
  }, [serialFilter, uniqueSerials, columnFilterEquals]);

  useEffect(() => {
    if (!yearFilter) return;
    const ok = uniqueYears.some((y) => columnFilterEquals(y, yearFilter));
    if (!ok) setYearFilter('');
  }, [yearFilter, uniqueYears, columnFilterEquals]);

  useEffect(() => {
    if (!hoursFilter) return;
    const ok = uniqueHours.some((h) => columnFilterEquals(h, hoursFilter));
    if (!ok) setHoursFilter('');
  }, [hoursFilter, uniqueHours, columnFilterEquals]);

  // OPTIMIZACIÓN CRÍTICA: Memoizar filteredData reutilizando applyFilters y filtrando por búsqueda
  const filteredData = useMemo(() => {
    const withColumnFilters = applyFilters(baseData);
    if (!searchTerm.trim()) return withColumnFilters;
    const search = searchTerm.toLowerCase();
    return withColumnFilters.filter((item) => {
      const modelMatch = item.model?.toLowerCase().includes(search);
      const serialMatch = getMachineSerialForDisplay(item.serial || '').toLowerCase().includes(search);
      return modelMatch || serialMatch;
    });
  }, [baseData, applyFilters, searchTerm]);

  // Etiqueta para la opción vacía en Tipo / Marca / Modelo (permite limpiar y elegir cualquier combinación)
  const EMPTY_SELECT_LABEL = '— Seleccione —';
  const favoriteBrandsSet = useMemo(
    () => new Set(favoriteBrands.map((b) => String(b).trim()).filter((b) => b !== '')),
    [favoriteBrands]
  );

  // Opciones indexadas por fila para Tipo / Marca / Modelo (cascada; opción vacía primero para nuevos registros)
  const getMachineTypeOptionsForRow = useCallback((r: ConsolidadoRecord) => {
    const base = MACHINE_TYPE_OPTIONS_FOCUSED_UI.map((o) => o.value);
    const current = r.machine_type ? String(r.machine_type).trim() : '';
    const list = current && !base.includes(current) ? [current, ...base] : base;
    const options = list.map((t) => ({ value: t, label: formatMachineType(t) || t }));
    return [{ value: '', label: EMPTY_SELECT_LABEL }, ...options];
  }, []);

  const getBrandOptionsForRow = useCallback((r: ConsolidadoRecord) => {
    const fromIndex = getBrandsFromIndex(r.machine_type, r.model);
    const filteredByFavorites = favoriteBrandsSet.size > 0
      ? fromIndex.filter((b) => favoriteBrandsSet.has(String(b).trim()))
      : fromIndex;
    const current = r.brand ? String(r.brand).trim() : '';
    const list = current && !filteredByFavorites.includes(current)
      ? [current, ...filteredByFavorites]
      : filteredByFavorites;
    const options = list.map((b) => ({ value: b, label: b || '(Sin marca)' }));
    return [{ value: '', label: EMPTY_SELECT_LABEL }, ...options];
  }, [favoriteBrandsSet]);

  const getModelOptionsForRow = useCallback((r: ConsolidadoRecord) => {
    const fromIndex = getModelsFromIndex(r.machine_type, r.brand);
    const current = r.model ? String(r.model).trim() : '';
    const list = current && !fromIndex.includes(current) ? [current, ...fromIndex] : fromIndex;
    const options = list.map((m) => ({ value: m, label: m }));
    return [{ value: '', label: EMPTY_SELECT_LABEL }, ...options];
  }, []);

  const tonnageRangeByModel = useMemo(() => {
    const map = new Map<string, string>();
    TONNAGE_RANGES.forEach((range) => {
      range.models.forEach((model) => {
        const key = String(model || '').trim().toUpperCase();
        if (key) map.set(key, range.range);
      });
    });
    return map;
  }, []);

  const resolveShipmentContextForRow = useCallback(
    (r: ConsolidadoRecord) => {
      if (r.tonelage) return r.tonelage;
      if (r.tonnage_label) return r.tonnage_label;
      const normalizedModel = String(r.model || '').trim().toUpperCase();
      if (!normalizedModel) return null;
      return tonnageRangeByModel.get(normalizedModel) ?? null;
    },
    [tonnageRangeByModel]
  );

  const getShipmentPolicyForRow = useCallback(
    (r: ConsolidadoRecord) => getShipmentPolicyByTonnage(resolveShipmentContextForRow(r)),
    [resolveShipmentContextForRow]
  );

  const getShipmentOptionsForRow = useCallback(
    (r: ConsolidadoRecord) => {
      const policy = getShipmentPolicyForRow(r);
      return policy.options.map((option) => ({ value: option, label: option }));
    },
    [getShipmentPolicyForRow]
  );

  const getEffectiveShipmentForRow = useCallback(
    (r: ConsolidadoRecord) => {
      const policy = getShipmentPolicyForRow(r);
      const currentShipment = normalizeShipmentMethod(r.shipment || r.shipment_type_v2 || '');
      return currentShipment && policy.options.includes(currentShipment)
        ? currentShipment
        : policy.defaultMethod;
    },
    [getShipmentPolicyForRow]
  );

  // Verificar si hay filtros activos
  const hasActiveFilters = useMemo(() => {
    return !!(
      searchTerm ||
      supplierFilter ||
      brandFilter ||
      machineTypeFilter ||
      modelFilter.length > 0 ||
      serialFilter ||
      yearFilter ||
      hoursFilter
    );
  }, [searchTerm, supplierFilter, brandFilter, machineTypeFilter, modelFilter, serialFilter, yearFilter, hoursFilter]);

  // Función para limpiar todos los filtros
  const clearAllFilters = () => {
    setSearchTerm('');
    setSupplierFilter('');
    setBrandFilter('');
    setMachineTypeFilter('');
    setModelFilter([]);
    setSerialFilter('');
    setYearFilter('');
    setHoursFilter('');
  };

  /** Tipo para valores que pueden convertirse a número */
  type NumericInput = number | string | null | undefined;

  // Función helper para convertir valores a número (useCallback para estabilidad en dependencias)
  const toNumber = useCallback((value: NumericInput): number => {
    if (value === null || value === undefined || value === '') return 0;
    const num = typeof value === 'string' ? Number.parseFloat(value) : value;
    return Number.isNaN(num) ? 0 : num;
  }, []);

  // Convierte year/hours para sugerencias históricas, soportando formatos locales (3.187 / 3,187).
  const toSuggestionNumericValue = useCallback((value: unknown): number | null => (
    parseSuggestionNumericValue(value)
  ), []);

  const getSuggestionYearValue = useCallback(
    (value: unknown): number | null => {
      const parsed = toSuggestionNumericValue(value);
      if (parsed === null) return null;
      if (parsed === 9999 || parsed <= 1900 || parsed >= 2100) return null;
      return Math.trunc(parsed);
    },
    [toSuggestionNumericValue]
  );

  const getSuggestionHoursValue = useCallback(
    (value: unknown): number | null => {
      const parsed = toSuggestionNumericValue(value);
      if (parsed === null || parsed <= 0) return null;
      return parsed;
    },
    [toSuggestionNumericValue]
  );

  const fetchPaymentDetails = async (purchaseId: string) => {
    if (!purchaseId) return null;
    if (paymentDetails[purchaseId]) return paymentDetails[purchaseId];
    try {
      setPaymentLoading(true);
      const data = await apiGet<PaymentDetails>(`/api/pagos/${purchaseId}`);
      setPaymentDetails(prev => ({ ...prev, [purchaseId]: data }));
      return data;
    } catch {
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
    } catch {
      setAllPhotos([]);
      return false;
    }
  };

  const handleViewPhotos = async (row: ConsolidadoRecord) => {
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

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [photosModalOpen, allPhotos.length]);

  const handleEdit = (row: ConsolidadoRecord) => {
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
        } catch {
          // Error silencioso al registrar cambios en historial
        }
      }

      // Actualizar estado local sin recargar toda la tabla
      if (id && data) {
        updateConsolidadoLocal(id, data);
      }
      
      setIsEditModalOpen(false);
      setShowChangeModal(false);
      setCurrentRow(null);
      setEditData({});
      setPendingUpdate(null);
      showSuccess('Registro actualizado correctamente');
    } catch {
      showError('Error al actualizar el registro');
    }
  };

  // Ver registro (modal de vista)
  const handleView = (row: ConsolidadoRecord) => {
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
      // Generar serial aleatorio de 3 dígitos (Web Crypto API)
      const arr = new Uint8Array(2);
      crypto.getRandomValues(arr);
      const randomSerial = 100 + ((arr[0] * 256 + arr[1]) % 900);
      await apiPost('/api/purchases/direct', {
        supplier_name: 'Nuevo Proveedor',
        brand: 'HITACHI',
        model: 'ZX',
        serial: `SN-${randomSerial}`,
        year: 9999,
        machine_type: 'Excavadora',
        condition: 'USADO',
        incoterm: 'FOB',
        currency_type: 'USD',
      });
      await loadConsolidado(true); // Forzar refresh después de crear
      showSuccess('Nuevo registro creado. Edite los campos directamente en la tabla.');
    } catch {
      showError('Error al crear el registro');
    } finally {
      setCreatingNewRow(false);
    }
  };

  // Calcular ancho real de la tabla y sincronizar scrolls
  useEffect(() => {
    const table = tableRef.current;
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;

    if (!table || !topScroll || !tableScroll) return;

    let resizeRaf: number | null = null;
    let isSyncingFromTop = false;
    let isSyncingFromTable = false;
    let isDraggingTopScroll = false;

    const syncTopWithTable = () => {
      const nextLeft = tableScroll.scrollLeft;
      if (topScroll.scrollLeft !== nextLeft) {
        topScroll.scrollLeft = nextLeft;
      }
    };

    // Función para actualizar el ancho del scroll superior basado en el ancho real de la tabla
    const updateTableWidth = () => {
      // Usar scrollWidth para obtener el ancho real de la tabla (incluyendo columnas ocultas)
      const actualWidth = Math.max(table.scrollWidth || 0, table.offsetWidth || 0, 3500);
      setTableWidth((prev) => (prev === actualWidth ? prev : actualWidth));
      if (!isDraggingTopScroll) {
        syncTopWithTable();
      }
    };

    const scheduleWidthUpdate = () => {
      if (resizeRaf !== null) {
        cancelAnimationFrame(resizeRaf);
      }
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        updateTableWidth();
      });
    };

    const handleTopScroll = () => {
      if (isSyncingFromTable) {
        isSyncingFromTable = false;
        return;
      }
      const nextLeft = topScroll.scrollLeft;
      if (tableScroll.scrollLeft === nextLeft) return;
      isSyncingFromTop = true;
      tableScroll.scrollLeft = nextLeft;
    };

    const handleTableScroll = () => {
      if (isSyncingFromTop) {
        isSyncingFromTop = false;
        return;
      }
      if (isDraggingTopScroll) return;
      const nextLeft = tableScroll.scrollLeft;
      if (topScroll.scrollLeft === nextLeft) return;
      isSyncingFromTable = true;
      topScroll.scrollLeft = nextLeft;
    };

    const handleWindowResize = () => {
      scheduleWidthUpdate();
    };

    const handleTopPointerDown = () => {
      isDraggingTopScroll = true;
    };

    const handleTopPointerRelease = () => {
      isDraggingTopScroll = false;
    };

    // Actualizar ancho inicial
    updateTableWidth();
    syncTopWithTable();

    // Actualizar cuando cambie el tamaño de la ventana o cuando se carguen los datos
    const resizeObserver = new ResizeObserver(() => {
      scheduleWidthUpdate();
    });
    resizeObserver.observe(table);

    window.addEventListener('resize', handleWindowResize, { passive: true });
    topScroll.addEventListener('scroll', handleTopScroll, { passive: true });
    tableScroll.addEventListener('scroll', handleTableScroll, { passive: true });
    topScroll.addEventListener('pointerdown', handleTopPointerDown, { passive: true });
    globalThis.addEventListener('pointerup', handleTopPointerRelease, true);
    globalThis.addEventListener('pointercancel', handleTopPointerRelease, true);
    globalThis.addEventListener('blur', handleTopPointerRelease);

    return () => {
      resizeObserver.disconnect();
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      window.removeEventListener('resize', handleWindowResize);
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableScroll.removeEventListener('scroll', handleTableScroll);
      topScroll.removeEventListener('pointerdown', handleTopPointerDown);
      globalThis.removeEventListener('pointerup', handleTopPointerRelease, true);
      globalThis.removeEventListener('pointercancel', handleTopPointerRelease, true);
      globalThis.removeEventListener('blur', handleTopPointerRelease);
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

  type CurrencyValue = number | null | undefined | string;

  const formatCurrency = (value: CurrencyValue) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? Number.parseFloat(value) : value;
    if (Number.isNaN(numValue)) return '-';
    const fixedValue = Number.parseFloat(numValue.toFixed(2));
    return `$${fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyNoDecimals = (value: CurrencyValue) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? Number.parseFloat(value) : value;
    if (Number.isNaN(numValue)) return '-';
    const fixedValue = Math.round(numValue);
    return `$${fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatCurrencyWithSymbol = (
    currency: string | null | undefined,
    value: CurrencyValue
  ): string => {
    if (value === null || value === undefined || value === '') return '-';
    const rawNum = typeof value === 'string' ? Number.parseFloat(value) : value;
    const numValue = typeof rawNum === 'number' ? rawNum : 0;
    if (Number.isNaN(numValue)) return '-';
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyWithSymbolNoDecimals = (
    currency: string | null | undefined,
    value: CurrencyValue
  ): string => {
    if (value === null || value === undefined || value === '') return '-';
    const rawNum = typeof value === 'string' ? Number.parseFloat(value) : value;
    const numValue = typeof rawNum === 'number' ? rawNum : 0;
    if (Number.isNaN(numValue)) return '-';
    const symbol = getCurrencySymbol(currency);
    const fixedValue = Math.round(numValue);
    return `${symbol}${fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  
  const formatNumber = (value: CurrencyValue) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? Number.parseFloat(value) : value;
    if (Number.isNaN(numValue)) return '-';
    const fixedValue = Number.parseFloat(numValue.toFixed(2));
    return fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatShortCurrency = (value: CurrencyValue, currency: string = 'COP') => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? Number.parseFloat(String(value)) : Number(value);
    if (Number.isNaN(numValue) || !Number.isFinite(numValue)) return '-';
    const formatted = numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const symbolMap: Record<string, string> = { COP: '$', USD: 'US$', JPY: '¥', EUR: '€' };
    const symbol = symbolMap[currency] ?? '';
    return symbol ? `${symbol} ${formatted}` : formatted;
  };

  // Render de filas de la tabla Pagos en el popover (reduce anidación)
  const renderPaymentPagosRows = (recordId: string): React.ReactNode[] => {
    const data = paymentDetails[recordId];
    if (!data) return [];
    let sumaValorGirado = 0;
    let sumaCopPagos = 0;
    const rows: React.ReactNode[] = [1, 2, 3].map((n) => {
      const prefix = `pago${n}_`;
      const moneda = data[`${prefix}moneda`] || '-';
      const contravalor = data[`${prefix}contravalor`];
      const trm = data[`${prefix}trm`];
      const valorGirado = data[`${prefix}valor_girado`];
      const cop = trm && valorGirado ? trm * valorGirado : null;
      const fechaPago = data[`${prefix}fecha`] || data.payment_date || null;
      if (valorGirado) sumaValorGirado += valorGirado;
      if (cop) sumaCopPagos += cop;
      const cur = moneda === '-' ? 'USD' : moneda;
      return (
        <tr key={n} className="border-b border-gray-200 hover:bg-gray-50">
          <td className="px-2 py-1.5 font-semibold text-gray-800 border-r border-gray-200">Pago {n}</td>
          <td className="px-2 py-1.5 text-center text-gray-700 border-r border-gray-200">{moneda}</td>
          <td className="px-2 py-1.5 text-center text-gray-700 border-r border-gray-200">
            {fechaPago ? new Date(fechaPago).toLocaleDateString('es-CO') : '-'}
          </td>
          <td className="px-2 py-1.5 text-right text-gray-700 border-r border-gray-200">
            {contravalor ? formatShortCurrency(contravalor, cur) : '-'}
          </td>
          <td className="px-2 py-1.5 text-right text-gray-700 border-r border-gray-200">
            {trm ? formatShortCurrency(trm, 'COP') : '-'}
          </td>
          <td className="px-2 py-1.5 text-right text-gray-700 border-r border-gray-200">
            {valorGirado ? formatShortCurrency(valorGirado, 'COP') : '-'}
          </td>
          <td className="px-2 py-1.5 text-right font-semibold text-gray-900">
            {cop ? formatShortCurrency(cop, 'COP') : '-'}
          </td>
        </tr>
      );
    });
    rows.push(
      <tr key="total" className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
        <td className="px-2 py-1.5 text-gray-800 border-r border-gray-200" colSpan={5}>TOTAL</td>
        <td className="px-2 py-1.5 text-right text-gray-900 border-r border-gray-200">
          {sumaValorGirado > 0 ? formatShortCurrency(sumaValorGirado, 'COP') : '-'}
        </td>
        <td className="px-2 py-1.5 text-right text-gray-900">
          {sumaCopPagos > 0 ? formatShortCurrency(sumaCopPagos, 'COP') : '-'}
        </td>
      </tr>
    );
    return rows;
  };

  // Render de filas de la tabla OCEAN en el popover (reduce anidación)
  const renderPaymentOceanRows = (recordId: string): React.ReactNode => {
    const data = paymentDetails[recordId];
    if (!data) return null;
    const oceanCop = data.ocean_pagos != null && data.trm_ocean != null
      ? data.ocean_pagos * data.trm_ocean
      : null;
    let sumaCopPagos = 0;
    for (let n = 1; n <= 3; n++) {
      const prefix = `pago${n}_`;
      const trm = data[`${prefix}trm`];
      const valorGirado = data[`${prefix}valor_girado`];
      if (trm && valorGirado) sumaCopPagos += trm * valorGirado;
    }
    const sumaTotalCop = sumaCopPagos + (oceanCop || 0);
    return (
      <>
        <tr className="border-b border-gray-200 hover:bg-gray-50">
          <td className="px-2 py-1.5 font-semibold text-gray-800 border-r border-gray-200">OCEAN</td>
          <td className="px-2 py-1.5 text-right text-gray-700 border-r border-gray-200">
            {data.trm_ocean == null ? '-' : formatShortCurrency(data.trm_ocean, 'COP')}
          </td>
          <td className="px-2 py-1.5 text-right text-gray-700 border-r border-gray-200">
            {data.ocean_pagos == null ? '-' : formatShortCurrency(data.ocean_pagos, 'USD')}
          </td>
          <td className="px-2 py-1.5 text-right font-semibold text-gray-900">
            {oceanCop == null ? '-' : formatShortCurrency(oceanCop, 'COP')}
          </td>
        </tr>
        <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
          <td className="px-2 py-1.5 text-gray-800 border-r border-gray-200" colSpan={3}>TOTAL COP</td>
          <td className="px-2 py-1.5 text-right text-gray-900">
            {sumaTotalCop > 0 ? formatShortCurrency(sumaTotalCop, 'COP') : '-'}
          </td>
        </tr>
      </>
    );
  };

  // Helper para convertir string formateado a número
  const parseFormattedNumber = (value: string): number | null => {
    if (!value || value === '') return null;
    // Remover $ y espacios
    let cleaned = value.replaceAll(/[$\s]/g, '');
    // Si hay coma, es formato colombiano (punto para miles, coma para decimales)
    if (cleaned.includes(',')) {
      // Remover puntos (separadores de miles)
      cleaned = cleaned.replaceAll('.', '');
      // Reemplazar coma por punto para parseFloat
      cleaned = cleaned.replaceAll(',', '.');
    }
    const numValue = Number.parseFloat(cleaned);
    return Number.isNaN(numValue) ? null : numValue;
  };

  // Helper para formatear números para input (con $ y puntos de miles)
  const formatNumberForInput = (value: CurrencyValue): string => {
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
    if (Number.isNaN(numValue)) return '';
    return `$${numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  /**
   * FOB ORIGEN para cálculos:
   * 1) `precio_fob` (columna FOB ORIGEN en Management).
   * 2) Fallback defensivo: `exw_value_formatted` + `fob_expenses` + `disassembly_load_value`.
   */
  const getFobOrigenForCalculations = useCallback((row: ConsolidadoRecord): number => {
    const fobOrigenFromColumn = toNumber(row.precio_fob);
    if (fobOrigenFromColumn > 0) return fobOrigenFromColumn;
    const valorBp = toNumber(row.exw_value_formatted);
    const gastosLavado = toNumber(row.fob_expenses);
    const desensamblajeCargue = toNumber(row.disassembly_load_value);
    return valorBp + gastosLavado + desensamblajeCargue;
  }, [toNumber]);

  /**
   * FOB (USD) según CRCY (`currency` / `currency_type`, misma fuente que la columna CRCY).
   * FOB ORIGEN base: `precio_fob` (sumatoria de VALOR + BP + GASTOS + LAVADO + DESENSAMBLAJE + CARGUE).
   * CONTRAVALOR: `usd_jpy_rate`.
   */
  const computeFobUsd = useCallback((row: ConsolidadoRecord): number | null => {
    const fobOrigen = getFobOrigenForCalculations(row);
    if (!fobOrigen || fobOrigen === 0) return null;

    const crcy = (row.currency || row.currency_type || '').trim().toUpperCase();

    if (crcy === 'USD') {
      return fobOrigen;
    }

    const contravalor = toNumber(row.usd_jpy_rate);
    if (!contravalor || contravalor === 0) return null;

    if (crcy === 'EUR' || crcy === 'GBP') {
      return fobOrigen * contravalor;
    }

    // JPY y otras monedas (no USD / EUR / GBP): FOB (USD) = FOB ORIGEN / CONTRAVALOR
    return fobOrigen / contravalor;
  }, [getFobOrigenForCalculations, toNumber]);

  const computeCifUsd = useCallback((row: ConsolidadoRecord): number | null => {
    const fobUsd = computeFobUsd(row);
    const oceanUsd = toNumber(row.inland);
    if (fobUsd === null) return null;
    // CIF USD = FOB USD + OCEAN (USD)
    // Asegurar que ambos valores sean números para evitar concatenación de strings
    const fobUsdNum = typeof fobUsd === 'number' ? fobUsd : toNumber(fobUsd);
    const oceanUsdNum = typeof oceanUsd === 'number' ? oceanUsd : toNumber(oceanUsd);
    return fobUsdNum + oceanUsdNum;
  }, [computeFobUsd, toNumber]);

  const computeCifLocal = useCallback((row: ConsolidadoRecord, paymentDetailsRow?: PaymentDetails): number | null => {
    const fobUsd = computeFobUsd(row);
    const cifUsd = computeCifUsd(row);
    const trm = toNumber(row.trm_rate);
    const oceanUsd = toNumber(row.inland);
    
    if (cifUsd === null || !trm) return null;
    
    // Si hay TRM OCEAN (COP) en paymentDetails, usar lógica especial
    const trmOcean = paymentDetailsRow?.trm_ocean;
    if (trmOcean && trmOcean > 0 && fobUsd !== null && oceanUsd > 0) {
      // CIF Local (COP) = (TRM (COP) * FOB (USD)) + (OCEAN (USD) * TRM OCEAN (COP))
      return (trm * fobUsd) + (oceanUsd * trmOcean);
    }
    
    // Si no hay TRM OCEAN, usar lógica simple: TRM (COP) * CIF (USD)
    return trm * cifUsd;
  }, [computeFobUsd, computeCifUsd, toNumber]);

  /** Construye string de Comentarios para exportación (comentarios_servicio + comentarios_comercial de la tabla) */
  const buildComentariosExport = useCallback((row: ConsolidadoRecord): string => {
    const parts: string[] = [];
    if (row.comentarios_servicio) parts.push(`Servicio: ${String(row.comentarios_servicio).trim()}`);
    if (row.comentarios_comercial) parts.push(`Comercial: ${String(row.comentarios_comercial).trim()}`);
    const combined = parts.join(' | ');
    return combined || (row.comentarios ? String(row.comentarios).trim() : '') || '';
  }, []);

  /** Construye string de Spec para exportación (igual que columna Spec en tabla) */
  const buildSpecExport = useCallback((row: ConsolidadoRecord): string => {
    const parts: string[] = [];
    const shoe = row.shoe_width_mm ?? row.track_width;
    if (shoe != null) parts.push(`Zapatas: ${shoe}mm`);
    const cabin = row.spec_cabin || row.cabin_type;
    if (cabin) parts.push(`Cabina: ${cabin}`);
    if (row.arm_type) parts.push(`Brazo: ${row.arm_type}`);
    let blade: string | null = null;
    if (row.spec_blade === true || row.blade === 'SI') blade = 'SI';
    else if (row.spec_blade === false || row.blade === 'No') blade = 'No';
    if (blade) parts.push(`Blade: ${blade}`);
    return parts.join(' | ') || '';
  }, []);

  // Función para exportar a Excel: columnas = tabla frontend, datos = TODOS (baseData)
  const handleExportToExcel = useCallback(() => {
    try {
      if (!baseData || baseData.length === 0) {
        showError('No hay datos para exportar');
        return;
      }

      const exportData = baseData.map((row) => {
        const incoterm = row.tipo_incoterm || row.incoterm;
        const exwVal = row.exw_value_formatted;
        let exwNum: number | null = null;
        if (typeof exwVal === 'number') exwNum = exwVal;
        else if (typeof exwVal === 'string') {
          const cleaned = String(exwVal).replaceAll(/[^\d.,-]/g, '').replaceAll('.', '').replaceAll(',', '.');
          exwNum = Number.parseFloat(cleaned);
        }
        const fobExpNum = toNumber(row.fob_expenses);
        const disassemblyNum = toNumber(row.disassembly_load_value);
        const isExwIncoterm = incoterm !== 'FOB' && incoterm !== 'CIF';
        let valorBp = 0;
        if (isExwIncoterm) {
          valorBp = Number.isNaN(exwNum as number) ? 0 : (exwNum ?? 0);
        }
        const cifLocalVal = row.cif_local ?? computeCifLocal(row, paymentDetails[row.id as string]);
        const tipoMaquina = formatMachineType(row.machine_type) || row.machine_type || '';

        const basePairs: [string, string | number][] = [
          ['PROVEEDOR', row.supplier || ''],
          ['TIPO MÁQUINA', tipoMaquina],
          ['MARCA', row.brand || ''],
          ['MODELO', row.model || ''],
          ['SERIAL', getMachineSerialForDisplay(row.serial || '')],
          ['AÑO', row.year ?? ''],
          ['HORAS', row.hours ?? ''],
          ['Tipo Compra', formatTipoCompra(row.tipo_compra)],
          ['Spec', buildSpecExport(row)],
          ['INCOTERM DE COMPRA', row.tipo_incoterm || ''],
          ['CRCY', row.currency || row.currency_type || ''],
          ['MÉTODO EMBARQUE', row.shipment || row.shipment_type_v2 || ''],
          ['CONTRAVALOR', toNumber(row.usd_jpy_rate) || 0],
          ['TRM (COP)', toNumber(row.trm_rate) || 0],
          ['VALOR + BP', valorBp],
          ['GASTOS + LAVADO', isExwIncoterm ? fobExpNum : 0],
          ['DESENSAMBLAJE + CARGUE', isExwIncoterm ? disassemblyNum : 0],
          ['FOB ORIGEN', toNumber(row.precio_fob) || 0],
          ['FOB (USD)', computeFobUsd(row) ?? 0],
          ['OCEAN (USD)', toNumber(row.inland) || 0],
          ['CIF (USD)', computeCifUsd(row) ?? 0],
          ['CIF Local (COP)', cifLocalVal ?? 0],
          ['Gastos Pto (COP)', toNumber(row.gastos_pto) || 0],
          ['TRASLADOS NACIONALES (COP)', toNumber(row.flete) || 0],
          ...(SHOW_TRASLADO_COLUMN ? [['Traslado (COP)', toNumber(row.traslado) || 0] as [string, string | number]] : []),
          ['PPTO DE REPARACION (COP)', toNumber(row.repuestos) || 0],
          ['PVP Est.', toNumber(row.pvp_est) || 0],
          ['Comentarios', buildComentariosExport(row)],
        ];
        return Object.fromEntries(basePairs);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const colWidths = [
        { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 10 },
        { wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
        { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 35 },
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Consolidado');

      const fecha = new Date().toISOString().split('T')[0];
      const filename = `Consolidado_Management_${fecha}.xlsx`;

      XLSX.writeFile(wb, filename);

      showSuccess(`Archivo Excel descargado: ${filename}`);
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      showError('Error al exportar a Excel. Por favor, intenta nuevamente.');
    }
  }, [baseData, paymentDetails, computeFobUsd, computeCifUsd, computeCifLocal, buildSpecExport, buildComentariosExport, toNumber]);

  // Helper para obtener el valor del input (estado local si existe, sino formateado)
  const getInputValue = (fieldName: string, dataValue: number | null | undefined): string => {
    if (localInputValues[fieldName] !== undefined) {
      return formatNumberForInput(localInputValues[fieldName]);
    }
    return formatNumberForInput(dataValue);
  };

  // Funciones helper para inline editing
  // OPTIMIZACIÓN: Usar useRef para evitar recrear el handler en cada render
  const handleOutsideClickRef = useRef<(event: MouseEvent) => void>();
  
  useEffect(() => {
    // Crear handler una sola vez y reutilizarlo
    handleOutsideClickRef.current = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.change-popover') && !target.closest('.change-indicator-btn')) {
        setOpenChangePopover(null);
      }
      if (!target.closest('.service-value-popover') && !target.closest('.service-value-btn')) {
        setServiceValuePopover(null);
      }
    };
    
    const handler = (e: MouseEvent) => handleOutsideClickRef.current?.(e);
    document.addEventListener('click', handler, true); // Usar capture phase para mejor rendimiento
    return () => document.removeEventListener('click', handler, true);
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

  const formatChangeValue = useCallback((value: string | number | null | undefined, fieldLabel?: string) => {
    if (value === null || value === undefined || value === '') return 'Sin valor';
    const nonMonetaryFields = ['Año', 'Horas', 'Serial'];
    const isNumericValue = typeof value === 'number' || (typeof value === 'string' && !Number.isNaN(Number.parseFloat(value)));
    if (isNumericValue && (!fieldLabel || !nonMonetaryFields.includes(fieldLabel))) {
      const numValue = typeof value === 'number' ? value : Number.parseFloat(value);
      if (!Number.isNaN(numValue)) {
        const fixedValue = Number.parseFloat(numValue.toFixed(2));
        return `$${fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }
    return formatChangeValueFromUtil(value);
  }, []);

  const getModuleLabel = useCallback((moduleName: string | null | undefined): string => {
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
  }, []);

  type LogValue = string | number | null;

  const mapValueForLog = useCallback((value: string | number | boolean | null | undefined): LogValue => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return value;
  }, []);

  // Función pura - no necesita estar dentro del componente
  const getFieldIndicators = useCallback((
    indicators: Record<string, InlineChangeIndicator[]>,
    recordId: string,
    fieldName: string
  ) => { // NOSONAR - manejo unificado de cambios inline con validaciones cruzadas
    return (indicators[recordId] || []).filter((log) => log.fieldName === fieldName);
  }, []);

  // Helper: aplica updates a una fila y recalcula FOB/CIF (extraído para reducir complejidad y anidación)
  const processRowUpdate = useCallback((row: ConsolidadoRecord, updates: Record<string, unknown>): ConsolidadoRecord => { // NOSONAR - cálculo consolidado central; refactor profundo de alto riesgo
    const processedUpdates: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      const value = updates[key];
      if (NUMERIC_FIELDS_CONSOLIDADO.has(key)) {
        if (value !== null && value !== undefined && value !== '') {
          let numValue: number;
          if (typeof value === 'string') numValue = Number.parseFloat(value);
          else if (typeof value === 'number') numValue = value;
          else numValue = Number(value);
          if (!Number.isNaN(numValue) && Number.isFinite(numValue)) {
            processedUpdates[key] = numValue;
            const verifiedKey = VERIFIED_FIELDS_MAP_CONSOLIDADO[key];
            if (verifiedKey) processedUpdates[verifiedKey] = false;
          } else {
            processedUpdates[key] = row[key];
          }
        } else {
          processedUpdates[key] = null;
        }
      } else {
        processedUpdates[key] = value;
      }
    }
    const updatedRow = { ...row };
    for (const key of Object.keys(processedUpdates)) {
      updatedRow[key] = processedUpdates[key];
    }
    if ('currency' in processedUpdates) updatedRow.currency_type = processedUpdates.currency;
    if ('currency_type' in processedUpdates) updatedRow.currency = processedUpdates.currency_type;
    if ('incoterm' in processedUpdates) updatedRow.tipo_incoterm = processedUpdates.incoterm;
    if ('shipment_type_v2' in processedUpdates) updatedRow.shipment = processedUpdates.shipment_type_v2;

    const recalculatedFobUsd = computeFobUsd(updatedRow);
    if (recalculatedFobUsd !== null) {
      updatedRow.fob_usd = recalculatedFobUsd;
      const recalculatedCifUsd = computeCifUsd(updatedRow);
      if (recalculatedCifUsd !== null) updatedRow.cif_usd = recalculatedCifUsd;
      const recalculatedCifLocal = computeCifLocal(updatedRow);
      if (recalculatedCifLocal !== null) updatedRow.cif_local = recalculatedCifLocal;
    }
    if ('inland' in processedUpdates) {
      const recalculatedCifUsd = computeCifUsd(updatedRow);
      if (recalculatedCifUsd !== null) updatedRow.cif_usd = recalculatedCifUsd;
      const recalculatedCifLocal = computeCifLocal(updatedRow);
      if (recalculatedCifLocal !== null) updatedRow.cif_local = recalculatedCifLocal;
    }
    return updatedRow;
  }, [computeFobUsd, computeCifUsd, computeCifLocal]);

  // Función para actualizar el estado local sin refrescar la página
  // OPTIMIZADO: Solo actualiza la fila que cambió, mantiene referencias para las demás
  const updateConsolidadoLocal = useCallback((recordId: string, updates: Record<string, unknown>) => {
    setConsolidado((prev) => {
      let hasChanges = false;
      const newConsolidado = prev.map((row) => {
        if (row.id !== recordId) return row;
        hasChanges = true;
        return processRowUpdate(row, updates);
      });
      return hasChanges ? newConsolidado : prev;
    });
  }, [processRowUpdate]);

  // Helper: en modo batch, recalcula fob_usd/cif_usd/cif_local en el objeto updates (mutación in-place)
  const applyBatchFobCifRecalc = useCallback((
    updates: Record<string, unknown>,
    recordId: string
  ) => { // NOSONAR - aplica reglas automáticas con tolerancia a errores y feedback UX
    const fieldsTriggerFob = new Set(['currency', 'currency_type', 'usd_jpy_rate', 'precio_fob', 'exw_value_formatted', 'fob_expenses', 'disassembly_load_value']);
    const currentRow = consolidado.find((r) => r.id === recordId);
    if (!currentRow) return;
    const tempRow = { ...currentRow, ...updates };
    if ('currency' in updates) tempRow.currency_type = updates.currency;
    if ('currency_type' in updates) tempRow.currency = updates.currency_type;

    if (Object.keys(updates).some((key) => fieldsTriggerFob.has(key))) {
      const fob = computeFobUsd(tempRow);
      if (fob !== null) {
        updates.fob_usd = fob;
        const cif = computeCifUsd(tempRow);
        if (cif !== null) updates.cif_usd = cif;
      }
    }
    if ('inland' in updates) {
      const cifUsd = computeCifUsd(tempRow);
      if (cifUsd !== null) updates.cif_usd = cifUsd;
      const cifLocal = computeCifLocal(tempRow, paymentDetails[recordId]);
      if (cifLocal !== null) updates.cif_local = cifLocal;
    }
  }, [consolidado, paymentDetails, computeFobUsd, computeCifUsd, computeCifLocal]);

  const queueInlineChange = useCallback((
    recordId: string,
    updates: Record<string, unknown>,
    changeItem: InlineChangeItem
  ) => { // NOSONAR - actualización crítica de compras directas con side-effects coordinados
    if (batchModeEnabled) {
      setPendingBatchChanges((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(recordId);
        if (existing) {
          newMap.set(recordId, {
            recordId,
            updates: { ...existing.updates, ...updates },
            changes: [...existing.changes, changeItem],
          });
        } else {
          newMap.set(recordId, { recordId, updates, changes: [changeItem] });
        }
        return newMap;
      });
      applyBatchFobCifRecalc(updates, recordId);
      // Marcar como verificados al guardar (FOB ORIGEN, OCEAN, Gastos Pto) para pintar verde
      const fobOriginFields = new Set(['precio_fob', 'exw_value_formatted', 'fob_expenses', 'disassembly_load_value']);
      if (Object.keys(updates).some((key) => fobOriginFields.has(key))) updates.fob_total_verified = true;
      if ('inland' in updates) updates.inland_verified = true;
      if ('gastos_pto' in updates) updates.gastos_pto_verified = true;
      return apiPut(`/api/management/${recordId}`, updates)
        .then(() => updateConsolidadoLocal(recordId, updates))
        .catch((err) => { throw err; });
    }
    return new Promise<void>((resolve, reject) => {
      pendingChangeRef.current = { recordId, updates, changes: [changeItem] };
      pendingResolveRef.current = resolve;
      pendingRejectRef.current = reject;
      setChangeModalItems([changeItem]);
      setChangeModalOpen(true);
    });
  }, [batchModeEnabled, applyBatchFobCifRecalc, updateConsolidadoLocal]);

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
        if (loadChangeIndicatorsRef.current) await loadChangeIndicatorsRef.current([batch.recordId]);
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

  const handleConfirmInlineChange = async (reason?: string) => { // NOSONAR - maneja casos batch/single y recálculos; complejidad controlada
    const pending = pendingChangeRef.current;
    if (!pending) return;
    
    // Si es modo batch, usar la función especial
    if (pending.recordId === 'BATCH_MODE') {
      await confirmBatchChanges(reason);
      return;
    }
    
    try {
      // Si se actualiza currency, currency_type, usd_jpy_rate o cualquier componente de FOB ORIGEN, recalcular fob_usd y cif_usd
      const fieldsThatTriggerFobUsdRecalc = new Set(['currency', 'currency_type', 'usd_jpy_rate', 'precio_fob', 'exw_value_formatted', 'fob_expenses', 'disassembly_load_value']);
      const shouldRecalcFobUsd = Object.keys(pending.updates).some(key => fieldsThatTriggerFobUsdRecalc.has(key));
      
      if (shouldRecalcFobUsd) {
        // Obtener el registro actual del consolidado para calcular con los nuevos valores
        const currentRow = consolidado.find(r => r.id === pending.recordId);
        if (currentRow) {
          const tempRow = { ...currentRow, ...pending.updates };
          // Sincronizar currency y currency_type
          if ('currency' in pending.updates) {
            tempRow.currency_type = pending.updates.currency;
          }
          if ('currency_type' in pending.updates) {
            tempRow.currency = pending.updates.currency_type;
          }
          const recalculatedFobUsd = computeFobUsd(tempRow);
          if (recalculatedFobUsd !== null) {
            pending.updates.fob_usd = recalculatedFobUsd;
            // Recalcular CIF USD cuando cambia FOB USD
            const recalculatedCifUsd = computeCifUsd(tempRow);
            if (recalculatedCifUsd !== null) {
              pending.updates.cif_usd = recalculatedCifUsd;
            }
          }
        }
      }
      
      // Si se actualiza OCEAN (USD) - inland, recalcular CIF USD y CIF Local
      if ('inland' in pending.updates) {
        const currentRow = consolidado.find(r => r.id === pending.recordId);
        if (currentRow) {
          const tempRow = { ...currentRow, ...pending.updates };
          const recalculatedCifUsd = computeCifUsd(tempRow);
          if (recalculatedCifUsd !== null) {
            pending.updates.cif_usd = recalculatedCifUsd;
          }
          // También recalcular CIF Local
          const recalculatedCifLocal = computeCifLocal(tempRow, paymentDetails[pending.recordId]);
          if (recalculatedCifLocal !== null) {
            pending.updates.cif_local = recalculatedCifLocal;
          }
        }
      }

      // Al guardar desde Control de Cambios: marcar como verificados los campos editados (pintar verde)
      const fobOriginFields = new Set(['precio_fob', 'exw_value_formatted', 'fob_expenses', 'disassembly_load_value']);
      if (Object.keys(pending.updates).some((key) => fobOriginFields.has(key))) {
        pending.updates.fob_total_verified = true;
      }
      if ('inland' in pending.updates) {
        pending.updates.inland_verified = true;
      }
      if ('gastos_pto' in pending.updates) {
        pending.updates.gastos_pto_verified = true;
      }

      await apiPut(`/api/management/${pending.recordId}`, pending.updates);
      await apiPost('/api/change-logs', {
        table_name: 'purchases',
        record_id: pending.recordId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'management',
      });
      if (loadChangeIndicatorsRef.current) await loadChangeIndicatorsRef.current([pending.recordId]);
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

  const handleIndicatorClick = useCallback((
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
  }, []);

  type RecordFieldValue = string | number | boolean | null;

  const getRecordFieldValue = useCallback((
    record: ConsolidadoRecord,
    fieldName: string
  ): RecordFieldValue => {
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
  }, []);

  type FieldValue = string | number | boolean | null;

  const beginInlineChange = useCallback((
    row: ConsolidadoRecord,
    fieldName: string,
    fieldLabel: string,
    oldValue: FieldValue,
    newValue: FieldValue,
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
  }, [queueInlineChange, mapValueForLog]);

  const requestNumericFields = useMemo(
    () => new Set(['pvp_est', 'precio_fob', 'inland', 'gastos_pto', 'flete', 'traslado', 'repuestos', 'service_value', 'cost_arancel', 'proyectado']),
    []
  );
  const requestDirectSaveFields = useMemo(
    () => new Set(['incoterm', 'currency_type', 'shipment_type_v2']),
    []
  );
  const requestVerifiedFieldsMap = useMemo(
    () =>
      ({
        inland: 'inland_verified',
        gastos_pto: 'gastos_pto_verified',
        flete: 'flete_verified',
        traslado: 'traslado_verified',
        repuestos: 'repuestos_verified',
        precio_fob: 'fob_total_verified',
        exw_value_formatted: 'fob_total_verified',
        fob_expenses: 'fob_total_verified',
        disassembly_load_value: 'fob_total_verified',
      }) as Record<string, string>,
    []
  );
  const requestFobRecalcFields = useMemo(
    () => new Set(['currency', 'currency_type', 'usd_jpy_rate', 'precio_fob', 'exw_value_formatted', 'fob_expenses', 'disassembly_load_value']),
    []
  );

  const normalizeRequestCurrentValue = useCallback(
    (row: ConsolidadoRecord, fieldName: string, currentValue: FieldValue): FieldValue => {
      if (!requestNumericFields.has(fieldName)) return currentValue;
      if (currentValue !== 0 && currentValue !== '0') return currentValue;
      return row[fieldName] === null || row[fieldName] === undefined ? null : currentValue;
    },
    [requestNumericFields]
  );

  const buildRequestUpdatesForDirectSave = useCallback(
    (
      row: ConsolidadoRecord,
      fieldName: string,
      newValue: FieldValue,
      updates?: Record<string, unknown>
    ): Record<string, unknown> => {
      const updatesToApply: Record<string, unknown> = { ...(updates ?? { [fieldName]: newValue }) };
      const verifiedField = requestVerifiedFieldsMap[fieldName];
      if (verifiedField) updatesToApply[verifiedField] = false;

      if (requestFobRecalcFields.has(fieldName)) {
        const tempRow = { ...row, ...updatesToApply };
        if ('currency' in updatesToApply) tempRow.currency_type = updatesToApply.currency;
        if ('currency_type' in updatesToApply) tempRow.currency = updatesToApply.currency_type;

        const recalculatedFobUsd = computeFobUsd(tempRow);
        if (recalculatedFobUsd !== null) updatesToApply.fob_usd = recalculatedFobUsd;
        const recalculatedCifUsd = computeCifUsd(tempRow);
        if (recalculatedCifUsd !== null) updatesToApply.cif_usd = recalculatedCifUsd;
      }

      if (fieldName === 'inland') {
        const tempRow = { ...row, ...updatesToApply };
        const recalculatedCifUsd = computeCifUsd(tempRow);
        if (recalculatedCifUsd !== null) updatesToApply.cif_usd = recalculatedCifUsd;
        const recalculatedCifLocal = computeCifLocal(tempRow, paymentDetails[row.id as string]);
        if (recalculatedCifLocal !== null) updatesToApply.cif_local = recalculatedCifLocal;
      }

      return updatesToApply;
    },
    [requestVerifiedFieldsMap, requestFobRecalcFields, computeFobUsd, computeCifUsd, computeCifLocal, paymentDetails]
  );

  const logDirectRequestChange = useCallback(
    async (
      row: ConsolidadoRecord,
      fieldName: string,
      fieldLabel: string,
      oldValue: FieldValue,
      newValue: FieldValue,
      shouldSaveDirectly: boolean,
      isCurrentValueEmpty: boolean
    ) => {
      if (!shouldSaveDirectly || isCurrentValueEmpty) return;
      const changeItem = {
        field_name: fieldName,
        field_label: fieldLabel,
        old_value: mapValueForLog(oldValue),
        new_value: mapValueForLog(newValue),
      };
      try {
        await apiPost('/api/change-logs', {
          table_name: 'purchases',
          record_id: row.id,
          changes: [changeItem],
          change_reason: null,
          module_name: 'management',
        });
        if (loadChangeIndicatorsRef.current) {
          await loadChangeIndicatorsRef.current([row.id]);
        }
      } catch {
        // No mostrar error al usuario, el dato principal ya fue guardado.
      }
    },
    [mapValueForLog]
  );

  const requestFieldUpdate = useCallback(async (
    row: ConsolidadoRecord,
    fieldName: string,
    fieldLabel: string,
    newValue: FieldValue,
    updates?: Record<string, unknown>
  ) => {
    const currentValue = getRecordFieldValue(row, fieldName);
    const normalizedCurrentValue = normalizeRequestCurrentValue(row, fieldName, currentValue);
    const shouldSaveDirectly = requestDirectSaveFields.has(fieldName);
    const isCurrentValueEmpty = isValueEmpty(normalizedCurrentValue);
    const isNewValueEmpty = isValueEmpty(newValue);

    if ((isCurrentValueEmpty && !isNewValueEmpty) || shouldSaveDirectly) {
      const updatesToApply = buildRequestUpdatesForDirectSave(row, fieldName, newValue, updates);
      await apiPut(`/api/management/${row.id}`, updatesToApply);
      updateConsolidadoLocal(row.id, updatesToApply);
      await logDirectRequestChange(
        row,
        fieldName,
        fieldLabel,
        normalizedCurrentValue,
        newValue,
        shouldSaveDirectly,
        isCurrentValueEmpty
      );
      showSuccess('Dato actualizado');
      return;
    }

    if (isCurrentValueEmpty && isNewValueEmpty) return;

    return beginInlineChange(
      row,
      fieldName,
      fieldLabel,
      normalizedCurrentValue,
      newValue,
      updates ?? { [fieldName]: newValue }
    );
  }, [
    beginInlineChange,
    buildRequestUpdatesForDirectSave,
    getRecordFieldValue,
    logDirectRequestChange,
    normalizeRequestCurrentValue,
    requestDirectSaveFields,
    updateConsolidadoLocal,
  ]);

  const handleShipmentMethodSave = useCallback(
    (row: ConsolidadoRecord, value: string | number | null) => {
      const shipmentPolicy = getShipmentPolicyForRow(row);
      const normalizedVal = normalizeShipmentMethod(typeof value === 'string' ? value : '');
      if (normalizedVal && !shipmentPolicy.options.includes(normalizedVal)) {
        showError(
          `Método de embarque inválido para ${row.tonelage || 'este tonelaje'}. Solo se permiten: ${shipmentPolicy.options.join(', ')}`
        );
        return Promise.resolve();
      }

      const shipmentToSave =
        normalizedVal && shipmentPolicy.options.includes(normalizedVal)
          ? normalizedVal
          : shipmentPolicy.defaultMethod;

      return requestFieldUpdate(
        row,
        'shipment_type_v2',
        'METODO EMBARQUE',
        shipmentToSave
      );
    },
    [getShipmentPolicyForRow, requestFieldUpdate]
  );

  const applyAutoCostResponseUpdates = useCallback(
    (
      row: ConsolidadoRecord,
      response: Awaited<ReturnType<typeof applyAutoCostRule>>,
      silent: boolean
    ) => {
      if (!response?.updates) return;

      updateConsolidadoLocal(row.id, {
        inland: response.updates.inland,
        gastos_pto: response.updates.gastos_pto,
        flete: response.updates.flete,
        inland_verified: false,
        gastos_pto_verified: false,
        flete_verified: false,
      });

      if (silent) return;

      const ruleLabel =
        response.rule?.name ||
        response.rule?.tonnage_label ||
        (response.rule?.model_patterns || []).join(', ');
      const successSuffix = ruleLabel ? ` (${ruleLabel})` : '';
      showSuccess(`Gastos automáticos aplicados${successSuffix}`);
    },
    [updateConsolidadoLocal]
  );

  const handleAutoCostApplyError = useCallback(
    (error: unknown, model: string, silent: boolean) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorResponse = (error as any)?.response?.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = errorResponse?.error || (error as any)?.message || 'No se pudo aplicar la regla automática';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isRuleNotFound = (error as any)?.response?.status === 404 || errorResponse?.code === 'RULE_NOT_FOUND';

      if (silent) return;

      if (isRuleNotFound) {
        const searchParams = errorResponse?.searchParams || {};
        const brandPart = searchParams.brand ? ` (Marca: ${searchParams.brand})` : '';
        const shipmentPart = searchParams.shipment ? ` (Método: ${searchParams.shipment})` : '';
        const friendlyMessage = message.includes('No se encontró una regla')
          ? message
          : `No se encontró una regla automática para el modelo "${model}"${brandPart}${shipmentPart}. Por favor, configura una regla en el módulo de Gestión de Reglas Automáticas.`;
        showError(friendlyMessage);
        return;
      }

      showError(message);
    },
    []
  );

  // OPTIMIZACIÓN: useCallback para evitar recrear la función
  const handleApplyAutoCosts = useCallback(async (
    row: ConsolidadoRecord,
    options: { force?: boolean; silent?: boolean; runId?: string; source?: string } = {}
  ) => {
    const purchaseId = getPurchaseKey(row);
    if (!purchaseId) return;

    const model = (row.model || '').trim().toUpperCase();
    if (!model) {
      if (!options.silent) showError('Primero asigna un modelo para aplicar gastos automáticos');
      return;
    }

    const brandValue = (row.brand || '').trim().toUpperCase() || null;
    const shipmentPolicy = getShipmentPolicyForRow(row);
    const shipmentRaw = (row.shipment || row.shipment_type_v2 || '').trim().toUpperCase();
    const normalizedShipment = normalizeShipmentMethod(shipmentRaw);
    const shipmentValue =
      normalizedShipment && shipmentPolicy.options.includes(normalizedShipment)
        ? normalizedShipment
        : shipmentPolicy.defaultMethod;
    const force = options.force ?? true; // siempre sobrescribir al cambiar modelo

    try {
      const response = await applyAutoCostRule({
        purchase_id: purchaseId,
        model,
        brand: brandValue,
        shipment: shipmentValue,
        tonnage: row.tonelage || null,
        force,
      });
      applyAutoCostResponseUpdates(row, response, Boolean(options.silent));
    } catch (error: unknown) {
      handleAutoCostApplyError(error, model, Boolean(options.silent));
    }
  }, [applyAutoCostResponseUpdates, getPurchaseKey, getShipmentPolicyForRow, handleAutoCostApplyError]);

  // Actualizar campos de compras directas (supplier, brand, model, serial, year, hours)
  // OPTIMIZACIÓN: useCallback para evitar recrear la función en cada render
  type DirectPurchaseValue = string | number | null;

  const machineFieldNames = useMemo(
    () => new Set(['brand', 'model', 'serial', 'year', 'hours', 'machine_type']),
    []
  );

  const validateDirectModelValue = useCallback(
    (fieldName: string, value: DirectPurchaseValue) => {
      if (fieldName !== 'model' || !value) return true;
      const modelString = String(value).trim();
      if (!modelString || allModels.includes(modelString)) return true;
      showError(`El modelo "${modelString}" no está en la lista de opciones permitidas. Por favor seleccione un modelo válido.`);
      return false;
    },
    [allModels]
  );

  const buildMachineUpdatesForDirectField = useCallback(
    (row: ConsolidadoRecord, fieldName: string, value: DirectPurchaseValue): Record<string, DirectPurchaseValue> => {
      const normalizedCurrentMachineType = String(row.machine_type ?? '').trim().toUpperCase();
      const normalizedNewMachineType =
        fieldName === 'machine_type' ? String(value ?? '').trim().toUpperCase() : '';
      const shouldClearBrandAndModel =
        fieldName === 'machine_type' && normalizedNewMachineType !== normalizedCurrentMachineType;
      return shouldClearBrandAndModel
        ? { machine_type: value, brand: '', model: '' }
        : { [fieldName]: value };
    },
    []
  );

  const getDefaultShipmentForModelChange = useCallback(
    (row: ConsolidadoRecord, modelValue: DirectPurchaseValue): string => {
      const normalizedModel = String(modelValue ?? '').trim().toUpperCase();
      const shipmentPolicy = getShipmentPolicyForRow({
        ...row,
        model: normalizedModel || row.model,
        tonelage: null,
        tonnage_label: null,
      });
      return shipmentPolicy.defaultMethod;
    },
    [getShipmentPolicyForRow]
  );

  const persistShipmentDefaultForModelChange = useCallback(
    async (row: ConsolidadoRecord, shipmentMethod: string) => {
      await apiPut(`/api/management/${row.id}`, { shipment_type_v2: shipmentMethod });
      updateConsolidadoLocal(row.id, { shipment_type_v2: shipmentMethod });
    },
    [updateConsolidadoLocal]
  );

  const tryApplySpecsForModelChange = useCallback(
    async (row: ConsolidadoRecord, newValue: DirectPurchaseValue) => {
      if (!row.brand || !newValue) return false;
      try {
        const nextModel = String(newValue).trim();
        const nextDefaultShipment = getDefaultShipmentForModelChange(row, nextModel);
        const specs = await apiGet<{
          spec_blade?: boolean;
          spec_pip?: boolean;
          spec_cabin?: string;
          arm_type?: string;
          shoe_width_mm?: number;
        }>(`/api/machine-spec-defaults/by-model?brand=${encodeURIComponent(row.brand)}&model=${encodeURIComponent(nextModel)}`);

        if (!specs || Object.keys(specs).length === 0) return false;

        await apiPut(`/api/purchases/${row.id}/machine`, {
          shoe_width_mm: specs.shoe_width_mm || null,
          spec_pip: specs.spec_pip || false,
          spec_blade: specs.spec_blade || false,
          spec_cabin: specs.spec_cabin || null,
          arm_type: specs.arm_type || null,
        });

        setConsolidado((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  model: nextModel,
                  shoe_width_mm: specs.shoe_width_mm ?? r.shoe_width_mm,
                  track_width: specs.shoe_width_mm ?? r.track_width,
                  wet_line: specs.spec_pip ? 'SI' : (r.wet_line || 'No'),
                  blade: specs.spec_blade ? 'SI' : (r.blade || 'No'),
                  cabin_type: specs.spec_cabin || r.cabin_type,
                  arm_type: specs.arm_type || r.arm_type,
                  spec_pip: specs.spec_pip ?? r.spec_pip,
                  spec_blade: specs.spec_blade ?? r.spec_blade,
                  spec_cabin: specs.spec_cabin ?? r.spec_cabin,
                  shipment_type_v2: nextDefaultShipment,
                  shipment: nextDefaultShipment,
                }
              : r
          )
        );

        try {
          await persistShipmentDefaultForModelChange(row, nextDefaultShipment);
        } catch (shipmentError) {
          console.warn('No se pudo actualizar el método de embarque por default al cambiar modelo:', shipmentError);
        }

        try {
          await handleApplyAutoCosts(
            {
              ...row,
              model: nextModel,
              shipment_type_v2: nextDefaultShipment,
              shipment: nextDefaultShipment,
              tonelage: null,
              tonnage_label: null,
            },
            { silent: false, force: true, runId: 'run-model-change', source: 'model-change-spec' }
          );
        } catch {
          // no-op
        }

        showSuccess('Modelo y especificaciones actualizados correctamente');
        return true;
      } catch {
        return false;
      }
    },
    [getDefaultShipmentForModelChange, handleApplyAutoCosts, persistShipmentDefaultForModelChange]
  );

  const updateSupplierCurrencyIfMapped = useCallback(
    async (row: ConsolidadoRecord, supplierValue: string, mappedCurrency: string) => {
      try {
        await requestFieldUpdate(row, 'currency_type', 'CRCY', mappedCurrency);
        setConsolidado((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, supplier: supplierValue, currency: mappedCurrency, currency_type: mappedCurrency }
              : r
          )
        );
        showSuccess(`Proveedor "${supplierValue}" y moneda (${mappedCurrency}) actualizados correctamente`);
      } catch (currencyError) {
        console.error('⚠️ Error actualizando currency (no crítico):', currencyError);
        showSuccess(`Proveedor "${supplierValue}" actualizado correctamente. Advertencia: No se pudo actualizar la moneda automáticamente.`);
      }
    },
    [requestFieldUpdate]
  );

  const updateSupplierForDirectPurchase = useCallback(
    async (row: ConsolidadoRecord, value: DirectPurchaseValue) => {
      const supplierValue = String(value || '').trim();
      if (!supplierValue) {
        throw new Error('El nombre del proveedor no puede estar vacío');
      }

      await apiPut(`/api/purchases/${row.id}/supplier`, { supplier_name: supplierValue });
      setConsolidado((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, supplier: supplierValue } : r))
      );
      setLastEditedRowId(String(row.id));

      const mappedCurrency = getCurrencyForSupplier(supplierValue);
      if (!mappedCurrency) {
        showSuccess(`Proveedor "${supplierValue}" actualizado correctamente`);
        return;
      }

      await updateSupplierCurrencyIfMapped(row, supplierValue, mappedCurrency);
    },
    [updateSupplierCurrencyIfMapped]
  );

  const updateMachineFieldForDirectPurchase = useCallback(
    async (row: ConsolidadoRecord, fieldName: string, newValue: DirectPurchaseValue) => {
      if (!validateDirectModelValue(fieldName, newValue)) return;

      const machineUpdates = buildMachineUpdatesForDirectField(row, fieldName, newValue);
      setConsolidado((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...machineUpdates } : r)));
      await apiPut(`/api/purchases/${row.id}/machine`, machineUpdates);
      setLastEditedRowId(String(row.id));

      if (fieldName !== 'model') {
        showSuccess('Campo actualizado correctamente');
        return;
      }

      const specsHandled = await tryApplySpecsForModelChange(row, newValue);
      if (specsHandled) return;

      const normalizedModel = (
        typeof newValue === 'string' ? newValue : (newValue ?? '').toString()
      ).toUpperCase();
      const nextDefaultShipment = getDefaultShipmentForModelChange(row, normalizedModel);
      try {
        await persistShipmentDefaultForModelChange(row, nextDefaultShipment);
      } catch (shipmentError) {
        console.warn('No se pudo actualizar el método de embarque por default al cambiar modelo:', shipmentError);
      }
      const updatedRow = {
        ...row,
        model: normalizedModel,
        shipment_type_v2: nextDefaultShipment,
        shipment: nextDefaultShipment,
        tonelage: null,
        tonnage_label: null,
      };
      await handleApplyAutoCosts(updatedRow, {
        silent: false,
        force: true,
        runId: 'run-model-change',
        source: 'model-change',
      });
    },
    [
      buildMachineUpdatesForDirectField,
      getDefaultShipmentForModelChange,
      handleApplyAutoCosts,
      persistShipmentDefaultForModelChange,
      tryApplySpecsForModelChange,
      validateDirectModelValue,
    ]
  );

  const handleDirectPurchaseFieldUpdate = useCallback(async (
    row: ConsolidadoRecord,
    fieldName: string,
    newValue: DirectPurchaseValue
  ) => {
    try {
      if (machineFieldNames.has(fieldName)) {
        await updateMachineFieldForDirectPurchase(row, fieldName, newValue);
        return;
      }

      if (fieldName === 'supplier_name') {
        await updateSupplierForDirectPurchase(row, newValue);
      }
    } catch (error) {
      if (fieldName === 'supplier_name') {
        const errorMessage = error instanceof Error ? error.message : 'Error al actualizar proveedor';
        showError(`Error al actualizar proveedor: ${errorMessage}`);
        return;
      }
      showError('Error al actualizar el campo');
    }
  }, [
    machineFieldNames,
    updateMachineFieldForDirectPurchase,
    updateSupplierForDirectPurchase,
  ]);

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
    } catch {
      showError('Error al actualizar especificaciones');
    }
  };

  const handleCloseSpecsPopover = useCallback((rowId: string) => {
    setSpecsPopoverOpen(null);
    setEditingSpecs(prev => {
      const newState = { ...prev };
      delete newState[rowId];
      return newState;
    });
  }, []);

  // Abrir popover de specs y cargar datos actuales
  const handleOpenSpecsPopover = (row: ConsolidadoRecord) => {
    setSpecsPopoverOpen(row.id);
    const shoeConfig = getShoeWidthConfigForModel(row.model);
    const cacheKey =
      row.brand && row.model ? `${row.brand}_${row.model}` : null;
    const cachedDefaults = cacheKey ? specDefaultsCache[cacheKey] : undefined;
    const defaultShoeWidth = cachedDefaults?.shoe_width_mm ?? null;
    const rowShoeWidth = (() => {
      const candidate = row.shoe_width_mm ?? row.track_width;
      if (candidate === null || candidate === undefined || candidate === '') return null;
      const parsedCandidate = Number(candidate);
      if (Number.isNaN(parsedCandidate) || parsedCandidate <= 0) return null;
      return parsedCandidate;
    })();
    const initialShoeWidth = (() => {
      if (shoeConfig?.type === 'readonly') {
        return shoeConfig.value;
      }
      if (shoeConfig?.type === 'select') {
        const resolveValidSelectValue = (candidate: number | null): number | null => {
          if (candidate === null || candidate === undefined) return null;
          const parsedCandidate = Number(candidate);
          if (Number.isNaN(parsedCandidate) || parsedCandidate <= 0) return null;
          return shoeConfig.options.includes(parsedCandidate) ? parsedCandidate : null;
        };
        const validCurrent = resolveValidSelectValue(rowShoeWidth);
        const validDefault = resolveValidSelectValue(defaultShoeWidth);
        return validCurrent ?? validDefault ?? shoeConfig.options[0] ?? null;
      }
      if (defaultShoeWidth !== null && defaultShoeWidth !== undefined) {
        return defaultShoeWidth;
      }
      return rowShoeWidth;
    })();
    setEditingSpecs(prev => ({
      ...prev,
      [row.id]: {
        shoe_width_mm: initialShoeWidth,
        spec_cabin: row.spec_cabin || row.cabin_type || '',
        arm_type: row.arm_type || '',
        spec_pip: row.spec_pip === undefined ? (row.wet_line === 'SI') : row.spec_pip,
        spec_blade: row.spec_blade === undefined ? (row.blade === 'SI') : row.spec_blade,
        spec_pad: row.spec_pad || null
      }
    }));

    if (cacheKey && !cachedDefaults) {
      void (async () => {
        try {
          const defaults = await apiGet<{
            shoe_width_mm?: number;
            spec_cabin?: string;
            arm_type?: string;
            spec_pip?: boolean;
            spec_blade?: boolean;
            spec_pad?: string;
          }>(`/api/machine-spec-defaults/brand/${encodeURIComponent(row.brand)}/model/${encodeURIComponent(row.model)}`).catch(() => null);
          if (!defaults) return;
          setSpecDefaultsCache(prev => ({
            ...prev,
            [cacheKey]: defaults,
          }));
          if (defaults.shoe_width_mm !== undefined && defaults.shoe_width_mm !== null && shoeConfig?.type !== 'select') {
            setEditingSpecs(prev => {
              const current = prev[row.id];
              if (!current) return prev;
              if (current.shoe_width_mm === defaults.shoe_width_mm) {
                return prev;
              }
              return {
                ...prev,
                [row.id]: {
                  ...current,
                  shoe_width_mm: defaults.shoe_width_mm ?? current.shoe_width_mm,
                },
              };
            });
          }
        } catch (error) {
          console.warn('Error cargando especificaciones por defecto:', error);
        }
      })();
    }
  };

  const handleSaveServiceComments = useCallback(async (r: ConsolidadoRecord) => {
    try {
      await apiPut(`/api/management/${r.id}`, { comentarios_servicio: r.comentarios_servicio || null });
      showSuccess('Comentarios de servicio guardados');
      setServiceCommentsPopover(null);
    } catch {
      showError('Error al guardar comentarios');
    }
  }, []);

  const handleSaveCommercialComments = useCallback(async (r: ConsolidadoRecord) => {
    try {
      await apiPut(`/api/management/${r.id}`, { comentarios_comercial: r.comentarios_comercial || null });
      showSuccess('Comentarios comerciales guardados');
      setCommercialCommentsPopover(null);
    } catch {
      showError('Error al guardar comentarios');
    }
  }, []);

  const handleServiceCommentChange = useCallback((rowId: string, value: string) => {
    setConsolidado((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, comentarios_servicio: value } : r))
    );
  }, []);

  const handleCommercialCommentChange = useCallback((rowId: string, value: string) => {
    setConsolidado((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, comentarios_comercial: value } : r))
    );
  }, []);

  // Handler único para cambios en specs (reduce anidación en JSX)
  const handleSpecFieldChange = useCallback((recordId: string, field: string, value: unknown) => {
    setEditingSpecs((prev) => {
      const current = prev[recordId];
      return {
        ...prev,
        [recordId]: current ? { ...current, [field]: value } : { [field]: value },
      };
    });
  }, []);

  // Render del campo Ancho Zapatas en popover de specs (extraído para reducir anidación)
  const renderSpecShoeField = useCallback(
    (r: ConsolidadoRecord) => {
      const shoeConfig = getShoeWidthConfigForModel(r.model);
      const cacheKey = r.brand && r.model ? `${r.brand}_${r.model}` : null;
      const cachedDefaults = cacheKey ? specDefaultsCache[cacheKey] : undefined;
      const defaultShoeWidth = cachedDefaults?.shoe_width_mm ?? null;
      const isSelect = shoeConfig?.type === 'select';
      const isReadonly = shoeConfig?.type === 'readonly';
      const hasDefaultValue =
        !isSelect && !isReadonly && defaultShoeWidth !== null && defaultShoeWidth !== undefined;

      if (isSelect && shoeConfig?.type === 'select') {
        return (
          <select
            id={`spec-shoe-${r.id}`}
            value={editingSpecs[r.id]?.shoe_width_mm ?? ''}
            onChange={(e) => handleSpecFieldChange(r.id as string, 'shoe_width_mm', e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
          >
            <option value="">Seleccionar...</option>
            {shoeConfig.options.map((o) => (
              <option key={o} value={o}>{o} mm</option>
            ))}
          </select>
        );
      }
      if (isReadonly || hasDefaultValue) {
        const displayValue = isReadonly ? shoeConfig?.value ?? defaultShoeWidth : defaultShoeWidth;
        return (
          <div className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700">
            {displayValue === null || displayValue === undefined ? 'Sin definir' : `${displayValue} mm`}
          </div>
        );
      }
      return (
        <input
          id={`spec-shoe-${r.id}`}
          type="number"
          value={editingSpecs[r.id]?.shoe_width_mm ?? ''}
          onChange={(e) => handleSpecFieldChange(r.id as string, 'shoe_width_mm', e.target.value ? Number(e.target.value) : null)}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
          placeholder="Ej: 600"
        />
      );
    },
    [editingSpecs, specDefaultsCache, handleSpecFieldChange]
  );

  // Verificar si el usuario puede editar campos en Management
  // Permite a usuarios con rol 'gerencia', 'admin', o el email específico pcano@partequipos.com
  const canEditManagementFields = () => {
    return user?.role === 'gerencia' || 
           user?.role === 'admin' || 
           user?.email?.toLowerCase() === 'pcano@partequipos.com';
  };

  // Verificar si el usuario es admin o tiene permisos de eliminar
  const isAdmin = () => {
    if (user?.email) {
      const userEmail = user.email.toLowerCase();
      const adminEmails = ['admin@partequipos.com', 'sdonado@partequiposusa.com', 'pcano@partequipos.com', 'gerencia@partequipos.com'];
      if (adminEmails.includes(userEmail)) return true;
      if (user?.role === 'gerencia') return true;
    }
    return false;
  };

  // Eliminar registro de consolidado (solo admin)
  const handleDeleteRecord = async (rowId: string, mq: string) => {
    if (isAdmin()) {
      const confirmed = globalThis.confirm(
      `¿Estás seguro de eliminar el registro ${mq || rowId}?\n\nEsta acción eliminará el registro de TODOS los módulos (Compras, Logística, Servicio, Equipos, etc.) y NO SE PUEDE DESHACER.`
      );

      if (confirmed) {
        try {
          await apiDelete(`/api/purchases/${rowId}`);
          setConsolidado(prev => prev.filter(r => r.id !== rowId));
          showSuccess('Registro eliminado exitosamente de todos los módulos');
        } catch {
          showError('Error al eliminar registro');
        }
      }
    } else {
      showError('Solo el administrador puede eliminar registros');
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
    
    if (globalThis.confirm(message)) {
      setPendingBatchChanges(new Map());
      showSuccess('Registro de cambios cancelado. Los datos permanecen guardados.');
    }
  };

  // OPTIMIZADO: Memoizar buildCellProps para evitar re-renders innecesarios
  const buildCellProps = useCallback((recordId: string, field: string) => ({
    recordId,
    fieldName: field,
    indicators: getFieldIndicators(inlineChangeIndicators, recordId, field),
    openPopover: openChangePopover,
    onIndicatorClick: handleIndicatorClick,
    formatChangeValue,
    getModuleLabel,
  }), [inlineChangeIndicators, openChangePopover, handleIndicatorClick, getFieldIndicators, formatChangeValue, getModuleLabel]);

  // Cargar indicadores de cambios (de purchases y service_records)
  const loadChangeIndicators = useCallback(async (recordIds?: string[]) => {
    if (consolidado.length === 0) return;
    
    try {
      const idsToLoad = recordIds || consolidado.map(c => c.id as string);
      
      type ChangeLogItem = {
        id: string;
        field_name: string;
        field_label: string;
        old_value: string | number | null;
        new_value: string | number | null;
        change_reason: string | null;
        changed_at: string;
        module_name: string | null;
        changed_by_name: string | null;
      };

      const purchaseResponse = await apiPost<Record<string, Array<ChangeLogItem>>>('/api/change-logs/batch', {
        table_name: 'purchases',
        record_ids: idsToLoad,
      });
      
      // Cargar cambios de service_records
      const serviceRecordIds = consolidado
        .filter(c => c.service_record_id)
        .map(c => c.service_record_id as string);
      
      let serviceResponse: Record<string, Array<ChangeLogItem>> = {};
      
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
            changedByName: change.changed_by_name || null,
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
            changedByName: change.changed_by_name || null,
          }));
          
          if (indicatorsMap[purchaseId]) {
            indicatorsMap[purchaseId] = [...indicatorsMap[purchaseId], ...serviceChanges];
          } else {
            indicatorsMap[purchaseId] = serviceChanges;
          }
        }
      });
      
      setInlineChangeIndicators(prev => ({ ...prev, ...indicatorsMap }));
    } catch {
      // Error silencioso al cargar indicadores
    }
  }, [consolidado]);

  // Actualizar ref cuando loadChangeIndicators cambie
  useEffect(() => {
    loadChangeIndicatorsRef.current = loadChangeIndicators;
  }, [loadChangeIndicators]);

  useEffect(() => {
    if (!loading && consolidado.length > 0) {
      loadChangeIndicators();
    }
  }, [consolidado, loading, loadChangeIndicators]);

  // Funciones de estilo removidas - no se usan actualmente, se usan estilos inline directamente en el componente

  // Función para determinar el color de fondo de la fila según la completitud de datos
  // OPTIMIZACIÓN: useMemo para evitar recalcular en cada render
  const getRowBackgroundByCompleteness = useMemo(() => {
    return 'bg-white hover:bg-gray-50';
  }, []);

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
                <h1 className="text-lg font-semibold text-white">Consolidado - CD</h1>
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
                    onClick={handleExportToExcel}
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
                        if (globalThis.confirm('¿Deseas guardar los cambios pendientes antes de desactivar el modo masivo?')) {
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
                  <div className="relative flex items-center gap-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por modelo o serial..."
                      value={searchTerm}
                      onChange={(e) => {
                        // Optimización: actualizar inmediatamente para UX, el filtrado ya está memoizado
                        setSearchTerm(e.target.value);
                      }}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm text-sm"
                    />
                    {/* Botón Limpiar Filtros */}
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 rounded-lg shadow-sm transition-colors flex-shrink-0 whitespace-nowrap"
                        title="Limpiar todos los filtros"
                      >
                        <FilterX className="w-3.5 h-3.5" />
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de Scroll Superior - Sincronizada */}
            <div
              className={`mb-3 w-full sticky top-0 z-[65] bg-white border-b border-gray-100 py-1 ${
                hasTopLayerOpen ? 'invisible pointer-events-none' : ''
              }`}
            >
              <div 
                ref={topScrollRef}
                className="overflow-x-auto bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
                style={{ height: '14px', width: '100%' }}
              >
                <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
              </div>
            </div>


            {/* Tabla con scroll horizontal y vertical */}
            <div 
              ref={tableScrollRef} 
              className="overflow-x-auto overflow-y-scroll w-full" 
              style={{ 
                height: 'calc(100vh - 300px)',
                minHeight: '500px',
                maxHeight: 'calc(100vh - 300px)',
                width: '100%'
              }}
            >
              <table ref={tableRef} className="w-full min-w-[2000px] relative">
                <thead className="sticky top-0 z-50 bg-white">
                  <tr>
                    {/* Datos principales con filtros */}
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase min-w-[140px] ${supplierFilter ? 'text-white bg-red-600' : 'text-gray-800 bg-teal-100'}`}>
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
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase min-w-[140px] ${machineTypeFilter ? 'text-white bg-red-600' : 'text-gray-800 bg-teal-100'}`}>
                      <div className="mb-1">TIPO MÁQUINA</div>
                      <select
                        value={machineTypeFilter}
                        onChange={(e) => setMachineTypeFilter(e.target.value)}
                        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {uniqueMachineTypes.map(t => (
                          <option key={String(t)} value={String(t)}>
                            {formatMachineType(String(t)) || t}
                          </option>
                        ))}
                      </select>
                    </th>
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase min-w-[120px] ${brandFilter ? 'text-white bg-red-600' : 'text-gray-800 bg-teal-100'}`}>
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
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase min-w-[140px] ${modelFilter.length > 0 ? 'text-white bg-red-600' : 'text-gray-800 bg-teal-100'}`}>
                      <div className="mb-1">MODELO</div>
                      <ModelFilter
                        uniqueModels={uniqueModels}
                        modelFilter={modelFilter}
                        setModelFilter={setModelFilter}
                      />
                    </th>
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase min-w-[120px] ${serialFilter ? 'text-white bg-red-600' : 'text-gray-800 bg-teal-100'}`}>
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
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase min-w-[100px] ${yearFilter ? 'text-white bg-red-600' : 'text-gray-800 bg-teal-100'}`}>
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
                    <th className={`px-4 py-2 text-left text-xs font-semibold uppercase min-w-[100px] ${hoursFilter ? 'text-white bg-red-600' : 'text-gray-800 bg-teal-100'}`}>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-800 bg-indigo-100 whitespace-nowrap min-w-[160px]">INCOTERM DE COMPRA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-800 bg-indigo-100 whitespace-nowrap min-w-[120px]">CRCY</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-800 bg-indigo-100 whitespace-nowrap min-w-[160px]">MÉTODO EMBARQUE</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-orange-100">CONTRAVALOR</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-orange-100">TRM (COP)</th>
                    
                    {/* CAMPOS DE PURCHASES (Solo visualización) */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-indigo-100 whitespace-nowrap min-w-[140px]">VALOR + BP</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-indigo-100 whitespace-nowrap min-w-[140px]">GASTOS + LAVADO</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-indigo-100 whitespace-nowrap min-w-[160px]">DESENSAMBLAJE + CARGUE</th>
                    
                    {/* CAMPOS FINANCIEROS */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-indigo-100 whitespace-nowrap min-w-[160px]">FOB ORIGEN</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-indigo-100 min-w-[120px]">FOB (USD)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100 whitespace-nowrap min-w-[140px]">OCEAN (USD)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100 min-w-[120px]">CIF (USD)</th>
                    {/* <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100 min-w-[120px]">OCEAN (COP)</th> */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100 min-w-[140px]">CIF Local (COP)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100 whitespace-nowrap min-w-[140px]">Gastos Pto (COP)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100 whitespace-nowrap min-w-[180px]">TRASLADOS NACIONALES (COP)</th>
                    {SHOW_TRASLADO_COLUMN && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100 min-w-[120px]">Traslado (COP)</th>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100 whitespace-nowrap min-w-[180px]">PPTO DE REPARACION (COP)</th>
                    {/* Oculto: VALOR SERVICIO (COP) */}
                    {/* <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-cyan-100">VALOR SERVICIO (COP)</th> */}
                    {/* Oculto: Cost. Arancel (COP) */}
                    {/* <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100">Cost. Arancel (COP)</th> */}
                    
                    {/* CAMPOS MANUALES - Proyecciones */}
                    {/* Proyectado - OCULTO */}
                    {/* <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-yellow-500/20">
                      <div className="flex items-center gap-1 justify-end">
                        Proyectado
                        <span className="text-yellow-300" title="Campo manual">✎</span>
                      </div>
                    </th> */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-800 bg-teal-100 min-w-[140px]">
                      <div className="flex items-center gap-1 justify-end">
                        PVP Est.{' '}
                        <span className="text-gray-600" title="Campo manual">✎</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-800 bg-teal-100">
                      <div className="flex items-center gap-1">
                        Comentarios{' '}
                        <span className="text-gray-600" title="Campo manual">✎</span>
                      </div>
                    </th>
                    
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-800 sticky top-0 right-0 bg-teal-100 z-[60] shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    if (loading) {
                      return (
                        <tr>
                          <td colSpan={38} className="px-4 py-12 text-center">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-red border-t-transparent"></div>
                            <p className="text-gray-600 mt-4">Cargando consolidado...</p>
                          </td>
                        </tr>
                      );
                    }
                    if (filteredData.length === 0) {
                      return (
                        <tr>
                          <td colSpan={38} className="px-4 py-12 text-center">
                            <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 text-lg">No hay datos en el consolidado</p>
                          </td>
                        </tr>
                      );
                    }
                    return filteredData.map((row) => ( // NOSONAR - render inline extenso por tabla operativa con edición in-cell
                      <motion.tr
                        key={row.id}
                        initial={false}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.1 }}
                        className={`transition-colors duration-200 ${getRowBackgroundByCompleteness} ${lastEditedRowId === String(row.id) ? 'bg-sky-50/80 border-l-2 border-sky-400' : ''}`}
                        title={lastEditedRowId === String(row.id) ? 'Última fila editada' : undefined}
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
                              autoSave={true}
                            />
                          ) : (
                            <span className="font-semibold text-gray-900">{row.supplier || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={row.machine_type || ''}
                              onSave={(val) => handleDirectPurchaseFieldUpdate(row, 'machine_type', val)}
                              type="select"
                              placeholder="Tipo de máquina"
                              options={getMachineTypeOptionsForRow(row)}
                              displayFormatter={(val) => {
                                let valStr: string | null;
                                if (typeof val === 'string') valStr = val;
                                else if (val === null || val === undefined) valStr = null;
                                else valStr = String(val);
                                return formatMachineType(valStr) || 'Sin tipo';
                              }}
                              autoSave={true}
                            />
                          ) : (
                            <span className="text-gray-800">{formatMachineType(row.machine_type) || row.machine_type || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={row.brand || ''}
                              onSave={(val) => handleDirectPurchaseFieldUpdate(row, 'brand', val)}
                              type="combobox"
                              placeholder="Buscar o escribir marca"
                              options={getBrandOptionsForRow(row)}
                              autoSave={true}
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
                              options={getModelOptionsForRow(row)}
                              autoSave={true}
                            />
                          ) : (
                            <span className="text-gray-800">{row.model || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={getMachineSerialForDisplay(row.serial) || ''}
                              onSave={(val) =>
                                handleDirectPurchaseFieldUpdate(
                                  row,
                                  'serial',
                                  resolveSerialValueForSave(row.serial, val == null ? '' : String(val))
                                )
                              }
                              type="text"
                              placeholder="Serial"
                              autoSave={true}
                            />
                          ) : (
                            <span className="text-gray-800 font-mono">{getMachineSerialForDisplay(row.serial) || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.tipo_compra === 'COMPRA_DIRECTA' ? (
                            <InlineFieldEditor
                              value={row.year ? row.year.toString() : ''}
                              onSave={(val) => handleDirectPurchaseFieldUpdate(row, 'year', val ? Number(val) : null)}
                              type="select"
                              placeholder="Año"
                              options={YEAR_OPTIONS}
                              autoSave={true}
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
                              autoSave={true}
                            />
                          ) : (
                            <span className="text-gray-700">
                              {row.hours ? row.hours.toLocaleString('es-CO') : '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-gray-700">
                            {formatTipoCompra(row.tipo_compra)}
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
                              <button
                                type="button"
                                className="fixed inset-0 z-40 w-full h-full border-0 bg-transparent cursor-default"
                                aria-label="Cerrar especificaciones"
                                onClick={() => handleCloseSpecsPopover(row.id as string)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleCloseSpecsPopover(row.id as string);
                                  }
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
                                    <label htmlFor={`spec-shoe-${row.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                      Ancho Zapatas (mm)
                                    </label>
                                    {renderSpecShoeField(row)}
                                  </div>

                                    {/* Tipo de Cabina */}
                                  <div>
                                    <label htmlFor={`spec-cabin-${row.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                      Tipo de Cabina
                                    </label>
                                    <select
                                      id={`spec-cabin-${row.id}`}
                                      value={editingSpecs[row.id].spec_cabin || ''}
                                      onChange={(e) => handleSpecFieldChange(row.id as string, 'spec_cabin', e.target.value)}
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                    >
                                      <option value="">Seleccionar...</option>
                                      <option value="CABINA CERRADA/AC">Cerrada / AC</option>
                                      <option value="CANOPY">Canopy</option>
                                    </select>
                                  </div>
                                  </div>

                                  {/* Fila 2: Blade | Tipo de Brazo */}
                                  <div className="grid grid-cols-2 gap-3">
                                    {/* Blade */}
                                    <div>
                                      <label htmlFor={`spec-blade-${row.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                        Blade (Hoja Topadora)
                                      </label>
                                      <select
                                        id={`spec-blade-${row.id}`}
                                        value={editingSpecs[row.id].spec_blade ? 'SI' : 'No'}
                                        onChange={(e) => handleSpecFieldChange(row.id as string, 'spec_blade', e.target.value === 'SI')}
                                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                      >
                                        <option value="SI">SI</option>
                                        <option value="No">No</option>
                                    </select>
                                  </div>

                                  {/* Tipo de Brazo */}
                                  <div>
                                    <label htmlFor={`spec-arm-${row.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                      Tipo de Brazo
                                    </label>
                                    <select
                                      id={`spec-arm-${row.id}`}
                                      value={editingSpecs[row.id].arm_type || ''}
                                      onChange={(e) => handleSpecFieldChange(row.id as string, 'arm_type', e.target.value)}
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
                                    <label htmlFor={`spec-pip-${row.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                      PIP (Accesorios)
                                    </label>
                                    <select
                                      id={`spec-pip-${row.id}`}
                                      value={editingSpecs[row.id].spec_pip ? 'SI' : 'No'}
                                      onChange={(e) => handleSpecFieldChange(row.id as string, 'spec_pip', e.target.value === 'SI')}
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                    >
                                      <option value="SI">SI</option>
                                      <option value="No">No</option>
                                    </select>
                                  </div>

                                    {/* PAD */}
                                  <div>
                                    <label htmlFor={`spec-pad-${row.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                        PAD
                                    </label>
                                    {((row.condition || '').toUpperCase() === 'USADO') ? (
                                      <select
                                        id={`spec-pad-${row.id}`}
                                        value={editingSpecs[row.id].spec_pad || ''}
                                        onChange={(e) => handleSpecFieldChange(row.id as string, 'spec_pad', e.target.value)}
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
                                      onClick={() => handleCloseSpecsPopover(row.id as string)}
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
                        <td className="px-4 py-3 text-sm text-gray-700 min-w-[160px]">
                          {canEditManagementFields() ? (
                            <InlineFieldEditor
                              value={row.tipo_incoterm || ''}
                              onSave={(val) => {
                                // Validar que el valor sea permitido - mismo que en PurchasesPage: EXY, FOB, CIF
                                const validIncoterms = ['EXY', 'FOB', 'CIF'];
                                const normalizedVal = typeof val === 'string' ? val.trim().toUpperCase() : '';
                                if (normalizedVal && !validIncoterms.includes(normalizedVal)) {
                                  showError(`INCOTERM inválido. Solo se permiten: ${validIncoterms.join(', ')}`);
                                  return Promise.resolve();
                                }
                                return requestFieldUpdate(row, 'incoterm', 'INCOTERM DE COMPRA', normalizedVal || null);
                              }}
                              type="select"
                              placeholder=""
                              options={[
                                { value: 'EXY', label: 'EXY' },
                                { value: 'FOB', label: 'FOB' },
                                { value: 'CIF', label: 'CIF' },
                              ]}
                              autoSave={true}
                            />
                          ) : (
                            <span className="text-gray-700">{row.tipo_incoterm || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 min-w-[120px]">
                          {canEditManagementFields() ? (
                            <InlineFieldEditor
                              value={row.currency || row.currency_type || ''}
                              onSave={(val) => {
                                // Validar que el valor sea permitido por el constraint de la base de datos
                                const validCurrencies = ['JPY', 'GBP', 'EUR', 'USD', 'CAD'];
                                const normalizedVal = typeof val === 'string' ? val.trim().toUpperCase() : '';
                                if (normalizedVal && !validCurrencies.includes(normalizedVal)) {
                                  showError(`Moneda inválida. Solo se permiten: ${validCurrencies.join(', ')}`);
                                  return Promise.resolve();
                                }
                                return requestFieldUpdate(row, 'currency_type', 'CRCY', normalizedVal || null);
                              }}
                              type="select"
                              placeholder=""
                              options={[
                                { value: 'JPY', label: 'JPY' },
                                { value: 'GBP', label: 'GBP' },
                                { value: 'EUR', label: 'EUR' },
                                { value: 'USD', label: 'USD' },
                                { value: 'CAD', label: 'CAD' },
                              ]}
                              autoSave={true}
                            />
                          ) : (
                            row.currency || '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 min-w-[160px]">
                          {canEditManagementFields() ? (
                            <InlineFieldEditor
                              value={getEffectiveShipmentForRow(row)}
                              onSave={(val) => handleShipmentMethodSave(row, val)}
                              type="select"
                              placeholder=""
                              options={getShipmentOptionsForRow(row)}
                              autoSave={true}
                            />
                          ) : (
                            <span className="text-gray-700">{row.shipment || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatNumber(row.usd_jpy_rate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.trm_rate)}
                        </td>
                        {/* CAMPOS DE PURCHASES (Solo visualización) */}
                        <td className="px-4 py-3 text-sm text-gray-700 text-right min-w-[140px]">
                          {(() => {
                            const incoterm = row.tipo_incoterm || row.incoterm;
                            if (incoterm === 'FOB' || incoterm === 'CIF') return <span className="text-gray-400">N/A</span>;
                            const currency = row.currency || row.currency_type;
                            const value = row.exw_value_formatted;
                            if (value === null || value === undefined || value === '') return <span className="text-gray-400">-</span>;
                            let numValue: number;
                            if (typeof value === 'string') {
                              const cleaned = value.replaceAll(/[^\d.,]/g, '').replaceAll('.', '').replaceAll(',', '.');
                              numValue = Number.parseFloat(cleaned);
                            } else {
                              numValue = typeof value === 'number' ? value : 0;
                            }
                            if (Number.isNaN(numValue)) return <span className="text-gray-400">-</span>;
                            return <span>{formatCurrencyWithSymbol(currency, numValue)}</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right min-w-[140px]">
                          {(() => {
                            const incoterm = row.tipo_incoterm || row.incoterm;
                            if (incoterm === 'FOB' || incoterm === 'CIF') return <span className="text-gray-400">N/A</span>;
                            const currency = row.currency || row.currency_type;
                            const value = row.fob_expenses;
                            if (value === null || value === undefined || value === '') return <span className="text-gray-400">-</span>;
                            let numValue: number;
                            if (typeof value === 'number') numValue = value;
                            else if (typeof value === 'string') numValue = Number.parseFloat(value);
                            else numValue = 0;
                            if (Number.isNaN(numValue)) return <span className="text-gray-400">-</span>;
                            return <span>{formatCurrencyWithSymbol(currency, numValue)}</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right min-w-[160px]">
                          {(() => {
                            const incoterm = row.tipo_incoterm || row.incoterm;
                            if (incoterm === 'FOB' || incoterm === 'CIF') return <span className="text-gray-400">N/A</span>;
                            const currency = row.currency || row.currency_type;
                            const value = row.disassembly_load_value;
                            if (value === null || value === undefined || value === '') return <span className="text-gray-400">-</span>;
                            let numValue: number;
                            if (typeof value === 'number') numValue = value;
                            else if (typeof value === 'string') numValue = Number.parseFloat(value);
                            else numValue = 0;
                            if (Number.isNaN(numValue)) return <span className="text-gray-400">-</span>;
                            return <span>{formatCurrencyWithSymbol(currency, numValue)}</span>;
                          })()}
                        </td>
                        {/* CAMPOS FINANCIEROS */}
                        <td className={`px-4 py-3 text-sm text-right min-w-[160px] ${(() => {
                          const fob = toNumber(row.precio_fob);
                          if (fob <= 0) return 'text-gray-700';
                          return row.fob_total_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-amber-800';
                        })()}`}>
                          <div className="flex flex-col gap-1">
                            {canEditManagementFields() ? (
                              <ManagementInlineCell {...buildCellProps(row.id as string, 'precio_fob')}>
                                <InlineFieldEditor
                                  type="number"
                                  value={toNumber(row.precio_fob) || ''}
                                  placeholder="FOB ORIGEN"
                                  displayFormatter={() => formatCurrencyWithSymbolNoDecimals(row.currency, row.precio_fob)}
                                  onSave={(val) => {
                                    let numeric: number | null;
                                    if (typeof val === 'number') numeric = val;
                                    else if (val === null) numeric = null;
                                    else numeric = Number(val);
                                    return requestFieldUpdate(row, 'precio_fob', 'FOB ORIGEN', numeric);
                                  }}
                                />
                              </ManagementInlineCell>
                            ) : (
                              <span className="font-medium">
                                {formatCurrencyWithSymbolNoDecimals(row.currency, row.precio_fob)}
                              </span>
                            )}
                            {toNumber(row.precio_fob) > 0 && (
                              <button
                                onClick={() => requestFieldUpdate(row, 'fob_total_verified', 'FOB Origen Verificado', !row.fob_total_verified)}
                                className={`p-1 rounded ${row.fob_total_verified ? 'text-green-700' : 'text-yellow-700 hover:text-green-700'}`}
                                title={row.fob_total_verified ? 'Verificado' : 'Marcar como verificado'}
                              >
                                {row.fob_total_verified ? '✓' : '○'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrencyNoDecimals(computeFobUsd(row))}
                        </td>
                        <td className={`relative px-4 py-3 text-sm text-right min-w-[140px] ${(() => {
                          const inlandVal = toNumber(row.inland);
                          if (inlandVal <= 0) return 'text-gray-700';
                          return row.inland_verified ? 'bg-green-100' : 'bg-yellow-100';
                        })()}`}>
                          <div className="flex flex-col gap-1">
                            <ManagementInlineCell 
                              recordId={row.id as string}
                              fieldName="inland"
                              indicators={undefined}
                              openPopover={null}
                              onIndicatorClick={undefined}
                              formatChangeValue={formatChangeValue}
                              getModuleLabel={getModuleLabel}
                            >
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.inland) || ''}
                                placeholder="OCEAN (USD)"
                                displayFormatter={() => {
                                  return formatCurrencyWithSymbolNoDecimals('USD', row.inland);
                                }}
                                onSave={(val) => {
                                  let numeric: number | null;
                                  if (typeof val === 'number') numeric = val;
                                  else if (val === null) numeric = null;
                                  else numeric = Number(val);
                                  return requestFieldUpdate(row, 'inland', 'OCEAN (USD)', numeric);
                                }}
                              />
                            </ManagementInlineCell>
                            <div className="flex items-center justify-end gap-2 relative">
                              {getFieldIndicators(inlineChangeIndicators, row.id as string, 'inland').length > 0 && (
                                <>
                                  <button
                                    type="button"
                                    className="change-indicator-btn inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
                                    title="Ver historial de cambios"
                                    onClick={(e) => handleIndicatorClick(e, row.id as string, 'inland')}
                                  >
                                    <Clock className="w-3 h-3" />
                                  </button>
                                  {openChangePopover?.recordId === row.id && openChangePopover?.fieldName === 'inland' && getFieldIndicators(inlineChangeIndicators, row.id as string, 'inland').length > 0 && (
                                    <div className="change-popover absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left z-30">
                                      <p className="text-xs font-semibold text-gray-500 mb-2">Cambios recientes</p>
                                      <div className="space-y-2 max-h-56 overflow-y-auto">
                                        {getFieldIndicators(inlineChangeIndicators, row.id as string, 'inland').map((log) => {
                                          let displayLabel = log.changedByName;
                                          if (!displayLabel) displayLabel = log.moduleName ? getModuleLabel(log.moduleName) : 'Usuario';
                                          return (
                                            <div key={log.id} className="border border-gray-100 rounded-lg p-2 bg-gray-50 text-left">
                                              <div className="flex items-center justify-between mb-1">
                                                <p className="text-sm font-semibold text-gray-800">{log.fieldLabel}</p>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                                  {displayLabel}
                                                </span>
                                              </div>
                                              <p className="text-xs text-gray-500 mt-1">
                                                Antes:{' '}
                                                <span className="font-mono text-red-600">{formatChangeValue(log.oldValue, log.fieldLabel)}</span>
                                              </p>
                                              <p className="text-xs text-gray-500">
                                                Ahora:{' '}
                                                <span className="font-mono text-green-600">{formatChangeValue(log.newValue, log.fieldLabel)}</span>
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
                                </>
                              )}
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
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
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestFieldUpdate(row, 'inland_verified', 'OCEAN Verificado', !row.inland_verified);
                                  }}
                                  className={`p-1 rounded ${row.inland_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                  title={row.inland_verified ? 'Verificado' : 'Marcar como verificado'}
                                >
                                  {row.inland_verified ? '✓' : '○'}
                                </button>
                              )}
                            </div>
                          </div>

                          {paymentPopoverOpen === row.id && (
                            <div className="absolute right-0 mt-2 w-[600px] max-w-[90vw] z-[100]">
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

                                <div className="p-3 text-xs text-gray-700">
                                  {(() => {
                                    if (paymentLoading) return <div className="py-4 text-center text-gray-500">Cargando pagos...</div>;
                                    if (paymentDetails[row.id as string]) return (
                                    <>
                                      {/* Tabla de Pagos en formato horizontal */}
                                      <div className="mb-4">
                                        <p className="text-[10px] text-gray-500 mb-2 font-semibold uppercase">Pagos</p>
                                        <div>
                                          <table className="w-full border-collapse text-[11px]">
                                            <thead>
                                              <tr className="bg-gray-100 border-b border-gray-300">
                                                <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-r border-gray-300">PAGOS</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-300">MONEDA</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-300">FECHA PAGO</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-r border-gray-300">CONTRAVALOR</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-r border-gray-300">TRM (COP)</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-r border-gray-300">VALOR GIRADO</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-700">COP</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {renderPaymentPagosRows(row.id as string)}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>

                                      {/* Tabla de OCEAN en formato horizontal */}
                                      <div className="mb-4">
                                        <p className="text-[10px] text-gray-500 mb-2 font-semibold uppercase">OCEAN</p>
                                        <div>
                                          <table className="w-full border-collapse text-[11px]">
                                            <thead>
                                              <tr className="bg-gray-100 border-b border-gray-300">
                                                <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-r border-gray-300">OCEAN</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-r border-gray-300">TRM OCEAN (COP)</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-700 border-r border-gray-300">OCEAN USD</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-700">COP</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {renderPaymentOceanRows(row.id as string)}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </>
                                    );
                                    return <div className="py-4 text-center text-gray-500">Sin datos de pago</div>;
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${
                          row.fob_total_verified && row.inland_verified ? 'bg-white text-gray-700' : 'bg-yellow-100 text-gray-700'
                        }`} title={row.fob_total_verified && row.inland_verified ? 'FOB ORIGEN y OCEAN (USD) verificados' : 'Falta verificar FOB ORIGEN y/o OCEAN (USD)'}>
                          {formatCurrencyNoDecimals(computeCifUsd(row))}
                        </td>
                        {/* <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.ocean_cop)}
                        </td> */}
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrencyNoDecimals(row.cif_local ?? computeCifLocal(row, paymentDetails[row.id as string]))}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right min-w-[140px] ${(() => {
                          const gp = toNumber(row.gastos_pto);
                          if (gp <= 0) return 'text-gray-700';
                          return row.gastos_pto_verified ? 'bg-green-100' : 'bg-yellow-100';
                        })()}`}>
                          <div className="flex flex-col gap-1">
                            <ManagementInlineCell {...buildCellProps(row.id as string, 'gastos_pto')}>
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.gastos_pto) || ''}
                                placeholder="Gastos Pto (COP)"
                                displayFormatter={() => formatCurrencyNoDecimals(row.gastos_pto)}
                                onSave={(val) => {
                                  let numeric: number | null;
                                  if (typeof val === 'number') numeric = val;
                                  else if (val === null) numeric = null;
                                  else numeric = Number(val);
                                  return requestFieldUpdate(row, 'gastos_pto', 'Gastos Puerto', numeric);
                                }}
                              />
                            </ManagementInlineCell>
                            {toNumber(row.gastos_pto) > 0 && (
                              <div className="flex items-center justify-end gap-2 mt-1">
                                <button
                                  onClick={() => requestFieldUpdate(row, 'gastos_pto_verified', 'Gastos Puerto Verificado', !row.gastos_pto_verified)}
                                  className={`p-1 rounded ${row.gastos_pto_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                  title={row.gastos_pto_verified ? 'Verificado' : 'Marcar como verificado'}
                                >
                                  {row.gastos_pto_verified ? '✓' : '○'}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right min-w-[180px] ${
                          toNumber(row.flete) > 0 
                            ? 'bg-green-100'
                            : 'text-gray-700'
                        }`}>
                          <div className="flex flex-col gap-1">
                            <ManagementInlineCell {...buildCellProps(row.id as string, 'flete')}>
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.flete) || ''}
                                placeholder="TRASLADOS NACIONALES (COP)"
                                displayFormatter={() => formatCurrencyNoDecimals(row.flete)}
                                onSave={(val) => {
                                  let numeric: number | null;
                                  if (typeof val === 'number') numeric = val;
                                  else if (val === null) numeric = null;
                                  else numeric = Number(val);
                                  return requestFieldUpdate(row, 'flete', 'Traslados Nacionales', numeric);
                                }}
                              />
                            </ManagementInlineCell>
                          </div>
                        </td>
                    {SHOW_TRASLADO_COLUMN && (
                        <td className={`px-4 py-3 text-sm text-right ${(() => {
                          const tr = toNumber(row.traslado);
                          if (tr <= 0) return '';
                          return row.traslado_verified ? 'bg-green-100' : 'bg-yellow-100';
                        })()}`}>
                          <div className="flex flex-col items-end gap-1">
                            <ManagementInlineCell {...buildCellProps(row.id as string, 'traslado')}>
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.traslado) || ''}
                                placeholder="0"
                                displayFormatter={() => formatCurrency(row.traslado)}
                                onSave={(val) => {
                                  let numeric: number | null;
                                  if (typeof val === 'number') numeric = val;
                                  else if (val === null) numeric = null;
                                  else numeric = Number(val);
                                  return requestFieldUpdate(row, 'traslado', 'Traslado', numeric);
                                }}
                              />
                            </ManagementInlineCell>
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
                        <td className={`px-4 py-3 text-sm text-right min-w-[180px] ${(() => {
                          const rep = toNumber(row.repuestos);
                          if (rep <= 0) return 'text-gray-700';
                          return row.repuestos_verified ? 'bg-green-100' : 'bg-yellow-100';
                        })()}`}>
                          <div className="flex flex-col gap-1">
                            <ManagementInlineCell {...buildCellProps(row.id as string, 'repuestos')}>
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.repuestos) || ''}
                                placeholder="PPTO DE REPARACION (COP)"
                                displayFormatter={() => formatCurrencyNoDecimals(row.repuestos)}
                                onSave={(val) => {
                                  let numeric: number | null;
                                  if (typeof val === 'number') numeric = val;
                                  else if (val === null) numeric = null;
                                  else numeric = Number(val);
                                  return requestFieldUpdate(row, 'repuestos', 'PPTO Reparación', numeric);
                                }}
                              />
                            </ManagementInlineCell>
                            {(toNumber(row.repuestos) > 0 || row.service_value) && (
                              <div className="flex items-center justify-end gap-2 mt-1">
                                {toNumber(row.repuestos) > 0 && (
                                  <button
                                    onClick={() => requestFieldUpdate(row, 'repuestos_verified', 'PPTO Reparación Verificado', !row.repuestos_verified)}
                                    className={`p-1 rounded ${row.repuestos_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                                    title={row.repuestos_verified ? 'Verificado' : 'Marcar como verificado'}
                                  >
                                    {row.repuestos_verified ? '✓' : '○'}
                                  </button>
                                )}
                                <div className="relative service-value-popover">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setServiceValuePopover(serviceValuePopover === row.id ? null : row.id as string);
                                    }}
                                    className="service-value-btn p-1 rounded text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    title="Ver Valor de Servicio"
                                  >
                                    <Info className="w-4 h-4" />
                                  </button>
                                  {serviceValuePopover === row.id && (
                                    <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-gray-700">Valor de Servicio</p>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setServiceValuePopover(null);
                                          }}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <p className="text-sm font-bold text-gray-900">
                                        {toNumber(row.service_value) > 0 
                                          ? formatCurrencyNoDecimals(row.service_value)
                                          : <span className="text-gray-400">Sin valor</span>}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Desde módulo de Servicio
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {row.model && (
                              <PriceSuggestion
                                type="repuestos"
                                model={row.model || ''}
                                year={getSuggestionYearValue(row.year)}
                                hours={getSuggestionHoursValue(row.hours)}
                                autoFetch={false}
                                compact={true}
                                forcePopoverPosition="bottom"
                                currentRecordsLabel="Registros App"
                                onApply={(value) => requestFieldUpdate(row, 'repuestos', 'PPTO Reparación', value)}
                              />
                            )}
                          </div>
                        </td>
                        {/* Oculto: VALOR SERVICIO (COP) */}
                        {/* <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          <ManagementInlineCell {...buildCellProps(row.id as string, 'service_value')}>
                            <span className="text-gray-700">{formatCurrencyNoDecimals(row.service_value)}</span>
                          </ManagementInlineCell>
                        </td> */}
                        {/* Oculto: Cost. Arancel (COP) */}
                        {/* <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrencyNoDecimals(row.cost_arancel)}</td> */}

                        {/* CAMPOS MANUALES: Proyecciones - Proyectado oculto por diseño */}
                        <td className="px-4 py-3 text-sm text-gray-700 text-right min-w-[140px]">
                          <div className="flex flex-col gap-1">
                            <ManagementInlineCell {...buildCellProps(row.id as string, 'pvp_est')}>
                              <InlineFieldEditor
                                type="number"
                                value={toNumber(row.pvp_est) || ''}
                                placeholder="PVP Est."
                                displayFormatter={() => formatCurrencyNoDecimals(row.pvp_est)}
                                onSave={(val) => {
                                  let numeric: number | null;
                                  if (typeof val === 'number') numeric = val;
                                  else if (val === null) numeric = null;
                                  else numeric = Number(val);
                                  return requestFieldUpdate(row, 'pvp_est', 'PVP Estimado', numeric);
                                }}
                              />
                            </ManagementInlineCell>
                            {row.model && (
                              <PriceSuggestion
                                type="pvp"
                                model={row.model || ''}
                                year={getSuggestionYearValue(row.year)}
                                hours={getSuggestionHoursValue(row.hours)}
                                costoArancel={row.cost_arancel}
                                autoFetch={false}
                                compact={true}
                                forcePopoverPosition="bottom"
                                currentRecordsLabel="Registros App"
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
                                  <button
                                    type="button"
                                    className="fixed inset-0 z-40 w-full h-full border-0 bg-transparent cursor-default"
                                    aria-label="Cerrar comentarios"
                                    onClick={() => setServiceCommentsPopover(null)}
                                    onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setServiceCommentsPopover(null); }}
                                    style={{ backgroundColor: 'transparent' }}
                                  />
                                  <button
                                    type="button"
                                    aria-label="Comentarios de servicio"
                                    className="comments-popover absolute z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 text-left block focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                    style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, transform: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
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
                                        onChange={(e) => handleServiceCommentChange(row.id as string, e.target.value)}
                                        placeholder="Escribir comentarios de servicio..."
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22] resize-none"
                                        rows={4}
                                      />
                                      <div className="flex gap-2 mt-2">
                                        <button
                                          onClick={() => handleSaveServiceComments(row)}
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
                                  </button>
                                </>
                              )}
                              {/* Popover Comentarios Comercial */}
                              {commercialCommentsPopover === row.id && (
                                <>
                                  <button
                                    type="button"
                                    className="fixed inset-0 z-40 w-full h-full border-0 bg-transparent cursor-default"
                                    aria-label="Cerrar comentarios"
                                    onClick={() => setCommercialCommentsPopover(null)}
                                    onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setCommercialCommentsPopover(null); }}
                                    style={{ backgroundColor: 'transparent' }}
                                  />
                                  <button
                                    type="button"
                                    aria-label="Comentarios comercial"
                                    className="comments-popover absolute z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 text-left block focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                    style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, transform: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
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
                                        onChange={(e) => handleCommercialCommentChange(row.id as string, e.target.value)}
                                        placeholder="Escribir comentarios comerciales..."
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#cf1b22] focus:border-[#cf1b22] resize-none"
                                        rows={4}
                                      />
                                      <div className="flex gap-2 mt-2">
                                        <button
                                          onClick={() => handleSaveCommercialComments(row)}
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
                                  </button>
                                </>
                              )}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 sticky right-0 bg-white border-l-2 border-gray-200 z-30">
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
                    ));
                  })()}
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
                      {currentRow.model} - S/N {getMachineSerialForDisplay(currentRow.serial)}
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
                              {(() => {
                              if (currentRow.spec_pip === true || currentRow.wet_line === 'SI') return 'SI';
                              if (currentRow.spec_pip === false || currentRow.wet_line === 'No') return 'NO';
                              return '-';
                            })()}
                            </span>
                          </span>
                        )}
                        {(currentRow.spec_blade !== undefined || currentRow.blade) && (
                          <span className="flex items-center gap-0.5 bg-white/10 px-1.5 py-0.5 rounded">
                            <span className="text-red-200/70">Blade:</span>
                            <span className="font-medium">
                              {(() => {
                              if (currentRow.spec_blade === true || currentRow.blade === 'SI') return 'SI';
                              if (currentRow.spec_blade === false || currentRow.blade === 'No') return 'NO';
                              return '-';
                            })()}
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
                  <p className="text-sm font-bold text-[#50504f]">{formatCurrencyWithSymbolNoDecimals(currentRow.currency, currentRow.precio_fob)}</p>
                  </div>
                <div className="text-center border-x border-gray-200">
                  <p className="text-[10px] text-gray-500 mb-0.5">CIF USD</p>
                  <p className="text-sm font-bold text-[#50504f]">{formatCurrencyNoDecimals(currentRow.cif_usd)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 mb-0.5">CIF LOCAL</p>
                  <p className="text-sm font-bold text-[#50504f]">{formatCurrencyNoDecimals(currentRow.cif_local)}</p>
                </div>
              </div>

              {/* GASTOS OPERACIONALES */}
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <h4 className="text-xs font-semibold text-[#50504f] mb-2 pb-1.5 border-b border-gray-100">
                  GASTOS OPERACIONALES
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="edit-inland" className="block text-[10px] font-medium text-gray-600 mb-0.5">OCEAN</label>
                    <input
                      id="edit-inland"
                      type="text" 
                      value={getInputValue('inland', editData.inland)} 
                      onChange={(e) => {
                        setLocalInputValues(prev => ({...prev, inland: e.target.value}));
                      }} 
                      onFocus={() => {
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
                    <label htmlFor="edit-gastos-pto" className="block text-[10px] font-medium text-gray-600 mb-0.5">Gastos Pto</label>
                    <input
                      id="edit-gastos-pto"
                      type="text" 
                      value={getInputValue('gastos_pto', editData.gastos_pto)} 
                      onChange={(e) => {
                        setLocalInputValues(prev => ({...prev, gastos_pto: e.target.value}));
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
                    <label htmlFor="edit-flete" className="block text-[10px] font-medium text-gray-600 mb-0.5">Traslados Nacionales</label>
                    <input
                      id="edit-flete"
                      type="text" 
                      value={getInputValue('flete', editData.flete)} 
                      onChange={(e) => {
                        setLocalInputValues(prev => ({...prev, flete: e.target.value}));
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
                    <label htmlFor="edit-service-value" className="block text-[10px] font-medium text-gray-600 mb-0.5">Valor Servicio</label>
                    <span id="edit-service-value" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 text-gray-500 block">{formatCurrencyNoDecimals(editData.service_value) || '-'}</span>
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
                      <label htmlFor="edit-repuestos" className="block text-[10px] font-medium text-gray-600 mb-0.5">PPTO Reparación</label>
                      <input
                        id="edit-repuestos"
                        type="text" 
                        value={getInputValue('repuestos', editData.repuestos)} 
                        onChange={(e) => {
                          setLocalInputValues(prev => ({...prev, repuestos: e.target.value}));
                        }} 
                        onFocus={() => {
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
                    {currentRow?.model && (
                        <div className="mt-1">
                        <PriceSuggestion
                          type="repuestos"
                          model={currentRow.model || ''}
                          year={getSuggestionYearValue(currentRow.year)}
                          hours={getSuggestionHoursValue(currentRow.hours)}
                          autoFetch={false}
                            compact={true}
                            forcePopoverPosition="bottom"
                          currentRecordsLabel="Registros App"
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
                      <label htmlFor="edit-pvp-est" className="block text-[10px] font-medium text-gray-600 mb-0.5">PVP Estimado</label>
                      <input
                        id="edit-pvp-est"
                        type="text" 
                        value={getInputValue('pvp_est', editData.pvp_est)} 
                        onChange={(e) => {
                          setLocalInputValues(prev => ({...prev, pvp_est: e.target.value}));
                        }} 
                        onFocus={() => {
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
                    {currentRow?.model && (
                        <div className="mt-1">
                        <PriceSuggestion
                          type="pvp"
                          model={currentRow.model || ''}
                          year={getSuggestionYearValue(currentRow.year)}
                          hours={getSuggestionHoursValue(currentRow.hours)}
                          costoArancel={currentRow.cost_arancel}
                          autoFetch={false}
                            compact={true}
                            forcePopoverPosition="bottom"
                          currentRecordsLabel="Registros App"
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
                  <p className="text-sm font-bold text-[#cf1b22]">{formatCurrencyNoDecimals(currentRow.cost_arancel)}</p>
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
                  <p className="text-sm font-semibold font-mono">{getMachineSerialForDisplay(viewRow.serial) || '-'}</p>
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
                  <p className="text-sm font-semibold">{formatTipoCompra(viewRow.tipo_compra)}</p>
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
                  <p className="text-sm font-bold text-indigo-700">{formatCurrencyWithSymbolNoDecimals(viewRow.currency, viewRow.precio_fob)}</p>
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
                  <p className="text-sm font-semibold">{formatCurrencyNoDecimals(viewRow.cif_usd)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CIF Local</p>
                  <p className="text-sm font-semibold">{formatCurrencyNoDecimals(viewRow.cif_local)}</p>
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
                  <p className="text-sm font-semibold">{formatCurrencyNoDecimals(viewRow.inland)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gastos Pto</p>
                  <p className="text-sm font-semibold">{formatCurrencyNoDecimals(viewRow.gastos_pto)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Traslados Nacionales</p>
                  <p className="text-sm font-semibold">{formatCurrencyNoDecimals(viewRow.flete)}</p>
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
                  <p className="text-sm font-semibold">{formatCurrencyNoDecimals(viewRow.repuestos)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Valor Servicio</p>
                  <p className="text-sm font-semibold">{formatCurrencyNoDecimals(viewRow.service_value)}</p>
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
                        const v = typeof val === 'string' ? Number.parseFloat(val) : (val as number) || 0;
                        return Number.isNaN(v) ? 0 : v;
                      };
                      const total = sum(viewRow.inland) + sum(viewRow.gastos_pto) + sum(viewRow.flete) + sum(viewRow.traslado) + sum(viewRow.repuestos) + sum(viewRow.service_value);
                      return total > 0 ? `$${total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cost. Arancel</p>
                  <p className="text-sm font-semibold">{formatCurrencyNoDecimals(viewRow.cost_arancel)}</p>
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
                  <p className="text-sm font-semibold">{formatCurrencyNoDecimals(viewRow.pvp_est)}</p>
                </div>
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
                                  setSelectedPhotoIndex((prev) => {
                                    if (prev === null) return 0;
                                    if (prev === 0) return allPhotos.length - 1;
                                    return prev - 1;
                                  });
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
                    setSelectedPhotoIndex((prev) => {
                      if (prev === null) return 0;
                      if (prev === allPhotos.length - 1) return 0;
                      return prev + 1;
                    });
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
        onBrandsChange={() => {}}
        onModelsChange={(models) => setDynamicModels(models)}
        favoriteBrands={favoriteBrands}
        onFavoriteBrandsChange={(brands) => {
          setFavoriteBrands(brands);
          localStorage.setItem('favoriteBrands_management', JSON.stringify(brands));
        }}
        contextLabel="Management"
      />

      <AutoCostManager
        isOpen={isAutoCostManagerOpen}
        onClose={() => setIsAutoCostManagerOpen(false)}
      />

      </div>
    </div>
  );
};
