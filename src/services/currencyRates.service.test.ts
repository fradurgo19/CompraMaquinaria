import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCurrencyRates,
  getCurrencyRateById,
  getLatestRate,
  getRateByDate,
  upsertCurrencyRate,
  deleteCurrencyRate,
  getRateHistory,
  getAllRatesForDate,
  getCurrencyPairs,
  convertAmount,
  getAverageRate,
  importRatesFromAPI,
} from './currencyRates.service';

const mockResolved = { data: null as unknown, error: null as unknown };
const chain = {
  then(resolve: (v: typeof mockResolved) => void) {
    return Promise.resolve(mockResolved).then(resolve);
  },
  select: vi.fn(() => chain),
  eq: vi.fn(() => chain),
  order: vi.fn(() => chain),
  limit: vi.fn(() => chain),
  gte: vi.fn(() => chain),
  lte: vi.fn(() => chain),
  single: vi.fn(() => Promise.resolve(mockResolved)),
  upsert: vi.fn(() => chain),
  delete: vi.fn(() => chain),
};

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => chain),
  },
}));

describe('currencyRates.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolved.data = null;
    mockResolved.error = null;
  });

  describe('getCurrencyRates', () => {
    it('returns data when successful', async () => {
      const rates = [{ id: '1', pair: 'USD/COP', rate: 4000 }];
      mockResolved.data = rates;
      const result = await getCurrencyRates();
      expect(result.data).toEqual(rates);
      expect(result.error).toBeNull();
    });
  });

  describe('getCurrencyRateById', () => {
    it('returns rate when found', async () => {
      const rate = { id: '1', pair: 'USD/COP', rate: 4000 };
      mockResolved.data = rate;
      const result = await getCurrencyRateById('1');
      expect(result.data).toEqual(rate);
      expect(result.error).toBeNull();
    });
  });

  describe('getLatestRate', () => {
    it('returns latest rate for pair', async () => {
      mockResolved.data = { pair: 'USD/COP', rate: 4100 };
      const result = await getLatestRate('USD/COP');
      expect(result.data).toEqual({ pair: 'USD/COP', rate: 4100 });
      expect(result.error).toBeNull();
    });
  });

  describe('getRateByDate', () => {
    it('returns rate when found for date', async () => {
      mockResolved.data = { pair: 'USD/COP', date: '2025-01-15', rate: 4000 };
      const result = await getRateByDate('USD/COP', '2025-01-15');
      expect(result.data).toEqual({ pair: 'USD/COP', date: '2025-01-15', rate: 4000 });
      expect(result.error).toBeNull();
    });
  });

  describe('upsertCurrencyRate', () => {
    it('upserts and returns rate', async () => {
      mockResolved.data = { id: '1', pair: 'USD/COP', rate: 4000 };
      const result = await upsertCurrencyRate('USD/COP', '2025-01-01', 4000);
      expect(result.data).toEqual({ id: '1', pair: 'USD/COP', rate: 4000 });
      expect(result.error).toBeNull();
    });
  });

  describe('deleteCurrencyRate', () => {
    it('returns success when delete succeeds', async () => {
      mockResolved.error = null;
      const result = await deleteCurrencyRate('1');
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('getRateHistory', () => {
    it('returns history for date range', async () => {
      const history = [{ rate: 4000 }, { rate: 4100 }];
      mockResolved.data = history;
      const result = await getRateHistory('USD/COP', '2025-01-01', '2025-01-31');
      expect(result.data).toEqual(history);
      expect(result.error).toBeNull();
    });
  });

  describe('getAllRatesForDate', () => {
    it('returns all rates for date', async () => {
      mockResolved.data = [{ pair: 'USD/COP' }, { pair: 'USD/EUR' }];
      const result = await getAllRatesForDate('2025-01-15');
      expect(result.data).toHaveLength(2);
      expect(result.error).toBeNull();
    });
  });

  describe('getCurrencyPairs', () => {
    it('returns all currency pairs', () => {
      const pairs = getCurrencyPairs();
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs.map((p) => p.value)).toContain('USD/JPY');
      expect(pairs.map((p) => p.value)).toContain('USD/COP');
    });
  });

  describe('convertAmount', () => {
    it('returns same amount when from and to currency match', async () => {
      const result = await convertAmount(100, 'USD', 'USD');
      expect(result.amount).toBe(100);
      expect(result.rate).toBe(1);
      expect(result.error).toBeNull();
    });

    it('converts using rate when direct pair exists', async () => {
      mockResolved.data = { rate: 4000 };
      mockResolved.error = null;
      const result = await convertAmount(1, 'USD', 'COP');
      expect(result.amount).toBe(4000);
      expect(result.rate).toBe(4000);
      expect(result.error).toBeNull();
    });
  });

  describe('getAverageRate', () => {
    it('returns average and count from history', async () => {
      mockResolved.data = [{ rate: 4000 }, { rate: 4100 }];
      mockResolved.error = null;
      const result = await getAverageRate('USD/COP', '2025-01-01', '2025-01-31');
      expect(result.average).toBe(4050);
      expect(result.count).toBe(2);
      expect(result.error).toBeNull();
    });

    it('returns null average when no data', async () => {
      mockResolved.data = null;
      mockResolved.error = 'No data';
      const result = await getAverageRate('USD/COP', '2025-01-01', '2025-01-31');
      expect(result.average).toBeNull();
      expect(result.count).toBe(0);
      expect(result.error).toBeDefined();
    });
  });

  describe('importRatesFromAPI', () => {
    it('returns not implemented placeholder', async () => {
      const result = await importRatesFromAPI('2025-01-01');
      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
      expect(result.error).toContain('no implementada');
    });
  });
});
