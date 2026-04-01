/**
 * Serial en BD puede incluir sufijo de desambiguación (carga masiva): BASE~8hex.
 * Para texto en PDFs y vistas, mostrar solo el serial de plantilla (misma regla que `src/utils/machineSerialDisplay.ts`).
 *
 * @param {string | null | undefined} serial
 * @returns {string}
 */
export function getMachineSerialForDisplay(serial) {
  if (serial === null || serial === undefined || serial === '') {
    return '';
  }
  const s = String(serial).trim();
  const sep = s.indexOf('~');
  if (sep === -1) {
    return s;
  }
  const suffix = s.slice(sep + 1);
  if (/^[0-9a-f]{8}$/i.test(suffix)) {
    return s.slice(0, sep);
  }
  return s;
}
