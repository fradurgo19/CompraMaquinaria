/**
 * Formatear valores para el historial de cambios en todos los módulos.
 * Aplica puntos de mil (es-CO) a números y strings numéricos.
 * Regla general: old_value y new_value se muestran con separadores de miles.
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/;

function formatDateValue(date: Date): string {
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function parseDateOnlyAsLocalDate(s: string): Date | null {
  const match = DATE_ONLY_RE.exec(s);
  if (match === null) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function formatIsoDateString(s: string): string | null {
  const localDate = parseDateOnlyAsLocalDate(s);
  if (localDate !== null) return formatDateValue(localDate);
  if (!ISO_DATE_TIME_RE.test(s)) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateValue(d);
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
