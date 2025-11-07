/**
 * Hook personalizado para gestionar notificaciones internas
 * Sistema multinivel con polling automático
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiDelete, apiPost } from '../services/api';

export interface Notification {
  id: string;
  user_id: string;
  module_source: string;
  module_target: string;
  type: 'urgent' | 'warning' | 'info' | 'success';
  priority: number;
  title: string;
  message: string;
  reference_id: string | null;
  metadata: any;
  action_type: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
  created_by_email?: string;
  created_by_name?: string;
}

interface ModuleCount {
  module_target: string;
  total: number;
  unread: number;
}

export const useNotifications = (moduleFilter?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [moduleCounts, setModuleCounts] = useState<ModuleCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar notificaciones
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    try {
      const params = new URLSearchParams();
      if (unreadOnly) params.append('unreadOnly', 'true');
      if (moduleFilter) params.append('module', moduleFilter);

      const data = await apiGet<Notification[]>(`/api/notifications?${params}`);
      setNotifications(data);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  }, [moduleFilter]);

  // Cargar contador de no leídas
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await apiGet<{ count: number }>('/api/notifications/unread-count');
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Error cargando contador:', error);
    }
  }, []);

  // Cargar contadores por módulo
  const fetchModuleCounts = useCallback(async () => {
    try {
      const data = await apiGet<ModuleCount[]>('/api/notifications/by-module');
      setModuleCounts(data);
    } catch (error) {
      console.error('Error cargando contadores por módulo:', error);
    }
  }, []);

  // Cargar todo
  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchNotifications(),
      fetchUnreadCount(),
      fetchModuleCounts()
    ]);
    setLoading(false);
  }, [fetchNotifications, fetchUnreadCount, fetchModuleCounts]);

  // Marcar como leída
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiPut(`/api/notifications/${notificationId}/read`, {});
      await refresh();
    } catch (error) {
      console.error('Error marcando como leída:', error);
    }
  }, [refresh]);

  // Marcar todas como leídas
  const markAllAsRead = useCallback(async (module?: string) => {
    try {
      await apiPut('/api/notifications/mark-all-read', { module });
      await refresh();
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
    }
  }, [refresh]);

  // Eliminar notificación
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await apiDelete(`/api/notifications/${notificationId}`);
      await refresh();
    } catch (error) {
      console.error('Error eliminando notificación:', error);
    }
  }, [refresh]);

  // Crear notificación (para testing o uso interno)
  const createNotification = useCallback(async (notification: Partial<Notification>) => {
    try {
      await apiPost('/api/notifications', notification);
      await refresh();
    } catch (error) {
      console.error('Error creando notificación:', error);
    }
  }, [refresh]);

  // Polling cada 30 segundos
  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      fetchUnreadCount();
      if (moduleFilter) {
        fetchNotifications();
      }
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [refresh, fetchUnreadCount, fetchNotifications, moduleFilter]);

  // Obtener contador para un módulo específico
  const getModuleCount = useCallback((module: string) => {
    const moduleData = moduleCounts.find(m => m.module_target === module);
    return moduleData?.unread || 0;
  }, [moduleCounts]);

  return {
    notifications,
    unreadCount,
    moduleCounts,
    loading,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    getModuleCount
  };
};

