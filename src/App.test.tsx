import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./hooks/useWebSocket', () => ({
  useWebSocket: () => ({ isConnected: false }),
}));

vi.mock('./hooks/useAutoLogout', () => ({
  useAutoLogout: () => {},
}));

describe('App', () => {
  it('renders login form when unauthenticated', () => {
    render(<App />);
    expect(screen.getByPlaceholderText('usuario@partequipos.com')).toBeInTheDocument();
  });
});
