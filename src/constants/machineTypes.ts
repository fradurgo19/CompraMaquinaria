import { MachineType } from '../types/database';

export const MACHINE_TYPE_OPTIONS: { value: MachineType; label: string }[] = [
  { value: 'EXCAVADORA', label: 'Excavadora' },
  { value: 'CARGADOR', label: 'Cargador' },
  { value: 'MINICARGADOR', label: 'Minicargador' },
  { value: 'MOTONIVELADORA', label: 'Motoniveladora' },
  { value: 'BULLDOZER', label: 'Bulldozer' },
  { value: 'RETROCARGADOR', label: 'Retrocargador' },
  { value: 'RODILLO TANDEM', label: 'Rodillo Tandem' },
  { value: 'RODILLO COMBI', label: 'Rodillo Combi' },
  { value: 'VIBROCOMPACTADOR', label: 'Vibrocompactador' },
  { value: 'PAVIMENTADORA', label: 'Pavimentadora' },
  { value: 'COMPACTADOR NEUMATIVO', label: 'Compactador Neumático' },
  { value: 'FRESADORA', label: 'Fresadora' },
  { value: 'MINIPAVIMENTADORA', label: 'Minipavimentadora' },
  { value: 'MINIEXCAVADORA', label: 'Miniexcavadora' },
  { value: 'SOLDADOR', label: 'Soldador' },
  { value: 'TRACTOR', label: 'Tractor' },
  { value: 'PARTE', label: 'Parte' },
  { value: 'OTROS', label: 'Otros' },
];

// Opciones específicas para Preselección, Consolidado y Compras (en orden alfabético)
export const MACHINE_TYPE_OPTIONS_PRESELECTION_CONSOLIDADO_COMPRAS: { value: string; label: string }[] = [
  { value: 'BULLDOZER', label: 'BULLDOZER' },
  { value: 'CARGADOR', label: 'CARGADOR' },
  { value: 'COMPACTADOR NEUMATIVO', label: 'COMPACTADOR NEUMATIVO' },
  { value: 'CRAWLER', label: 'CRAWLER' },
  { value: 'EXCAVADORA', label: 'EXCAVADORA' },
  { value: 'FRESADORA', label: 'FRESADORA' },
  { value: 'MINI CARGADOR', label: 'MINI CARGADOR' },
  { value: 'MINI DUMPER', label: 'MINI DUMPER' },
  { value: 'MINI EXCAVADORA', label: 'MINI EXCAVADORA' },
  { value: 'MINIPAVIMENTADORA', label: 'MINIPAVIMENTADORA' },
  { value: 'MOTONIVELADORA', label: 'MOTONIVELADORA' },
  { value: 'PARTS', label: 'PARTES' },
  { value: 'PAVIMENTADORA', label: 'PAVIMENTADORA' },
  { value: 'RETROCARGADOR', label: 'RETROCARGADOR' },
  { value: 'RODILLO COMBI', label: 'RODILLO COMBI' },
  { value: 'RODILLO TANDEM', label: 'RODILLO TANDEM' },
  { value: 'VIBRO COMPACTADOR', label: 'VIBRO COMPACTADOR' },
  { value: 'VIBROCOMPACTADOR', label: 'VIBROCOMPACTADOR' },
  { value: 'WELDER', label: 'MOTO SOLDADOR' },
];

// Opciones visibles para Tipo de máquina en páginas operativas clave.
// Nota: no reemplaza el catálogo completo; solo controla qué se muestra en estos selects específicos.
export const MACHINE_TYPE_OPTIONS_FOCUSED_UI: { value: string; label: string }[] = [
  { value: 'EXCAVADORA', label: 'EXCAVADORA' },
  { value: 'MINI DUMPER', label: 'MINI DUMPER' },
  { value: 'WELDER', label: 'MOTO SOLDADOR' },
  { value: 'PARTS', label: 'PARTES' },
];

export const MACHINE_TYPE_VALUES: MachineType[] = MACHINE_TYPE_OPTIONS.map((opt) => opt.value);

/** Clave estable para comparar tipos (acentos, espacios, guiones). Alineado con normalización de carga/API. */
function normalizeMachineTypeKey(value: string): string {
  return String(value)
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replaceAll('-', ' ')
    .replaceAll(/\s+/g, ' ');
}

const MACHINE_TYPE_FILTER_ALIASES: Readonly<Record<string, string>> = {
  'MINI DUMBER': 'MINI DUMPER',
};

function applyMachineTypeFilterAliases(key: string): string {
  return MACHINE_TYPE_FILTER_ALIASES[key] ?? key;
}

export const formatMachineType = (value?: string | null) => {
  if (value == null || value === '') return '';
  let key = applyMachineTypeFilterAliases(normalizeMachineTypeKey(String(value)));
  if (!key) return '';
  const specificOption = MACHINE_TYPE_OPTIONS_PRESELECTION_CONSOLIDADO_COMPRAS.find((opt) => opt.value.toUpperCase() === key);
  if (specificOption) return specificOption.label;
  const option = MACHINE_TYPE_OPTIONS.find((opt) => opt.value === key);
  return option?.label || key;
};

/**
 * Código canónico para filtrar: unifica variantes de BD/import con el `value` del select
 * (ej. PARTE/PARTES → PARTS, WLDER → WELDER).
 */
function canonicalMachineTypeCodeForFilter(raw: string): string {
  let t = applyMachineTypeFilterAliases(normalizeMachineTypeKey(raw ?? ''));
  if (t === 'PARTE' || t === 'PARTES') {
    return 'PARTS';
  }
  if (t === 'WLDER') {
    return 'WELDER';
  }
  return t;
}

/**
 * Comprueba si el `machine_type` de una fila coincide con el valor del filtro de columna.
 * Evita fallos cuando la etiqueta en UI difiere del código guardado (PARTES vs PARTS, etc.).
 */
export function machineTypeMatchesFilter(
  rowValue: string | null | undefined,
  filterValue: string
): boolean {
  if (!filterValue) {
    return true;
  }
  const rowCanon = canonicalMachineTypeCodeForFilter(rowValue ?? '');
  const filterCanon = canonicalMachineTypeCodeForFilter(filterValue);
  if (rowCanon === filterCanon) {
    return true;
  }
  const rowLabel = formatMachineType(rowValue) || rowCanon;
  const filterLabel = formatMachineType(filterValue) || filterCanon;
  return rowLabel === filterLabel;
}
