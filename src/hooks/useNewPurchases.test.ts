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

  it('createNewPurchase calls apiPost and refetches', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);
    const created = { purchases: [], count: 0, pdf_path: null };
    vi.mocked(api.apiPost).mockResolvedValue(created as any);

    const { result } = renderHook(() => useNewPurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const out = await result.current.createNewPurchase({});
    expect(out).toEqual(created);
    expect(api.apiPost).toHaveBeenCalledWith('/api/new-purchases', {});
    expect(api.apiGet).toHaveBeenCalledTimes(2);
  });

  it('updateNewPurchase calls apiPut and refetches', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiPut).mockResolvedValue({ id: '1', invoice_number: 'INV-1' } as any);

    const { result } = renderHook(() => useNewPurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.updateNewPurchase('1', { invoice_number: 'INV-1' });
    expect(api.apiPut).toHaveBeenCalledWith('/api/new-purchases/1', { invoice_number: 'INV-1' });
    expect(api.apiGet).toHaveBeenCalledTimes(2);
  });

  it('deleteNewPurchase calls apiDelete and refetches', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiDelete).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useNewPurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.deleteNewPurchase('1');
    expect(api.apiDelete).toHaveBeenCalledWith('/api/new-purchases/1');
    expect(api.apiGet).toHaveBeenCalledTimes(2);
  });

  it('createNewPurchase throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);
    vi.mocked(api.apiPost).mockRejectedValue(new Error('Create failed'));

    const { result } = renderHook(() => useNewPurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.createNewPurchase({})).rejects.toThrow('Create failed');
  });

  it('updateNewPurchase throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiPut).mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useNewPurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.updateNewPurchase('1', {})).rejects.toThrow('Update failed');
  });

  it('deleteNewPurchase throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiDelete).mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => useNewPurchases());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.deleteNewPurchase('1')).rejects.toThrow('Delete failed');
  });
});
