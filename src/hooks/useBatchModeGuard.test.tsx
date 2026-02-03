import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useBatchModeGuard } from './useBatchModeGuard';

const mockShowError = vi.fn();
vi.mock('../components/Toast', () => ({
  showError: (...args: unknown[]) => mockShowError(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: { custom: vi.fn() },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
);

describe('useBatchModeGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not add beforeunload when no pending changes', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(
      () =>
        useBatchModeGuard({
          batchModeEnabled: false,
          pendingBatchChanges: { size: 0 },
        }),
      { wrapper }
    );

    const beforeunloadCalls = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload');
    expect(beforeunloadCalls.length).toBe(0);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('adds beforeunload when there are pending changes', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(
      () =>
        useBatchModeGuard({
          batchModeEnabled: true,
          pendingBatchChanges: { size: 2 },
        }),
      { wrapper }
    );

    const beforeunloadCalls = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload');
    expect(beforeunloadCalls.length).toBe(1);
    expect(beforeunloadCalls[0][0]).toBe('beforeunload');

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('uses customMessage when provided', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    renderHook(
      () =>
        useBatchModeGuard({
          batchModeEnabled: true,
          pendingBatchChanges: { size: 1 },
          customMessage: 'Mensaje personalizado',
        }),
      { wrapper }
    );

    const beforeunloadCalls = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload');
    expect(beforeunloadCalls.length).toBe(1);
    const handler = beforeunloadCalls[0][1] as (e: BeforeUnloadEvent) => string;
    const e = { preventDefault: vi.fn(), returnValue: '' } as unknown as BeforeUnloadEvent;
    const ret = handler(e);
    expect(ret).toContain('Mensaje personalizado');

    addSpy.mockRestore();
  });
});
