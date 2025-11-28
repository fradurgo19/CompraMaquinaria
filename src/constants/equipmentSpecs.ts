/**
 * Especificaciones técnicas por defecto según modelo de máquina
 * Similar al sistema de preselección
 */

export interface EquipmentSpecs {
  cabin_type: string; // TIPO CABINA
  wet_line: string; // LINEA HUMEDA (SI/NO)
  dozer_blade: string; // HOJA TOPADORA (SI/NO)
  track_type: string; // TIPO ZAPATA
  track_width: string; // ANCHO ZAPATA
}

export interface ModelSpecs {
  model: string;
  condition: 'NUEVA' | 'USADA';
  specs: EquipmentSpecs;
}

// Especificaciones por defecto según modelo
export const MODEL_SPECIFICATIONS: ModelSpecs[] = [
  // 1,7 - 5,5 TON
  {
    model: 'VIO17-1B',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CANOPY',
      wet_line: 'SI',
      dozer_blade: 'SI',
      track_type: 'STEEL TRACK',
      track_width: '230 mm',
    },
  },
  {
    model: 'ZX17U-5A',
    condition: 'USADA',
    specs: {
      cabin_type: 'CANOPY',
      wet_line: 'SI',
      dozer_blade: 'SI',
      track_type: 'STEEL TRACK',
      track_width: '230 mm',
    },
  },
  {
    model: 'ZX30U-5A',
    condition: 'USADA',
    specs: {
      cabin_type: 'CANOPY',
      wet_line: 'SI',
      dozer_blade: 'SI',
      track_type: 'STEEL TRACK',
      track_width: '300 mm',
    },
  },
  {
    model: 'VIO35-7',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CANOPY',
      wet_line: 'SI',
      dozer_blade: 'SI',
      track_type: 'STEEL TRACK',
      track_width: '300 mm',
    },
  },
  {
    model: 'ZX40U-5B',
    condition: 'USADA',
    specs: {
      cabin_type: 'CANOPY',
      wet_line: 'SI',
      dozer_blade: 'SI',
      track_type: 'STEEL TRACK',
      track_width: '350 mm',
    },
  },
  {
    model: 'VIO50-7',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'SI',
      dozer_blade: 'SI',
      track_type: 'STEEL TRACK',
      track_width: '400 mm',
    },
  },
  {
    model: 'AX50-3',
    condition: 'USADA',
    specs: {
      cabin_type: 'CANOPY',
      wet_line: 'SI',
      dozer_blade: 'SI',
      track_type: 'STEEL TRACK',
      track_width: '400 mm',
    },
  },
  // 6 - 8 TON
  {
    model: 'ZX75US-5B',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '450 mm',
    },
  },
  {
    model: 'ZX75USK-5B',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '450 mm',
    },
  },
  {
    model: 'ZX75-7',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '450 mm',
    },
  },
  {
    model: 'VIO80-7',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '450 mm',
    },
  },
  {
    model: '909F',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '450 mm',
    },
  },
  // 10 - 14 TON
  {
    model: 'ZX120-6',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '600mm',
    },
  },
  {
    model: 'ZX135US-6',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '500mm',
    },
  },
  {
    model: 'ZX135USK-5B',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '500mm',
    },
  },
  {
    model: 'ZX135US-5B',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '500mm',
    },
  },
  {
    model: 'ZX130-5B',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '700mm',
    },
  },
  {
    model: '915F',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '600mm',
    },
  },
  // 18 - 22 TON
  {
    model: '920F',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '800mm',
    },
  },
  {
    model: '922F',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '800mm',
    },
  },
  {
    model: 'ZX200-6',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '600mm',
    },
  },
  {
    model: 'ZX200LC-5B',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '700mm',
    },
  },
  {
    model: 'ZX225USR-6',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '600mm',
    },
  },
  {
    model: 'ZX210LC-5B',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '800mm',
    },
  },
  // 30 - 36 TON
  {
    model: 'ZX350LC-6N',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '800mm',
    },
  },
  {
    model: 'ZX350H-5B',
    condition: 'USADA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '800mm',
    },
  },
  {
    model: 'ZX350LC-5B',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '800mm',
    },
  },
  {
    model: '933F',
    condition: 'NUEVA',
    specs: {
      cabin_type: 'CAB CERRADA',
      wet_line: 'NO',
      dozer_blade: 'NO',
      track_type: 'STEEL TRACK',
      track_width: '800mm',
    },
  },
];

/**
 * Obtiene las especificaciones por defecto para un modelo dado
 */
export function getDefaultSpecsForModel(model: string, condition?: string): EquipmentSpecs | null {
  if (!model) return null;
  
  const normalizedModel = model.trim().toUpperCase();
  const normalizedCondition = condition?.trim().toUpperCase();
  
  // Buscar coincidencia exacta primero
  let match = MODEL_SPECIFICATIONS.find(
    (spec) => spec.model.toUpperCase() === normalizedModel
  );
  
  // Si hay condición, intentar coincidir también con condición
  if (normalizedCondition && match) {
    const conditionMatch = match.condition === normalizedCondition;
    if (!conditionMatch) {
      // Buscar otro modelo con la misma condición
      match = MODEL_SPECIFICATIONS.find(
        (spec) =>
          spec.model.toUpperCase() === normalizedModel &&
          spec.condition === normalizedCondition
      ) || match;
    }
  }
  
  return match?.specs || null;
}

/**
 * Opciones para TIPO EQUIPO
 */
export const EQUIPMENT_TYPES = [
  'ALIMENTADOR VIBRATORIO',
  'BULLDOZER',
  'EXCAVADORA',
  'MINICARGADOR',
  'MINIEXCAVADORA',
  'MOTONIVELADORA',
  'PULVERIZADORA',
  'RETROCARGADOR',
  'VIBROCOMPACTADOR',
  'VOLQUETA',
] as const;

/**
 * Opciones para TIPO CABINA
 */
export const CABIN_TYPES = ['CANOPY', 'CAB CERRADA'] as const;

/**
 * Opciones para LINEA HUMEDA y HOJA TOPADORA
 */
export const YES_NO_OPTIONS = ['SI', 'NO'] as const;

/**
 * Opciones para TIPO ZAPATA
 */
export const TRACK_TYPES = ['STEEL TRACK', 'RUBBER TRACK'] as const;

