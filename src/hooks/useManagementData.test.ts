import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useManagementData } from './useManagementData';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
}));

describe('useManagementData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiGet).mockResolvedValue([]);
  });

  it('fetches management data on mount', async () => {
    const data = [{ id: '1' }];
    vi.mocked(api.apiGet).mockResolvedValue(data as any);

    const { result } = renderHook(() => useManagementData());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.managementData).toEqual(data);
    expect(api.apiGet).toHaveBeenCalledWith('/api/management');
  });

  it('returns empty array on fetch error', async () => {
    vi.mocked(api.apiGet).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useManagementData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.managementData).toEqual([]);
  });

  it('refetch calls api again', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);

    const { result } = renderHook(() => useManagementData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.refetch();
    expect(api.apiGet).toHaveBeenCalledTimes(2);
  });
});
