/**
 * Índice maestro Tipo de Máquina / Marca / Modelo para indexación y cascada
 * en PreselectionPage y ManagementPage.
 * Los valores de tipo se guardan en formato técnico (PARTS / WELDER) y se
 * transforman a etiquetas de UI con formatMachineType().
 */

export type MachineTypeBrandModelRow = {
  tipoMaquina: string;
  marca: string;
  modelo: string;
};

const trim = (s: string) => (s ?? '').trim();
const normalizeToken = (value: string | null | undefined) =>
  trim(String(value ?? ''))
    .split(/\s+/)
    .join(' ')
    .toUpperCase();

const normalizeMachineType = (value: string | null | undefined) => {
  const normalized = normalizeToken(value);
  if (normalized === 'PARTES') return 'PARTS';
  if (normalized === 'MOTO SOLDADOR') return 'WELDER';
  return normalized;
};

/** Índice maestro entregado por negocio (sin duplicados lógicos). */
export const MACHINE_TYPE_BRAND_MODEL_INDEX: MachineTypeBrandModelRow[] = [
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210K-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX75US-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350H-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX120-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX40U-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX75USK-5B' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'CAB ZX-5G /-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225US-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135US-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135US-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210LCH-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200LC-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350LC-6N' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX120-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX130L-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX50U-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200X-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX300LC-6N' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX240-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135USK-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX130K-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USR-6' },
  { tipoMaquina: 'WELDER', marca: 'DENYO', modelo: 'DLW-300LS' },
  { tipoMaquina: 'WELDER', marca: 'DENYO', modelo: 'DAT300 RS' },
  { tipoMaquina: 'MINI DUMPER', marca: 'YANMAR', modelo: 'C12R-B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX17U-5A' },
  { tipoMaquina: 'MINI DUMPER', marca: 'YANMAR', modelo: 'C12R' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX17U-2' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX30U-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX30U-5A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX35U-5A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX330-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135USK-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210K-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210H-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX330-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USR-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USRK-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX250K-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210LC-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX490H-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350K-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX240LC-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350K-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225US-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350LCK-6' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'CABIN' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'TANK COVERS' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'SWING MOTOR' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'ATTACH/CYLINDER' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX490LCH-5A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX300-6A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350H-6' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'CAB ZX200-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350LCK-5B' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'BRAZOS ZX200-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX380LC-6N' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350LC-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350LCN-6' },
];

/** Filtra filas del índice donde tipo/marca/modelo coinciden (string vacío = no filtrar por ese campo) */
function matchRow(
  row: MachineTypeBrandModelRow,
  tipoMaquina: string | null | undefined,
  marca: string | null | undefined,
  modelo: string | null | undefined
): boolean {
  const t = normalizeMachineType(tipoMaquina);
  const m = normalizeToken(marca);
  const mod = normalizeToken(modelo);
  if (t !== '' && normalizeMachineType(row.tipoMaquina) !== t) return false;
  if (m !== '' && normalizeToken(row.marca) !== m) return false;
  if (mod !== '' && normalizeToken(row.modelo) !== mod) return false;
  return true;
}

/** Tipos de máquina únicos del índice, opcionalmente filtrados por marca y/o modelo */
export function getMachineTypesFromIndex(
  marca?: string | null,
  modelo?: string | null
): string[] {
  const rows = MACHINE_TYPE_BRAND_MODEL_INDEX.filter((r) =>
    matchRow(r, undefined, marca ?? null, modelo ?? null)
  );
  const set = new Set(rows.map((r) => normalizeMachineType(r.tipoMaquina)).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Marcas únicas del índice, opcionalmente filtradas por tipo de máquina y/o modelo */
export function getBrandsFromIndex(
  tipoMaquina?: string | null,
  modelo?: string | null
): string[] {
  const rows = MACHINE_TYPE_BRAND_MODEL_INDEX.filter((r) =>
    matchRow(r, tipoMaquina ?? null, undefined, modelo ?? null)
  );
  const set = new Set(rows.map((r) => normalizeToken(r.marca)).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Modelos únicos del índice, opcionalmente filtrados por tipo de máquina y/o marca */
export function getModelsFromIndex(
  tipoMaquina?: string | null,
  marca?: string | null
): string[] {
  const rows = MACHINE_TYPE_BRAND_MODEL_INDEX.filter((r) =>
    matchRow(r, tipoMaquina ?? null, marca ?? null, undefined)
  );
  const set = new Set(rows.map((r) => trim(r.modelo)).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Indica si una combinación (tipo, marca, modelo) existe en el índice */
export function isCombinationInIndex(
  tipoMaquina: string | null | undefined,
  marca: string | null | undefined,
  modelo: string | null | undefined
): boolean {
  const t = normalizeMachineType(tipoMaquina);
  const m = normalizeToken(marca);
  const mod = normalizeToken(modelo);
  return MACHINE_TYPE_BRAND_MODEL_INDEX.some(
    (r) =>
      normalizeMachineType(r.tipoMaquina) === t &&
      normalizeToken(r.marca) === m &&
      normalizeToken(r.modelo) === mod
  );
}

/**
 * Tipos de máquina para filtro: restringidos por marca y/o por lista de modelos.
 * Si modelFilter es un array, devuelve la unión de tipos que tienen al menos uno de esos modelos.
 */
export function getMachineTypesForFilter(
  brandFilter: string | null | undefined,
  modelFilter: string[]
): string[] {
  if (modelFilter.length > 0) {
    const sets = modelFilter.map((m) =>
      new Set(getMachineTypesFromIndex(brandFilter ?? null, m))
    );
    const union = new Set<string>();
    sets.forEach((s) => s.forEach((t) => union.add(t)));
    return Array.from(union).sort((a, b) => a.localeCompare(b));
  }
  return getMachineTypesFromIndex(brandFilter ?? null, null);
}

/**
 * Marcas para filtro: restringidas por tipo y/o por lista de modelos.
 */
export function getBrandsForFilter(
  machineTypeFilter: string | null | undefined,
  modelFilter: string[]
): string[] {
  if (modelFilter.length > 0) {
    const sets = modelFilter.map((m) =>
      new Set(getBrandsFromIndex(machineTypeFilter ?? null, m))
    );
    const union = new Set<string>();
    sets.forEach((s) => s.forEach((b) => union.add(b)));
    return Array.from(union).sort((a, b) => a.localeCompare(b));
  }
  return getBrandsFromIndex(machineTypeFilter ?? null, null);
}

/**
 * Modelos para filtro: restringidos por tipo y marca.
 */
export function getModelsForFilter(
  machineTypeFilter: string | null | undefined,
  brandFilter: string | null | undefined
): string[] {
  return getModelsFromIndex(machineTypeFilter ?? null, brandFilter ?? null);
}
