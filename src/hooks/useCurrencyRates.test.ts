import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useCurrencyRates,
  useLatestRate,
  useRateByDate,
  useRateHistory,
  useCurrencyConverter,
} from './useCurrencyRates';
import * as currencyRatesService from '../services/currencyRates.service';

vi.mock('../services/currencyRates.service', () => ({
  getCurrencyRates: vi.fn(),
  getLatestRate: vi.fn(),
  getRateByDate: vi.fn(),
  getRateHistory: vi.fn(),
  upsertCurrencyRate: vi.fn(),
  deleteCurrencyRate: vi.fn(),
  convertAmount: vi.fn(),
}));

describe('useCurrencyRates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currencyRatesService.getCurrencyRates).mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('returns initial state and fetches rates on mount', async () => {
    const rates = [{ id: '1', pair: 'USD/COP', rate: 4000 }];
    vi.mocked(currencyRatesService.getCurrencyRates).mockResolvedValue({
      data: rates,
      error: null,
    });

    const { result } = renderHook(() => useCurrencyRates());

    expect(result.current.loading).toBe(true);
    expect(result.current.rates).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.rates).toEqual(rates);
    expect(currencyRatesService.getCurrencyRates).toHaveBeenCalled();
  });

  it('upsertRate refetches and returns success', async () => {
    vi.mocked(currencyRatesService.getCurrencyRates).mockResolvedValue({
      data: [],
      error: null,
    });
    vi.mocked(currencyRatesService.upsertCurrencyRate).mockResolvedValue({
      data: { id: '1', pair: 'USD/COP', rate: 4000 },
      error: null,
    });

    const { result } = renderHook(() => useCurrencyRates());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const upsertResult = await result.current.upsertRate(
      'USD/COP',
      '2025-01-01',
      4000
    );

    expect(upsertResult.success).toBe(true);
    expect(upsertResult.data).toEqual({ id: '1', pair: 'USD/COP', rate: 4000 });
  });
});

describe('useLatestRate', () => {
  beforeEach(() => {
    vi.mocked(currencyRatesService.getLatestRate).mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it('fetches rate when pair is set', async () => {
    vi.mocked(currencyRatesService.getLatestRate).mockResolvedValue({
      data: { pair: 'USD/COP', rate: 4000 },
      error: null,
    });

    const { result } = renderHook(() => useLatestRate('USD/COP'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.rate).toEqual({ pair: 'USD/COP', rate: 4000 });
  });

  it('returns null rate when pair is null', async () => {
    vi.mocked(currencyRatesService.getLatestRate).mockClear();
    const { result } = renderHook(() => useLatestRate(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.rate).toBeNull();
    expect(currencyRatesService.getLatestRate).not.toHaveBeenCalled();
  });
});

describe('useRateByDate', () => {
  beforeEach(() => {
    vi.mocked(currencyRatesService.getRateByDate).mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it('fetches rate when pair and date are set', async () => {
    vi.mocked(currencyRatesService.getRateByDate).mockResolvedValue({
      data: { pair: 'USD/COP', date: '2025-01-15', rate: 4000 },
      error: null,
    });

    const { result } = renderHook(() =>
      useRateByDate('USD/COP', '2025-01-15')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.rate).toEqual({
      pair: 'USD/COP',
      date: '2025-01-15',
      rate: 4000,
    });
  });
});

describe('useRateHistory', () => {
  beforeEach(() => {
    vi.mocked(currencyRatesService.getRateHistory).mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('fetches history when pair and dates are set', async () => {
    const history = [{ rate: 4000 }, { rate: 4100 }];
    vi.mocked(currencyRatesService.getRateHistory).mockResolvedValue({
      data: history,
      error: null,
    });

    const { result } = renderHook(() =>
      useRateHistory('USD/COP', '2025-01-01', '2025-01-31')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.history).toEqual(history);
  });
});

describe('useCurrencyConverter', () => {
  beforeEach(() => {
    vi.mocked(currencyRatesService.convertAmount).mockResolvedValue({
      amount: 0,
      rate: null,
      error: null,
    });
  });

  it('convert returns result from service', async () => {
    vi.mocked(currencyRatesService.convertAmount).mockResolvedValue({
      amount: 4000,
      rate: 4000,
      error: null,
    });

    const { result } = renderHook(() => useCurrencyConverter());

    const convertResult = await result.current.convert(1, 'USD', 'COP');

    expect(convertResult.amount).toBe(4000);
    expect(convertResult.rate).toBe(4000);
    expect(convertResult.error).toBeNull();
  });
});
