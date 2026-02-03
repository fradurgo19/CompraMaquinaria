import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePreselections } from './usePreselections';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('usePreselections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiGet).mockResolvedValue([]);
  });

  it('fetches preselections on mount', async () => {
    const data = [{ id: '1', decision: 'SI' }];
    vi.mocked(api.apiGet).mockResolvedValue(data as any);

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preselections).toEqual(data);
    expect(api.apiGet).toHaveBeenCalledWith('/api/preselections');
  });

  it('returns empty array on fetch error', async () => {
    vi.mocked(api.apiGet).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preselections).toEqual([]);
  });

  it('updateDecision updates local state', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1', decision: 'SI' }] as any);
    vi.mocked(api.apiPut).mockResolvedValue({} as any);

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.updateDecision('1', 'NO');

    await waitFor(() => {
      expect(result.current.preselections[0].decision).toBe('NO');
    });
    expect(api.apiPut).toHaveBeenCalledWith('/api/preselections/1/decision', { decision: 'NO' });
  });

  it('createPreselection prepends to list', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);
    const created = { id: '2', decision: 'SI' };
    vi.mocked(api.apiPost).mockResolvedValue(created as any);

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const out = await result.current.createPreselection({});
    expect(out).toEqual(created);

    await waitFor(() => {
      expect(result.current.preselections).toHaveLength(1);
      expect(result.current.preselections[0].id).toBe('2');
    });
  });
});
