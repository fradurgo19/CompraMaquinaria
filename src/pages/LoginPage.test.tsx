import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import * as AuthContext from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('LoginPage', () => {
  it('renders login form with email and password inputs', () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    } as any);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText('usuario@partequipos.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument();
  });

  it('calls signIn on form submit with email and password', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue(undefined);
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      signIn,
      signOut: vi.fn(),
    } as any);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('usuario@partequipos.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    expect(signIn).toHaveBeenCalledWith('test@test.com', 'password123');
  });

  it('shows error message when signIn fails', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockRejectedValue(new Error('Credenciales inválidas'));
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      signIn,
      signOut: vi.fn(),
    } as any);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('usuario@partequipos.com'), 'bad@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    await vi.waitFor(() => {
      expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
    });
  });
});
