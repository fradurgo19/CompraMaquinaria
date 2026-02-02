import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMachines } from './useMachines';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
}));

describe('useMachines', () => {
  beforeEach(() => {
    vi.mocked(api.apiGet).mockReset();
  });

  it('returns initial loading state then machines after fetch', async () => {
    const mockMachines = [{ id: 1, serial_number: 'ZX200-1', model: 'ZX200' }];
    vi.mocked(api.apiGet).mockResolvedValue(mockMachines as any);

    const { result } = renderHook(() => useMachines());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.machines).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.machines).toEqual(mockMachines);
    expect(api.apiGet).toHaveBeenCalledWith('/api/machines');
  });

  it('returns empty array on fetch error', async () => {
    vi.mocked(api.apiGet).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useMachines());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.machines).toEqual([]);
  });

  it('refetch calls api again', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);

    const { result } = renderHook(() => useMachines());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.refetch();
    expect(api.apiGet).toHaveBeenCalledTimes(2);
  });
});
