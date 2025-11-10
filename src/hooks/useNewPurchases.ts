/**
 * Hook para gestionar compras nuevas (new_purchases)
 */

import { useState, useEffect } from 'react';
import { NewPurchase } from '../types/database';
import { showError } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useNewPurchases = () => {
  const [newPurchases, setNewPurchases] = useState<NewPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNewPurchases = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/new-purchases`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener compras nuevas');
      }

      const data = await response.json();
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
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/new-purchases`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPurchaseData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear compra nueva');
      }

      const created = await response.json();
      await fetchNewPurchases(); // Refrescar lista
      return created;
    } catch (error: any) {
      console.error('Error creating new purchase:', error);
      throw error;
    }
  };

  const updateNewPurchase = async (id: string, updates: Partial<NewPurchase>) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/new-purchases/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar compra nueva');
      }

      const updated = await response.json();
      await fetchNewPurchases(); // Refrescar lista
      return updated;
    } catch (error: any) {
      console.error('Error updating new purchase:', error);
      throw error;
    }
  };

  const deleteNewPurchase = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/new-purchases/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar compra nueva');
      }

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

