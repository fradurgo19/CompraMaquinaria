import { useState, useEffect } from 'react';
import { apiGet, apiPut, apiDelete } from '../services/api';
import { PurchaseWithRelations } from '../types/database';

export const usePurchases = () => {
  const [purchases, setPurchases] = useState<PurchaseWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPurchases = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<any[]>('/api/purchases');
      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      setPurchases([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const updatePurchaseFields = async (id: string, updates: Partial<PurchaseWithRelations>) => {
    try {
      const updated = await apiPut<PurchaseWithRelations>(`/api/purchases/${id}`, updates);
      setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      // Trigger a refetch to ensure data is in sync with backend
      await fetchPurchases();
      return updated;
    } catch (error) {
      console.error('Error updating purchase:', error);
      throw error;
    }
  };

  const deletePurchase = async (id: string) => {
    try {
      await apiDelete(`/api/purchases/${id}`);
      setPurchases(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting purchase:', error);
      throw error;
    }
  };

  return { purchases, isLoading, refetch: fetchPurchases, updatePurchaseFields, deletePurchase };
};
