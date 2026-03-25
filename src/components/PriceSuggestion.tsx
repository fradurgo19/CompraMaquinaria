import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Database, AlertCircle, CheckCircle2, X, Settings } from 'lucide-react';
import { apiPost } from '../services/api';
import { Modal } from '../molecules/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { showError } from './Toast';

type SuggestionType = 'auction' | 'pvp' | 'repuestos';

interface PriceSuggestionProps {
  type: SuggestionType;
  model: string;
  year?: number | null;
  hours?: number | null;
  costoArancel?: number | null;
  exactModelOnly?: boolean;
  onApply?: (value: number) => void;
  autoFetch?: boolean; // Si es true, busca automáticamente al montar
  compact?: boolean; // Modo compacto para celdas de tabla
  forcePopoverPosition?: 'top' | 'bottom'; // Forzar posición del popover
  onPopoverToggle?: (isOpen: boolean) => void; // Callback cuando el popover se abre/cierra
  currentRecordsLabel?: string; // Etiqueta de registros actuales en "Históricos Destacados"
}

interface SuggestionResponse {
  suggested_price?: number;
  suggested_pvp?: number;
  suggested_rptos?: number;
  suggested_margin?: number;
  confidence: string;
  confidence_score: number;
  price_range: {
    min: number | null;
    max: number | null;
  };
  sources: {
    historical: number;
    current: number;
    total: number;
  };
  sample_records?: {
    historical?: Array<{ model?: string; year?: number; hours?: number; price?: number; pvp?: number; rptos?: number; suggested_price?: number; currency?: string }>;
    current?: Array<{ model?: string; year?: number; hours?: number; price?: number; pvp?: number; rptos?: number; currency?: string }>;
  };
  suggested_currency?: string | null;
  message?: string;
  model?: string;
  year?: number | null;
  hours?: number | null;
}

const REPUESTOS_ROUNDING_STEP = 1_000_000;

const normalizeSuggestedRepuestosValue = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.floor(value / REPUESTOS_ROUNDING_STEP) * REPUESTOS_ROUNDING_STEP;
};

function getConfidenceTextClass(confidence: string): string {
  if (confidence === 'ALTA') return 'text-green-600';
  if (confidence === 'MEDIA') return 'text-yellow-600';
  if (confidence === 'BAJA') return 'text-orange-600';
  return 'text-gray-500';
}

function sanitizeNumericInput(rawValue: string): string {
  return rawValue.trim().replaceAll(/[^\d,.-]/g, '');
}

function normalizeMixedSeparators(cleaned: string): string {
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastComma > lastDot) {
    // Formato tipo 1.234,56 -> quitar miles y usar punto decimal
    return cleaned.replaceAll('.', '').replaceAll(',', '.');
  }
  // Formato tipo 1,234.56 -> quitar miles
  return cleaned.replaceAll(',', '');
}

function normalizeCommaOnly(cleaned: string): string {
  // Si coincide con miles (1,234 o 12,345,678), quitar comas.
  const hasThousandsComma = /^-?\d{1,3}(,\d{3})+$/.test(cleaned);
  if (hasThousandsComma) {
    return cleaned.replaceAll(',', '');
  }
  // Si no, asumir coma decimal.
  return cleaned.replaceAll(',', '.');
}

function normalizeDotOnly(cleaned: string): string {
  // Si coincide con miles (1.234 o 12.345.678), quitar puntos.
  const hasThousandsDot = /^-?\d{1,3}(\.\d{3})+$/.test(cleaned);
  return hasThousandsDot ? cleaned.replaceAll('.', '') : cleaned;
}

function normalizeNumericString(cleaned: string): string {
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  if (hasDot && hasComma) return normalizeMixedSeparators(cleaned);
  if (hasComma) return normalizeCommaOnly(cleaned);
  if (hasDot) return normalizeDotOnly(cleaned);
  return cleaned;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;

  const cleaned = sanitizeNumericInput(value);
  if (!cleaned) return null;

  const normalized = normalizeNumericString(cleaned);
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getActiveRangeSummary(
  year?: number | null,
  hours?: number | null,
  yearsRange: number = 1,
  hoursRange: number = 1000
): string {
  const yearValue = toFiniteNumber(year);
  const hasValidYear = yearValue !== null && yearValue > 0;
  const hoursValue = toFiniteNumber(hours);
  const hasValidHours = hoursValue !== null && hoursValue >= 0;

  let yearSummary = 'N/A';
  if (hasValidYear) {
    yearSummary = `${yearValue - yearsRange} a ${yearValue + yearsRange}`;
  }

  let hoursSummary = 'N/A';
  if (hasValidHours) {
    hoursSummary = `${(hoursValue - hoursRange).toLocaleString('es-CO')} a ${(hoursValue + hoursRange).toLocaleString('es-CO')} hrs`;
  }
  return `Años: ${yearSummary} | Horas: ${hoursSummary}`;
}

function LoadingSuggestionView({ compact }: Readonly<{ compact: boolean }>): React.ReactElement {
  if (compact) {
    return (
      <div className="flex items-center justify-end gap-1 text-xs text-gray-400">
        <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent" />
      Calculando sugerencia...
    </div>
  );
}

function SinDatosSuggestionView(): React.ReactElement {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <AlertCircle className="w-4 h-4" />
      Sin datos históricos
    </div>
  );
}

interface ManualSuggestionViewProps {
  isLoading: boolean;
  model: string;
  showDetails: boolean;
  suggestion: SuggestionResponse | null;
  suggestedValue: number | null | undefined;
  type: SuggestionType;
  onApply?: (value: number) => void;
  setShowDetails: (v: boolean) => void;
  fetchSuggestion: () => void;
  formatCurrency: (value: number | null | undefined) => string;
  formatPriceWithCurrency: (value: number | null | undefined, currencyCode: string | null | undefined) => string;
  getConfidenceStars: () => number;
  getTitle: () => string;
}

function ManualSuggestionView(props: Readonly<ManualSuggestionViewProps>): React.ReactElement {
  const {
    isLoading,
    model,
    showDetails,
    suggestion,
    suggestedValue,
    type,
    onApply,
    setShowDetails,
    fetchSuggestion,
    formatCurrency,
    formatPriceWithCurrency,
    getConfidenceStars,
    getTitle
  } = props;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => fetchSuggestion()}
        disabled={isLoading || !model}
        className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-4 h-4" />
        {isLoading ? 'Calculando...' : 'Ver Sugerencia'}
      </button>
      <AnimatePresence>
        {showDetails && suggestion && (
          <SuggestionModal
            suggestion={suggestion}
            type={type}
            suggestedValue={suggestedValue ?? null}
            onClose={() => setShowDetails(false)}
            onApply={onApply}
            formatCurrency={formatCurrency}
            formatPriceWithCurrency={formatPriceWithCurrency}
            getConfidenceStars={getConfidenceStars}
            getTitle={getTitle}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface CompactPopoverContentProps {
  suggestion: SuggestionResponse | null;
  isLoading: boolean;
  suggestedValue: number | null | undefined;
  type: SuggestionType;
  onApply?: (value: number) => void;
  year?: number | null;
  hours?: number | null;
  hoursRange: number;
  setHoursRange: (v: number) => void;
  yearsRange: number;
  setYearsRange: (v: number) => void;
  setShowDetails: (v: boolean) => void;
  fetchSuggestion: (hoursR?: number, yearsR?: number) => void;
  getDefaultHoursRange: () => number;
  getDefaultYearsRange: () => number;
  getTitle: () => string;
  getSuggestedDisplayValue: (val: number | null | undefined, currency?: string | null) => string;
  getConfidenceBadgeClass: (confidence: string) => string;
  formatCurrency: (value: number | null | undefined) => string;
  formatPriceWithCurrency: (value: number | null | undefined, currencyCode: string | null | undefined) => string;
  currentRecordsLabel: string;
}

function CompactPopoverContent({
  suggestion,
  isLoading,
  suggestedValue,
  type,
  onApply,
  year,
  hours,
  hoursRange,
  setHoursRange,
  yearsRange,
  setYearsRange,
  setShowDetails,
  fetchSuggestion,
  getDefaultHoursRange,
  getDefaultYearsRange,
  getTitle,
  getSuggestedDisplayValue,
  getConfidenceBadgeClass,
  formatCurrency,
  formatPriceWithCurrency,
  currentRecordsLabel
}: Readonly<CompactPopoverContentProps>): React.ReactElement {
  const noData = suggestion && (suggestion.confidence === 'SIN_DATOS' || (suggestedValue == null && !['ALTA', 'MEDIA', 'BAJA'].includes(suggestion.confidence)));

  if (!suggestion) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex items-center gap-2 text-xs text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#cf1b22] border-t-transparent" />
          <span>Calculando sugerencia...</span>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => fetchSuggestion()}
            className="text-[10px] px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (noData) {
    return (
      <>
        <div className="text-center py-6">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-2">No se encontraron datos históricos</p>
          <p className="text-xs text-gray-500 mb-1">{suggestion.message || 'No hay registros similares en las bases de datos para este modelo, año y horas.'}</p>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Parámetros de búsqueda:</p>
            <p className="text-xs text-gray-500">Modelo: {suggestion.model || 'N/A'}</p>
            <p className="text-xs text-gray-500">Año: {suggestion.year || 'N/A'}</p>
            <p className="text-xs text-gray-500">Horas: {suggestion.hours || 'N/A'}</p>
          </div>
        </div>
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-2">Ajustar rango de búsqueda</p>
          <p className="text-[10px] text-gray-500 mb-2">Amplía años u horas para intentar encontrar datos históricos.</p>
          <div className="space-y-2">
            <div>
              <label htmlFor="price-sugg-hours-range-pop-nodata" className="block text-[10px] text-gray-600 mb-1">
                Rango de Horas (±)
              </label>
              <input
                id="price-sugg-hours-range-pop-nodata"
                type="range"
                min="100"
                max="10000"
                step="100"
                value={hoursRange}
                onChange={(e) => {
                  const newRange = Number.parseInt(e.target.value, 10);
                  setHoursRange(newRange);
                  setTimeout(() => fetchSuggestion(newRange, yearsRange), 300);
                }}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>100</span>
                <span className="font-semibold text-[#50504f]">{hoursRange.toLocaleString('es-CO')} hrs</span>
                <span>10,000</span>
              </div>
              {hours != null && (
                <p className="text-[9px] text-gray-400 mt-1">
                  Búsqueda: {(hours - hoursRange).toLocaleString('es-CO')} a {(hours + hoursRange).toLocaleString('es-CO')} hrs
                </p>
              )}
            </div>
            <div>
              <label htmlFor="price-sugg-years-range-pop-nodata" className="block text-[10px] text-gray-600 mb-1">
                Rango de Años (±)
              </label>
              <input
                id="price-sugg-years-range-pop-nodata"
                type="range"
                min="1"
                max="10"
                step="1"
                value={yearsRange}
                onChange={(e) => {
                  const newRange = Number.parseInt(e.target.value, 10);
                  setYearsRange(newRange);
                  setTimeout(() => fetchSuggestion(hoursRange, newRange), 300);
                }}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>1</span>
                <span className="font-semibold text-[#50504f]">{yearsRange} año{yearsRange === 1 ? '' : 's'}</span>
                <span>10</span>
              </div>
              {year != null && (
                <p className="text-[9px] text-gray-400 mt-1">
                  Búsqueda: {year - yearsRange} a {year + yearsRange}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const defaultHours = getDefaultHoursRange();
                const defaultYears = getDefaultYearsRange();
                setHoursRange(defaultHours);
                setYearsRange(defaultYears);
                setTimeout(() => fetchSuggestion(defaultHours, defaultYears), 300);
              }}
              className="w-full text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
            >
              Restaurar Predeterminados
            </button>
          </div>
        </div>
      </>
    );
  }

  const formatRecordPrice = (record: { price?: number; pvp?: number; rptos?: number; suggested_price?: number; currency?: string }) => {
    if (type === 'auction') return formatPriceWithCurrency(record.price ?? record.pvp ?? record.rptos ?? record.suggested_price, record.currency);
    return formatCurrency(record.price || record.pvp || record.rptos || record.suggested_price);
  };

  return (
    <>
      {isLoading && (
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2 text-xs text-gray-500">
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-[#cf1b22] border-t-transparent" />
            <span>Actualizando sugerencia...</span>
          </div>
        </div>
      )}
      <div className="text-center pb-2 border-b border-gray-100">
        <p className="text-xs text-gray-500 mb-1">{getTitle()}</p>
        <p className="text-xl font-bold text-[#cf1b22]">
          {getSuggestedDisplayValue(suggestedValue, suggestion.suggested_currency)}
        </p>
        <div className={`inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded ${getConfidenceBadgeClass(suggestion.confidence)}`}>
          Confianza: {suggestion.confidence}
        </div>
      </div>
      {suggestion.price_range && (suggestion.price_range.min || suggestion.price_range.max) && (
        <div className="text-xs">
          <p className="text-gray-500 mb-1">Rango de precios:</p>
          <div className="flex justify-between text-[#50504f] font-medium">
            <span>Min: {formatCurrency(suggestion.price_range.min)}</span>
            <span>Max: {formatCurrency(suggestion.price_range.max)}</span>
          </div>
        </div>
      )}
      <div className="text-xs flex items-center gap-2 text-gray-500">
        <Database className="w-3 h-3" />
        <span>{suggestion.sources.total} registros similares</span>
      </div>
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-700 mb-2">Configurar Rango de Búsqueda</p>
        <div className="space-y-2">
          <div>
            <label htmlFor="price-sugg-hours-range-pop" className="block text-[10px] text-gray-600 mb-1">
              Rango de Horas (±)
            </label>
            <input
              id="price-sugg-hours-range-pop"
              type="range"
              min="100"
              max="10000"
              step="100"
              value={hoursRange}
              onChange={(e) => {
                const newRange = Number.parseInt(e.target.value, 10);
                setHoursRange(newRange);
                setTimeout(() => fetchSuggestion(newRange, yearsRange), 300);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>100</span>
              <span className="font-semibold text-[#50504f]">{hoursRange.toLocaleString('es-CO')} hrs</span>
              <span>10,000</span>
            </div>
            {hours != null && (
              <p className="text-[9px] text-gray-400 mt-1">
                Búsqueda: {(hours - hoursRange).toLocaleString('es-CO')} a {(hours + hoursRange).toLocaleString('es-CO')} hrs
              </p>
            )}
          </div>
          <div>
            <label htmlFor="price-sugg-years-range-pop" className="block text-[10px] text-gray-600 mb-1">
              Rango de Años (±)
            </label>
            <input
              id="price-sugg-years-range-pop"
              type="range"
              min="1"
              max="10"
              step="1"
              value={yearsRange}
              onChange={(e) => {
                const newRange = Number.parseInt(e.target.value, 10);
                setYearsRange(newRange);
                setTimeout(() => fetchSuggestion(hoursRange, newRange), 300);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>1</span>
              <span className="font-semibold text-[#50504f]">{yearsRange} año{yearsRange === 1 ? '' : 's'}</span>
              <span>10</span>
            </div>
            {year != null && (
              <p className="text-[9px] text-gray-400 mt-1">
                Búsqueda: {year - yearsRange} a {year + yearsRange}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              const defaultHours = getDefaultHoursRange();
              const defaultYears = getDefaultYearsRange();
              setHoursRange(defaultHours);
              setYearsRange(defaultYears);
              setTimeout(() => fetchSuggestion(defaultHours, defaultYears), 300);
            }}
            className="w-full text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            Restaurar Predeterminados
          </button>
        </div>
      </div>
      {((suggestion.sample_records?.historical?.length ?? 0) > 0 || (suggestion.sample_records?.current?.length ?? 0) > 0) && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-2">Históricos Destacados</p>
          <p className="text-[10px] text-gray-500 mb-2">
            Rango activo: {getActiveRangeSummary(year, hours, yearsRange, hoursRange)}
          </p>
          <div className="space-y-1.5">
            {(suggestion.sample_records?.historical ?? []).length > 0 && (
              <p className="text-[10px] text-gray-500 font-medium">Importado</p>
            )}
            {(suggestion.sample_records?.historical ?? []).slice(0, 5).map((record, idx) => (
              <div key={`hist-${record.model ?? ''}-${record.year ?? ''}-${idx}`} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  {record.year != null && (
                    <span className="font-medium text-gray-700">{record.year}</span>
                  )}
                  {record.year != null && record.hours != null && <span className="text-gray-400">•</span>}
                  {record.hours != null && (
                    <span className="text-gray-500">{record.hours.toLocaleString('es-CO')} hrs</span>
                  )}
                </div>
                <span className="text-xs font-bold text-[#cf1b22]">
                  {formatRecordPrice(record)}
                </span>
              </div>
            ))}
            {(suggestion.sample_records?.current ?? []).length > 0 && (
              <p className="text-[10px] text-gray-500 font-medium pt-0.5">{currentRecordsLabel}</p>
            )}
            {(suggestion.sample_records?.current ?? []).slice(0, 3).map((record, idx) => (
              <div key={`curr-${record.model ?? ''}-${record.year ?? ''}-${idx}`} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  {record.year != null && (
                    <span className="font-medium text-gray-700">{record.year}</span>
                  )}
                  {record.year != null && record.hours != null && <span className="text-gray-400">•</span>}
                  {record.hours != null && (
                    <span className="text-gray-500">{record.hours.toLocaleString('es-CO')} hrs</span>
                  )}
                </div>
                <span className="text-xs font-bold text-[#cf1b22]">
                  {formatRecordPrice(record)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {onApply && suggestedValue != null && suggestion.confidence !== 'SIN_DATOS' && (
        <div className="pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              onApply(suggestedValue);
              setShowDetails(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#cf1b22] text-white text-xs font-medium rounded hover:bg-[#a81820] transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" />
            Aplicar valor
          </button>
        </div>
      )}
    </>
  );
}

interface CompactSuggestionViewProps {
  model: string;
  suggestion: SuggestionResponse | null;
  isLoading: boolean;
  suggestedValue: number | null | undefined;
  type: SuggestionType;
  onApply?: (value: number) => void;
  year?: number | null;
  hours?: number | null;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  fetchSuggestion: (hoursR?: number, yearsR?: number) => void;
  hoursRange: number;
  setHoursRange: (v: number) => void;
  yearsRange: number;
  setYearsRange: (v: number) => void;
  showConfigModal: boolean;
  setShowConfigModal: (v: boolean) => void;
  getDefaultHoursRange: () => number;
  getDefaultYearsRange: () => number;
  getTitle: () => string;
  getSuggestedDisplayValue: (val: number | null | undefined, currency?: string | null) => string;
  getConfidenceBadgeClass: (confidence: string) => string;
  formatCurrency: (value: number | null | undefined) => string;
  formatPriceWithCurrency: (value: number | null | undefined, currencyCode: string | null | undefined) => string;
  currentRecordsLabel: string;
  buttonRef: React.RefObject<HTMLButtonElement>;
  popoverRef: React.RefObject<HTMLDivElement>;
  popoverPosition: 'top' | 'bottom';
}

function CompactSuggestionView({
  model,
  suggestion,
  isLoading,
  suggestedValue,
  type,
  onApply,
  year,
  hours,
  showDetails,
  setShowDetails,
  fetchSuggestion,
  hoursRange,
  setHoursRange,
  yearsRange,
  setYearsRange,
  showConfigModal,
  setShowConfigModal,
  getDefaultHoursRange,
  getDefaultYearsRange,
  getTitle,
  getSuggestedDisplayValue,
  getConfidenceBadgeClass,
  formatCurrency,
  formatPriceWithCurrency,
  currentRecordsLabel,
  buttonRef,
  popoverRef,
  popoverPosition
}: Readonly<CompactSuggestionViewProps>): React.ReactElement {
  const getConfidenceColor = () => {
    if (!suggestion) return 'gray';
    switch (suggestion.confidence) {
      case 'ALTA': return 'green';
      case 'MEDIA': return 'yellow';
      case 'BAJA': return 'orange';
      default: return 'gray';
    }
  };
  const getConfidenceLetter = () => {
    if (!suggestion) return null;
    const c = suggestion.confidence;
    if (c === 'ALTA') return 'A';
    if (c === 'MEDIA') return 'M';
    if (c === 'BAJA') return 'B';
    return null;
  };
  const getConfidenceBadge = () => {
    if (!suggestion) return null;
    const letter = getConfidenceLetter();
    if (!letter) return null;
    const color = getConfidenceColor();
    const colorClasses: Record<string, string> = {
      green: 'bg-green-100 text-green-700 border-green-300',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      orange: 'bg-orange-100 text-orange-700 border-orange-300',
      gray: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return (
      <span className={`px-1 py-0.5 rounded text-[9px] font-semibold border ${colorClasses[color] ?? colorClasses.gray}`}>
        {letter}
      </span>
    );
  };
  const renderButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Sparkles className="w-3 h-3 animate-pulse" />
          <span>Cargando...</span>
        </>
      );
    }
    if (suggestion && suggestedValue != null) {
      return (
        <>
          <Sparkles className="w-3 h-3" />
          <span className="font-semibold">{getSuggestedDisplayValue(suggestedValue, suggestion.suggested_currency)}</span>
          {getConfidenceBadge()}
        </>
      );
    }
    return (
      <>
        <Sparkles className="w-3 h-3" />
        <span>Ver</span>
      </>
    );
  };

  return (
    <div className="relative flex items-center justify-end gap-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!model) {
            showError('Se requiere un modelo para obtener la sugerencia');
            return;
          }
          setShowDetails(true);
          if (!suggestion && !isLoading) fetchSuggestion();
        }}
        disabled={isLoading || !model}
        className="flex items-center gap-1.5 px-2 py-1 text-[10px] bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-200"
      >
        {renderButtonContent()}
      </button>
      <AnimatePresence>
        {showDetails && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: popoverPosition === 'top' ? -5 : 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: popoverPosition === 'top' ? -5 : 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${popoverPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} z-[10000] w-72 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col`}
            style={{
              right: 0,
              maxHeight: popoverPosition === 'top'
                ? `${Math.min(600, (buttonRef.current?.getBoundingClientRect().top ?? window.innerHeight) - 20)}px`
                : `${Math.min(600, Math.max(400, window.innerHeight - (buttonRef.current?.getBoundingClientRect().bottom ?? 0) - 20))}px`
            }}
          >
            <div className="bg-[#50504f] text-white px-3 py-2 flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-medium">Sugerencia Histórica</span>
              <button onClick={() => setShowDetails(false)} className="hover:bg-white/20 rounded p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div
              className="p-3 space-y-3 overflow-y-auto overflow-x-hidden flex-1"
              style={{
                maxHeight: 'calc(100% - 40px)',
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 #f1f5f9',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              <CompactPopoverContent
                suggestion={suggestion}
                isLoading={isLoading}
                suggestedValue={suggestedValue}
                type={type}
                onApply={onApply}
                year={year}
                hours={hours}
                hoursRange={hoursRange}
                setHoursRange={setHoursRange}
                yearsRange={yearsRange}
                setYearsRange={setYearsRange}
                setShowDetails={setShowDetails}
                fetchSuggestion={fetchSuggestion}
                getDefaultHoursRange={getDefaultHoursRange}
                getDefaultYearsRange={getDefaultYearsRange}
                getTitle={getTitle}
                getSuggestedDisplayValue={getSuggestedDisplayValue}
                getConfidenceBadgeClass={getConfidenceBadgeClass}
                formatCurrency={formatCurrency}
                formatPriceWithCurrency={formatPriceWithCurrency}
                currentRecordsLabel={currentRecordsLabel}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {type === 'auction' && (
        <Modal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          title="Configurar Rango de Búsqueda"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="price-sugg-hours-modal" className="block text-sm font-medium text-gray-700 mb-2">
                Rango de Horas (±)
              </label>
              <Input
                id="price-sugg-hours-modal"
                type="number"
                value={hoursRange.toString()}
                onChange={(e) => setHoursRange(Number.parseInt(e.target.value, 10) || 1000)}
                min="100"
                max="10000"
                step="100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Búsqueda: {hours == null ? 'N/A' : `${hours - hoursRange} a ${hours + hoursRange}`} horas
              </p>
            </div>
            <div>
              <label htmlFor="price-sugg-years-modal" className="block text-sm font-medium text-gray-700 mb-2">
                Rango de Años (±)
              </label>
              <Input
                id="price-sugg-years-modal"
                type="number"
                value={yearsRange.toString()}
                onChange={(e) => setYearsRange(Number.parseInt(e.target.value, 10) || 1)}
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-500 mt-1">
                Búsqueda: {year == null ? 'N/A' : `${year - yearsRange} a ${year + yearsRange}`}
              </p>
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setHoursRange(getDefaultHoursRange());
                  setYearsRange(getDefaultYearsRange());
                }}
                className="flex-1"
              >
                Restaurar Predeterminados
              </Button>
              <Button
                onClick={() => {
                  setShowConfigModal(false);
                  fetchSuggestion();
                }}
                className="flex-1"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

interface AutoFetchCompactSuggestionViewProps {
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  suggestion: SuggestionResponse | null;
  suggestedValue: number | null | undefined;
  type: SuggestionType;
  onApply?: (value: number) => void;
  isLoading: boolean;
  year?: number | null;
  hours?: number | null;
  hoursRange: number;
  setHoursRange: (v: number) => void;
  yearsRange: number;
  setYearsRange: (v: number) => void;
  showConfigModal: boolean;
  setShowConfigModal: (v: boolean) => void;
  fetchSuggestion: (hoursR?: number, yearsR?: number) => void;
  getDefaultHoursRange: () => number;
  getDefaultYearsRange: () => number;
  getTitle: () => string;
  getConfidenceBadgeClass: (confidence: string) => string;
  formatCurrency: (value: number | null | undefined) => string;
  formatPriceWithCurrency: (value: number | null | undefined, currencyCode: string | null | undefined) => string;
  currentRecordsLabel: string;
  buttonRef: React.RefObject<HTMLButtonElement>;
  popoverRef: React.RefObject<HTMLDivElement>;
  popoverPosition: 'top' | 'bottom';
}

interface AutoFetchCompactPopoverBodyProps {
  suggestion: SuggestionResponse | null;
  suggestedValue: number | null | undefined;
  type: SuggestionType;
  onApply?: (value: number) => void;
  isLoading: boolean;
  year?: number | null;
  hours?: number | null;
  hoursRange: number;
  yearsRange: number;
  setHoursRange: (v: number) => void;
  setYearsRange: (v: number) => void;
  setShowDetails: (v: boolean) => void;
  fetchSuggestion: (hoursR?: number, yearsR?: number) => void;
  getDefaultHoursRange: () => number;
  getDefaultYearsRange: () => number;
  getTitle: () => string;
  getConfidenceBadgeClass: (confidence: string) => string;
  formatCurrency: (value: number | null | undefined) => string;
  formatPriceWithCurrency: (value: number | null | undefined, currencyCode: string | null | undefined) => string;
  currentRecordsLabel: string;
}

function AutoFetchCompactPopoverBody(props: Readonly<AutoFetchCompactPopoverBodyProps>): React.ReactElement {
  const {
    suggestion,
    suggestedValue,
    type,
    onApply,
    isLoading,
    year,
    hours,
    hoursRange,
    yearsRange,
    setHoursRange,
    setYearsRange,
    setShowDetails,
    fetchSuggestion,
    getDefaultHoursRange,
    getDefaultYearsRange,
    getTitle,
    getConfidenceBadgeClass,
    formatCurrency,
  formatPriceWithCurrency,
  currentRecordsLabel
  } = props;
  const hasData = Boolean(suggestion && suggestion.confidence !== 'SIN_DATOS' && suggestedValue != null);
  const hasHighlightedRecords = suggestion != null &&
    ((suggestion.sample_records?.historical?.length ?? 0) > 0 || (suggestion.sample_records?.current?.length ?? 0) > 0);
  const canApply = onApply != null && suggestion != null && suggestedValue != null && suggestion.confidence !== 'SIN_DATOS';

  return (
    <div
      className="p-3 space-y-3 overflow-y-auto overflow-x-hidden flex-1"
      style={{
        maxHeight: 'calc(100% - 40px)',
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 #f1f5f9',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {isLoading && (
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2 text-xs text-gray-500">
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-[#cf1b22] border-t-transparent" />
            <span>Actualizando sugerencia...</span>
          </div>
        </div>
      )}
      {hasData && suggestion != null ? (
        <>
          <div className="text-center pb-2 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{getTitle()}</p>
            <p className="text-xl font-bold text-[#cf1b22]">
              {type === 'auction' ? formatPriceWithCurrency(suggestedValue, suggestion.suggested_currency) : formatCurrency(suggestedValue)}
            </p>
            <div className={`inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded ${getConfidenceBadgeClass(suggestion.confidence)}`}>
              Confianza: {suggestion.confidence}
            </div>
          </div>
          {suggestion.price_range && (suggestion.price_range.min || suggestion.price_range.max) && (
            <div className="text-xs">
              <p className="text-gray-500 mb-1">Rango de precios:</p>
              <div className="flex justify-between text-[#50504f] font-medium">
                <span>Min: {formatCurrency(suggestion.price_range.min)}</span>
                <span>Max: {formatCurrency(suggestion.price_range.max)}</span>
              </div>
            </div>
          )}
          <div className="text-xs flex items-center gap-2 text-gray-500">
            <Database className="w-3 h-3" />
            <span>{suggestion.sources?.total ?? 0} registros similares</span>
          </div>
        </>
      ) : (
        <div className="text-center py-4 pb-2 border-b border-gray-100">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-gray-700 mb-1">No se encontraron datos históricos</p>
          <p className="text-[10px] text-gray-500">Ajusta los rangos de búsqueda abajo para encontrar resultados</p>
          {suggestion?.message != null && (
            <p className="text-[10px] text-gray-400 mt-1 italic">{suggestion.message}</p>
          )}
        </div>
      )}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-700 mb-2">Configurar Rango de Búsqueda</p>
        <div className="space-y-2">
          <div>
            <label htmlFor="price-sugg-hours-range-pop2" className="block text-[10px] text-gray-600 mb-1">Rango de Horas (±)</label>
            <input
              id="price-sugg-hours-range-pop2"
              type="range"
              min="100"
              max="10000"
              step="100"
              value={hoursRange}
              onChange={(e) => {
                const newRange = Number.parseInt(e.target.value, 10);
                setHoursRange(newRange);
                setTimeout(() => fetchSuggestion(newRange, yearsRange), 300);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>100</span>
              <span className="font-semibold text-[#50504f]">{hoursRange.toLocaleString('es-CO')} hrs</span>
              <span>10,000</span>
            </div>
            {hours != null && (
              <p className="text-[9px] text-gray-400 mt-1">Búsqueda: {(hours - hoursRange).toLocaleString('es-CO')} a {(hours + hoursRange).toLocaleString('es-CO')} hrs</p>
            )}
          </div>
          <div>
            <label htmlFor="price-sugg-years-range-pop2" className="block text-[10px] text-gray-600 mb-1">Rango de Años (±)</label>
            <input
              id="price-sugg-years-range-pop2"
              type="range"
              min="1"
              max="10"
              step="1"
              value={yearsRange}
              onChange={(e) => {
                const newRange = Number.parseInt(e.target.value, 10);
                setYearsRange(newRange);
                setTimeout(() => fetchSuggestion(hoursRange, newRange), 300);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>1</span>
              <span className="font-semibold text-[#50504f]">{yearsRange} año{yearsRange === 1 ? '' : 's'}</span>
              <span>10</span>
            </div>
            {year != null && (
              <p className="text-[9px] text-gray-400 mt-1">Búsqueda: {year - yearsRange} a {year + yearsRange}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setHoursRange(getDefaultHoursRange());
              setYearsRange(getDefaultYearsRange());
              setTimeout(() => fetchSuggestion(getDefaultHoursRange(), getDefaultYearsRange()), 300);
            }}
            className="w-full text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            Restaurar Predeterminados
          </button>
        </div>
      </div>
      {hasHighlightedRecords && suggestion != null && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-2">Históricos Destacados</p>
          <p className="text-[10px] text-gray-500 mb-2">
            Rango activo: {getActiveRangeSummary(year, hours, yearsRange, hoursRange)}
          </p>
          <div className="space-y-1.5">
            {(suggestion.sample_records?.historical ?? []).length > 0 && (
              <p className="text-[10px] text-gray-500 font-medium">Importado</p>
            )}
            {(suggestion.sample_records?.historical ?? []).slice(0, 5).map((record, idx) => (
              <div key={`afc-hist-${record.model ?? ''}-${record.year ?? ''}-${idx}`} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  {record.year != null && <span className="font-medium text-gray-700">{record.year}</span>}
                  {record.year != null && record.hours != null && <span className="text-gray-400">•</span>}
                  {record.hours != null && <span className="text-gray-500">{record.hours.toLocaleString('es-CO')} hrs</span>}
                </div>
                <span className="text-xs font-bold text-[#cf1b22]">
                  {type === 'auction' ? formatPriceWithCurrency(record.price ?? record.pvp ?? record.rptos ?? record.suggested_price, record.currency) : formatCurrency(record.price ?? record.pvp ?? record.rptos ?? record.suggested_price)}
                </span>
              </div>
            ))}
            {(suggestion.sample_records?.current ?? []).length > 0 && (
              <p className="text-[10px] text-gray-500 font-medium pt-0.5">{currentRecordsLabel}</p>
            )}
            {(suggestion.sample_records?.current ?? []).slice(0, 3).map((record, idx) => (
              <div key={`afc-curr-${record.model ?? ''}-${record.year ?? ''}-${idx}`} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  {record.year != null && <span className="font-medium text-gray-700">{record.year}</span>}
                  {record.year != null && record.hours != null && <span className="text-gray-400">•</span>}
                  {record.hours != null && <span className="text-gray-500">{record.hours.toLocaleString('es-CO')} hrs</span>}
                </div>
                <span className="text-xs font-bold text-[#cf1b22]">
                  {type === 'auction' ? formatPriceWithCurrency(record.price ?? record.pvp ?? record.rptos, record.currency) : formatCurrency(record.price ?? record.pvp ?? record.rptos)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {canApply && onApply != null && suggestedValue != null && (
        <div className="pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              onApply(suggestedValue);
              setShowDetails(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#cf1b22] text-white text-xs font-medium rounded hover:bg-[#a81820] transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" />
            Aplicar valor
          </button>
        </div>
      )}
    </div>
  );
}

function AutoFetchCompactSuggestionView(p: Readonly<AutoFetchCompactSuggestionViewProps>): React.ReactElement {
  const {
    showDetails,
    setShowDetails,
    suggestion,
    suggestedValue,
    type,
    onApply,
    isLoading,
    year,
    hours,
    hoursRange,
    setHoursRange,
    yearsRange,
    setYearsRange,
    showConfigModal,
    setShowConfigModal,
    fetchSuggestion,
    getDefaultHoursRange,
    getDefaultYearsRange,
    getTitle,
    getConfidenceBadgeClass,
    formatCurrency,
    formatPriceWithCurrency,
    currentRecordsLabel,
    buttonRef,
    popoverRef,
    popoverPosition
  } = p;
  const hasSuggestionValue = suggestion != null && suggestedValue != null;
  const showConfidenceBadge = suggestion?.confidence != null && suggestion.confidence !== 'SIN_DATOS';

  return (
    <div className="relative flex items-center justify-end gap-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowDetails(!showDetails);
        }}
        className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-[#50504f] rounded transition-colors border border-gray-200"
        title="Ver detalles de sugerencia"
      >
        <Sparkles className="w-3 h-3" />
        {hasSuggestionValue ? (
          <>
            <span className="font-medium">{formatCurrency(suggestedValue)}</span>
            {showConfidenceBadge && (
              <span className={`text-[10px] px-1 rounded ${getConfidenceBadgeClass(suggestion.confidence)}`}>{suggestion.confidence.charAt(0)}</span>
            )}
          </>
        ) : (
          <span className="font-medium">Ver sugerencia</span>
        )}
      </button>
      {type === 'auction' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfigModal(true);
          }}
          className="flex items-center justify-center w-6 h-6 text-xs bg-gray-100 hover:bg-gray-200 text-[#50504f] rounded transition-colors border border-gray-200"
          title="Configurar rango de búsqueda"
        >
          <Settings className="w-3 h-3" />
        </button>
      )}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: popoverPosition === 'top' ? -5 : 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: popoverPosition === 'top' ? -5 : 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${popoverPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} right-0 z-[9999] w-72 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col`}
            style={{
              maxHeight: popoverPosition === 'top'
                ? `${Math.min(600, (buttonRef.current?.getBoundingClientRect().top ?? window.innerHeight) - 20)}px`
                : `${Math.min(600, window.innerHeight - (buttonRef.current?.getBoundingClientRect().bottom ?? 0) - 20)}px`
            }}
          >
            <div className="bg-[#50504f] text-white px-3 py-2 flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-medium">Sugerencia Histórica</span>
              <button onClick={() => setShowDetails(false)} className="hover:bg-white/20 rounded p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
            <AutoFetchCompactPopoverBody
              suggestion={suggestion}
              suggestedValue={suggestedValue}
              type={type}
              onApply={onApply}
              isLoading={isLoading}
              year={year}
              hours={hours}
              hoursRange={hoursRange}
              setHoursRange={setHoursRange}
              yearsRange={yearsRange}
              setYearsRange={setYearsRange}
              setShowDetails={setShowDetails}
              fetchSuggestion={fetchSuggestion}
              getDefaultHoursRange={getDefaultHoursRange}
              getDefaultYearsRange={getDefaultYearsRange}
              getTitle={getTitle}
              getConfidenceBadgeClass={getConfidenceBadgeClass}
              formatCurrency={formatCurrency}
              formatPriceWithCurrency={formatPriceWithCurrency}
              currentRecordsLabel={currentRecordsLabel}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {type === 'auction' && (
        <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Configurar Rango de Búsqueda">
          <div className="space-y-4">
            <div>
              <label htmlFor="price-sugg-hours-config" className="block text-sm font-medium text-gray-700 mb-2">Rango de Horas (±)</label>
              <Input
                id="price-sugg-hours-config"
                type="number"
                value={hoursRange.toString()}
                onChange={(e) => setHoursRange(Number.parseInt(e.target.value, 10) || 1000)}
                min="100"
                max="10000"
                step="100"
              />
              <p className="text-xs text-gray-500 mt-1">Búsqueda: {hours == null ? 'N/A' : `${hours - hoursRange} a ${hours + hoursRange}`} horas</p>
            </div>
            <div>
              <label htmlFor="price-sugg-years-config" className="block text-sm font-medium text-gray-700 mb-2">Rango de Años (±)</label>
              <Input
                id="price-sugg-years-config"
                type="number"
                value={yearsRange.toString()}
                onChange={(e) => setYearsRange(Number.parseInt(e.target.value, 10) || 1)}
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-500 mt-1">Búsqueda: {year == null ? 'N/A' : `${year - yearsRange} a ${year + yearsRange}`}</p>
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => { setHoursRange(getDefaultHoursRange()); setYearsRange(getDefaultYearsRange()); }} className="flex-1">Restaurar Predeterminados</Button>
              <Button onClick={() => { setShowConfigModal(false); fetchSuggestion(); }} className="flex-1">Aplicar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

interface AutoFetchFullSuggestionViewProps {
  suggestion: SuggestionResponse | null;
  suggestedValue: number | null | undefined;
  type: SuggestionType;
  onApply?: (value: number) => void;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  showConfigModal: boolean;
  setShowConfigModal: (v: boolean) => void;
  hoursRange: number;
  setHoursRange: (v: number) => void;
  yearsRange: number;
  setYearsRange: (v: number) => void;
  year?: number | null;
  hours?: number | null;
  fetchSuggestion: (hoursR?: number, yearsR?: number) => void;
  formatCurrency: (value: number | null | undefined) => string;
  formatPriceWithCurrency: (value: number | null | undefined, currencyCode: string | null | undefined) => string;
  getConfidenceBadgeClass: (confidence: string) => string;
  getConfidenceStars: () => number;
  getTitle: () => string;
}

function AutoFetchFullSuggestionView(props: Readonly<AutoFetchFullSuggestionViewProps>): React.ReactElement {
  const {
    suggestion,
    suggestedValue,
    type,
    onApply,
    showDetails,
    setShowDetails,
    showConfigModal,
    setShowConfigModal,
    hoursRange,
    setHoursRange,
    yearsRange,
    setYearsRange,
    year,
    hours,
    fetchSuggestion,
    formatCurrency,
    formatPriceWithCurrency,
    getConfidenceBadgeClass,
    getConfidenceStars,
    getTitle
  } = props;
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
      <Sparkles className="w-4 h-4 text-[#cf1b22]" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#50504f]">{formatCurrency(suggestedValue ?? null)}</span>
          {suggestion != null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getConfidenceBadgeClass(suggestion.confidence)}`}>{suggestion.confidence}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>{suggestion?.sources?.total ?? 0} registros</span>
          <button type="button" onClick={() => setShowDetails(true)} className="text-[#cf1b22] hover:underline">Detalles</button>
        </div>
      </div>
      {onApply != null && suggestedValue != null && (
        <button
          type="button"
          onClick={() => onApply(suggestedValue)}
          className="px-3 py-1.5 text-xs bg-[#cf1b22] text-white rounded hover:bg-[#a81820] transition-colors"
        >
          Aplicar
        </button>
      )}
      <AnimatePresence>
        {showDetails && suggestion != null && (
          <SuggestionModal
            suggestion={suggestion}
            type={type}
            suggestedValue={suggestedValue ?? null}
            onClose={() => setShowDetails(false)}
            onApply={onApply}
            formatCurrency={formatCurrency}
            formatPriceWithCurrency={formatPriceWithCurrency}
            getConfidenceStars={getConfidenceStars}
            getTitle={getTitle}
          />
        )}
      </AnimatePresence>
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Configurar Rango de Búsqueda">
        <div className="space-y-4">
          <div>
            <label htmlFor="price-sugg-hours-config2" className="block text-sm font-medium text-gray-700 mb-2">Rango de Horas (±)</label>
            <Input
              id="price-sugg-hours-config2"
              type="number"
              value={hoursRange.toString()}
              onChange={(e) => setHoursRange(Number.parseInt(e.target.value, 10) || 1000)}
              min="100"
              max="10000"
              step="100"
            />
            <p className="text-xs text-gray-500 mt-1">Búsqueda: {hours == null ? 'N/A' : `${hours - hoursRange} a ${hours + hoursRange}`} horas</p>
          </div>
          <div>
            <label htmlFor="price-sugg-years-config2" className="block text-sm font-medium text-gray-700 mb-2">Rango de Años (±)</label>
            <Input
              id="price-sugg-years-config2"
              type="number"
              value={yearsRange.toString()}
              onChange={(e) => setYearsRange(Number.parseInt(e.target.value, 10) || 1)}
              min="1"
              max="10"
            />
            <p className="text-xs text-gray-500 mt-1">Búsqueda: {year == null ? 'N/A' : `${year - yearsRange} a ${year + yearsRange}`}</p>
          </div>
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setHoursRange(1000); setYearsRange(1); }} className="flex-1">Restaurar Predeterminados</Button>
            <Button onClick={() => { setShowConfigModal(false); fetchSuggestion(); }} className="flex-1">Aplicar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export const PriceSuggestion: React.FC<PriceSuggestionProps> = ({
  type,
  model,
  year,
  hours,
  costoArancel,
  exactModelOnly = false,
  onApply,
  autoFetch = false,
  compact = false,
  forcePopoverPosition,
  onPopoverToggle,
  currentRecordsLabel = 'Subastas ganadas (app)'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  // Valores predeterminados: 1000 horas arriba/abajo y 1 año arriba/abajo
  const getDefaultHoursRange = () => 1000;
  const getDefaultYearsRange = () => 1;
  const [hoursRange, setHoursRange] = useState(getDefaultHoursRange());
  const [yearsRange, setYearsRange] = useState(getDefaultYearsRange());
  const normalizedYear = toFiniteNumber(year);
  const normalizedHours = toFiniteNumber(hours);
  
  // Hooks para modo compacto (deben estar fuera de condicionales según reglas de React)
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = React.useState<'top' | 'bottom'>('top');

  // Calcular posición del popover (solo cuando es compacto y está abierto)
  React.useEffect(() => {
    if (compact && showDetails && buttonRef.current) {
      // Si se fuerza la posición, usarla directamente (tiene prioridad sobre el cálculo automático)
      if (forcePopoverPosition) {
        setPopoverPosition(forcePopoverPosition);
        return;
      }

      const button = buttonRef.current;
      const rect = button.getBoundingClientRect();
      const popoverHeight = 500; // Altura aproximada del popover (aumentada para incluir registros históricos)
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Si hay más espacio abajo que arriba, o si el espacio arriba es menor que la altura del popover + margen
      if (spaceBelow > spaceAbove || spaceAbove < popoverHeight + 10) {
        setPopoverPosition('bottom');
      } else {
        setPopoverPosition('top');
      }
    }
  }, [compact, showDetails, forcePopoverPosition]);

  // Calcular posición del popover para modo !autoFetch (PreselectionPage)
  React.useEffect(() => {
    if (!autoFetch && compact && showDetails && buttonRef.current) {
      // Si se fuerza la posición, usarla directamente
      if (forcePopoverPosition) {
        setPopoverPosition(forcePopoverPosition);
        return;
      }

      const button = buttonRef.current;
      const rect = button.getBoundingClientRect();
      const popoverHeight = 500;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Si no hay suficiente espacio abajo, mostrar arriba
      if (spaceBelow < popoverHeight + 20) {
        setPopoverPosition('top');
      } else {
        setPopoverPosition('bottom');
      }
    }
  }, [autoFetch, compact, showDetails, forcePopoverPosition]);

  // Notificar al padre cuando el popover se abre/cierra (evitar loops reportando el mismo valor)
  const lastReportedShowDetails = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    if (!onPopoverToggle || !compact) return;
    if (lastReportedShowDetails.current === showDetails) return;
    lastReportedShowDetails.current = showDetails;
    onPopoverToggle(showDetails);
  }, [showDetails, compact, onPopoverToggle]);

  // Cerrar popover al hacer clic fuera (solo en modo compacto)
  React.useEffect(() => {
    if (!compact || !showDetails) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        popoverRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setShowDetails(false);
      }
    };

    // Agregar listener después de un pequeño delay para evitar que se cierre inmediatamente
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [compact, showDetails]);

  const fetchSuggestion = async (customHoursRange?: number, customYearsRange?: number) => {
    if (!model) {
      return;
    }

    setIsLoading(true);
    try {
      let endpoint = '';
      const rangeHours = customHoursRange ?? hoursRange;
      const rangeYears = customYearsRange ?? yearsRange;

      const validYear = (normalizedYear != null && normalizedYear !== 9999 && normalizedYear > 1900 && normalizedYear < 2100) ? normalizedYear : null;
      const validHours = (normalizedHours != null && normalizedHours > 0) ? normalizedHours : null;

      type Payload = Record<string, unknown> & { model: string; year: number | null; hours: number | null };
      const payload: Payload = { model, year: validYear, hours: validHours };

      if (type === 'auction') {
        endpoint = '/api/price-suggestions/auction';
        payload.hours_range = rangeHours;
        payload.years_range = rangeYears;
        payload.exact_model_only = exactModelOnly;
      } else if (type === 'pvp') {
        endpoint = '/api/price-suggestions/pvp';
        payload.costo_arancel = costoArancel;
        payload.hours_range = rangeHours;
        payload.years_range = rangeYears;
      } else if (type === 'repuestos') {
        endpoint = '/api/price-suggestions/repuestos';
        payload.hours_range = rangeHours;
        payload.years_range = rangeYears;
      }

      const response = await apiPost<Record<string, unknown>>(endpoint, payload);
      setSuggestion({
        ...(response && typeof response === 'object' ? response : {}),
        model,
        year: normalizedYear ?? undefined,
        hours: normalizedHours ?? undefined
      } as SuggestionResponse);
      // Si el popover está abierto, mantenerlo abierto incluso si no hay datos
      // Esto permite que el usuario siga ajustando los rangos
      // No cerrar automáticamente el popover
    } catch (error) {
      console.error('Error obteniendo sugerencia:', error);
      showError('Error al obtener sugerencia de precio');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch && model) {
      fetchSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, normalizedYear, normalizedHours, autoFetch]);

  // Invalidar sugerencia cuando cambian los parámetros (incluso si autoFetch es false)
  // Esto asegura que cuando el usuario abre el popover, busque con los valores actualizados
  useEffect(() => {
    if (!autoFetch && showDetails && model) {
      // Si el popover está abierto y cambian los parámetros, buscar nuevamente
      fetchSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, normalizedYear, normalizedHours, showDetails]);

  const getSuggestedValue = () => {
    if (!suggestion) return null;
    if (type === 'auction') return suggestion.suggested_price;
    if (type === 'pvp') return suggestion.suggested_pvp;
    if (type === 'repuestos') return normalizeSuggestedRepuestosValue(suggestion.suggested_rptos);
    return null;
  };

  const suggestedValue = getSuggestedValue();

  const getConfidenceStars = () => {
    if (!suggestion) return 0;
    if (suggestion.confidence === 'ALTA') return 5;
    if (suggestion.confidence === 'MEDIA') return 3;
    if (suggestion.confidence === 'BAJA') return 2;
    return 0;
  };

  const getConfidenceBadgeClass = (confidence: string) => {
    if (confidence === 'ALTA') return 'bg-green-100 text-green-700';
    if (confidence === 'MEDIA') return 'bg-yellow-100 text-yellow-700';
    if (confidence === 'BAJA') return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-700';
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return '$ ' + new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPriceWithCurrency = (value: number | null | undefined, currencyCode: string | null | undefined) => {
    if (!value) return '-';
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
    if (currencyCode) {
      return `${currencyCode} $ ${formatted}`;
    }
    return `$ ${formatted}`;
  };

  const getSuggestedDisplayValue = (val: number | null | undefined, currency?: string | null) => {
    if (type === 'auction') return formatPriceWithCurrency(val, currency);
    return formatCurrency(val);
  };

  const getTitle = () => {
    if (type === 'auction') return 'Precio Máximo Sugerido';
    if (type === 'pvp') return 'PVP Estimado Sugerido';
    if (type === 'repuestos') return 'Repuestos Sugerido';
    return 'Sugerencia';
  };

  if (!autoFetch) {
    if (compact) {
      return (
        <CompactSuggestionView
          model={model}
          suggestion={suggestion}
          isLoading={isLoading}
          suggestedValue={suggestedValue}
          type={type}
          onApply={onApply}
          year={normalizedYear}
          hours={normalizedHours}
          showDetails={showDetails}
          setShowDetails={setShowDetails}
          fetchSuggestion={fetchSuggestion}
          hoursRange={hoursRange}
          setHoursRange={setHoursRange}
          yearsRange={yearsRange}
          setYearsRange={setYearsRange}
          showConfigModal={showConfigModal}
          setShowConfigModal={setShowConfigModal}
          getDefaultHoursRange={getDefaultHoursRange}
          getDefaultYearsRange={getDefaultYearsRange}
          getTitle={getTitle}
          getSuggestedDisplayValue={getSuggestedDisplayValue}
          getConfidenceBadgeClass={getConfidenceBadgeClass}
          formatCurrency={formatCurrency}
          formatPriceWithCurrency={formatPriceWithCurrency}
          currentRecordsLabel={currentRecordsLabel}
          buttonRef={buttonRef}
          popoverRef={popoverRef}
          popoverPosition={popoverPosition}
        />
      );
    }

    return (
      <ManualSuggestionView
        isLoading={isLoading}
        model={model}
        showDetails={showDetails}
        suggestion={suggestion}
        suggestedValue={suggestedValue}
        type={type}
        onApply={onApply}
        setShowDetails={setShowDetails}
        fetchSuggestion={fetchSuggestion}
        formatCurrency={formatCurrency}
        formatPriceWithCurrency={formatPriceWithCurrency}
        getConfidenceStars={getConfidenceStars}
        getTitle={getTitle}
      />
    );
  }

  // Modo auto-fetch: Muestra inline
  if (isLoading) return <LoadingSuggestionView compact={compact} />;

  // En modo compacto con autoFetch no mostramos "Sin datos"; en otros modos sí si no hay sugerencia o es SIN_DATOS
  const showSinDatos = (!compact || !autoFetch) && (!suggestion || suggestion.confidence === 'SIN_DATOS');
  if (showSinDatos) return <SinDatosSuggestionView />;

  // Modo compacto para celdas de tabla (autoFetch)
  if (compact) {
    return (
      <AutoFetchCompactSuggestionView
        showDetails={showDetails}
        setShowDetails={setShowDetails}
        suggestion={suggestion}
        suggestedValue={suggestedValue}
        type={type}
        onApply={onApply}
        isLoading={isLoading}
        year={normalizedYear}
        hours={normalizedHours}
        hoursRange={hoursRange}
        setHoursRange={setHoursRange}
        yearsRange={yearsRange}
        setYearsRange={setYearsRange}
        showConfigModal={showConfigModal}
        setShowConfigModal={setShowConfigModal}
        fetchSuggestion={fetchSuggestion}
        getDefaultHoursRange={getDefaultHoursRange}
        getDefaultYearsRange={getDefaultYearsRange}
        getTitle={getTitle}
        getConfidenceBadgeClass={getConfidenceBadgeClass}
        formatCurrency={formatCurrency}
        formatPriceWithCurrency={formatPriceWithCurrency}
        currentRecordsLabel={currentRecordsLabel}
        buttonRef={buttonRef}
        popoverRef={popoverRef}
        popoverPosition={popoverPosition}
      />
    );
  }

  return (
    <AutoFetchFullSuggestionView
      suggestion={suggestion}
      suggestedValue={suggestedValue}
      type={type}
      onApply={onApply}
      showDetails={showDetails}
      setShowDetails={setShowDetails}
      showConfigModal={showConfigModal}
      setShowConfigModal={setShowConfigModal}
      hoursRange={hoursRange}
      setHoursRange={setHoursRange}
      yearsRange={yearsRange}
      setYearsRange={setYearsRange}
      year={normalizedYear}
      hours={normalizedHours}
      fetchSuggestion={fetchSuggestion}
      formatCurrency={formatCurrency}
      formatPriceWithCurrency={formatPriceWithCurrency}
      getConfidenceBadgeClass={getConfidenceBadgeClass}
      getConfidenceStars={getConfidenceStars}
      getTitle={getTitle}
    />
  );
};

// Modal de detalles
const SuggestionModal: React.FC<{
  suggestion: SuggestionResponse;
  type: SuggestionType;
  suggestedValue: number | null;
  onClose: () => void;
  onApply?: (value: number) => void;
  formatCurrency: (value: number | null | undefined) => string;
  formatPriceWithCurrency: (value: number | null | undefined, currencyCode: string | null | undefined) => string;
  getConfidenceStars: () => number;
  getTitle: () => string;
}> = ({
  suggestion,
  type,
  suggestedValue,
  onClose,
  onApply,
  formatCurrency,
  formatPriceWithCurrency,
  getConfidenceStars,
  getTitle
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#50504f] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium text-sm">{getTitle()}</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Caso sin datos */}
          {suggestion.confidence === 'SIN_DATOS' || (suggestedValue == null && !['ALTA', 'MEDIA', 'BAJA'].includes(suggestion.confidence)) ? (
            <div className="text-center py-6">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700 mb-2">No se encontraron datos históricos</p>
              <p className="text-xs text-gray-500 mb-1">{suggestion.message || 'No hay registros similares en las bases de datos para este modelo, año y horas.'}</p>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Parámetros de búsqueda:</p>
                <p className="text-xs text-gray-500">Modelo: {suggestion.model || 'N/A'}</p>
                <p className="text-xs text-gray-500">Año: {suggestion.year || 'N/A'}</p>
                <p className="text-xs text-gray-500">Horas: {suggestion.hours || 'N/A'}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Valor Sugerido */}
              <div className="text-center py-3 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Valor Sugerido</p>
                <p className="text-2xl font-bold text-[#cf1b22]">
                  {type === 'auction' ? formatPriceWithCurrency(suggestedValue, suggestion.suggested_currency) : formatCurrency(suggestedValue)}
                </p>
                {type === 'pvp' && suggestion.suggested_margin && (
                  <p className="text-xs text-green-600 mt-1">Margen: {suggestion.suggested_margin}%</p>
                )}
              </div>

              {/* Confianza y Registros */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Confianza</p>
                  <p className={`text-sm font-semibold ${getConfidenceTextClass(suggestion.confidence)}`}>{suggestion.confidence || 'N/A'}</p>
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: 5 }, (_, i) => i).map((starIndex) => (
                      <div key={`star-${starIndex}`} className={`w-2 h-2 rounded-full ${starIndex < getConfidenceStars() ? 'bg-[#cf1b22]' : 'bg-gray-300'}`} />
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Registros</p>
                  <p className="text-sm font-semibold text-[#50504f]">{suggestion.sources?.total || 0}</p>
                  <p className="text-[10px] text-gray-400">{suggestion.sources?.historical || 0} hist. + {suggestion.sources?.current || 0} act.</p>
                </div>
              </div>

              {/* Rango de Precios */}
              {suggestion.price_range?.min && suggestion.price_range?.max && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">Rango de Precios</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#50504f]">Min: <strong>{formatCurrency(suggestion.price_range.min)}</strong></span>
                    <span className="text-[#50504f]">Max: <strong>{formatCurrency(suggestion.price_range.max)}</strong></span>
                  </div>
                </div>
              )}

              {/* Registros de Muestra */}
              {suggestion.sample_records && (
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {suggestion.sample_records.historical && suggestion.sample_records.historical.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Históricos ({suggestion.sources?.historical || 0})</p>
                      <div className="space-y-1">
                        {suggestion.sample_records.historical.slice(0, 3).map((record, idx) => (
                          <div key={`modal-hist-${record.model ?? ''}-${record.year ?? ''}-${idx}`} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-xs">
                            <span className="text-gray-600">{record.model} • {record.year}</span>
                            <span className="font-semibold text-[#50504f]">
                              {type === 'auction' ? formatPriceWithCurrency(record.price ?? record.pvp ?? record.rptos, record.currency) : formatCurrency(record.price || record.pvp || record.rptos)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggestion.sample_records.current && suggestion.sample_records.current.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Actuales ({suggestion.sources?.current || 0})</p>
                      <div className="space-y-1">
{suggestion.sample_records.current.slice(0, 3).map((record, idx) => (
                            <div key={`modal-curr-${record.model ?? ''}-${record.year ?? ''}-${idx}`} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-xs">
                            <span className="text-gray-600">{record.model} • {record.year}</span>
                            <span className="font-semibold text-[#50504f]">
                              {type === 'auction' ? formatPriceWithCurrency(record.price ?? record.pvp ?? record.rptos, record.currency) : formatCurrency(record.price ?? record.pvp ?? record.rptos)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors"
          >
            Cerrar
          </button>
          {onApply && suggestedValue && suggestion.confidence !== 'SIN_DATOS' && (
            <button
              onClick={() => {
                if (suggestedValue) {
                  onApply(suggestedValue);
                  onClose();
                }
              }}
              className="px-4 py-2 text-sm bg-[#cf1b22] text-white rounded hover:bg-[#a81820] transition-colors"
            >
              Aplicar
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

