import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';

const TestConsumer = () => {
  const { user, loading, signIn, signOut } = useAuth();
  if (loading) return <span>Loading</span>;
  return (
    <div>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <button onClick={() => signIn('test@test.com', 'pass')}>Sign In</button>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
};

describe('AuthContext', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = originalFetch;
  });

  it('useAuth throws when used outside AuthProvider', () => {
    const ConsoleSpy = () => {
      useAuth();
      return null;
    };
    const originalError = console.error;
    console.error = vi.fn();
    expect(() => render(<ConsoleSpy />)).toThrow('useAuth must be used within AuthProvider');
    console.error = originalError;
  });

  it('AuthProvider renders children and provides user state when no token', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await vi.waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('none');
    });
  });

  it('signOut clears user and token', async () => {
    const user = userEvent.setup();
    localStorage.setItem('token', 'fake-token');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: '1', email: 'u@u.com', full_name: 'U', role: 'admin' } }),
    });
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await vi.waitFor(() => {
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    });
    const signOutBtn = screen.getByText('Sign Out');
    await user.click(signOutBtn);
    await vi.waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  it('signIn calls fetch and stores token on success', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          token: 'new-token',
          user: { id: '1', email: 'test@test.com', full_name: 'Test', role: 'admin' },
        }),
      });
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await vi.waitFor(() => {
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    });
    await user.click(screen.getByText('Sign In'));
    await vi.waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@test.com', password: 'pass' }),
        })
      );
    });
    expect(localStorage.getItem('token')).toBe('new-token');
  });
});
