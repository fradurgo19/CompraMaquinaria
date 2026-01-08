/**
 * Página de Compras - Diseño Premium Empresarial
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Download, Package, DollarSign, Truck, FileText, Eye, Edit, History, AlertCircle, Clock, ChevronDown, ChevronRight, ChevronUp, MoreVertical, Move, Unlink, Layers, Save, X, Trash2, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Modal } from '../molecules/Modal';
import { Select } from '../atoms/Select';
import { Column } from '../organisms/DataTable';
import { PurchaseWithRelations, PaymentStatus } from '../types/database';
import { PurchaseFormNew } from '../components/PurchaseFormNew';
import { usePurchases } from '../hooks/usePurchases';
import { showSuccess, showError } from '../components/Toast';
import { useBatchModeGuard } from '../hooks/useBatchModeGuard';
import { MachineFiles } from '../components/MachineFiles';
import { PurchaseFiles } from '../components/PurchaseFiles';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { BulkUploadPurchases } from '../components/BulkUploadPurchases';
import { apiPatch, apiPost, apiGet, apiDelete } from '../services/api';
import { MACHINE_TYPE_OPTIONS, MACHINE_TYPE_OPTIONS_PRESELECTION_CONSOLIDADO_COMPRAS, formatMachineType } from '../constants/machineTypes';
import { useAuth } from '../context/AuthContext';

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

const INCOTERM_OPTIONS = [
  { value: 'EXY', label: 'EXY' },
  { value: 'FOB', label: 'FOB' },
  { value: 'CIF', label: 'CIF' },
];

const CURRENCY_OPTIONS = [
  { value: 'JPY', label: 'JPY' },
  { value: 'GBP', label: 'GBP' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'CAD', label: 'CAD' },
];

const EMPRESA_OPTIONS = [
  { value: 'Partequipos Maquinaria', label: 'Partequipos Maquinaria' },
  { value: 'Maquitecno', label: 'Maquitecno' },
];

const LOCATION_OPTIONS = [
  { value: 'NARITA', label: 'NARITA' },
  { value: 'KOBE', label: 'KOBE' },
  { value: 'YOKOHAMA', label: 'YOKOHAMA' },
  { value: 'HAKATA', label: 'HAKATA' },
  { value: 'TOMAKOMAI', label: 'TOMAKOMAI' },
  { value: 'LAKE WORTH', label: 'LAKE WORTH' },
  { value: 'SAKURA', label: 'SAKURA' },
  { value: 'LEBANON', label: 'LEBANON' },
  { value: 'FUJI', label: 'FUJI' },
  { value: 'NAGOYA', label: 'NAGOYA' },
  { value: 'HOKKAIDO', label: 'HOKKAIDO' },
  { value: 'OSAKA', label: 'OSAKA' },
  { value: 'ALBERTA', label: 'ALBERTA' },
  { value: 'FLORIDA', label: 'FLORIDA' },
  { value: 'HYOGO', label: 'HYOGO' },
  { value: 'KASHIBA', label: 'KASHIBA' },
  { value: 'MIAMI', label: 'MIAMI' },
  { value: 'BOSTON', label: 'BOSTON' },
];

const PORT_OPTIONS = [
  { value: 'KOBE', label: 'KOBE' },
  { value: 'YOKOHAMA', label: 'YOKOHAMA' },
  { value: 'SAVANNA', label: 'SAVANNA' },
  { value: 'JACKSONVILLE', label: 'JACKSONVILLE' },
  { value: 'CANADA', label: 'CANADA' },
  { value: 'MIAMI', label: 'MIAMI' },
];

const getShipmentStyle = (shipment: string | null | undefined) => {
  if (!shipment) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  const upperShipment = shipment.toUpperCase();
  if (upperShipment.includes('RORO')) {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
  } else if (upperShipment.includes('1X40')) {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const getMQStyle = (mq: string | null | undefined) => {
  if (!mq || mq === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-gray to-secondary-600 text-white shadow-md font-mono';
};

const getTipoCompraStyle = (tipo: string | null | undefined) => {
  if (!tipo || tipo === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  const upperTipo = tipo.toUpperCase();
  if (upperTipo.includes('SUBASTA')) {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md';
  } else if (upperTipo.includes('COMPRA_DIRECTA') || upperTipo.includes('COMPRA DIRECTA')) {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const getProveedorStyle = (proveedor: string | null | undefined) => {
  if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md';
};

const getModeloStyle = (modelo: string | null | undefined) => {
  if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
};

const getSerialStyle = (serial: string | null | undefined) => {
  if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
};

const getFechaFacturaStyle = (fecha: string | null | undefined) => {
  if (!fecha || fecha === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md';
};

const getUbicacionStyle = (ubicacion: string | null | undefined) => {
  if (!ubicacion || ubicacion === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
};

const getIncotermStyle = (incoterm: string | null | undefined) => {
  if (!incoterm) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  const upperIncoterm = incoterm.toUpperCase();
  if (upperIncoterm === 'EXW') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md';
  } else if (upperIncoterm === 'FOB') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const getMonedaStyle = (moneda: string | null | undefined) => {
  if (!moneda || moneda === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  const upperMoneda = moneda.toUpperCase();
  if (upperMoneda === 'USD') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
  } else if (upperMoneda === 'JPY') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md';
  } else if (upperMoneda === 'EUR') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900 shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const getTasaStyle = (tasa: string | number | null | undefined) => {
  if (!tasa || tasa === '-' || tasa === 'PDTE' || tasa === '') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-red-100 text-red-600 border border-red-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md';
};

const getValorStyle = (valor: string | number | null | undefined) => {
  if (!valor || valor === '-' || valor === 0 || valor === '0') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md';
};

// Precio de compra (fuente):
// - SUBASTA: price_bought de auction
// - COMPRA_DIRECTA: usar EXW ingresado (exw_value_formatted) como base editable solo cuando es FOB
const getPurchasePriceValue = (row: PurchaseWithRelations): number | null => {
  const purchaseType = (row.purchase_type || '').toString().toUpperCase().replace(/\s+/g, '_').trim();
  if (purchaseType === 'COMPRA_DIRECTA') {
    const direct = parseCurrencyValue(row.exw_value_formatted);
    return direct !== null ? direct : null;
  }
  const auctionPrice = (row as any).auction_price_bought ?? row.auction?.price_bought ?? null;
  return auctionPrice !== undefined && auctionPrice !== null ? Number(auctionPrice) : null;
};

const getReporteStyle = (reporte: string | null | undefined) => {
  if (!reporte || reporte === 'PDTE' || reporte === '') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md';
};

// Función para formatear fechas sin conversión de timezone (para ETD y ETA)
const formatDateWithoutTimezone = (date: string | null | undefined) => {
  if (!date) return null;
  try {
    // Si viene como fecha ISO completa, extraer solo la parte de fecha
    if (typeof date === 'string' && date.includes('T')) {
      const dateOnly = date.split('T')[0];
      const [year, month, day] = dateOnly.split('-');
      return { year, month, day };
    }
    // Si viene como YYYY-MM-DD, formatear directamente sin conversión de zona horaria
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = date.split('-');
      return { year, month, day };
    }
    // Para otros formatos, usar métodos UTC sin conversión de zona horaria
    const dateObj = new Date(date);
    const year = String(dateObj.getUTCFullYear());
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    return { year, month, day };
  } catch {
    return null;
  }
};

// Helper function to get header background color based on column key and module origin
const getColumnHeaderBgColor = (columnKey: string): string => {
  // Columns from Auctions (amber-200 - café)
  if (['epa', 'cpd', 'currency_type', 'auction_price_bought', 'incoterm'].includes(columnKey)) {
    return 'bg-amber-200 text-gray-800';
  }
  // Columns from Pagos (orange-100 for pagos color)
  if (['usd_jpy_rate', 'trm_rate', 'payment_date'].includes(columnKey)) {
    return 'bg-orange-100 text-gray-800';
  }
  // Columns from Importations (amber-100)
  if (['mq', 'shipment_departure_date', 'shipment_arrival_date'].includes(columnKey)) {
    return 'bg-amber-100 text-gray-800';
  }
  // Columns from Purchases (indigo-100) - all other purchase-specific columns including actions/view
  const purchaseColumns = [
    'invoice_number', 'invoice_date', 'due_date', 'location', 'port_of_embarkation',
    'exw_value_formatted', 'fob_expenses', 'disassembly_load_value', 'fob_total',
    'cif_usd', 'sales_reported', 'commerce_reported', 'luis_lemus_reported',
    'actions', 'view', 'pending_marker'
  ];
  if (purchaseColumns.includes(columnKey)) {
    return 'bg-indigo-100 text-gray-800';
  }
  // Default (no special color) - other columns like supplier, brand, model, etc.
  return 'bg-indigo-100 text-gray-800';
};

const getPaymentStatusStyle = (status: PaymentStatus | null | undefined) => {
  if (!status) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  if (status === 'PENDIENTE') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-md';
  } else if (status === 'DESBOLSADO') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md';
  } else if (status === 'COMPLETADO') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const SHIPMENT_OPTIONS = [
  { value: 'RORO', label: 'RORO' },
  { value: '1X40', label: '1 x 40' },
  { value: '1X20', label: '1 x 20' },
  { value: 'LCL', label: 'LCL' },
  { value: 'AEREO', label: 'Aéreo' },
];

const REPORT_STATUS_OPTIONS = [
  { value: 'PDTE', label: 'PDTE' },
  { value: 'OK', label: 'OK' },
];

const parseCurrencyValue = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(numeric) ? null : numeric;
};

const getCurrencySymbol = (currency?: string | null): string => {
  if (!currency) return '$';
  const upperCurrency = currency.toUpperCase();
  if (upperCurrency === 'USD') return '$';
  if (upperCurrency === 'JPY') return '¥';
  if (upperCurrency === 'GBP') return '£';
  if (upperCurrency === 'EUR') return '€';
  return '$'; // Default
};

const formatCurrencyDisplay = (
  currency: string | null | undefined,
  value: string | number | null | undefined
) => {
  const numeric = parseCurrencyValue(value);
  if (numeric === null) {
    return <span className="text-gray-400">Sin definir</span>;
  }
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: (currency as Intl.NumberFormatOptions['currency']) || 'USD',
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return numeric.toLocaleString('es-CO');
  }
};

const formatCurrencyWithSymbol = (
  currency: string | null | undefined,
  value: number | null | undefined
): string => {
  if (value === null || value === undefined) return 'Sin definir';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'Sin definir';
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${numeric.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Función para ordenar MQ correctamente:
 * - MQ numéricos (MQ824) van primero, ordenados numéricamente
 * - MQ aleatorios (MQ-1aa7ed) van al final
 */
const compareMQ = (mqA: string | null | undefined, mqB: string | null | undefined): number => {
  const a = (mqA || '').trim().toUpperCase();
  const b = (mqB || '').trim().toUpperCase();
  
  // Si alguno está vacío, va al final
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  
  // Extraer número de MQ numéricos (ej: MQ824 -> 824)
  const numMatchA = a.match(/^MQ(\d+)$/);
  const numMatchB = b.match(/^MQ(\d+)$/);
  
  const numA = numMatchA ? parseInt(numMatchA[1], 10) : null;
  const numB = numMatchB ? parseInt(numMatchB[1], 10) : null;
  
  // Si ambos son numéricos, comparar numéricamente
  if (numA !== null && numB !== null) {
    return numA - numB;
  }
  
  // Si solo A es numérico, A va primero
  if (numA !== null) return -1;
  
  // Si solo B es numérico, B va primero
  if (numB !== null) return 1;
  
  // Si ninguno es numérico, ordenar alfabéticamente
  return a.localeCompare(b);
};

export const PurchasesPage = () => {
  const { userProfile } = useAuth();
  const isAdminUser = userProfile?.role === 'admin';
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithRelations | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Filtros de columnas
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [machineTypeFilter, setMachineTypeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState('');
  const [paymentDateFilter, setPaymentDateFilter] = useState('');
  const [mqFilter, setMqFilter] = useState('');
  const [mqSortOrder, setMqSortOrder] = useState<'asc' | 'desc' | null>(null); // null = sin ordenar, 'asc' = ascendente, 'desc' = descendente
  const [tipoFilter, setTipoFilter] = useState('');
  const [shipmentFilter, setShipmentFilter] = useState('');
  const [serialFilter, setSerialFilter] = useState('');
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState('');
  const [portFilter, setPortFilter] = useState('');
  const [cpdFilter, setCpdFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [incotermFilter, setIncotermFilter] = useState('');
  const [eddFilter, setEddFilter] = useState('');
  const [edaFilter, setEdaFilter] = useState('');
  const [salesReportedFilter, setSalesReportedFilter] = useState('');
  const [commerceReportedFilter, setCommerceReportedFilter] = useState('');
  const [luisLemusReportedFilter, setLuisLemusReportedFilter] = useState('');
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [openTotalValorGiradoPopover, setOpenTotalValorGiradoPopover] = useState<string | null>(null); // purchaseId
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<string>>(new Set());
  const [expandedCUs, setExpandedCUs] = useState<Set<string>>(new Set());
  const [isGrouping, setIsGrouping] = useState(false);
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { purchaseId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());
  const pendingChangeRef = useRef<{
    purchaseId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);
  
  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const { purchases, isLoading, refetch, updatePurchaseFields, deletePurchase } = usePurchases();

  // Helper para verificar si el usuario es administrador
  const isAdmin = () => {
    const userEmail = localStorage.getItem('token');
    if (!userEmail) return false;
    try {
      const payload = JSON.parse(atob(userEmail.split('.')[1]));
      return payload.email?.toLowerCase() === 'admin@partequipos.com';
    } catch {
      return false;
    }
  };

  // Handler para eliminar compra
  const handleDeletePurchase = async (purchaseId: string, purchaseInfo: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar esta compra?\n\n${purchaseInfo}\n\nEsta acción eliminará el registro de TODOS los módulos (Pagos, Importaciones, Logística, Servicio, Equipos y Management) y NO se puede deshacer.`)) {
      return;
    }

    try {
      await deletePurchase(purchaseId);
      showSuccess('Compra eliminada exitosamente de todos los módulos');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar la compra';
      showError(message);
    }
  };

  // Función para cargar indicadores de cambios (optimizada con batch endpoint)
  const loadChangeIndicators = async (purchaseIds?: string[]) => {
    const idsToLoad = purchaseIds || purchases.map(p => p.id);
    if (idsToLoad.length === 0) return;
      
      try {
      // Usar endpoint batch para obtener todos los cambios en una sola consulta
      const grouped = await apiPost<Record<string, Array<{
                id: string;
                field_name: string;
                field_label: string;
                old_value: string | number | null;
                new_value: string | number | null;
                change_reason: string | null;
                changed_at: string;
                module_name: string | null;
      }>>>(`/api/change-logs/batch`, {
        table_name: 'purchases',
        record_ids: idsToLoad
      });
              
      const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
      
      // Procesar los cambios agrupados
      Object.keys(grouped).forEach(purchaseId => {
        const changes = grouped[purchaseId];
              if (changes && changes.length > 0) {
          indicatorsMap[purchaseId] = changes.slice(0, 10).map((change) => ({
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
        
      setInlineChangeIndicators((prev) => {
        // Merge los nuevos indicadores con los existentes, pero reemplaza los de los IDs que se están recargando
        const merged = { ...prev };
        Object.keys(indicatorsMap).forEach(purchaseId => {
          merged[purchaseId] = indicatorsMap[purchaseId];
        });
        return merged;
      });
      } catch (error) {
        console.error('Error al cargar indicadores de cambios:', error);
      }
    };
    
  // Cargar indicadores de cambios desde el backend
  useEffect(() => {
    if (!isLoading && purchases.length > 0) {
      loadChangeIndicators();
    }
  }, [purchases, isLoading]);

  // Recargar indicadores periódicamente para detectar cambios desde otros módulos
  // Pausar cuando hay un campo en edición para evitar que se reinicien los campos
  useEffect(() => {
    if (!isLoading && purchases.length > 0) {
      // Recargar inmediatamente
      loadChangeIndicators();
      
      // Y luego cada 15 segundos (optimizado para reducir carga del servidor)
      // Solo recargar si no hay un cambio pendiente (campo en edición)
      const interval = setInterval(() => {
        // No recargar si hay un cambio pendiente (usuario editando)
        if (!pendingChangeRef.current) {
          loadChangeIndicators();
        }
      }, 15000); // Recargar cada 15 segundos solo si no hay edición en curso

      return () => clearInterval(interval);
    }
  }, [purchases, isLoading]);

  // Estado para menú de acciones por compra (declarado antes de su uso)
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Cerrar menú de acciones al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.action-menu-container')) {
        setActionMenuOpen(null);
      }
    };

    if (actionMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionMenuOpen]);

  // Obtener lista de CUs existentes para el modal
  const existingCUs = useMemo(() => {
    const cus = new Set<string>();
    purchases.forEach(p => {
      if (p.cu) {
        cus.add(p.cu);
      }
    });
    return Array.from(cus).sort();
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    return purchases
      .filter((purchase) => purchase.condition !== 'NUEVO') // Solo USADOS en este módulo
      .filter((purchase) => {
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
        return (
          purchase.mq?.toLowerCase().includes(search) ||
          purchase.machine?.serial?.toLowerCase().includes(search) ||
          purchase.port_of_embarkation?.toLowerCase().includes(search) ||
          purchase.machine?.model?.toLowerCase().includes(search) ||
          purchase.location?.toLowerCase().includes(search)
        );
      }
      // Filtros de columnas
      if (supplierFilter && purchase.supplier_name !== supplierFilter) return false;
      if (brandFilter && purchase.brand !== brandFilter) return false;
    const machineTypeValue = purchase.machine_type || purchase.machine?.machine_type || null;
    if (machineTypeFilter && machineTypeValue !== machineTypeFilter) return false;
      if (modelFilter && purchase.model !== modelFilter) return false;
      if (invoiceDateFilter) {
        const invoiceDate = purchase.invoice_date ? new Date(purchase.invoice_date).toISOString().split('T')[0] : '';
        if (invoiceDate !== invoiceDateFilter) return false;
      }
      if (paymentDateFilter) {
        const paymentDate = purchase.payment_date ? new Date(purchase.payment_date).toISOString().split('T')[0] : '';
        if (paymentDate !== paymentDateFilter) return false;
      }
      if (mqFilter && purchase.mq !== mqFilter) return false;
      if (tipoFilter && purchase.purchase_type !== tipoFilter) return false;
      if (shipmentFilter && purchase.shipment_type_v2 !== shipmentFilter) return false;
      if (serialFilter && purchase.serial !== serialFilter) return false;
      if (invoiceNumberFilter && purchase.invoice_number !== invoiceNumberFilter) return false;
      if (locationFilter && purchase.location !== locationFilter) return false;
      if (empresaFilter && purchase.empresa !== empresaFilter) return false;
      if (portFilter && purchase.port_of_embarkation !== portFilter) return false;
      if (cpdFilter && purchase.cpd !== cpdFilter) return false;
      if (currencyFilter && purchase.currency_type !== currencyFilter) return false;
      if (incotermFilter && purchase.incoterm !== incotermFilter) return false;
      if (eddFilter) {
        const eddDate = purchase.shipment_departure_date ? new Date(purchase.shipment_departure_date).toISOString().split('T')[0] : '';
        if (eddDate !== eddFilter) return false;
      }
      if (edaFilter) {
        const edaDate = purchase.shipment_arrival_date ? new Date(purchase.shipment_arrival_date).toISOString().split('T')[0] : '';
        if (edaDate !== edaFilter) return false;
      }
      if (salesReportedFilter && purchase.sales_reported !== salesReportedFilter) return false;
      if (commerceReportedFilter && purchase.commerce_reported !== commerceReportedFilter) return false;
      if (luisLemusReportedFilter && purchase.luis_lemus_reported !== luisLemusReportedFilter) return false;
    return true;
      });
    }, [purchases, searchTerm, supplierFilter, brandFilter, machineTypeFilter, modelFilter, invoiceDateFilter, paymentDateFilter, mqFilter, tipoFilter, shipmentFilter, serialFilter, invoiceNumberFilter, locationFilter, empresaFilter, portFilter, cpdFilter, currencyFilter, incotermFilter, eddFilter, edaFilter, salesReportedFilter, commerceReportedFilter, luisLemusReportedFilter]);

  // Valores únicos para filtros
  const uniqueSuppliers = Array.from(new Set(purchases.map(p => p.supplier_name).filter((s): s is string => Boolean(s)))).sort();
  const uniqueBrands = Array.from(new Set(purchases.map(p => p.brand).filter((b): b is string => Boolean(b)))).sort();
  const uniqueMachineTypes = Array.from(new Set(
    purchases
      .map(p => p.machine_type || p.machine?.machine_type)
      .filter((t): t is string => Boolean(t))
  )).sort();
  const uniqueModels = Array.from(new Set(purchases.map(p => p.model).filter((m): m is string => Boolean(m)))).sort();
  const uniqueInvoiceDates = Array.from(new Set(
    purchases
      .map(p => p.invoice_date ? new Date(p.invoice_date).toISOString().split('T')[0] : null)
      .filter((d): d is string => Boolean(d))
  )).sort().reverse();
  const uniquePaymentDates = Array.from(new Set(
    purchases
      .map(p => p.payment_date ? new Date(p.payment_date).toISOString().split('T')[0] : null)
      .filter((d): d is string => Boolean(d))
  )).sort().reverse();
  const uniqueMqs = Array.from(new Set(purchases.map(p => p.mq).filter((m): m is string => Boolean(m)))).sort();
  const uniqueTipos = Array.from(new Set(purchases.map(p => p.purchase_type).filter(t => t != null))).sort() as string[];
  const uniqueSerials = Array.from(new Set(purchases.map(p => p.serial).filter((s): s is string => Boolean(s)))).sort();
  const uniqueInvoiceNumbers = Array.from(new Set(purchases.map(p => p.invoice_number).filter((i): i is string => Boolean(i)))).sort();
  const uniqueLocations = Array.from(new Set(purchases.map(p => p.location).filter((l): l is string => Boolean(l)))).sort();
  const uniqueEmpresas = Array.from(new Set(purchases.map(p => p.empresa).filter((e): e is string => Boolean(e)))).sort();
  const uniquePorts = Array.from(new Set(purchases.map(p => p.port_of_embarkation).filter((p): p is string => Boolean(p)))).sort();
  const uniqueCpds = Array.from(new Set(purchases.map(p => p.cpd).filter((c): c is string => Boolean(c)))).sort();
  const uniqueCurrencies = Array.from(new Set(purchases.map(p => p.currency_type).filter((c): c is string => Boolean(c)))).sort();
  const uniqueIncoterms = Array.from(new Set(purchases.map(p => p.incoterm).filter(i => i != null))).sort() as string[];
  const uniqueEdds = Array.from(new Set(
    purchases
      .map(p => p.shipment_departure_date ? new Date(p.shipment_departure_date).toISOString().split('T')[0] : null)
      .filter((d): d is string => Boolean(d))
  )).sort().reverse();
  const uniqueEdas = Array.from(new Set(
    purchases
      .map(p => p.shipment_arrival_date ? new Date(p.shipment_arrival_date).toISOString().split('T')[0] : null)
      .filter((d): d is string => Boolean(d))
  )).sort().reverse();

  // Agrupar compras por CU
  const groupedPurchases = useMemo(() => {
    type GroupMeta = {
      purchases: PurchaseWithRelations[];
    };

    const groups = new Map<string, GroupMeta>();
    const ungrouped: PurchaseWithRelations[] = [];

    filteredPurchases.forEach((purchase) => {
      if (purchase.cu) {
        if (!groups.has(purchase.cu)) {
          groups.set(purchase.cu, { purchases: [] });
        }
        groups.get(purchase.cu)!.purchases.push(purchase);
      } else {
        ungrouped.push(purchase);
      }
    });

    // Función de ordenamiento que respeta mqSortOrder
    const sortByMQ = (a: PurchaseWithRelations, b: PurchaseWithRelations) => {
      if (mqSortOrder === null) {
        // Sin ordenar, mantener orden original
        return 0;
      }
      const comparison = compareMQ(a.mq, b.mq);
      return mqSortOrder === 'asc' ? comparison : -comparison;
    };

    const grouped = Array.from(groups.entries())
      .map(([cu, meta]) => {
        // Primero ordenar por created_at DESC (más recientes primero)
        const sortedPurchases = [...meta.purchases].sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          // Ordenar por fecha descendente (más recientes primero)
          if (dateB !== dateA) {
            return dateB - dateA;
          }
          // Si tienen la misma fecha, ordenar por MQ si mqSortOrder está activo
          if (mqSortOrder !== null) {
            return sortByMQ(a, b);
          }
          // Si no hay ordenamiento MQ, mantener orden por fecha
          return 0;
        });
        
        return {
          cu,
          purchases: sortedPurchases,
          totalPurchases: meta.purchases.length,
        };
      })
      .sort((a, b) => {
        // Ordenar grupos por fecha de creación del primer registro (más reciente primero)
        const dateA = new Date(a.purchases[0]?.created_at || 0).getTime();
        const dateB = new Date(b.purchases[0]?.created_at || 0).getTime();
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        // Si tienen la misma fecha, ordenar por MQ si mqSortOrder está activo
        if (mqSortOrder !== null) {
          const comparison = compareMQ(a.purchases[0]?.mq, b.purchases[0]?.mq);
          return mqSortOrder === 'asc' ? comparison : -comparison;
        }
        return 0;
      });

    // Ordenar ungrouped por created_at DESC (más recientes primero)
    const sortedUngrouped = ungrouped.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      // Ordenar por fecha descendente (más recientes primero)
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      // Si tienen la misma fecha, ordenar por MQ si mqSortOrder está activo
      if (mqSortOrder !== null) {
        return sortByMQ(a, b);
      }
      // Si no hay ordenamiento MQ, mantener orden por fecha
      return 0;
    });

    return { grouped, ungrouped: sortedUngrouped };
  }, [filteredPurchases, mqSortOrder]);

  // Estadísticas
  // Compras Activas (con estado PENDIENTE o DESBOLSADO)
  const activePurchases = filteredPurchases.filter(p => 
    p.payment_status === 'PENDIENTE' || p.payment_status === 'DESBOLSADO'
  ).length;
  
  // Pagos Pendientes - calcular monto total
  const pendingPaymentsAmount = filteredPurchases
    .filter(p => p.payment_status === 'PENDIENTE')
    .reduce((sum, p) => {
      const exw = parseFloat(p.exw_value_formatted?.replace(/[^0-9.-]/g, '') || '0');
      const disassembly = parseFloat(String(p.disassembly_load_value ?? 0));
      const total = exw + disassembly;
      return sum + total;
    }, 0);
  
  // Envíos en Tránsito (con fecha de salida pero sin llegada o fecha de llegada no cumplida)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const shipmentsInTransit = filteredPurchases.filter(p => {
    if (!p.shipment_departure_date) return false;
    // Si no tiene fecha de llegada, está en tránsito
    if (!p.shipment_arrival_date) return true;
    // Si tiene fecha de llegada pero no se ha cumplido, está en tránsito
    const arrivalDate = new Date(p.shipment_arrival_date);
    arrivalDate.setHours(0, 0, 0, 0);
    return arrivalDate > today;
  }).length;
  
  // Total Completados (los que tengan fecha de pago)
  const totalPaidCorrected = filteredPurchases.filter(p => p.payment_date).length;

  
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.change-popover') && !target.closest('.change-indicator-btn')) {
        setOpenChangePopover(null);
      }
      if (!target.closest('.total-valor-girado-popover') && !target.closest('.fob-verified-btn')) {
        setOpenTotalValorGiradoPopover(null);
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
                // El backend ahora siempre retorna module_name (usando table_name como fallback)
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('compras');
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

  const handleSaveWithToasts = async (action: () => Promise<unknown>) => {
    try {
      await action();
      showSuccess('Dato actualizado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el dato';
      showError(message);
      throw error;
    }
  };

  const handleExportAll = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      console.log('📥 Exportando todas las compras...');
      
      // Obtener token del localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      if (!token) {
        showError('Debes estar autenticado para exportar las compras');
        return;
      }

      // Llamar al endpoint de exportación
      const response = await fetch('/api/purchases/export', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Obtener el blob del CSV
      const blob = await response.blob();
      
      // Crear URL temporal para descarga
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Nombre del archivo con timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `compras_export_${timestamp}.csv`;
      
      // Descargar
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Limpiar URL temporal
      URL.revokeObjectURL(url);
      
      console.log('✅ Exportación completada!');
      showSuccess('Exportación completada. Revisa tus descargas.');
    } catch (error) {
      console.error('❌ Error al exportar:', error);
      const message = error instanceof Error ? error.message : 'Error al exportar las compras';
      showError(message);
    } finally {
      setIsExporting(false);
    }
  };

  const queueInlineChange = (
    purchaseId: string,
    updates: Record<string, unknown>,
    changeItem: InlineChangeItem
  ) => {
    // Si el modo batch está activo, acumular cambios en lugar de abrir el modal
    if (batchModeEnabled) {
      setPendingBatchChanges((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(purchaseId);
        
        if (existing) {
          // Combinar updates y agregar el nuevo cambio
          const mergedUpdates = { ...existing.updates, ...updates };
          const mergedChanges = [...existing.changes, changeItem];
          newMap.set(purchaseId, {
            purchaseId,
            updates: mergedUpdates,
            changes: mergedChanges,
          });
        } else {
          newMap.set(purchaseId, {
            purchaseId,
            updates,
            changes: [changeItem],
          });
        }
        
        return newMap;
      });
      
      // En modo batch, guardar en BD inmediatamente para reflejar cambios visualmente
      // pero NO registrar en control de cambios hasta que se confirme
      return updatePurchaseFields(purchaseId, updates as Partial<PurchaseWithRelations>)
        .catch((error) => {
          console.error('Error guardando cambio en modo batch:', error);
          throw error;
        });
    }
    
    // Modo normal: abrir modal inmediatamente
    return new Promise<void>((resolve, reject) => {
      pendingChangeRef.current = {
        purchaseId,
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
    const allUpdatesByPurchase = new Map<string, { purchaseId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>();
    const allChanges: InlineChangeItem[] = [];
    
    pendingBatchChanges.forEach((batch) => {
      allChanges.push(...batch.changes);
      allUpdatesByPurchase.set(batch.purchaseId, batch);
    });

    try {
      // Solo registrar cambios en el log (los datos ya están guardados en BD)
      const logPromises = Array.from(allUpdatesByPurchase.values()).map(async (batch) => {
        // Registrar cambios en el log
        await apiPost('/api/change-logs', {
          table_name: 'purchases',
          record_id: batch.purchaseId,
          changes: batch.changes,
          change_reason: reason || null,
          module_name: 'compras',
        });

        // Actualizar indicadores
        await loadChangeIndicators([batch.purchaseId]);
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
    if (pending.purchaseId === 'BATCH_MODE') {
      await confirmBatchChanges(reason);
      return;
    }
    
    try {
      await handleSaveWithToasts(() =>
        updatePurchaseFields(pending.purchaseId, pending.updates as Partial<PurchaseWithRelations>)
      );
      await apiPost('/api/change-logs', {
        table_name: 'purchases',
        record_id: pending.purchaseId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'compras',
      });
      // Recargar indicadores desde el backend para obtener los datos actualizados
      await loadChangeIndicators([pending.purchaseId]);
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

  const getRecordFieldValue = (
    record: PurchaseWithRelations,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    purchase: PurchaseWithRelations,
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

  const requestFieldUpdate = async (
    purchase: PurchaseWithRelations,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>
  ) => {
    const currentValue = getRecordFieldValue(purchase, fieldName);
    
    // Para campos de reporte (sales_reported, commerce_reported, luis_lemus_reported)
    // guardar directamente sin control de cambios
    const reportFields = ['sales_reported', 'commerce_reported', 'luis_lemus_reported'];
    if (reportFields.includes(fieldName)) {
      const updatesToApply = updates ?? { [fieldName]: newValue };
      await updatePurchaseFields(purchase.id, updatesToApply as Partial<PurchaseWithRelations>);
      showSuccess('Dato actualizado');
      return;
    }
    
    // MEJORA: Si el campo está vacío y se agrega un valor, NO solicitar control de cambios
    // Solo solicitar control de cambios cuando se MODIFICA un valor existente
    const isCurrentValueEmpty = isValueEmpty(currentValue);
    const isNewValueEmpty = isValueEmpty(newValue);
    
    // Si el campo estaba vacío y ahora se agrega un valor, guardar directamente sin control de cambios
    if (isCurrentValueEmpty && !isNewValueEmpty) {
      const updatesToApply = updates ?? { [fieldName]: newValue };
      await updatePurchaseFields(purchase.id, updatesToApply as Partial<PurchaseWithRelations>);
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
      purchaseId: 'BATCH_MODE',
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
    moduleName: 'Compras'
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


  // Función para toggle el marcador de pendiente
  const togglePurchaseSelection = (purchaseId: string) => {
    setSelectedPurchaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(purchaseId)) {
        next.delete(purchaseId);
      } else {
        next.add(purchaseId);
      }
      return next;
    });
  };

  const toggleAllPurchasesSelection = () => {
    if (selectedPurchaseIds.size === filteredPurchases.length) {
      setSelectedPurchaseIds(new Set());
    } else {
      setSelectedPurchaseIds(new Set(filteredPurchases.map(p => p.id)));
    }
  };

  const handleGroupPurchases = async () => {
    if (selectedPurchaseIds.size === 0) {
      showError('Selecciona al menos una compra para agrupar');
      return;
    }

    setIsGrouping(true);
    try {
      const result = await apiPost<{ success: boolean; cu: string; count: number; message: string }>('/api/purchases/group-by-cu', {
        purchase_ids: Array.from(selectedPurchaseIds),
      });

      showSuccess(result.message || `${result.count} compra(s) agrupada(s) en CU ${result.cu}`);
      setSelectedPurchaseIds(new Set());
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al agrupar compras';
      showError(message);
    } finally {
      setIsGrouping(false);
    }
  };

  // Estado para modal de mover a otro CU
  const [moveToCUModal, setMoveToCUModal] = useState<{
    open: boolean;
    purchaseIds: string[];
    currentCU?: string;
  }>({ open: false, purchaseIds: [] });

  // Función para desagrupar una compra
  const handleUngroupPurchase = async (purchaseId: string) => {
    try {
      await apiDelete(`/api/purchases/ungroup/${purchaseId}`);
      showSuccess('Compra desagrupada exitosamente');
      setActionMenuOpen(null);
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al desagrupar compra';
      showError(message);
    }
  };

  // Función para desagrupar múltiples compras
  const handleUngroupMultiple = async (purchaseIds: string[]) => {
    try {
      await Promise.all(purchaseIds.map(id => apiDelete(`/api/purchases/ungroup/${id}`)));
      showSuccess(`${purchaseIds.length} compra(s) desagrupada(s) exitosamente`);
      setActionMenuOpen(null);
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al desagrupar compras';
      showError(message);
    }
  };

  // Función para abrir modal de mover a otro CU
  const handleOpenMoveToCU = (purchaseIds: string[], currentCU?: string) => {
    setMoveToCUModal({ open: true, purchaseIds, currentCU });
    setActionMenuOpen(null);
  };

  // Función para migrar CUs antiguos
  const handleMigrateOldCUs = async () => {
    try {
      const result = await apiPost<{ success: boolean; message: string; migrated: Array<{ oldCu: string; newCu: string; count: number }> }>('/api/purchases/migrate-old-cus', {});
      showSuccess(result.message);
      if (result.migrated && result.migrated.length > 0) {
        console.log('CUs migrados:', result.migrated);
      }
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al migrar CUs antiguos';
      showError(message);
    }
  };

  // Función para mover compras a otro CU
  const handleMoveToCU = async (targetCU: string) => {
    try {
      if (!targetCU || targetCU.trim() === '') {
        showError('El CU destino no puede estar vacío');
        return;
      }

      await apiPost('/api/purchases/group-by-cu', {
        purchase_ids: moveToCUModal.purchaseIds,
        cu: targetCU.trim()
      });

      showSuccess(`${moveToCUModal.purchaseIds.length} compra(s) movida(s) al CU ${targetCU}`);
      setMoveToCUModal({ open: false, purchaseIds: [] });
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al mover compras';
      showError(message);
    }
  };

  const toggleCUExpansion = (cu: string) => {
    setExpandedCUs((prev) => {
      const next = new Set(prev);
      if (next.has(cu)) {
        next.delete(cu);
      } else {
        next.add(cu);
      }
      return next;
    });
  };

  // Preparar datos para mostrar: primero grupos de CU, luego compras sin agrupar
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const displayData = useMemo(() => {
    type DisplayItem = { type: 'group'; data: { cu: string; purchases: PurchaseWithRelations[]; totalPurchases: number } } | { type: 'purchase'; data: PurchaseWithRelations };
    const result: DisplayItem[] = [];
    
    // Agregar grupos de CU
    groupedPurchases.grouped.forEach((group) => {
      result.push({ type: 'group', data: group });
      if (expandedCUs.has(group.cu)) {
        group.purchases.forEach((purchase) => {
          result.push({ type: 'purchase', data: purchase });
        });
      }
    });
    
    // Agregar compras sin agrupar
    groupedPurchases.ungrouped.forEach((purchase) => {
      result.push({ type: 'purchase', data: purchase });
    });
    
    return result;
  }, [groupedPurchases, expandedCUs]);

  const handleTogglePending = async (purchaseId: string) => {
    try {
      await apiPatch(`/api/purchases/${purchaseId}/toggle-pending`, {});
      await refetch();
      showSuccess('Marcador actualizado');
    } catch (error) {
      console.error('Error al actualizar marcador:', error);
      showError('Error al actualizar marcador');
    }
  };

  const columns: Column<PurchaseWithRelations>[] = [
    {
      key: 'select',
      label: '✓',
      sortable: false,
      render: (row: PurchaseWithRelations) => (
        <input
          type="checkbox"
          checked={selectedPurchaseIds.has(row.id)}
          onChange={() => togglePurchaseSelection(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
      ),
    },
    {
      key: 'pending_marker',
      label: '⚠️',
      sortable: false,
      render: (row: PurchaseWithRelations) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTogglePending(row.id);
          }}
          className={`p-2 rounded-lg transition-all duration-200 ${
            row.pending_marker
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
          title={row.pending_marker ? 'Marcado como pendiente' : 'Marcar como pendiente'}
        >
          <AlertCircle className="w-5 h-5" />
        </button>
      ),
    },
    {
      key: 'mq',
      label: 'MQ',
      sortable: true,
      filter: (
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
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'mq')}>
        <span className="font-mono text-gray-700">{row.mq || '-'}</span>
        </InlineCell>
      ),
    },
    {
      key: 'purchase_type',
      label: 'TIPO',
      sortable: true,
      filter: (
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueTipos.map(tipo => (
            <option key={tipo || ''} value={tipo || ''}>
              {tipo === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : tipo}
            </option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-800 font-semibold">
          {row.purchase_type === 'COMPRA_DIRECTA'
            ? 'COMPRA DIRECTA'
            : row.purchase_type || 'Sin tipo'}
        </span>
      ),
    },
    {
      key: 'shipment_type_v2',
      label: 'SHIPMENT',
      sortable: true,
      filter: (
        <select
          value={shipmentFilter}
          onChange={(e) => setShipmentFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {SHIPMENT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'shipment_type_v2')}>
          <InlineFieldEditor
            value={row.shipment_type_v2 || ''}
            type="select"
            placeholder="Tipo de envío"
            options={SHIPMENT_OPTIONS}
            displayFormatter={(val) =>
              val ? SHIPMENT_OPTIONS.find((opt) => opt.value === val)?.label || val : 'Sin definir'
            }
            onSave={(val) => requestFieldUpdate(row, 'shipment_type_v2', 'Tipo de envío', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'supplier_name',
      label: 'PROVEEDOR',
      sortable: true,
      filter: (
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
      ),
      render: (row: PurchaseWithRelations) => (
        <span className="font-semibold text-gray-900">{row.supplier_name || 'Sin proveedor'}</span>
      ),
    },
    {
      key: 'empresa',
      label: 'EMPRESA',
      sortable: true,
      filter: (
        <select
          value={empresaFilter}
          onChange={(e) => setEmpresaFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {uniqueEmpresas.map(empresa => (
            <option key={empresa || ''} value={empresa || ''}>{empresa}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'empresa')}>
          <InlineFieldEditor
            value={row.empresa || ''}
            type="select"
            options={EMPRESA_OPTIONS}
            placeholder="Seleccionar empresa"
            onSave={(val) => requestFieldUpdate(row, 'empresa', 'Empresa', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'machine_type',
      label: 'TIPO MÁQUINA',
      sortable: true,
      filter: (
        <select
          value={machineTypeFilter}
          onChange={(e) => setMachineTypeFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {MACHINE_TYPE_OPTIONS.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'machine_type')}>
          <InlineFieldEditor
            value={row.machine_type || ''}
            type="select"
            options={MACHINE_TYPE_OPTIONS_PRESELECTION_CONSOLIDADO_COMPRAS}
            placeholder="Tipo de máquina"
            displayFormatter={(val) => formatMachineType(val) || 'Sin tipo'}
            onSave={(val) => requestFieldUpdate(row, 'machine_type', 'Tipo de máquina', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'brand',
      label: 'MARCA',
      sortable: true,
      filter: (
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
      ),
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-800 uppercase tracking-wide">{row.brand || 'Sin marca'}</span>
      ),
    },
    {
      key: 'model',
      label: 'MODELO',
      sortable: true,
      filter: (
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueModels.map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-800">{row.model || 'Sin modelo'}</span>
      ),
    },
    {
      key: 'serial',
      label: 'SERIAL',
      sortable: true,
      filter: (
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
      ),
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-800 font-mono">{row.serial || 'Sin serial'}</span>
      ),
    },
    {
      key: 'invoice_number',
      label: 'No. FACTURA PROFORMA',
      sortable: true,
      filter: (
        <select
          value={invoiceNumberFilter}
          onChange={(e) => setInvoiceNumberFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueInvoiceNumbers.map(invoice => (
            <option key={invoice || ''} value={invoice || ''}>{invoice}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'invoice_number')}>
          <InlineFieldEditor
            value={row.invoice_number || ''}
            placeholder="No. Factura Proforma"
            onSave={(val) => requestFieldUpdate(row, 'invoice_number', 'No. Factura Proforma', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'invoice_date',
      label: 'FECHA FACTURA',
      sortable: true,
      filter: (
        <select
          value={invoiceDateFilter}
          onChange={(e) => setInvoiceDateFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {uniqueInvoiceDates.map(date => (
            <option key={date || ''} value={date || ''}>{date ? new Date(date + 'T00:00:00').toLocaleDateString('es-CO') : ''}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => {
        // Helper para convertir fecha sin problemas de zona horaria
        const formatDateForInput = (dateValue: string | Date | null | undefined): string => {
          if (!dateValue) return '';
          
          try {
            // Si ya viene en formato YYYY-MM-DD, retornarlo directamente
            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
              return dateValue;
            }
            
            // Si viene como Date object, extraer componentes directamente
            let date: Date;
            if (dateValue && typeof dateValue === 'object' && 'getTime' in dateValue) {
              date = dateValue as Date;
            } else if (typeof dateValue === 'string') {
              // Si ya incluye 'T', extraer solo la parte de fecha
              const dateOnly = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
              // Validar que tenga el formato correcto
              if (!/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) {
                // Intentar parsear como fecha completa
                date = new Date(dateValue);
              } else {
                // Usar la fecha directamente con hora local
                const parts = dateOnly.split('-');
                if (parts.length === 3) {
                  date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                } else {
                  date = new Date(dateOnly + 'T00:00:00');
                }
              }
            } else {
              return '';
            }
            
            // Verificar si la fecha es válida
            if (isNaN(date.getTime())) {
              return '';
            }
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          } catch (error) {
            console.error('Error formatting date:', error, dateValue);
            return '';
          }
        };

        return (
        <InlineCell {...buildCellProps(row.id, 'invoice_date')}>
          <InlineFieldEditor
              value={formatDateForInput(row.invoice_date)}
            type="date"
            placeholder="Fecha factura"
              onSave={async (val) => {
                let invoiceDateValue: string | null = null;
                let dueDateValue: string | null = null;
                
                if (typeof val === 'string' && val) {
                  // Guardar fecha sin problemas de zona horaria
                  invoiceDateValue = val; // Formato YYYY-MM-DD que PostgreSQL acepta directamente
                  
                  // Calcular vencimiento: 10 días después
                  const invoiceDate = new Date(val + 'T00:00:00');
                  invoiceDate.setDate(invoiceDate.getDate() + 10);
                  const year = invoiceDate.getFullYear();
                  const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
                  const day = String(invoiceDate.getDate()).padStart(2, '0');
                  dueDateValue = `${year}-${month}-${day}`;
                }
                
                await requestFieldUpdate(
                row,
                'invoice_date',
                'Fecha factura',
                  invoiceDateValue,
                {
                    invoice_date: invoiceDateValue,
                    due_date: dueDateValue,
                }
                );
              }}
              displayFormatter={(val) => {
                if (!val) return 'Sin fecha';
                try {
                  // Si viene como string YYYY-MM-DD, parsearlo correctamente
                  const dateStr = String(val);
                  const date = dateStr.includes('T') 
                    ? new Date(dateStr)
                    : new Date(dateStr + 'T00:00:00');
                  
                  if (isNaN(date.getTime())) {
                    return 'Sin fecha';
                  }
                  
                  return date.toLocaleDateString('es-CO');
                } catch {
                  return 'Sin fecha';
            }
              }}
          />
        </InlineCell>
        );
      },
    },
    {
      key: 'due_date',
      label: 'VENCIMIENTO',
      sortable: true,
      render: (row: PurchaseWithRelations) => {
        // Helper para convertir fecha sin problemas de zona horaria
        const formatDateForInput = (dateValue: string | Date | null | undefined): string => {
          if (!dateValue) return '';
          
          try {
            // Si ya viene en formato YYYY-MM-DD, retornarlo directamente
            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
              return dateValue;
            }
            
            // Si viene como Date object
            let date: Date;
            if (dateValue && typeof dateValue === 'object' && 'getTime' in dateValue) {
              date = dateValue as Date;
            } else if (typeof dateValue === 'string') {
              // Si ya incluye 'T', extraer solo la parte de fecha
              const dateOnly = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
              // Validar formato
              if (!/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) {
                date = new Date(dateValue);
              } else {
                const parts = dateOnly.split('-');
                if (parts.length === 3) {
                  date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                } else {
                  date = new Date(dateOnly + 'T00:00:00');
                }
              }
            } else {
              return '';
            }
            
            if (isNaN(date.getTime())) {
              return '';
            }
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          } catch (error) {
            console.error('Error formatting due_date:', error, dateValue);
            return '';
          }
        };

        return (
          <InlineCell {...buildCellProps(row.id, 'due_date')}>
            <InlineFieldEditor
              value={formatDateForInput((row as any).due_date)}
              type="date"
              placeholder="Fecha vencimiento (auto: +10 días)"
              disabled={true}
              onSave={() => {}}
              displayFormatter={(val) => {
                if (!val) return '-';
                try {
                  const date = new Date(String(val) + 'T00:00:00');
                  return date.toLocaleDateString('es-CO');
                } catch {
                  return '-';
                }
              }}
            />
          </InlineCell>
        );
      },
    },
    {
      key: 'location',
      label: 'UBICACIÓN MÁQUINA',
      sortable: true,
      filter: (
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueLocations.map(location => (
            <option key={location || ''} value={location || ''}>{location}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'location')}>
          <InlineFieldEditor
            value={row.location || ''}
            type="select"
            placeholder='Ubicación'
            options={LOCATION_OPTIONS}
            onSave={(val) => requestFieldUpdate(row, 'location', 'Ubicación', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'port_of_embarkation',
      label: 'PUERTO EMBARQUE',
      sortable: true,
      filter: (
        <select
          value={portFilter}
          onChange={(e) => setPortFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniquePorts.map(port => (
            <option key={port || ''} value={port || ''}>{port}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'port_of_embarkation')}>
          <InlineFieldEditor
            value={row.port_of_embarkation || ''}
            type="select"
            placeholder="Puerto"
            options={PORT_OPTIONS}
            onSave={(val) => requestFieldUpdate(row, 'port_of_embarkation', 'Puerto de embarque', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'epa',
      label: 'EPA',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'epa')}>
          <InlineFieldEditor
            value={row.epa || ''}
            type="select"
            placeholder="EPA"
            options={[
              { value: 'SI', label: 'Si' },
              { value: 'NO', label: 'No' },
            ]}
            displayFormatter={(val) => val || 'Sin definir'}
            onSave={(val) => requestFieldUpdate(row, 'epa', 'EPA', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'cpd',
      label: 'CPD',
      sortable: true,
      filter: (
        <select
          value={cpdFilter}
          onChange={(e) => setCpdFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          <option value="VERDE">✓ Verde</option>
          <option value="ROJA">✗ Roja</option>
        </select>
      ),
      render: (row: PurchaseWithRelations) => {
        // Normalizar el valor de CPD - manejar diferentes formatos
        const rawCpd = row.cpd;
        let cpdValue: string | null = null;
        if (rawCpd) {
          const strValue = String(rawCpd).trim().toUpperCase();
          if (strValue === 'VERDE' || strValue === 'ROJA' || strValue === 'X') {
            cpdValue = strValue === 'X' ? 'ROJA' : strValue;
          }
        }
        // Determinar el estado actual
        const isVerde = cpdValue === 'VERDE';
        const isRoja = cpdValue === 'ROJA';
        
        return (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                  console.log('🟢 Click en VERDE, row.id:', row.id, 'row.cpd actual:', row.cpd);
                  // CPD es un toggle simple, guardar directamente sin control de cambios
                  const result = await updatePurchaseFields(row.id, { cpd: 'VERDE' } as Partial<PurchaseWithRelations>);
                  console.log('✅ Resultado de updatePurchaseFields:', result);
                  showSuccess('CPD actualizado a VERDE');
                } catch (error) {
                  console.error('❌ Error actualizando CPD a VERDE:', error);
                  showError('Error al actualizar CPD');
                }
              }}
              className={`
                w-5 h-5 rounded flex items-center justify-center font-bold text-sm
                transition-all duration-200 cursor-pointer
                ${isVerde
                  ? 'bg-green-500 text-white shadow-md ring-1 ring-green-300' 
                  : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600 border border-gray-300'
                }
              `}
              title="Marcar como VERDE"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                  console.log('🔴 Click en ROJA, row.id:', row.id, 'row.cpd actual:', row.cpd);
                  // CPD es un toggle simple, guardar directamente sin control de cambios
                  const result = await updatePurchaseFields(row.id, { cpd: 'ROJA' } as Partial<PurchaseWithRelations>);
                  console.log('✅ Resultado de updatePurchaseFields:', result);
                  showSuccess('CPD actualizado a ROJA');
                } catch (error) {
                  console.error('❌ Error actualizando CPD a ROJA:', error);
                  showError('Error al actualizar CPD');
                }
              }}
              className={`
                w-5 h-5 rounded flex items-center justify-center font-bold text-sm
                transition-all duration-200 cursor-pointer
                ${isRoja
                  ? 'bg-red-500 text-white shadow-md ring-1 ring-red-300' 
                  : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600 border border-gray-300'
                }
              `}
              title="Marcar como ROJA"
            >
              ✗
            </button>
          </div>
        );
      },
    },
    {
      key: 'currency_type',
      label: 'MONEDA',
      sortable: true,
      filter: (
        <select
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {uniqueCurrencies.map(currency => (
            <option key={currency || ''} value={currency || ''}>{currency}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'currency_type')}>
          <InlineFieldEditor
            value={row.currency_type || ''}
            type="select"
            placeholder="Moneda"
            options={CURRENCY_OPTIONS}
            onSave={(val) => requestFieldUpdate(row, 'currency_type', 'Moneda', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'auction_price_bought',
      label: 'PRECIO COMPRA',
      sortable: true,
      render: (row: PurchaseWithRelations & { auction_price_bought?: number | null }) => {
        const purchaseType = (row.purchase_type || '').toString().toUpperCase().replace(/\s+/g, '_').trim();
        const incoterm = (row.incoterm || '').toString().toUpperCase().trim();
        const isCompraDirecta = purchaseType === 'COMPRA_DIRECTA';
        const isFOB = incoterm === 'FOB';
        const priceBought = getPurchasePriceValue(row);

        // COMPRA DIRECTA + FOB: permitir edición del precio de compra
        if (isCompraDirecta && isFOB) {
          return (
            <InlineCell {...buildCellProps(row.id, 'auction_price_bought')}>
              <InlineFieldEditor
                type="number"
                value={priceBought ?? ''}
                placeholder="0"
                displayFormatter={(val) => {
                  const numeric = typeof val === 'number' ? val : parseCurrencyValue(val as string | number | null);
                  return numeric !== null ? formatCurrencyWithSymbol(row.currency_type, numeric) : 'Sin definir';
                }}
                onSave={(val) => {
                  const numeric =
                    val === '' || val === null ? null : typeof val === 'number' ? val : Number(val);
                  const storageValue = numeric !== null ? numeric.toString() : null;
                  return requestFieldUpdate(row, 'auction_price_bought', 'Precio compra', numeric, {
                    exw_value_formatted: storageValue,
                    exw_value: numeric,
                  });
                }}
              />
            </InlineCell>
          );
        }

        // Si INCOTERM es FOB, mostrar VALOR FOB (SUMA)
        if (incoterm === 'FOB') {
          const exw = parseFloat(row.exw_value_formatted?.replace(/[^0-9.-]/g, '') || '0');
          const fobExpenses = parseFloat(String(row.fob_expenses ?? '0'));
          const disassembly = parseFloat(String(row.disassembly_load_value ?? '0'));
          const fobTotal = exw + fobExpenses + disassembly;
          
          if (fobTotal <= 0) {
            return <span className="text-gray-400">-</span>;
          }
          
          const formatted = formatCurrencyWithSymbol(row.currency_type, fobTotal);
          return (
            <span className="text-gray-700 font-semibold">
              {formatted}
            </span>
          );
        }
        
        // En COMPRA DIRECTA permitir edición inline solo cuando es FOB
        if (isCompraDirecta && isFOB) {
          return (
            <InlineCell {...buildCellProps(row.id, 'auction_price_bought')}>
              <InlineFieldEditor
                type="number"
                value={priceBought ?? ''}
                placeholder="0"
                displayFormatter={(val) => {
                  const numeric = typeof val === 'number' ? val : parseCurrencyValue(val as string | number | null);
                  return numeric !== null ? formatCurrencyWithSymbol(row.currency_type, numeric) : 'Sin definir';
                }}
                onSave={(val) => {
                  const numeric =
                    val === '' || val === null ? null : typeof val === 'number' ? val : Number(val);
                  const storageValue = numeric !== null ? numeric.toString() : null;
                  return requestFieldUpdate(row, 'auction_price_bought', 'Precio compra', numeric, {
                    exw_value_formatted: storageValue,
                    exw_value: numeric,
                  });
                }}
              />
            </InlineCell>
          );
        }

        // SUBASTA o sin valor editable: usar precio de auction
        if (priceBought === null || priceBought === undefined) {
          return <span className="text-gray-400">-</span>;
        }

        const formatted = formatCurrencyWithSymbol(row.currency_type, priceBought);
        return (
          <span className="text-gray-700 font-semibold">
            {formatted}
          </span>
        );
      },
    },
    {
      key: 'incoterm',
      label: 'INCOTERM DE COMPRA',
      sortable: true,
      filter: (
        <select
          value={incotermFilter}
          onChange={(e) => setIncotermFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueIncoterms.map(incoterm => (
            <option key={incoterm || ''} value={incoterm || ''}>{incoterm}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'incoterm')}>
          <InlineFieldEditor
            value={row.incoterm || ''}
            type="select"
            placeholder="Incoterm"
            options={INCOTERM_OPTIONS}
            onSave={async (val) => {
              // Si se cambia a FOB, actualizar VALOR FOB (SUMA) con el valor de PRECIO COMPRA
              if (val === 'FOB') {
                const priceBought = getPurchasePriceValue(row);
                if (priceBought && priceBought > 0) {
                  // Cuando es FOB, el PRECIO COMPRA debe ser el VALOR FOB (SUMA)
                  // Actualizar exw_value_formatted con el precio de compra para que VALOR FOB (SUMA) muestre ese valor
                  // IMPORTANTE: No marcar como verificado automáticamente, el usuario debe verificar manualmente
                  const updates: Record<string, unknown> = {
                    incoterm: val,
                    exw_value_formatted: priceBought.toString(),
                    fob_expenses: '0',
                    disassembly_load_value: 0,
                    fob_total_verified: false,
                  };
                  await requestFieldUpdate(row, 'incoterm', 'Incoterm', val, updates);
                  return;
                }
              }
              // Para otros incoterms, solo actualizar el incoterm
              await requestFieldUpdate(row, 'incoterm', 'Incoterm', val);
            }}
          />
        </InlineCell>
      ),
    },
    { 
      key: 'exw_value_formatted', 
      label: 'VALOR + BP', 
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'exw_value_formatted')}>
          <InlineFieldEditor
            type="number"
            value={parseCurrencyValue(row.exw_value_formatted) ?? ''}
            placeholder="0"
            disabled={row.incoterm === 'FOB' || row.incoterm === 'CIF'}
            displayFormatter={() => {
              if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return 'N/A';
              const numeric = parseCurrencyValue(row.exw_value_formatted);
              return numeric !== null ? formatCurrencyWithSymbol(row.currency_type, numeric) : '-';
            }}
            onSave={(val) => {
              if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return Promise.resolve();
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              const storageValue = numeric !== null ? numeric.toString() : null;
              return requestFieldUpdate(row, 'exw_value_formatted', 'Valor + BP', storageValue, {
                exw_value_formatted: storageValue,
              });
            }}
          />
        </InlineCell>
      ),
    },
    {
      key: 'fob_expenses', 
      label: 'GASTOS + LAVADO', 
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'fob_expenses')}>
          <InlineFieldEditor
            type="number"
            value={row.fob_expenses ?? ''}
            placeholder="0"
            disabled={row.incoterm === 'FOB' || row.incoterm === 'CIF'}
            displayFormatter={() => {
              if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return 'N/A';
              const numeric = typeof row.fob_expenses === 'number' ? row.fob_expenses : parseCurrencyValue(row.fob_expenses);
              return numeric !== null && numeric !== undefined ? formatCurrencyWithSymbol(row.currency_type, numeric) : '-';
            }}
            onSave={(val) => {
              if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return Promise.resolve();
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              return requestFieldUpdate(row, 'fob_expenses', 'Gastos + Lavado', numeric);
            }}
          />
        </InlineCell>
      ),
    },
    {
      key: 'disassembly_load_value', 
      label: 'DESENSAMBLAJE + CARGUE', 
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'disassembly_load_value')}>
          <InlineFieldEditor
            type="number"
            value={row.disassembly_load_value ?? ''}
            placeholder="0"
            disabled={row.incoterm === 'FOB' || row.incoterm === 'CIF'}
            displayFormatter={() => {
              if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return 'N/A';
              const numeric = typeof row.disassembly_load_value === 'number' ? row.disassembly_load_value : parseCurrencyValue(row.disassembly_load_value);
              return numeric !== null && numeric !== undefined ? formatCurrencyWithSymbol(row.currency_type, numeric) : '-';
            }}
            onSave={(val) => {
              if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return Promise.resolve();
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              return requestFieldUpdate(row, 'disassembly_load_value', 'Desensamblaje + Cargue', numeric);
            }}
          />
        </InlineCell>
      ),
    },
    {
      key: 'fob_total',
      label: 'VALOR FOB (SUMA)',
      sortable: true,
      render: (row: PurchaseWithRelations) => {
        // Si es CIF, no mostrar nada (N/A) porque los campos componentes están deshabilitados
        if (row.incoterm === 'CIF') {
          return <span className="text-gray-400">N/A</span>;
        }
        // Para otros incoterms, sumar los componentes
        const exw = parseFloat(row.exw_value_formatted?.replace(/[^0-9.-]/g, '') || '0');
        const fobExpenses = parseFloat(String(row.fob_expenses ?? '0'));
        const disassembly = parseFloat(String(row.disassembly_load_value ?? '0'));
        const total = exw + fobExpenses + disassembly;
        const symbol = getCurrencySymbol(row.currency_type);
        
        if (total <= 0) {
          return <span className="text-gray-400">-</span>;
        }
        
        return (
          <div className="relative flex items-center justify-end gap-2 px-2 py-1 rounded total-valor-girado-popover" onClick={(e) => e.stopPropagation()}>
          <div className={`flex items-center justify-end gap-2 px-2 py-1 rounded ${
            row.fob_total_verified ? 'bg-green-100' : 'bg-yellow-100'
          }`}>
              <span className="text-gray-700">{formatCurrencyWithSymbol(row.currency_type, total)}</span>
              {/* Botón con ojo para mostrar Total Valor Girado y diferencia */}
            <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenTotalValorGiradoPopover(
                    openTotalValorGiradoPopover === row.id ? null : row.id
                  );
                }}
                className="p-1 rounded text-secondary-500 hover:text-brand-red hover:bg-primary-50 transition-colors"
                title="Ver Total Valor Girado y diferencia con FOB"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => requestFieldUpdate(row, 'fob_total_verified', 'FOB Verificado', !(row as any).fob_total_verified)}
                className={`fob-verified-btn p-1 rounded ${(row as any).fob_total_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
                title={(row as any).fob_total_verified ? 'Verificado' : 'Marcar como verificado'}
            >
                {(row as any).fob_total_verified ? '✓' : '○'}
            </button>
            </div>
            {openTotalValorGiradoPopover === row.id && (
              <div className="absolute z-50 top-full right-0 mt-2 w-64 bg-white border border-brand-red rounded-lg shadow-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-brand-red uppercase tracking-wide">Comparación de Valores</h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenTotalValorGiradoPopover(null);
                    }}
                    className="text-secondary-500 hover:text-brand-red transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2 border-t border-primary-200 pt-3">
                  {/* VALOR FOB (SUMA) */}
                  <div>
                    <p className="text-[10px] text-secondary-600 mb-1 uppercase font-semibold">VALOR FOB (SUMA)</p>
                    <p className="text-lg font-bold text-secondary-700">
                      {formatCurrencyWithSymbol(row.currency_type, total)}
                    </p>
                  </div>
                  {/* Total Valor Girado */}
                  <div>
                    <p className="text-[10px] text-secondary-600 mb-1 uppercase font-semibold">Total Valor Girado</p>
                    {row.total_valor_girado && row.total_valor_girado > 0 ? (
                      <>
                        <p className="text-lg font-bold text-brand-red">
                          {formatCurrencyWithSymbol(row.currency_type, row.total_valor_girado)}
                        </p>
                        <p className="text-[10px] text-secondary-500 mt-0.5">Desde Módulo de Pagos</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No hay datos disponibles</p>
                    )}
                  </div>
                  {/* Diferencia - Solo mostrar si hay total_valor_girado */}
                  {row.total_valor_girado && row.total_valor_girado > 0 && (
                    <div className="pt-2 border-t border-primary-200">
                      <p className="text-[10px] text-secondary-600 mb-1 uppercase font-semibold">Diferencia</p>
                      {(() => {
                        const diferencia = total - (row.total_valor_girado || 0);
                        const diferenciaAbs = Math.abs(diferencia);
                        const isPositive = diferencia >= 0;
                        return (
                          <div>
                            <p className={`text-xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositive ? '+' : '-'}{formatCurrencyWithSymbol(row.currency_type, diferenciaAbs)}
                            </p>
                            <p className="text-[10px] text-secondary-500 mt-0.5">
                              {isPositive ? 'FOB es mayor' : 'Total Girado es mayor'}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'cif_usd',
      label: 'CIF',
      sortable: true,
      render: (row: PurchaseWithRelations) => {
        if (row.incoterm !== 'CIF') {
          return <span className="text-gray-400">N/A</span>;
        }
        
        const cifValue = Number(row.cif_usd || 0);
        if (cifValue <= 0) {
          return (
            <InlineCell {...buildCellProps(row.id, 'cif_usd')}>
              <InlineFieldEditor
                type="number"
                value={row.cif_usd ?? ''}
                placeholder="0"
                displayFormatter={() => '-'}
                onSave={(val) => {
                  const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                  return requestFieldUpdate(row, 'cif_usd', 'CIF', numeric, { cif_usd: numeric, cif_usd_verified: false });
                }}
              />
            </InlineCell>
          );
        }
        
        return (
          <div className={`flex items-center justify-end gap-2 px-2 py-1 rounded ${
            row.cif_usd_verified ? 'bg-green-100' : 'bg-yellow-100'
          }`}>
            <InlineCell {...buildCellProps(row.id, 'cif_usd')}>
              <InlineFieldEditor
                type="number"
                value={row.cif_usd ?? ''}
                placeholder="0"
                displayFormatter={() => `$${cifValue.toLocaleString('es-CO')}`}
                onSave={(val) => {
                  const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                  return requestFieldUpdate(row, 'cif_usd', 'CIF', numeric, { cif_usd: numeric, cif_usd_verified: false });
                }}
              />
            </InlineCell>
            <button
              onClick={() => requestFieldUpdate(row, 'cif_usd_verified', 'CIF Verificado', !row.cif_usd_verified)}
              className={`p-1 rounded ${row.cif_usd_verified ? 'text-green-600' : 'text-yellow-600 hover:text-green-600'}`}
              title={row.cif_usd_verified ? 'Verificado' : 'Marcar como verificado'}
            >
              {row.cif_usd_verified ? '✓' : '○'}
            </button>
          </div>
        );
      },
    },
    {
      key: 'usd_jpy_rate',
      label: 'CONTRAVALOR',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'usd_jpy_rate')}>
        <span className="text-gray-700">
          {row.usd_jpy_rate ? parseFloat(String(row.usd_jpy_rate)).toFixed(2) : 'PDTE'}
        </span>
        </InlineCell>
      ),
    },
    {
      key: 'trm_rate',
      label: 'TRM',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'trm_rate')}>
        <span className="text-gray-700">
          {row.trm_rate ? `$ ${row.trm_rate.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'PDTE'}
        </span>
        </InlineCell>
      ),
    },
    {
      key: 'payment_date',
      label: 'FECHA DE PAGO', 
      sortable: true,
      filter: (
        <select
          value={paymentDateFilter}
          onChange={(e) => setPaymentDateFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {uniquePaymentDates.map(date => (
            <option key={date || ''} value={date || ''}>{date ? new Date(date).toLocaleDateString('es-CO') : ''}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'payment_date')}>
        <span className="text-gray-700">
          {row.payment_date
            ? new Date(row.payment_date).toLocaleDateString('es-CO')
            : 'PDTE'}
        </span>
        </InlineCell>
      ),
    },
    {
      key: 'shipment_departure_date',
      label: 'ETD',
      sortable: true,
      filter: (
        <select
          value={eddFilter}
          onChange={(e) => setEddFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {uniqueEdds.map(date => (
            <option key={date || ''} value={date || ''}>{date ? new Date(date).toLocaleDateString('es-CO') : ''}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => {
        const formattedDate = formatDateWithoutTimezone(row.shipment_departure_date);
        return (
          <InlineCell {...buildCellProps(row.id, 'shipment_departure_date')}>
            {!formattedDate ? (
              <span className="text-gray-400">PDTE</span>
            ) : (
              <span className="text-xs text-gray-700">
                {`${formattedDate.day}/${formattedDate.month}/${formattedDate.year}`}
              </span>
            )}
          </InlineCell>
        );
      },
    },
    {
      key: 'shipment_arrival_date',
      label: 'ETA',
      sortable: true,
      filter: (
        <select
          value={edaFilter}
          onChange={(e) => setEdaFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {uniqueEdas.map(date => (
            <option key={date || ''} value={date || ''}>{date ? new Date(date).toLocaleDateString('es-CO') : ''}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => {
        const formattedDate = formatDateWithoutTimezone(row.shipment_arrival_date);
        return (
          <InlineCell {...buildCellProps(row.id, 'shipment_arrival_date')}>
            {!formattedDate ? (
              <span className="text-gray-400">PDTE</span>
            ) : (
              <span className="text-xs text-gray-700">
                {`${formattedDate.day}/${formattedDate.month}/${formattedDate.year}`}
              </span>
            )}
          </InlineCell>
        );
      },
    },
    {
      key: 'sales_reported',
      label: 'REPORTADO VENTAS',
      sortable: true,
      filter: (
        <select
          value={salesReportedFilter}
          onChange={(e) => setSalesReportedFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {REPORT_STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => {
        // Para new_purchases (machine_id es null), no mostrar nada ya que estos campos no existen en esa tabla
        if (!row.machine_id) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <InlineCell {...buildCellProps(row.id, 'sales_reported')}>
            <InlineFieldEditor
              type="select"
              value={row.sales_reported || 'PDTE'}
              options={REPORT_STATUS_OPTIONS}
              placeholder="Seleccionar"
              displayFormatter={(val) =>
                REPORT_STATUS_OPTIONS.find((opt) => opt.value === val)?.label || val || 'PDTE'
              }
            onSave={(val) => {
              // Asegurar que siempre se envíe un valor válido (OK o PDTE)
              // Si val es null, undefined o cadena vacía, usar 'PDTE', de lo contrario usar el valor tal cual
              const valueToSave = (val === null || val === undefined || val === '') ? 'PDTE' : String(val);
              return requestFieldUpdate(row, 'sales_reported', 'Reportado Ventas', valueToSave);
            }}
            />
          </InlineCell>
        );
      },
    },
    {
      key: 'commerce_reported',
      label: 'REPORTADO COMERCIO',
      sortable: true,
      filter: (
        <select
          value={commerceReportedFilter}
          onChange={(e) => setCommerceReportedFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {REPORT_STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => {
        // Para new_purchases (machine_id es null), no mostrar nada ya que estos campos no existen en esa tabla
        if (!row.machine_id) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <InlineCell {...buildCellProps(row.id, 'commerce_reported')}>
            <InlineFieldEditor
              type="select"
              value={row.commerce_reported || 'PDTE'}
              options={REPORT_STATUS_OPTIONS}
              placeholder="Seleccionar"
              displayFormatter={(val) =>
                REPORT_STATUS_OPTIONS.find((opt) => opt.value === val)?.label || val || 'PDTE'
              }
            onSave={(val) => {
              // Asegurar que siempre se envíe un valor válido (OK o PDTE)
              const valueToSave = (val === null || val === undefined || val === '') ? 'PDTE' : String(val);
              return requestFieldUpdate(row, 'commerce_reported', 'Reportado Comercio', valueToSave);
            }}
            />
          </InlineCell>
        );
      },
    },
    {
      key: 'luis_lemus_reported',
      label: 'REPORTE LUIS LEMUS',
      sortable: true,
      filter: (
        <select
          value={luisLemusReportedFilter}
          onChange={(e) => setLuisLemusReportedFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {REPORT_STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => {
        // Para new_purchases (machine_id es null), no mostrar nada ya que estos campos no existen en esa tabla
        if (!row.machine_id) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <InlineCell {...buildCellProps(row.id, 'luis_lemus_reported')}>
            <InlineFieldEditor
              type="select"
              value={row.luis_lemus_reported || 'PDTE'}
              options={REPORT_STATUS_OPTIONS}
              placeholder="Seleccionar"
              displayFormatter={(val) =>
                REPORT_STATUS_OPTIONS.find((opt) => opt.value === val)?.label || val || 'PDTE'
              }
            onSave={(val) => {
              // Asegurar que siempre se envíe un valor válido (OK o PDTE)
              const valueToSave = (val === null || val === undefined || val === '') ? 'PDTE' : String(val);
              return requestFieldUpdate(row, 'luis_lemus_reported', 'Reporte Luis Lemus', valueToSave);
            }}
            />
          </InlineCell>
        );
      },
    },
    {
      key: 'actions',
      label: 'ACCIONES',
      sortable: false,
      render: (row: PurchaseWithRelations) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenView(row);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(row);
            }}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPurchase(row);
              setIsHistoryOpen(true);
            }}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Historial de cambios"
          >
            <History className="w-4 h-4" />
          </button>
          {isAdmin() && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeletePurchase(
                  row.id,
                  `MQ: ${row.mq || 'N/A'} - ${row.model || ''} ${row.serial || ''}`
                );
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-300"
              title="Eliminar compra"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    },
  ];

  const handleOpenModal = (purchase: PurchaseWithRelations | null = null) => {
    setSelectedPurchase(purchase);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPurchase(null);
  };

  const handleOpenView = (purchase: PurchaseWithRelations) => {
    setSelectedPurchase(purchase);
    setIsViewOpen(true);
  };

  const handleCloseView = () => {
    setIsViewOpen(false);
    setSelectedPurchase(null);
  };

  const handleSuccess = () => {
    handleCloseModal();
    refetch();
    showSuccess('Compra guardada exitosamente');
  };

  // Sincronizar scroll superior con tabla
  useEffect(() => {
    // Pequeño delay para asegurar que la tabla esté montada
    const timer = setTimeout(() => {
      const topScroll = topScrollRef.current;
      const tableScroll = tableScrollRef.current;

      if (!topScroll || !tableScroll) {
        console.log('Refs no disponibles:', { topScroll: !!topScroll, tableScroll: !!tableScroll });
        return;
      }

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
    }, 100);

    return () => clearTimeout(timer);
  }, [filteredPurchases]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-gray-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Header Premium */}
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="mb-8"
        >
          <div className="bg-indigo-700 rounded-xl shadow-md p-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold text-white">Logística Origen</h1>
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
                <p className="text-sm font-medium text-brand-gray">Compras Activas</p>
                <p className="text-2xl font-bold text-brand-red">{activePurchases}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Package className="w-6 h-6 text-brand-red" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Pagos Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">
                  ¥{(pendingPaymentsAmount / 1000000).toFixed(1)}M
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Envíos en Tránsito</p>
                <p className="text-2xl font-bold text-green-600">{shipmentsInTransit}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-gray">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Total Completados</p>
                <p className="text-2xl font-bold text-brand-gray">{totalPaidCorrected}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <FileText className="w-6 h-6 text-brand-gray" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <Card>
            {/* Search, Group Button and Export */}
            <div className="mb-4">
              <div className="flex items-center gap-3">
                {/* Botones Agrupar y Migrar - Al extremo izquierdo */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedPurchaseIds.size > 0 && (
                    <Button 
                      onClick={handleGroupPurchases}
                      disabled={isGrouping}
                      className="flex items-center gap-2 bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-md disabled:opacity-50 text-sm px-4 py-2 whitespace-nowrap"
                    >
                      <Package className="w-4 h-4" />
                      Agrupar ({selectedPurchaseIds.size})
                    </Button>
                  )}
                  <Button 
                    onClick={handleMigrateOldCUs}
                    size="sm"
                    variant="secondary"
                    className="flex items-center gap-1.5 text-xs px-2 py-1.5"
                  >
                    Migrar CUs
                  </Button>
                </div>
                {/* Search */}
                <div className="flex-1">
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red shadow-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleOpenModal()}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Nueva Compra</span>
                    </button>
                    {isAdminUser && (
                      <button
                        onClick={() => setIsBulkUploadOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap"
                      >
                        <Upload className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Carga Masiva</span>
                      </button>
                    )}
                  </div>
                </div>
                  {/* Toggle Modo Masivo */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap">
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
                {/* Botón Exportar */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2 flex-shrink-0"
                  onClick={handleExportAll}
                  disabled={isExporting}
                >
                  <Download className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
                  {isExporting ? 'Exportando...' : 'Exportar'}
                </Button>
              </div>
            </div>

            {/* Vista Móvil - Cards */}
            <div className="md:hidden space-y-4">
              {isLoading ? (
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6 mx-auto"></div>
                  </div>
                </div>
              ) : filteredPurchases.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                  No hay datos disponibles
                </div>
              ) : (
                filteredPurchases.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => handleOpenModal(row)}
                    className={`bg-white rounded-xl shadow-lg p-4 border-2 transition-all ${
                      row.pending_marker
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-brand-red hover:shadow-xl'
                    }`}
                  >
                    {/* Header de la Card */}
                    <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePending(row.id);
                          }}
                          className={`p-2 rounded-lg transition-all ${
                            row.pending_marker
                              ? 'bg-red-100 text-red-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          <AlertCircle className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold text-gray-700">
                              {row.mq || '-'}
                            </span>
                            {row.purchase_type && (
                              <span className={getTipoCompraStyle(row.purchase_type)}>
                                {row.purchase_type === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : row.purchase_type}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {row.supplier_name || 'Sin proveedor'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(row);
                          }}
                          className="p-2"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsHistoryOpen(true);
                            setSelectedPurchase(row);
                          }}
                          className="p-2"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Campos Editables en Card */}
                    <div className="space-y-3">
                      {/* Información Básica */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">SHIPMENT</label>
                          <InlineCell {...buildCellProps(row.id, 'shipment_type_v2')}>
                            <InlineFieldEditor
                              value={row.shipment_type_v2 || ''}
                              type="select"
                              placeholder="Tipo de envío"
                              options={SHIPMENT_OPTIONS}
                              displayFormatter={(val) =>
                                val ? SHIPMENT_OPTIONS.find((opt) => opt.value === val)?.label || val : 'Sin definir'
                              }
                              onSave={(val) => requestFieldUpdate(row, 'shipment_type_v2', 'Tipo de envío', val)}
                            />
                          </InlineCell>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">UBICACIÓN</label>
                          <InlineCell {...buildCellProps(row.id, 'location')}>
                            <InlineFieldEditor
                              value={row.location || ''}
                              type="select"
                              placeholder="Ubicación"
                              options={LOCATION_OPTIONS}
                              onSave={(val) => requestFieldUpdate(row, 'location', 'Ubicación', val)}
                            />
                          </InlineCell>
                        </div>
                      </div>

                      {/* Máquina */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">MARCA</label>
                          <span className="text-sm text-gray-800 uppercase">{row.brand || 'Sin marca'}</span>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">MODELO</label>
                          <span className="text-sm text-gray-800">{row.model || 'Sin modelo'}</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">SERIAL</label>
                        <span className="text-sm text-gray-800 font-mono">{row.serial || 'Sin serial'}</span>
                      </div>

                      {/* Orden de Compra y Factura */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">ORDEN DE COMPRA</label>
                          <InlineCell {...buildCellProps(row.id, 'purchase_order')}>
                            <InlineFieldEditor
                              value={row.purchase_order || ''}
                              placeholder="Orden de compra"
                              onSave={(val) => requestFieldUpdate(row, 'purchase_order', 'Orden de compra', val)}
                            />
                          </InlineCell>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">No. FACTURA</label>
                          <InlineCell {...buildCellProps(row.id, 'invoice_number')}>
                            <InlineFieldEditor
                              value={row.invoice_number || ''}
                              placeholder="No. Factura"
                              onSave={(val) => requestFieldUpdate(row, 'invoice_number', 'No. Factura', val)}
                            />
                          </InlineCell>
                        </div>
                      </div>

                      {/* Fecha Factura */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">FECHA FACTURA</label>
                        <InlineCell {...buildCellProps(row.id, 'invoice_date')}>
                          <InlineFieldEditor
                            value={(() => {
                              const dateValue = row.invoice_date;
                              if (!dateValue) return '';
                              
                              try {
                                // Si ya viene en formato YYYY-MM-DD, retornarlo directamente
                                if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                                  return dateValue;
                                }
                                
                                // Si viene como Date object
                                let date: Date;
                                if (dateValue && typeof dateValue === 'object' && 'getTime' in dateValue) {
                                  date = dateValue as Date;
                                } else if (typeof dateValue === 'string') {
                                  // Si ya incluye 'T', extraer solo la parte de fecha
                                  const dateOnly = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
                                  // Validar formato
                                  if (!/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) {
                                    date = new Date(dateValue);
                                  } else {
                                    const parts = dateOnly.split('-');
                                    if (parts.length === 3) {
                                      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                    } else {
                                      date = new Date(dateOnly + 'T00:00:00');
                                    }
                                  }
                                } else {
                                  return '';
                                }
                                
                                if (isNaN(date.getTime())) {
                                  return '';
                                }
                                
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                return `${year}-${month}-${day}`;
                              } catch (error) {
                                console.error('Error formatting date in modal:', error, dateValue);
                                return '';
                              }
                            })()}
                            type="date"
                            placeholder="Fecha factura"
                            onSave={async (val) => {
                              let invoiceDateValue: string | null = null;
                              let dueDateValue: string | null = null;
                              
                              if (typeof val === 'string' && val) {
                                invoiceDateValue = val;
                                
                                // Calcular vencimiento: 10 días después
                                const invoiceDate = new Date(val + 'T00:00:00');
                                invoiceDate.setDate(invoiceDate.getDate() + 10);
                                const year = invoiceDate.getFullYear();
                                const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
                                const day = String(invoiceDate.getDate()).padStart(2, '0');
                                dueDateValue = `${year}-${month}-${day}`;
                              }
                              
                              await requestFieldUpdate(
                                row,
                                'invoice_date',
                                'Fecha factura',
                                invoiceDateValue,
                                {
                                  invoice_date: invoiceDateValue,
                                  due_date: dueDateValue,
                                }
                              );
                            }}
                            displayFormatter={(val) => {
                              if (!val) return 'Sin fecha';
                              try {
                                const date = new Date(String(val) + 'T00:00:00');
                                return date.toLocaleDateString('es-CO');
                              } catch {
                                return 'Sin fecha';
                            }
                            }}
                          />
                        </InlineCell>
                      </div>

                      {/* Incoterm y Moneda */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">INCOTERM</label>
                          <InlineCell {...buildCellProps(row.id, 'incoterm')}>
                            <InlineFieldEditor
                              value={row.incoterm || ''}
                              type="select"
                              placeholder="Incoterm"
                              options={INCOTERM_OPTIONS}
                              displayFormatter={(val) => val || 'Sin definir'}
                              onSave={async (val) => {
                                // Si se cambia a FOB, actualizar VALOR FOB (SUMA) con el valor de PRECIO COMPRA
                                if (val === 'FOB') {
                                  const priceBought = getPurchasePriceValue(row);
                                  if (priceBought && priceBought > 0) {
                                    // Cuando es FOB, el PRECIO COMPRA debe ser el VALOR FOB (SUMA)
                                    // Actualizar exw_value_formatted con el precio de compra para que VALOR FOB (SUMA) muestre ese valor
                                    // IMPORTANTE: No marcar como verificado automáticamente, el usuario debe verificar manualmente
                                    const updates: Record<string, unknown> = {
                                      incoterm: val,
                                      exw_value_formatted: priceBought.toString(),
                                      fob_expenses: '0',
                                      disassembly_load_value: 0,
                                      fob_total_verified: false,
                                    };
                                    await requestFieldUpdate(row, 'incoterm', 'Incoterm', val, updates);
                                    return;
                                  }
                                }
                                // Para otros incoterms, solo actualizar el incoterm
                                await requestFieldUpdate(row, 'incoterm', 'Incoterm', val);
                              }}
                            />
                          </InlineCell>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">MONEDA</label>
                          <InlineCell {...buildCellProps(row.id, 'currency_type')}>
                            <InlineFieldEditor
                              value={row.currency_type || ''}
                              type="select"
                              placeholder="Moneda"
                              options={CURRENCY_OPTIONS}
                              displayFormatter={(val) => val || 'Sin definir'}
                              onSave={(val) => requestFieldUpdate(row, 'currency_type', 'Moneda', val)}
                            />
                          </InlineCell>
                        </div>
                      </div>

                      {/* Valores */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">EXW</label>
                          <InlineCell {...buildCellProps(row.id, 'exw_value_formatted')}>
                            <InlineFieldEditor
                              type="number"
                              value={parseCurrencyValue(row.exw_value_formatted) ?? ''}
                              placeholder="0"
                              disabled={row.incoterm === 'FOB' || row.incoterm === 'CIF'}
                              displayFormatter={() => {
                                if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return 'N/A';
                                const numeric = parseCurrencyValue(row.exw_value_formatted);
                                return numeric !== null ? formatCurrencyWithSymbol(row.currency_type, numeric) : '-';
                              }}
                              onSave={(val) => {
                                if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return Promise.resolve();
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                const storageValue = numeric !== null ? numeric.toString() : null;
                                return requestFieldUpdate(row, 'exw_value_formatted', 'Valor EXW', storageValue, {
                                  exw_value_formatted: storageValue,
                                });
                              }}
                            />
                          </InlineCell>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">FOB ADICIONAL</label>
                          <InlineCell {...buildCellProps(row.id, 'fob_expenses')}>
                            <InlineFieldEditor
                              type="number"
                              value={row.fob_expenses ?? ''}
                              placeholder="0"
                              disabled={row.incoterm === 'FOB' || row.incoterm === 'CIF'}
                              displayFormatter={() => {
                                if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return 'N/A';
                                const numeric = typeof row.fob_expenses === 'number' ? row.fob_expenses : parseCurrencyValue(row.fob_expenses);
                                return numeric !== null && numeric !== undefined ? formatCurrencyWithSymbol(row.currency_type, numeric) : '-';
                              }}
                              onSave={(val) => {
                                if (row.incoterm === 'FOB' || row.incoterm === 'CIF') return Promise.resolve();
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'fob_expenses', 'FOB Adicional', numeric);
                              }}
                            />
                          </InlineCell>
                        </div>
                      </div>

                      {/* Tasas */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">CONTRAVALOR</label>
                          <span className="text-sm text-gray-700">
                            {row.usd_jpy_rate ? parseFloat(String(row.usd_jpy_rate)).toFixed(2) : 'PDTE'}
                          </span>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">TRM</label>
                          <span className="text-sm text-gray-700">
                            {row.trm_rate ? `${row.trm_rate}` : 'PDTE'}
                          </span>
                        </div>
                      </div>

                      {/* Estado de Pago */}
                      <div className="pt-2 border-t border-gray-100">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">ESTADO DE PAGO</label>
                        <div className="flex items-center gap-2">
                          <span className={getPaymentStatusStyle(row.payment_status)}>
                            {row.payment_status === 'PENDIENTE' ? '⏳ Pendiente' : row.payment_status === 'DESBOLSADO' ? '💰 En Proceso' : '✓ Completado'}
                          </span>
                          {row.payment_date && (
                            <span className="text-xs text-gray-500">
                              {new Date(row.payment_date).toLocaleDateString('es-CO')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Vista Desktop - Tabla */}
            <div className="hidden md:block">
              {/* Barra de Scroll Superior - Sincronizada */}
              <div className="mb-3">
                <div 
                  ref={topScrollRef}
                  className="overflow-x-auto bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
                  style={{ height: '14px' }}
                >
                  <div style={{ width: '5500px', height: '1px' }}></div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-xl">
                <div 
                  ref={tableScrollRef} 
                  className="overflow-x-auto overflow-y-scroll w-full"
                  style={{ 
                    height: 'calc(100vh - 150px)',
                    minHeight: '700px',
                    maxHeight: 'calc(100vh - 150px)',
                    width: '100%'
                  }}
                >
                  <table className="min-w-full divide-y divide-gray-200 relative">
                    <thead className="sticky top-0 z-50 bg-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider bg-indigo-100 text-gray-800">
                          <input
                            type="checkbox"
                            checked={selectedPurchaseIds.size > 0 && selectedPurchaseIds.size === filteredPurchases.length}
                            onChange={toggleAllPurchasesSelection}
                            className="w-4 h-4 text-gray-800 border-gray-600 rounded focus:ring-gray-800"
                          />
                        </th>
                        {columns.filter(c => c.key !== 'select').map((column) => {
                          const isSticky = column.key === 'actions' || column.key === 'view';
                          const rightPosition = column.key === 'view' ? 'right-[120px]' : 'right-0';
                          const bgColor = getColumnHeaderBgColor(String(column.key));
                          const isMQColumn = column.key === 'mq';
                          
                          return (
                            <th
                              key={String(column.key)}
                              className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                                isSticky 
                                  ? `sticky top-0 ${rightPosition} z-[60] shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] bg-indigo-100 text-gray-800` 
                                  : bgColor
                              }`}
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  <span>{column.label}</span>
                                  {isMQColumn && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Alternar entre null -> 'desc' -> 'asc' -> null
                                        if (mqSortOrder === null) {
                                          setMqSortOrder('desc'); // MQ más alto primero
                                        } else if (mqSortOrder === 'desc') {
                                          setMqSortOrder('asc'); // MQ más bajo primero
                                        } else {
                                          setMqSortOrder(null); // Sin ordenar
                                        }
                                      }}
                                      className="p-0.5 hover:bg-gray-200 rounded transition-colors flex items-center"
                                      title={
                                        mqSortOrder === null 
                                          ? 'Ordenar por MQ (descendente)' 
                                          : mqSortOrder === 'desc' 
                                            ? 'Ordenar por MQ (ascendente)' 
                                            : 'Quitar ordenamiento'
                                      }
                                    >
                                      {mqSortOrder === null ? (
                                        <ChevronUp className="w-3 h-3 text-gray-400" />
                                      ) : mqSortOrder === 'desc' ? (
                                        <ChevronDown className="w-3 h-3 text-blue-600" />
                                      ) : (
                                        <ChevronUp className="w-3 h-3 text-blue-600" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                {column.filter && (
                                  <div className="mt-1">
                                    {column.filter}
                                  </div>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Grupos de CU */}
                      {groupedPurchases.grouped.map((group, groupIndex) => {
                        const isExpanded = expandedCUs.has(group.cu);
                        
                        return (
                          <React.Fragment key={group.cu}>
                            {/* Fila de Grupo CU */}
                            <motion.tr
                              initial={false}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.1 }}
                              className="bg-white border-y border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => toggleCUExpansion(group.cu)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {/* Menú de acciones del grupo */}
                                  <div className="relative action-menu-container" style={{ zIndex: 10000, position: 'relative' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActionMenuOpen(actionMenuOpen === `group-${group.cu}` ? null : `group-${group.cu}`);
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                      <MoreVertical className="w-4 h-4 text-gray-600" />
                                    </button>
                                    
                                    {actionMenuOpen === `group-${group.cu}` && (
                                      <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-2xl border border-gray-300" style={{ zIndex: 100000 }}>
                                        <div className="py-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActionMenuOpen(null);
                                              handleOpenMoveToCU(group.purchases.map(p => p.id), group.cu);
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors whitespace-nowrap"
                                          >
                                            <Move className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                            <span className="truncate">Mover todo el grupo a otro CU</span>
                                          </button>
                                          <div className="border-t border-gray-200 my-1"></div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActionMenuOpen(null);
                                              if (confirm(`¿Desagrupar todas las ${group.totalPurchases} compras del CU ${group.cu}?`)) {
                                                handleUngroupMultiple(group.purchases.map(p => p.id));
                                              }
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors whitespace-nowrap"
                                          >
                                            <Unlink className="w-4 h-4 text-red-500 flex-shrink-0" />
                                            <span className="truncate">Desagrupar todo el grupo</span>
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td colSpan={columns.length} className="px-4 py-4">
                                <div className="flex items-center gap-4 flex-wrap">
                                  <div className="flex items-center gap-3">
                                    <Package className="w-5 h-5 text-brand-red" />
                                    <div>
                                      <p className="text-[11px] uppercase text-gray-500 font-semibold tracking-wide">
                                        Consecutivo Único
                                      </p>
                                      <p className="text-lg font-semibold text-gray-900 font-mono">{group.cu}</p>
                                      <p className="text-sm text-gray-500">
                                        {group.totalPurchases} {group.totalPurchases === 1 ? 'compra' : 'compras'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="h-12 w-px bg-gray-300"></div>
                                  
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="w-5 h-5 text-gray-400" />
                                    ) : (
                                      <ChevronRight className="w-5 h-5 text-gray-400" />
                                    )}
                                    <span className="text-xs text-gray-500">
                                      {isExpanded ? 'Contraer' : 'Expandir'}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </motion.tr>

                            {/* Filas de Compras dentro del CU (cuando está expandido) */}
                            {isExpanded &&
                              group.purchases.map((purchase, purchaseIndex) => {
                                return (
                                  <motion.tr
                                    key={purchase.id}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: purchaseIndex * 0.03 }}
                                    className={`group transition-colors border-b border-gray-200 ${
                                      purchase.pending_marker 
                                        ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500' 
                                        : purchase.cu
                                        ? 'bg-gray-100 hover:bg-gray-150'
                                        : 'bg-white hover:bg-gray-50'
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <td className="px-2 py-1 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={selectedPurchaseIds.has(purchase.id)}
                                          onChange={() => togglePurchaseSelection(purchase.id)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        {/* Menú de acciones para desagrupar/mover (solo si tiene CU) */}
                                        {purchase.cu && (
                                          <div className="relative action-menu-container" style={{ zIndex: 10000, position: 'relative' }}>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActionMenuOpen(actionMenuOpen === purchase.id ? null : purchase.id);
                                              }}
                                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                              title="Opciones de CU"
                                            >
                                              <MoreVertical className="w-4 h-4" />
                                            </button>
                                            
                                            {actionMenuOpen === purchase.id && (
                                              <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-2xl border border-gray-300" style={{ zIndex: 100000, position: 'absolute' }}>
                                                <div className="py-2">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActionMenuOpen(null);
                                                      handleOpenMoveToCU([purchase.id], purchase.cu || undefined);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                                  >
                                                    <Move className="w-4 h-4 text-gray-500" />
                                                    Mover a otro CU
                                                  </button>
                                                  <div className="border-t border-gray-200 my-1"></div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActionMenuOpen(null);
                                                      if (confirm(`¿Desagrupar esta compra del CU ${purchase.cu}?`)) {
                                                        handleUngroupPurchase(purchase.id);
                                                      }
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                                  >
                                                    <Unlink className="w-4 h-4 text-red-500" />
                                                    Desagrupar
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    {columns.filter(c => c.key !== 'select').map((column) => {
                                      const isSticky = column.key === 'actions' || column.key === 'view';
                                      const rightPosition = column.key === 'view' ? 'right-[120px]' : 'right-0';
                                      
                                      return (
                                        <td
                                          key={String(column.key)}
                                          className={`px-6 py-4 whitespace-nowrap ${
                                            isSticky 
                                              ? `sticky ${rightPosition} z-30 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] ${
                                                  purchase.pending_marker ? 'bg-red-50' : 'bg-white'
                                                }` 
                                              : purchase.pending_marker ? 'bg-red-50' : ''
                                          }`}
                                        >
                                          {column.render ? column.render(purchase) : String((purchase as unknown as Record<string, unknown>)[column.key] || '')}
                                        </td>
                                      );
                                    })}
                                  </motion.tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}

                      {/* Compras sin CU */}
                      {groupedPurchases.ungrouped.map((purchase) => {
                        return (
                          <tr
                            key={purchase.id}
                            className={purchase.pending_marker 
                              ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500' 
                              : 'bg-white hover:bg-gray-50'
                            }
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedPurchaseIds.has(purchase.id)}
                                  onChange={() => togglePurchaseSelection(purchase.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                {/* Menú de acciones para desagrupar/mover (solo si tiene CU) */}
                                {purchase.cu && (
                                  <div className="relative action-menu-container" style={{ zIndex: 10000, position: 'relative' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActionMenuOpen(actionMenuOpen === purchase.id ? null : purchase.id);
                                      }}
                                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                      title="Opciones de CU"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    
                                    {actionMenuOpen === purchase.id && (
                                      <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-2xl border border-gray-300" style={{ zIndex: 100000, position: 'absolute' }}>
                                        <div className="py-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActionMenuOpen(null);
                                              handleOpenMoveToCU([purchase.id], purchase.cu || undefined);
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                          >
                                            <Move className="w-4 h-4 text-gray-500" />
                                            Mover a otro CU
                                          </button>
                                          <div className="border-t border-gray-200 my-1"></div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActionMenuOpen(null);
                                              if (confirm(`¿Desagrupar esta compra del CU ${purchase.cu}?`)) {
                                                handleUngroupPurchase(purchase.id);
                                              }
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                          >
                                            <Unlink className="w-4 h-4 text-red-500" />
                                            Desagrupar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            {columns.filter(c => c.key !== 'select').map((column) => {
                              const isSticky = column.key === 'actions' || column.key === 'view';
                              const rightPosition = column.key === 'view' ? 'right-[120px]' : 'right-0';
                              
                              return (
                                <td
                                  key={String(column.key)}
                                  className={`px-6 py-4 whitespace-nowrap ${
                                    isSticky 
                                      ? `sticky ${rightPosition} z-30 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] ${
                                          purchase.pending_marker ? 'bg-red-50' : 'bg-white'
                                        }` 
                                      : purchase.pending_marker ? 'bg-red-50' : ''
                                  }`}
                                >
                                  {column.render ? column.render(purchase) : String((purchase as unknown as Record<string, unknown>)[column.key] || '')}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
      </Card>
        </motion.div>

        {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
          title={selectedPurchase ? 'Editar Compra' : 'Nueva Compra'}
          size="md"
        >
          <PurchaseFormNew purchase={selectedPurchase} onSuccess={handleSuccess} onCancel={handleCloseModal} />
      </Modal>
      <ChangeLogModal
        isOpen={changeModalOpen}
        changes={changeModalItems}
        onConfirm={handleConfirmInlineChange}
        onCancel={handleCancelInlineChange}
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

      {/* Modal para mover compras a otro CU */}
      <Modal
        isOpen={moveToCUModal.open}
        onClose={() => setMoveToCUModal({ open: false, purchaseIds: [] })}
        title="Mover compras a otro CU"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CU Destino
            </label>
            <Select
              value={moveToCUModal.currentCU || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const selectedCU = e.target.value;
                if (selectedCU === '__new__') {
                  // Permitir crear nuevo CU
                  const input = document.getElementById('new-cu-input') as HTMLInputElement;
                  if (input) {
                    input.focus();
                    input.value = '';
                  }
                } else if (selectedCU) {
                  handleMoveToCU(selectedCU);
                }
              }}
              className="w-full"
              options={[
                { value: '', label: 'Seleccionar CU existente...' },
                ...existingCUs
                  .filter(cu => cu !== moveToCUModal.currentCU)
                  .map(cu => ({ value: cu, label: cu })),
                { value: '__new__', label: '+ Crear nuevo CU' }
              ]}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              O ingresar nuevo CU
            </label>
            <input
              id="new-cu-input"
              type="text"
              placeholder="Ej: CU-20250101-120000-ABC123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) {
                    handleMoveToCU(value);
                  }
                }
              }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setMoveToCUModal({ open: false, purchaseIds: [] })}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const input = document.getElementById('new-cu-input') as HTMLInputElement;
                const value = input?.value.trim() || '';
                if (value) {
                  handleMoveToCU(value);
                } else {
                  showError('Por favor ingrese un CU válido');
                }
              }}
              className="bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700"
            >
              Mover {moveToCUModal.purchaseIds.length} compra(s)
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={isViewOpen}
        onClose={handleCloseView}
        title="Detalle de la Compra"
        size="md"
      >
        {selectedPurchase ? <PurchaseDetailView purchase={selectedPurchase!} /> : null}
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Historial de Cambios - Todos los Módulos"
        size="lg"
      >
        {selectedPurchase ? (
          <ChangeHistory 
            tableName="purchases" 
            recordId={selectedPurchase!.id}
            purchaseId={selectedPurchase!.id}
          />
        ) : null}
      </Modal>
      
      {/* Modal de Carga Masiva */}
      <BulkUploadPurchases
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onSuccess={() => {
          refetch();
          setIsBulkUploadOpen(false);
        }}
      />
      </div>
    </div>
  );
};

const PurchaseDetailView: React.FC<{ purchase: PurchaseWithRelations }> = ({ purchase }) => {
  const [filesSectionExpanded, setFilesSectionExpanded] = useState(false);
  const [privateFilesSectionExpanded, setPrivateFilesSectionExpanded] = useState(false);
  
  return (
  <div className="space-y-3">
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <h3 className="text-xs font-semibold text-gray-800 mb-2">Información General</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">MQ</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.mq || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Tipo</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.purchase_type || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Shipment</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.shipment_type_v2 || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Empresa</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.empresa || '-'}</p>
        </div>
      </div>
    </div>

    <div className="border border-gray-200 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-gray-800 mb-2">Máquina</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">Proveedor</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.supplier_name || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Modelo</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.model || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Serial</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.serial || '-'}</p>
        </div>
      </div>
    </div>

    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <h3 className="text-xs font-semibold text-gray-800 mb-2">Fechas y Ubicación</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">Fecha Factura</p>
          <p className="text-sm font-semibold text-gray-900">
            {purchase.invoice_date ? new Date(purchase.invoice_date).toLocaleDateString('es-CO') : '-'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Ubicación</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.location || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Incoterm</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.incoterm || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Moneda</p>
          <p className="text-sm font-semibold text-gray-900">{purchase.currency_type || '-'}</p>
        </div>
      </div>
    </div>

    <div className="border border-gray-200 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-gray-800 mb-2">Envío</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">PUERTO EMBARQUE</p>
          <span className="text-gray-700">{purchase.port_of_embarkation || '-'}</span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">CPD</p>
          {(() => {
            const cpdValue = purchase.cpd?.toUpperCase();
            const isChecked = cpdValue === 'VERDE';
            return (
              <div className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg
                  ${isChecked 
                    ? 'bg-green-500 text-white' 
                    : 'bg-red-500 text-white'
                  }
                `}>
                  {isChecked ? '✓' : '✗'}
                </div>
              </div>
            );
          })()}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">FECHA DE PAGO</p>
          {purchase.payment_date ? (
            <span className="text-gray-700">{new Date(purchase.payment_date).toLocaleDateString('es-CO')}</span>
          ) : (
            <span className="text-gray-400">PDTE</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">ETD</p>
          {(() => {
            const formattedDate = formatDateWithoutTimezone(purchase.shipment_departure_date);
            return formattedDate ? (
              <span className="text-gray-700">{`${formattedDate.day}/${formattedDate.month}/${formattedDate.year}`}</span>
            ) : (
              <span className="text-gray-400">PDTE</span>
            );
          })()}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">ETA</p>
          {(() => {
            const formattedDate = formatDateWithoutTimezone(purchase.shipment_arrival_date);
            return formattedDate ? (
              <span className="text-gray-700">{`${formattedDate.day}/${formattedDate.month}/${formattedDate.year}`}</span>
            ) : (
              <span className="text-gray-400">PDTE</span>
            );
          })()}
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Tasas de Cambio</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">CONTRAVALOR</p>
          {purchase.usd_jpy_rate ? (
            <span className={getTasaStyle(purchase.usd_jpy_rate)}>
              {parseFloat(String(purchase.usd_jpy_rate)).toFixed(2)}
            </span>
          ) : (
            <span className="text-sm text-red-600 font-semibold">PDTE</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">TRM</p>
          <span className="text-gray-700 font-semibold">{purchase.trm}</span>
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Valores</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">VALOR + BP</p>
          {purchase.exw_value_formatted ? (
            <span className={getValorStyle(purchase.exw_value_formatted)}>
              {purchase.exw_value_formatted}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">GASTOS FOB + LAVADO</p>
          {purchase.incoterm === 'FOB' ? (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-500 line-through">
              N/A (FOB)
            </span>
          ) : purchase.fob_expenses ? (
            <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
              {purchase.fob_expenses}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">DESENSAMBLAJE + CARGUE</p>
          {purchase.incoterm === 'FOB' ? (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-500 line-through">
              N/A (FOB)
            </span>
          ) : purchase.disassembly_load_value ? (
            <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
              {purchase.disassembly_load_value}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">VALOR FOB (SUMA)</p>
          {(() => {
            const exw = parseFloat(String(purchase.exw_value_formatted || '').replace(/[^0-9.-]/g, '') || '0');
            const fobExpenses = parseFloat(String(purchase.fob_expenses || '0'));
            const disassembly = parseFloat(String(purchase.disassembly_load_value || '0'));
            const total = exw + fobExpenses + disassembly;
            return total > 0 ? (
              <span className={getValorStyle(total)}>
                {total.toLocaleString('es-CO')}
              </span>
            ) : (
              <span className="text-sm text-gray-400">-</span>
            );
          })()}
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Reportes</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">REPORTADO VENTAS</p>
          <span className={getReporteStyle(purchase.sales_reported)}>
            {purchase.sales_reported || 'PDTE'}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">REPORTADO COMERCIO</p>
          <span className={getReporteStyle(purchase.commerce_reported)}>
            {purchase.commerce_reported || 'PDTE'}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">REPORTE LUIS LEMUS</p>
          <span className={getReporteStyle(purchase.luis_lemus_reported)}>
            {purchase.luis_lemus_reported || 'PDTE'}
          </span>
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-3">
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
        machineId={purchase.machine_id} 
        allowUpload={false} 
        allowDelete={false}
        currentScope="COMPRAS"
      />
      )}
    </div>

    {/* Archivos Privados de Compras - Solo visible para usuarios de compras */}
    <div className="border rounded-xl p-3">
      <button
        onClick={() => setPrivateFilesSectionExpanded(!privateFilesSectionExpanded)}
        className="w-full flex items-center justify-between text-xs font-semibold text-[#50504f] mb-2 hover:text-[#cf1b22] transition-colors"
      >
        <span>📁 Archivos Privados de Compras</span>
        {privateFilesSectionExpanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>
      {privateFilesSectionExpanded && (
        <PurchaseFiles 
          purchaseId={purchase.id}
          allowUpload={true}
          allowDelete={true}
        />
      )}
    </div>
  </div>
);
};

