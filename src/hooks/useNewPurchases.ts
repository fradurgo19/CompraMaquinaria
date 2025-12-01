/**
 * Hook para gestionar compras nuevas (new_purchases)
 */

import { useState, useEffect } from 'react';
import { NewPurchase } from '../types/database';
import { showError } from '../components/Toast';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/api';

export const useNewPurchases = () => {
  const [newPurchases, setNewPurchases] = useState<NewPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNewPurchases = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet<NewPurchase[]>('/api/new-purchases');
      setNewPurchases(data);
    } catch (error) {
      console.error('Error fetching new purchases:', error);
      showError('Error al cargar compras nuevas');
      setNewPurchases([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNewPurchases();
  }, []);

  const createNewPurchase = async (newPurchaseData: Partial<NewPurchase>) => {
    try {
      const created = await apiPost<{ purchases: NewPurchase[]; count: number; pdf_path: string | null }>('/api/new-purchases', newPurchaseData);
      await fetchNewPurchases(); // Refrescar lista
      return created;
    } catch (error: any) {
      console.error('Error creating new purchase:', error);
      throw error;
    }
  };

  const updateNewPurchase = async (id: string, updates: Partial<NewPurchase>) => {
    try {
      const updated = await apiPut<NewPurchase>(`/api/new-purchases/${id}`, updates);
      await fetchNewPurchases(); // Refrescar lista
      return updated;
    } catch (error: any) {
      console.error('Error updating new purchase:', error);
      throw error;
    }
  };

  const deleteNewPurchase = async (id: string) => {
    try {
      await apiDelete(`/api/new-purchases/${id}`);
      await fetchNewPurchases(); // Refrescar lista
    } catch (error: any) {
      console.error('Error deleting new purchase:', error);
      throw error;
    }
  };

  return {
    newPurchases,
    isLoading,
    refetch: fetchNewPurchases,
    createNewPurchase,
    updateNewPurchase,
    deleteNewPurchase,
  };
};

