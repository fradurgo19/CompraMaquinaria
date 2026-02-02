import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('renders children', () => {
    render(<FilterBar><span>Filter content</span></FilterBar>);
    expect(screen.getByText('Filter content')).toBeInTheDocument();
  });

  it('has grid layout class', () => {
    const { container } = render(<FilterBar><div>Child</div></FilterBar>);
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
  });
});
