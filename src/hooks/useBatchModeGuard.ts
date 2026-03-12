/**
 * Hook para proteger contra pérdida de datos cuando hay cambios pendientes en modo masivo
 * Detecta cuando el usuario intenta salir de la página/aplicación y muestra recordatorios.
 * No bloquea refresh/recarga si la pestaña llevó mucho tiempo en segundo plano (evita que
 * la app parezca "no poder recargar" tras uso prolongado).
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { showError } from '../components/Toast';
import toast from 'react-hot-toast';

/** Si la pestaña llevó más de este tiempo oculta, no bloquear beforeunload (permitir refresh) */
const HIDDEN_ALLOW_REFRESH_MS = 10 * 60 * 1000; // 10 minutos

interface UseBatchModeGuardOptions {
  /**
   * Indica si el modo masivo está activo
   */
  batchModeEnabled: boolean;
  
  /**
   * Map de cambios pendientes
   * Debe tener un método size que indique si hay cambios
   */
  pendingBatchChanges: { size: number };
  
  /**
   * Función para guardar los cambios (opcional)
   * Si se proporciona, se puede ofrecer la opción de guardar antes de salir
   */
  onSave?: () => Promise<void> | void;
  
  /**
   * Nombre del módulo (para mensajes personalizados)
   */
  moduleName?: string;
  
  /**
   * Mensaje personalizado (opcional)
   */
  customMessage?: string;
}

export function useBatchModeGuard({
  batchModeEnabled,
  pendingBatchChanges,
  onSave,
  moduleName = 'esta página',
  customMessage
}: UseBatchModeGuardOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasPendingChanges = batchModeEnabled && pendingBatchChanges.size > 0;
  const hasShownWarningRef = useRef(false);
  const previousPathRef = useRef(location.pathname);
  const navigateRef = useRef(navigate);
  const hasPendingChangesRef = useRef(hasPendingChanges);
  const pendingSizeRef = useRef(pendingBatchChanges.size);
  const lastVisibleAtRef = useRef(Date.now());
  const resetWarningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  navigateRef.current = navigate;
  hasPendingChangesRef.current = hasPendingChanges;
  pendingSizeRef.current = pendingBatchChanges.size;

  // Actualizar última vez que la pestaña estuvo visible (para no bloquear refresh tras uso prolongado)
  useEffect(() => {
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        lastVisibleAtRef.current = Date.now();
      }
    };
    if (typeof document !== 'undefined' && !document.hidden) {
      lastVisibleAtRef.current = Date.now();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Detectar cierre de pestaña/navegador (beforeunload)
  // No bloquear si la pestaña llevó >10 min oculta: permite recargar tras uso prolongado
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const now = Date.now();
      const timeSinceVisible = now - lastVisibleAtRef.current;
      const currentlyPending = hasPendingChangesRef.current && pendingSizeRef.current > 0;

      if (!currentlyPending) {
        return;
      }
      if (document.hidden || timeSinceVisible > HIDDEN_ALLOW_REFRESH_MS) {
        return;
      }

      e.preventDefault();
      const message = customMessage ||
        `Tienes ${pendingSizeRef.current} cambio(s) pendiente(s) en modo masivo. ¿Estás seguro de que deseas salir?`;
      // API estándar para mostrar diálogo "¿Salir?" en beforeunload (deprecation en tipos, aún requerido)
      Object.defineProperty(e, 'returnValue', { value: message, configurable: true });
      return message;
    };

    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      globalThis.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasPendingChanges, pendingBatchChanges.size, customMessage]);

  // Detectar cambio de pestaña/aplicación (visibilitychange)
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const showReturnReminderToast = () => {
      if (!document.hidden && !hasShownWarningRef.current) {
        const totalChanges = pendingBatchChanges.size;
        toast(
          customMessage ||
          `💾 Recuerda: Tienes ${totalChanges} cambio(s) pendiente(s) en modo masivo. No olvides guardar antes de salir.`,
          {
            icon: '⚠️',
            style: {
              border: '1px solid #fef3c7',
              background: '#fffbeb',
              color: '#92400e',
            },
            iconTheme: {
              primary: '#f59e0b',
              secondary: '#fff',
            },
            duration: 6000,
          }
        );
        hasShownWarningRef.current = true;
        setTimeout(() => {
          hasShownWarningRef.current = false;
        }, 5000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        return;
      }
      clearTimeout(timeoutId);
      timeoutId = setTimeout(showReturnReminderToast, 1000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timeoutId);
    };
  }, [hasPendingChanges, pendingBatchChanges.size, customMessage]);

  // Detectar cambios de ruta (navegación interna)
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;

    // Si hay cambios pendientes y la ruta cambió
    if (hasPendingChanges && currentPath !== previousPath && previousPath !== '') {
      // Mostrar advertencia
      const totalChanges = pendingBatchChanges.size;
      const message = customMessage || 
        `⚠️ Tienes ${totalChanges} cambio(s) pendiente(s) en modo masivo en ${moduleName}.`;
      
      showError(message);
      
      // Opcionalmente, ofrecer guardar
      if (onSave) {
        setTimeout(() => {
          const shouldSave = globalThis.confirm(
            `${message}\n\n¿Deseas guardar los cambios ahora antes de continuar?`
          );
          if (!shouldSave) return;
          Promise.resolve(onSave()).catch((err: unknown) => {
            console.error('Error al guardar cambios:', err);
            showError('Error al guardar cambios. Por favor, intenta de nuevo.');
          });
        }, 500);
      }
    }

    previousPathRef.current = currentPath;
  }, [location.pathname, hasPendingChanges, pendingBatchChanges.size, moduleName, customMessage, onSave]);

  // Mostrar recordatorio periódico si el usuario lleva mucho tiempo sin guardar
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }

    const intervalId = setInterval(() => {
      if (!document.hidden && !hasShownWarningRef.current) {
        const totalChanges = pendingBatchChanges.size;
        toast(
          customMessage ||
          `⏰ Recordatorio: Tienes ${totalChanges} cambio(s) pendiente(s) sin guardar en modo masivo.`,
          {
            icon: '⚠️',
            style: {
              border: '1px solid #fef3c7',
              background: '#fffbeb',
              color: '#92400e',
            },
            iconTheme: {
              primary: '#f59e0b',
              secondary: '#fff',
            },
            duration: 6000,
          }
        );
        hasShownWarningRef.current = true;
        const existingTimeout = resetWarningTimeoutRef.current;
        if (existingTimeout != null) clearTimeout(existingTimeout);
        resetWarningTimeoutRef.current = setTimeout(() => {
          hasShownWarningRef.current = false;
          resetWarningTimeoutRef.current = null;
        }, 2 * 60 * 1000);
      }
    }, 3 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
      const existingTimeout = resetWarningTimeoutRef.current;
      if (existingTimeout != null) {
        clearTimeout(existingTimeout);
        resetWarningTimeoutRef.current = null;
      }
    };
  }, [hasPendingChanges, pendingBatchChanges.size, customMessage]);

  // Interceptar clics en enlaces de navegación (para prevenir navegación accidental)
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest?.('a[href]');
      const anchor = link instanceof HTMLAnchorElement ? link : null;

      if (!anchor?.href) return;

      const currentOrigin = globalThis.location.origin;
      const linkUrl = new URL(anchor.href);

      if (linkUrl.origin !== currentOrigin || linkUrl.pathname === location.pathname) {
        return;
      }

      const totalChanges = pendingBatchChanges.size;
      const message = customMessage ||
        `Tienes ${totalChanges} cambio(s) pendiente(s) en modo masivo. ¿Deseas guardar antes de navegar?`;

      if (!globalThis.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (onSave && globalThis.confirm('¿Deseas guardar los cambios antes de navegar?')) {
        e.preventDefault();
        e.stopPropagation();
        Promise.resolve(onSave())
          .then(() => {
            globalThis.location.href = anchor.href;
          })
          .catch((err: unknown) => {
            console.error('Error al guardar cambios:', err);
            showError('Error al guardar cambios. Por favor, intenta de nuevo.');
          });
      }
    };

    document.addEventListener('click', handleLinkClick, true);

    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [hasPendingChanges, pendingBatchChanges.size, location.pathname, moduleName, customMessage, onSave]);

  return {
    hasPendingChanges
  };
}
