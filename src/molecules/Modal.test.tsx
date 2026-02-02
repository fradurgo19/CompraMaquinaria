import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test">
        Content
      </Modal>
    );
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('renders title and children when isOpen is true', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Modal title">
        Modal content
      </Modal>
    );
    expect(screen.getByText('Modal title')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Test">
        Content
      </Modal>
    );
    const overlay = document.querySelector('.bg-gray-500');
    if (overlay) await user.click(overlay as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('applies size class for lg', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Test" size="lg">
        Content
      </Modal>
    );
    const panel = document.querySelector('.max-w-4xl');
    expect(panel).toBeInTheDocument();
  });
});
