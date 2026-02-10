import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChangeDetection } from './useChangeDetection';

describe('useChangeDetection', { timeout: 8000 }, () => {
  it('returns no changes when original and current are equal', () => {
    const original = { name: 'A', value: 10 };
    const current = { name: 'A', value: 10 };
    const mappings = { name: 'Nombre', value: 'Valor' };

    const { result } = renderHook(() =>
      useChangeDetection(original, current, mappings)
    );

    expect(result.current.hasChanges).toBe(false);
    expect(result.current.changes).toHaveLength(0);
    expect(result.current.changeCount).toBe(0);
  });

  it('detects changes when values differ', () => {
    const original = { name: 'A', value: 10 };
    const current = { name: 'B', value: 20 };
    const mappings = { name: 'Nombre', value: 'Valor' };

    const { result } = renderHook(() =>
      useChangeDetection(original, current, mappings)
    );

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.changeCount).toBe(2);
    expect(result.current.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field_name: 'name', old_value: 'A', new_value: 'B' }),
        expect.objectContaining({ field_name: 'value', old_value: 10, new_value: 20 }),
      ])
    );
  });

  it('returns empty when original or current is null', () => {
    const mappings = { name: 'Nombre' };

    const { result } = renderHook(() =>
      useChangeDetection(null, { name: 'B' }, mappings)
    );

    expect(result.current.hasChanges).toBe(false);
    expect(result.current.changes).toHaveLength(0);
  });

  it('normalizes dates to YYYY-MM-DD for comparison', () => {
    const original = { date: '2025-01-15T00:00:00Z' };
    const current = { date: '2025-01-16' };
    const mappings = { date: 'Fecha' };

    const { result } = renderHook(() =>
      useChangeDetection(original, current, mappings)
    );

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.changes[0].old_value).toBe('2025-01-15');
    expect(result.current.changes[0].new_value).toBe('2025-01-16');
  });

  it('treats default values as null for specific fields', () => {
    const mappings = { wet_line: 'Línea húmeda', arm_type: 'Tipo brazo' };
    const original = { wet_line: 'No', arm_type: 'N/A' };
    const current = { wet_line: 'No', arm_type: 'n/a' };

    const { result } = renderHook(() =>
      useChangeDetection(original, current, mappings)
    );

    expect(result.current.hasChanges).toBe(false);
    expect(result.current.changes).toHaveLength(0);
  });

  it('normalizes numbers and treats 0 equal to 0.00', () => {
    const original = { value: 0 };
    const current = { value: '0.00' };
    const mappings = { value: 'Valor' };

    const { result } = renderHook(() =>
      useChangeDetection(original, current, mappings)
    );

    expect(result.current.hasChanges).toBe(false);
  });

  it('detects numeric change', () => {
    const original = { value: 10 };
    const current = { value: '20' };
    const mappings = { value: 'Valor' };

    const { result } = renderHook(() =>
      useChangeDetection(original, current, mappings)
    );

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.changes[0].old_value).toBe(10);
    expect(result.current.changes[0].new_value).toBe(20);
  });

  it('ignores case-insensitive string equality', () => {
    const original = { name: 'Hello' };
    const current = { name: 'HELLO' };
    const mappings = { name: 'Nombre' };

    const { result } = renderHook(() =>
      useChangeDetection(original, current, mappings)
    );

    expect(result.current.hasChanges).toBe(false);
  });

  it('returns empty when current is null', () => {
    const mappings = { name: 'Nombre' };
    const { result } = renderHook(() =>
      useChangeDetection({ name: 'A' }, null, mappings)
    );
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.changes).toHaveLength(0);
  });

  it('does not report change for currency fields when only format differs (same numeric value)', () => {
    const mappings = { exw_value_formatted: 'Valor + BP', fob_expenses: 'Gastos FOB' };
    const original = { exw_value_formatted: 5000000, fob_expenses: 475000 };
    const current = {
      exw_value_formatted: '¥5.000.000,00',
      fob_expenses: '¥475.000,00'
    };

    const { result } = renderHook(() =>
      useChangeDetection(original, current, mappings, {
        currencyFields: ['exw_value_formatted', 'fob_expenses']
      })
    );

    expect(result.current.hasChanges).toBe(false);
    expect(result.current.changes).toHaveLength(0);
  });

  it('reports change for currency fields when numeric value actually changes', () => {
    const mappings = { exw_value_formatted: 'Valor + BP' };
    const original = { exw_value_formatted: 5000000 };
    const current = { exw_value_formatted: '¥6.000.000,00' };

    const { result } = renderHook(() =>
      useChangeDetection(original, current, mappings, {
        currencyFields: ['exw_value_formatted']
      })
    );

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.changes).toHaveLength(1);
    expect(result.current.changes[0].old_value).toBe(5000000);
    expect(result.current.changes[0].new_value).toBe(6000000);
  });
});
