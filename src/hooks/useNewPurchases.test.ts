import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNewPurchases } from './useNewPurchases';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('../components/Toast', () => ({
  showError: vi.fn(),
}));

describe('useNewPurchases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiGet).mockResolvedValue([]);
  });

  it('fetches new purchases on mount', async () => {
    const data = [{ id: '1' }];
    vi.mocked(api.apiGet).mockResolvedValue(data as any);

    const { result } = renderHook(() => useNewPurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.newPurchases).toEqual(data);
    expect(api.apiGet).toHaveBeenCalledWith('/api/new-purchases');
  });

  it('returns empty array on fetch error when no cache', async () => {
    vi.mocked(api.apiGet).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useNewPurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.newPurchases).toEqual([]);
  });

  it('refetch calls api again', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);

    const { result } = renderHook(() => useNewPurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.refetch(true);
    expect(api.apiGet).toHaveBeenCalledTimes(2);
  });
});
