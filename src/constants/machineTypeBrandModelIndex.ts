/**
 * Índice oficial Tipo de Máquina / Marca / Modelo para indexación y cascada
 * en filtros y selects de ManagementPage (Consolidado).
 * Cada fila es una combinación permitida; los selects se filtran según este índice.
 */

export type MachineTypeBrandModelRow = {
  tipoMaquina: string;
  marca: string;
  modelo: string;
};

const trim = (s: string) => (s ?? '').trim();

/** Lista completa de combinaciones TIPO MAQUINA / MARCA / MODELO (orden preservado, sin duplicados lógicos) */
export const MACHINE_TYPE_BRAND_MODEL_INDEX: MachineTypeBrandModelRow[] = [
  { tipoMaquina: 'RETROEXCAVADORA', marca: 'CASE', modelo: '851FX' },
  { tipoMaquina: 'RETROEXCAVADORA', marca: 'CASE', modelo: '580SV' },
  { tipoMaquina: 'EXCAVADORA', marca: 'LIUGONG', modelo: '909F' },
  { tipoMaquina: 'EXCAVADORA', marca: 'LIUGONG', modelo: '915F' },
  { tipoMaquina: 'EXCAVADORA', marca: 'LIUGONG', modelo: '920F' },
  { tipoMaquina: 'EXCAVADORA', marca: 'LIUGONG', modelo: '922F' },
  { tipoMaquina: 'EXCAVADORA', marca: 'LIUGONG', modelo: '933F' },
  { tipoMaquina: 'PARTS', marca: '', modelo: 'ARM BOOM ZX200' },
  { tipoMaquina: 'MINI EXCAVADORA', marca: 'AIRMAN', modelo: 'AX50-3' },
  { tipoMaquina: 'MINI EXCAVADORA', marca: 'AIRMAN', modelo: 'AX50U-3' },
  { tipoMaquina: 'MINI CARGADOR', marca: 'YANMAR', modelo: 'C12R' },
  { tipoMaquina: 'MINI CARGADOR', marca: 'YANMAR', modelo: 'C12R-B' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'CAB_ZX120-5' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'CABIN' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'CABIN ZX200' },
  { tipoMaquina: 'MINI CARGADOR', marca: 'KOMATSU', modelo: 'CD10R-1' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'COVER TANK ZX200' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'CYLINDER' },
  { tipoMaquina: 'BULLDOZER', marca: 'CATERPILLAR', modelo: 'D3C' },
  { tipoMaquina: 'WELDER', marca: 'DANYO', modelo: 'DAT300 RS' },
  { tipoMaquina: 'WELDER', marca: 'DANYO', modelo: 'DENYO DLW-300LS S' },
  { tipoMaquina: 'WELDER', marca: 'DANYO', modelo: 'DLW-300LS' },
  { tipoMaquina: 'MINI EXCAVADORA', marca: 'HITACHI', modelo: 'EX5-2' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'FINAL DRIVE' },
  { tipoMaquina: 'MINI CARGADOR', marca: 'HITACHI', modelo: 'K-120-3' },
  { tipoMaquina: 'MINI CARGADOR', marca: 'HITACHI', modelo: 'K120-3' },
  { tipoMaquina: 'MINI CARGADOR', marca: 'HITACHI', modelo: 'K70-3 (ZX70-3)' },
  { tipoMaquina: 'EXCAVADORA', marca: 'SUMITOMO', modelo: 'SH200-5' },
  { tipoMaquina: 'EXCAVADORA', marca: 'SUMITOMO', modelo: 'SH75X-3B' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'SWIN MOTOR' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'SWING MOTOR' },
  { tipoMaquina: 'PARTS', marca: 'HITACHI', modelo: 'TANK COVERS' },
  { tipoMaquina: 'MINI EXCAVADORA', marca: '', modelo: 'VIO17-1B' },
  { tipoMaquina: 'MINI EXCAVADORA', marca: '', modelo: 'VIO35-7' },
  { tipoMaquina: 'MINI EXCAVADORA', marca: '', modelo: 'VIO50-7' },
  { tipoMaquina: 'MINI EXCAVADORA', marca: '', modelo: 'VIO80-7' },
  { tipoMaquina: 'WELDER', marca: 'DANYO', modelo: 'WELDER, DAT-300RS' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX-200-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX-5G /-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX120-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX120-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX120-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX130-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX130-5G' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX130K-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX130L-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135US' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135US-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135US-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135US-5B BLADE' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135US-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135US-6N' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135USK-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX135USK-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX17U-2' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX17U-5A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200-5G' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200LC-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200LC-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX200X-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210 LC' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210H-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210K-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210K-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210LC-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210LC-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210LCH-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210LCH-5G' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX210LCK-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225US-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225US-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225US-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USR-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USR-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USR-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USRK-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USRK-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USRLC-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX225USRLCK-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX240-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX240LC-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX240LC-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX250K-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX300 LC-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX300-6A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX300LC-6N' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX30U-5A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX330-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX330-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX330LC-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX345US LC-6N' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350H-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350H-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350K-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350K-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350LC-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350LC-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350LC-6N' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX350LCK-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX40U-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX40U-5A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX40U-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX490H-6' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX490LCH-5A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX50U-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX70-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX75-7' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX75US-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX75US-5B' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX75US-A' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX75USK-3' },
  { tipoMaquina: 'EXCAVADORA', marca: 'HITACHI', modelo: 'ZX75USK-5B' },
];

/** Filtra filas del índice donde tipo/marca/modelo coinciden (string vacío = no filtrar por ese campo) */
function matchRow(
  row: MachineTypeBrandModelRow,
  tipoMaquina: string | null | undefined,
  marca: string | null | undefined,
  modelo: string | null | undefined
): boolean {
  const t = trim(String(tipoMaquina ?? ''));
  const m = trim(String(marca ?? ''));
  const mod = trim(String(modelo ?? ''));
  if (t !== '' && trim(row.tipoMaquina) !== t) return false;
  if (m !== '' && trim(row.marca) !== m) return false;
  if (mod !== '' && trim(row.modelo) !== mod) return false;
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
  const set = new Set(rows.map((r) => trim(r.tipoMaquina)).filter(Boolean));
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
  const set = new Set(rows.map((r) => trim(r.marca)));
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
  const t = trim(String(tipoMaquina ?? ''));
  const m = trim(String(marca ?? ''));
  const mod = trim(String(modelo ?? ''));
  return MACHINE_TYPE_BRAND_MODEL_INDEX.some(
    (r) =>
      trim(r.tipoMaquina) === t && trim(r.marca) === m && trim(r.modelo) === mod
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
