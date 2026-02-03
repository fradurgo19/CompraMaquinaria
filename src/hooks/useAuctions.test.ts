import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuctions } from './useAuctions';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('useAuctions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiGet).mockResolvedValue([]);
  });

  it('fetches auctions on mount and maps records', async () => {
    const raw = [{ id: '1', auction_date: '2025-01-15', lot_number: 'L1', model: 'ZX200', serial: '123' }];
    vi.mocked(api.apiGet).mockResolvedValue(raw as any);

    const { result } = renderHook(() => useAuctions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.auctions).toHaveLength(1);
    expect(result.current.auctions[0].id).toBe('1');
    expect(result.current.auctions[0].lot_number).toBe('L1');
    expect(api.apiGet).toHaveBeenCalledWith('/api/auctions');
  });

  it('returns empty array on fetch error', async () => {
    vi.mocked(api.apiGet).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAuctions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.auctions).toEqual([]);
  });

  it('updateAuctionFields updates local state', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1', auction_date: '2025-01-15' }] as any);
    vi.mocked(api.apiPut).mockResolvedValue({ id: '1', auction_date: '2025-01-16' } as any);

    const { result } = renderHook(() => useAuctions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const updated = await result.current.updateAuctionFields('1', { auction_date: '2025-01-16' });
    expect(updated).toBeDefined();
    expect(api.apiPut).toHaveBeenCalledWith('/api/auctions/1', { auction_date: '2025-01-16' });
  });

  it('deleteAuction removes from list', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }, { id: '2' }] as any);
    vi.mocked(api.apiDelete).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useAuctions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.deleteAuction('1');

    await waitFor(() => {
      expect(result.current.auctions).toHaveLength(1);
      expect(result.current.auctions[0].id).toBe('2');
    });
  });

  it('refetch calls api again', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([]);

    const { result } = renderHook(() => useAuctions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.refetch();
    expect(api.apiGet).toHaveBeenCalledTimes(2);
  });

  it('updateAuctionFields throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiPut).mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useAuctions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.updateAuctionFields('1', { auction_date: '2025-01-16' })).rejects.toThrow('Update failed');
  });

  it('deleteAuction throws on api error', async () => {
    vi.mocked(api.apiGet).mockResolvedValue([{ id: '1' }] as any);
    vi.mocked(api.apiDelete).mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => useAuctions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.deleteAuction('1')).rejects.toThrow('Delete failed');
  });

  it('mapAuctionRecord handles date object and lot alias', async () => {
    const raw = [{
      id: '2',
      date: new Date('2025-02-20'),
      lot: 'L2',
      max_price: '1000',
      purchased_price: '500',
      model: 'PC200',
      serial: '456',
    }];
    vi.mocked(api.apiGet).mockResolvedValue(raw as any);

    const { result } = renderHook(() => useAuctions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.auctions[0].lot_number).toBe('L2');
    expect(result.current.auctions[0].max_price).toBe(1000);
    expect(result.current.auctions[0].purchased_price).toBe(500);
    expect(result.current.auctions[0].auction_date).toBe('2025-02-20');
  });
});
