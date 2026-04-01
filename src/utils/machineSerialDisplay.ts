/**
 * Serial almacenado en BD puede incluir sufijo de desambiguación de carga masiva: BASE~8hex (backend).
 * En UI se muestra solo el serial “de fábrica” / plantilla, sin alterar datos en API.
 */
export function getMachineSerialForDisplay(serial: string | null | undefined): string {
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

/**
 * Al guardar desde un input que muestra el serial “de plantilla”, si el texto no cambió
 * respecto a la vista, se conserva el valor almacenado en BD (p. ej. con sufijo ~xxxxxxxx).
 */
export function resolveSerialValueForSave(
  rawStored: string | null | undefined,
  editedDisplay: string
): string {
  const trimmed = String(editedDisplay ?? '').trim();
  const displayOfRaw = getMachineSerialForDisplay(rawStored ?? '');
  if (rawStored != null && String(rawStored).trim() !== '' && trimmed === displayOfRaw.trim()) {
    return String(rawStored).trim();
  }
  return trimmed;
}
