/**
 * Hook personalizado para gestión de items de costo
 */

import { useState, useEffect } from 'react';
import type { CostItem, CostItemFormData } from '../types/database';
import * as costItemsService from '../services/costItems.service';

export function useCostItems(purchaseId: string | null) {
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCostItems = async () => {
    if (!purchaseId) {
      setCostItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    const { data, error: err } = await costItemsService.getCostItemsByPurchaseId(purchaseId);
    
    if (err) {
      setError(err);
    } else if (data) {
      setCostItems(data);
    }
    
    setLoading(false);
  };

  const createCostItem = async (formData: CostItemFormData) => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await costItemsService.createCostItem(formData);
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false, data: null };
    }
    
    await fetchCostItems();
    setLoading(false);
    return { success: true, data };
  };

  const updateCostItem = async (id: string, formData: Partial<CostItemFormData>) => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await costItemsService.updateCostItem(id, formData);
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false, data: null };
    }
    
    await fetchCostItems();
    setLoading(false);
    return { success: true, data };
  };

  const deleteCostItem = async (id: string) => {
    setLoading(true);
    setError(null);
    
    const { success, error: err } = await costItemsService.deleteCostItem(id);
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false };
    }
    
    await fetchCostItems();
    setLoading(false);
    return { success };
  };

  const createMultiple = async (items: CostItemFormData[]) => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await costItemsService.createMultipleCostItems(items);
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false, data: null };
    }
    
    await fetchCostItems();
    setLoading(false);
    return { success: true, data };
  };

  useEffect(() => {
    fetchCostItems();
  }, [purchaseId]);

  return {
    costItems,
    loading,
    error,
    fetchCostItems,
    createCostItem,
    updateCostItem,
    deleteCostItem,
    createMultiple
  };
}

export function useCostsSummary(purchaseId: string | null) {
  const [summary, setSummary] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) {
      setSummary(null);
      setTotal(0);
      return;
    }

    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      
      const { summary: summaryData, total: totalAmount } = 
        await costItemsService.getCostsSummary(purchaseId);
      
      setSummary(summaryData);
      setTotal(totalAmount);
      setLoading(false);
    };

    fetchSummary();
  }, [purchaseId]);

  return { summary, total, loading, error };
}

export function useTotalCostsByType(purchaseId: string | null) {
  const [totals, setTotals] = useState({
    inland: 0,
    gastos_pto: 0,
    flete: 0,
    trasld: 0,
    repuestos: 0,
    mant_ejec: 0,
    total: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!purchaseId) {
      setTotals({
        inland: 0,
        gastos_pto: 0,
        flete: 0,
        trasld: 0,
        repuestos: 0,
        mant_ejec: 0,
        total: 0
      });
      return;
    }

    const fetchTotals = async () => {
      setLoading(true);
      const totalsData = await costItemsService.getTotalCostsByType(purchaseId);
      setTotals(totalsData);
      setLoading(false);
    };

    fetchTotals();
  }, [purchaseId]);

  return { totals, loading };
}

