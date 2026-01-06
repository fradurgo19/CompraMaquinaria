/**
 * Hook para cerrar sesión automáticamente después de un período de inactividad
 * Tiempo configurado: 30 minutos (1800000 ms)
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos en milisegundos

export const useAutoLogout = () => {
  const { signOut, user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Solo activar si hay usuario autenticado
    if (!user) {
      // Limpiar timer si no hay usuario
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Eventos que indican actividad del usuario
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Función para resetear el timer cuando hay actividad
    const handleActivity = () => {
      // Limpiar timer anterior
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Actualizar última actividad
      lastActivityRef.current = Date.now();

      // Establecer nuevo timer para cerrar sesión
      timeoutRef.current = setTimeout(() => {
        console.log('🔄 Sesión cerrada automáticamente por inactividad (30 minutos)');
        signOut();
        // Redirigir a login
        window.location.href = '/login';
      }, INACTIVITY_TIMEOUT);
    };

    // Agregar listeners para todos los eventos de actividad
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Inicializar timer
    handleActivity();

    // Cleanup: remover listeners y limpiar timer
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [user, signOut]);
};
