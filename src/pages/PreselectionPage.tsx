/**
 * Página de Preselección - Módulo previo a Subastas
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Download, Calendar, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, Save, X, Layers, Trash2, Package, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Modal } from '../molecules/Modal';
import { Select } from '../atoms/Select';
import { PreselectionWithRelations, PreselectionDecision } from '../types/database';
import { PreselectionForm, AUCTION_SUPPLIERS } from '../organisms/PreselectionForm';
import { usePreselections } from '../hooks/usePreselections';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../components/Toast';
import { useBatchModeGuard } from '../hooks/useBatchModeGuard';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { MachineSpecDefaultsModal } from '../organisms/MachineSpecDefaultsModal';
import { PriceSuggestion } from '../components/PriceSuggestion';
import { BrandModelManager } from '../components/BrandModelManager';
import { apiPost, apiGet } from '../services/api';
import { BRAND_OPTIONS } from '../constants/brands';
import { MODEL_OPTIONS } from '../constants/models';
import { getModelsForBrand } from '../utils/brandModelMapping';
import { MACHINE_TYPE_OPTIONS, MACHINE_TYPE_OPTIONS_PRESELECTION_CONSOLIDADO_COMPRAS, formatMachineType } from '../constants/machineTypes';
import { formatChangeValue } from '../utils/formatChangeValue';
import { getShoeWidthConfigForModel } from '../constants/shoeWidthConfig';

const CITY_OPTIONS = [
  { value: 'TOKYO', label: 'Tokio, Japón (GMT+9)', offset: 9 },
  { value: 'LEEDS_UK', label: 'Leeds, UK (GMT+0)', offset: 0 },
  { value: 'BERLIN', label: 'Berlin, Germany (GMT+1)', offset: 1 },
  { value: 'ON_CANADA', label: 'ON, Canada (GMT-5)', offset: -5 },
  { value: 'BEIJING', label: 'Beijing, China (GMT+8)', offset: 8 },
  { value: 'NEW_YORK', label: 'Nueva York, USA (GMT-5)', offset: -5 }, // Mantener para compatibilidad con registros antiguos
];

// Proveedores que pueden elegir entre PARADE/LIVE, INTERNET o TENDER
const MULTI_AUCTION_TYPE_SUPPLIERS = [
  'GREEN', 'GUIA', 'HCMJ', 'JEN', 'KANEHARU', 'KIXNET', 'NORI', 'ONAGA', 
  'SOGO', 'THI', 'TOZAI', 'WAKITA', 'YUMAC', 'AOI'
];

// Mapeo de proveedores a sus valores predeterminados (moneda, ubicación, ciudad, tipo de subasta)
const SUPPLIER_DEFAULTS: Record<string, { currency: string; location: string; city: string; auction_type: string }> = {
  'GREEN': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'GUIA': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'HCMJ': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'JEN': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'KANEHARU': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'KIXNET': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'NORI': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'ONAGA': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'SOGO': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'THI': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'TOZAI': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'WAKITA': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'YUMAC': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'AOI': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'NDT': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'PARADE/LIVE' },
  'EUROAUCTIONS / UK': { currency: 'GBP', location: 'United Kingdom', city: 'LEEDS_UK', auction_type: 'PARADE/LIVE' },
  'EUROAUCTIONS / GER': { currency: 'EUR', location: 'Germany', city: 'BERLIN', auction_type: 'PARADE/LIVE' },
  'RITCHIE / USA / PE USA': { currency: 'USD', location: 'USA', city: 'NEW_YORK', auction_type: 'PARADE/LIVE' },
  'RITCHIE / CAN / PE USA': { currency: 'CAD', location: 'Canada', city: 'ON_CANADA', auction_type: 'PARADE/LIVE' },
  'ROYAL - PROXY / USA / PE USA': { currency: 'USD', location: 'USA', city: 'NEW_YORK', auction_type: 'PARADE/LIVE' },
  'ACME / USA / PE USA': { currency: 'USD', location: 'USA', city: 'NEW_YORK', auction_type: 'DIRECTO' },
  'GDF': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'DIRECTO' },
  'GOSHO': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'DIRECTO' },
  'JTF': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'DIRECTO' },
  'KATAGIRI': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'DIRECTO' },
  'MONJI': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'DIRECTO' },
  'REIBRIDGE': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'DIRECTO' },
  'IRON PLANET / USA / PE USA': { currency: 'USD', location: 'USA', city: 'NEW_YORK', auction_type: 'DIRECTO' },
  'SHOJI': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'DIRECTO' },
  'YIWU ELI TRADING COMPANY / CHINA': { currency: 'USD', location: 'China', city: 'BEIJING', auction_type: 'DIRECTO' },
  'E&F / USA / PE USA': { currency: 'USD', location: 'USA', city: 'NEW_YORK', auction_type: 'DIRECTO' },
  'DIESEL': { currency: 'JPY', location: 'Japón', city: 'TOKYO', auction_type: 'DIRECTO' },
};

const COLOMBIA_TIMEZONE = 'America/Bogota';

// Generar opciones de año desde 2010 hasta año actual + 1
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2009 }, (_, i) => {
  const year = 2010 + i;
  return { value: year.toString(), label: year.toString() };
});

const getCityMeta = (city?: string | number | null) => {
  if (typeof city !== 'string') return undefined;
  return CITY_OPTIONS.find((option) => option.value === city);
};

// Función para obtener las opciones de tipo de subasta según el proveedor
const getAuctionTypeOptions = (supplierName?: string | null) => {
  if (!supplierName) {
    // Si no hay proveedor, mostrar todas las opciones
    return [
      { value: 'PARADE/LIVE', label: 'PARADE/LIVE' },
      { value: 'INTERNET', label: 'INTERNET' },
      { value: 'TENDER', label: 'TENDER' },
      { value: 'DIRECTO', label: 'DIRECTO' },
    ];
  }
  
  // Si el proveedor está en la lista de multi-opción, permitir elegir entre PARADE/LIVE, INTERNET o TENDER
  if (MULTI_AUCTION_TYPE_SUPPLIERS.includes(supplierName)) {
    return [
      { value: 'PARADE/LIVE', label: 'PARADE/LIVE' },
      { value: 'INTERNET', label: 'INTERNET' },
      { value: 'TENDER', label: 'TENDER' },
    ];
  }
  
  // Para otros proveedores, usar el tipo de subasta predeterminado según SUPPLIER_DEFAULTS
  const defaults = SUPPLIER_DEFAULTS[supplierName];
  if (defaults) {
    return [{ value: defaults.auction_type, label: defaults.auction_type }];
  }
  
  // Si no hay defaults, mostrar todas las opciones
  return [
    { value: 'PARADE/LIVE', label: 'PARADE/LIVE' },
    { value: 'INTERNET', label: 'INTERNET' },
    { value: 'TENDER', label: 'TENDER' },
    { value: 'DIRECTO', label: 'DIRECTO' },
  ];
};

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

const buildUtcDateFromLocal = (dateIso?: string | null, time?: string | null, city?: string | null) => {
  if (!dateIso) return null;
  const baseDate = new Date(dateIso);
  if (Number.isNaN(baseDate.getTime())) return null;
  const [hour, minute] = time ? time.split(':').map((part) => Number(part)) : [0, 0];
  const meta = getCityMeta(city);
  const cityOffset = meta?.offset ?? 0;

  const utcMs =
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate(),
      Number.isNaN(hour) ? 0 : hour,
      Number.isNaN(minute) ? 0 : minute
    ) - cityOffset * 60 * 60 * 1000;

  return new Date(utcMs);
};

const resolveColombiaDate = (
  colombiaTime?: string | null,
  auctionDate?: string | null,
  localTime?: string | null,
  city?: string | null
) => {
  if (colombiaTime) {
    const stored = new Date(colombiaTime);
    if (!Number.isNaN(stored.getTime())) {
      return stored;
    }
  }
  return buildUtcDateFromLocal(auctionDate, localTime, city);
};

const formatStoredColombiaTime = (
  colombiaTime?: string | null,
  auctionDate?: string | null,
  localTime?: string | null,
  city?: string | null
) => {
  const date = resolveColombiaDate(colombiaTime, auctionDate, localTime, city);
  if (!date) return 'Define fecha, hora y ciudad';

  // El backend ya calcula la hora de Colombia correctamente y devuelve una fecha ISO en UTC
  // que representa la hora de Colombia. El problema es que cuando parseamos una fecha ISO UTC
  // y luego aplicamos timeZone: 'America/Bogota', está aplicando otra conversión.
  // 
  // Solución: Extraer los componentes UTC de la fecha y formatearlos directamente
  // sin aplicar conversión de zona horaria, ya que el backend ya hizo el cálculo correcto.
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  
  // Crear una fecha usando los componentes UTC directamente (sin conversión)
  const colombiaDate = new Date(Date.UTC(year, month, day, hours, minutes));
  
  // Formatear sin aplicar timeZone porque el backend ya calculó la hora de Colombia
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC', // Usar UTC para evitar conversión adicional
  }).format(colombiaDate);
};

const buildColombiaDateKey = (presel: PreselectionWithRelations) => {
  const colombiaDate = resolveColombiaDate(
    presel.colombia_time,
    presel.auction_date,
    presel.local_time,
    presel.auction_city
  );
  if (!colombiaDate) {
    const fallback = (presel.auction_date || '').split('T')[0] || 'SIN_FECHA';
    return { key: fallback, colombiaDate: null };
  }
  // Incluir fecha Y hora en la clave para que cada tarjeta sea independiente
  // Formato: YYYY-MM-DD_HH:mm
  const dateString = colombiaDate.toISOString().split('T')[0];
  const timeString = colombiaDate.toISOString().split('T')[1].substring(0, 5); // HH:mm
  return { key: `${dateString}_${timeString}`, colombiaDate };
};

const getAuctionStatusStyle = (status?: string | null) => {
  if (!status) {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200';
  }
  const upper = status.toUpperCase();
  if (upper === 'GANADA') {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow';
  }
  if (upper === 'PERDIDA') {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-rose-500 to-red-500 text-white shadow';
  }
  if (upper === 'PENDIENTE') {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow';
  }
  if (upper === 'RECHAZADA') {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-slate-500 to-gray-600 text-white shadow';
  }
  return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200';
};

const resolveAuctionStatusLabel = (presel: PreselectionWithRelations): string => {
  if (presel.auction_status) return presel.auction_status;
  if (presel.decision === 'NO') return 'RECHAZADA';
  return 'PENDIENTE';
};

const buildPlaceholderSerial = () => `SN-${Date.now().toString().slice(-5)}`;
const buildPlaceholderLot = () => `TMP-${Date.now().toString().slice(-4)}`;

const toNumberOrNull = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

export const PreselectionPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSpecDefaultsModalOpen, setIsSpecDefaultsModalOpen] = useState(false);
  const [isBrandModelManagerOpen, setIsBrandModelManagerOpen] = useState(false);
  const [dynamicBrands, setDynamicBrands] = useState<string[]>([]);
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [favoriteBrands, setFavoriteBrands] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('favoriteBrands_preselection');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [selectedPreselection, setSelectedPreselection] = useState<PreselectionWithRelations | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<PreselectionDecision | ''>('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [quickCreateDate, setQuickCreateDate] = useState('');
  const [quickCreateTime, setQuickCreateTime] = useState('');
  const [quickCreateCity, setQuickCreateCity] = useState('');
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [addingMachineFor, setAddingMachineFor] = useState<string | null>(null);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { preselId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());
  const pendingChangeRef = useRef<{
    preselId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);
  const [specsPopoverOpen, setSpecsPopoverOpen] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState<string | null>(null);
  const [priceSuggestionPopoverOpen, setPriceSuggestionPopoverOpen] = useState<Record<string, boolean>>({});
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null); // Rastrear qué registro está siendo editado
  
  // Helper para obtener callbacks de edición
  const getEditCallbacks = (recordId: string) => ({
    onEditStart: () => setEditingRecordId(recordId),
    onEditEnd: () => setEditingRecordId(null),
  });
  
  const [editingSpecs, setEditingSpecs] = useState<Record<string, {
    shoe_width_mm: number | null;
    spec_cabin: string;
    arm_type: string;
    spec_pip: boolean;
    spec_blade: boolean;
    spec_pad: string;
  }>>({});
  
  // Estado para almacenar especificaciones por defecto por marca/modelo
  const [defaultSpecsCache, setDefaultSpecsCache] = useState<Record<string, {
    spec_blade?: boolean;
    spec_pip?: boolean;
    spec_cabin?: string;
    arm_type?: string;
    shoe_width_mm?: number;
  }>>({});

  const { user } = useAuth();
  
  const {
    preselections,
    isLoading,
    updateDecision,
    updatePreselectionFields,
    createPreselection,
    deletePreselection,
    mutatePreselections,
  } = usePreselections();

  // Helper para verificar si el usuario puede eliminar tarjetas
  const canDeleteCards = () => {
    if (!user?.email) return false;
    const userEmail = user.email.toLowerCase();
    return userEmail === 'admin@partequipos.com' || 
           userEmail === 'sebastian@partequipos.com' ||
           userEmail === 'sdonado@partequiposusa.com' || 
           userEmail === 'pcano@partequipos.com' ||
           userEmail === 'gerencia@partequipos.com' ||
           user?.role === 'gerencia';
  };

  // Handler para eliminar tarjeta
  const handleDeletePreselection = async (preselId: string, preselInfo: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar esta tarjeta?\n\n${preselInfo}\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await deletePreselection(preselId);
      showSuccess('Tarjeta eliminada exitosamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar la tarjeta';
      showError(message);
    }
  };

  // Cargar indicadores de cambios desde el backend
  useEffect(() => {
    const loadChangeIndicators = async () => {
      if (preselections.length === 0) return;
      
      try {
        const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
        
        // Cargar cambios para cada preselección
        await Promise.all(
          preselections.map(async (presel) => {
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
              }>>(`/api/change-logs/preselections/${presel.id}`);
              
              if (changes && changes.length > 0) {
                indicatorsMap[presel.id] = changes.slice(0, 10).map((change) => ({
                  id: change.id,
                  fieldName: change.field_name,
                  fieldLabel: change.field_label,
                  oldValue: change.old_value,
                  newValue: change.new_value,
                  reason: change.change_reason || undefined,
                  changedAt: change.changed_at,
                  moduleName: change.module_name || undefined,
                }));
              }
            } catch {
              // Silenciar errores individuales (puede que no haya cambios)
              console.debug('No se encontraron cambios para preselección:', presel.id);
            }
          })
        );
        
        setInlineChangeIndicators(indicatorsMap);
      } catch (error) {
        console.error('Error al cargar indicadores de cambios:', error);
      }
    };
    
    if (!isLoading && preselections.length > 0) {
      loadChangeIndicators();
    }
  }, [preselections, isLoading]);
  const supplierOptions = AUCTION_SUPPLIERS.map((supplier) => ({
    value: supplier,
    label: supplier,
  }));

  const citySelectOptions = useMemo(
    () => CITY_OPTIONS.map(({ value, label }) => ({ value, label })),
    []
  );
  // Estado para almacenar las combinaciones marca-modelo indexadas
  const [brandModelMap, setBrandModelMap] = useState<Record<string, string[]>>({});
  
  // Cargar marcas y modelos desde la API (para compatibilidad)
  useEffect(() => {
    const loadBrandsAndModels = async () => {
      try {
        const [brandsData, modelsData] = await Promise.all([
          apiGet<Array<{ name: string }>>('/api/brands-and-models/brands').catch(() => []),
          apiGet<Array<{ name: string }>>('/api/brands-and-models/models').catch(() => [])
        ]);
        
        setDynamicBrands(brandsData.map(b => b.name));
        setDynamicModels(modelsData.map(m => m.name));
      } catch (error) {
        console.error('Error al cargar marcas y modelos:', error);
        // Fallback a constantes si falla la API
        setDynamicBrands(BRAND_OPTIONS as unknown as string[]);
        setDynamicModels(MODEL_OPTIONS as unknown as string[]);
      }
    };

    const loadBrandModelCombinations = async () => {
      try {
        const combinations = await apiGet<Record<string, string[]>>('/api/brands-and-models/combinations').catch(() => ({}));
        setBrandModelMap(combinations);
      } catch (error) {
        console.error('Error al cargar combinaciones marca-modelo:', error);
        setBrandModelMap({});
      }
    };
    
    loadBrandsAndModels();
    loadBrandModelCombinations();
  }, [isBrandModelManagerOpen]); // Recargar cuando se cierre el gestor

  // Combinar constantes con datos dinámicos (eliminar duplicados)
  const allBrands = useMemo(() => {
    const combined = [...BRAND_OPTIONS, ...dynamicBrands];
    return Array.from(new Set(combined)).sort();
  }, [dynamicBrands]);

  // Obtener todas las marcas únicas de las combinaciones
  const allBrandsFromCombinations = useMemo(() => {
    const brands = Object.keys(brandModelMap);
    const combined = [...allBrands, ...brands];
    return Array.from(new Set(combined)).sort();
  }, [allBrands, brandModelMap]);

  const brandSelectOptions = useMemo(
    () => {
      let list = [...allBrandsFromCombinations];
      if (favoriteBrands.length > 0) {
        list = list.filter((b) => favoriteBrands.includes(b));
      }
      return list.map((brand) => ({ value: brand, label: brand }));
    },
    [allBrandsFromCombinations, favoriteBrands]
  );

  // Todos los modelos (para cuando no hay marca seleccionada)
  const allModels = useMemo(() => {
    const combined = [...MODEL_OPTIONS, ...dynamicModels];
    return Array.from(new Set(combined)).sort();
  }, [dynamicModels]);

  // Función para obtener modelos filtrados por marca (usando patrones y datos de BD)
  const getModelOptionsForBrand = useCallback((brand: string | null | undefined): Array<{ value: string; label: string }> => {
    if (!brand) {
      // Si no hay marca seleccionada, mostrar todos los modelos
      return allModels.map((model) => ({ value: model, label: model }));
    }

    // Usar la función helper que combina datos de BD y patrones
    const modelsForBrand = getModelsForBrand(brand, brandModelMap, allModels);
    
    return modelsForBrand.map((model) => ({ value: model, label: model }));
  }, [brandModelMap, allModels]);


const handleQuickCreate = async () => {
  if (!quickCreateDate || !quickCreateTime || !quickCreateCity) {
    showError('Completa fecha, hora y ciudad para crear la tarjeta');
    return;
  }

  setQuickCreateLoading(true);
  try {
    // Buscar el auction_type del grupo si existe uno con esa fecha
    let auctionType = null;
    const { key: dateKey } = buildColombiaDateKey({ auction_date: quickCreateDate, local_time: quickCreateTime, auction_city: quickCreateCity } as PreselectionWithRelations);
    const group = groupedPreselections.find(g => g.date === dateKey);
    if (group && group.preselections.length > 0) {
      // Buscar el primer registro del grupo que tenga auction_type
      const preselWithType = group.preselections.find(p => p.auction_type);
      if (preselWithType) {
        auctionType = preselWithType.auction_type;
      }
    }
    
    const suffix = Date.now().toString().slice(-5);
    const payload: Partial<PreselectionWithRelations> = {
      supplier_name: 'PENDIENTE',
      auction_date: quickCreateDate,
      lot_number: `TMP-${suffix}`,
      machine_type: 'Excavadora',
      model: 'ZX',
      serial: `SN-${suffix}`,
      local_time: quickCreateTime,
      auction_city: quickCreateCity,
      brand: 'HITACHI',
      auction_type: auctionType,
      year: null,
      hours: null,
      suggested_price: null,
      auction_url: null,
      comments: null,
    };

    const created = await createPreselection(payload);
    const { key: createdDateKey } = buildColombiaDateKey(created);
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.add(createdDateKey);
      return next;
    });
    setQuickCreateDate('');
    setQuickCreateTime('');
    setQuickCreateCity('');
    showSuccess('Tarjeta creada. Completa la información desde la vista.');
  } catch (error) {
    console.error('Quick preselection creation failed:', error);
    const message = error instanceof Error ? error.message : 'No se pudo crear la preselección rápida';
    showError(message);
  } finally {
    setQuickCreateLoading(false);
  }
};

const handleAddMachineToGroup = async (dateKey: string, template?: PreselectionWithRelations | null) => {
  if (!dateKey) return;
  setAddingMachineFor(dateKey);
  try {
    // Buscar el auction_type del grupo si no viene en el template
    let auctionType = template?.auction_type || null;
    if (!auctionType) {
      const group = groupedPreselections.find(g => g.date === dateKey);
      if (group && group.preselections.length > 0) {
        // Buscar el primer registro del grupo que tenga auction_type
        const preselWithType = group.preselections.find(p => p.auction_type);
        if (preselWithType) {
          auctionType = preselWithType.auction_type;
        }
      }
    }
    
    const payload: Partial<PreselectionWithRelations> = {
      supplier_name: template?.supplier_name || 'PENDIENTE',
      auction_date: template?.auction_date || dateKey,
      lot_number: buildPlaceholderLot(),
      machine_type: template?.machine_type || 'Excavadora',
      brand: 'HITACHI',
      model: 'ZX',
      serial: buildPlaceholderSerial(),
      year: null,
      hours: null,
      suggested_price: null,
      final_price: null,
      auction_url: template?.auction_url || null,
      currency: template?.currency || 'USD',
      location: template?.location || null,
      local_time: template?.local_time || null,
      auction_city: template?.auction_city || null,
      auction_type: auctionType,
      shoe_width_mm: null,
      spec_pip: false,
      spec_blade: false,
      spec_pad: null,
      spec_cabin: null,
      arm_type: null,
    };

    const created = await createPreselection(payload);
    const { key: createdDateKey } = buildColombiaDateKey(created);
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.add(createdDateKey);
      return next;
    });
    showSuccess('Equipo agregado. Completa los datos en la tarjeta.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo agregar el equipo';
    showError(message);
  } finally {
    setAddingMachineFor(null);
  }
};

  const queueInlineChange = (
    preselId: string,
    updates: Record<string, unknown>,
    changeItem: InlineChangeItem
  ) => {
    // Si el modo batch está activo, acumular cambios en lugar de abrir el modal
    if (batchModeEnabled) {
      setPendingBatchChanges((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(preselId);
        
        if (existing) {
          // Combinar updates y agregar el nuevo cambio
          const mergedUpdates = { ...existing.updates, ...updates };
          const mergedChanges = [...existing.changes, changeItem];
          newMap.set(preselId, {
            preselId,
            updates: mergedUpdates,
            changes: mergedChanges,
          });
        } else {
          newMap.set(preselId, {
            preselId,
            updates,
            changes: [changeItem],
          });
        }
        
        return newMap;
      });
      
      // En modo batch, guardar en BD inmediatamente para reflejar cambios visualmente
      // pero NO registrar en control de cambios hasta que se confirme
      // updatePreselectionFields ya actualiza el estado local, no necesitamos refetch
      return updatePreselectionFields(preselId, updates as Partial<PreselectionWithRelations>)
        .catch((error) => {
          console.error('Error guardando cambio en modo batch:', error);
          throw error;
        });
    }
    
    // Modo normal: abrir modal inmediatamente
    return new Promise<void>((resolve, reject) => {
      pendingChangeRef.current = {
        preselId,
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
    
    // Si es modo batch, usar la función especial
    if (pending.preselId === 'BATCH_MODE') {
      await confirmBatchChanges(reason);
      return;
    }
    
    try {
      await handleSaveWithToasts(() =>
        updatePreselectionFields(pending.preselId, pending.updates as Partial<PreselectionWithRelations>)
      );
      await apiPost('/api/change-logs', {
        table_name: 'preselections',
        record_id: pending.preselId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'preseleccion',
      });
      const indicator: InlineChangeIndicator = {
        id: `${pending.preselId}-${Date.now()}`,
        fieldName: pending.changes[0].field_name,
        fieldLabel: pending.changes[0].field_label,
        oldValue: pending.changes[0].old_value,
        newValue: pending.changes[0].new_value,
        reason,
        changedAt: new Date().toISOString(),
      };
      setInlineChangeIndicators((prev) => ({
        ...prev,
        [pending.preselId]: [indicator, ...(prev[pending.preselId] || [])].slice(0, 10),
      }));
      pendingResolveRef.current?.();
    } catch (error) {
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

  const beginInlineChange = (
    presel: PreselectionWithRelations,
    fieldName: string,
    fieldLabel: string,
    oldValue: string | number | boolean | null,
    newValue: string | number | boolean | null,
    updates: Record<string, unknown>
  ) => {
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) {
      return Promise.resolve();
    }
    return queueInlineChange(presel.id, updates, {
      field_name: fieldName,
      field_label: fieldLabel,
      old_value: mapValueForLog(oldValue),
      new_value: mapValueForLog(newValue),
    });
  };

  const buildCellProps = (recordId: string, field: string) => ({
    recordId,
    fieldName: field,
    indicators: getFieldIndicators(inlineChangeIndicators, recordId, field),
    openPopover: openChangePopover,
    onIndicatorClick: handleIndicatorClick,
  });

  const handleSaveWithToasts = async (action: () => Promise<unknown>) => {
    try {
      await action();
      if (!batchModeEnabled) {
        showSuccess('Dato actualizado');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el dato';
      showError(message);
      throw error;
    }
  };

  // Función para confirmar cambios batch (llamada desde handleConfirmInlineChange)
  const confirmBatchChanges = async (reason?: string) => {
    // Recuperar datos del estado
    const allUpdatesByPresel = new Map<string, { preselId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>();
    const allChanges: InlineChangeItem[] = [];
    
    pendingBatchChanges.forEach((batch) => {
      allChanges.push(...batch.changes);
      allUpdatesByPresel.set(batch.preselId, batch);
    });

    try {
      // Solo registrar cambios en el log (los datos ya están guardados en BD)
      const logPromises = Array.from(allUpdatesByPresel.values()).map(async (batch) => {
        // Registrar cambios en el log
        await apiPost('/api/change-logs', {
          table_name: 'preselections',
          record_id: batch.preselId,
          changes: batch.changes,
          change_reason: reason || null,
          module_name: 'preseleccion',
        });

        // Actualizar indicadores
        batch.changes.forEach((change) => {
          const indicator: InlineChangeIndicator = {
            id: `${batch.preselId}-${change.field_name}-${Date.now()}`,
            fieldName: change.field_name,
            fieldLabel: change.field_label,
            oldValue: change.old_value,
            newValue: change.new_value,
            reason,
            changedAt: new Date().toISOString(),
          };
          setInlineChangeIndicators((prev) => ({
            ...prev,
            [batch.preselId]: [indicator, ...(prev[batch.preselId] || [])].slice(0, 10),
          }));
        });
      });

      await Promise.all(logPromises);
      
      // Limpiar cambios pendientes
      setPendingBatchChanges(new Map());
      setChangeModalOpen(false);
      pendingChangeRef.current = null;
      
      showSuccess(`${allChanges.length} cambio(s) registrado(s) en control de cambios`);
      // No necesitamos refetch, los datos ya están actualizados en el estado local
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al registrar cambios';
      showError(message);
      throw error;
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
      preselId: 'BATCH_MODE',
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
    moduleName: 'Preselección'
  });

  // Cancelar todos los cambios pendientes
  const handleCancelBatchChanges = () => {
    if (pendingBatchChanges.size === 0) return;
    
    const totalChanges = Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0);
    const message = `¿Deseas cancelar ${totalChanges} cambio(s) pendiente(s)?\n\nNota: Los cambios ya están guardados en la base de datos, pero no se registrarán en el control de cambios.`;
    
    if (window.confirm(message)) {
      setPendingBatchChanges(new Map());
      showSuccess('Registro de cambios cancelado. Los datos permanecen guardados.');
      // No necesitamos refetch, los datos ya están actualizados en el estado local
    }
  };

  const filteredPreselections = preselections
    .filter((presel) => {
      if (decisionFilter && presel.decision !== decisionFilter) return false;
      
      if (dateFilter) {
        const preselDateOnly = buildColombiaDateKey(presel).key;
        if (preselDateOnly !== dateFilter) return false;
      }
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          presel.model?.toLowerCase().includes(search) ||
          presel.serial?.toLowerCase().includes(search) ||
          presel.lot_number?.toLowerCase().includes(search) ||
          presel.supplier_name?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const dateA =
        resolveColombiaDate(a.colombia_time, a.auction_date, a.local_time, a.auction_city)?.getTime() ||
        new Date(a.auction_date).getTime();
      const dateB =
        resolveColombiaDate(b.colombia_time, b.auction_date, b.local_time, b.auction_city)?.getTime() ||
        new Date(b.auction_date).getTime();
      return dateB - dateA;
    });

  // Agrupar por fecha
  const groupedPreselections = useMemo(() => {
    type GroupMeta = {
      preselections: PreselectionWithRelations[];
      colombiaDate: Date | null;
    };
    const groups = new Map<string, GroupMeta>();
    
    filteredPreselections.forEach((presel) => {
      const { key: dateKey, colombiaDate } = buildColombiaDateKey(presel);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, { preselections: [], colombiaDate: colombiaDate || null });
      }
      const group = groups.get(dateKey)!;
      if (!group.colombiaDate && colombiaDate) {
        group.colombiaDate = colombiaDate;
      }
      group.preselections.push(presel);
    });
    
    const now = Date.now();
    const asTimestamp = (group: { colombiaDate: Date | null; date: string }) => {
      if (group.colombiaDate) return group.colombiaDate.getTime();
      const parsed = new Date(group.date).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return Array.from(groups.entries())
      .map(([date, meta]) => ({
        date,
        colombiaDate: meta.colombiaDate,
        preselections: meta.preselections.sort((a, b) => (a.lot_number || '').localeCompare(b.lot_number || '')),
        totalPreselections: meta.preselections.length,
        pendingCount: meta.preselections.filter(p => p.decision === 'PENDIENTE').length,
        approvedCount: meta.preselections.filter(p => p.decision === 'SI').length,
        rejectedCount: meta.preselections.filter(p => p.decision === 'NO').length,
      }))
      .sort((a, b) => {
        const timeA = asTimestamp(a);
        const timeB = asTimestamp(b);
        const isAFuture = timeA >= now;
        const isBFuture = timeB >= now;

        if (isAFuture !== isBFuture) {
          return isAFuture ? -1 : 1;
        }

        if (isAFuture) {
          // Ambos futuros: el más cercano primero
          return timeA - timeB;
        }

        // Ambos pasados: el más reciente primero
        return timeB - timeA;
      });
  }, [filteredPreselections]);

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (dateFilter) {
      setExpandedDates(new Set([dateFilter]));
    } else {
      setExpandedDates(new Set());
    }
  }, [dateFilter]);

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

  const handleDecision = async (preselId: string, decision: 'SI' | 'NO') => {
    try {
      await updateDecision(preselId, decision);
      // updateDecision ya actualiza el estado local, no necesitamos hacer nada más
      showSuccess(`Preselección ${decision === 'SI' ? 'aprobada' : 'rechazada'} exitosamente`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al procesar decisión';
      showError(message);
    }
  };

  const applyAuctionTypeToGroup = async (groupDate: string, auctionType: string | null) => {
    if (!auctionType) return;
    const group = groupedPreselections.find(g => g.date === groupDate);
    if (!group) return;
    // Aplicar el tipo a todas las preselecciones del grupo sin control de cambios (es un dato común de la subasta)
    await Promise.all(
      group.preselections.map(p =>
        requestFieldUpdate(p, 'auction_type', 'Tipo de subasta', auctionType, undefined, true)
      )
    );
    // Actualizar explícitamente el estado local de todas las preselecciones del grupo
    // para asegurar que el summaryPresel refleje el cambio
    group.preselections.forEach(p => {
      updatePreselectionFields(p.id, { auction_type: auctionType } as Partial<PreselectionWithRelations>);
    });
  };

  const getRecordFieldValue = (
    record: PreselectionWithRelations,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const applyDefaultSpecs = async (preselId: string, brand: string | null, model: string | null) => {
    if (!brand || !model) return;
    
    try {
      const spec = await apiGet<{ id: string; brand: string; model: string; spec_blade?: boolean; spec_pip?: boolean; spec_cabin?: string; arm_type?: string; shoe_width_mm?: number }>(
        `/api/machine-spec-defaults/brand/${encodeURIComponent(brand)}/model/${encodeURIComponent(model)}`
      ).catch((error) => {
        // Si la tabla no existe o hay error 404, simplemente no aplicar specs
        if (error?.message?.includes('no existe') || error?.message?.includes('no encontrada')) {
          return null;
        }
        console.warn('Error al obtener especificaciones por defecto:', error);
        return null;
      });
      
      if (spec) {
        // Guardar en cache para comparación posterior
        const cacheKey = `${brand}_${model}`;
        setDefaultSpecsCache(prev => ({
          ...prev,
          [cacheKey]: spec
        }));
        
        // Obtener la preselección actualizada
        const updatedPresel = preselections.find(p => p.id === preselId);
        if (!updatedPresel) return;
        
        const updates: Record<string, unknown> = {};
        const changes: InlineChangeItem[] = [];
        const directUpdates: Record<string, unknown> = {}; // Para campos que estaban vacíos (sin control de cambios)
        
        // Verificar si spec_blade necesita actualización
        if (spec.spec_blade !== undefined && updatedPresel.spec_blade !== spec.spec_blade) {
          const currentValue = updatedPresel.spec_blade;
          // Para booleanos en especificaciones, considerar vacío si es null, undefined o false (valor inicial)
          // Solo solicitar control de cambios si el campo ya tenía un valor true explícito
          const isCurrentEmpty = currentValue === null || currentValue === undefined || currentValue === false;
          
          if (isCurrentEmpty) {
            // Campo estaba vacío o en false (valor inicial), guardar directamente sin control de cambios
            directUpdates.spec_blade = spec.spec_blade;
          } else {
            // Campo ya tenía un valor true, usar control de cambios
            updates.spec_blade = spec.spec_blade;
            changes.push({
              field_name: 'spec_blade',
              field_label: 'Blade',
              old_value: currentValue ? 'Sí' : 'No',
              new_value: spec.spec_blade ? 'Sí' : 'No',
            });
          }
        }
        
        // Verificar si spec_pip necesita actualización
        if (spec.spec_pip !== undefined && updatedPresel.spec_pip !== spec.spec_pip) {
          const currentValue = updatedPresel.spec_pip;
          // Para booleanos en especificaciones, considerar vacío si es null, undefined o false (valor inicial)
          // Solo solicitar control de cambios si el campo ya tenía un valor true explícito
          const isCurrentEmpty = currentValue === null || currentValue === undefined || currentValue === false;
          
          if (isCurrentEmpty) {
            // Campo estaba vacío o en false (valor inicial), guardar directamente sin control de cambios
            directUpdates.spec_pip = spec.spec_pip;
          } else {
            // Campo ya tenía un valor true, usar control de cambios
            updates.spec_pip = spec.spec_pip;
            changes.push({
              field_name: 'spec_pip',
              field_label: 'PIP',
              old_value: currentValue ? 'Sí' : 'No',
              new_value: spec.spec_pip ? 'Sí' : 'No',
            });
          }
        }
        
        // Verificar si spec_cabin necesita actualización
        if (spec.spec_cabin && updatedPresel.spec_cabin !== spec.spec_cabin) {
          const currentValue = updatedPresel.spec_cabin;
          const isCurrentEmpty = isValueEmpty(currentValue);
          
          if (isCurrentEmpty) {
            // Campo estaba vacío, guardar directamente sin control de cambios
            directUpdates.spec_cabin = spec.spec_cabin;
          } else {
            // Campo ya tenía un valor, usar control de cambios
            updates.spec_cabin = spec.spec_cabin;
            changes.push({
              field_name: 'spec_cabin',
              field_label: 'Cabina',
              old_value: currentValue || 'Sin valor',
              new_value: spec.spec_cabin,
            });
          }
        }
        
        // Verificar si arm_type necesita actualización
        if (spec.arm_type && updatedPresel.arm_type !== spec.arm_type) {
          const currentValue = updatedPresel.arm_type;
          const isCurrentEmpty = isValueEmpty(currentValue);
          
          if (isCurrentEmpty) {
            // Campo estaba vacío, guardar directamente sin control de cambios
            directUpdates.arm_type = spec.arm_type;
          } else {
            // Campo ya tenía un valor, usar control de cambios
            updates.arm_type = spec.arm_type;
            changes.push({
              field_name: 'arm_type',
              field_label: 'Tipo de Brazo',
              old_value: currentValue || 'Sin valor',
              new_value: spec.arm_type,
            });
          }
        }
        
        // Verificar si shoe_width_mm necesita actualización
        if (spec.shoe_width_mm !== undefined && spec.shoe_width_mm !== null && updatedPresel.shoe_width_mm !== spec.shoe_width_mm) {
          const currentValue = updatedPresel.shoe_width_mm;
          const isCurrentEmpty = isValueEmpty(currentValue);
          
          if (isCurrentEmpty) {
            // Campo estaba vacío, guardar directamente sin control de cambios
            directUpdates.shoe_width_mm = spec.shoe_width_mm;
          } else {
            // Campo ya tenía un valor, usar control de cambios
            updates.shoe_width_mm = spec.shoe_width_mm;
            changes.push({
              field_name: 'shoe_width_mm',
              field_label: 'Ancho de zapatas',
              old_value: currentValue?.toString() || 'Sin valor',
              new_value: spec.shoe_width_mm.toString(),
            });
          }
        }
        
        // Guardar campos que estaban vacíos directamente sin control de cambios
        if (Object.keys(directUpdates).length > 0) {
          await handleSaveWithToasts(() =>
            updatePreselectionFields(preselId, directUpdates as Partial<PreselectionWithRelations>)
          );
        }
        
        // Registrar cambios para campos que ya tenían valores (con control de cambios)
        if (Object.keys(updates).length > 0) {
          // Registrar cada cambio individualmente
          for (const change of changes) {
            await queueInlineChange(preselId, { [change.field_name]: updates[change.field_name] }, change);
          }
        }
      }
    } catch (error) {
      console.error('Error applying default specs:', error);
    }
  };

  // Función para obtener especificaciones por defecto (con cache)
  const getDefaultSpecs = async (brand: string | null, model: string | null) => {
    if (!brand || !model) return null;
    const cacheKey = `${brand}_${model}`;
    
    // Si ya está en cache, retornarlo
    if (defaultSpecsCache[cacheKey]) {
      return defaultSpecsCache[cacheKey];
    }
    
    // Si no está en cache, obtenerlo de la API
    try {
      const spec = await apiGet<{ id: string; brand: string; model: string; spec_blade?: boolean; spec_pip?: boolean; spec_cabin?: string; arm_type?: string; shoe_width_mm?: number }>(
        `/api/machine-spec-defaults/brand/${encodeURIComponent(brand)}/model/${encodeURIComponent(model)}`
      ).catch(() => null);
      
      if (spec) {
        setDefaultSpecsCache(prev => ({
          ...prev,
          [cacheKey]: spec
        }));
        return spec;
      }
    } catch (error) {
      console.warn('Error obteniendo especificaciones por defecto:', error);
    }
    
    return null;
  };
  
  // Función para obtener valores personalizados que difieren de los por defecto
  const getCustomSpecValues = (presel: PreselectionWithRelations) => {
    if (!presel.brand || !presel.model) return [];
    
    const cacheKey = `${presel.brand}_${presel.model}`;
    const defaultSpecs = defaultSpecsCache[cacheKey];
    
    // Si no hay especificaciones por defecto, no mostrar nada
    if (!defaultSpecs) return [];
    
    const customValues: Array<{ label: string; value: string }> = [];
    
    // Comparar cada campo
    if (defaultSpecs.spec_blade !== undefined && presel.spec_blade !== defaultSpecs.spec_blade) {
      customValues.push({ label: 'Blade', value: presel.spec_blade ? 'SI' : 'No' });
    }
    
    if (defaultSpecs.spec_pip !== undefined && presel.spec_pip !== defaultSpecs.spec_pip) {
      customValues.push({ label: 'PIP', value: presel.spec_pip ? 'SI' : 'No' });
    }
    
    if (defaultSpecs.spec_cabin && presel.spec_cabin !== defaultSpecs.spec_cabin) {
      customValues.push({ label: 'Cabina', value: presel.spec_cabin || '' });
    }
    
    if (defaultSpecs.arm_type && presel.arm_type !== defaultSpecs.arm_type) {
      customValues.push({ label: 'Brazo', value: presel.arm_type || '' });
    }
    
    if (defaultSpecs.shoe_width_mm !== undefined && defaultSpecs.shoe_width_mm !== null && presel.shoe_width_mm !== defaultSpecs.shoe_width_mm) {
      customValues.push({ label: 'Zapatas', value: presel.shoe_width_mm?.toString() || '' });
    }
    
    // Si hay spec_pad y no está en defaults, también mostrarlo
    if (presel.spec_pad) {
      customValues.push({ label: 'PAD', value: presel.spec_pad });
    }
    
    return customValues;
  };
  
  // Cargar especificaciones por defecto cuando cambian las preselecciones
  useEffect(() => {
    const loadDefaultSpecs = async () => {
      const uniqueBrandModels = new Set<string>();
      preselections.forEach(p => {
        if (p.brand && p.model) {
          uniqueBrandModels.add(`${p.brand}_${p.model}`);
        }
      });
      
      for (const key of uniqueBrandModels) {
        if (!defaultSpecsCache[key]) {
          const [brand, model] = key.split('_');
          await getDefaultSpecs(brand, model);
        }
      }
    };
    
    if (preselections.length > 0) {
      loadDefaultSpecs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselections]);
  
  // Campos que NO requieren control de cambios
  const FIELDS_WITHOUT_CHANGE_CONTROL = [
    'lot_number',      // Lote
    'brand',           // Marca
    'machine_type',    // Tipo de máquina
    'model',           // Modelo
    'serial',          // Serie
    'year',            // Año
    'hours',           // Horas
    'shoe_width_mm',   // Ancho zapatas (Especificaciones)
    'spec_cabin',      // Tipo de cabina (Especificaciones)
    'arm_type',        // Tipo de brazo (Especificaciones)
    'spec_pip',        // PIP (Especificaciones)
    'spec_blade',      // Blade (Especificaciones)
    'spec_pad',        // PAD (Especificaciones)
  ];

  const requestFieldUpdate = async (
    presel: PreselectionWithRelations,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>,
    skipChangeControl?: boolean // Parámetro para forzar que no use control de cambios
  ) => {
    const currentValue = getRecordFieldValue(presel, fieldName);
    
    // Validar que el modelo esté en la lista de modelos permitidos
    if (fieldName === 'model' && typeof newValue === 'string' && newValue.trim() !== '') {
      const normalizedModel = newValue.trim();
      // Verificar si el modelo está en la lista de modelos permitidos (MODEL_OPTIONS + dynamicModels)
      if (!allModels.includes(normalizedModel)) {
        showError(`El modelo "${normalizedModel}" no está en la lista de modelos permitidos. Por favor seleccione un modelo válido.`);
        return; // No continuar con la actualización
      }
    }
    
    // Si se actualiza el proveedor, aplicar valores predeterminados de moneda, ubicación, ciudad y tipo de subasta
    if (fieldName === 'supplier_name' && typeof newValue === 'string') {
      const defaults = SUPPLIER_DEFAULTS[newValue];
      if (defaults) {
        const allUpdates = {
          supplier_name: newValue,
          currency: defaults.currency,
          location: defaults.location,
          auction_city: defaults.city,
          auction_type: defaults.auction_type,
          ...(updates || {})
        };
        
        // Si se especifica que no use control de cambios (para proveedor en tarjeta)
        if (skipChangeControl) {
          // Actualización optimista para evitar que se colapse la tarjeta/refetch
          const previousState = preselections;
          const oldKey = buildColombiaDateKey(presel).key;
          mutatePreselections((prev) =>
            prev.map((p) => (p.id === presel.id ? { ...p, ...allUpdates } : p))
          );
          try {
            const updated = await updatePreselectionFields(presel.id, allUpdates as Partial<PreselectionWithRelations>);
            if (!batchModeEnabled) showSuccess('Dato actualizado');
            // Si el proveedor tiene otra ubicación, el backend recalcula colombia_time y la clave del grupo cambia.
            // Añadir la nueva clave a expandedDates para que la tarjeta se mantenga expandida (no cerrar/refrescar).
            const newKey = buildColombiaDateKey(updated).key;
            if (oldKey !== newKey) {
              setExpandedDates((prev) => {
                const next = new Set(prev);
                next.add(newKey);
                return next;
              });
            }
          } catch (error) {
            mutatePreselections(() => previousState);
            const message = error instanceof Error ? error.message : 'No se pudo actualizar el dato';
            showError(message);
            throw error;
          }
          return;
        }
        
        // Si requiere control de cambios, usar beginInlineChange
        await beginInlineChange(
          presel,
          fieldName,
          fieldLabel,
          currentValue,
          newValue,
          allUpdates
        );
        return;
      }
    }
    
    // Si el campo no requiere control de cambios o se especifica explícitamente, guardar directamente
    const shouldSkipChangeControl = skipChangeControl !== undefined 
      ? skipChangeControl 
      : FIELDS_WITHOUT_CHANGE_CONTROL.includes(fieldName);
    
    if (shouldSkipChangeControl) {
      // Guardar directamente sin control de cambios
      const updatesToApply = updates ?? { [fieldName]: newValue };
      await handleSaveWithToasts(() =>
        updatePreselectionFields(presel.id, updatesToApply as Partial<PreselectionWithRelations>)
      );
      
      // Si se actualiza marca o modelo, aplicar especificaciones por defecto después de un breve delay
      if (fieldName === 'model' || fieldName === 'brand') {
        setTimeout(async () => {
          const updatedBrand = fieldName === 'brand' ? (newValue as string) : presel.brand;
          const updatedModel = fieldName === 'model' ? (newValue as string) : presel.model;
          await applyDefaultSpecs(presel.id, updatedBrand, updatedModel);
        }, 500);
      }
      return;
    }
    
    // MEJORA: Si el campo está vacío y se agrega un valor, NO solicitar control de cambios
    // Solo solicitar control de cambios cuando se MODIFICA un valor existente
    const isCurrentValueEmpty = isValueEmpty(currentValue);
    const isNewValueEmpty = isValueEmpty(newValue);
    
    // ESPECIAL: Para el campo 'model', considerar 'ZX' como valor por defecto/vacío
    // Si se cambia de 'ZX' a otro modelo y es la primera vez, no solicitar control de cambios
    const isModelDefaultChange = fieldName === 'model' && 
      (currentValue === null || currentValue === undefined || currentValue === '' || String(currentValue).trim().toUpperCase() === 'ZX') &&
      newValue !== null && newValue !== undefined && String(newValue).trim().toUpperCase() !== 'ZX';
    
    // Si el campo estaba vacío y ahora se agrega un valor, guardar directamente sin control de cambios
    // O si es un cambio de modelo desde el valor por defecto 'ZX' a otro modelo por primera vez
    if ((isCurrentValueEmpty && !isNewValueEmpty) || isModelDefaultChange) {
      const updatesToApply = updates ?? { [fieldName]: newValue };
      await handleSaveWithToasts(() =>
        updatePreselectionFields(presel.id, updatesToApply as Partial<PreselectionWithRelations>)
      );
      
      // Si se actualiza marca o modelo, aplicar especificaciones por defecto después de un breve delay
      if (fieldName === 'model' || fieldName === 'brand') {
        setTimeout(async () => {
          const updatedBrand = fieldName === 'brand' ? (newValue as string) : presel.brand;
          const updatedModel = fieldName === 'model' ? (newValue as string) : presel.model;
          await applyDefaultSpecs(presel.id, updatedBrand, updatedModel);
        }, 500);
      }
      return;
    }
    
    // Si ambos están vacíos, no hay cambio real
    if (isCurrentValueEmpty && isNewValueEmpty) {
      return;
    }
    
    // Para otros casos (modificar un valor existente), usar control de cambios normal
    await beginInlineChange(
      presel,
      fieldName,
      fieldLabel,
      currentValue,
      newValue,
      updates ?? { [fieldName]: newValue }
    );
    
    // Si se actualiza marca o modelo, aplicar especificaciones por defecto después de un breve delay
    if (fieldName === 'model' || fieldName === 'brand') {
      setTimeout(async () => {
        // Usar los valores actualizados del estado local en lugar de refetch
        const updatedBrand = fieldName === 'brand' ? (newValue as string) : presel.brand;
        const updatedModel = fieldName === 'model' ? (newValue as string) : presel.model;
        await applyDefaultSpecs(presel.id, updatedBrand, updatedModel);
      }, 500);
    }
  };

  // Abrir popover de specs y cargar datos actuales
  const handleOpenSpecsPopover = (presel: PreselectionWithRelations) => {
    setSpecsPopoverOpen(presel.id);
    const shoeConfig = getShoeWidthConfigForModel(presel.model);
    const initialShoeWidth =
      shoeConfig?.type === 'readonly' ? shoeConfig.value : (presel.shoe_width_mm || null);
    const newSpecs: {
      shoe_width_mm: number | null;
      spec_cabin: string;
      arm_type: string;
      spec_pip: boolean;
      spec_blade: boolean;
      spec_pad: string;
    } = {
      shoe_width_mm: initialShoeWidth,
      spec_cabin: presel.spec_cabin || '',
      arm_type: presel.arm_type || '',
      spec_pip: !!presel.spec_pip,
      spec_blade: !!presel.spec_blade,
      spec_pad: presel.spec_pad || ''
    };
    setEditingSpecs(prev => ({
      ...prev,
      [presel.id]: newSpecs
    }));
  };

  // Guardar especificaciones editadas desde el popover
  const handleSaveSpecs = async (preselId: string) => {
    try {
      const specs = editingSpecs[preselId];
      if (!specs) return;

      // Preparar las actualizaciones
      const updates = {
        shoe_width_mm: specs.shoe_width_mm ? Number(specs.shoe_width_mm) : null,
        spec_pip: specs.spec_pip || false,
        spec_blade: specs.spec_blade || false,
        spec_cabin: specs.spec_cabin || null,
        arm_type: specs.arm_type || null,
        spec_pad: specs.spec_pad || null
      };

      // Actualizar usando updatePreselectionFields (sin control de cambios para especificaciones)
      await handleSaveWithToasts(() =>
        updatePreselectionFields(preselId, updates as Partial<PreselectionWithRelations>)
      );

      setSpecsPopoverOpen(null);
      setEditingSpecs(prev => {
        const newState = { ...prev };
        delete newState[preselId];
        return newState;
      });
      
      showSuccess('Especificaciones actualizadas correctamente');
    } catch (error) {
      console.error('Error actualizando especificaciones:', error);
      showError('Error al actualizar especificaciones');
    }
  };


  const formatCurrency = (value?: number | null, currencyCode: string | null = 'USD') => {
    if (value === null || value === undefined) return '-';
    try {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currencyCode || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `$${value.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
    }
  };

  const formatHours = (value?: number | null) => {
    if (!value && value !== 0) return '-';
    return `${value.toLocaleString('es-CO')} hrs`;
  };

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

const getFieldIndicators = (
  indicators: Record<string, InlineChangeIndicator[]>,
  recordId: string,
  fieldName: string
) => {
  return (indicators[recordId] || []).filter((log) => log.fieldName === fieldName);
};

const mapValueForLog = (value: string | number | boolean | null | undefined): string | number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return value as string | number;
};

const InlineTile: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, children, className }) => {
  const baseClasses =
    'p-1.5 border rounded-lg bg-white shadow-sm min-h-[64px] flex flex-col gap-1';
  return (
    <div
      className={className ? `${baseClasses} ${className}` : baseClasses}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="text-xs text-gray-700 leading-snug w-full">{children}</div>
    </div>
  );
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
  const isEditing = editingRecordId === recordId;

  return (
    <div 
      className={`relative ${isEditing ? 'z-[100]' : 'z-auto'}`} 
      onClick={(e) => e.stopPropagation()}
      style={{ zIndex: isEditing ? 100 : 'auto', position: isEditing ? 'relative' : 'relative' }}
    >
      {hasIndicator && onIndicatorClick && (
        <button
          type="button"
          className="change-indicator-btn absolute -top-1 -left-1 z-10 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
          title="Ver historial de cambios"
          onClick={(e) => onIndicatorClick(e, recordId!, fieldName!)}
        >
          <Clock className="w-2.5 h-2.5" />
        </button>
      )}
      <div className="flex-1 min-w-0">{children}</div>
      {isOpen && indicators && (
        <div className="change-popover absolute z-30 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left">
          <p className="text-xs font-semibold text-gray-500 mb-2">Cambios recientes</p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {indicators.map((log) => {
              const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : null;
              return (
                <div key={log.id} className="border border-gray-100 rounded-lg p-2 bg-gray-50 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-800">{log.fieldLabel}</p>
                    {moduleLabel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                        {moduleLabel}
                      </span>
                    )}
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

  // Estadísticas
  const totalPending = filteredPreselections.filter(p => p.decision === 'PENDIENTE').length;
  const totalApproved = filteredPreselections.filter(p => p.decision === 'SI').length;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="w-full mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-purple-700 rounded-xl shadow-md p-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold text-white">Panel de Preselección</h1>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-gray">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Total</p>
                <p className="text-2xl font-bold text-brand-gray">{filteredPreselections.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-brand-gray" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{totalPending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Aprobadas</p>
                <p className="text-2xl font-bold text-green-600">{totalApproved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            {/* Filters */}
            <div className="mb-6 space-y-4">
              <div className="p-3 sm:p-4 rounded-2xl border border-dashed border-brand-red/50 bg-rose-50/30 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:items-center">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="text-[10px] uppercase font-semibold text-gray-500 leading-tight sm:min-w-[46px]">Fecha Subasta</div>
                    <div className="flex flex-col gap-0.5 flex-1 sm:flex-initial">
                      {!quickCreateDate && <span className="text-[11px] text-gray-400">dd/mm/aaaa</span>}
                      <input
                        type="date"
                        value={quickCreateDate}
                        onChange={(e) => setQuickCreateDate(e.target.value)}
                        className="h-9 w-full sm:w-auto border border-gray-300 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="text-[10px] uppercase font-semibold text-gray-500 leading-tight sm:min-w-[70px]">Hora Subasta</div>
                    <div className="flex flex-col gap-0.5 flex-1 sm:flex-initial">
                      {!quickCreateTime && <span className="text-[11px] text-gray-400">--:-- -----</span>}
                      <input
                        type="time"
                        value={quickCreateTime}
                        onChange={(e) => setQuickCreateTime(e.target.value)}
                        className="h-9 w-full sm:w-auto border border-gray-300 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="text-[10px] uppercase font-semibold text-gray-500 leading-tight sm:min-w-[55px]">Ciudad</div>
                    <select
                      value={quickCreateCity}
                      onChange={(e) => setQuickCreateCity(e.target.value)}
                      className="h-9 w-full sm:w-auto border border-gray-300 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                    >
                      <option value="">Seleccionar ciudad</option>
                      {citySelectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleQuickCreate}
                    disabled={!quickCreateDate || !quickCreateTime || !quickCreateCity || quickCreateLoading}
                    className="bg-brand-red text-white px-4 py-2 rounded-lg shadow-sm hover:bg-primary-700 disabled:opacity-60 h-9 w-full sm:w-auto"
                  >
                    {quickCreateLoading ? 'Creando...' : 'Crear tarjeta'}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {/* Búsqueda y botones principales */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      placeholder="Buscar por modelo, serial, lote o proveedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red shadow-sm text-sm"
                    />
                  </div>
                  
                  {/* Botones en grid responsive */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2 flex-shrink-0">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-xs sm:text-sm"
                    >
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                      <span className="font-medium text-gray-700 truncate">Nueva</span>
                    </button>
                    <button
                      onClick={() => setIsBrandModelManagerOpen(true)}
                      className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-xs sm:text-sm"
                    >
                      <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                      <span className="font-medium text-gray-700 truncate hidden sm:inline">Marcas/Modelos</span>
                      <span className="font-medium text-gray-700 truncate sm:hidden">M/M</span>
                    </button>
                    <button
                      onClick={() => setIsSpecDefaultsModalOpen(true)}
                      className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-xs sm:text-sm"
                    >
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                      <span className="font-medium text-gray-700 truncate">Especi</span>
                    </button>
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm">
                      <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer w-full justify-center">
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
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-red focus:ring-brand-red border-gray-300 rounded flex-shrink-0"
                        />
                        <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                        <span className="font-medium text-gray-700 truncate text-xs sm:text-sm">Modo Masivo</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Filtros de decisión y fecha */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Select
                    value={decisionFilter}
                    onChange={(e) => setDecisionFilter(e.target.value as PreselectionDecision | '')}
                    options={[
                      { value: '', label: 'Todas las decisiones' },
                      { value: 'PENDIENTE', label: '⏳ Pendiente' },
                      { value: 'SI', label: '✓ Aprobada' },
                      { value: 'NO', label: '✗ Rechazada' },
                    ]}
                    className="w-full sm:min-w-[200px] sm:max-w-[250px]"
                  />
                  
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full sm:w-auto sm:min-w-[180px] px-3 sm:px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red shadow-sm text-sm"
                  />
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm">Exportar</span>
                  </Button>
                </div>
              </div>

              {/* Indicador de Filtros */}
              {(dateFilter || decisionFilter || searchTerm) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-brand-red font-medium">
                    Mostrando {filteredPreselections.length} preselección{filteredPreselections.length !== 1 ? 'es' : ''}
                    {dateFilter && ` para ${new Date(dateFilter).toLocaleDateString('es-CO')}`}
                    {decisionFilter && ` ${decisionFilter.toLowerCase()}`}
                  </p>
                  <button
                    onClick={() => {
                      setDateFilter('');
                      setDecisionFilter('');
                      setSearchTerm('');
                      setExpandedDates(new Set());
                    }}
                    className="text-xs text-brand-red hover:text-primary-700 font-semibold underline"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Colección de tarjetas */}
            <div className="space-y-6">
              {isLoading ? (
                <div className="p-12 text-center bg-white border rounded-2xl">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-red border-t-transparent"></div>
                  <p className="text-gray-600 mt-4">Cargando preselecciones...</p>
                </div>
              ) : groupedPreselections.length === 0 ? (
                <div className="p-12 text-center bg-white border rounded-2xl">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-lg">No hay preselecciones para mostrar</p>
                </div>
              ) : (
                groupedPreselections.map((group, groupIndex) => {
                  const isExpanded = expandedDates.has(group.date);
                  const summaryPresel = group.preselections[0];
                  const headerColombiaLabel = summaryPresel
                    ? formatStoredColombiaTime(
                        summaryPresel.colombia_time,
                        summaryPresel.auction_date,
                        summaryPresel.local_time,
                        summaryPresel.auction_city
                      )
                    : 'Define fecha, hora y ciudad';

                  return (
                    <motion.div
                      key={group.date}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIndex * 0.05 }}
                      className="border border-gray-200 rounded-2xl bg-white shadow-sm"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full text-left p-5 flex flex-col gap-4 focus:outline-none"
                        onClick={(e) => {
                          const target = e.target as HTMLElement | null;
                          if (target && target.closest('[data-no-toggle]')) return;
                          toggleDateExpansion(group.date);
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement | null)?.closest('[data-no-toggle]')) {
                            e.preventDefault();
                            toggleDateExpansion(group.date);
                          }
                        }}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-6 h-6 text-brand-red" />
                            ) : (
                              <ChevronRight className="w-6 h-6 text-brand-red" />
                            )}
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                                Hora Colombia
                              </p>
                              <div className="inline-flex items-center px-3 py-1 rounded-lg bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 border border-rose-200 text-sm font-semibold text-rose-700 shadow-sm">
                                {headerColombiaLabel}
                              </div>
                              <p className="text-sm text-gray-500">
                                {group.totalPreselections} preselección{group.totalPreselections !== 1 ? 'es' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
                              <p className="text-xl font-semibold text-amber-700">{group.pendingCount}</p>
                              <p className="text-xs text-amber-600">Pendientes</p>
                            </div>
                            <div className="px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                              <p className="text-xl font-semibold text-emerald-700">{group.approvedCount}</p>
                              <p className="text-xs text-emerald-600">Aprobadas</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isExpanded && summaryPresel && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 sm:p-4 mt-2 mb-4" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                              <InlineTile label="Proveedor">
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  style={{ cursor: 'default' }}
                                  data-no-toggle
                                >
                                  <InlineCell {...buildCellProps(summaryPresel.id, 'supplier_name')}>
                                  <InlineFieldEditor
                                    value={summaryPresel.supplier_name}
                                    type="select"
                                    placeholder="Seleccionar proveedor"
                                    options={supplierOptions}
                                    keepOpenOnAutoSave
                                    onSave={(val) =>
                                      requestFieldUpdate(summaryPresel, 'supplier_name', 'Proveedor', val, undefined, true)
                                    }
                                    autoSave={true}
                                    {...getEditCallbacks(summaryPresel.id)}
                                  />
                                  </InlineCell>
                                </div>
                              </InlineTile>
                              <InlineTile label="Tipo de subasta">
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  style={{ cursor: 'default' }}
                                  data-no-toggle
                                >
                                  <InlineCell {...buildCellProps(summaryPresel.id, 'auction_type')}>
                                    <InlineFieldEditor
                                      value={summaryPresel.auction_type}
                                      type="select"
                                      placeholder="Seleccionar tipo"
                                      options={getAuctionTypeOptions(summaryPresel.supplier_name)}
                                      onSave={async (val) => {
                                        await applyAuctionTypeToGroup(group.date, typeof val === 'string' ? val : null);
                                      }}
                                      autoSave={true}
                                      {...getEditCallbacks(summaryPresel.id)}
                                    />
                                  </InlineCell>
                                </div>
                              </InlineTile>
                              <div className="md:col-span-2">
                                <InlineTile label="Fecha y hora local" className="md:col-span-2">
                                  <div className="flex flex-col gap-2.5">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <div className="min-w-[150px]">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Fecha Subasta</p>
                                        <InlineCell {...buildCellProps(summaryPresel.id, 'auction_date')}>
                                          <InlineFieldEditor
                                            value={
                                              summaryPresel.auction_date
                                                ? new Date(summaryPresel.auction_date).toISOString().split('T')[0]
                                                : ''
                                            }
                                            type="date"
                                            placeholder="Fecha Subasta"
                                            inputClassName="h-10"
                                            onSave={async (val) => {
                                              // Preservar la fecha original tal cual se ingresa (YYYY-MM-DD)
                                              // NO convertir a ISO con zona horaria para evitar cambios de fecha
                                              const dateValue =
                                                typeof val === 'string' && val
                                                  ? val // Mantener solo la fecha YYYY-MM-DD sin hora
                                                  : null;
                                              return requestFieldUpdate(
                                                summaryPresel,
                                                'auction_date',
                                                'Fecha Subasta',
                                                dateValue,
                                                { auction_date: dateValue }
                                              );
                                            }}
                                            displayFormatter={() => {
                                              if (!summaryPresel.auction_date) return 'Sin fecha';
                                              // Preservar la fecha original tal cual está almacenada (YYYY-MM-DD)
                                              // Convertir a formato DD/MM/YYYY para mostrar sin afectar por zona horaria
                                              const dateStr = String(summaryPresel.auction_date);
                                              const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                              if (dateMatch) {
                                                const [, year, month, day] = dateMatch;
                                                return `${day}/${month}/${year}`;
                                              }
                                              // Fallback si no está en formato esperado
                                              return dateStr;
                                            }}
                                            {...getEditCallbacks(summaryPresel.id)}
                                          />
                                        </InlineCell>
                                      </div>
                                      <div className="min-w-[150px]">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Hora Subasta</p>
                                        <InlineCell {...buildCellProps(summaryPresel.id, 'local_time')}>
                                          <InlineFieldEditor
                                            value={summaryPresel.local_time || ''}
                                            type="time"
                                            placeholder="Hora Subasta"
                                            inputClassName="h-10 pr-3 pl-2"
                                            displayFormatter={(val) => (val ? `${val} hrs` : 'Sin hora')}
                                            onSave={(val) =>
                                              requestFieldUpdate(summaryPresel, 'local_time', 'Hora Subasta', val)
                                            }
                                            {...getEditCallbacks(summaryPresel.id)}
                                          />
                                        </InlineCell>
                                      </div>
                                      <div className="min-w-[150px]">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Ciudad</p>
                                        <InlineCell {...buildCellProps(summaryPresel.id, 'auction_city')}>
                                          <InlineFieldEditor
                                            value={summaryPresel.auction_city || ''}
                                            type="select"
                                            placeholder="Seleccionar ciudad"
                                            options={citySelectOptions}
                                            inputClassName="h-10"
                                            displayFormatter={(val) => getCityMeta(val)?.label || 'Sin ciudad'}
                                            onSave={(val) =>
                                              requestFieldUpdate(summaryPresel, 'auction_city', 'Ciudad', val)
                                            }
                                          />
                                        </InlineCell>
                                      </div>
                                    </div>
                                  </div>
                                </InlineTile>
                              </div>
                              <div className="md:col-span-1 lg:max-w-xs">
                                <InlineTile label="URL">
                                  <InlineCell {...buildCellProps(summaryPresel.id, 'auction_url')}>
                                    <InlineFieldEditor
                                      value={summaryPresel.auction_url}
                                      placeholder="Enlace"
                                      onSave={(val) => requestFieldUpdate(summaryPresel, 'auction_url', 'URL', val)}
                                      displayFormatter={(val) =>
                                        val ? (
                                          <a
                                            href={typeof val === 'string' ? val : ''}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-brand-red underline text-xs"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Abrir enlace
                                          </a>
                                        ) : (
                                          <span className="text-gray-400">Sin URL</span>
                                        )
                                      }
                                      {...getEditCallbacks(summaryPresel.id)}
                                    />
                                  </InlineCell>
                                </InlineTile>
                              </div>
                              <InlineTile label="Moneda">
                                <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                  <InlineCell {...buildCellProps(summaryPresel.id, 'currency')}>
                                    <InlineFieldEditor
                                      value={summaryPresel.currency}
                                      type="select"
                                      placeholder="Moneda"
                                      options={[
                                        { value: 'JPY', label: 'JPY' },
                                        { value: 'GBP', label: 'GBP' },
                                        { value: 'EUR', label: 'EUR' },
                                        { value: 'USD', label: 'USD' },
                                        { value: 'CAD', label: 'CAD' },
                                      ]}
                                      onSave={(val) => requestFieldUpdate(summaryPresel, 'currency', 'Moneda', val)}
                                      autoSave={true}
                                    />
                                  </InlineCell>
                                </div>
                              </InlineTile>
                              <InlineTile label="Ubicación">
                                <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                  <InlineCell {...buildCellProps(summaryPresel.id, 'location')}>
                                    <InlineFieldEditor
                                      value={summaryPresel.location}
                                      type="select"
                                      placeholder="Ubicación"
                                      options={[
                                        { value: 'Japón', label: 'Japón' },
                                        { value: 'United Kingdom', label: 'United Kingdom' },
                                        { value: 'Germany', label: 'Germany' },
                                        { value: 'USA', label: 'USA' },
                                        { value: 'Canada', label: 'Canada' },
                                        { value: 'China', label: 'China' },
                                      ]}
                                      onSave={(val) => requestFieldUpdate(summaryPresel, 'location', 'Ubicación', val)}
                                      autoSave={true}
                                      {...getEditCallbacks(summaryPresel.id)}
                                    />
                                  </InlineCell>
                                </div>
                              </InlineTile>
                            </div>
                          </div>
                        )}
                      {isExpanded && (
                        <div className="border-t border-gray-100 mt-4 overflow-y-visible relative transition-all duration-300">
                          <div className="flex items-center justify-start px-4 py-2 bg-gray-50 border-b border-gray-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddMachineToGroup(group.date, summaryPresel);
                              }}
                              disabled={addingMachineFor === group.date}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-brand-red text-brand-red hover:bg-brand-red hover:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          {group.preselections.map((presel, idx) => {
                            const auctionStatusLabel = resolveAuctionStatusLabel(presel);
                            const isEditing = editingRecordId === presel.id;
                            return (
                              <motion.div
                                key={presel.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className={`px-3 sm:px-4 py-4 sm:py-5 bg-white relative border-b border-gray-200 last:border-b-0 mb-8 transition-all duration-300 ${
                                  isEditing ? 'z-[100] shadow-2xl' : 'z-10'
                                }`}
                                style={{ 
                                  zIndex: isEditing ? 100 : 10,
                                  // Solo reservar espacio inferior cuando hay popovers (SPEC, Precio sugerido, modelo).
                                  // NO incluir isEditing: los InlineFieldEditor (select/number) no requieren espacio extra.
                                  paddingBottom: (specsPopoverOpen === presel.id || priceSuggestionPopoverOpen[presel.id] || modelDropdownOpen === presel.id) ? '500px' : '1.25rem',
                                  marginBottom: '2rem',
                                }}
                              >
                                {canDeleteCards() && (
                                  <button
                                    onClick={() => handleDeletePreselection(
                                      presel.id,
                                      `Lote: ${presel.lot_number || 'N/A'} - ${presel.brand || ''} ${presel.model || ''}`
                                    )}
                                    className="absolute top-2 right-2 w-6 h-6 rounded-md bg-red-50 border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-100 hover:border-red-300 transition-all duration-200 z-10"
                                    title="Eliminar tarjeta"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                                {/* Contenedor responsive para la tabla de máquinas */}
                                <div className="overflow-y-visible -mx-3 sm:-mx-4 px-3 sm:px-4">
                                  <div className="min-w-[1200px]">
                                    <div className="grid gap-3 sm:gap-4 items-start text-sm text-gray-700" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
                                  <div className="pr-3 border-r border-gray-200" onClick={(e) => e.stopPropagation()}>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Lote</p>
                                    <InlineCell {...buildCellProps(presel.id, 'lot_number')}>
                                      <InlineFieldEditor
                                        value={presel.lot_number}
                                        placeholder="Lote"
                                        onSave={(val) => requestFieldUpdate(presel, 'lot_number', 'Lote', val)}
                                        autoSave={true}
                                        // NO usar getEditCallbacks para evitar expansión de tarjeta
                                      />
                                    </InlineCell>
                                  </div>
                                  <div className="pl-4 pr-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold whitespace-nowrap mb-0.5">T Maquina</p>
                                    <div className="min-h-[24px]">
                                      <InlineCell {...buildCellProps(presel.id, 'machine_type')}>
                                        <InlineFieldEditor
                                          value={presel.machine_type || ''}
                                          type="select"
                                          placeholder="Seleccionar tipo"
                                          options={MACHINE_TYPE_OPTIONS_PRESELECTION_CONSOLIDADO_COMPRAS}
                                          displayFormatter={(val) => formatMachineType(val)}
                                          onSave={(val) => requestFieldUpdate(presel, 'machine_type', 'T Maquina', val)}
                                          autoSave={true}
                                          // NO usar getEditCallbacks para evitar expansión de tarjeta
                                        />
                                      </InlineCell>
                                    </div>
                                  </div>
                                  <div className="relative pl-3 pr-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <p className="text-[11px] uppercase text-gray-400 font-semibold flex-1">Marca</p>
                                      {idx === 0 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setIsBrandModelManagerOpen(true);
                                          }}
                                          className="w-5 h-5 rounded-full bg-gradient-to-r from-[#cf1b22] to-primary-600 text-white flex items-center justify-center hover:shadow-lg transition-all duration-200 hover:scale-110"
                                          title="Gestionar marcas y modelos"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    <div className="min-h-[24px]">
                                      <InlineCell {...buildCellProps(presel.id, 'brand')}>
                                        <InlineFieldEditor
                                          value={presel.brand}
                                          type="combobox"
                                          placeholder="Buscar o escribir marca"
                                          options={brandSelectOptions}
                                          onSave={(val) => {
                                            requestFieldUpdate(presel, 'brand', 'Marca', val);
                                            // Si cambia la marca, limpiar el modelo si no es compatible
                                            if (val && brandModelMap[String(val)]) {
                                              const validModels = brandModelMap[String(val)];
                                              if (presel.model && !validModels.includes(presel.model)) {
                                                // El modelo actual no es válido para la nueva marca, pero no lo limpiamos automáticamente
                                                // El usuario puede cambiarlo manualmente
                                              }
                                            }
                                          }}
                                          // NO usar getEditCallbacks para evitar expansión de tarjeta
                                        />
                                      </InlineCell>
                                    </div>
                                  </div>
                                  <div className="pl-2 pr-2 min-w-0" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }} onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold mb-0.5">Modelo</p>
                                    <div className="min-h-[24px]">
                                      <InlineCell {...buildCellProps(presel.id, 'model')}>
                                        <InlineFieldEditor
                                          value={presel.model || 'ZX'}
                                          type="combobox"
                                          placeholder="Buscar o escribir modelo"
                                          options={getModelOptionsForBrand(presel.brand)}
                                          onSave={(val) => requestFieldUpdate(presel, 'model', 'Modelo', val || 'ZX')}
                                          // NO usar onDropdownOpen/onDropdownClose ni getEditCallbacks para evitar expansión de tarjeta
                                        />
                                      </InlineCell>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Serie</p>
                                    <InlineCell {...buildCellProps(presel.id, 'serial')}>
                                      <InlineFieldEditor
                                        value={presel.serial}
                                        placeholder="Serie"
                                        className="font-mono"
                                        onSave={(val) => requestFieldUpdate(presel, 'serial', 'Serie', val)}
                                      />
                                    </InlineCell>
                                  </div>
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    style={{ cursor: 'default' }}
                                    data-no-toggle
                                  >
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Año</p>
                                    <InlineCell {...buildCellProps(presel.id, 'year')}>
                                      <InlineFieldEditor
                                        value={presel.year?.toString() || ''}
                                        type="select"
                                        placeholder="Seleccionar año"
                                        options={YEAR_OPTIONS}
                                        onSave={(val) => requestFieldUpdate(presel, 'year', 'Año', val ? parseInt(val.toString()) : null)}
                                        displayFormatter={(val) => val || 'Sin año'}
                                        autoSave={true}
                                        {...getEditCallbacks(presel.id)}
                                      />
                                    </InlineCell>
                                  </div>
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    style={{ cursor: 'default' }}
                                    data-no-toggle
                                  >
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Horas</p>
                                    <InlineCell {...buildCellProps(presel.id, 'hours')}>
                                      <InlineFieldEditor
                                        value={presel.hours}
                                        type="number"
                                        placeholder="Horas"
                                        displayFormatter={(val) => formatHours(toNumberOrNull(val))}
                                        onSave={(val) => requestFieldUpdate(presel, 'hours', 'Horas', val)}
                                        {...getEditCallbacks(presel.id)}
                                      />
                                    </InlineCell>
                                  </div>
                                  <div style={{ gridColumn: 'span 2' }} className="relative">
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold mb-2">SPEC</p>
                                    <div className="flex items-center justify-start gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenSpecsPopover(presel);
                                        }}
                                        className="inline-flex items-center justify-center w-8 h-8 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                        title={presel.shoe_width_mm || presel.spec_cabin || presel.arm_type || presel.spec_pip || presel.spec_blade || presel.spec_pad ? 'Editar Especificaciones' : 'Agregar Especificaciones'}
                                      >
                                        <Settings className="w-4 h-4" />
                                      </button>
                                      {/* Mostrar valores personalizados que difieren de los por defecto */}
                                      {(() => {
                                        const customValues = getCustomSpecValues(presel);
                                        if (customValues.length > 0) {
                                          return (
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              {customValues.map((item, idx) => (
                                                <span
                                                  key={idx}
                                                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded border border-amber-200"
                                                  title={`${item.label}: ${item.value}`}
                                                >
                                                  <span className="text-amber-600 font-semibold mr-0.5">{item.label}:</span>
                                                  <span className="text-amber-800">{item.value}</span>
                                                </span>
                                              ))}
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                      {specsPopoverOpen === presel.id && editingSpecs[presel.id] && (
                                        <>
                                          <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => {
                                              setSpecsPopoverOpen(null);
                                              setEditingSpecs(prev => {
                                                const newState = { ...prev };
                                                delete newState[presel.id];
                                                return newState;
                                              });
                                            }}
                                          />
                                          <div className="absolute left-0 mt-2 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200">
                                            <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 px-4 py-2.5 rounded-t-lg">
                                              <h4 className="text-sm font-semibold text-white">Especificaciones Técnicas</h4>
                                            </div>
                                            <div className="p-4 space-y-3">
                                              {/* Fila 1: Ancho Zapatas | Tipo de Cabina */}
                                              <div className="grid grid-cols-2 gap-3">
                                                {/* Ancho Zapatas: una opción (solo lectura) o lista desplegable según el modelo */}
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Ancho Zapatas (mm)
                                                  </label>
                                                  {(() => {
                                                    const shoeConfig = getShoeWidthConfigForModel(presel.model);
                                                    if (shoeConfig?.type === 'readonly') {
                                                      return (
                                                        <div className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                                                          {shoeConfig.value} mm
                                                        </div>
                                                      );
                                                    }
                                                    if (shoeConfig?.type === 'select') {
                                                      return (
                                                        <select
                                                          value={editingSpecs[presel.id].shoe_width_mm ?? ''}
                                                          onChange={(e) => {
                                                            const v = e.target.value;
                                                            setEditingSpecs(prev => ({
                                                              ...prev,
                                                              [presel.id]: { ...prev[presel.id], shoe_width_mm: v ? Number(v) : null },
                                                            }));
                                                          }}
                                                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                                        >
                                                          <option value="">Seleccionar...</option>
                                                          {shoeConfig.options.map((o) => (
                                                            <option key={o} value={o}>{o} mm</option>
                                                          ))}
                                                        </select>
                                                      );
                                                    }
                                                    return (
                                                      <input
                                                        type="number"
                                                        value={editingSpecs[presel.id].shoe_width_mm ?? ''}
                                                        onChange={(e) => {
                                                          const value = e.target.value;
                                                          setEditingSpecs(prev => ({
                                                            ...prev,
                                                            [presel.id]: { ...prev[presel.id], shoe_width_mm: value ? Number(value) : null },
                                                          }));
                                                        }}
                                                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                                        placeholder="Ej: 600"
                                                      />
                                                    );
                                                  })()}
                                                </div>

                                                {/* Tipo de Cabina */}
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Tipo de Cabina
                                                  </label>
                                                  <select
                                                    value={editingSpecs[presel.id].spec_cabin || ''}
                                                    onChange={(e) => setEditingSpecs(prev => ({
                                                      ...prev,
                                                      [presel.id]: { ...prev[presel.id], spec_cabin: e.target.value }
                                                    }))}
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
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Blade (Hoja Topadora)
                                                  </label>
                                                  <select
                                                    value={editingSpecs[presel.id].spec_blade ? 'SI' : 'No'}
                                                    onChange={(e) => setEditingSpecs(prev => ({
                                                      ...prev,
                                                      [presel.id]: { ...prev[presel.id], spec_blade: e.target.value === 'SI' }
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
                                                    value={editingSpecs[presel.id].arm_type || ''}
                                                    onChange={(e) => setEditingSpecs(prev => ({
                                                      ...prev,
                                                      [presel.id]: { ...prev[presel.id], arm_type: e.target.value }
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
                                                    value={editingSpecs[presel.id].spec_pip ? 'SI' : 'No'}
                                                    onChange={(e) => setEditingSpecs(prev => ({
                                                      ...prev,
                                                      [presel.id]: { ...prev[presel.id], spec_pip: e.target.value === 'SI' }
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
                                                  <select
                                                    value={editingSpecs[presel.id].spec_pad || ''}
                                                    onChange={(e) => setEditingSpecs(prev => ({
                                                      ...prev,
                                                      [presel.id]: { ...prev[presel.id], spec_pad: e.target.value }
                                                    }))}
                                                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#cf1b22]"
                                                  >
                                                    <option value="">Seleccionar...</option>
                                                    <option value="Bueno">Bueno</option>
                                                    <option value="Malo">Malo</option>
                                                  </select>
                                                </div>
                                              </div>

                                              {/* Botones */}
                                              <div className="flex gap-2 pt-2">
                                                <button
                                                  onClick={() => handleSaveSpecs(presel.id)}
                                                  className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[#cf1b22] hover:bg-[#a01419] rounded-md transition-colors"
                                                >
                                                  Guardar
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setSpecsPopoverOpen(null);
                                                    setEditingSpecs(prev => {
                                                      const newState = { ...prev };
                                                      delete newState[presel.id];
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
                                    </div>
                                  </div>
                                  <div className="min-w-0 relative" style={{ minHeight: '60px' }}>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Precio Histórico</p>
                                    <div className="flex flex-col gap-1">
                                      {presel.model && (
                                        <PriceSuggestion
                                          type="auction"
                                          model={presel.model}
                                          year={presel.year}
                                          hours={presel.hours}
                                          autoFetch={false}
                                          compact={true}
                                          forcePopoverPosition="bottom"
                                          onPopoverToggle={(isOpen) => {
                                            setPriceSuggestionPopoverOpen(prev => ({
                                              ...prev,
                                              [presel.id]: isOpen
                                            }));
                                          }}
                                          onApply={(value) => requestFieldUpdate(presel, 'suggested_price', 'Precio Histórico', value)}
                                        />
                                      )}
                                    </div>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Precio sugerido</p>
                                    <div className="flex flex-col gap-1">
                                      <InlineCell {...buildCellProps(presel.id, 'suggested_price')}>
                                        <InlineFieldEditor
                                          value={presel.suggested_price}
                                          type="number"
                                          placeholder="Valor sugerido"
                                          displayFormatter={(val) => formatCurrency(toNumberOrNull(val), presel.currency)}
                                          onSave={(val) =>
                                            requestFieldUpdate(presel, 'suggested_price', 'Precio sugerido', val)
                                          }
                                          {...getEditCallbacks(presel.id)}
                                        />
                                      </InlineCell>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-center">
                                    {presel.decision === 'SI' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white">
                                          <CheckCircle className="w-5 h-5" />
                                        </span>
                                        <span className="text-xs font-semibold text-emerald-700">Aprobada</span>
                                      </div>
                                    ) : presel.decision === 'NO' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-600 text-white">
                                          <XCircle className="w-5 h-5" />
                                        </span>
                                        <span className="text-xs font-semibold text-rose-700">Rechazada</span>
                                      </div>
                                    ) : (
                                      <div className="flex justify-center gap-2">
                                        <button
                                          onClick={() => handleDecision(presel.id, 'SI')}
                                          className="w-9 h-9 rounded-full border border-emerald-500 text-emerald-600 flex items-center justify-center hover:bg-emerald-50 transition"
                                          title="Aprobar"
                                        >
                                          <CheckCircle className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={() => handleDecision(presel.id, 'NO')}
                                          className="w-9 h-9 rounded-full border border-rose-500 text-rose-600 flex items-center justify-center hover:bg-rose-50 transition"
                                          title="Rechazar"
                                        >
                                          <XCircle className="w-5 h-5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="max-w-[120px]">
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Precio compra</p>
                                    {presel.auction_price_bought !== null && presel.auction_price_bought !== undefined ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-slate-900 to-gray-700 text-white shadow">
                                        {formatCurrency(presel.auction_price_bought, presel.currency)}
                                      </span>
                                    ) : presel.final_price !== null && presel.final_price !== undefined ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-slate-900 to-gray-700 text-white shadow">
                                        {formatCurrency(presel.final_price, presel.currency)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-400">
                                        Sin definir
                                      </span>
                                    )}
                                  </div>
                                  <div className="lg:col-span-1">
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Estado subasta</p>
                                    <span className={getAuctionStatusStyle(auctionStatusLabel)}>
                                      {auctionStatusLabel}
                                    </span>
                                  </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </Card>
        </motion.div>

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPreselection(null);
          }}
          title={selectedPreselection ? 'Editar Preselección' : 'Nueva Preselección'}
          size="lg"
        >
          <PreselectionForm 
            preselection={selectedPreselection} 
            onSuccess={() => {
              setIsModalOpen(false);
              setSelectedPreselection(null);
              // createPreselection y updatePreselectionFields ya actualizan el estado local
              // No necesitamos refetch para evitar refresh innecesario
            }} 
            onCancel={() => {
              setIsModalOpen(false);
              setSelectedPreselection(null);
            }} 
          />
        </Modal>
        <ChangeLogModal
          isOpen={changeModalOpen}
          changes={changeModalItems}
          onConfirm={handleConfirmInlineChange}
          onCancel={handleCancelInlineChange}
        />
        
        <MachineSpecDefaultsModal
          isOpen={isSpecDefaultsModalOpen}
          onClose={() => setIsSpecDefaultsModalOpen(false)}
        />

        <BrandModelManager
          isOpen={isBrandModelManagerOpen}
          onClose={() => setIsBrandModelManagerOpen(false)}
          onBrandsChange={(brands) => setDynamicBrands(brands)}
          onModelsChange={(models) => setDynamicModels(models)}
          favoriteBrands={favoriteBrands}
          onFavoriteBrandsChange={(brands) => {
            setFavoriteBrands(brands);
            localStorage.setItem('favoriteBrands_preselection', JSON.stringify(brands));
          }}
          contextLabel="Preselección"
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
    </div>
  );
};

