/**
 * Formatear valores para el historial de cambios en todos los módulos.
 * Aplica puntos de mil (es-CO) a números y strings numéricos.
 * Regla general: old_value y new_value se muestran con separadores de miles.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

function formatIsoDateString(s: string): string | null {
  if (!ISO_DATE_RE.test(s)) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

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

  const isoFormatted = formatIsoDateString(s);
  if (isoFormatted !== null) return isoFormatted;

  // String con posible formato de miles (1.234.567 o 1.234.567,89): quitar puntos de miles y coma decimal
  const withThousandDots = /^(-?\d{1,3}(?:\.\d{3})*)(,\d{1,2})?$/;
  if (withThousandDots.test(s)) {
    const n = Number.parseFloat(s.replaceAll('.', '').replaceAll(',', '.'));
    if (!Number.isNaN(n)) {
      return n.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
  }

  // String numérico simple: 1234567, 1234.56, 1234,56
  const simple = s.replace(',', '.');
  const n = Number.parseFloat(simple);
  if (!Number.isNaN(n) && /^-?[\d.,\s]+$/.test(s)) {
    return n.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  return s;
}
