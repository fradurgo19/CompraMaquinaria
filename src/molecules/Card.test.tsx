import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Card title="Card title">Content</Card>);
    expect(screen.getByText('Card title')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <Card title="Title" actions={<button>Action</button>}>
        Content
      </Card>
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('does not render header when no title and no actions', () => {
    render(<Card>Only content</Card>);
    expect(screen.getByText('Only content')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
