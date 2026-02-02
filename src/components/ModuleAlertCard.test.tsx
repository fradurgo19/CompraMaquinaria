import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ModuleAlertCard } from './ModuleAlertCard';

const mockNotifications = [
  {
    id: '1',
    title: 'Alert 1',
    message: 'Message 1',
    type: 'urgent',
    is_read: false,
    created_at: new Date().toISOString(),
    action_url: '/some-path',
  },
];

describe('ModuleAlertCard', () => {
  it('returns null when notifications array is empty', () => {
    const { container } = render(
      <MemoryRouter>
        <ModuleAlertCard
          notifications={[]}
          onMarkAsRead={vi.fn()}
          onOpenCenter={vi.fn()}
          onDismiss={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders alert count and calls onDismiss when dismiss clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <MemoryRouter>
        <ModuleAlertCard
          notifications={mockNotifications}
          onMarkAsRead={vi.fn()}
          onOpenCenter={vi.fn()}
          onDismiss={onDismiss}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/1 Nueva Alerta/)).toBeInTheDocument();
    const dismissBtn = screen.getByTitle('Ocultar alertas');
    await user.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onMarkAsRead when notification is clicked', async () => {
    const user = userEvent.setup();
    const onMarkAsRead = vi.fn();
    render(
      <MemoryRouter>
        <ModuleAlertCard
          notifications={mockNotifications}
          onMarkAsRead={onMarkAsRead}
          onOpenCenter={vi.fn()}
          onDismiss={vi.fn()}
        />
      </MemoryRouter>
    );
    const alertTitle = screen.getByText('Alert 1');
    await user.click(alertTitle);
    expect(onMarkAsRead).toHaveBeenCalledWith('1');
  });
});
