import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCostItems, useCostsSummary, useTotalCostsByType } from './useCostItems';
import * as costItemsService from '../services/costItems.service';

vi.mock('../services/costItems.service', () => ({
  getCostItemsByPurchaseId: vi.fn(),
  createCostItem: vi.fn(),
  updateCostItem: vi.fn(),
  deleteCostItem: vi.fn(),
  createMultipleCostItems: vi.fn(),
  getCostsSummary: vi.fn(),
  getTotalCostsByType: vi.fn(),
}));

describe('useCostItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(costItemsService.getCostItemsByPurchaseId).mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('returns initial state and fetches when purchaseId is set', async () => {
    const items = [{ id: '1', type: 'INLAND', amount: 100 }];
    vi.mocked(costItemsService.getCostItemsByPurchaseId).mockResolvedValue({
      data: items,
      error: null,
    });

    const { result } = renderHook(() => useCostItems('purchase-1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.costItems).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.costItems).toEqual(items);
    expect(costItemsService.getCostItemsByPurchaseId).toHaveBeenCalledWith('purchase-1');
  });

  it('returns empty costItems when purchaseId is null', async () => {
    vi.mocked(costItemsService.getCostItemsByPurchaseId).mockClear();
    const { result } = renderHook(() => useCostItems(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.costItems).toEqual([]);
    expect(costItemsService.getCostItemsByPurchaseId).not.toHaveBeenCalled();
  });

  it('createCostItem refetches and returns success', async () => {
    vi.mocked(costItemsService.getCostItemsByPurchaseId).mockResolvedValue({
      data: [],
      error: null,
    });
    vi.mocked(costItemsService.createCostItem).mockResolvedValue({
      data: { id: '1', type: 'INLAND', amount: 50 },
      error: null,
    });

    const { result } = renderHook(() => useCostItems('p1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const createResult = await result.current.createCostItem({
      purchase_id: 'p1',
      type: 'INLAND',
      amount: 50,
    });

    expect(createResult.success).toBe(true);
    expect(createResult.data).toEqual({ id: '1', type: 'INLAND', amount: 50 });
  });
});

describe('useCostsSummary', () => {
  beforeEach(() => {
    vi.mocked(costItemsService.getCostsSummary).mockResolvedValue({
      summary: [],
      total: 0,
    });
  });

  it('fetches summary when purchaseId is set', async () => {
    vi.mocked(costItemsService.getCostsSummary).mockResolvedValue({
      summary: [{ type: 'INLAND', amount: 100 }],
      total: 100,
    });

    const { result } = renderHook(() => useCostsSummary('p1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.total).toBe(100);
    expect(result.current.summary).toHaveLength(1);
  });

  it('returns null summary when purchaseId is null', async () => {
    const { result } = renderHook(() => useCostsSummary(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.total).toBe(0);
  });
});

describe('useTotalCostsByType', () => {
  beforeEach(() => {
    vi.mocked(costItemsService.getTotalCostsByType).mockResolvedValue({
      inland: 0,
      gastos_pto: 0,
      flete: 0,
      trasld: 0,
      repuestos: 0,
      mant_ejec: 0,
      total: 0,
    });
  });

  it('fetches totals when purchaseId is set', async () => {
    vi.mocked(costItemsService.getTotalCostsByType).mockResolvedValue({
      inland: 100,
      gastos_pto: 0,
      flete: 200,
      trasld: 0,
      repuestos: 0,
      mant_ejec: 0,
      total: 300,
    });

    const { result } = renderHook(() => useTotalCostsByType('p1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totals.total).toBe(300);
    expect(result.current.totals.inland).toBe(100);
    expect(result.current.totals.flete).toBe(200);
  });
});
