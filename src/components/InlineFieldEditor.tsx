import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Check, Loader2, X, ChevronDown } from 'lucide-react';

type InlineFieldType = 'text' | 'number' | 'textarea' | 'select' | 'combobox' | 'date' | 'time';

export interface InlineFieldOption {
  label: string;
  value: string;
}

interface InlineFieldEditorProps {
  value: string | number | null | undefined;
  type?: InlineFieldType;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  options?: InlineFieldOption[];
  displayFormatter?: (value: string | number | null | undefined) => React.ReactNode;
  onSave: (value: string | number | null) => Promise<void> | void;
  onDropdownOpen?: () => void;
  onDropdownClose?: () => void;
  autoSave?: boolean; // Si es true, guarda automáticamente al cambiar el valor
  onEditStart?: () => void; // Callback cuando comienza la edición
  onEditEnd?: () => void; // Callback cuando termina la edición
  keepOpenOnAutoSave?: boolean; // Para selects autosave: no cerrar tras guardar (ej. proveedor preselección)
  /** Si true: select solo se cierra al elegir opción o Enter; text/number solo al Enter o check verde (✓) */
  closeOnlyOnEnterOrSelect?: boolean;
}

const normalizeValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isNaN(value)) return '';
  return String(value);
};

export const InlineFieldEditor: React.FC<InlineFieldEditorProps> = React.memo(({
  value,
  type = 'text',
  placeholder = 'Click para editar',
  className = '',
  inputClassName = '',
  disabled = false,
  options = [],
  displayFormatter,
  onSave,
  onDropdownOpen,
  onDropdownClose,
  autoSave = false,
  onEditStart,
  onEditEnd,
  keepOpenOnAutoSave = false,
  closeOnlyOnEnterOrSelect = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isInputReady, setIsInputReady] = useState(false); // Nuevo estado para controlar cuando el input está listo
  const [draft, setDraft] = useState<string>(normalizeValue(value));
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; bottom?: number; left: number; width: number; openUpward: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectInteractionRef = useRef<boolean>(false);
  const selectBlurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectExitEditingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectContainerRef = useRef<HTMLDivElement | null>(null);
  const previousStatusRef = useRef<'idle' | 'saving' | 'error'>('idle');
  const wasSavingBeforeRef = useRef<boolean>(false);
  const focusTriesRef = useRef<number>(0);
  const openingStartTimeRef = useRef<number>(0); // Timestamp cuando se abre el editor
  const prevIsEditingRef = useRef<boolean>(false); // Estado previo de isEditing para detectar cambios reales
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputReadyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const focusAndSelectInput = useCallback(() => {
    const tryFocus = () => {
      if (!inputRef.current || !isEditing) {
        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] focusAndSelectInput - tryFocus falló (sin ref o no editing)', { placeholder, hasRef: !!inputRef.current, isEditing });
        }
        return false;
      }
      try {
        const inputEl = inputRef.current as HTMLInputElement;
        if (!inputEl) {
          if (type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] focusAndSelectInput - tryFocus falló (inputEl null)', { placeholder });
          }
          return false;
        }

        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] focusAndSelectInput - Llamando inputEl.focus()', { placeholder, isEditing });
        }
        // Asegurar que el input esté en el DOM y sea focusable
        inputEl.focus();
        
        // Pequeño delay para asegurar que el focus se haya aplicado
        requestAnimationFrame(() => {
          if (!inputRef.current || !isEditing) {
            if (type === 'number' && !autoSave) {
              console.log('[InlineFieldEditor] focusAndSelectInput - requestAnimationFrame cancelado (sin ref o no editing)', { placeholder, hasRef: !!inputRef.current, isEditing });
            }
            return;
          }

          const el = inputRef.current as HTMLInputElement;
          if (type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] focusAndSelectInput - Seleccionando texto', { placeholder, activeElement: document.activeElement === el });
          }
          if (type === 'text' || type === 'number') {
            try {
              // Forzar selección del texto
              el.select();
              
              // Verificar que la selección funcionó
              const hasFullSelection = el.selectionStart === 0 && el.selectionEnd === el.value.length;
              
              if (!hasFullSelection && el.value.length > 0) {
                // Si no se seleccionó, intentar con setSelectionRange
                el.setSelectionRange(0, el.value.length);
              }
              
              // Marcar como listo solo si tenemos focus y selección
              if (document.activeElement === el) {
                if (type === 'number' && !autoSave) {
                  console.log('[InlineFieldEditor] focusAndSelectInput - Focus exitoso, marcando isInputReady', { placeholder });
                }
                setIsInputReady(true);
                return true;
              } else {
                if (type === 'number' && !autoSave) {
                  console.log('[InlineFieldEditor] focusAndSelectInput - Focus NO exitoso (activeElement diferente)', { placeholder, activeElement: document.activeElement });
                }
              }
            } catch {
              // Si falla, marcar como listo de todas formas después de un delay
              if (document.activeElement === el) {
                setTimeout(() => setIsInputReady(true), 50);
                return true;
              }
            }
          } else if (type === 'combobox') {
            const length = el.value.length;
            el.setSelectionRange(length, length);
            if (document.activeElement === el) {
              setIsInputReady(true);
              return true;
            }
          }
          
          return false;
        });
        
        const focusSuccess = document.activeElement === inputEl;
        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] focusAndSelectInput - tryFocus resultado', { placeholder, focusSuccess, activeElement: document.activeElement });
        }
        return focusSuccess;
      } catch {
        return false;
      }
    };
    
    focusTriesRef.current = 0;
    const attempt = () => {
      if (type === 'number' && !autoSave) {
        console.log('[InlineFieldEditor] focusAndSelectInput - attempt', { placeholder, try: focusTriesRef.current, isEditing });
      }
      const success = tryFocus();
      if (!success && focusTriesRef.current < 10) {
        focusTriesRef.current += 1;
        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] focusAndSelectInput - Reintentando', { placeholder, try: focusTriesRef.current });
        }
        setTimeout(attempt, 20);
      } else if (success) {
        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] focusAndSelectInput - Éxito después de intentos', { placeholder, tries: focusTriesRef.current });
        }
        // Si tuvo éxito, dar un poco más de tiempo antes de marcar como listo
        setTimeout(() => setIsInputReady(true), 50);
      } else {
        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] focusAndSelectInput - Falló después de muchos intentos, marcando como listo', { placeholder, tries: focusTriesRef.current });
        }
        // Si falló después de muchos intentos, marcar como listo de todas formas
        setIsInputReady(true);
      }
    };
    setTimeout(attempt, 0);
  }, [isEditing, type, autoSave, placeholder]);

  useEffect(() => {
    // Solo loggear cuando hay un cambio real en isEditing (de false a true o viceversa)
    const isEditingChanged = prevIsEditingRef.current !== isEditing;
    if (isEditingChanged && ((type === 'select' && autoSave) || (type === 'number' && !autoSave))) {
      console.log('[InlineFieldEditor] useEffect - isEditing cambió', { 
        type, 
        autoSave, 
        placeholder, 
        from: prevIsEditingRef.current, 
        to: isEditing, 
        value 
      });
    }
    prevIsEditingRef.current = isEditing;
    
    if (!isEditing) {
      // Resetear estado cuando se sale de edición
      setIsInputReady(false);
      setDraft(normalizeValue(value));
      setSearchTerm('');
      // Limpiar estado de error cuando se sale de edición
      if (status === 'error') {
        setStatus('idle');
        setError(null);
      }
      if (showDropdown && type === 'combobox') {
        setShowDropdown(false);
        onDropdownClose?.();
      }
      // Resetear el flag de interacción cuando se sale de edición
      selectInteractionRef.current = false;
      // Resetear el ref del status previo cuando se sale de edición
      previousStatusRef.current = 'idle';
      // Resetear el flag de guardado anterior cuando se sale de edición
      wasSavingBeforeRef.current = false;
      // Limpiar timeouts
      if (inputReadyTimeoutRef.current) {
        clearTimeout(inputReadyTimeoutRef.current);
        inputReadyTimeoutRef.current = null;
      }
      openingStartTimeRef.current = 0;
    } else if (isEditing) {
      // Log cuando se entra en modo edición
      if ((type === 'select' && autoSave) || (type === 'number' && !autoSave)) {
        console.log('[InlineFieldEditor] useEffect - ENTRANDO a modo edición', { type, autoSave, placeholder });
      }
      // Cuando se entra en modo edición, registrar el tiempo y resetear el estado
      openingStartTimeRef.current = Date.now();
      setIsInputReady(false);
      // Cuando se entra en modo edición, asegurarse de que el status esté en 'idle' y resetear los refs
      if (status !== 'idle' && status !== 'error') {
        setStatus('idle');
      }
      previousStatusRef.current = 'idle';
      wasSavingBeforeRef.current = false; // Asegurar que el flag esté en false al entrar en modo edición
      
      // Lógica específica para selects
      if (type === 'select' && inputRef.current) {
        // Cuando se activa el modo de edición para un select, hacer focus inmediatamente
        // y marcar que hay interacción activa para mantener el editor abierto
        selectInteractionRef.current = true;
        
        // Usar múltiples intentos para asegurar que el select obtenga focus
        setTimeout(() => {
          if (inputRef.current && isEditing && inputRef.current instanceof HTMLSelectElement) {
            try {
              inputRef.current.focus();
              // Asegurar que el flag esté activo
              selectInteractionRef.current = true;
            } catch {
              // Ignorar errores de focus
            }
          }
        }, 0);
        setTimeout(() => {
          if (inputRef.current && isEditing && inputRef.current instanceof HTMLSelectElement) {
            try {
              if (document.activeElement !== inputRef.current) {
                inputRef.current.focus();
              }
              selectInteractionRef.current = true;
            } catch {
              // Ignorar errores de focus
            }
          }
        }, 50);
        setTimeout(() => {
          if (inputRef.current && isEditing && inputRef.current instanceof HTMLSelectElement) {
            try {
              selectInteractionRef.current = true;
            } catch {
              // Ignorar errores
            }
          }
        }, 100);
      }
      // Forzar enfoque/selección para número/texto (como PVP Est.)
      if (type === 'number' || type === 'text') {
        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] useEffect - Configurando focus para number/text', { placeholder, hasInputRef: !!inputRef.current });
        }
        // CRÍTICO: El input aún no se ha renderizado cuando isEditing cambia a true
        // Necesitamos esperar a que React renderice el input antes de intentar hacer focus
        // Usar requestAnimationFrame para esperar al siguiente ciclo de renderizado
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Después de dos frames, el input debería estar renderizado
            if (type === 'number' && !autoSave) {
              console.log('[InlineFieldEditor] useEffect - Intentando focus después de renderizado (intento 1)', { placeholder, hasInputRef: !!inputRef.current });
            }
            if (inputRef.current && isEditing) {
              focusAndSelectInput();
            } else {
              // Si aún no hay ref, esperar un poco más
              setTimeout(() => {
                if (type === 'number' && !autoSave) {
                  console.log('[InlineFieldEditor] useEffect - Intentando focus después de delay (intento 2)', { placeholder, hasInputRef: !!inputRef.current });
                }
                if (inputRef.current && isEditing) {
                  focusAndSelectInput();
                } else {
                  // Último intento después de un delay más largo
                  setTimeout(() => {
                    if (type === 'number' && !autoSave) {
                      console.log('[InlineFieldEditor] useEffect - Intentando focus después de delay largo (intento 3)', { placeholder, hasInputRef: !!inputRef.current });
                    }
                    if (inputRef.current && isEditing) {
                      focusAndSelectInput();
                    } else {
                      // Si después de todos los intentos no hay ref, marcar como listo de todas formas
                      if (type === 'number' && !autoSave) {
                        console.log('[InlineFieldEditor] useEffect - No se pudo obtener ref, marcando como listo', { placeholder });
                      }
                      setIsInputReady(true);
                    }
                  }, 100);
                }
              }, 50);
            }
          });
        });
      }
    }
    // Limpiar timeouts al desmontar o cambiar de modo edición
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (selectBlurTimeoutRef.current) {
        clearTimeout(selectBlurTimeoutRef.current);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      if (inputReadyTimeoutRef.current) {
        clearTimeout(inputReadyTimeoutRef.current);
      }
    };
  }, [value, isEditing, showDropdown, onDropdownClose, type, status, autoSave, placeholder, focusAndSelectInput]);
  
  const exitEditing = useCallback((force = false) => {
    // Logs solo para PROVEEDOR (select con autoSave) y Gastos Pto (number sin autoSave)
    if ((type === 'select' && autoSave) || (type === 'number' && !autoSave)) {
      const stack = new Error().stack;
      console.log('[InlineFieldEditor] exitEditing - LLAMADO', { type, autoSave, placeholder, force, isEditing, selectInteractionRef: selectInteractionRef.current, stack });
    }
    // Para campos number/text sin autoSave, solo cerrar si es explícito (force=true o botones)
    if (!force && (type === 'number' || type === 'text') && !autoSave) {
      if (type === 'number' && !autoSave) {
        console.log('[InlineFieldEditor] exitEditing - BLOQUEADO: number sin autoSave y sin force', { placeholder });
      }
      return;
    }
    // No cerrar si el usuario está interactuando con el select, salvo que se fuerce (botón X o click fuera confirmado)
    if (!force && type === 'select' && selectInteractionRef.current) {
      if (type === 'select' && autoSave) {
        console.log('[InlineFieldEditor] exitEditing - BLOQUEADO: select con interacción activa');
      }
      // Para selects, no cerrar inmediatamente si hay interacción activa
      // El flag se reseteará automáticamente después de que el usuario termine de interactuar
      return;
    }
    
    if ((type === 'select' && autoSave) || (type === 'number' && !autoSave)) {
      console.log('[InlineFieldEditor] exitEditing - CERRANDO', { type, autoSave });
    }
    // Limpiar timeouts antes de cerrar
    if (selectBlurTimeoutRef.current) {
      clearTimeout(selectBlurTimeoutRef.current);
      selectBlurTimeoutRef.current = null;
    }
    if (selectExitEditingTimeoutRef.current) {
      clearTimeout(selectExitEditingTimeoutRef.current);
      selectExitEditingTimeoutRef.current = null;
    }
    
    // Log para rastrear cuando se cambia isEditing a false
    if ((type === 'select' && autoSave) || (type === 'number' && !autoSave)) {
      console.log('[InlineFieldEditor] exitEditing - Cambiando isEditing a false', { type, autoSave, placeholder, force });
    }
    setIsEditing(false);
    // No resetear draft aquí - el primer useEffect se encargará cuando isEditing cambie a false
    setSearchTerm('');
    if (showDropdown) {
      setShowDropdown(false);
      onDropdownClose?.();
    }
    setHighlightedIndex(-1);
    setStatus('idle');
    setError(null); // Limpiar error al salir de edición
    selectInteractionRef.current = false;
    onEditEnd?.(); // Notificar que terminó la edición
    if ((type === 'select' && autoSave) || (type === 'number' && !autoSave)) {
      console.log('[InlineFieldEditor] exitEditing - COMPLETADO', { type });
    }
  }, [type, showDropdown, onDropdownClose, onEditEnd, autoSave, isEditing, placeholder]);

  // Efecto para cerrar el modo de edición cuando el valor se actualiza después de guardar
  // IMPORTANTE: Solo se ejecuta cuando status cambia de 'saving' a 'idle' después de guardar exitosamente
  // Para selects con autoSave, mantener el editor abierto para permitir múltiples selecciones
  // Para combobox, cerrar automáticamente después de guardar (para campos como INCOTERM, MÉTODO EMBARQUE, CRCY)
  // Para campos number/text sin autoSave, NO cerrar automáticamente - dejar que el usuario cierre manualmente (como PRECIO COMPRA)
  useEffect(() => {
    // Rastrear si estábamos guardando antes
    if (status === 'saving') {
      wasSavingBeforeRef.current = true;
    }
    
    // Solo procesar cuando el status cambia de 'saving' a 'idle' (indicando que se guardó exitosamente)
    // Y que realmente estábamos guardando antes (no solo entrando en modo edición)
    if (isEditing && wasSavingBeforeRef.current && status === 'idle') {
      wasSavingBeforeRef.current = false; // Resetear el flag después de procesar
      
      const normalizedValue = normalizeValue(value);
      const normalizedDraft = normalizeValue(draft);
      // Si el valor del padre coincide con el draft, significa que se guardó correctamente
      // Permitir también cuando ambos son '' o null (valores vacíos)
      if (normalizedValue === normalizedDraft) {
        // Con closeOnlyOnEnterOrSelect, text/number/date/time solo se cierran con Enter o check verde
        if (closeOnlyOnEnterOrSelect && (type === 'text' || type === 'number' || type === 'date' || type === 'time')) {
          return;
        }
        // Para combobox, cerrar automáticamente después de guardar
        if (type === 'combobox') {
          // Cerrar el dropdown si está abierto
          if (showDropdown) {
            setShowDropdown(false);
            onDropdownClose?.();
          }
          // Cerrar el modo edición usando exitEditing (función estable via useCallback)
          setTimeout(() => {
            exitEditing();
          }, 100);
          return;
        }
        // Para selects con autoSave, cerrar automáticamente después de guardar
        if (type === 'select' && autoSave) {
          setTimeout(() => {
            exitEditing();
          }, 100);
          return;
        }
        // Para selects sin autoSave, mantener abierto después de guardar para permitir otra selección
        if (type === 'select' && !autoSave) {
          // Mantener el editor abierto, pero permitir que se cierre si el usuario hace click fuera
          // El flag selectInteractionRef se reseteará después de que el usuario termine de interactuar
          return;
        }
        // Para campos number/text con autoSave, cerrar automáticamente después de guardar
        // Para campos number/text SIN autoSave, NO cerrar automáticamente - mantener abierto para permitir múltiples ediciones (como PRECIO COMPRA)
        if (autoSave) {
          // Solo cerrar automáticamente si autoSave está activo
          if (!selectInteractionRef.current) {
            setIsEditing(false);
          }
        }
        // Si NO tiene autoSave, mantener el editor abierto (usuario debe cerrar manualmente con botones ✓ o X)
      }
    }
    
    // Actualizar el ref del status previo
    previousStatusRef.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, draft, isEditing, status, autoSave, type, showDropdown, onDropdownClose, closeOnlyOnEnterOrSelect]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Usar un pequeño delay para asegurar que el input esté completamente renderizado y listo para recibir focus
      // Esto previene problemas donde el campo se cierra inmediatamente después de abrirse
      const focusTimeout = setTimeout(() => {
        if (!inputRef.current || !isEditing) return; // Verificar que todavía estemos en modo edición
        
        if (type === 'combobox') {
          // En combobox, inicializar searchTerm con el valor actual para permitir editar
          setSearchTerm(normalizeValue(value));
          // Abrir automáticamente el dropdown cuando se entra en modo edición
          if (!showDropdown) {
            setShowDropdown(true);
            onDropdownOpen?.();
          }
        }
        
        try {
          inputRef.current.focus();
          
          if (type === 'combobox' && inputRef.current instanceof HTMLInputElement) {
            // NO seleccionar texto en combobox - dejar el cursor al final para que el usuario vea el valor
            // El dropdown ya se abrirá automáticamente
            const length = inputRef.current.value.length;
            inputRef.current.setSelectionRange(length, length);
          } else if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
            // Para campos number/text, seleccionar todo el texto para facilitar la edición
            // Usar múltiples intentos para asegurar que la selección funcione
            const inputEl = inputRef.current as HTMLInputElement;
            try {
              inputEl.select();
              // Verificar que la selección funcionó, si no, reintentar
              if (inputEl.selectionStart === inputEl.selectionEnd && inputEl.value.length > 0) {
                setTimeout(() => {
                  try {
                    inputEl.select();
                  } catch {
                    // no-op
                  }
                }, 20);
              }
            } catch {
              // Si select() falla, intentar con setSelectionRange
              try {
                inputEl.setSelectionRange(0, inputEl.value.length);
              } catch {
                // no-op
              }
            }
          }
        } catch (error) {
          // Ignorar errores de focus (puede ocurrir si el componente se desmontó)
          console.debug('Error al hacer focus en input:', error);
        }
      }, 10); // Pequeño delay para asegurar que el DOM esté listo
      
        return () => {
        clearTimeout(focusTimeout);
      };
    }
  }, [isEditing, type, value, showDropdown, onDropdownOpen, focusAndSelectInput]);

  // Calcular posición del dropdown para combobox
  useEffect(() => {
    if (type === 'combobox' && showDropdown) {
      const updatePosition = () => {
        if (inputRef.current instanceof HTMLInputElement) {
          const rect = inputRef.current.getBoundingClientRect();
          if (rect) {
            const dropdownHeight = 240; // max-h-60 = 240px aproximadamente
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const openUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
            
            // Usar exactamente el mismo ancho que el input para que el dropdown coincida con el elemento
            const dropdownWidth = rect.width;
            
            setDropdownPosition({
              top: openUpward ? undefined : rect.bottom + 4,
              bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
              left: rect.left,
              width: dropdownWidth,
              openUpward,
            });
          }
        }
      };
      // Usar múltiples intentos para asegurar que el DOM esté actualizado
      updatePosition();
      const timeoutId1 = setTimeout(updatePosition, 0);
      const timeoutId2 = setTimeout(updatePosition, 10);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        clearTimeout(timeoutId1);
        clearTimeout(timeoutId2);
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    } else if (!showDropdown) {
      setDropdownPosition(null);
    }
  }, [type, showDropdown, isEditing]);

  // Filtrar opciones para combobox
  const filteredOptions = type === 'combobox' 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Cerrar dropdown al hacer click fuera (para combobox, select, y campos number/text sin autoSave)
  useEffect(() => {
    if (isEditing && type === 'select') {
      let clickOutsideTimeout: NodeJS.Timeout | null = null;
      
      // Para selects, usar un detector de click fuera más robusto
      // El blur del select nativo se IGNORA completamente - solo cerramos por click fuera confirmado
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        
        // Verificar si el click es dentro de nuestro select o su contenedor
        const isClickInsideSelect = inputRef.current && 
          (inputRef.current.contains(target) || inputRef.current === target);
        const isClickInsideContainer = selectContainerRef.current && 
          selectContainerRef.current.contains(target);
        
        // Verificar si el click es en un elemento relacionado con select (opciones, etc.)
        const isClickOnSelectRelated = target instanceof Element && (
          target.tagName === 'SELECT' ||
          target.tagName === 'OPTION' ||
          target.closest('select') === inputRef.current ||
          target.closest('[role="listbox"]') ||
          // Verificar si está dentro de cualquier select en el documento
          (target.closest('select') && target.closest('select') === inputRef.current)
        );
        
        if (isClickInsideSelect || isClickInsideContainer || isClickOnSelectRelated) {
          // El click está dentro del select o su dropdown nativo, mantener abierto
          selectInteractionRef.current = true;
          
          // Limpiar cualquier timeout de cierre pendiente
          if (clickOutsideTimeout) {
            clearTimeout(clickOutsideTimeout);
            clickOutsideTimeout = null;
          }
          if (selectBlurTimeoutRef.current) {
            clearTimeout(selectBlurTimeoutRef.current);
            selectBlurTimeoutRef.current = null;
          }
          return;
        }
        
        // El click está REALMENTE fuera del select
        // Usar un delay para asegurarnos de que no es parte de la apertura del dropdown
        if (clickOutsideTimeout) {
          clearTimeout(clickOutsideTimeout);
        }
        
        clickOutsideTimeout = setTimeout(() => {
          // Verificación final antes de cerrar
          const currentActive = document.activeElement;
          
          // Si el elemento activo sigue siendo nuestro select, no cerrar
          if (currentActive === inputRef.current || 
              (inputRef.current && inputRef.current.contains(currentActive as Node))) {
            return;
          }
          
          // Verificar una vez más si estamos dentro del contenedor
          if (selectContainerRef.current && selectContainerRef.current.contains(currentActive as Node)) {
            return;
          }
          
          // Con closeOnlyOnEnterOrSelect, no cerrar al hacer click fuera: solo al elegir opción o Enter
          if (closeOnlyOnEnterOrSelect) return;
          // Realmente estamos fuera - cerrar el editor
          selectInteractionRef.current = false;
          exitEditing(true);
        }, 300); // Delay razonable para permitir que el dropdown nativo se abra completamente
      };
      
      // Agregar listeners con delay para evitar que el click inicial cierre el editor
      const timeoutId = setTimeout(() => {
        // Usar capture phase para detectar antes de que otros handlers puedan interferir
        document.addEventListener('mousedown', handleClickOutside, true);
        document.addEventListener('click', handleClickOutside, true);
      }, 250); // Delay inicial suficiente para que el select se inicialice completamente
      
      return () => {
        clearTimeout(timeoutId);
        if (clickOutsideTimeout) {
          clearTimeout(clickOutsideTimeout);
        }
        if (selectBlurTimeoutRef.current) {
          clearTimeout(selectBlurTimeoutRef.current);
          selectBlurTimeoutRef.current = null;
        }
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.removeEventListener('click', handleClickOutside, true);
      };
    } else if (type === 'combobox' && showDropdown) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          comboboxRef.current && 
          !comboboxRef.current.contains(target) &&
          !(target instanceof Element && target.closest('[class*="fixed z-[99999]"]'))
        ) {
          setShowDropdown(false);
          onDropdownClose?.();
        }
      };
      // Usar un delay mayor para evitar que el click que abre el dropdown lo cierre inmediatamente
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true);
      }, 200);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside, true);
      };
    }
  }, [type, showDropdown, onDropdownClose, isEditing, exitEditing, status, autoSave, closeOnlyOnEnterOrSelect]);

  const parseDraft = (): string | number | null => {
    if (type === 'number') {
      if (draft === '') return null;
      // Remover separadores de miles (puntos) y comas, mantener solo dígitos y punto decimal
      let cleaned = draft.toString().replace(/\./g, ''); // Remover puntos (separadores de miles)
      cleaned = cleaned.replace(/,/g, '.'); // Reemplazar coma por punto decimal
      const numericValue = Number(cleaned);
      if (Number.isNaN(numericValue)) {
        throw new Error('Número inválido');
      }
      return numericValue;
    }

    if (type === 'date' || type === 'time') {
      return draft || null;
    }

    if (draft.trim() === '') {
      return null;
    }

    return draft.trim();
  };

  const handleSave = async () => {
    // Logs solo para Gastos Pto (number sin autoSave)
    if (type === 'number' && !autoSave) {
      console.log('[InlineFieldEditor] handleSave - INICIO (Gastos Pto)', { type, autoSave, draft, value, isEditing });
    }
    try {
      // Para date/time: leer del DOM para no perder la fecha recién elegida si el usuario pulsa check/Enter antes de que React actualice draft
      let valueToParse = draft;
      if ((type === 'date' || type === 'time') && inputRef.current && (inputRef.current as HTMLInputElement).value) {
        valueToParse = (inputRef.current as HTMLInputElement).value;
      }
      const parsed = type === 'date' || type === 'time'
        ? (valueToParse || null)
        : parseDraft();
      const currentValue = value === undefined ? null : value;

      // Si el valor no cambió, cerrar el editor de todas formas cuando se presiona Enter
      // Esto permite que el usuario cierre el campo incluso si no hizo cambios
      if (parsed === currentValue || (parsed === null && (currentValue === null || currentValue === ''))) {
        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] handleSave - Sin cambios, cerrando (Gastos Pto)', { parsed, currentValue });
        }
        // Cerrar el editor para todos los tipos cuando no hay cambios
        exitEditing();
        return;
      }

      if (type === 'number' && !autoSave) {
        console.log('[InlineFieldEditor] handleSave - Guardando (Gastos Pto)', { parsed, currentValue, type });
      }
      setStatus('saving');
      await onSave(parsed);
      setStatus('idle');
      if (type === 'number' && !autoSave) {
        console.log('[InlineFieldEditor] handleSave - Guardado exitoso, cerrando (Gastos Pto)', { type, autoSave });
      }
      // Cuando se guarda explícitamente (Enter o botón), cerrar el editor para todos los tipos
      // Esto aplica a todos los campos: select, combobox, number, text
      if (type === 'select') {
        if (!keepOpenOnAutoSave) {
          setTimeout(() => {
            exitEditing();
          }, 100);
        } else {
          // Mantener abierto; solo resetear estados de interacción
          selectInteractionRef.current = false;
        }
      } else if (type === 'combobox') {
        // Cerrar el dropdown si está abierto
        if (showDropdown) {
          setShowDropdown(false);
          onDropdownClose?.();
        }
        setTimeout(() => {
          exitEditing();
        }, 100);
      } else {
        // Para campos number/text, cerrar después de guardar
        setIsEditing(false);
        onEditEnd?.(); // Notificar que terminó la edición
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      if (type === 'number' && !autoSave) {
        console.error('[InlineFieldEditor] handleSave - ERROR (Gastos Pto)', { error, type });
      }
      if (error?.message === 'CHANGE_CANCELLED') {
        exitEditing();
        return;
      }
      setStatus('error');
      setError(error?.message || 'No se pudo guardar');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (type === 'combobox' && showDropdown) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (event.key === 'Enter' && highlightedIndex >= 0) {
        event.preventDefault();
        const selectedOption = filteredOptions[highlightedIndex];
        setDraft(selectedOption.value);
        setSearchTerm('');
        setShowDropdown(false);
        onDropdownClose?.();
        handleSaveWithValue(selectedOption.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setShowDropdown(false);
        onDropdownClose?.();
        setHighlightedIndex(-1);
      }
    } else {
      if (event.key === 'Enter' && type !== 'textarea') {
        // Logs solo para Gastos Pto (number sin autoSave)
        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] handleKeyDown - Enter (Gastos Pto)', { type, autoSave, draft, value });
        }
        if (type === 'combobox' && autoSave) {
          // Para combobox con autoSave, aplicar la misma lógica robusta que select con autoSave
          event.preventDefault();
          event.stopPropagation();
          // CRÍTICO: Cancelar cualquier timeout pendiente de exitEditing del onChange anterior
          if (selectExitEditingTimeoutRef.current) {
            clearTimeout(selectExitEditingTimeoutRef.current);
            selectExitEditingTimeoutRef.current = null;
          }
          // CRÍTICO: Resetear selectInteractionRef antes de guardar para permitir que exitEditing cierre el campo
          selectInteractionRef.current = false;
          // Si hay un guardado en progreso, simplemente cerrar el campo sin guardar de nuevo
          if (status === 'saving') {
            exitEditing(true);
            return;
          }
          // Guardar y cerrar usando handleSave para asegurar cierre correcto
          handleSave();
        } else if (type === 'combobox' && !autoSave) {
          // En combobox sin autoSave, Enter guarda el valor actual sin cerrar
          event.preventDefault();
          handleSave();
        } else {
          event.preventDefault();
          handleSave();
        }
      } else if (event.key === 'Escape') {
        if (type === 'number' && !autoSave) {
          console.log('[InlineFieldEditor] handleKeyDown - Escape (Gastos Pto)');
        }
        event.preventDefault();
        exitEditing(true);
      }
    }
  };

  const handleSaveWithValue = async (val: string) => {
    // Logs solo para PROVEEDOR (select con autoSave)
    if (type === 'select' && autoSave) {
      console.log('[InlineFieldEditor] handleSaveWithValue - INICIO (PROVEEDOR)', { type, autoSave, val, value, isEditing });
    }
    try {
      const currentValue = value === undefined ? null : value;
      const normalizedCurrent = normalizeValue(currentValue);
      const normalizedVal = normalizeValue(val);
      
      // Si el valor no cambió, cerrar el editor de todas formas (especialmente para selects cuando se presiona Enter)
      if (normalizedVal === normalizedCurrent) {
        if (type === 'select' && autoSave) {
          console.log('[InlineFieldEditor] handleSaveWithValue - Sin cambios, cerrando (PROVEEDOR)', { normalizedVal, normalizedCurrent });
        }
        // Cerrar el editor para todos los tipos cuando no hay cambios
        exitEditing();
        return;
      }
      
      if (type === 'select' && autoSave) {
        console.log('[InlineFieldEditor] handleSaveWithValue - Guardando (PROVEEDOR)', { val, currentValue, type, autoSave });
      }
      setStatus('saving');
      await onSave(val);
      // Actualizar el draft al valor guardado
      setDraft(normalizeValue(val));
      // Resetear el status a idle después de guardar exitosamente
      setStatus('idle');
      if (type === 'select' && autoSave) {
        console.log('[InlineFieldEditor] handleSaveWithValue - Guardado exitoso, cerrando (PROVEEDOR)', { type, autoSave });
      }
      // Para combobox con autoSave, aplicar la misma lógica robusta que select con autoSave
      // Para combobox sin autoSave, mantener el comportamiento original
      if (type === 'combobox' && autoSave) {
        // Cerrar el dropdown si está abierto
        if (showDropdown) {
          setShowDropdown(false);
          onDropdownClose?.();
        }
        // Aplicar la misma lógica robusta que select con autoSave
        // Cancelar cualquier timeout pendiente antes de crear uno nuevo
        if (selectExitEditingTimeoutRef.current) {
          clearTimeout(selectExitEditingTimeoutRef.current);
          selectExitEditingTimeoutRef.current = null;
        }
        selectExitEditingTimeoutRef.current = setTimeout(() => {
          selectExitEditingTimeoutRef.current = null;
          // CRÍTICO: Resetear selectInteractionRef antes de cerrar para evitar bloqueo
          // El ref puede estar en true desde el onChange o eventos de interacción
          selectInteractionRef.current = false;
          exitEditing();
        }, 100);
      } else if (type === 'combobox' && !autoSave) {
        // Para combobox sin autoSave, mantener el comportamiento original
        // Cerrar el dropdown si está abierto
        if (showDropdown) {
          setShowDropdown(false);
          onDropdownClose?.();
        }
        // Cerrar el modo edición después de un pequeño delay para permitir que se actualice el estado
        setTimeout(() => {
          exitEditing();
        }, 100);
      } else if (type === 'select' && autoSave) {
        // Para selects con autoSave, cerrar automáticamente después de guardar
        // Cancelar cualquier timeout pendiente antes de crear uno nuevo
        if (selectExitEditingTimeoutRef.current) {
          clearTimeout(selectExitEditingTimeoutRef.current);
          selectExitEditingTimeoutRef.current = null;
        }
        selectExitEditingTimeoutRef.current = setTimeout(() => {
          if (type === 'select' && autoSave) {
            console.log('[InlineFieldEditor] handleSaveWithValue - Ejecutando exitEditing para PROVEEDOR');
          }
          selectExitEditingTimeoutRef.current = null;
          // CRÍTICO: Resetear selectInteractionRef antes de cerrar para evitar bloqueo
          // El ref puede estar en true desde el onChange o eventos de interacción
          selectInteractionRef.current = false;
          if (type === 'select' && autoSave) {
            console.log('[InlineFieldEditor] handleSaveWithValue - Reseteando selectInteractionRef antes de exitEditing (PROVEEDOR)');
          }
          exitEditing();
        }, 100);
      }
      // Para otros tipos (number/text sin autoSave), NO cerrar automáticamente - mantener abierto para permitir múltiples ediciones
    } catch (err: unknown) {
      const error = err as { message?: string };
      if (type === 'select' && autoSave) {
        console.error('[InlineFieldEditor] handleSaveWithValue - ERROR (PROVEEDOR)', { error, type, val });
      }
      if (error?.message === 'CHANGE_CANCELLED') {
        exitEditing();
        return;
      }
      setStatus('error');
      setError(error?.message || 'No se pudo guardar');
      // Revertir el draft si hay error
      setDraft(normalizeValue(value));
    }
  };

  const renderInput = () => {
    if (type === 'textarea') {
      return (
        <textarea
          ref={(el) => (inputRef.current = el)}
          className={`w-full border ${status === 'error' ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${status === 'error' ? 'focus:ring-red-500' : 'focus:ring-brand-red'} ${inputClassName}`}
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      );
    }

    if (type === 'select') {
      return (
        <div 
          ref={selectContainerRef} 
          className="relative" 
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <select
            ref={(el) => {
              inputRef.current = el;
              // Cuando se asigna la referencia, si está en modo edición, asegurar focus
              if (el && isEditing) {
                setTimeout(() => {
                  if (el && isEditing && document.activeElement !== el) {
                    try {
                      el.focus();
                      selectInteractionRef.current = true;
                    } catch {
                      // Ignorar errores de focus
                    }
                  }
                }, 0);
              }
            }}
            className={`min-w-[120px] max-w-[200px] w-full border ${status === 'error' ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${status === 'error' ? 'focus:ring-red-500' : 'focus:ring-brand-red'} ${inputClassName}`}
            value={draft}
            onChange={(e) => {
              const newValue = e.target.value;
              // Logs solo para PROVEEDOR (select con autoSave)
              if (type === 'select' && autoSave) {
                console.log('[InlineFieldEditor] select onChange (PROVEEDOR)', { type, autoSave, newValue, currentValue: value, isEditing });
              }
              setDraft(newValue);
              // Marcar que el usuario está interactuando - mantener activo
              selectInteractionRef.current = true;
              // Si autoSave está activado, guardar automáticamente
              if (autoSave) {
                if (type === 'select' && autoSave) {
                  console.log('[InlineFieldEditor] select onChange - autoSave activo, guardando en 50ms (PROVEEDOR)');
                }
                // Guardar inmediatamente cuando se selecciona un valor
                // Usar un pequeño delay para permitir que el select complete su acción
                setTimeout(() => {
                  if (type === 'select' && autoSave) {
                    console.log('[InlineFieldEditor] select onChange - Llamando handleSaveWithValue (PROVEEDOR)');
                  }
                  handleSaveWithValue(newValue);
                  // Mantener el flag activo después de guardar para permitir otra selección
                  setTimeout(() => {
                    if (type === 'select' && autoSave) {
                      console.log('[InlineFieldEditor] select onChange - Reseteando selectInteractionRef (PROVEEDOR)');
                    }
                    selectInteractionRef.current = false;
                  }, 300);
                }, 50); // Reducido de 150ms a 50ms para respuesta más rápida
              } else {
                // Para selects sin autoSave, mantener el editor abierto después de seleccionar
                // El usuario puede hacer otra selección o hacer click fuera para cerrar
                selectInteractionRef.current = true;
                // Resetear después de un tiempo razonable
                setTimeout(() => {
                  selectInteractionRef.current = false;
                }, 500);
              }
            }}
            onFocus={(e) => {
              // Prevenir que el focus se propague
              e.stopPropagation();
              selectInteractionRef.current = true;
              // Limpiar cualquier timeout de blur pendiente
              if (selectBlurTimeoutRef.current) {
                clearTimeout(selectBlurTimeoutRef.current);
                selectBlurTimeoutRef.current = null;
              }
            }}
            onMouseDown={(e) => {
              // Prevenir que el mousedown cierre el editor
              e.stopPropagation();
              // NO usar preventDefault - el select nativo necesita manejar el mousedown para abrir el dropdown
              selectInteractionRef.current = true;
              // Limpiar cualquier timeout de blur pendiente
              if (selectBlurTimeoutRef.current) {
                clearTimeout(selectBlurTimeoutRef.current);
                selectBlurTimeoutRef.current = null;
              }
            }}
            onMouseUp={(e) => {
              // Asegurar que después de mouseup, el select mantenga interacción activa
              e.stopPropagation();
              selectInteractionRef.current = true;
              // Dar focus de nuevo si se perdió
              setTimeout(() => {
                if (inputRef.current && isEditing && document.activeElement !== inputRef.current) {
                  try {
                    inputRef.current.focus();
                  } catch {
                    // Ignorar errores
                  }
                }
              }, 10);
            }}
            onClick={(e) => {
              // Prevenir que el click se propague y cierre el editor
              e.stopPropagation();
              selectInteractionRef.current = true;
              // Limpiar cualquier timeout de blur pendiente
              if (selectBlurTimeoutRef.current) {
                clearTimeout(selectBlurTimeoutRef.current);
                selectBlurTimeoutRef.current = null;
              }
              // Asegurar que el select tenga focus cuando se hace click
              if (inputRef.current && document.activeElement !== inputRef.current) {
                setTimeout(() => {
                  if (inputRef.current && isEditing) {
                    try {
                      inputRef.current.focus();
                    } catch {
                      // Ignorar errores
                    }
                  }
                }, 0);
              }
            }}
            onBlur={() => {
              // CRÍTICO: El blur del select nativo se dispara cuando se abre el dropdown
              // Esto es NORMAL y esperado - NO debemos cerrar el editor en este caso
              
              // Marcar que hay interacción activa (el usuario está interactuando con el select)
              selectInteractionRef.current = true;
              
              // Limpiar timeout anterior si existe
              if (selectBlurTimeoutRef.current) {
                clearTimeout(selectBlurTimeoutRef.current);
              }
              
              // IGNORAR completamente el blur - no hacer nada
              // El detector de click fuera se encargará de cerrar el editor solo cuando
              // realmente se haga click fuera del select y su dropdown
            }}
            onKeyDown={(event) => {
              // Permitir Escape para cerrar el editor manualmente
              if (event.key === 'Escape') {
                if (type === 'select' && autoSave) {
                  console.log('[InlineFieldEditor] select onKeyDown - Escape (PROVEEDOR)');
                }
                event.preventDefault();
                event.stopPropagation();
                exitEditing(true);
              } else if (event.key === 'Enter') {
                // Logs solo para PROVEEDOR (select con autoSave)
                if (type === 'select' && autoSave) {
                  console.log('[InlineFieldEditor] select onKeyDown - Enter (PROVEEDOR)', { type, autoSave, draft, value, status });
                }
                // Enter guarda el valor actual del select y cierra el editor
                event.preventDefault();
                event.stopPropagation();
                // CRÍTICO: Cancelar cualquier timeout pendiente de exitEditing del onChange anterior
                if (selectExitEditingTimeoutRef.current) {
                  clearTimeout(selectExitEditingTimeoutRef.current);
                  selectExitEditingTimeoutRef.current = null;
                  if (type === 'select' && autoSave) {
                    console.log('[InlineFieldEditor] select onKeyDown - Cancelando timeout pendiente de exitEditing (PROVEEDOR)');
                  }
                }
                // CRÍTICO: Resetear selectInteractionRef antes de guardar para permitir que exitEditing cierre el campo
                // Esto es necesario porque el ref puede estar en true desde el onChange anterior
                selectInteractionRef.current = false;
                if (type === 'select' && autoSave) {
                  console.log('[InlineFieldEditor] select onKeyDown - Reseteando selectInteractionRef (PROVEEDOR)');
                }
                
                // Si hay un guardado en progreso, simplemente cerrar el campo sin guardar de nuevo
                // El guardado del onChange ya está en progreso y se completará
                // Usar force: true para forzar el cierre incluso si selectInteractionRef está en true
                if (status === 'saving') {
                  if (type === 'select' && autoSave) {
                    console.log('[InlineFieldEditor] select onKeyDown - Guardado en progreso, cerrando directamente con force (PROVEEDOR)');
                  }
                  exitEditing(true);
                  return;
                }
                
                // Obtener el valor actual del select directamente
                const selectElement = event.currentTarget as HTMLSelectElement;
                const currentSelectValue = selectElement.value;
                if (type === 'select' && autoSave) {
                  console.log('[InlineFieldEditor] select onKeyDown - Llamando handleSaveWithValue con (PROVEEDOR)', { currentSelectValue });
                }
                // Guardar y cerrar usando handleSaveWithValue para asegurar cierre correcto
                handleSaveWithValue(currentSelectValue);
              }
            }}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (type === 'combobox') {
      return (
        <>
          <div ref={comboboxRef} className="relative w-auto inline-block">
            <div className="relative">
              <input
                ref={(el) => (inputRef.current = el)}
                type="text"
                className={`border ${status === 'error' ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 ${status === 'error' ? 'focus:ring-red-500' : 'focus:ring-brand-red'} ${inputClassName || 'min-w-[80px] max-w-[120px] w-auto'}`}
                value={searchTerm !== '' ? searchTerm : draft}
                onChange={(e) => {
                  const newSearch = e.target.value;
                  setSearchTerm(newSearch);
                  setDraft(newSearch);
                  if (!showDropdown) {
                    setShowDropdown(true);
                    onDropdownOpen?.();
                  }
                  setHighlightedIndex(-1);
                }}
                onFocus={(e) => {
                  e.stopPropagation(); // Prevenir que el focus se propague
                  // Abrir dropdown automáticamente al hacer focus
                  if (!showDropdown) {
                    setShowDropdown(true);
                    onDropdownOpen?.();
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation(); // Prevenir que el click se propague
                  // Abrir dropdown automáticamente al hacer click
                  if (!showDropdown) {
                    setShowDropdown(true);
                    onDropdownOpen?.();
                  }
                }}
                onMouseDown={(e) => {
                  e.stopPropagation(); // Prevenir que el mousedown se propague
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
              />
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          {showDropdown && filteredOptions.length > 0 && (
            <div
              className="fixed z-[99999] bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-auto"
              style={
                dropdownPosition
                  ? {
                      ...(dropdownPosition.openUpward
                        ? { bottom: `${dropdownPosition.bottom}px` }
                        : { top: `${dropdownPosition.top}px` }),
                      left: `${dropdownPosition.left}px`,
                      width: `${dropdownPosition.width}px`,
                    }
                  : { display: 'none' }
              }
            >
              {filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                    index === highlightedIndex ? 'bg-blue-100' : ''
                  } ${option.value === draft ? 'bg-blue-50 font-semibold' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevenir que el click se propague y expanda tarjetas
                    setDraft(option.value);
                    setSearchTerm('');
                    setShowDropdown(false);
                    onDropdownClose?.();
                    handleSaveWithValue(option.value);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
          {showDropdown && searchTerm && filteredOptions.length === 0 && (
            <div
              className="fixed z-[99999] bg-white border border-gray-300 rounded-lg shadow-xl px-3 py-2 text-sm text-gray-500"
              style={
                dropdownPosition
                  ? {
                      ...(dropdownPosition.openUpward
                        ? { bottom: `${dropdownPosition.bottom}px` }
                        : { top: `${dropdownPosition.top}px` }),
                      left: `${dropdownPosition.left}px`,
                      width: `${dropdownPosition.width}px`,
                    }
                  : { display: 'none' }
              }
            >
              No se encontraron resultados
            </div>
          )}
        </>
      );
    }

    const isNumberInput = type === 'number';
    const isDateInput = type === 'date' || type === 'time';
    return (
      <input
        ref={(el) => {
          if (type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] ref callback - Ref asignado', { placeholder, el: !!el, isEditing, previousRef: !!inputRef.current });
          }
          // Si el ref se está desmontando (el es null), registrar
          if (!el && inputRef.current && type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] ref callback - Input DESMONTADO', { placeholder, isEditing });
          }
          inputRef.current = el;
          // Cuando el ref se asigna, si estamos en modo edición, intentar hacer focus inmediatamente
          if (el && isEditing && (type === 'number' || type === 'text')) {
            if (type === 'number' && !autoSave) {
              console.log('[InlineFieldEditor] ref callback - Input montado, intentando focus inmediato', { placeholder });
            }
            // Usar requestAnimationFrame para asegurar que el input esté completamente en el DOM
            requestAnimationFrame(() => {
              if (el && isEditing && document.activeElement !== el) {
                try {
                  el.focus();
                  if (type === 'text' || type === 'number') {
                    el.select();
                  }
                  setIsInputReady(true);
                  if (type === 'number' && !autoSave) {
                    console.log('[InlineFieldEditor] ref callback - Focus exitoso', { placeholder, activeElement: document.activeElement === el });
                  }
                } catch (err) {
                  if (type === 'number' && !autoSave) {
                    console.log('[InlineFieldEditor] ref callback - Error en focus', { placeholder, error: err });
                  }
                }
              } else {
                if (type === 'number' && !autoSave) {
                  console.log('[InlineFieldEditor] ref callback - Focus cancelado', { placeholder, hasEl: !!el, isEditing, activeElement: document.activeElement });
                }
              }
            });
          } else if (el && !isEditing && type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] ref callback - Input montado pero NO en modo edición', { placeholder });
          }
        }}
        type={isNumberInput ? 'text' : type === 'date' ? 'date' : type === 'time' ? 'time' : 'text'}
        inputMode={isNumberInput ? 'decimal' : undefined}
        pattern={isNumberInput ? '[0-9.,]*' : undefined}
        className={`min-w-[100px] max-w-[180px] w-full border ${status === 'error' ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${status === 'error' ? 'focus:ring-red-500' : 'focus:ring-brand-red'} ${inputClassName}`}
        value={draft}
        onChange={(e) => {
          const newValue = e.target.value;
          const input = e.target as HTMLInputElement;
          const cursorPosition = input.selectionStart || 0;
          const textBeforeCursor = newValue.substring(0, cursorPosition);
          
          // Campos que necesitan formateo con separadores de miles mientras se escribe
          const normalizedPlaceholder = (placeholder || '').toUpperCase();
          const fieldsNeedingFormat = [
            'FOB ORIGEN',
            'OCEAN',
            'OCEAN (USD)',
            'GASTOS PUERTO',
            'GASTOS PTO',
            'GASTOS PTO (COP)',
            'TRASLADOS NACIONALES',
            'PPTO DE REPARACION',
            'PPTO REPARACIÓN',
            'PVP EST',
            'PVP ESTIMADO',
            'PRECIO SUGERIDO',
            'VALOR SUGERIDO',
            'PRECIO COMPRA',
            'VALOR + BP',
            'GASTOS + LAVADO',
            'DESENSAMBLAJE + CARGUE',
          ];
          const needsFormat = type === 'number' && fieldsNeedingFormat.some(field => normalizedPlaceholder.includes(field));
          
          let formattedValue = newValue;
          
          if (needsFormat && newValue !== '') {
            // Remover todos los caracteres no numéricos
            let cleaned = newValue.replace(/[^\d]/g, '');
            
            // Si está vacío después de limpiar, permitir campo vacío
            if (cleaned === '') {
              formattedValue = '';
            } else {
              // Parsear a número
              const numValue = parseFloat(cleaned);
              if (!isNaN(numValue)) {
                // Formatear con separadores de miles (sin decimales)
                formattedValue = Math.round(numValue).toLocaleString('es-CO', { 
                  minimumFractionDigits: 0, 
                  maximumFractionDigits: 0 
                });
                
                // Calcular nueva posición del cursor
                // Contar dígitos antes del cursor en el texto original
                const digitsBeforeCursor = textBeforeCursor.replace(/[^\d]/g, '').length;
                
                // Contar dígitos hasta esa posición en el texto formateado
                let newCursorPos = 0;
                let digitsFound = 0;
                for (let i = 0; i < formattedValue.length; i++) {
                  if (/\d/.test(formattedValue[i])) {
                    digitsFound++;
                    if (digitsFound >= digitsBeforeCursor) {
                      newCursorPos = i + 1;
                      break;
                    }
                  }
                }
                if (digitsFound < digitsBeforeCursor) {
                  newCursorPos = formattedValue.length;
                }
                
                // Restaurar posición del cursor después del formateo
                setTimeout(() => {
                  if (input && document.activeElement === input) {
                    input.setSelectionRange(newCursorPos, newCursorPos);
                  }
                }, 0);
              }
            }
          }
          
          setDraft(formattedValue);
          
          // Si autoSave está activado, guardar automáticamente después de un delay
          if (autoSave) {
            if (autoSaveTimeoutRef.current) {
              clearTimeout(autoSaveTimeoutRef.current);
            }
            // Para campos de texto, usar un delay más largo (2000ms) para permitir que el usuario escriba
            // Para campos de fecha, usar un delay intermedio (1000ms)
            const delay = type === 'date' || type === 'time' ? 1000 : 2000;
            autoSaveTimeoutRef.current = setTimeout(() => {
              handleSaveWithValue(formattedValue);
            }, delay);
          }
        }}
        onClick={(e) => {
          const fieldName = placeholder || 'unknown';
          const isProblematicField = fieldName.includes('FOB ORIGEN') || 
                                     fieldName.includes('OCEAN') || 
                                     fieldName.includes('Gastos Puerto') || 
                                     fieldName.includes('PPTO DE REPARACION') ||
                                     fieldName.includes('PPTO Reparación') ||
                                     fieldName.includes('Traslados Nacionales');
          
          if (type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] 🖱️ number/text onClick', { fieldName, isProblematicField, isEditing, isInputReady });
          }
          e.stopPropagation(); // Prevenir que el click se propague y expanda tarjetas
          if (!isDateInput) {
            e.preventDefault(); // CRÍTICO: Prevenir comportamiento por defecto
          }
          
          // Para campos problemáticos, asegurar que el focus se mantenga
          if (type === 'number' && !autoSave && isProblematicField && inputRef.current) {
            setTimeout(() => {
              if (inputRef.current && isEditing) {
                try {
                  const inputEl = inputRef.current as HTMLInputElement;
                  if (document.activeElement !== inputEl) {
                    inputEl.focus();
                    inputEl.select();
                    setIsInputReady(true);
                    console.log('[InlineFieldEditor] 🖱️ onClick - Focus forzado', { fieldName });
                  }
                } catch (err) {
                  console.error('[InlineFieldEditor] 🖱️ onClick - Error forzando focus', { fieldName, error: err });
                }
              }
            }, 0);
          }
        }}
        onMouseDown={(e) => {
          const fieldName = placeholder || 'unknown';
          const isProblematicField = fieldName.includes('FOB ORIGEN') || 
                                     fieldName.includes('OCEAN') || 
                                     fieldName.includes('Gastos Puerto') || 
                                     fieldName.includes('PPTO DE REPARACION') ||
                                     fieldName.includes('PPTO Reparación') ||
                                     fieldName.includes('Traslados Nacionales');
          
          if (type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] 🖱️ number/text onMouseDown', { fieldName, isProblematicField, isEditing, isInputReady });
          }
          e.stopPropagation(); // Prevenir que el mousedown se propague
          if (!isDateInput) {
            e.preventDefault(); // CRÍTICO: Prevenir comportamiento por defecto que podría causar blur
          }
          
          // Para campos problemáticos, asegurar que el focus se mantenga
          if (type === 'number' && !autoSave && isProblematicField && inputRef.current) {
            setTimeout(() => {
              if (inputRef.current && isEditing) {
                try {
                  const inputEl = inputRef.current as HTMLInputElement;
                  inputEl.focus();
                  inputEl.select();
                  setIsInputReady(true);
                  if (isProblematicField) {
                    console.log('[InlineFieldEditor] 🖱️ onMouseDown - Focus forzado', { fieldName });
                  }
                } catch (err) {
                  console.error('[InlineFieldEditor] 🖱️ onMouseDown - Error forzando focus', { fieldName, error: err });
                }
              }
            }, 0);
          }
        }}
        onFocus={(e) => {
          // Logs para campos number sin autoSave (usar placeholder como identificador)
          if (type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] number/text onFocus', { type, autoSave, placeholder, value, draft, isEditing });
          }
          e.stopPropagation(); // Prevenir que el focus se propague
          // Marcar como listo inmediatamente cuando obtenemos focus
          setIsInputReady(true);
          if (type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] number/text onFocus - isInputReady = true', { placeholder });
          }
          // Seleccionar todo el texto al enfocar para permitir editar de inmediato (comportamiento de PVP Est.)
          setTimeout(() => {
            try {
              const target = e.target as HTMLInputElement;
              if (target && document.activeElement === target) {
                target.select();
                if (type === 'number' && !autoSave) {
                  console.log('[InlineFieldEditor] number/text onFocus - Texto seleccionado', { placeholder });
                }
                // Verificar y reintentar si no se seleccionó
                const hasFullSelection = target.selectionStart === 0 && target.selectionEnd === target.value.length;
                if (!hasFullSelection && target.value.length > 0) {
                  setTimeout(() => {
                    try {
                      target.setSelectionRange(0, target.value.length);
                    } catch {
                      // no-op
                    }
                  }, 10);
                }
              }
            } catch {
              // no-op
            }
          }, 0);
        }}
        onBlur={(e) => {
          const fieldName = placeholder || 'unknown';
          const isProblematicField = fieldName.includes('FOB ORIGEN') || 
                                     fieldName.includes('OCEAN') || 
                                     fieldName.includes('Gastos Puerto') || 
                                     fieldName.includes('PPTO DE REPARACION') ||
                                     fieldName.includes('PPTO Reparación') ||
                                     fieldName.includes('Traslados Nacionales');
          
          if (type === 'number' && !autoSave) {
            console.log('[InlineFieldEditor] 🔴 onBlur - INICIO', { 
              fieldName, 
              isProblematicField,
              isInputReady, 
              isEditing, 
              timeSinceOpening: Date.now() - openingStartTimeRef.current,
              activeElement: document.activeElement?.tagName 
            });
          }
          
          // Prevenir que el blur se propague
          e.stopPropagation();
          e.preventDefault(); // CRÍTICO: Prevenir comportamiento por defecto
          
          // CRÍTICO: Para campos number/text/date/time sin autoSave (o closeOnlyOnEnterOrSelect), NUNCA permitir blur automático
          // El usuario debe cerrar con Enter o con el check verde (✓)
          const blockBlurForTextNumber = (type === 'number' && !autoSave) || (closeOnlyOnEnterOrSelect && (type === 'text' || type === 'number' || type === 'date' || type === 'time'));
          if (blockBlurForTextNumber) {
            // Si el blur es por clic en el check verde o la X, NO restaurar foco: dejar que el clic complete y se guarde
            const relatedTarget = e.relatedTarget as Node | null;
            if (relatedTarget && editorContainerRef.current && editorContainerRef.current.contains(relatedTarget)) {
              return;
            }
            if (type === 'number' && !autoSave) {
              console.log('[InlineFieldEditor] 🔴 onBlur - BLOQUEANDO blur para campo number sin autoSave', { fieldName, isProblematicField });
            }
            
            // Restaurar focus de inmediato (síncrono) para que no se cierre al borrar o al empezar a escribir
            if (inputRef.current && isEditing) {
              try {
                const inputEl = inputRef.current as HTMLInputElement;
                inputEl.focus();
                if (inputEl instanceof HTMLInputElement && inputEl.value.length > 0) {
                  inputEl.select();
                }
                setIsInputReady(true);
              } catch {
                // ignorar si falla en el mismo tick
              }
            }
            
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current);
            }
            // Refuerzo asíncrono por si el blur ya completó
            blurTimeoutRef.current = setTimeout(() => {
              blurTimeoutRef.current = null;
              if (inputRef.current && isEditing) {
                try {
                  const el = inputRef.current as HTMLInputElement;
                  if (document.activeElement !== el) {
                    el.focus();
                    if (el.value.length > 0) el.select();
                    setIsInputReady(true);
                  }
                } catch {
                  // no-op
                }
              }
            }, 0);
            
            return; // CRÍTICO: Salir sin procesar el blur
          }
          
          // Para otros tipos o con autoSave, usar la lógica original
          const timeSinceOpening = Date.now() - openingStartTimeRef.current;
          const minTimeForBlur = type === 'number' || type === 'text' ? 2000 : 500;
          const isRecentlyOpened = timeSinceOpening < minTimeForBlur;
          
          if (!isInputReady || isRecentlyOpened) {
            // El input no está listo o acabamos de abrir - prevenir blur y restaurar focus
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current);
            }
            blurTimeoutRef.current = setTimeout(() => {
              if (inputRef.current && isEditing) {
                try {
                  const inputEl = inputRef.current as HTMLInputElement;
                  requestAnimationFrame(() => {
                    if (inputRef.current && isEditing) {
                      try {
                        inputEl.focus();
                        if (type === 'text' || type === 'number') {
                          inputEl.select();
                          if (!isInputReady) {
                            setIsInputReady(true);
                          }
                        }
                      } catch {
                        // no-op
                      }
                    }
                  });
                } catch {
                  // no-op
                }
              }
            }, 50);
            return;
          }
          
          // Solo guardar automáticamente en blur si autoSave está activado y hay un timeout pendiente
          if (autoSave && autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
            handleSaveWithValue(draft);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        step={type === 'time' ? '900' : undefined}
      />
    );
  };

  // Log cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (type === 'number' && !autoSave) {
        console.log('[InlineFieldEditor] COMPONENTE DESMONTADO', { placeholder });
      }
    };
  }, [type, autoSave, placeholder]);
  
  return (
    <div 
      ref={editorContainerRef}
      className={`inline-flex flex-col gap-1 ${className} ${isEditing && type === 'combobox' ? 'relative z-[101] w-auto' : isEditing ? 'relative z-[101]' : ''}`}
      style={{ zIndex: isEditing ? 101 : 'auto', position: isEditing ? 'relative' : 'relative' }}
          onMouseDown={(e) => {
            // Evitar que el mousedown burbujee a filas/tabla
            e.stopPropagation();
            // NO usar preventDefault - permite que el input reciba el evento para selección
          }}
          onClick={(e) => {
            // Evitar que el click burbujee y dispare handlers externos
            e.stopPropagation();
          }}
    >
      {!isEditing ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={`inline-flex w-full items-center rounded-md border border-gray-200 px-2 py-1 text-left text-xs text-gray-800 transition-colors min-w-[60px] min-h-[24px] ${
            disabled
              ? 'cursor-not-allowed opacity-50 bg-gray-50'
              : 'hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-gray-50'
          } ${className}`}
          onMouseDown={(e) => {
            if (type === 'number' && !autoSave) {
              console.log('[InlineFieldEditor] !isEditing div onMouseDown', { placeholder, isEditing, value });
            }
            // Evitar que el mousedown burbujee y active handlers de fila/tabla
            e.stopPropagation();
            // NO usar preventDefault aquí - permite que el input reciba el evento correctamente
            if (!disabled) {
              // Registrar el tiempo de apertura
              const openTime = Date.now();
              openingStartTimeRef.current = openTime;
              // Logs para campos number sin autoSave (usar placeholder como identificador)
              if (type === 'number' && !autoSave) {
                console.log('[InlineFieldEditor] onMouseDown - Abriendo campo', { type, autoSave, placeholder, openTime });
              }
              if (type === 'number' && !autoSave) {
                console.log('[InlineFieldEditor] onMouseDown - ANTES de setIsEditing(true)', { placeholder, currentIsEditing: isEditing });
              }
              setIsEditing(true);
              if (type === 'number' && !autoSave) {
                console.log('[InlineFieldEditor] onMouseDown - DESPUÉS de setIsEditing(true)', { placeholder });
              }
              setIsInputReady(false); // Resetear el estado de listo
              if (type === 'number' && !autoSave) {
                console.log('[InlineFieldEditor] onMouseDown - Llamando onEditStart', { placeholder });
              }
              onEditStart?.();
              if (type === 'number' && !autoSave) {
                console.log('[InlineFieldEditor] onMouseDown - COMPLETADO', { placeholder });
              }
            }
          }}
          onClick={(e) => {
            e.stopPropagation(); // Prevenir que el click se propague y expanda tarjetas/contenedores
            // NO usar preventDefault aquí - permite que el input maneje el click normalmente
            if (!disabled && !isEditing) {
              // Solo activar si no está ya en modo edición (el mousedown ya lo hizo)
              // Para selects, marcar interacción antes de abrir
              if (type === 'select') {
                selectInteractionRef.current = true;
              }
              openingStartTimeRef.current = Date.now();
              setIsEditing(true);
              setIsInputReady(false); // Resetear el estado de listo
              onEditStart?.(); // Notificar que comenzó la edición
            }
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              e.stopPropagation();
              // Para selects, marcar interacción antes de abrir
              if (type === 'select') {
                selectInteractionRef.current = true;
              }
              setIsEditing(true);
              onEditStart?.(); // Notificar que comenzó la edición
            }
          }}
        >
          <span className="truncate">
            {displayFormatter ? displayFormatter(value ?? null) : value ?? (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 relative z-[101]">
          {renderInput()}
          {/* Solo mostrar botones de guardar/cancelar si NO es un select (los selects se guardan automáticamente o con Enter) */}
          {type !== 'select' && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center w-7 h-7 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-60"
                disabled={status === 'saving'}
              >
                {status === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => exitEditing(true)}
                className="inline-flex items-center justify-center w-7 h-7 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {status === 'error' && error && (
            <p className="text-xs text-red-500 font-medium">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

InlineFieldEditor.displayName = 'InlineFieldEditor';

