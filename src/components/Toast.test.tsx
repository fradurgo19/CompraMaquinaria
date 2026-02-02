import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { ToastContainer, showSuccess, showError, showWarning, showInfo, showLoading, dismissToast } from './Toast';

const { toastFn } = vi.hoisted(() => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  fn.loading = vi.fn();
  fn.dismiss = vi.fn();
  return { toastFn: fn };
});

vi.mock('react-hot-toast', () => ({
  Toaster: () => createElement('div', { 'data-testid': 'toaster' }, 'Toaster'),
  default: toastFn,
}));

describe('Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ToastContainer renders Toaster', () => {
    const { getByTestId } = render(<ToastContainer />);
    expect(getByTestId('toaster')).toBeInTheDocument();
  });

  it('showSuccess calls toast.success', () => {
    showSuccess('Done');
    expect(toastFn.success).toHaveBeenCalledWith('Done');
  });

  it('showError calls toast.error', () => {
    showError('Failed');
    expect(toastFn.error).toHaveBeenCalledWith('Failed');
  });

  it('showWarning calls toast with options', () => {
    showWarning('Warning');
    expect(toastFn).toHaveBeenCalledWith('Warning', expect.any(Object));
  });

  it('showInfo calls toast with options', () => {
    showInfo('Info');
    expect(toastFn).toHaveBeenCalledWith('Info', expect.any(Object));
  });

  it('showLoading calls toast.loading', () => {
    showLoading('Loading...');
    expect(toastFn.loading).toHaveBeenCalledWith('Loading...');
  });

  it('dismissToast calls toast.dismiss', () => {
    dismissToast('id-1');
    expect(toastFn.dismiss).toHaveBeenCalledWith('id-1');
  });
});
