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

  it('updatePreselectionFields updates local state', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1', comments: 'old' }] as any);
    vi.mocked(api.apiPut).mockResolvedValue({ id: '1', comments: 'new' } as any);

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const updated = await result.current.updatePreselectionFields('1', { comments: 'new' });
    expect(updated.comments).toBe('new');
    await waitFor(() => {
      expect(result.current.preselections[0].comments).toBe('new');
    });
    expect(api.apiPut).toHaveBeenCalledWith('/api/preselections/1', { comments: 'new' });
  });

  it('deletePreselection removes from list', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }, { id: '2' }] as any);
    vi.mocked(api.apiDelete).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.deletePreselection('1');
    await waitFor(() => {
      expect(result.current.preselections).toHaveLength(1);
      expect(result.current.preselections[0].id).toBe('2');
    });
  });

  it('mutatePreselections updates state via updater', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.mutatePreselections(prev => [...prev, { id: '2' } as any]);
    await waitFor(() => {
      expect(result.current.preselections).toHaveLength(2);
      expect(result.current.preselections[1].id).toBe('2');
    });
  });

  it('updateDecision throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiPut).mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.updateDecision('1', 'NO')).rejects.toThrow('Update failed');
  });

  it('updatePreselectionFields throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiPut).mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.updatePreselectionFields('1', { comments: 'x' })).rejects.toThrow('Update failed');
  });

  it('createPreselection throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);
    vi.mocked(api.apiPost).mockRejectedValue(new Error('Create failed'));

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.createPreselection({})).rejects.toThrow('Create failed');
  });

  it('deletePreselection throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiDelete).mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => usePreselections());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.deletePreselection('1')).rejects.toThrow('Delete failed');
  });
});
