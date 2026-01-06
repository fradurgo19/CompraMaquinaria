import { MachineType } from '../types/database';

export const MACHINE_TYPE_OPTIONS: { value: MachineType; label: string }[] = [
  { value: 'EXCAVADORA', label: 'Excavadora' },
  { value: 'CARGADOR', label: 'Cargador' },
  { value: 'MINICARGADOR', label: 'Minicargador' },
  { value: 'MINIEXCAVADORA', label: 'Miniexcavadora' },
  { value: 'MOTONIVELADORA', label: 'Motoniveladora' },
  { value: 'RETROCARGADOR', label: 'Retrocargador' },
  { value: 'SOLDADOR', label: 'Soldador' },
  { value: 'TRACTOR', label: 'Tractor' },
  { value: 'PARTE', label: 'Parte' },
  { value: 'OTROS', label: 'Otros' },
];

// Opciones específicas para Preselección, Consolidado y Compras (en orden alfabético)
export const MACHINE_TYPE_OPTIONS_PRESELECTION_CONSOLIDADO_COMPRAS: { value: string; label: string }[] = [
  { value: 'BULLDOZER', label: 'BULLDOZER' },
  { value: 'CARGADOR', label: 'CARGADOR' },
  { value: 'CRAWLER', label: 'CRAWLER' },
  { value: 'EXCAVADORA', label: 'EXCAVADORA' },
  { value: 'MINI CARGADOR', label: 'MINI CARGADOR' },
  { value: 'MINI EXCAVADORA', label: 'MINI EXCAVADORA' },
  { value: 'MOTONIVELADORA', label: 'MOTONIVELADORA' },
  { value: 'PARTS', label: 'PARTS' },
  { value: 'RETROCARGADOR', label: 'RETROCARGADOR' },
  { value: 'VIBRO COMPACTADOR', label: 'VIBRO COMPACTADOR' },
  { value: 'WELDER', label: 'WELDER' },
];

export const MACHINE_TYPE_VALUES: MachineType[] = MACHINE_TYPE_OPTIONS.map((opt) => opt.value);

export const formatMachineType = (value?: string | null) => {
  if (!value) return '';
  const normalized = value.toUpperCase();
  // Buscar primero en las opciones específicas
  const specificOption = MACHINE_TYPE_OPTIONS_PRESELECTION_CONSOLIDADO_COMPRAS.find((opt) => opt.value.toUpperCase() === normalized);
  if (specificOption) return specificOption.label;
  // Luego en las opciones generales
  const option = MACHINE_TYPE_OPTIONS.find((opt) => opt.value === normalized);
  return option?.label || value;
};
