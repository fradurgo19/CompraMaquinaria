/**
 * Formatear valores para el historial de cambios en todos los módulos.
 * Aplica puntos de mil (es-CO) a números y strings numéricos.
 * Regla general: old_value y new_value se muestran con separadores de miles.
 */

export function formatChangeValue(
  val: string | number | boolean | null | undefined
): string {
  if (val === null || val === undefined) return 'Sin valor';
  if (val === '') return 'Sin valor';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (typeof val === 'number') {
    if (Number.isNaN(val)) return 'Sin valor';
    return val.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  const s = String(val).trim();
  if (!s) return 'Sin valor';

  // String con posible formato de miles (1.234.567 o 1.234.567,89): quitar puntos de miles y coma decimal
  const withThousandDots = /^(-?\d{1,3}(?:\.\d{3})*)(,\d{1,2})?$/;
  if (withThousandDots.test(s)) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(n)) {
      return n.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
  }

  // String numérico simple: 1234567, 1234.56, 1234,56
  const simple = s.replace(',', '.');
  const n = parseFloat(simple);
  if (!isNaN(n) && /^-?[\d.,\s]+$/.test(s)) {
    return n.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  return s;
}
