import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/api';
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
      // Actualizar estado local sin refetch para evitar refresh de página
      setPreselections(prev =>
        prev.map(p => (p.id === id ? { ...p, decision } : p))
      );
      return response;
    } catch (error) {
      console.error('Error updating decision:', error);
      throw error;
    }
  };

  const updatePreselectionFields = async (id: string, updates: Partial<PreselectionWithRelations>) => {
    try {
      const updated = await apiPut<PreselectionWithRelations>(`/api/preselections/${id}`, updates);
      setPreselections(prev =>
        prev.map(p => (p.id === id ? { ...p, ...updated } : p))
      );
      return updated;
    } catch (error) {
      console.error('Error updating preselection:', error);
      throw error;
    }
  };

  const createPreselection = async (payload: Partial<PreselectionWithRelations>) => {
    try {
      const created = await apiPost<PreselectionWithRelations>('/api/preselections', payload);
      setPreselections(prev => [created, ...prev]);
      return created;
    } catch (error) {
      console.error('Error creating preselection:', error);
      throw error;
    }
  };

  const deletePreselection = async (id: string) => {
    try {
      await apiDelete(`/api/preselections/${id}`);
      setPreselections(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting preselection:', error);
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
    updateDecision,
    updatePreselectionFields,
    createPreselection,
    deletePreselection
  };
};

