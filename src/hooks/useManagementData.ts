import { useState, useEffect } from 'react';
import { apiGet } from '../services/api';
import { ManagementRecordWithRelations } from '../types/database';

export const useManagementData = () => {
  const [managementData, setManagementData] = useState<ManagementRecordWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchManagementData = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<any[]>('/api/management');
      setManagementData(data || []);
    } catch (error) {
      console.error('Error fetching management data:', error);
      setManagementData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchManagementData();
  }, []);

  return { managementData, isLoading, refetch: fetchManagementData };
};
