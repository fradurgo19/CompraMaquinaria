import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('theme', () => {
  it('has colors.primary and colors.secondary', () => {
    expect(theme.colors.primary).toBeDefined();
    expect(theme.colors.primary[500]).toBeDefined();
    expect(theme.colors.secondary).toBeDefined();
    expect(theme.colors.secondary[500]).toBeDefined();
  });

  it('has success, warning, error and gray', () => {
    expect(theme.colors.success).toBeDefined();
    expect(theme.colors.warning).toBeDefined();
    expect(theme.colors.error).toBeDefined();
    expect(theme.colors.gray).toBeDefined();
  });

  it('has shadows and borderRadius', () => {
    expect(theme.shadows).toBeDefined();
    expect(theme.shadows.sm).toBeDefined();
    expect(theme.borderRadius).toBeDefined();
    expect(theme.borderRadius.DEFAULT).toBeDefined();
  });

  it('has transitions', () => {
    expect(theme.transitions).toBeDefined();
    expect(theme.transitions.DEFAULT).toBeDefined();
  });
});
