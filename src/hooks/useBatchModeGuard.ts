/**
 * Hook para proteger contra pérdida de datos cuando hay cambios pendientes en modo masivo
 * Detecta cuando el usuario intenta salir de la página/aplicación y muestra recordatorios
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { showError } from '../components/Toast';
import toast from 'react-hot-toast';

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

  // Mantener referencia actualizada de navigate
  navigateRef.current = navigate;

  // Detectar cierre de pestaña/navegador (beforeunload)
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      
      const message = customMessage || 
        `Tienes ${pendingBatchChanges.size} cambio(s) pendiente(s) en modo masivo. ¿Estás seguro de que deseas salir?`;
      
      // Mensaje estándar del navegador
      e.returnValue = message;
      
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasPendingChanges, pendingBatchChanges.size, customMessage]);

  // Detectar cambio de pestaña/aplicación (visibilitychange)
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let isHidden = false;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Usuario cambió de pestaña o minimizó
        isHidden = true;
      } else {
        // Usuario volvió a la pestaña
        isHidden = false;
        clearTimeout(timeoutId);
        
        // Mostrar recordatorio después de 1 segundo de volver (para no ser intrusivo)
        timeoutId = setTimeout(() => {
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
            
            // Resetear flag después de 5 segundos
            setTimeout(() => {
              hasShownWarningRef.current = false;
            }, 5000);
          }
        }, 1000);
      }
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
          const shouldSave = window.confirm(
            `${message}\n\n¿Deseas guardar los cambios ahora antes de continuar?`
          );
          
          if (shouldSave) {
            onSave().catch((err) => {
              console.error('Error al guardar cambios:', err);
              showError('Error al guardar cambios. Por favor, intenta de nuevo.');
            });
          }
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

    let intervalId: NodeJS.Timeout;
    
    // Mostrar recordatorio cada 3 minutos si hay cambios pendientes y la pestaña está visible
    intervalId = setInterval(() => {
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
        
        // Resetear flag después de 2 minutos
        setTimeout(() => {
          hasShownWarningRef.current = false;
        }, 2 * 60 * 1000);
      }
    }, 3 * 60 * 1000); // 3 minutos

    return () => {
      clearInterval(intervalId);
    };
  }, [hasPendingChanges, pendingBatchChanges.size, customMessage]);

  // Interceptar clics en enlaces de navegación (para prevenir navegación accidental)
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (link && link.href) {
        const currentOrigin = window.location.origin;
        const linkUrl = new URL(link.href);
        
        // Solo interceptar si es un enlace interno
        if (linkUrl.origin === currentOrigin && linkUrl.pathname !== location.pathname) {
          const totalChanges = pendingBatchChanges.size;
          const message = customMessage || 
            `Tienes ${totalChanges} cambio(s) pendiente(s) en modo masivo. ¿Deseas guardar antes de navegar?`;
          
          const shouldNavigate = window.confirm(message);
          
          if (!shouldNavigate) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
          
          // Si el usuario quiere navegar, ofrecer guardar
          if (onSave && window.confirm('¿Deseas guardar los cambios antes de navegar?')) {
            e.preventDefault();
            e.stopPropagation();
            onSave().then(() => {
              // Después de guardar, navegar
              window.location.href = link.href;
            }).catch((err) => {
              console.error('Error al guardar cambios:', err);
              showError('Error al guardar cambios. Por favor, intenta de nuevo.');
            });
            return false;
          }
        }
      }
    };

    document.addEventListener('click', handleLinkClick, true); // Usar capture phase
    
    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [hasPendingChanges, pendingBatchChanges.size, location.pathname, moduleName, customMessage, onSave]);

  return {
    hasPendingChanges
  };
}
