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

export const MACHINE_TYPE_VALUES: MachineType[] = MACHINE_TYPE_OPTIONS.map((opt) => opt.value);

export const formatMachineType = (value?: string | null) => {
  if (!value) return '';
  const normalized = value.toUpperCase();
  const option = MACHINE_TYPE_OPTIONS.find((opt) => opt.value === normalized);
  return option?.label || value;
};
