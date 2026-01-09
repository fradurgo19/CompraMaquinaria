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
}) => {
  const [isEditing, setIsEditing] = useState(false);
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
  const selectContainerRef = useRef<HTMLDivElement | null>(null);
  const previousStatusRef = useRef<'idle' | 'saving' | 'error'>('idle');
  const wasSavingBeforeRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isEditing) {
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
    } else if (isEditing) {
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
    }
    // Limpiar timeouts al desmontar o cambiar de modo edición
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (selectBlurTimeoutRef.current) {
        clearTimeout(selectBlurTimeoutRef.current);
      }
    };
  }, [value, isEditing, showDropdown, onDropdownClose, type, status]);
  
  const exitEditing = useCallback((force = false) => {
    // No cerrar si el usuario está interactuando con el select, salvo que se fuerce (botón X o click fuera confirmado)
    if (!force && type === 'select' && selectInteractionRef.current) {
      // Para selects, no cerrar inmediatamente si hay interacción activa
      // El flag se reseteará automáticamente después de que el usuario termine de interactuar
      return;
    }
    
    // Limpiar timeouts antes de cerrar
    if (selectBlurTimeoutRef.current) {
      clearTimeout(selectBlurTimeoutRef.current);
      selectBlurTimeoutRef.current = null;
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
  }, [type, showDropdown, onDropdownClose, onEditEnd]);

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
        // Para selects, mantener abierto después de guardar para permitir otra selección
        if (type === 'select') {
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
  }, [value, draft, isEditing, status, autoSave, type, showDropdown, onDropdownClose]);

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
            inputRef.current.select();
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
  }, [isEditing, type, value, showDropdown, onDropdownOpen]);

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
  }, [type, showDropdown, onDropdownClose, isEditing, exitEditing, status, autoSave]);

  const parseDraft = (): string | number | null => {
    if (type === 'number') {
      if (draft === '') return null;
      const numericValue = Number(draft.toString().replace(/,/g, '.'));
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
    try {
      const parsed = parseDraft();
      const currentValue = value === undefined ? null : value;

      // Si el valor no cambió, no hacer nada (no cerrar el editor - permitir que el usuario continúe editando)
      // Solo cerrar para combobox cuando no hay cambios
      if (parsed === currentValue || (parsed === null && (currentValue === null || currentValue === ''))) {
        if (type === 'combobox') {
          // Para combobox, cerrar si no hay cambios
          exitEditing();
        }
        // Para otros tipos (select, number, text), mantener abierto aunque no haya cambios
        // Esto permite que el usuario pueda hacer múltiples ediciones sin que se cierre
        return;
      }

      setStatus('saving');
      await onSave(parsed);
      setStatus('idle');
      // Para selects y campos number/text sin autoSave, mantener el editor abierto después de guardar para permitir otra edición
      // Solo cerrar automáticamente para combobox y campos con autoSave
      if (type === 'select') {
        // Para selects, mantener abierto pero permitir que el usuario cierre con click fuera o Escape
        selectInteractionRef.current = true;
      } else if (type === 'combobox' || autoSave) {
        // Para combobox o campos con autoSave, cerrar después de guardar
        setIsEditing(false);
        onEditEnd?.(); // Notificar que terminó la edición
      }
      // Para campos number/text sin autoSave, NO cerrar - mantener abierto para permitir múltiples ediciones (como PRECIO COMPRA)
    } catch (err: unknown) {
      const error = err as { message?: string };
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
        if (type === 'combobox') {
          // En combobox, Enter guarda el valor actual sin cerrar
          event.preventDefault();
          handleSave();
        } else {
          event.preventDefault();
          handleSave();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        exitEditing(true);
      }
    }
  };

  const handleSaveWithValue = async (val: string) => {
    try {
      const currentValue = value === undefined ? null : value;
      const normalizedCurrent = normalizeValue(currentValue);
      const normalizedVal = normalizeValue(val);
      
      // Si el valor no cambió, solo cerrar para combobox (para otros tipos, mantener abierto)
      if (normalizedVal === normalizedCurrent) {
        if (type === 'combobox') {
          exitEditing();
        }
        // Para otros tipos (number/text sin autoSave), no cerrar - mantener abierto para permitir edición
        return;
      }
      
      setStatus('saving');
      await onSave(val);
      // Actualizar el draft al valor guardado
      setDraft(normalizeValue(val));
      // Resetear el status a idle después de guardar exitosamente
      setStatus('idle');
      // Para combobox, cerrar automáticamente después de seleccionar un valor
      // Esto aplica a campos como INCOTERM, MÉTODO EMBARQUE, CRCY que solo permiten selección
      if (type === 'combobox') {
        // Cerrar el dropdown si está abierto
        if (showDropdown) {
          setShowDropdown(false);
          onDropdownClose?.();
        }
        // Cerrar el modo edición después de un pequeño delay para permitir que se actualice el estado
        setTimeout(() => {
          exitEditing();
        }, 100);
      }
      // Para otros tipos (number/text sin autoSave), NO cerrar automáticamente - mantener abierto para permitir múltiples ediciones
    } catch (err: unknown) {
      const error = err as { message?: string };
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
              setDraft(newValue);
              // Marcar que el usuario está interactuando - mantener activo
              selectInteractionRef.current = true;
              // Si autoSave está activado, guardar automáticamente
              if (autoSave) {
                // Usar setTimeout para permitir que el select complete su acción
                setTimeout(() => {
                  handleSaveWithValue(newValue);
                  // Mantener el flag activo después de guardar para permitir otra selección
                  setTimeout(() => {
                    selectInteractionRef.current = false;
                  }, 300);
                }, 150);
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
                event.preventDefault();
                event.stopPropagation();
                exitEditing(true);
              } else if (event.key === 'Enter' && !autoSave) {
                // Si no hay autoSave, Enter guarda y cierra
                event.preventDefault();
                event.stopPropagation();
                handleSave();
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

    return (
      <input
        ref={(el) => (inputRef.current = el)}
        type={
          type === 'number'
            ? 'number'
            : type === 'date'
            ? 'date'
            : type === 'time'
            ? 'time'
            : 'text'
        }
        className={`min-w-[100px] max-w-[180px] w-full border ${status === 'error' ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${status === 'error' ? 'focus:ring-red-500' : 'focus:ring-brand-red'} ${inputClassName}`}
        value={draft}
        onChange={(e) => {
          const newValue = e.target.value;
          setDraft(newValue);
          // Si autoSave está activado, guardar automáticamente después de un delay
          if (autoSave) {
            if (autoSaveTimeoutRef.current) {
              clearTimeout(autoSaveTimeoutRef.current);
            }
            // Para campos de texto, usar un delay más largo (2000ms) para permitir que el usuario escriba
            // Para campos de fecha, usar un delay intermedio (1000ms)
            const delay = type === 'date' || type === 'time' ? 1000 : 2000;
            autoSaveTimeoutRef.current = setTimeout(() => {
              handleSaveWithValue(newValue);
            }, delay);
          }
        }}
        onClick={(e) => {
          e.stopPropagation(); // Prevenir que el click se propague y expanda tarjetas
        }}
        onMouseDown={(e) => {
          e.stopPropagation(); // Prevenir que el mousedown se propague
        }}
        onFocus={(e) => {
          e.stopPropagation(); // Prevenir que el focus se propague
        }}
        onBlur={(e) => {
          // Prevenir que el blur se propague
          e.stopPropagation();
          
          // Solo guardar automáticamente en blur si autoSave está activado y hay un timeout pendiente
          // Para campos number/text sin autoSave, NO guardar en blur - dejar que el usuario guarde manualmente con botones
          if (autoSave && autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
            handleSaveWithValue(draft);
          }
          // Para campos sin autoSave, NO hacer nada en blur - mantener el editor abierto
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        step={type === 'number' ? 'any' : type === 'time' ? '900' : undefined}
      />
    );
  };

  return (
    <div 
      ref={editorContainerRef}
      className={`inline-flex flex-col gap-1 ${className} ${isEditing && type === 'combobox' ? 'relative z-[101] w-auto' : isEditing ? 'relative z-[101]' : ''}`}
      style={{ zIndex: isEditing ? 101 : 'auto', position: isEditing ? 'relative' : 'relative' }}
      onMouseDown={(e) => {
        // Prevenir cierres por capturar el click en contenedores padres (filas/tabla)
        e.stopPropagation();
      }}
      onClick={(e) => {
        // Evitar que el click burbujee y dispare handlers externos que puedan cerrar
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
          onClick={(e) => {
            e.stopPropagation(); // Prevenir que el click se propague y expanda tarjetas/contenedores
            e.preventDefault(); // Prevenir acciones por defecto adicionales
            if (!disabled) {
              // Para selects, marcar interacción antes de abrir
              if (type === 'select') {
                selectInteractionRef.current = true;
              }
              setIsEditing(true);
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

