import { useState, useEffect } from 'react';
import { apiGet } from '../services/api';
import { Machine } from '../types/database';

export const useMachines = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMachines = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<Machine[]>('/api/machines');
      setMachines(data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
      setMachines([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  return { machines, isLoading, refetch: fetchMachines };
};
