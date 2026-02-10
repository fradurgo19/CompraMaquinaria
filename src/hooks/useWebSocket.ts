/**
 * Hook para conectar con WebSocket de notificaciones en tiempo real
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showInfo } from '../components/Toast';

interface IncomingNotification {
  title: string;
  message: string;
  type: 'urgent' | 'warning' | 'info' | 'success';
  actionUrl?: string;
}

interface WebSocketMessage {
  type: string;
  notification?: IncomingNotification;
  message?: string;
}

export const useWebSocket = () => {
  const { user } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const handleNewNotification = useCallback((notification: IncomingNotification) => {
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

    // Obtener la URL del backend desde las variables de entorno
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    // Verificar si estamos en producción (Vercel serverless no soporta WebSockets)
    const isProduction = import.meta.env.PROD || apiUrl.startsWith('https://');
    
    // En producción, no intentar conectar WebSocket (Vercel serverless no lo soporta)
    if (isProduction) {
      // Silenciosamente no conectar - las notificaciones funcionarán vía HTTP polling
      return;
    }
    
    // Solo en desarrollo: intentar conectar WebSocket
    // Convertir HTTP a WebSocket (ws)
    const wsUrl = apiUrl.replace('http://', 'ws://') + '/ws/notifications';

    console.log('🔌 Conectando WebSocket a:', wsUrl);

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
            if (typeof document !== 'undefined') {
              document.dispatchEvent(new CustomEvent('notifications:refresh'));
            }
          }
        } catch (error) {
          console.error('Error procesando mensaje WebSocket:', error);
        }
      };

      ws.current.onerror = (error) => {
        // Solo mostrar errores en desarrollo
        if (import.meta.env.DEV) {
          console.error('❌ Error WebSocket:', error);
        }
      };

      ws.current.onclose = () => {
        // Solo mostrar logs en desarrollo
        if (import.meta.env.DEV) {
          console.log('❌ WebSocket desconectado');
        }
        setIsConnected(false);

        // Intentar reconectar solo en desarrollo
        if (import.meta.env.DEV && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          
          console.log(`🔄 Reintentando conexión en ${delay/1000}s (intento ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (import.meta.env.DEV) {
          console.log('❌ Máximo de intentos de reconexión alcanzado');
        }
      };
    } catch (error) {
      // Solo mostrar errores en desarrollo
      if (import.meta.env.DEV) {
        console.error('Error creando WebSocket:', error);
      }
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

