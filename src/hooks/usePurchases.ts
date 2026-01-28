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

  const updatePurchaseFields = async (
    id: string,
    updates: Partial<PurchaseWithRelations>,
    opts?: { skipRefetch?: boolean }
  ) => {
    // Campos “rápidos” (no reordenan ni requieren refetch inmediato)
    const reportFields = ['sales_reported', 'commerce_reported', 'luis_lemus_reported', 'envio_originales'];
    const isReportField = Object.keys(updates).some((key) => reportFields.includes(key));
    const skipRefetch = opts?.skipRefetch === true;

    const applyLocalUpdate = (updater: (prev: PurchaseWithRelations[]) => PurchaseWithRelations[]) => {
      setPurchases((prev) => {
        const next = updater(prev);
        purchasesCacheRef.current = { data: next, timestamp: Date.now() };
        return next;
      });
    };

    // Optimista: aplicar de inmediato para que la fila no “desaparezca” ni se contraiga al guardar inline.
    // Se aplica para (1) campos de reporte y (2) cualquier actualización con skipRefetch (edición inline).
    if (isReportField || skipRefetch) {
      applyLocalUpdate((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    }

    try {
      const updated = await apiPut<PurchaseWithRelations>(`/api/purchases/${id}`, updates);

      // Fusionar respuesta del backend preservando relaciones existentes (machine, supplier, etc.)
      // que no vienen en el row plano de RETURNING *
      applyLocalUpdate((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const merged = { ...p, ...updated } as PurchaseWithRelations;
          return merged;
        })
      );

      // Solo refetch si no es campo rápido y no se pidió skipRefetch
      if (!isReportField && !skipRefetch) {
        await fetchPurchases(true);
      }

      return updated;
    } catch (error) {
      console.error('Error updating purchase:', error);
      // Revertir a datos de backend si falla
      await fetchPurchases(true);
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
