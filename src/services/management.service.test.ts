import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getManagementRecords,
  getManagementConsolidado,
  getManagementRecordById,
  getManagementRecordByMachineId,
  updateManagementRecord,
  updateSalesState,
  updateComments,
  getConsolidadoTotals,
} from './management.service';

const mockResolved = { data: null as unknown, error: null as unknown };
const chain = {
  then(resolve: (v: typeof mockResolved) => void) {
    return Promise.resolve(mockResolved).then(resolve);
  },
  select: vi.fn(() => chain),
  eq: vi.fn(() => chain),
  order: vi.fn(() => chain),
  update: vi.fn(() => chain),
  single: vi.fn(() => Promise.resolve(mockResolved)),
};

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => chain),
  },
}));

describe('management.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolved.data = null;
    mockResolved.error = null;
  });

  describe('getManagementRecords', () => {
    it('returns data when successful', async () => {
      const records = [{ id: '1', sales_state: 'OK' }];
      mockResolved.data = records;
      const result = await getManagementRecords();
      expect(result.data).toEqual(records);
      expect(result.error).toBeNull();
    });

    it('applies filters when provided', async () => {
      mockResolved.data = [];
      await getManagementRecords({ sales_state: 'OK', tipo_compra: 'SUBASTA' });
      expect(chain.eq).toHaveBeenCalledWith('sales_state', 'OK');
      expect(chain.eq).toHaveBeenCalledWith('tipo_compra', 'SUBASTA');
    });
  });

  describe('getManagementConsolidado', () => {
    it('returns data from vista consolidado', async () => {
      mockResolved.data = [{ id: '1' }];
      const result = await getManagementConsolidado();
      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });
  });

  describe('getManagementRecordById', () => {
    it('returns record with relations', async () => {
      const record = { id: '1', machine: {}, auction: {}, purchase: {} };
      mockResolved.data = record;
      const result = await getManagementRecordById('1');
      expect(result.data).toEqual(record);
      expect(result.error).toBeNull();
    });
  });

  describe('getManagementRecordByMachineId', () => {
    it('returns record for machine_id', async () => {
      mockResolved.data = { id: '1', machine_id: 'm1' };
      const result = await getManagementRecordByMachineId('m1');
      expect(result.data).toEqual({ id: '1', machine_id: 'm1' });
      expect(result.error).toBeNull();
    });
  });

  describe('updateManagementRecord', () => {
    it('updates and returns record', async () => {
      mockResolved.data = { id: '1', sales_state: 'X' };
      const result = await updateManagementRecord('1', { sales_state: 'X' });
      expect(result.data).toEqual({ id: '1', sales_state: 'X' });
      expect(result.error).toBeNull();
    });
  });

  describe('updateSalesState', () => {
    it('calls updateManagementRecord with sales_state', async () => {
      mockResolved.data = { id: '1', sales_state: 'BLANCO' };
      const result = await updateSalesState('1', 'BLANCO');
      expect(result.data).toEqual({ id: '1', sales_state: 'BLANCO' });
    });
  });

  describe('updateComments', () => {
    it('updates comentarios_pc', async () => {
      mockResolved.data = { id: '1', comentarios_pc: 'test' };
      const result = await updateComments('1', 'test');
      expect(result.data?.comentarios_pc).toBe('test');
    });
  });

  describe('getConsolidadoTotals', () => {
    it('returns zeros when no data', async () => {
      mockResolved.data = null;
      mockResolved.error = { message: 'err' };
      const result = await getConsolidadoTotals();
      expect(result.total_machines).toBe(0);
      expect(result.total_fob).toBe(0);
      expect(result.by_state.OK).toBe(0);
    });

    it('aggregates totals from records', async () => {
      mockResolved.data = [
        { precio_fob: 100, cif_usd: 120, sales_state: 'OK', tipo_compra: 'SUBASTA' },
        { precio_fob: 200, cif_usd: 240, sales_state: 'X', tipo_compra: 'COMPRA_DIRECTA' },
      ];
      mockResolved.error = null;
      const result = await getConsolidadoTotals();
      expect(result.total_machines).toBe(2);
      expect(result.total_fob).toBe(300);
      expect(result.by_state.OK).toBe(1);
      expect(result.by_state.X).toBe(1);
    });
  });
});
