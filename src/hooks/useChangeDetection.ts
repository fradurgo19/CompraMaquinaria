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
    () => fieldMappings,
    // Depend on key so we only update when content changes (avoids infinite loop if parent passes new object ref each render)
    [fieldMappingsKey, fieldMappings]
  );

  useEffect(() => {
    if (!originalData || !currentData) {
      setDetectedChanges([]);
      return;
    }

    const changes: ChangeItem[] = [];

    Object.keys(stableFieldMappings).forEach(fieldName => {
      const oldValue = originalData[fieldName];
      const newValue = currentData[fieldName];
      const isCurrencyField = currencyFieldsSet.has(fieldName);

      // Normalizar valores para comparación inteligente
      const normalizeValue = (val: unknown, fName: string): string | number | null => {
        // Null, undefined, string vacío -> null
        if (val === null || val === undefined || val === '') return null;
        
        // Campos monetarios: comparar solo valor numérico (evita falsos cambios por formato/símbolo)
        if (isCurrencyField) {
          let valForParse: string | number;
          if (typeof val === 'number') valForParse = val;
          else if (typeof val === 'string') valForParse = val;
          else valForParse = String(val);
          const num = parseCurrencyToNumber(valForParse);
          return num ?? null;
        }
        
        // Valores por defecto que deben tratarse como null para ciertos campos
        const defaultValuesAsNull = ['No', 'N/A', 'n/a', 'no'];
        if (typeof val === 'string' && defaultValuesAsNull.includes(val.trim())) {
          const fieldsWithDefaults = ['wet_line', 'arm_type', 'engine_brand', 'cabin_type'];
          if (fieldsWithDefaults.includes(fName)) {
            return null;
          }
        }
        
        // Fechas: normalizar a YYYY-MM-DD (sin hora ni timezone)
        if (fName.includes('date') || fName.includes('Date')) {
          if (typeof val === 'string') {
            const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(val);
            return dateMatch ? dateMatch[1] : null;
          }
          return null;
        }
        
        // Números: convertir a número y comparar
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const parsed = Number.parseFloat(val);
          if (!Number.isNaN(parsed)) return parsed === 0 ? 0 : parsed;
          return val.trim();
        }
        
        return String(val);
      };

      const normalizedOld = normalizeValue(oldValue, fieldName);
      const normalizedNew = normalizeValue(newValue, fieldName);

      // Detectar si cambió REALMENTE (solo agregar si hay diferencia significativa)
      if (normalizedOld !== normalizedNew) {
        // Excluir cambios insignificantes
        
        // Caso 1: Ambos son null (Sin valor -> Sin valor)
        if (normalizedOld === null && normalizedNew === null) return;
        
        // Caso 2: Ambos son 0 (diferentes formatos: 0.00 vs 0)
        if (normalizedOld === 0 && normalizedNew === 0) return;
        
        // Caso 3: Campos monetarios con mismo valor numérico (ya normalizados a número)
        if (isCurrencyField && typeof normalizedOld === 'number' && typeof normalizedNew === 'number') {
          if (normalizedOld === normalizedNew) return;
        }
        
        // Caso 4: Ambos son el mismo string (case-insensitive)
        if (typeof normalizedOld === 'string' && typeof normalizedNew === 'string') {
          if (normalizedOld.toLowerCase() === normalizedNew.toLowerCase()) return;
        }
        
        // Si pasó todas las validaciones, es un cambio real
        changes.push({
          field_name: fieldName,
          field_label: stableFieldMappings[fieldName],
          old_value: normalizedOld,
          new_value: normalizedNew
        });
      }
    });

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

