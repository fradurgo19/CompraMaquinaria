import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPut, apiDelete } from '../services/api';
import { PurchaseWithRelations } from '../types/database';

export const usePurchases = () => {
  const [purchases, setPurchases] = useState<PurchaseWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Cache básico en memoria para evitar recargas innecesarias
  const purchasesCacheRef = useRef<{
    data: PurchaseWithRelations[];
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 30000; // 30 segundos de caché

  const fetchPurchases = async (forceRefresh = false) => {
    // Verificar caché si no se fuerza refresh
    if (!forceRefresh && purchasesCacheRef.current) {
      const cacheAge = Date.now() - purchasesCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        console.log('📦 [Purchases] Usando datos del caché (edad:', Math.round(cacheAge / 1000), 's)');
        setPurchases(purchasesCacheRef.current.data);
        setIsLoading(false);
        return;
      }
    }
    
    setIsLoading(true);
    try {
      const data = await apiGet<any[]>('/api/purchases');
      const purchasesData = data || [];
      
      // Actualizar caché
      purchasesCacheRef.current = {
        data: purchasesData,
        timestamp: Date.now(),
      };
      
      setPurchases(purchasesData);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      // Si hay error pero tenemos caché, usar datos en caché
      if (purchasesCacheRef.current) {
        console.log('⚠️ [Purchases] Usando datos del caché debido a error');
        setPurchases(purchasesCacheRef.current.data);
      } else {
        setPurchases([]);
      }
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
      
      // Para campos de reporte, actualizar estado local inmediatamente sin refetch
      // porque el refetch puede traer datos que no reflejan el cambio inmediatamente
      const reportFields = ['sales_reported', 'commerce_reported', 'luis_lemus_reported'];
      const isReportField = Object.keys(updates).some(key => reportFields.includes(key));
      
      // Actualizar estado local inmediatamente con los datos del backend
      setPurchases((prev) => {
        const updatedPurchases = prev.map((p) => {
          if (p.id === id) {
            return { ...p, ...updated };
          }
          return p;
        });
        return updatedPurchases;
      });
      
      // Solo hacer refetch si NO es un campo de reporte
      // Los campos de reporte se actualizan inmediatamente en el estado local
      if (!isReportField) {
        // Trigger a refetch to ensure data is in sync with backend (forzar refresh)
        await fetchPurchases(true);
      }
      
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
