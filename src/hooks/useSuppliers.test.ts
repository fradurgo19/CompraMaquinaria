import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSuppliers } from './useSuppliers';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
}));

describe('useSuppliers', () => {
  beforeEach(() => {
    vi.mocked(api.apiGet).mockReset();
  });

  it('returns initial loading state then suppliers after fetch', async () => {
    const mockSuppliers = [{ id: 1, name: 'Supplier A', contact_email: 'a@a.com' }];
    vi.mocked(api.apiGet).mockResolvedValue(mockSuppliers as any);

    const { result } = renderHook(() => useSuppliers());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.suppliers).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suppliers).toEqual(mockSuppliers);
    expect(api.apiGet).toHaveBeenCalledWith('/api/suppliers');
  });

  it('returns empty array on fetch error', async () => {
    vi.mocked(api.apiGet).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSuppliers());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suppliers).toEqual([]);
  });

  it('refetch calls api again', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);

    const { result } = renderHook(() => useSuppliers());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.refetch();
    expect(api.apiGet).toHaveBeenCalledTimes(2);
  });
});
