import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCostItemsByPurchaseId,
  getCostItemById,
  createCostItem,
  updateCostItem,
  deleteCostItem,
  getTotalCostsByType,
  getCostsSummary,
  getCostItemTypes,
  convertCurrency,
  createMultipleCostItems,
} from './costItems.service';

const mockResolved = { data: null as unknown, error: null as unknown };
const chain = {
  then(resolve: (v: typeof mockResolved) => void) {
    return Promise.resolve(mockResolved).then(resolve);
  },
  select: vi.fn(() => chain),
  eq: vi.fn(() => chain),
  order: vi.fn(() => chain),
  insert: vi.fn(() => chain),
  update: vi.fn(() => chain),
  delete: vi.fn(() => chain),
  single: vi.fn(() => Promise.resolve(mockResolved)),
};

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => chain),
  },
}));

describe('costItems.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolved.data = null;
    mockResolved.error = null;
  });

  describe('getCostItemsByPurchaseId', () => {
    it('returns data when successful', async () => {
      const items = [{ id: '1', type: 'INLAND', amount: 100 }];
      mockResolved.data = items;
      const result = await getCostItemsByPurchaseId('purchase-1');
      expect(result.data).toEqual(items);
      expect(result.error).toBeNull();
    });

    it('returns error when supabase fails', async () => {
      mockResolved.data = null;
      mockResolved.error = { message: 'DB error' };
      const result = await getCostItemsByPurchaseId('purchase-1');
      expect(result.data).toBeNull();
      expect(result.error).toBe('DB error');
    });
  });

  describe('getCostItemById', () => {
    it('returns item when found', async () => {
      const item = { id: '1', type: 'FLETE', amount: 200 };
      mockResolved.data = item;
      const result = await getCostItemById('1');
      expect(result.data).toEqual(item);
      expect(result.error).toBeNull();
    });

    it('returns error when not found', async () => {
      mockResolved.data = null;
      mockResolved.error = { message: 'Not found' };
      const result = await getCostItemById('1');
      expect(result.data).toBeNull();
      expect(result.error).toBe('Not found');
    });
  });

  describe('createCostItem', () => {
    it('creates and returns new item', async () => {
      const newItem = { id: '1', purchase_id: 'p1', type: 'INLAND', amount: 50 };
      mockResolved.data = newItem;
      const result = await createCostItem({
        purchase_id: 'p1',
        type: 'INLAND',
        amount: 50,
      });
      expect(result.data).toEqual(newItem);
      expect(result.error).toBeNull();
    });
  });

  describe('updateCostItem', () => {
    it('updates and returns item', async () => {
      const updated = { id: '1', amount: 75 };
      mockResolved.data = updated;
      const result = await updateCostItem('1', { amount: 75 });
      expect(result.data).toEqual(updated);
      expect(result.error).toBeNull();
    });
  });

  describe('deleteCostItem', () => {
    it('returns success when delete succeeds', async () => {
      mockResolved.error = null;
      const result = await deleteCostItem('1');
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns success false when delete fails', async () => {
      mockResolved.error = { message: 'FK violation' };
      const result = await deleteCostItem('1');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getTotalCostsByType', () => {
    it('returns zeros when no data', async () => {
      mockResolved.data = null;
      mockResolved.error = { message: 'err' };
      const result = await getTotalCostsByType('p1');
      expect(result.total).toBe(0);
      expect(result.inland).toBe(0);
    });

    it('aggregates by type correctly', async () => {
      mockResolved.data = [
        { type: 'INLAND', amount: 100 },
        { type: 'INLAND', amount: 50 },
        { type: 'FLETE', amount: 200 },
      ];
      mockResolved.error = null;
      const result = await getTotalCostsByType('p1');
      expect(result.inland).toBe(150);
      expect(result.flete).toBe(200);
      expect(result.total).toBe(350);
    });
  });

  describe('getCostsSummary', () => {
    it('returns summary and total', async () => {
      mockResolved.data = [
        { type: 'INLAND', amount: 100 },
        { type: 'FLETE', amount: 200 },
      ];
      mockResolved.error = null;
      const result = await getCostsSummary('p1');
      expect(result.total).toBe(300);
      expect(result.summary).toHaveLength(6);
      expect(result.summary.find((s) => s.type === 'INLAND')?.amount).toBe(100);
    });
  });

  describe('getCostItemTypes', () => {
    it('returns all cost item types', () => {
      const types = getCostItemTypes();
      expect(types).toHaveLength(6);
      expect(types.map((t) => t.value)).toContain('INLAND');
      expect(types.map((t) => t.value)).toContain('FLETE');
    });
  });

  describe('convertCurrency', () => {
    it('returns same amount when currencies match', () => {
      expect(convertCurrency(100, 'USD', 'USD', 1)).toBe(100);
    });

    it('converts using rate when currencies differ', () => {
      expect(convertCurrency(100, 'USD', 'COP', 4000)).toBe(400000);
    });
  });

  describe('createMultipleCostItems', () => {
    it('returns data when insert succeeds', async () => {
      const created = [{ id: '1' }, { id: '2' }];
      mockResolved.data = created;
      const result = await createMultipleCostItems([
        { purchase_id: 'p1', type: 'INLAND', amount: 10 },
        { purchase_id: 'p1', type: 'FLETE', amount: 20 },
      ]);
      expect(result.data).toEqual(created);
      expect(result.error).toBeNull();
    });
  });
});
