import { describe, it, expect, vi } from 'vitest';
import {
  hasAnyActiveFilters,
  clearStringFilters,
  getUniqueSortedValues,
} from './filterHelpers';

describe('filterHelpers', () => {
  describe('hasAnyActiveFilters', () => {
    it('returns false when all values are empty', () => {
      expect(hasAnyActiveFilters(['', [], null, undefined])).toBe(false);
    });

    it('returns true when a string value is non-empty', () => {
      expect(hasAnyActiveFilters(['', 'foo'])).toBe(true);
    });

    it('returns true when an array has items', () => {
      expect(hasAnyActiveFilters([[], [1, 2]])).toBe(true);
    });

    it('returns false for empty array', () => {
      expect(hasAnyActiveFilters([])).toBe(false);
    });

    it('returns true for single truthy value', () => {
      expect(hasAnyActiveFilters(['x'])).toBe(true);
      expect(hasAnyActiveFilters([123])).toBe(true);
    });
  });

  describe('clearStringFilters', () => {
    it('calls each setter with empty string', () => {
      const setA = vi.fn();
      const setB = vi.fn();
      clearStringFilters(setA, setB);
      expect(setA).toHaveBeenCalledWith('');
      expect(setB).toHaveBeenCalledWith('');
    });

    it('calls single setter with empty string', () => {
      const setter = vi.fn();
      clearStringFilters(setter);
      expect(setter).toHaveBeenCalledTimes(1);
      expect(setter).toHaveBeenCalledWith('');
    });

    it('handles no setters', () => {
      expect(() => clearStringFilters()).not.toThrow();
    });
  });

  describe('getUniqueSortedValues', () => {
    it('returns unique values sorted by default (numbers)', () => {
      const items = [{ n: 3 }, { n: 1 }, { n: 2 }, { n: 1 }];
      expect(getUniqueSortedValues(items, (i) => i.n)).toEqual([1, 2, 3]);
    });

    it('returns unique string values sorted with locale', () => {
      const items = [{ s: 'c' }, { s: 'a' }, { s: 'b' }, { s: 'a' }];
      expect(getUniqueSortedValues(items, (i) => i.s)).toEqual(['a', 'b', 'c']);
    });

    it('filters out null/undefined from selector', () => {
      const items: { n: number | null }[] = [{ n: 1 }, { n: null }, { n: 2 }];
      expect(getUniqueSortedValues(items, (i) => i.n)).toEqual([1, 2]);
    });
  });
});
