import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';
import * as AuthContext from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/api', () => ({
  apiGet: vi.fn(() => Promise.resolve([])),
}));

describe('HomePage', () => {
  it('renders without crashing when user has profile', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: '1', email: 'u@u.com', full_name: 'User', role: 'admin' },
      userProfile: { id: '1', email: 'u@u.com', role: 'admin' } as any,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    } as any);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(screen.getByRole('heading', { name: /Panel de Control/i })).toBeInTheDocument();
    });
  });

  it('renders content for non-executive user', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: '1', email: 'u@u.com', full_name: 'User', role: 'eliana' },
      userProfile: { id: '1', email: 'u@u.com', role: 'eliana' } as any,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    } as any);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await vi.waitFor(() => {
      expect(screen.getByRole('heading', { name: /Panel de Logística Origen/i })).toBeInTheDocument();
    });
  });
});
