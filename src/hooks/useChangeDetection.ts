/**
 * Hook para detectar cambios en formularios
 * Compara valores originales vs nuevos y retorna diferencias
 */

import { useState, useEffect, useMemo } from 'react';

interface ChangeItem {
  field_name: string;
  field_label: string;
  old_value: string | number | null;
  new_value: string | number | null;
}

interface FieldMapping {
  [key: string]: string; // field_name -> field_label
}

export const useChangeDetection = (
  originalData: any,
  currentData: any,
  fieldMappings: FieldMapping
) => {
  const [detectedChanges, setDetectedChanges] = useState<ChangeItem[]>([]);

  // Estabilizar fieldMappings para evitar renders infinitos
  const stableFieldMappings = useMemo(() => fieldMappings, [JSON.stringify(fieldMappings)]);

  useEffect(() => {
    if (!originalData || !currentData) {
      setDetectedChanges([]);
      return;
    }

    const changes: ChangeItem[] = [];

    Object.keys(stableFieldMappings).forEach(fieldName => {
      const oldValue = originalData[fieldName];
      const newValue = currentData[fieldName];

      // Normalizar valores para comparación inteligente
      const normalizeValue = (val: any, fieldName: string) => {
        // Null, undefined, string vacío -> null
        if (val === null || val === undefined || val === '') return null;
        
        // Fechas: normalizar a YYYY-MM-DD (sin hora ni timezone)
        if (fieldName.includes('date') || fieldName.includes('Date')) {
          if (typeof val === 'string') {
            // Extraer solo la parte de fecha YYYY-MM-DD
            const dateMatch = val.match(/(\d{4}-\d{2}-\d{2})/);
            return dateMatch ? dateMatch[1] : null;
          }
          return null;
        }
        
        // Números: convertir a número y comparar
        if (typeof val === 'number') return val;
        if (typeof val === 'string' && !isNaN(parseFloat(val))) {
          const num = parseFloat(val);
          // Si es 0, 0.00, "0", etc., normalizar a 0
          return num === 0 ? 0 : num;
        }
        
        // Strings: trim y lowercase para comparación case-insensitive
        if (typeof val === 'string') return val.trim();
        
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
        
        // Caso 3: Ambos son el mismo string (case-insensitive)
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
  }, [originalData, currentData, stableFieldMappings]);

  return {
    hasChanges: detectedChanges.length > 0,
    changes: detectedChanges,
    changeCount: detectedChanges.length
  };
};

