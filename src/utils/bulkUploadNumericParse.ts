/**
 * Parseo de importes en carga masiva de compras (Excel/CSV).
 *
 * Plantilla UNION (columnas numéricas):
 * - VALOR + BP, GASTOS + LAVADO: ¥6,120,000, ¥275,000, …
 * - DESENSAMBLAJE + CARGUE: ¥- (sin monto) o ¥135,000.00
 * - CONTRAVALOR: 152.84
 * - TRM: $ 4,355.00
 * - También: £38,612.50 | € 113,087.50 (coma miles, punto decimal US/UK)
 */

const CURRENCY_SYMBOLS_REGEX = /[¥$€£₹₽₩₪₫₨₦₧₭₮₯₰₱₲₳₴₵₶₷₸₺₻₼₾₿]/gu;

const OUTER_QUOTES_REGEX = /^["'`\u201C\u201D\u2018\u2019]+|["'`\u201C\u201D\u2018\u2019]+$/gu;

/** Marcas bidireccionales y BOM que Excel a veces inserta; \s/u cubre NBSP y narrow NBSP (U+202F). */
const BIDI_AND_BOM_REGEX = /[\u200E\u200F\u202A-\u202E]/g;

const stripMoneyDecorations = (raw: string): string => {
  let s = String(raw).normalize('NFKC').trim();
  s = s.replaceAll(OUTER_QUOTES_REGEX, '');
  s = s.replaceAll(CURRENCY_SYMBOLS_REGEX, '');
  s = s.replaceAll(/\s/gu, '');
  s = s.replaceAll(BIDI_AND_BOM_REGEX, '');
  s = s.replaceAll('\uFEFF', '');
  return s.trim();
};

/** Celda tipo "¥-" o guión largo en plantilla = sin importe (se guarda como 0). */
const isDashOnlyPlaceholder = (str: string): boolean =>
  /^[-\u2013\u2014\u2212]+$/.test(str);

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
    const last = parts.at(-1) ?? '';
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

  if (isDashOnlyPlaceholder(cleaned)) {
    return 0;
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
