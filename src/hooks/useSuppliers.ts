import { useState, useEffect } from 'react';
import { apiGet } from '../services/api';
import { Supplier } from '../types/database';

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<Supplier[]>('/api/suppliers');
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  return { suppliers, isLoading, refetch: fetchSuppliers };
};
