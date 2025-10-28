/**
 * Hook personalizado para gestión del consolidado de gerencia
 */

import { useState, useEffect } from 'react';
import type { ManagementRecord, ManagementConsolidado, ManagementFilters } from '../types/database';
import * as managementService from '../services/management.service';

export function useManagementRecords(filters?: ManagementFilters) {
  const [records, setRecords] = useState<ManagementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await managementService.getManagementRecords(filters);
    
    if (err) {
      setError(err);
    } else if (data) {
      setRecords(data);
    }
    
    setLoading(false);
  };

  const updateRecord = async (id: string, updates: Partial<ManagementRecord>) => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await managementService.updateManagementRecord(id, updates);
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false, data: null };
    }
    
    await fetchRecords();
    setLoading(false);
    return { success: true, data };
  };

  const updateSalesState = async (id: string, salesState: 'OK' | 'X' | 'BLANCO') => {
    return managementService.updateSalesState(id, salesState);
  };

  const updateComments = async (id: string, comments: string) => {
    return managementService.updateComments(id, comments);
  };

  const updateProjections = async (id: string, proyectado?: number, pvp_est?: number) => {
    return managementService.updateProjections(id, proyectado, pvp_est);
  };

  useEffect(() => {
    fetchRecords();
  }, [JSON.stringify(filters)]);

  return {
    records,
    loading,
    error,
    fetchRecords,
    updateRecord,
    updateSalesState,
    updateComments,
    updateProjections
  };
}

export function useManagementConsolidado(filters?: ManagementFilters) {
  const [consolidado, setConsolidado] = useState<ManagementConsolidado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConsolidado = async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await managementService.getManagementConsolidado(filters);
    
    if (err) {
      setError(err);
    } else if (data) {
      setConsolidado(data);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchConsolidado();
  }, [JSON.stringify(filters)]);

  return {
    consolidado,
    loading,
    error,
    refresh: fetchConsolidado
  };
}

export function useManagementTotals() {
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTotals = async () => {
    setLoading(true);
    setError(null);
    
    const totalsData = await managementService.getConsolidadoTotals();
    setTotals(totalsData);
    setLoading(false);
  };

  useEffect(() => {
    fetchTotals();
  }, []);

  return { totals, loading, error, refresh: fetchTotals };
}

export function useManagementStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    
    const { stats: statsData, error: err } = await managementService.getConsolidadoStats();
    
    if (err) {
      setError(err);
    } else {
      setStats(statsData);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, error, refresh: fetchStats };
}

export function useExportConsolidado() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = async () => {
    setExporting(true);
    setError(null);
    
    const { data, error: err } = await managementService.exportConsolidado();
    
    if (err) {
      setError(err);
      setExporting(false);
      return { success: false, data: null };
    }
    
    setExporting(false);
    return { success: true, data };
  };

  return { exportData, exporting, error };
}

export function useRecalculateRecords() {
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recalculate = async () => {
    setRecalculating(true);
    setError(null);
    
    const { success, updated, error: err } = await managementService.recalculateAllRecords();
    
    if (err) {
      setError(err);
    }
    
    setRecalculating(false);
    return { success, updated };
  };

  return { recalculate, recalculating, error };
}

export function useManagementRecord(machineId: string | null) {
  const [record, setRecord] = useState<ManagementRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!machineId) {
      setRecord(null);
      return;
    }

    const fetchRecord = async () => {
      setLoading(true);
      setError(null);
      
      const { data, error: err } = await managementService.getManagementRecordByMachineId(machineId);
      
      if (err) {
        setError(err);
      } else {
        setRecord(data);
      }
      
      setLoading(false);
    };

    fetchRecord();
  }, [machineId]);

  return { record, loading, error };
}

