import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, apiPost, apiPut, apiDelete, apiRequest } from './api';

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'fake-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
    vi.clearAllMocks();
  });

  describe('apiGet', () => {
    it('returns json when response ok', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 1 }),
      });

      const result = await apiGet<{ data: number }>('/api/test');
      expect(result).toEqual({ data: 1 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-token',
          }),
        })
      );
    });

    it('throws on 401 and removes token', async () => {
      const removeItem = vi.fn();
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => 'token'),
        setItem: vi.fn(),
        removeItem,
      });
      Object.defineProperty(window, 'location', {
        value: { pathname: '/dashboard' },
        writable: true,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({}),
      });

      await expect(apiGet('/api/test')).rejects.toThrow('Sesión expirada');
      expect(removeItem).toHaveBeenCalledWith('token');
    });

    it('throws on 403 with message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: 'Forbidden action' }),
      });

      await expect(apiGet('/api/test')).rejects.toThrow();
    });
  });

  describe('apiPost', () => {
    it('sends body and returns json when ok', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '1' }),
      });

      const result = await apiPost<{ id: string }>('/api/create', { name: 'Test' });
      expect(result).toEqual({ id: '1' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
        })
      );
    });
  });

  describe('apiPut', () => {
    it('sends body and returns json when ok', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '1', name: 'Updated' }),
      });

      const result = await apiPut<{ id: string; name: string }>('/api/1', { name: 'Updated' });
      expect(result).toEqual({ id: '1', name: 'Updated' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' }),
        })
      );
    });

    it('throws with error message when not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid data' }),
      });

      await expect(apiPut('/api/1', {})).rejects.toThrow('Invalid data');
    });
  });

  describe('apiDelete', () => {
    it('resolves when ok', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(undefined),
      });

      await apiDelete('/api/1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('throws when not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.reject(new Error('parse error')),
      });

      await expect(apiDelete('/api/1')).rejects.toThrow('Not Found');
    });
  });

  describe('apiRequest', () => {
    it('does not add Authorization when no token', async () => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiRequest('/api/test');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({ Authorization: expect.anything() }),
        })
      );
    });

    it('throws user-friendly message on AbortError', async () => {
      mockFetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

      await expect(apiRequest('/api/test')).rejects.toThrow('tardó demasiado');
    });

    it('throws user-friendly message on Failed to fetch', async () => {
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      await expect(apiRequest('/api/test')).rejects.toThrow('conexión');
    });
  });
});
