import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
];

describe('Select', () => {
  it('renders options', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('option', { name: 'Option A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option B' })).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Select label="Choose" options={options} />);
    expect(screen.getByText('Choose')).toBeInTheDocument();
  });

  it('shows error when error prop is set', () => {
    render(<Select options={options} error="Invalid" />);
    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });

  it('calls onChange when selection changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'b');
    expect(onChange).toHaveBeenCalled();
  });

  it('displays selected value', () => {
    render(<Select options={options} value="b" />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('b');
  });
});
