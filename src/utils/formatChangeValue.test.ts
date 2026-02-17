import { describe, it, expect } from 'vitest';
import { formatChangeValue } from './formatChangeValue';

describe('formatChangeValue', () => {
  it('returns "Sin valor" for null and undefined', () => {
    expect(formatChangeValue(null)).toBe('Sin valor');
    expect(formatChangeValue(undefined)).toBe('Sin valor');
  });

  it('returns "Sin valor" for empty string', () => {
    expect(formatChangeValue('')).toBe('Sin valor');
  });

  it('formats booleans as Sí/No', () => {
    expect(formatChangeValue(true)).toBe('Sí');
    expect(formatChangeValue(false)).toBe('No');
  });

  it('formats numbers with es-CO locale', () => {
    expect(formatChangeValue(1234567)).toBe('1.234.567');
    expect(formatChangeValue(1234.56)).toBe('1.234,56');
    expect(formatChangeValue(0)).toBe('0');
  });

  it('returns "Sin valor" for NaN', () => {
    expect(formatChangeValue(Number.NaN)).toBe('Sin valor');
  });

  it('parses string with thousand dots (es-CO format)', () => {
    expect(formatChangeValue('1.234.567')).toBe('1.234.567');
    expect(formatChangeValue('1.234.567,89')).toBe('1.234.567,89');
  });

  it('parses simple numeric string', () => {
    expect(formatChangeValue('1234567')).toBe('1.234.567');
    expect(formatChangeValue('1234,56')).toBe('1.234,56');
  });

  it('returns string as-is when not numeric', () => {
    expect(formatChangeValue('Texto')).toBe('Texto');
    expect(formatChangeValue('ABC-123')).toBe('ABC-123');
  });

  it('trims whitespace before processing', () => {
    expect(formatChangeValue('  1234  ')).toBe('1.234');
  });

  it('formats date-only values without timezone drift', () => {
    expect(formatChangeValue('2026-02-26')).toBe('26/02/2026');
    expect(formatChangeValue('2026-02-27')).toBe('27/02/2026');
  });

  it('formats date-time values using literal date part (no timezone shift)', () => {
    expect(formatChangeValue('2026-02-26T00:00:00.000Z')).toBe('26/02/2026');
    expect(formatChangeValue('2026-02-27T00:00:00+00:00')).toBe('27/02/2026');
    expect(formatChangeValue('2026-02-27 00:00:00+00')).toBe('27/02/2026');
  });

  it('keeps invalid dates as raw text', () => {
    expect(formatChangeValue('2026-02-31')).toBe('2026-02-31');
  });
});
