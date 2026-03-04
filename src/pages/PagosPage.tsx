import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, AlertCircle, CheckCircle, Clock, Eye, Edit, History, Layers, Save, X, FilterX } from 'lucide-react';
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
import { useBatchModeGuard } from '../hooks/useBatchModeGuard';
import { formatChangeValue } from '../utils/formatChangeValue';

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
  ocean_pagos?: number | null;
  trm_ocean?: number | null;
  shipment_type_v2?: string | null;
  exw_value_formatted?: NullableStringOrNumber;
  fob_expenses?: NullableStringOrNumber;
  disassembly_load_value?: NullableStringOrNumber;
  fob_total?: number | null;
  // Campos de múltiples pagos
  pago1_moneda?: string | null;
  pago1_fecha?: string | null;
  pago1_contravalor?: number | null;
  pago1_trm?: number | null;
  pago1_valor_girado?: number | null;
  pago1_tasa?: number | null;
  pago2_moneda?: string | null;
  pago2_fecha?: string | null;
  pago2_contravalor?: number | null;
  pago2_trm?: number | null;
  pago2_valor_girado?: number | null;
  pago2_tasa?: number | null;
  pago3_moneda?: string | null;
  pago3_fecha?: string | null;
  pago3_contravalor?: number | null;
  pago3_trm?: number | null;
  pago3_valor_girado?: number | null;
  pago3_tasa?: number | null;
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

/** Tipo para fila de change-logs desde API (SonarQube: evita union repetido). */
type ChangeLogApiRow = {
  id: string;
  field_name: string;
  field_label: string;
  old_value: string | number | null;
  new_value: string | number | null;
  change_reason: string | null;
  changed_at: string;
  module_name: string | null;
};

/** Tipos para valores formateables o nulos (SonarQube: type alias). */
type NullableStringOrNumber = string | number | null;
type NumberStringNullUndef = number | string | null | undefined;
type NullablePrimitive = string | number | boolean | null;

/** Convierte valor a número o null cuando es null/undefined (intención explícita). */
function toNumberOrNull(value: NumberStringNullUndef): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza fecha a string YYYY-MM-DD (primeros 10 caracteres) o null. */
function toDateOnlyString(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Valor numérico formateable (para inputs y display). */
type FormatableNumericValue = number | string | null | undefined;

/** Convierte valor a número válido; devuelve null si no es finito. */
function toNumericValue(value: FormatableNumericValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Símbolos por código de moneda (convención del módulo). */
const CURRENCY_SYMBOLS: Record<string, string> = {
  COP: '$',
  USD: 'US$',
  JPY: '¥',
  EUR: '€',
  GBP: '£',
};

/** Formatea número con separadores de miles y 2 decimales. */
function formatNumberWithSeparators(value: FormatableNumericValue): string {
  const numValue = toNumericValue(value);
  if (numValue === null) return '0,00';
  return numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formatea número sin separadores pero con 2 decimales (para inputs). */
function formatNumberForInput(value: FormatableNumericValue): string {
  const numValue = toNumericValue(value);
  if (numValue === null) return '';
  return numValue.toFixed(2);
}

/** Formatea un valor opcional con el formateador dado; devuelve '' si es null/undefined (reduce complejidad en fillEditStateFromPago). */
function formatOptionalValue(
  value: FormatableNumericValue,
  formatter: (n: number) => string
): string {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  return Number.isFinite(n) ? formatter(n) : '';
}

/** Quita signos de moneda y espacios del string (intención explícita para parseNumberFromInput). */
function stripCurrencySymbolsAndSpaces(s: string): string {
  return s.replaceAll(/[$US¥€£]/g, '').trim();
}

/** Normaliza separador decimal: quita puntos de miles y usa punto como decimal. */
function normalizeDecimalSeparator(s: string): string {
  return s.replaceAll('.', '').replaceAll(',', '.');
}

/** Comparador para ordenar fechas ISO descendente (más reciente primero). */
function compareDateStringsDesc(a: string, b: string): number {
  return b.localeCompare(a);
}

/** Parsea valor desde input (remover separadores y signos de moneda). */
function parseNumberFromInput(value: string): number | null {
  if (value === '' || value === '-') return null;
  const withoutCurrency = stripCurrencySymbolsAndSpaces(value);
  const normalized = normalizeDecimalSeparator(withoutCurrency);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getModuleLabel(moduleName: string | null | undefined): string {
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
}

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
  const hasIndicator = !!(recordId && fieldName && (indicators?.length ?? 0) > 0);
  const isOpen =
    hasIndicator && openPopover?.recordId === recordId && openPopover?.fieldName === fieldName;

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-default focus:outline-none focus:ring-0"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-label="Valor de celda"
      >
        {children}
      </button>
      {hasIndicator && onIndicatorClick && recordId && fieldName && (
        <button
          type="button"
          className="change-indicator-btn inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
          title="Ver historial de cambios"
          onClick={(e) => onIndicatorClick(e, recordId, fieldName)}
        >
          <Clock className="w-3 h-3" />
        </button>
      )}
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

/** Construye el objeto editData desde un pago (para reducir complejidad en fillEditStateFromPago). */
function buildEditDataFromPago(pago: Pago): Partial<Pago> {
  return {
    fecha_factura: pago.fecha_factura,
    proveedor: pago.proveedor,
    no_factura: pago.no_factura,
    mq: pago.mq,
    moneda: pago.moneda,
    tasa: pago.tasa,
    trm_rate: toNumberOrNull(pago.trm_rate),
    usd_jpy_rate: toNumberOrNull(pago.usd_jpy_rate),
    payment_date: getLatestPaymentDate(pago.pago1_fecha, pago.pago2_fecha, pago.pago3_fecha) ?? pago.payment_date,
    valor_factura_proveedor: pago.valor_factura_proveedor,
    observaciones_pagos: pago.observaciones_pagos,
    pendiente_a: pago.pendiente_a,
    fecha_vto_fact: pago.fecha_vto_fact,
    pago1_moneda: pago.pago1_moneda || null,
    pago1_fecha: toDateOnlyString(pago.pago1_fecha),
    pago1_contravalor: pago.pago1_contravalor || null,
    pago1_trm: pago.pago1_trm || null,
    pago1_valor_girado: pago.pago1_valor_girado || null,
    pago1_tasa: pago.pago1_tasa || null,
    pago2_moneda: pago.pago2_moneda || null,
    pago2_fecha: toDateOnlyString(pago.pago2_fecha),
    pago2_contravalor: pago.pago2_contravalor || null,
    pago2_trm: pago.pago2_trm || null,
    pago2_valor_girado: pago.pago2_valor_girado || null,
    pago2_tasa: pago.pago2_tasa || null,
    pago3_moneda: pago.pago3_moneda || null,
    pago3_fecha: toDateOnlyString(pago.pago3_fecha),
    pago3_contravalor: pago.pago3_contravalor || null,
    pago3_trm: pago.pago3_trm || null,
    pago3_valor_girado: pago.pago3_valor_girado || null,
    pago3_tasa: pago.pago3_tasa || null,
    shipment_type_v2: pago.shipment_type_v2 ?? null,
    exw_value_formatted: pago.exw_value_formatted ?? null,
    fob_expenses: pago.fob_expenses ?? null,
    disassembly_load_value: pago.disassembly_load_value ?? null,
    fob_total: toNumericValue(pago.fob_total) ?? null,
  };
}

/** Última fecha entre pago1_fecha, pago2_fecha y pago3_fecha (para sincronizar FECHA DE PAGO). */
function getLatestPaymentDate(
  d1: string | null | undefined,
  d2: string | null | undefined,
  d3: string | null | undefined
): string | null {
  const dates = [d1, d2, d3]
    .filter((d): d is string => typeof d === 'string' && d.length >= 10)
    .map((d) => d.slice(0, 10));
  if (dates.length === 0) return null;
  const sorted = [...dates].sort(compareDateStringsDesc);
  return sorted[0] ?? null;
}

/** Calcula tasa TRM / Contravalor. */
function calculateTasa(trm: number | null | undefined, contravalor: number | null | undefined): number | null {
  if (trm && contravalor && contravalor > 0) return trm / contravalor;
  return null;
}

/** Formatea valor con signo de moneda según código. */
function formatCurrency(value: FormatableNumericValue, currency: string = 'COP'): string {
  if (value === null || value === undefined || value === '') return '';
  const numValue = toNumericValue(value);
  if (numValue === null) return '';
  const formatted = numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = CURRENCY_SYMBOLS[currency] ?? '';
  return symbol ? `${symbol} ${formatted}` : formatted;
}

/** Valor numérico para mostrar (acepta string formateado del backend). */
function toDisplayNumber(value: string | number | null | undefined): number | null {
  const fromDirect = toNumericValue(value);
  if (fromDirect !== null) return fromDirect;
  if (value === null || value === undefined || value === '') return null;
  return parseNumberFromInput(String(value));
}

/** Formatea valor con moneda para solo lectura; devuelve '-' si no hay valor. */
function formatCurrencyOrDash(value: string | number | null | undefined, currency: string): string {
  const num = toDisplayNumber(value);
  if (num === null) return '-';
  return formatCurrency(num, currency);
}

/** Formatea fecha YYYY-MM-DD como DD/MM/YYYY en local. */
function formatDateOnlyForDisplay(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const ymd = dateStr.slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString('es-CO');
}

/** Valor YYYY-MM-DD para input type="date". */
function dateOnlyToInputValue(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  return dateStr.slice(0, 10);
}

function getFieldIndicators(
  indicators: Record<string, InlineChangeIndicator[]>,
  recordId: string,
  fieldName: string
): InlineChangeIndicator[] {
  return (indicators[recordId] || []).filter((log) => log.fieldName === fieldName);
}

function normalizeForCompare(value: NullablePrimitive): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function isValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value === 'boolean') return false;
  return false;
}

function mapValueForLog(value: NullablePrimitive): string | number | null {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return value;
}

interface EditRatesResult {
  pago1Tasa: number | null;
  pago2Tasa: number | null;
  pago3Tasa: number | null;
  totalValorGirado: number;
  tasaPromedio: number | null;
  contravalorPonderado: number | null;
  trmPonderada: number | null;
}

function useEditModalRates(editData: Partial<Pago>): EditRatesResult {
  const pago1Tasa = useMemo(
    () => calculateTasa(editData.pago1_trm, editData.pago1_contravalor),
    [editData.pago1_trm, editData.pago1_contravalor]
  );
  const pago2Tasa = useMemo(
    () => calculateTasa(editData.pago2_trm, editData.pago2_contravalor),
    [editData.pago2_trm, editData.pago2_contravalor]
  );
  const pago3Tasa = useMemo(
    () => calculateTasa(editData.pago3_trm, editData.pago3_contravalor),
    [editData.pago3_trm, editData.pago3_contravalor]
  );
  const totalValorGirado = useMemo(() => {
    const p1 = (editData.pago1_valor_girado === null || editData.pago1_valor_girado === undefined) ? 0 : Number(editData.pago1_valor_girado);
    const p2 = (editData.pago2_valor_girado === null || editData.pago2_valor_girado === undefined) ? 0 : Number(editData.pago2_valor_girado);
    const p3 = (editData.pago3_valor_girado === null || editData.pago3_valor_girado === undefined) ? 0 : Number(editData.pago3_valor_girado);
    return p1 + p2 + p3;
  }, [editData.pago1_valor_girado, editData.pago2_valor_girado, editData.pago3_valor_girado]);
  const tasaPromedio = useMemo(() => {
    const tasas = [pago1Tasa, pago2Tasa, pago3Tasa].filter((t): t is number => typeof t === 'number');
    return tasas.length === 0 ? null : tasas.reduce((sum, t) => sum + t, 0) / tasas.length;
  }, [pago1Tasa, pago2Tasa, pago3Tasa]);
  const { contravalorPonderado, trmPonderada } = useMemo(() => {
    const items = [
      { valor: editData.pago1_valor_girado, contravalor: editData.pago1_contravalor, trm: editData.pago1_trm },
      { valor: editData.pago2_valor_girado, contravalor: editData.pago2_contravalor, trm: editData.pago2_trm },
      { valor: editData.pago3_valor_girado, contravalor: editData.pago3_contravalor, trm: editData.pago3_trm },
    ];
    let totalPeso = 0;
    let sumaContravalor = 0;
    let sumaTrm = 0;
    items.forEach(({ valor, contravalor, trm }) => {
      const peso = Number(valor) || 0;
      if (peso > 0) {
        totalPeso += peso;
        const c = (contravalor === null || contravalor === undefined) ? Number.NaN : Number(contravalor);
        const t = (trm === null || trm === undefined) ? Number.NaN : Number(trm);
        if (Number.isFinite(c)) sumaContravalor += peso * c;
        if (Number.isFinite(t)) sumaTrm += peso * t;
      }
    });
    if (totalPeso <= 0) return { contravalorPonderado: null, trmPonderada: null };
    return {
      contravalorPonderado: sumaContravalor > 0 ? sumaContravalor / totalPeso : null,
      trmPonderada: sumaTrm > 0 ? sumaTrm / totalPeso : null,
    };
  }, [
    editData.pago1_valor_girado, editData.pago2_valor_girado, editData.pago3_valor_girado,
    editData.pago1_contravalor, editData.pago2_contravalor, editData.pago3_contravalor,
    editData.pago1_trm, editData.pago2_trm, editData.pago3_trm,
  ]);
  return { pago1Tasa, pago2Tasa, pago3Tasa, totalValorGirado, tasaPromedio, contravalorPonderado, trmPonderada };
}

const PAGOS_CACHE_DURATION_MS = 30000;

function usePagosData(): {
  pagos: Pago[];
  setPagos: React.Dispatch<React.SetStateAction<Pago[]>>;
  loading: boolean;
  error: string | null;
  fetchPagos: (forceRefresh?: boolean) => Promise<void>;
} {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pagosCacheRef = useRef<{ data: Pago[]; timestamp: number } | null>(null);
  const fetchPagos = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && pagosCacheRef.current) {
      const cacheAge = Date.now() - pagosCacheRef.current.timestamp;
      if (cacheAge < PAGOS_CACHE_DURATION_MS) {
        setPagos(pagosCacheRef.current.data);
        setLoading(false);
        return;
      }
    }
    try {
      setLoading(true);
      const data = await apiGet<Pago[]>('/api/pagos');
      pagosCacheRef.current = { data, timestamp: Date.now() };
      setPagos(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar pagos');
      if (pagosCacheRef.current) setPagos(pagosCacheRef.current.data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchPagos();
  }, [fetchPagos]);
  return { pagos, setPagos, loading, error, fetchPagos };
}

function usePagosChangeIndicators(
  pagos: Pago[],
  loading: boolean
): [Record<string, InlineChangeIndicator[]>, React.Dispatch<React.SetStateAction<Record<string, InlineChangeIndicator[]>>>] {
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<Record<string, InlineChangeIndicator[]>>({});
  useEffect(() => {
    if (pagos.length === 0 || loading) return;
    let cancelled = false;
    const recordIds = pagos.map((p) => p.id);
    const changeRow = (r: ChangeLogApiRow): InlineChangeIndicator => ({
      id: r.id,
      fieldName: r.field_name,
      fieldLabel: r.field_label,
      oldValue: r.old_value,
      newValue: r.new_value,
      reason: r.change_reason ?? undefined,
      changedAt: r.changed_at,
      moduleName: r.module_name ?? null,
    });
    const typeBatch = (table: string) =>
      apiPost<Record<string, ChangeLogApiRow[]>>(`/api/change-logs/batch`, { table_name: table, record_ids: recordIds });
    Promise.all([typeBatch('purchases'), typeBatch('new_purchases')]).then(([groupedPurchases, groupedNewPurchases]) => {
      if (cancelled) return;
      const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
      recordIds.forEach((id) => {
        const changes = (groupedPurchases[id] || []).length > 0 ? groupedPurchases[id] : (groupedNewPurchases[id] || []);
        if (changes && changes.length > 0) indicatorsMap[id] = changes.slice(0, 10).map(changeRow);
      });
      setInlineChangeIndicators(indicatorsMap);
    }).catch((err) => {
      if (!cancelled) console.error('Error al cargar indicadores de cambios:', err);
    });
    return () => { cancelled = true; };
  }, [pagos, loading]);
  return [inlineChangeIndicators, setInlineChangeIndicators];
}

const sortLocale = (a: string, b: string): number => (a ?? '').localeCompare(b ?? '', 'es');

interface PagosFilterState {
  purchaseIdFromUrl: string | null;
  searchTerm: string;
  filterPendiente: string;
  supplierFilter: string;
  modelFilter: string;
  serialFilter: string;
  mqFilter: string;
  empresaFilter: string;
}

function usePagosFiltered(pagos: Pago[], filters: PagosFilterState) {
  const {
    purchaseIdFromUrl,
    searchTerm,
    filterPendiente,
    supplierFilter,
    modelFilter,
    serialFilter,
    mqFilter,
    empresaFilter,
  } = filters;
  const filteredPagos = useMemo(() => {
    if (purchaseIdFromUrl) {
      return pagos.filter((p) => p.id === purchaseIdFromUrl);
    }
    return pagos.filter((pago) => {
      const matchesSearch =
        searchTerm === '' ||
        pago.mq?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pago.proveedor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pago.no_factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pago.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pago.serie?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPendiente = filterPendiente === '' || pago.pendiente_a === filterPendiente;
      if (supplierFilter && pago.proveedor !== supplierFilter) return false;
      if (modelFilter && pago.modelo !== modelFilter) return false;
      if (serialFilter && pago.serie !== serialFilter) return false;
      if (mqFilter && pago.mq !== mqFilter) return false;
      if (empresaFilter && pago.empresa !== empresaFilter) return false;
      return matchesSearch && matchesPendiente;
    });
  }, [pagos, purchaseIdFromUrl, searchTerm, filterPendiente, supplierFilter, modelFilter, serialFilter, mqFilter, empresaFilter]);
  const uniqueSuppliers = useMemo(() => [...new Set(pagos.map((item) => item.proveedor).filter(Boolean))].sort(sortLocale), [pagos]);
  const uniqueModels = useMemo(() => [...new Set(pagos.map((item) => item.modelo).filter(Boolean))].sort(sortLocale), [pagos]);
  const uniqueSerials = useMemo(() => [...new Set(pagos.map((item) => item.serie).filter(Boolean))].sort(sortLocale), [pagos]);
  const uniqueMqs = useMemo(() => [...new Set(pagos.map((item) => item.mq).filter(Boolean))].sort(sortLocale), [pagos]);
  const uniqueEmpresas = useMemo(() => [...new Set(pagos.map((item) => item.empresa).filter(Boolean))].sort(sortLocale), [pagos]);
  return { filteredPagos, uniqueSuppliers, uniqueModels, uniqueSerials, uniqueMqs, uniqueEmpresas };
}

function usePagosPageState() {
  const { pagos, setPagos, loading, error, fetchPagos } = usePagosData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPendiente, setFilterPendiente] = useState('');
  // Filtros de columnas
  const [supplierFilter, setSupplierFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [serialFilter, setSerialFilter] = useState('');
  const [mqFilter, setMqFilter] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState('');
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Pago>>({});
  // Estados locales para inputs de Valor Girado (para evitar interferencia del formato mientras se edita)
  const [pago1ValorGiradoInput, setPago1ValorGiradoInput] = useState<string>('');
  const [pago2ValorGiradoInput, setPago2ValorGiradoInput] = useState<string>('');
  const [pago3ValorGiradoInput, setPago3ValorGiradoInput] = useState<string>('');
  // Estados locales para inputs de Contravalor
  const [pago1ContravalorInput, setPago1ContravalorInput] = useState<string>('');
  const [pago2ContravalorInput, setPago2ContravalorInput] = useState<string>('');
  const [pago3ContravalorInput, setPago3ContravalorInput] = useState<string>('');
  const [contravalorSyncInput, setContravalorSyncInput] = useState<string>('');
  // Estados locales para inputs de TRM COP
  const [pago1TrmInput, setPago1TrmInput] = useState<string>('');
  const [pago2TrmInput, setPago2TrmInput] = useState<string>('');
  const [pago3TrmInput, setPago3TrmInput] = useState<string>('');
  const [trmSyncInput, setTrmSyncInput] = useState<string>('');
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = usePagosChangeIndicators(pagos, loading);
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const purchaseIdFromUrl = searchParams.get('purchaseId');

  const handleRetirarFiltroNotificacion = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('purchaseId');
      return next;
    });
  }, [setSearchParams]);
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { pagoId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());

  // Refs para scroll sincronizado (superior = inferior)
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [topScrollContentWidth, setTopScrollContentWidth] = useState(3000);
  const pendingChangeRef = useRef<{
    pagoId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  const pendienteOptions = [
    'PROVEEDORES MAQUITECNO',
    'PROVEEDORES PARTEQUIPOS MAQUINARIA',
    'PROVEEDORES SOREMAQ'
  ];

  /** Rellena el estado del modal de edición con los datos de un pago (lista o respuesta GET /api/pagos/:id) para que VALOR + BP, GASTOS + LAVADO, DESENSAMBLAJE + CARGUE y VALOR FOB (SUMA) coincidan con Compras/NewPurchases. */
  function fillEditStateFromPago(pago: Pago): void {
    setSelectedPago(pago);
    setEditData(buildEditDataFromPago(pago));
    setPago1ValorGiradoInput(formatOptionalValue(pago.pago1_valor_girado, (n) => formatCurrency(n, 'COP')));
    setPago2ValorGiradoInput(formatOptionalValue(pago.pago2_valor_girado, (n) => formatCurrency(n, 'COP')));
    setPago3ValorGiradoInput(formatOptionalValue(pago.pago3_valor_girado, (n) => formatCurrency(n, 'COP')));
    setPago1ContravalorInput(formatOptionalValue(pago.pago1_contravalor, formatNumberWithSeparators));
    setPago2ContravalorInput(formatOptionalValue(pago.pago2_contravalor, formatNumberWithSeparators));
    setPago3ContravalorInput(formatOptionalValue(pago.pago3_contravalor, formatNumberWithSeparators));
    setContravalorSyncInput(formatOptionalValue(pago.usd_jpy_rate, (n) => formatCurrency(n, 'USD')));
    setPago1TrmInput(formatOptionalValue(pago.pago1_trm, (n) => formatCurrency(n, 'COP')));
    setPago2TrmInput(formatOptionalValue(pago.pago2_trm, (n) => formatCurrency(n, 'COP')));
    setPago3TrmInput(formatOptionalValue(pago.pago3_trm, (n) => formatCurrency(n, 'COP')));
    setTrmSyncInput(formatOptionalValue(pago.trm_rate, (n) => formatCurrency(n, 'COP')));
  }

  async function handleEdit(pago: Pago): Promise<void> {
    fillEditStateFromPago(pago);
    setIsEditModalOpen(true);
    setEditModalLoading(true);
    try {
      const fresh = await apiGet<Pago>(`/api/pagos/${pago.id}`);
      fillEditStateFromPago(fresh);
    } catch {
      showError('No se pudieron cargar los valores actualizados de la compra.');
    } finally {
      setEditModalLoading(false);
    }
  }

  const handleView = (pago: Pago) => {
    setSelectedPago(pago);
    setIsViewModalOpen(true);
  };

  const handleViewHistory = (pago: Pago) => {
    setSelectedPago(pago);
    setIsChangeLogOpen(true);
  };

  // Sincronizar FECHA DE PAGO con la última de pago1/2/3 al cambiar cualquiera de ellas
  useEffect(() => {
    if (!isEditModalOpen) return;
    const latest = getLatestPaymentDate(editData.pago1_fecha, editData.pago2_fecha, editData.pago3_fecha);
    setEditData((prev) => {
      const nextDate = latest ?? prev.payment_date;
      return prev.payment_date === nextDate ? prev : { ...prev, payment_date: nextDate };
    });
  }, [isEditModalOpen, editData.pago1_fecha, editData.pago2_fecha, editData.pago3_fecha]);

  const { pago1Tasa, pago2Tasa, pago3Tasa, totalValorGirado, tasaPromedio, contravalorPonderado, trmPonderada } =
    useEditModalRates(editData);

  const handleSaveEdit = async () => {
    if (!selectedPago) return;

    try {
      // Enviar todos los campos de pagos múltiples (las tasas ya están calculadas en editData)
      await apiPut(`/api/pagos/${selectedPago.id}`, {
        observaciones_pagos: editData.observaciones_pagos || null,
        // Campos para sincronización con otros módulos
        usd_jpy_rate: editData.usd_jpy_rate || null,
        trm_rate: editData.trm_rate || null,
        payment_date: editData.payment_date || null,
        // Pago 1
        pago1_moneda: editData.pago1_moneda || null,
        pago1_fecha: editData.pago1_fecha || null,
        pago1_contravalor: editData.pago1_contravalor || null,
        pago1_trm: editData.pago1_trm || null,
        pago1_valor_girado: editData.pago1_valor_girado || null,
        pago1_tasa: pago1Tasa,
        // Pago 2
        pago2_moneda: editData.pago2_moneda || null,
        pago2_fecha: editData.pago2_fecha || null,
        pago2_contravalor: editData.pago2_contravalor || null,
        pago2_trm: editData.pago2_trm || null,
        pago2_valor_girado: editData.pago2_valor_girado || null,
        pago2_tasa: pago2Tasa,
        // Pago 3
        pago3_moneda: editData.pago3_moneda || null,
        pago3_fecha: editData.pago3_fecha || null,
        pago3_contravalor: editData.pago3_contravalor || null,
        pago3_trm: editData.pago3_trm || null,
        pago3_valor_girado: editData.pago3_valor_girado || null,
        pago3_tasa: pago3Tasa,
      });

      setIsEditModalOpen(false);
      fetchPagos(true); // Forzar refresh después de actualizar
      showSuccess('Pago actualizado correctamente');
    } catch (err: unknown) {
      console.error('Error updating pago:', err);
      showError('Error al actualizar el pago');
    }
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
        .then(() => fetchPagos(true)) // Forzar refresh después de guardar cambios en batch
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

  const applyBatchChangeIndicator = (
    pagoId: string,
    change: InlineChangeItem,
    reason?: string
  ): void => {
    const indicator: InlineChangeIndicator = {
      id: `${pagoId}-${change.field_name}-${Date.now()}`,
      fieldName: change.field_name,
      fieldLabel: change.field_label,
      oldValue: change.old_value,
      newValue: change.new_value,
      reason,
      changedAt: new Date().toISOString(),
    };
    setInlineChangeIndicators((prev) => ({
      ...prev,
      [pagoId]: [indicator, ...(prev[pagoId] || [])].slice(0, 10),
    }));
  };

  const confirmBatchChanges = async (reason?: string) => {
    const allUpdatesByPago = new Map<string, { pagoId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>();
    const allChanges: InlineChangeItem[] = [];

    pendingBatchChanges.forEach((batch) => {
      allChanges.push(...batch.changes);
      allUpdatesByPago.set(batch.pagoId, batch);
    });

    try {
      const logPromises = Array.from(allUpdatesByPago.values()).map(async (batch) => {
        await apiPost('/api/change-logs', {
          table_name: 'purchases',
          record_id: batch.pagoId,
          changes: batch.changes,
          change_reason: reason || null,
          module_name: 'pagos',
        });
        batch.changes.forEach((change) => applyBatchChangeIndicator(batch.pagoId, change, reason));
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
      fetchPagos(true); // Forzar refresh después de actualizar campo inline
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
      prev?.recordId === recordId && prev?.fieldName === fieldName
        ? null
        : { recordId, fieldName }
    );
  };

  const getRecordFieldValue = (
    record: Pago,
    fieldName: string
  ): NullablePrimitive => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return value === undefined ? null : (value as NullablePrimitive);
  };

  const beginInlineChange = (
    pago: Pago,
    fieldName: string,
    fieldLabel: string,
    oldValue: NullablePrimitive,
    newValue: NullablePrimitive,
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
      pagoId: 'BATCH_MODE',
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
    moduleName: 'Pagos'
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

  const buildCellProps = (recordId: string, field: string) => ({
    recordId,
    fieldName: field,
    indicators: getFieldIndicators(inlineChangeIndicators, recordId, field),
    openPopover: openChangePopover,
    onIndicatorClick: handleIndicatorClick,
  });

  const { filteredPagos, uniqueSuppliers, uniqueModels, uniqueSerials, uniqueMqs, uniqueEmpresas } =
    usePagosFiltered(pagos, {
      purchaseIdFromUrl,
      searchTerm,
      filterPendiente,
      supplierFilter,
      modelFilter,
      serialFilter,
      mqFilter,
      empresaFilter,
    });

  // Configuración de columnas
  // Helper function to get header background color based on column key and module origin
  const getColumnHeaderBgColor = (columnKey: string): string => {
    // Column MQ from Importations (amber-100)
    if (columnKey === 'mq') {
      return 'bg-amber-100';
    }
    // All other columns from Pagos (orange-100)
    return 'bg-orange-100';
  };

  const columns = [
    {
      key: 'proveedor',
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
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.proveedor || '-'}</span>
      )
    },
    {
      key: 'modelo',
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
            <option key={model || ''} value={model || ''}>{model}</option>
          ))}
        </select>
      ),
      render: (row: Pago) => <span className="text-sm text-gray-700">{row.modelo || '-'}</span>
    },
    {
      key: 'serie',
      label: 'SERIE',
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
      render: (row: Pago) => <span className="text-sm text-gray-700">{row.serie || '-'}</span>
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
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.mq || '-'}</span>
      )
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
        // ✅ Mostrar vencimiento para todos los registros (purchases y new_purchases)
        return (
          <span className="text-sm text-gray-700">
            {row.vencimiento ? new Date(row.vencimiento).toLocaleDateString('es-CO') : '-'}
          </span>
        );
      }
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
            displayFormatter={() => {
              const val = row.usd_jpy_rate;
              return val == null ? 'PDTE' : Number.parseFloat(String(val)).toFixed(2);
            }}
            onSave={(val) => {
              const numeric = toNumericValue(val);
              return requestFieldUpdate(row, 'usd_jpy_rate', 'Contravalor', numeric);
            }}
          />
        </InlineCell>
      )
    },
    {
      key: 'trm_rate',
      label: 'TRM (COP)',
      sortable: true,
      render: (row: Pago) => (
        <InlineCell {...buildCellProps(row.id, 'trm_rate')}>
          <InlineFieldEditor
            type="number"
            value={row.trm_rate ?? null}
            placeholder="PDTE"
            displayFormatter={() => {
              const val = row.trm_rate;
              return val == null
                ? 'PDTE'
                : `$ ${val.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }}
            onSave={(val) => {
              const numeric = toNumericValue(val);
              return requestFieldUpdate(row, 'trm_rate', 'TRM (COP)', numeric);
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
            value={row.payment_date ? dateOnlyToInputValue(row.payment_date) : null}
            placeholder="PDTE"
            displayFormatter={() =>
              row.payment_date ? (formatDateOnlyForDisplay(row.payment_date) ?? 'PDTE') : 'PDTE'
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

  // Color coding de filas: amarillo cuando se llega desde notificación (Ver → registro modificado en Compras)
  const getRowClassName = (row: Pago) => {
    if (purchaseIdFromUrl && row.id === purchaseIdFromUrl) {
      return 'bg-amber-100 hover:bg-amber-200 border-l-4 border-amber-500';
    }
    return 'bg-white hover:bg-gray-50';
  };

  return {
    loading,
    error,
    fetchPagos,
    pagos,
    setPagos,
    searchTerm,
    setSearchTerm,
    filterPendiente,
    setFilterPendiente,
    supplierFilter,
    setSupplierFilter,
    modelFilter,
    setModelFilter,
    serialFilter,
    setSerialFilter,
    mqFilter,
    setMqFilter,
    empresaFilter,
    setEmpresaFilter,
    selectedPago,
    setSelectedPago,
    isEditModalOpen,
    setIsEditModalOpen,
    editModalLoading,
    setEditModalLoading,
    isViewModalOpen,
    setIsViewModalOpen,
    isChangeLogOpen,
    setIsChangeLogOpen,
    editData,
    setEditData,
    pago1ValorGiradoInput,
    setPago1ValorGiradoInput,
    pago2ValorGiradoInput,
    setPago2ValorGiradoInput,
    pago3ValorGiradoInput,
    setPago3ValorGiradoInput,
    pago1ContravalorInput,
    setPago1ContravalorInput,
    pago2ContravalorInput,
    setPago2ContravalorInput,
    pago3ContravalorInput,
    setPago3ContravalorInput,
    contravalorSyncInput,
    setContravalorSyncInput,
    pago1TrmInput,
    setPago1TrmInput,
    pago2TrmInput,
    setPago2TrmInput,
    pago3TrmInput,
    setPago3TrmInput,
    trmSyncInput,
    setTrmSyncInput,
    changeModalOpen,
    setChangeModalOpen,
    changeModalItems,
    setChangeModalItems,
    inlineChangeIndicators,
    setInlineChangeIndicators,
    openChangePopover,
    setOpenChangePopover,
    purchaseIdFromUrl,
    handleRetirarFiltroNotificacion,
    batchModeEnabled,
    setBatchModeEnabled,
    pendingBatchChanges,
    setPendingBatchChanges,
    topScrollRef,
    tableScrollRef,
    topScrollContentWidth,
    setTopScrollContentWidth,
    pendienteOptions,
    fillEditStateFromPago,
    handleEdit,
    handleView,
    handleViewHistory,
    handleSaveEdit,
    pago1Tasa,
    pago2Tasa,
    pago3Tasa,
    totalValorGirado,
    tasaPromedio,
    contravalorPonderado,
    trmPonderada,
    queueInlineChange,
    applyBatchChangeIndicator,
    confirmBatchChanges,
    handleConfirmInlineChange,
    handleCancelInlineChange,
    handleIndicatorClick,
    getRecordFieldValue,
    beginInlineChange,
    requestFieldUpdate,
    handleSaveBatchChanges,
    handleCancelBatchChanges,
    buildCellProps,
    filteredPagos,
    uniqueSuppliers,
    uniqueModels,
    uniqueSerials,
    uniqueMqs,
    uniqueEmpresas,
    getColumnHeaderBgColor,
    columns,
    getRowClassName,
  };
}

type PagosPageContentProps = ReturnType<typeof usePagosPageState>;

function PagosStatsCards(props: Readonly<{ filteredPagos: Pago[] }>): React.ReactElement {
  const { filteredPagos } = props;
  const withValor = filteredPagos.filter(p => p.valor_factura_proveedor && p.valor_factura_proveedor > 0).length;
  const proximosVencer = filteredPagos.filter(p => {
    if (!p.fecha_vto_fact) return false;
    const dias = Math.ceil((new Date(p.fecha_vto_fact).getTime() - Date.now()) / (1000 * 3600 * 24));
    return dias > 0 && dias <= 7;
  }).length;
  const vencidos = filteredPagos.filter(p => {
    if (!p.fecha_vto_fact) return false;
    const dias = Math.ceil((new Date(p.fecha_vto_fact).getTime() - Date.now()) / (1000 * 3600 * 24));
    return dias < 0;
  }).length;
  return (
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
            <p className="text-2xl font-bold text-green-800">{withValor}</p>
          </div>
          <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
        </div>
      </Card>
      <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-600 font-semibold uppercase">Próximos a Vencer</p>
            <p className="text-2xl font-bold text-orange-800">{proximosVencer}</p>
          </div>
          <Clock className="w-8 h-8 text-orange-500 opacity-50" />
        </div>
      </Card>
      <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-red-600 font-semibold uppercase">Vencidos</p>
            <p className="text-2xl font-bold text-red-800">{vencidos}</p>
          </div>
          <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
        </div>
      </Card>
    </div>
  );
}

type PagosFiltersCardProps = Readonly<{
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterPendiente: string;
  setFilterPendiente: (v: string) => void;
  pendienteOptions: string[];
  batchModeEnabled: boolean;
  setBatchModeEnabled: (v: boolean) => void;
  pendingBatchChanges: Map<string, { pagoId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>;
  handleSaveBatchChanges: () => Promise<void>;
  handleCancelBatchChanges: () => void;
  purchaseIdFromUrl: string | null;
  handleRetirarFiltroNotificacion: () => void;
}>;

function PagosFiltersCard(props: PagosFiltersCardProps): React.ReactElement {
  const {
    searchTerm,
    setSearchTerm,
    filterPendiente,
    setFilterPendiente,
    pendienteOptions,
    batchModeEnabled,
    setBatchModeEnabled,
    pendingBatchChanges,
    handleSaveBatchChanges,
    handleCancelBatchChanges,
    purchaseIdFromUrl,
    handleRetirarFiltroNotificacion,
  } = props;
  return (
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
      <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={batchModeEnabled}
            onChange={(e) => {
              const checked = e.target.checked;
              setBatchModeEnabled(checked);
              if (checked === false && pendingBatchChanges.size > 0) {
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
        {purchaseIdFromUrl ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleRetirarFiltroNotificacion}
            className="inline-flex items-center gap-1.5"
          >
            <FilterX className="w-4 h-4" aria-hidden />
            Retirar filtro
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

type PagosTableCardProps = Readonly<{
  topScrollRef: React.RefObject<HTMLDivElement | null>;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
  topScrollContentWidth: number;
  columns: Array<{ key: string; label: string; sortable: boolean; filter?: React.ReactNode; render: (row: Pago) => React.ReactNode }>;
  filteredPagos: Pago[];
  getRowClassName: (row: Pago) => string;
  getHeaderBgColor: (columnKey: string) => string;
}>;

function PagosBatchFloatingBar(props: Readonly<{
  show: boolean;
  pendingBatchChanges: Map<string, { pagoId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>;
  onSave: () => Promise<void>;
  onCancel: () => void;
}>): React.ReactElement | null {
  const { show, pendingBatchChanges, onSave, onCancel } = props;
  if (!show) return null;
  const totalChanges = Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0);
  const totalRegistros = pendingBatchChanges.size;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-4 right-4 z-50"
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden max-w-sm">
        <div className="bg-gradient-to-r from-[#cf1b22] to-[#8a1217] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-md backdrop-blur-sm">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm truncate">Modo Masivo</h3>
              <p className="text-white/90 text-[10px] font-medium truncate">Cambios pendientes</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-[#cf1b22] rounded-full animate-pulse" />
                <div>
                  <p className="text-lg font-bold text-[#cf1b22] leading-tight">{totalRegistros}</p>
                  <p className="text-[10px] text-gray-600 font-medium leading-tight">
                    {totalRegistros === 1 ? 'Registro' : 'Registros'}
                  </p>
                </div>
              </div>
              <div className="h-8 w-px bg-gray-300" />
              <div>
                <p className="text-lg font-bold text-gray-800 leading-tight">{totalChanges}</p>
                <p className="text-[10px] text-gray-600 font-medium leading-tight">
                  {totalChanges === 1 ? 'Campo' : 'Campos'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onCancel} variant="secondary" className="px-3 py-1.5 text-xs font-semibold border border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50 transition-all duration-200 rounded-md">
                <X className="w-3.5 h-3.5" />
              </Button>
              <Button onClick={onSave} className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#cf1b22] to-[#8a1217] hover:from-[#b8181e] hover:to-[#8a1217] text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-md flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Guardar</span>
              </Button>
            </div>
          </div>
        </div>
        <div className="h-0.5 bg-gray-100">
          <motion.div
            className="h-full bg-gradient-to-r from-[#cf1b22] to-[#8a1217]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (totalChanges / 10) * 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function PagosTableCard(props: PagosTableCardProps): React.ReactElement {
  const {
    topScrollRef,
    tableScrollRef,
    topScrollContentWidth,
    columns,
    filteredPagos,
    getRowClassName,
    getHeaderBgColor,
  } = props;
  return (
    <Card>
      <div className="mb-3">
        <div
          ref={topScrollRef as React.RefObject<HTMLDivElement>}
          className="overflow-x-auto overflow-y-hidden rounded-lg shadow-inner bg-gray-100"
          style={{ height: '14px' }}
        >
          <div style={{ width: topScrollContentWidth, minWidth: '100%', height: 1 }} />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={filteredPagos}
        rowClassName={getRowClassName}
        rowIdAttr="id"
        scrollRef={tableScrollRef as React.RefObject<HTMLDivElement>}
        getHeaderBgColor={getHeaderBgColor}
      />
    </Card>
  );
}

/** Presentational layout; stats/filters/table/batch bar extracted. Remaining complexity from View/Edit/ChangeLog modals; full extraction would require a separate modals component with 50+ props. */
function PagosPageContent(props: Readonly<PagosPageContentProps>): React.ReactElement { // NOSONAR S3776
  const {
    topScrollRef,
    tableScrollRef,
    filteredPagos,
    purchaseIdFromUrl,
    ...rest
  } = props;

  // Igualar ancho del contenido del scroll superior al de la tabla (scroll inferior)
  const setTopScrollContentWidth = rest.setTopScrollContentWidth;
  useEffect(() => {
    const tableScroll = tableScrollRef.current;
    if (!tableScroll) return;
    const rafId = requestAnimationFrame(() => {
      const w = tableScroll.scrollWidth;
      if (w > 0) {
        setTopScrollContentWidth(w);
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [filteredPagos, setTopScrollContentWidth, tableScrollRef]);

  // Sincronizar scroll superior con tabla (y viceversa)
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
      if (topScroll && tableScroll) {
        topScroll.scrollLeft = tableScroll.scrollLeft;
      }
    };

    topScroll.addEventListener('scroll', handleTopScroll);
    tableScroll.addEventListener('scroll', handleTableScroll);

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableScroll.removeEventListener('scroll', handleTableScroll);
    };
  }, [filteredPagos, topScrollRef, tableScrollRef]);

  // Al abrir desde notificación (Ver), hacer scroll hasta la fila resaltada
  useEffect(() => {
    if (!purchaseIdFromUrl || !tableScrollRef.current) return;
    const timer = setTimeout(() => {
      const row = tableScrollRef.current?.querySelector(`tr[data-row-id="${CSS.escape(purchaseIdFromUrl)}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [purchaseIdFromUrl, filteredPagos, tableScrollRef]);

  const {
    error,
    searchTerm,
    setSearchTerm,
    filterPendiente,
    setFilterPendiente,
    selectedPago,
    isEditModalOpen,
    setIsEditModalOpen,
    editModalLoading,
    isViewModalOpen,
    setIsViewModalOpen,
    isChangeLogOpen,
    setIsChangeLogOpen,
    editData,
    setEditData,
    pago1ValorGiradoInput,
    setPago1ValorGiradoInput,
    pago2ValorGiradoInput,
    setPago2ValorGiradoInput,
    pago3ValorGiradoInput,
    setPago3ValorGiradoInput,
    pago1ContravalorInput,
    setPago1ContravalorInput,
    pago2ContravalorInput,
    setPago2ContravalorInput,
    pago3ContravalorInput,
    setPago3ContravalorInput,
    contravalorSyncInput,
    setContravalorSyncInput,
    pago1TrmInput,
    setPago1TrmInput,
    pago2TrmInput,
    setPago2TrmInput,
    pago3TrmInput,
    setPago3TrmInput,
    trmSyncInput,
    setTrmSyncInput,
    changeModalOpen,
    changeModalItems,
    handleRetirarFiltroNotificacion,
    batchModeEnabled,
    setBatchModeEnabled,
    pendingBatchChanges,
    topScrollContentWidth,
    pendienteOptions,
    handleSaveEdit,
    pago1Tasa,
    pago2Tasa,
    pago3Tasa,
    totalValorGirado,
    tasaPromedio,
    contravalorPonderado,
    trmPonderada,
    handleConfirmInlineChange,
    handleCancelInlineChange,
    handleSaveBatchChanges,
    handleCancelBatchChanges,
    getColumnHeaderBgColor,
    columns,
    getRowClassName,
  } = rest;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="rounded-xl shadow-md p-3" style={{ backgroundColor: '#ea580c' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
              <h1 className="text-lg font-semibold text-white">Pagos</h1>
            </div>
          </div>
        </div>
      </motion.div>

      <PagosStatsCards filteredPagos={filteredPagos} />

      <PagosFiltersCard
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterPendiente={filterPendiente}
        setFilterPendiente={setFilterPendiente}
        pendienteOptions={pendienteOptions}
        batchModeEnabled={batchModeEnabled}
        setBatchModeEnabled={setBatchModeEnabled}
        pendingBatchChanges={pendingBatchChanges}
        handleSaveBatchChanges={handleSaveBatchChanges}
        handleCancelBatchChanges={handleCancelBatchChanges}
        purchaseIdFromUrl={purchaseIdFromUrl}
        handleRetirarFiltroNotificacion={handleRetirarFiltroNotificacion}
      />

      {error && (
        <Card className="p-4 bg-red-50 border-l-4 border-red-500">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      <PagosTableCard
        topScrollRef={topScrollRef}
        tableScrollRef={tableScrollRef}
        topScrollContentWidth={topScrollContentWidth}
        columns={columns}
        filteredPagos={filteredPagos}
        getRowClassName={getRowClassName}
        getHeaderBgColor={getColumnHeaderBgColor}
      />

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
                  {selectedPago.usd_jpy_rate == null
                    ? 'PDTE'
                    : Number.parseFloat(String(selectedPago.usd_jpy_rate)).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">TRM</p>
                <p className="text-sm font-semibold text-gray-800">
                  {selectedPago.trm_rate == null
                    ? 'PDTE'
                    : selectedPago.trm_rate.toLocaleString('es-CO')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Fecha de Pago</p>
                <p className="text-sm text-gray-700">
                  {selectedPago.payment_date
                    ? (formatDateOnlyForDisplay(selectedPago.payment_date) ?? 'PDTE')
                    : 'PDTE'}
                </p>
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
          title={`Editar Pago - ${selectedPago.mq || 'Sin MQ'}${selectedPago.modelo ? ' | ' + selectedPago.modelo : ''}${selectedPago.serie ? ' | ' + selectedPago.serie : ''}`}
          size="lg"
        >
          <div className="space-y-3 p-5 max-h-[80vh] overflow-y-auto">
            {editModalLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="text-brand-red">
                  <Spinner size="lg" />
                </div>
                <p className="text-sm text-gray-600">Actualizando valores de compra (VALOR + BP, GASTOS + LAVADO, VALOR FOB…)</p>
              </div>
            ) : (
              <>
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
                  <p className="text-xs text-gray-500 uppercase font-semibold">Moneda</p>
                  <p className="text-gray-800 font-medium">{selectedPago.moneda || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">SHIPMENT</p>
                  <p className="text-gray-800 font-medium">{editData.shipment_type_v2 || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">VALOR + BP</p>
                  <p className="text-gray-800 font-medium">
                    {formatCurrencyOrDash(editData.exw_value_formatted, selectedPago.moneda || 'USD')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">GASTOS + LAVADO</p>
                  <p className="text-gray-800 font-medium">
                    {formatCurrencyOrDash(editData.fob_expenses, selectedPago.moneda || 'USD')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">DESENSAMBLAJE + CARGUE</p>
                  <p className="text-gray-800 font-medium">
                    {formatCurrencyOrDash(editData.disassembly_load_value, selectedPago.moneda || 'USD')}
                  </p>
                </div>
                {/* VALOR FOB (SUMA): solo lectura/guía; purchases=fob_total, new_purchases=valor total (np.value). Mostrar con signo de moneda y puntos (formatCurrencyOrDash). */}
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">VALOR FOB (SUMA)</p>
                  <p className="text-gray-800 font-medium">
                    {formatCurrencyOrDash(editData.fob_total ?? selectedPago?.fob_total, selectedPago.moneda || 'USD')}
                  </p>
                </div>
              </div>
            </div>

            {/* Campos editables - Múltiples Pagos */}
            <div className="space-y-3">
              {/* PAGO 1 */}
              <div className="border border-primary-200 rounded-lg p-3 bg-gradient-to-br from-white to-primary-50/30 shadow-sm">
                <h3 className="text-xs font-bold text-brand-red mb-2 uppercase tracking-wide border-b border-primary-200 pb-1.5">PAGO 1</h3>
                <div className="grid grid-cols-6 gap-2">
                  <div>
                    <label htmlFor="edit-pago1-moneda" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Moneda</label>
                    <select
                      id="edit-pago1-moneda"
                      value={editData.pago1_moneda || ''}
                      onChange={(e) => setEditData({ ...editData, pago1_moneda: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    >
                      <option value="">Seleccionar</option>
                      <option value="JPY">JPY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-pago1-fecha" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Fecha</label>
                    <input
                      type="date"
                      id="edit-pago1-fecha"
                      value={editData.pago1_fecha || ''}
                      onChange={(e) => setEditData({ ...editData, pago1_fecha: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago1-contravalor" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Contravalor</label>
                    <input
                      type="text"
                      id="edit-pago1-contravalor"
                      value={pago1ContravalorInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago1ContravalorInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago1_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, pago1_contravalor: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago1ContravalorInput('');
                          setEditData({ ...editData, pago1_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setPago1ContravalorInput(editData.pago1_contravalor == null ? '' : formatNumberWithSeparators(editData.pago1_contravalor));
                          } else {
                            setEditData({ ...editData, pago1_contravalor: val });
                            setPago1ContravalorInput(formatNumberWithSeparators(val));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago1-trm" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">TRM (COP)</label>
                    <input
                      type="text"
                      id="edit-pago1-trm"
                      value={pago1TrmInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago1TrmInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago1_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, pago1_trm: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago1TrmInput('');
                          setEditData({ ...editData, pago1_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setPago1TrmInput(editData.pago1_trm == null ? '' : formatCurrency(editData.pago1_trm, 'COP'));
                          } else {
                            setEditData({ ...editData, pago1_trm: val });
                            setPago1TrmInput(formatCurrency(val, 'COP'));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago1-valor-girado" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Valor Girado</label>
                    <input
                      type="text"
                      id="edit-pago1-valor-girado"
                      value={pago1ValorGiradoInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago1ValorGiradoInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago1_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, pago1_valor_girado: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago1ValorGiradoInput('');
                          setEditData({ ...editData, pago1_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setPago1ValorGiradoInput(editData.pago1_valor_girado == null ? '' : formatCurrency(editData.pago1_valor_girado, 'COP'));
                          } else {
                            setEditData({ ...editData, pago1_valor_girado: val });
                            setPago1ValorGiradoInput(formatCurrency(val, 'COP'));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago1-tasa" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Tasa</label>
                    <input
                      type="text"
                      id="edit-pago1-tasa"
                      value={pago1Tasa !== null && pago1Tasa !== undefined
                        ? formatNumberForInput(pago1Tasa)
                        : '-'}
                      readOnly
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-100 text-xs font-medium text-secondary-700"
                    />
                  </div>
                </div>
              </div>

              {/* PAGO 2 */}
              <div className="border border-primary-200 rounded-lg p-3 bg-gradient-to-br from-white to-primary-50/30 shadow-sm">
                <h3 className="text-xs font-bold text-brand-red mb-2 uppercase tracking-wide border-b border-primary-200 pb-1.5">PAGO 2</h3>
                <div className="grid grid-cols-6 gap-2">
                  <div>
                    <label htmlFor="edit-pago2-moneda" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Moneda</label>
                    <select
                      id="edit-pago2-moneda"
                      value={editData.pago2_moneda || ''}
                      onChange={(e) => setEditData({ ...editData, pago2_moneda: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    >
                      <option value="">Seleccionar</option>
                      <option value="JPY">JPY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-pago2-fecha" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Fecha</label>
                    <input
                      type="date"
                      id="edit-pago2-fecha"
                      value={editData.pago2_fecha || ''}
                      onChange={(e) => setEditData({ ...editData, pago2_fecha: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago2-contravalor" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Contravalor</label>
                    <input
                      type="text"
                      id="edit-pago2-contravalor"
                      value={pago2ContravalorInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago2ContravalorInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago2_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, pago2_contravalor: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago2ContravalorInput('');
                          setEditData({ ...editData, pago2_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setPago2ContravalorInput(editData.pago2_contravalor == null ? '' : formatNumberWithSeparators(editData.pago2_contravalor));
                          } else {
                            setEditData({ ...editData, pago2_contravalor: val });
                            setPago2ContravalorInput(formatNumberWithSeparators(val));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago2-trm" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">TRM (COP)</label>
                    <input
                      type="text"
                      id="edit-pago2-trm"
                      value={pago2TrmInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago2TrmInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago2_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, pago2_trm: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago2TrmInput('');
                          setEditData({ ...editData, pago2_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setPago2TrmInput(editData.pago2_trm == null ? '' : formatCurrency(editData.pago2_trm, 'COP'));
                          } else {
                            setEditData({ ...editData, pago2_trm: val });
                            setPago2TrmInput(formatCurrency(val, 'COP'));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago2-valor-girado" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Valor Girado</label>
                    <input
                      type="text"
                      id="edit-pago2-valor-girado"
                      value={pago2ValorGiradoInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago2ValorGiradoInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago2_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, pago2_valor_girado: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago2ValorGiradoInput('');
                          setEditData({ ...editData, pago2_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setPago2ValorGiradoInput(editData.pago2_valor_girado == null ? '' : formatCurrency(editData.pago2_valor_girado, 'COP'));
                          } else {
                            setEditData({ ...editData, pago2_valor_girado: val });
                            setPago2ValorGiradoInput(formatCurrency(val, 'COP'));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago2-tasa" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Tasa</label>
                    <input
                      type="text"
                      id="edit-pago2-tasa"
                      value={pago2Tasa !== null && pago2Tasa !== undefined
                        ? formatNumberForInput(pago2Tasa)
                        : '-'}
                      readOnly
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-100 text-xs font-medium text-secondary-700"
                    />
                  </div>
                </div>
              </div>

              {/* PAGO 3 */}
              <div className="border border-primary-200 rounded-lg p-3 bg-gradient-to-br from-white to-primary-50/30 shadow-sm">
                <h3 className="text-xs font-bold text-brand-red mb-2 uppercase tracking-wide border-b border-primary-200 pb-1.5">PAGO 3</h3>
                <div className="grid grid-cols-6 gap-2">
                  <div>
                    <label htmlFor="edit-pago3-moneda" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Moneda</label>
                    <select
                      id="edit-pago3-moneda"
                      value={editData.pago3_moneda || ''}
                      onChange={(e) => setEditData({ ...editData, pago3_moneda: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    >
                      <option value="">Seleccionar</option>
                      <option value="JPY">JPY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-pago3-fecha" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Fecha</label>
                    <input
                      type="date"
                      id="edit-pago3-fecha"
                      value={editData.pago3_fecha || ''}
                      onChange={(e) => setEditData({ ...editData, pago3_fecha: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago3-contravalor" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Contravalor</label>
                    <input
                      type="text"
                      id="edit-pago3-contravalor"
                      value={pago3ContravalorInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago3ContravalorInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago3_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, pago3_contravalor: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago3ContravalorInput('');
                          setEditData({ ...editData, pago3_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setPago3ContravalorInput(editData.pago3_contravalor == null ? '' : formatNumberWithSeparators(editData.pago3_contravalor));
                          } else {
                            setEditData({ ...editData, pago3_contravalor: val });
                            setPago3ContravalorInput(formatNumberWithSeparators(val));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago3-trm" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">TRM (COP)</label>
                    <input
                      type="text"
                      id="edit-pago3-trm"
                      value={pago3TrmInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago3TrmInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago3_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, pago3_trm: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago3TrmInput('');
                          setEditData({ ...editData, pago3_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setPago3TrmInput(editData.pago3_trm == null ? '' : formatCurrency(editData.pago3_trm, 'COP'));
                          } else {
                            setEditData({ ...editData, pago3_trm: val });
                            setPago3TrmInput(formatCurrency(val, 'COP'));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pago3-valor-girado" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Valor Girado</label>
                    <input
                      type="text"
                      id="edit-pago3-valor-girado"
                      value={pago3ValorGiradoInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago3ValorGiradoInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago3_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, pago3_valor_girado: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago3ValorGiradoInput('');
                          setEditData({ ...editData, pago3_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setPago3ValorGiradoInput(editData.pago3_valor_girado == null ? '' : formatCurrency(editData.pago3_valor_girado, 'COP'));
                          } else {
                            setEditData({ ...editData, pago3_valor_girado: val });
                            setPago3ValorGiradoInput(formatCurrency(val, 'COP'));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
              />
                  </div>
                  <div>
                    <label htmlFor="edit-pago3-tasa" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Tasa</label>
                    <input
                      type="text"
                      id="edit-pago3-tasa"
                      value={pago3Tasa !== null && pago3Tasa !== undefined
                        ? formatNumberForInput(pago3Tasa)
                        : '-'}
                      readOnly
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-100 text-xs font-medium text-secondary-700"
                    />
                  </div>
                </div>
              </div>

              {/* TOTALES */}
              <div className="border-2 border-brand-red rounded-lg p-3 bg-gradient-to-r from-primary-50 to-brand-red/5">
                <h3 className="text-xs font-bold text-brand-red mb-2 uppercase tracking-wide border-b-2 border-brand-red pb-1.5">TOTALES</h3>
                <div className="grid grid-cols-5 gap-2">
                  <div></div>
                  <div></div>
                  <div></div>
                  <div>
                    <label htmlFor="edit-total-valor-girado" className="block text-[10px] font-bold text-brand-red uppercase mb-1 tracking-wide">Total Valor Girado</label>
                    <input
                      type="text"
                      id="edit-total-valor-girado"
                      value={totalValorGirado !== null && totalValorGirado !== undefined && !Number.isNaN(totalValorGirado) 
                        ? formatCurrency(totalValorGirado, 'COP')
                        : '$ 0,00'}
                      readOnly
                      className="w-full px-2 py-1.5 border-2 border-brand-red rounded-md bg-white font-bold text-xs text-brand-red"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-tasa-promedio" className="block text-[10px] font-bold text-brand-red uppercase mb-1 tracking-wide">Tasa Promedio</label>
                    <input
                      type="text"
                      id="edit-tasa-promedio"
                      value={tasaPromedio !== null && tasaPromedio !== undefined
                        ? formatNumberForInput(tasaPromedio)
                        : '-'}
                      readOnly
                      className="w-full px-2 py-1.5 border-2 border-brand-red rounded-md bg-white font-bold text-xs text-brand-red"
                    />
                  </div>
                </div>
                {/* Sugerencias ponderadas */}
                <div className="mt-3 grid grid-cols-5 gap-2 items-end">
                  <div></div>
                  <div></div>
                  <div>
                    <p className="text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">
                      Sugerencias (ponderadas por Valor Girado)
                    </p>
                  </div>
                  <div>
                    <label htmlFor="edit-contravalor-ponderado" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">
                      Contravalor Ponderado
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        id="edit-contravalor-ponderado"
                        value={
                          contravalorPonderado !== null && contravalorPonderado !== undefined
                            ? formatNumberWithSeparators(contravalorPonderado)
                            : '-'
                        }
                        readOnly
                        className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-50 text-xs"
                      />
                      <button
                        type="button"
                        disabled={contravalorPonderado === null || contravalorPonderado === undefined}
                        onClick={() => {
                          if (contravalorPonderado === null || contravalorPonderado === undefined) return;
                          setEditData(prev => ({ ...prev, usd_jpy_rate: contravalorPonderado }));
                          setContravalorSyncInput(formatNumberWithSeparators(contravalorPonderado));
                        }}
                        className="px-2 py-1 text-[10px] font-semibold text-white bg-brand-red rounded-md disabled:opacity-50"
                      >
                        Usar
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="edit-trm-ponderada" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">
                      TRM (COP) Ponderada
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        id="edit-trm-ponderada"
                        value={
                          trmPonderada !== null && trmPonderada !== undefined
                            ? formatNumberForInput(trmPonderada)
                            : '-'
                        }
                        readOnly
                        className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-50 text-xs"
                      />
                      <button
                        type="button"
                        disabled={trmPonderada === null || trmPonderada === undefined}
                        onClick={() => {
                          if (trmPonderada === null || trmPonderada === undefined) return;
                          setEditData(prev => ({ ...prev, trm_rate: trmPonderada }));
                          setTrmSyncInput(formatNumberForInput(trmPonderada));
                        }}
                        className="px-2 py-1 text-[10px] font-semibold text-white bg-brand-red rounded-md disabled:opacity-50"
                      >
                        Usar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label htmlFor="edit-observaciones" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">
                  Observaciones
                </label>
                <textarea
                  id="edit-observaciones"
                  value={editData.observaciones_pagos || ''}
                  onChange={(e) => setEditData({ ...editData, observaciones_pagos: e.target.value })}
                  rows={2}
                  className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs resize-none"
                />
              </div>

              {/* Campos para sincronización con otros módulos */}
              <div className="border-t-2 border-secondary-200 pt-3">
                <h3 className="text-xs font-bold text-brand-gray mb-1.5 uppercase tracking-wide">Campos para Sincronización</h3>
                <p className="text-[10px] text-secondary-500 mb-2">
                  Valores utilizados para sincronizar con otros módulos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="edit-sync-contravalor" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">CONTRAVALOR</label>
                    <input
                      type="text"
                      id="edit-sync-contravalor"
                      value={contravalorSyncInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setContravalorSyncInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, usd_jpy_rate: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, usd_jpy_rate: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setContravalorSyncInput('');
                          setEditData({ ...editData, usd_jpy_rate: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setContravalorSyncInput(editData.usd_jpy_rate == null ? '' : formatNumberWithSeparators(editData.usd_jpy_rate));
                          } else {
                            setEditData({ ...editData, usd_jpy_rate: val });
                            setContravalorSyncInput(formatNumberWithSeparators(val));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-sync-trm" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">TRM (COP)</label>
                    <input
                      type="text"
                      id="edit-sync-trm"
                      value={trmSyncInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setTrmSyncInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, trm_rate: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            // mantiene editData sin cambiar
                          } else {
                            setEditData({ ...editData, trm_rate: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setTrmSyncInput('');
                          setEditData({ ...editData, trm_rate: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val === null) {
                            setTrmSyncInput(editData.trm_rate == null ? '' : formatCurrency(editData.trm_rate, 'COP'));
                          } else {
                            setEditData({ ...editData, trm_rate: val });
                            setTrmSyncInput(formatCurrency(val, 'COP'));
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-payment-date" className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">FECHA DE PAGO</label>
                    <input
                      type="date"
                      id="edit-payment-date"
                      value={dateOnlyToInputValue(editData.payment_date)}
                      onChange={(e) => {
                        const dateValue = e.target.value ? e.target.value : null;
                        setEditData({ ...editData, payment_date: dateValue });
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-secondary-200">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Guardar Cambios
              </Button>
            </div>
              </>
            )}
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

      <PagosBatchFloatingBar
        show={batchModeEnabled && pendingBatchChanges.size > 0}
        pendingBatchChanges={pendingBatchChanges}
        onSave={handleSaveBatchChanges}
        onCancel={handleCancelBatchChanges}
      />
    </div>
  );
}

function PagosPage(): React.ReactElement {
  const state = usePagosPageState();
  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  return <PagosPageContent {...state} />;
}

export default PagosPage;

