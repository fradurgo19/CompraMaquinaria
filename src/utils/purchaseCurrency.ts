/**
 * Códigos de moneda canónicos en compras (alineado con carga masiva y selects de la UI).
 */
export const PURCHASE_ALLOWED_CURRENCIES = ['JPY', 'GBP', 'EUR', 'USD', 'CAD'] as const;

const ALIAS_TO_CANONICAL: Record<string, string> = {
  EURO: 'EUR',
  EUR: 'EUR',
  USD: 'USD',
  JPY: 'JPY',
  YEN: 'JPY',
  GBP: 'GBP',
  CAD: 'CAD',
  DOLAR: 'USD',
  DOLLAR: 'USD',
  POUND: 'GBP',
  LIBRA: 'GBP',
  'CANADIAN DOLLAR': 'CAD',
  'DOLLAR CANADIENSE': 'CAD',
};

/**
 * Convierte alias (p. ej. EURO) al código ISO usado en BD y formularios (EUR).
 */
export function normalizePurchaseCurrencyType(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const key = String(raw).trim().toUpperCase();
  return ALIAS_TO_CANONICAL[key] ?? key;
}

export function isAllowedPurchaseCurrency(code: string | null | undefined): boolean {
  if (!code) return false;
  return (PURCHASE_ALLOWED_CURRENCIES as readonly string[]).includes(code);
}
