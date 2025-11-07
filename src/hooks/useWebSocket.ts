/**
 * Hook para conectar con WebSocket de notificaciones en tiempo real
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showInfo } from '../components/Toast';

interface WebSocketMessage {
  type: string;
  notification?: {
    title: string;
    message: string;
    type: 'urgent' | 'warning' | 'info' | 'success';
    actionUrl?: string;
  };
  message?: string;
}

export const useWebSocket = () => {
  const { user } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const handleNewNotification = useCallback((notification: any) => {
    console.log('🔔 Nueva notificación recibida:', notification);

    // Mostrar toast según el tipo
    const message = `${notification.title}\n${notification.message}`;
    
    switch (notification.type) {
      case 'urgent':
        showInfo(`⚠️ ${message}`);
        break;
      case 'warning':
        showInfo(`⚠️ ${message}`);
        break;
      case 'success':
        showSuccess(`✅ ${message}`);
        break;
      default:
        showInfo(`📢 ${message}`);
    }

    // Si hay actionUrl, podríamos abrir automáticamente (opcional)
    // window.location.href = notification.actionUrl;
  }, []);

  const connect = useCallback(() => {
    if (!user?.id) return;

    const wsUrl = import.meta.env.DEV 
      ? 'ws://localhost:3000/ws/notifications'
      : 'ws://localhost:3000/ws/notifications'; // Cambiar en producción

    console.log('🔌 Conectando WebSocket...');

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('✅ WebSocket conectado');
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Autenticar con el servidor
        ws.current?.send(JSON.stringify({
          type: 'auth',
          userId: user.id,
          role: user.role
        }));
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 Mensaje WebSocket:', data);

          if (data.type === 'auth_success') {
            console.log('✅ Autenticación exitosa');
          } else if (data.type === 'new_notification' && data.notification) {
            handleNewNotification(data.notification);
          }
        } catch (error) {
          console.error('Error procesando mensaje WebSocket:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('❌ Error WebSocket:', error);
      };

      ws.current.onclose = () => {
        console.log('❌ WebSocket desconectado');
        setIsConnected(false);

        // Intentar reconectar
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          
          console.log(`🔄 Reintentando conexión en ${delay/1000}s (intento ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.log('❌ Máximo de intentos de reconexión alcanzado');
        }
      };
    } catch (error) {
      console.error('Error creando WebSocket:', error);
    }
  }, [user, handleNewNotification]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    if (ws.current) {
      console.log('🔌 Desconectando WebSocket...');
      ws.current.close();
      ws.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  return {
    isConnected,
    disconnect,
    reconnect: connect
  };
};

