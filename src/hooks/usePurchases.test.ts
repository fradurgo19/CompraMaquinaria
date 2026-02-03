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

  it('updatePurchaseFields with report field applies locally without refetch', async () => {
    const data = [{ id: '1', sales_reported: false }];
    vi.mocked(api.apiGet).mockResolvedValue(data as any);
    vi.mocked(api.apiPut).mockResolvedValue({ id: '1', sales_reported: true } as any);

    const { result } = renderHook(() => usePurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.updatePurchaseFields('1', { sales_reported: true });
    await waitFor(() => {
      expect(result.current.purchases[0].sales_reported).toBe(true);
    });
    expect(api.apiGet).toHaveBeenCalledTimes(1);
  });

  it('updatePurchaseFields with skipRefetch merges response and does not refetch', async () => {
    const data = [{ id: '1', invoice_number: 'INV-1' }];
    vi.mocked(api.apiGet).mockResolvedValue(data as any);
    vi.mocked(api.apiPut).mockResolvedValue({ id: '1', invoice_number: 'INV-2' } as any);

    const { result } = renderHook(() => usePurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.updatePurchaseFields('1', { invoice_number: 'INV-2' }, { skipRefetch: true });
    await waitFor(() => {
      expect(result.current.purchases[0].invoice_number).toBe('INV-2');
    });
    expect(api.apiGet).toHaveBeenCalledTimes(1);
  });

  it('updatePurchaseFields throws and refetches on api error', async () => {
    const data = [{ id: '1' }];
    vi.mocked(api.apiGet).mockResolvedValue(data as any);
    vi.mocked(api.apiPut).mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => usePurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.updatePurchaseFields('1', { invoice_number: 'X' })).rejects.toThrow('Update failed');
    await waitFor(() => {
      expect(api.apiGet).toHaveBeenCalledTimes(2);
    });
  });

  it('deletePurchase removes from list', async () => {
    const data = [{ id: '1' }, { id: '2' }];
    vi.mocked(api.apiGet).mockResolvedValue(data as any);
    vi.mocked(api.apiDelete).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => usePurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.deletePurchase('1');
    await waitFor(() => {
      expect(result.current.purchases).toHaveLength(1);
      expect(result.current.purchases[0].id).toBe('2');
    });
  });

  it('deletePurchase throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiDelete).mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => usePurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.deletePurchase('1')).rejects.toThrow('Delete failed');
  });
});
