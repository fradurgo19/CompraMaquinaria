import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('applies size classes for sm', () => {
    render(<Spinner size="sm" />);
    const spinner = document.querySelector('.w-4.h-4');
    expect(spinner).toBeInTheDocument();
  });

  it('applies size classes for md (default)', () => {
    render(<Spinner />);
    const spinner = document.querySelector('.w-8.h-8');
    expect(spinner).toBeInTheDocument();
  });

  it('applies size classes for lg', () => {
    render(<Spinner size="lg" />);
    const spinner = document.querySelector('.w-12.h-12');
    expect(spinner).toBeInTheDocument();
  });
});
