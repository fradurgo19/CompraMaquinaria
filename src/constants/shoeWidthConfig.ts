/**
 * Configuración de Ancho de Zapatas (mm) por modelo.
 * Usada en Gestionar Especificaciones por Defecto y en el popover de Especificaciones Técnicas (Preselection).
 * - Una opción: valor fijo, solo lectura.
 * - Varias opciones: lista desplegable para elegir.
 */

export interface TonnageRangeConfig {
  range: string;
  models: string[];
  cabin: string;
  armType: string;
  shoeWidthOptions: number[] | null; // null = valor fijo (defaultShoeWidth), array = opciones para elegir
  defaultShoeWidth?: number;
  blade: boolean | null;
  pip: boolean | null;
}

export const TONNAGE_RANGES: TonnageRangeConfig[] = [
  { range: '1.5 - 2.9', models: ['ZX17U-2', 'ZX17U-5A'], cabin: 'CANOPY', armType: 'ESTANDAR', shoeWidthOptions: null, defaultShoeWidth: 230, blade: true, pip: true },
  { range: '3.0 - 3.9', models: ['ZX30U-3', 'ZX30U-5A', 'ZX35U-5A'], cabin: 'CANOPY', armType: 'ESTANDAR', shoeWidthOptions: null, defaultShoeWidth: 300, blade: true, pip: true },
  { range: '4.0 - 5.5', models: ['ZX40U-5B', 'ZX50U-5B'], cabin: 'CANOPY', armType: 'ESTANDAR', shoeWidthOptions: null, defaultShoeWidth: 400, blade: true, pip: true },
  { range: '7.0 - 8.5', models: ['ZX75US-5B', 'ZX75USK-5B'], cabin: 'CABINA CERRADA/AC', armType: 'ESTANDAR', shoeWidthOptions: null, defaultShoeWidth: 450, blade: null, pip: null },
  { range: '10-15', models: ['ZX120-5B', 'ZX120-6', 'ZX130L-5B', 'ZX130K-6', 'ZX135US-5B', 'ZX135US-6', 'ZX135USK-5B', 'ZX135USK-6'], cabin: 'CABINA CERRADA/AC', armType: 'ESTANDAR', shoeWidthOptions: [500, 600, 700], blade: null, pip: null },
  { range: '20 - 23', models: ['ZX200-3', 'ZX200-5B', 'ZX200-6', 'ZX200LC-6', 'ZX200X-5B', 'ZX210H-6', 'ZX210K-5B', 'ZX210K-6', 'ZX210LC-6', 'ZX210LCH-5B', 'ZX210LCK-6', 'ZX225US-5B', 'ZX225US-6', 'ZX225USR-5B', 'ZX225USR-6', 'ZX225USRK-5B'], cabin: 'CABINA CERRADA/AC', armType: 'ESTANDAR', shoeWidthOptions: [600, 800], blade: null, pip: null },
  { range: '24 - 26', models: ['ZX240-6', 'ZX240LC-6', 'ZX250K-6'], cabin: 'CABINA CERRADA/AC', armType: 'ESTANDAR', shoeWidthOptions: [600, 800], blade: null, pip: null },
  { range: '28 - 33', models: ['ZX300LC-6N', 'ZX300-6A', 'ZX330-5B', 'ZX330-6'], cabin: 'CABINA CERRADA/AC', armType: 'ESTANDAR', shoeWidthOptions: [600, 800], blade: null, pip: null },
  { range: '35 - 38', models: ['ZX350-5B', 'ZX350H-5B', 'ZX350H-6', 'ZX350LC-6N', 'ZX350K-6', 'ZX350LCK-6'], cabin: 'CABINA CERRADA/AC', armType: 'ESTANDAR', shoeWidthOptions: [600, 800], blade: null, pip: null },
  { range: '44 - 50', models: ['ZX490H-6', 'ZX490LCH-5A'], cabin: 'CABINA CERRADA/AC', armType: 'ESTANDAR', shoeWidthOptions: [600, 800], blade: null, pip: null },
];

export type ShoeWidthConfig =
  | { type: 'readonly'; value: number }
  | { type: 'select'; options: number[] }
  | null;

/** Map opcional: tonelage -> modelos desde BD (modelos agregados en Gestionar Especificaciones por Defecto). */
export type DynamicModelsByRange = Record<string, string[]>;

function modelMatches(m: string, name: string): boolean {
  return name.trim().toLowerCase() === m;
}

function findRangeForModel(
  m: string,
  dynamicModelsByRange?: DynamicModelsByRange | null
): TonnageRangeConfig | undefined {
  const fromStatic = TONNAGE_RANGES.find((r) => r.models.some((name) => modelMatches(m, name)));
  if (fromStatic) return fromStatic;

  if (!dynamicModelsByRange || typeof dynamicModelsByRange !== 'object') return undefined;
  for (const [tonelage, models] of Object.entries(dynamicModelsByRange)) {
    if (Array.isArray(models) && models.some((name) => modelMatches(m, String(name)))) {
      return TONNAGE_RANGES.find((r) => r.range === tonelage);
    }
  }
  return undefined;
}

function configFromRange(range: TonnageRangeConfig): ShoeWidthConfig {
  if (range.shoeWidthOptions && Array.isArray(range.shoeWidthOptions)) {
    if (range.shoeWidthOptions.length === 1) {
      return { type: 'readonly', value: range.shoeWidthOptions[0] };
    }
    if (range.shoeWidthOptions.length > 1) {
      return { type: 'select', options: range.shoeWidthOptions };
    }
  }
  if (range.defaultShoeWidth != null) {
    return { type: 'readonly', value: range.defaultShoeWidth };
  }
  return null;
}

/**
 * Obtiene la configuración de Ancho Zapatas (mm) para un modelo.
 * - readonly: una sola opción, no editable.
 * - select: varias opciones, lista desplegable.
 * - null: modelo no en la tabla; se puede usar input libre.
 * Si se pasa dynamicModelsByRange (de GET /api/machine-spec-defaults/shoe-width-ranges), los modelos
 * añadidos en Gestionar Especificaciones por Defecto se consideran dentro del rango y usan su select/readonly.
 */
export function getShoeWidthConfigForModel(
  model: string | null | undefined,
  dynamicModelsByRange?: DynamicModelsByRange | null
): ShoeWidthConfig {
  const m = (model || '').trim().toLowerCase();
  if (!m) return null;

  const range = findRangeForModel(m, dynamicModelsByRange);
  if (!range) return null;

  return configFromRange(range);
}
