/**
 * Hook para gestionar compras nuevas (new_purchases)
 */

import { useState, useEffect, useRef } from 'react';
import { NewPurchase } from '../types/database';
import { showError } from '../components/Toast';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/api';

export const useNewPurchases = () => {
  const [newPurchases, setNewPurchases] = useState<NewPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Cache básico en memoria para evitar recargas innecesarias
  const newPurchasesCacheRef = useRef<{
    data: NewPurchase[];
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 30000; // 30 segundos de caché

  const fetchNewPurchases = async (forceRefresh = false) => {
    // Verificar caché si no se fuerza refresh
    if (!forceRefresh && newPurchasesCacheRef.current) {
      const cacheAge = Date.now() - newPurchasesCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        console.log('📦 [NewPurchases] Usando datos del caché (edad:', Math.round(cacheAge / 1000), 's)');
        setNewPurchases(newPurchasesCacheRef.current.data);
        setIsLoading(false);
        return;
      }
    }
    
    try {
      setIsLoading(true);
      const data = await apiGet<NewPurchase[]>('/api/new-purchases');
      
      // Actualizar caché
      newPurchasesCacheRef.current = {
        data,
        timestamp: Date.now(),
      };
      
      setNewPurchases(data);
    } catch (error) {
      console.error('Error fetching new purchases:', error);
      showError('Error al cargar compras nuevas');
      // Si hay error pero tenemos caché, usar datos en caché
      if (newPurchasesCacheRef.current) {
        console.log('⚠️ [NewPurchases] Usando datos del caché debido a error');
        setNewPurchases(newPurchasesCacheRef.current.data);
      } else {
        setNewPurchases([]);
      }
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
      await fetchNewPurchases(true); // Forzar refresh después de crear
      return created;
    } catch (error: any) {
      console.error('Error creating new purchase:', error);
      throw error;
    }
  };

  const updateNewPurchase = async (id: string, updates: Partial<NewPurchase>) => {
    try {
      const updated = await apiPut<NewPurchase>(`/api/new-purchases/${id}`, updates);
      await fetchNewPurchases(true); // Forzar refresh después de actualizar
      return updated;
    } catch (error: any) {
      console.error('Error updating new purchase:', error);
      throw error;
    }
  };

  const deleteNewPurchase = async (id: string) => {
    try {
      await apiDelete(`/api/new-purchases/${id}`);
      await fetchNewPurchases(true); // Forzar refresh después de eliminar
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

