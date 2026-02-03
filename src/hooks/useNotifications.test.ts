import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNotifications } from './useNotifications';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiGet).mockResolvedValue([]);
  });

  it('refresh fetches notifications and unread count', async () => {
    vi.mocked(api.apiGet).mockImplementation((url: string) => {
      if (url.includes('unread-count')) return Promise.resolve({ count: 2 } as any);
      if (url.includes('by-module')) return Promise.resolve([] as any);
      return Promise.resolve([{ id: '1', title: 'Test', is_read: false }] as any);
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(2);
  });

  it('with moduleFilter passes module in refresh', async () => {
    vi.mocked(api.apiGet).mockImplementation((url: string) => {
      if (url.includes('unread-count')) return Promise.resolve({ count: 0 } as any);
      if (url.includes('by-module')) return Promise.resolve([] as any);
      return Promise.resolve([] as any);
    });

    const { result } = renderHook(() => useNotifications('SUBASTA'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.apiGet).toHaveBeenCalledWith(expect.stringContaining('module=SUBASTA'));
  });

  it('markAsRead calls apiPut', async () => {
    vi.mocked(api.apiGet).mockImplementation((url: string) => {
      if (url.includes('unread-count')) return Promise.resolve({ count: 0 } as any);
      if (url.includes('by-module')) return Promise.resolve([] as any);
      return Promise.resolve([] as any);
    });
    vi.mocked(api.apiPut).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.markAsRead('n1');
    expect(api.apiPut).toHaveBeenCalledWith('/api/notifications/n1/read', {});
  });
});
