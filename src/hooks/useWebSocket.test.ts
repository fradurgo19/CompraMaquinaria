import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWebSocket } from './useWebSocket';
import * as AuthContext from '../context/AuthContext';

vi.mock('../components/Toast', () => ({
  showSuccess: vi.fn(),
  showInfo: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({ user: null } as any);
  });

  it('returns isConnected false when user is null', () => {
    const { result } = renderHook(() => useWebSocket());
    expect(result.current.isConnected).toBe(false);
  });

  it('disconnect does not throw when never connected', () => {
    const { result } = renderHook(() => useWebSocket());
    expect(() => result.current.disconnect()).not.toThrow();
  });

  it('reconnect (connect) does nothing when user is null', () => {
    const WebSocketSpy = vi.spyOn(global, 'WebSocket');
    const { result } = renderHook(() => useWebSocket());
    result.current.reconnect();
    expect(WebSocketSpy).not.toHaveBeenCalled();
    WebSocketSpy.mockRestore();
  });
});
