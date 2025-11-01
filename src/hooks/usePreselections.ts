import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut } from '../services/api';
import { PreselectionWithRelations } from '../types/database';

export const usePreselections = () => {
  const [preselections, setPreselections] = useState<PreselectionWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPreselections = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<PreselectionWithRelations[]>('/api/preselections');
      setPreselections(data);
    } catch (error) {
      console.error('Error fetching preselections:', error);
      setPreselections([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDecision = async (id: string, decision: 'SI' | 'NO') => {
    try {
      const response = await apiPut(`/api/preselections/${id}/decision`, { decision });
      await fetchPreselections(); // Recargar lista
      return response;
    } catch (error) {
      console.error('Error updating decision:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchPreselections();
  }, []);

  return { 
    preselections, 
    isLoading, 
    refetch: fetchPreselections,
    updateDecision 
  };
};

