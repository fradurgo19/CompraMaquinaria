/**
 * Utilidades para mapear marcas y modelos basándose en patrones
 */

import { BRAND_OPTIONS } from '../constants/brands';

// Modelos específicos de CASE
const CASE_MODELS = [
  '1107EX',
  '1150L',
  '1650L',
  '1650M',
  '570ST',
  '575SV',
  '580N',
  '580SN',
  '580SV',
  '821G',
  '845B',
  '845C',
  '845C Tier 4',
  '851FX',
  'CX220C SERIE II',
  'CX220C-8',
  'CX240C-8',
  'SR175B',
  'SR200B',
  'SR210B',
  'SR220B',
  'SR240B',
  'SR250B',
  'SV208',
];

// Modelos BOMAG (rodillos, compactadores): BM xxx
const BOMAG_MODELS_PREFIX = 'BM';

// Modelos DYNAPAC (compactadores, rodillos): CA, CC, CP, F
const DYNAPAC_PREFIXES = ['CA', 'CC', 'CP', 'F'];

/**
 * Determina si un modelo pertenece a una marca basándose en patrones
 */
export const isModelForBrand = (model: string, brand: string): boolean => {
  if (!model || !brand) return false;
  
  const modelUpper = model.toUpperCase().trim();
  const brandUpper = brand.toUpperCase().trim();

  switch (brandUpper) {
    case 'BOMAG':
      return modelUpper.startsWith(BOMAG_MODELS_PREFIX);

    case 'HITACHI':
      // Todos los modelos que comienzan con ZX son HITACHI
      return modelUpper.startsWith('ZX');

    case 'CASE':
      // Lista específica de modelos CASE - verificar coincidencia exacta o que comience con el modelo
      return CASE_MODELS.some(caseModel => {
        const caseModelUpper = caseModel.toUpperCase();
        return modelUpper === caseModelUpper || modelUpper.startsWith(caseModelUpper);
      });

    case 'DYNAPAC':
      return DYNAPAC_PREFIXES.some(prefix => modelUpper.startsWith(prefix));

    case 'LIUGONG':
      // Modelos 8xx (856H, 856HE) y 9xx (915F, 920F, 922F, 933F)
      return modelUpper.startsWith('8') || modelUpper.startsWith('9');

    case 'YANMAR':
      // Todos los modelos que comienzan con VI
      return modelUpper.startsWith('VI');
    
    case 'AMMANN':
      // Modelos que comienzan con ARS o ASC
      return modelUpper.startsWith('ARS') || modelUpper.startsWith('ASC');
    
    default:
      return false;
  }
};

/**
 * Obtiene todos los modelos que pertenecen a una marca basándose en:
 * 1. Las combinaciones reales de la BD (brandModelMap)
 * 2. Los patrones definidos (isModelForBrand)
 * 3. Las constantes MODEL_OPTIONS
 */
export const getModelsForBrand = (
  brand: string | null | undefined,
  brandModelMap: Record<string, string[]>,
  allModels: string[]
): string[] => {
  if (!brand) {
    return allModels;
  }

  const modelsFromDB = brandModelMap[brand] || [];
  const modelsByPattern: string[] = [];

  // Filtrar todos los modelos por patrón
  allModels.forEach(model => {
    if (isModelForBrand(model, brand)) {
      modelsByPattern.push(model);
    }
  });

  // Combinar modelos de BD y por patrón, eliminar duplicados (normalizando espacios y mayúsculas)
  const combined = [...modelsFromDB, ...modelsByPattern];
  const normalizedMap = new Map<string, string>();
  combined.forEach(model => {
    const normalized = model.trim();
    if (normalized && !normalizedMap.has(normalized)) {
      normalizedMap.set(normalized, normalized);
    }
  });
  const uniqueModels = Array.from(normalizedMap.values()).sort((a, b) => a.localeCompare(b));

  // Filtrar modelos específicos que no deben aparecer en las opciones
  const excludedModels = new Set([
    'ZX135US-5B BLADE',
    'ZX75US-5B BLADE',
    'ZX-200-6', // excluir variante con guion, solo se usa ZX200-6
    'ZX-5B',
    'ZX-5G',
    'ZX-5G /-5B'
  ]);
  const filteredModels = uniqueModels.filter(model => !excludedModels.has(model));

  return filteredModels;
};

/**
 * Obtiene todas las marcas posibles (de constantes y de combinaciones)
 * Excluye la opción "MARCA" que es solo un placeholder
 */
export const getAllBrands = (
  brandModelMap: Record<string, string[]>
): string[] => {
  const brandsFromMap = Object.keys(brandModelMap);
  const combined = [...BRAND_OPTIONS, ...brandsFromMap];
  // Filtrar "MARCA" (puede estar en mayúsculas o minúsculas)
  const filtered = combined.filter(brand => 
    brand.toUpperCase() !== 'MARCA' && brand.trim() !== ''
  );
  return Array.from(new Set(filtered)).sort((a, b) => a.localeCompare(b));
};
