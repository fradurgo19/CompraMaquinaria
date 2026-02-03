import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useShipping,
  useShippingByPurchase,
  useShipmentsInTransit,
  useDelayedShipments,
} from './useShipping';
import * as shippingService from '../services/shipping.service';

vi.mock('../services/shipping.service', () => ({
  getShippings: vi.fn(),
  getShippingByPurchaseId: vi.fn(),
  createShipping: vi.fn(),
  updateShipping: vi.fn(),
  deleteShipping: vi.fn(),
  getShipmentsInTransit: vi.fn(),
  getDelayedShipments: vi.fn(),
}));

describe('useShipping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shippingService.getShippings).mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('fetches shippings on mount', async () => {
    const list = [{ id: '1', purchase_id: 'p1' }];
    vi.mocked(shippingService.getShippings).mockResolvedValue({
      data: list,
      error: null,
    });

    const { result } = renderHook(() => useShipping());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shippings).toEqual(list);
    expect(shippingService.getShippings).toHaveBeenCalled();
  });

  it('createShipping refetches and returns success', async () => {
    vi.mocked(shippingService.getShippings).mockResolvedValue({
      data: [],
      error: null,
    });
    vi.mocked(shippingService.createShipping).mockResolvedValue({
      data: { id: '1', purchase_id: 'p1' },
      error: null,
    });

    const { result } = renderHook(() => useShipping());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const createResult = await result.current.createShipping({
      purchase_id: 'p1',
      carrier: 'DHL',
    });
    expect(createResult.success).toBe(true);
    expect(createResult.data).toEqual({ id: '1', purchase_id: 'p1' });
  });
});

describe('useShippingByPurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shippingService.getShippingByPurchaseId).mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it('fetches shipping when purchaseId is set', async () => {
    const shipping = { id: '1', purchase_id: 'p1' };
    vi.mocked(shippingService.getShippingByPurchaseId).mockResolvedValue({
      data: shipping,
      error: null,
    });

    const { result } = renderHook(() => useShippingByPurchase('p1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shipping).toEqual(shipping);
  });

  it('returns null when purchaseId is null', async () => {
    vi.mocked(shippingService.getShippingByPurchaseId).mockClear();
    const { result } = renderHook(() => useShippingByPurchase(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shipping).toBeNull();
    expect(shippingService.getShippingByPurchaseId).not.toHaveBeenCalled();
  });
});

describe('useShipmentsInTransit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shippingService.getShipmentsInTransit).mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('fetches shipments on mount', async () => {
    const list = [{ id: '1' }];
    vi.mocked(shippingService.getShipmentsInTransit).mockResolvedValue({
      data: list,
      error: null,
    });

    const { result } = renderHook(() => useShipmentsInTransit());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shipments).toEqual(list);
  });
});

describe('useDelayedShipments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shippingService.getDelayedShipments).mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('fetches delayed shipments on mount', async () => {
    const list = [{ id: '1' }];
    vi.mocked(shippingService.getDelayedShipments).mockResolvedValue({
      data: list,
      error: null,
    });

    const { result } = renderHook(() => useDelayedShipments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shipments).toEqual(list);
  });
});
