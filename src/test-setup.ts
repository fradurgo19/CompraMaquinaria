import { afterAll, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterAll(() => {
  vi.useRealTimers();
  vi.clearAllTimers();
});
