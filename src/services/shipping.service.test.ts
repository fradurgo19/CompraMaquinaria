import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getShippings,
  getShippingById,
  getShippingByPurchaseId,
  createShipping,
  updateShipping,
  deleteShipping,
  getShipmentsInTransit,
  getDelayedShipments,
  markShipmentArrived,
  updateTracking,
} from './shipping.service';

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
  not: vi.fn(() => chain),
  is: vi.fn(() => chain),
  lt: vi.fn(() => chain),
};

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => chain),
  },
}));

describe('shipping.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolved.data = null;
    mockResolved.error = null;
  });

  describe('getShippings', () => {
    it('returns data when successful', async () => {
      const list = [{ id: '1', purchase_id: 'p1' }];
      mockResolved.data = list;
      const result = await getShippings();
      expect(result.data).toEqual(list);
      expect(result.error).toBeNull();
    });
  });

  describe('getShippingById', () => {
    it('returns shipping with relations', async () => {
      mockResolved.data = { id: '1', purchase: {} };
      const result = await getShippingById('1');
      expect(result.data).toEqual({ id: '1', purchase: {} });
      expect(result.error).toBeNull();
    });
  });

  describe('getShippingByPurchaseId', () => {
    it('returns shipping for purchase', async () => {
      mockResolved.data = { id: '1', purchase_id: 'p1' };
      const result = await getShippingByPurchaseId('p1');
      expect(result.data).toEqual({ id: '1', purchase_id: 'p1' });
      expect(result.error).toBeNull();
    });
  });

  describe('createShipping', () => {
    it('creates and returns new shipping', async () => {
      mockResolved.data = { id: '1', purchase_id: 'p1' };
      const result = await createShipping({
        purchase_id: 'p1',
        carrier: 'DHL',
      });
      expect(result.data).toEqual({ id: '1', purchase_id: 'p1' });
      expect(result.error).toBeNull();
    });
  });

  describe('updateShipping', () => {
    it('updates and returns shipping', async () => {
      mockResolved.data = { id: '1', carrier: 'FedEx' };
      const result = await updateShipping('1', { carrier: 'FedEx' });
      expect(result.data).toEqual({ id: '1', carrier: 'FedEx' });
      expect(result.error).toBeNull();
    });
  });

  describe('deleteShipping', () => {
    it('returns success when delete succeeds', async () => {
      mockResolved.error = null;
      const result = await deleteShipping('1');
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('getShipmentsInTransit', () => {
    it('returns list when successful', async () => {
      mockResolved.data = [{ id: '1' }];
      const result = await getShipmentsInTransit();
      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });
  });

  describe('getDelayedShipments', () => {
    it('returns list when successful', async () => {
      mockResolved.data = [];
      const result = await getDelayedShipments();
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });
  });

  describe('markShipmentArrived', () => {
    it('calls updateShipping with actual_arrival', async () => {
      mockResolved.data = { id: '1', actual_arrival: '2025-01-15' };
      const result = await markShipmentArrived('1', '2025-01-15');
      expect(result.data?.actual_arrival).toBe('2025-01-15');
    });
  });

  describe('updateTracking', () => {
    it('calls updateShipping with carrier and tracking_number', async () => {
      mockResolved.data = { id: '1', carrier: 'DHL', tracking_number: '123' };
      const result = await updateTracking('1', 'DHL', '123');
      expect(result.data?.carrier).toBe('DHL');
      expect(result.data?.tracking_number).toBe('123');
    });
  });
});
