/**
 * Parseo de importes en carga masiva de compras (Excel/CSV).
 * Reconoce plantilla tipo: £38,612.50 | € 113,087.50 | " € 113,087.50 "
 */

const CURRENCY_SYMBOLS_REGEX =
  /[¥$€£₹₽₩₪₫₨₦₧₭₮₯₰₱₲₳₴₵₶₷₸₺₻₼₾₿\u00A3\u20AC]/gu;

/** Espacios Unicode (incl. NBSP, narrow NBSP de Excel) y marcas bidireccionales. */
const INVISIBLE_AND_SPACE_REGEX = /[\s\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF\u200E\u200F\u202A-\u202E]/gu;

const stripMoneyDecorations = (raw: string): string => {
  let s = String(raw).normalize('NFKC').trim();
  s = s.replaceAll(/^["'""''`]+|["'""''`]+$/g, '');
  s = s.replaceAll(CURRENCY_SYMBOLS_REGEX, '');
  s = s.replaceAll(INVISIBLE_AND_SPACE_REGEX, '');
  return s.trim();
};

const normalizeCommaOnlyNumberString = (str: string): string => {
  const parts = str.split(',');
  if (parts.length > 2) {
    return parts.join('');
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    if (b.length <= 2) {
      return `${a.replaceAll(',', '')}.${b}`;
    }
    return `${a}${b}`;
  }
  return str;
};

const normalizeDotOnlyNumberString = (str: string): string => {
  const parts = str.split('.');
  if (parts.length > 2) {
    const last = parts[parts.length - 1];
    if (last.length <= 2 && /^\d+$/.test(last)) {
      return `${parts.slice(0, -1).join('')}.${last}`;
    }
    return parts.join('');
  }
  if (parts.length === 2) {
    const frac = parts[1];
    if (frac.length === 3 && /^\d{3}$/.test(frac)) {
      return parts[0] + frac;
    }
  }
  return str;
};

/**
 * Convierte celdas VALOR + BP / numéricos de la plantilla a número.
 * - US/UK: £38,612.50, € 113,087.50 → coma miles, punto decimal
 * - EU: 113.087,50 → punto miles, coma decimal
 */
export function parseBulkUploadNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }

  let cleaned = stripMoneyDecorations(String(value));
  if (cleaned === '') {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    cleaned =
      lastComma > lastDot
        ? cleaned.replaceAll('.', '').replace(',', '.')
        : cleaned.replaceAll(',', '');
  } else if (lastComma >= 0) {
    cleaned = normalizeCommaOnlyNumberString(cleaned);
  } else if (lastDot >= 0) {
    cleaned = normalizeDotOnlyNumberString(cleaned);
  }

  cleaned = cleaned.replaceAll(/[^\d.-]/g, '');
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}
