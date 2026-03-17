import type { ShipmentType } from '../types/database';

export type SupportedShipmentMethod = Extract<ShipmentType, '1X20' | '1X40' | 'RORO' | 'LOLO'>;

type TonnageContext =
  | {
      tonnageMin?: number | null;
      tonnageMax?: number | null;
      tonnageLabel?: string | null;
    }
  | string
  | number
  | null
  | undefined;

export interface ShipmentPolicyByTonnage {
  options: SupportedShipmentMethod[];
  defaultMethod: SupportedShipmentMethod;
}

interface ShipmentPolicyRule {
  min: number;
  max: number;
  options: SupportedShipmentMethod[];
  defaultMethod: SupportedShipmentMethod;
}

const SHIPMENT_POLICY_RULES: ShipmentPolicyRule[] = [
  { min: 1.5, max: 2.9, options: ['1X40', '1X20'], defaultMethod: '1X40' },
  { min: 3, max: 3.9, options: ['1X40', '1X20'], defaultMethod: '1X40' },
  { min: 4, max: 5.5, options: ['1X40', '1X20'], defaultMethod: '1X40' },
  { min: 7, max: 8.5, options: ['1X40', '1X20'], defaultMethod: '1X40' },
  { min: 10, max: 15, options: ['RORO', 'LOLO'], defaultMethod: 'RORO' },
  { min: 20, max: 23, options: ['RORO', 'LOLO'], defaultMethod: 'RORO' },
  { min: 24, max: 26, options: ['RORO', 'LOLO'], defaultMethod: 'RORO' },
  { min: 28, max: 33, options: ['RORO', 'LOLO'], defaultMethod: 'RORO' },
  { min: 35, max: 38, options: ['RORO', 'LOLO'], defaultMethod: 'RORO' },
  { min: 44, max: 50, options: ['RORO', 'LOLO'], defaultMethod: 'RORO' },
];

const FALLBACK_POLICY: ShipmentPolicyByTonnage = {
  options: ['1X40', '1X20', 'RORO', 'LOLO'],
  defaultMethod: '1X40',
};

const RANGE_EPSILON = 0.15;

const parseNumericToken = (value: string): number | null => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractRangeFromLabel = (label: string | null | undefined): { min: number | null; max: number | null } => {
  if (!label) return { min: null, max: null };
  const matches = label.match(/\d+(?:[.,]\d+)?/g) || [];
  const [first = '', second = ''] = matches;
  if (matches.length === 0) return { min: null, max: null };
  if (matches.length === 1) {
    const single = parseNumericToken(first);
    return { min: single, max: single };
  }
  const min = parseNumericToken(first);
  const max = parseNumericToken(second);
  return { min, max };
};

const resolveRange = (context: TonnageContext): { min: number | null; max: number | null } => {
  if (context === null || context === undefined) return { min: null, max: null };

  if (typeof context === 'number') {
    return Number.isFinite(context) ? { min: context, max: context } : { min: null, max: null };
  }

  if (typeof context === 'string') {
    return extractRangeFromLabel(context);
  }

  const minFromContext =
    typeof context.tonnageMin === 'number' && Number.isFinite(context.tonnageMin)
      ? context.tonnageMin
      : null;
  const maxFromContext =
    typeof context.tonnageMax === 'number' && Number.isFinite(context.tonnageMax)
      ? context.tonnageMax
      : null;

  if (minFromContext !== null || maxFromContext !== null) {
    return {
      min: minFromContext ?? maxFromContext,
      max: maxFromContext ?? minFromContext,
    };
  }

  return extractRangeFromLabel(context.tonnageLabel);
};

const isClose = (a: number, b: number) => Math.abs(a - b) <= RANGE_EPSILON;

export const getShipmentPolicyByTonnage = (context: TonnageContext): ShipmentPolicyByTonnage => {
  const resolved = resolveRange(context);
  if (resolved.min === null || resolved.max === null) return FALLBACK_POLICY;

  const min = Math.min(resolved.min, resolved.max);
  const max = Math.max(resolved.min, resolved.max);

  const rule = SHIPMENT_POLICY_RULES.find(
    (item) => isClose(min, item.min) && isClose(max, item.max)
  );

  return rule ?? FALLBACK_POLICY;
};

export const normalizeShipmentMethod = (
  value: string | null | undefined
): SupportedShipmentMethod | null => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === '1X40' || normalized === '1X20' || normalized === 'RORO' || normalized === 'LOLO') {
    return normalized;
  }
  return null;
};
