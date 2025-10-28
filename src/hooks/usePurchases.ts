import { useState, useEffect } from 'react';
import { apiGet } from '../services/api';
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

  return { purchases, isLoading, refetch: fetchPurchases };
};
