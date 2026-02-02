import { describe, it, expect } from 'vitest';
import { isModelForBrand, getModelsForBrand, getAllBrands } from './brandModelMapping';

describe('brandModelMapping', () => {
  describe('isModelForBrand', () => {
    it('returns false when model or brand is empty', () => {
      expect(isModelForBrand('', 'HITACHI')).toBe(false);
      expect(isModelForBrand('ZX200', '')).toBe(false);
      expect(isModelForBrand('', '')).toBe(false);
    });

    it('returns true for HITACHI when model starts with ZX', () => {
      expect(isModelForBrand('ZX200-6', 'HITACHI')).toBe(true);
      expect(isModelForBrand('zx135', 'hitachi')).toBe(true);
    });

    it('returns false for HITACHI when model does not start with ZX', () => {
      expect(isModelForBrand('SR200B', 'HITACHI')).toBe(false);
    });

    it('returns true for CASE when model is in CASE list', () => {
      expect(isModelForBrand('SR200B', 'CASE')).toBe(true);
      expect(isModelForBrand('580N', 'CASE')).toBe(true);
      expect(isModelForBrand('CX220C-8', 'case')).toBe(true);
    });

    it('returns true for LIUGONG when model starts with 9', () => {
      expect(isModelForBrand('909F', 'LIUGONG')).toBe(true);
      expect(isModelForBrand('915D', 'liugong')).toBe(true);
    });

    it('returns true for YANMAR when model starts with VI', () => {
      expect(isModelForBrand('VIOS', 'YANMAR')).toBe(true);
    });

    it('returns true for AMMANN when model starts with ARS or ASC', () => {
      expect(isModelForBrand('ARS200', 'AMMANN')).toBe(true);
      expect(isModelForBrand('ASC100', 'AMMANN')).toBe(true);
    });

    it('returns false for unknown brand', () => {
      expect(isModelForBrand('ZX200', 'UNKNOWN')).toBe(false);
    });
  });

  describe('getModelsForBrand', () => {
    it('returns allModels when brand is null/undefined', () => {
      const allModels = ['ZX200', 'SR200B'];
      expect(getModelsForBrand(null, {}, allModels)).toEqual(allModels);
      expect(getModelsForBrand(undefined, {}, allModels)).toEqual(allModels);
    });

    it('merges DB models and pattern-matched models without duplicates', () => {
      const brandModelMap: Record<string, string[]> = { HITACHI: ['ZX200-6'] };
      const allModels = ['ZX200-6', 'ZX135', 'SR200B'];
      const result = getModelsForBrand('HITACHI', brandModelMap, allModels);
      expect(result).toContain('ZX200-6');
      expect(result).toContain('ZX135');
      expect(result).not.toContain('SR200B');
      expect(result).toEqual([...new Set(result)].sort((a, b) => a.localeCompare(b)));
    });
  });

  describe('getAllBrands', () => {
    it('returns combined unique brands excluding MARCA', () => {
      const brandModelMap: Record<string, string[]> = { CASE: [], HITACHI: [] };
      const result = getAllBrands(brandModelMap);
      expect(result).toContain('CASE');
      expect(result).toContain('HITACHI');
      expect(result.every((b) => b.toUpperCase() !== 'MARCA')).toBe(true);
    });
  });
});
