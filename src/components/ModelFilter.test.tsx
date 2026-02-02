import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelFilter } from './ModelFilter';

describe('ModelFilter', () => {
  it('shows "Todos" when no model selected', () => {
    render(
      <ModelFilter
        uniqueModels={['ZX200', 'ZX135']}
        modelFilter={[]}
        setModelFilter={vi.fn()}
      />
    );
    expect(screen.getByText('Todos')).toBeInTheDocument();
  });

  it('shows count when models selected', () => {
    render(
      <ModelFilter
        uniqueModels={['ZX200', 'ZX135']}
        modelFilter={['ZX200']}
        setModelFilter={vi.fn()}
      />
    );
    expect(screen.getByText('1 seleccionado(s)')).toBeInTheDocument();
  });

  it('opens dropdown and shows models on button click', async () => {
    const user = userEvent.setup();
    render(
      <ModelFilter
        uniqueModels={['ZX200', 'ZX135']}
        modelFilter={[]}
        setModelFilter={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('ZX200')).toBeInTheDocument();
    expect(screen.getByText('ZX135')).toBeInTheDocument();
  });

  it('calls setModelFilter when model is toggled', async () => {
    const user = userEvent.setup();
    const setModelFilter = vi.fn();
    render(
      <ModelFilter
        uniqueModels={['ZX200']}
        modelFilter={[]}
        setModelFilter={setModelFilter}
      />
    );
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('checkbox'));
    expect(setModelFilter).toHaveBeenCalled();
  });

  it('shows Limpiar and calls setModelFilter with [] when clear clicked', async () => {
    const user = userEvent.setup();
    const setModelFilter = vi.fn();
    render(
      <ModelFilter
        uniqueModels={['ZX200']}
        modelFilter={['ZX200']}
        setModelFilter={setModelFilter}
      />
    );
    await user.click(screen.getByRole('button'));
    const clearBtn = screen.getByText('Limpiar');
    await user.click(clearBtn);
    expect(setModelFilter).toHaveBeenCalledWith([]);
  });
});
