import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart3 } from 'lucide-react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders title and value', () => {
    render(
      <StatCard title="Total" value={100} icon={BarChart3} />
    );
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('shows trend when provided', () => {
    render(
      <StatCard
        title="Sales"
        value={50}
        icon={BarChart3}
        trend={{ value: 10, isPositive: true }}
      />
    );
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('shows negative trend', () => {
    render(
      <StatCard
        title="Sales"
        value={50}
        icon={BarChart3}
        trend={{ value: -5, isPositive: false }}
      />
    );
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading is true', () => {
    render(
      <StatCard title="Loading" value={0} icon={BarChart3} loading />
    );
    expect(screen.getByText('Loading')).toBeInTheDocument();
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('applies color variant', () => {
    const { container } = render(
      <StatCard title="Green" value={1} icon={BarChart3} color="green" />
    );
    expect(container.querySelector('.from-green-500')).toBeInTheDocument();
  });
});
