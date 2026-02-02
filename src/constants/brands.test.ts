import { describe, it, expect } from 'vitest';
import { BRAND_OPTIONS } from './brands';

describe('brands', () => {
  it('exports BRAND_OPTIONS as non-empty array', () => {
    expect(Array.isArray(BRAND_OPTIONS)).toBe(true);
    expect(BRAND_OPTIONS.length).toBeGreaterThan(0);
  });

  it('includes expected brands', () => {
    expect(BRAND_OPTIONS).toContain('CASE');
    expect(BRAND_OPTIONS).toContain('HITACHI');
    expect(BRAND_OPTIONS).toContain('KOMATSU');
  });
});
