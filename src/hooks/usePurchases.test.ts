import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePurchases } from './usePurchases';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('usePurchases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiGet).mockResolvedValue([]);
  });

  it('fetches purchases on mount', async () => {
    const data = [{ id: '1', invoice_number: 'INV-1' }];
    vi.mocked(api.apiGet).mockResolvedValue(data as any);

    const { result } = renderHook(() => usePurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.purchases).toEqual(data);
    expect(api.apiGet).toHaveBeenCalledWith('/api/purchases');
  });

  it('returns empty array on fetch error when no cache', async () => {
    vi.mocked(api.apiGet).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.purchases).toEqual([]);
  });

  it('refetch with forceRefresh calls api again', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);

    const { result } = renderHook(() => usePurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.refetch(true);
    expect(api.apiGet).toHaveBeenCalledTimes(2);
  });
});
