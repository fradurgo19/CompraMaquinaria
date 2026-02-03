import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoLogout } from './useAutoLogout';
import * as AuthContext from '../context/AuthContext';

const mockSignOut = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('useAutoLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: '1', email: 'test@test.com' },
      signOut: mockSignOut,
    } as any);
    vi.useFakeTimers();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call signOut when user is null', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      signOut: mockSignOut,
    } as any);

    renderHook(() => useAutoLogout());

    vi.advanceTimersByTime(31 * 60 * 1000);

    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('calls signOut after inactivity timeout when user is set', () => {
    renderHook(() => useAutoLogout());

    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(mockSignOut).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('resets timer on user activity', () => {
    renderHook(() => useAutoLogout());

    vi.advanceTimersByTime(15 * 60 * 1000);
    document.dispatchEvent(new Event('mousedown'));
    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(mockSignOut).not.toHaveBeenCalled();

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(mockSignOut).toHaveBeenCalled();
  });
});
