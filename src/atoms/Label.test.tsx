import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from './Label';

describe('Label', () => {
  it('renders children', () => {
    render(<Label>Field name</Label>);
    expect(screen.getByText('Field name')).toBeInTheDocument();
  });

  it('associates with htmlFor when provided', () => {
    render(<Label htmlFor="input-id">Email</Label>);
    const label = screen.getByText('Email');
    expect(label).toHaveAttribute('for', 'input-id');
  });

  it('shows required asterisk when required', () => {
    render(<Label required>Required field</Label>);
    expect(screen.getByText('Required field')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
