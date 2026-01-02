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
      console.log('✅ Purchase actualizado desde backend:', { id, updated, updates });
      
      // Para campos de reporte, actualizar estado local inmediatamente sin refetch
      // porque el refetch puede traer datos que no reflejan el cambio inmediatamente
      const reportFields = ['sales_reported', 'commerce_reported', 'luis_lemus_reported'];
      const isReportField = Object.keys(updates).some(key => reportFields.includes(key));
      
      // Actualizar estado local inmediatamente con los datos del backend
      setPurchases((prev) => {
        const updatedPurchases = prev.map((p) => {
          if (p.id === id) {
            const merged = { ...p, ...updated };
            console.log('🔄 Estado local actualizado:', { id, merged, sales_reported: merged.sales_reported, commerce_reported: merged.commerce_reported, luis_lemus_reported: merged.luis_lemus_reported });
            return merged;
          }
          return p;
        });
        return updatedPurchases;
      });
      
      // Solo hacer refetch si NO es un campo de reporte
      // Los campos de reporte se actualizan inmediatamente en el estado local
      if (!isReportField) {
        // Trigger a refetch to ensure data is in sync with backend
        await fetchPurchases();
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
