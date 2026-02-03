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
});
