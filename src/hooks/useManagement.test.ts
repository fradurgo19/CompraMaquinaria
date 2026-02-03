import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useManagementRecords,
  useManagementConsolidado,
  useManagementTotals,
  useManagementRecord,
} from './useManagement';
import * as managementService from '../services/management.service';

vi.mock('../services/management.service', () => ({
  getManagementRecords: vi.fn(),
  getManagementConsolidado: vi.fn(),
  updateManagementRecord: vi.fn(),
  updateSalesState: vi.fn(),
  updateComments: vi.fn(),
  updateProjections: vi.fn(),
  getConsolidadoTotals: vi.fn(),
  getManagementRecordByMachineId: vi.fn(),
}));

describe('useManagementRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(managementService.getManagementRecords).mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('fetches records on mount', async () => {
    const records = [{ id: '1', sales_state: 'OK' }];
    vi.mocked(managementService.getManagementRecords).mockResolvedValue({
      data: records,
      error: null,
    });

    const { result } = renderHook(() => useManagementRecords());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.records).toEqual(records);
    expect(managementService.getManagementRecords).toHaveBeenCalled();
  });

  it('updateRecord refetches and returns success', async () => {
    vi.mocked(managementService.getManagementRecords).mockResolvedValue({
      data: [],
      error: null,
    });
    vi.mocked(managementService.updateManagementRecord).mockResolvedValue({
      data: { id: '1', sales_state: 'X' },
      error: null,
    });

    const { result } = renderHook(() => useManagementRecords());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updateResult = await result.current.updateRecord('1', { sales_state: 'X' });
    expect(updateResult.success).toBe(true);
    expect(updateResult.data).toEqual({ id: '1', sales_state: 'X' });
  });
});

describe('useManagementConsolidado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(managementService.getManagementConsolidado).mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it('fetches consolidado on mount', async () => {
    const consolidado = [{ id: '1' }];
    vi.mocked(managementService.getManagementConsolidado).mockResolvedValue({
      data: consolidado,
      error: null,
    });

    const { result } = renderHook(() => useManagementConsolidado());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.consolidado).toEqual(consolidado);
  });
});

describe('useManagementTotals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(managementService.getConsolidadoTotals).mockResolvedValue({
      total_machines: 0,
      total_fob: 0,
      total_cif: 0,
      total_costs: 0,
      total_projected: 0,
      by_state: { OK: 0, X: 0, BLANCO: 0 },
      by_type: { SUBASTA: 0, COMPRA_DIRECTA: 0 },
    });
  });

  it('fetches totals on mount', async () => {
    const totals = { total_machines: 10, total_fob: 1000 };
    vi.mocked(managementService.getConsolidadoTotals).mockResolvedValue(totals as any);

    const { result } = renderHook(() => useManagementTotals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totals).toEqual(totals);
  });
});

describe('useManagementRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(managementService.getManagementRecordByMachineId).mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it('fetches record when machineId is set', async () => {
    const record = { id: '1', machine_id: 'm1' };
    vi.mocked(managementService.getManagementRecordByMachineId).mockResolvedValue({
      data: record,
      error: null,
    });

    const { result } = renderHook(() => useManagementRecord('m1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.record).toEqual(record);
  });

  it('returns null record when machineId is null', async () => {
    vi.mocked(managementService.getManagementRecordByMachineId).mockClear();
    const { result } = renderHook(() => useManagementRecord(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.record).toBeNull();
    expect(managementService.getManagementRecordByMachineId).not.toHaveBeenCalled();
  });
});
