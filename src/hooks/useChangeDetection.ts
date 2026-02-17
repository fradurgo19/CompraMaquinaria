/**
 * Hook para detectar cambios en formularios
 * Compara valores originales vs nuevos y retorna diferencias.
 * Para campos monetarios (currencyFields) se compara solo el valor numérico,
 * de modo que un cambio de formato (ej. "5.000.000" vs "¥5.000.000,00") no cuenta como cambio.
 */

import { useState, useEffect, useMemo } from 'react';

type ChangeValue = string | number | null;

interface ChangeItem {
  field_name: string;
  field_label: string;
  old_value: ChangeValue;
  new_value: ChangeValue;
}

interface FieldMapping {
  [key: string]: string; // field_name -> field_label
}

export interface UseChangeDetectionOptions {
  /** Campos que almacenan valores monetarios; se comparan por valor numérico, no por string formateado */
  currencyFields?: string[];
}

const DEFAULT_VALUES_AS_NULL = new Set(['No', 'N/A', 'n/a', 'no']);
const FIELDS_WITH_DEFAULTS_AS_NULL = new Set(['wet_line', 'arm_type', 'engine_brand', 'cabin_type']);

/** Parsea un valor a número ignorando símbolo de moneda y formato de miles/decimales (es-CO o US). */
function parseCurrencyToNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isNaN(val) ? null : val;
  let s = String(val).replaceAll(/[^\d.,-]/g, '').trim();
  if (s === '') return null;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replaceAll('.', '').replace(',', '.');
  } else if (lastDot > lastComma) {
    s = s.replaceAll(',', '');
  } else {
    s = s.replaceAll(/[.,]/g, '');
  }
  const n = Number(neg ? '-' + s : s);
  return Number.isNaN(n) ? null : n;
}

function isDateField(fieldName: string): boolean {
  return fieldName.includes('date') || fieldName.includes('Date');
}

function isEmptyComparableValue(val: unknown): boolean {
  return val === null || val === undefined || val === '';
}

function normalizeCurrencyComparableValue(val: unknown): number | null {
  const valForParse = typeof val === 'number' || typeof val === 'string' ? val : String(val);
  return parseCurrencyToNumber(valForParse);
}

function shouldNormalizeDefaultToNull(fieldName: string, val: string): boolean {
  return DEFAULT_VALUES_AS_NULL.has(val.trim()) && FIELDS_WITH_DEFAULTS_AS_NULL.has(fieldName);
}

function normalizeDateString(val: string): string | null {
  const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(val);
  return dateMatch ? dateMatch[1] : null;
}

function parseNumericString(val: string): number | null {
  const parsed = Number.parseFloat(val);
  if (Number.isNaN(parsed)) return null;
  return parsed === 0 ? 0 : parsed;
}

function normalizeStringComparableValue(val: string, fieldName: string): ChangeValue {
  if (shouldNormalizeDefaultToNull(fieldName, val)) return null;
  if (isDateField(fieldName)) return normalizeDateString(val);
  const parsedNumber = parseNumericString(val);
  if (parsedNumber !== null) return parsedNumber;
  return val.trim();
}

function normalizeValueForComparison(
  val: unknown,
  fieldName: string,
  isCurrencyField: boolean
): ChangeValue {
  if (isEmptyComparableValue(val)) return null;
  if (isCurrencyField) return normalizeCurrencyComparableValue(val);
  if (typeof val === 'string') return normalizeStringComparableValue(val, fieldName);
  if (isDateField(fieldName)) return null;
  if (typeof val === 'number') return val;
  return String(val);
}

function hasSignificantDifference(
  oldValue: ChangeValue,
  newValue: ChangeValue,
  isCurrencyField: boolean
): boolean {
  if (oldValue === newValue) return false;
  if (isCurrencyField && typeof oldValue === 'number' && typeof newValue === 'number') {
    return oldValue !== newValue;
  }
  if (typeof oldValue === 'string' && typeof newValue === 'string') {
    return oldValue.toLowerCase() !== newValue.toLowerCase();
  }
  return true;
}

function computeDetectedChanges(
  originalData: Record<string, unknown>,
  currentData: Record<string, unknown>,
  stableFieldMappings: FieldMapping,
  currencyFieldsSet: Set<string>
): ChangeItem[] {
  const changes: ChangeItem[] = [];

  Object.keys(stableFieldMappings).forEach((fieldName) => {
    const oldValue = originalData[fieldName];
    const newValue = currentData[fieldName];
    const isCurrencyField = currencyFieldsSet.has(fieldName);

    const normalizedOld = normalizeValueForComparison(oldValue, fieldName, isCurrencyField);
    const normalizedNew = normalizeValueForComparison(newValue, fieldName, isCurrencyField);

    if (!hasSignificantDifference(normalizedOld, normalizedNew, isCurrencyField)) return;

    changes.push({
      field_name: fieldName,
      field_label: stableFieldMappings[fieldName],
      old_value: normalizedOld,
      new_value: normalizedNew
    });
  });

  return changes;
}

export const useChangeDetection = (
  originalData: Record<string, unknown> | null | undefined,
  currentData: Record<string, unknown> | null | undefined,
  fieldMappings: FieldMapping,
  options?: UseChangeDetectionOptions
) => {
  const [detectedChanges, setDetectedChanges] = useState<ChangeItem[]>([]);
  const currencyFieldsSet = useMemo(
    () => new Set(options?.currencyFields ?? []),
    [options?.currencyFields]
  );

  const fieldMappingsKey = useMemo(() => JSON.stringify(fieldMappings), [fieldMappings]);
  const stableFieldMappings = useMemo(
    // Solo recalcular cuando cambie el contenido real del mapping.
    () => JSON.parse(fieldMappingsKey) as FieldMapping,
    [fieldMappingsKey]
  );

  useEffect(() => {
    if (!originalData || !currentData) {
      setDetectedChanges([]);
      return;
    }

    const changes = computeDetectedChanges(
      originalData,
      currentData,
      stableFieldMappings,
      currencyFieldsSet
    );
    setDetectedChanges(changes);
    
    // Log final solo si hay cambios (comentado para evitar spam en consola)
    // if (changes.length > 0) {
    //   console.log(`📝 ${changes.length} cambio(s) real(es) detectado(s):`, 
    //     changes.map(c => `${c.field_label}: ${c.old_value} → ${c.new_value}`)
    //   );
    // }
  }, [originalData, currentData, stableFieldMappings, currencyFieldsSet]);

  return {
    hasChanges: detectedChanges.length > 0,
    changes: detectedChanges,
    changeCount: detectedChanges.length
  };
};

