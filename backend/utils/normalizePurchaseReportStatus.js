/**
 * purchases.sales_reported, commerce_reported, luis_lemus_reported tienen
 * CHECK (... IN ('OK','PDTE')). La carga masiva puede traer N/A, texto largo
 * o celdas mal mapeadas; se coerciona siempre a un valor válido.
 *
 * @param {unknown} raw
 * @returns {'OK'|'PDTE'}
 */
export function normalizePurchaseReportStatus(raw) {
  if (raw === null || raw === undefined) return 'PDTE';
  if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
    return 'PDTE';
  }
  const s = String(raw).trim().toUpperCase();
  if (s === 'OK' || s === 'SI' || s === 'SÍ' || s === 'YES') return 'OK';
  return 'PDTE';
}
