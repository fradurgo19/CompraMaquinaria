import React, { useEffect, useRef, useState } from 'react';
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
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectInteractionRef = useRef<boolean>(false);

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
    } else if (isEditing && type === 'select' && inputRef.current) {
      // Cuando se activa el modo de edición para un select, hacer focus inmediatamente
      // y marcar que hay interacción activa para mantener el editor abierto
      selectInteractionRef.current = true;
      setTimeout(() => {
        if (inputRef.current && isEditing) {
          try {
            inputRef.current.focus();
            // En algunos navegadores, es necesario hacer click también para abrir el dropdown
            // Pero no queremos hacer click automáticamente porque puede interferir con la selección
          } catch {
            // Ignorar errores de focus
          }
        }
      }, 0);
    }
    // Limpiar timeout al desmontar o cambiar de modo edición
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [value, isEditing, showDropdown, onDropdownClose, type, status]);
  
  // Efecto para cerrar el modo de edición cuando el valor se actualiza después de guardar
  // NO cerrar automáticamente si autoSave está activado y es un select (para permitir múltiples selecciones)
  useEffect(() => {
    if (isEditing && status === 'saving') {
      const normalizedValue = normalizeValue(value);
      const normalizedDraft = normalizeValue(draft);
      // Si el valor del padre coincide con el draft, significa que se guardó correctamente
      // Pero si autoSave está activado y es un select, mantener el editor abierto
      if (normalizedValue === normalizedDraft && normalizedDraft !== '') {
        setStatus('idle');
        // Solo cerrar si NO es un select con autoSave y el usuario NO está interactuando
        if (!(autoSave && type === 'select') && !selectInteractionRef.current) {
          setIsEditing(false);
        } else if (autoSave && type === 'select') {
          // Para selects con autoSave, mantener el editor abierto y resetear el flag después de un delay
          // Esto permite que el usuario pueda hacer otra selección si lo desea
          setTimeout(() => {
            selectInteractionRef.current = false;
          }, 500);
        }
      }
    }
  }, [value, draft, isEditing, status, autoSave, type]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      if (type === 'combobox') {
        // En combobox, inicializar searchTerm con el valor actual para permitir editar
        setSearchTerm(normalizeValue(value));
      }
      inputRef.current.focus();
      if (type === 'combobox' && inputRef.current instanceof HTMLInputElement) {
        // No seleccionar texto en combobox para permitir escribir
        // Colocar cursor al final
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      } else if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing, type, value]);

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
            
            setDropdownPosition({
              top: openUpward ? undefined : rect.bottom + 4,
              bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
              left: rect.left,
              width: rect.width,
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

  // Cerrar dropdown al hacer click fuera (solo para combobox)
  useEffect(() => {
    if (type === 'combobox' && showDropdown) {
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
  }, [type, showDropdown, onDropdownClose]);

  // Filtrar opciones para combobox
  const filteredOptions = type === 'combobox' 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const exitEditing = (force = false) => {
    // No cerrar si el usuario está interactuando con el select, salvo que se fuerce (botón X)
    if (!force && type === 'select' && selectInteractionRef.current) {
      // Para selects, no cerrar inmediatamente si hay interacción activa
      // El flag se reseteará automáticamente después de que el usuario termine de interactuar
      return;
    }
    setIsEditing(false);
    setDraft(normalizeValue(value));
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
  };

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

      if (parsed === currentValue || (parsed === null && (currentValue === null || currentValue === ''))) {
        exitEditing();
        return;
      }

      setStatus('saving');
      await onSave(parsed);
      setStatus('idle');
      setIsEditing(false);
      onEditEnd?.(); // Notificar que terminó la edición
    } catch (err: any) {
      if (err?.message === 'CHANGE_CANCELLED') {
        exitEditing();
        return;
      }
      setStatus('error');
      setError(err.message || 'No se pudo guardar');
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
        exitEditing();
      }
    }
  };

  const handleSaveWithValue = async (val: string) => {
    try {
      const currentValue = value === undefined ? null : value;
      const normalizedCurrent = normalizeValue(currentValue);
      const normalizedVal = normalizeValue(val);
      
      // Si el valor no cambió, no hacer nada
      if (normalizedVal === normalizedCurrent) {
        exitEditing();
        return;
      }
      
      setStatus('saving');
      await onSave(val);
      // No cerrar inmediatamente - el useEffect se encargará de cerrar cuando el valor se actualice
      // Mantener el draft con el nuevo valor para que se muestre correctamente
    } catch (err: any) {
      if (err?.message === 'CHANGE_CANCELLED') {
        exitEditing();
        return;
      }
      setStatus('error');
      setError(err.message || 'No se pudo guardar');
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
        <select
          ref={(el) => (inputRef.current = el)}
          className={`min-w-[120px] max-w-[200px] w-full border ${status === 'error' ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${status === 'error' ? 'focus:ring-red-500' : 'focus:ring-brand-red'} ${inputClassName}`}
          value={draft}
          onChange={(e) => {
            const newValue = e.target.value;
            setDraft(newValue);
            // Marcar que el usuario está interactuando - mantener activo por más tiempo
            selectInteractionRef.current = true;
            // Si autoSave está activado, guardar automáticamente
            if (autoSave) {
              // Usar setTimeout para permitir que el select complete su acción
              // Aumentar el delay para dar más tiempo al dropdown
              setTimeout(() => {
                handleSaveWithValue(newValue);
                // Mantener el flag activo después de guardar para permitir otra selección
                // Solo se reseteará después de un delay o cuando el usuario haga click fuera
                setTimeout(() => {
                  // No resetear aquí, solo después de un tiempo sin interacción
                }, 300);
              }, 200);
            } else {
              // Si no hay autoSave, mantener el flag activo para permitir selección
              // Se reseteará cuando el usuario haga blur final
            }
          }}
          onFocus={(e) => {
            // Prevenir que el focus se propague
            e.stopPropagation();
            selectInteractionRef.current = true;
          }}
          onMouseDown={(e) => {
            // Prevenir que el mousedown cierre el editor
            e.stopPropagation();
            // NO usar preventDefault aquí porque necesitamos que el select nativo maneje el mousedown
            // Marcar que el usuario está interactuando ANTES de que se abra el dropdown
            selectInteractionRef.current = true;
            // Asegurar que el select tenga focus antes de que el dropdown se abra
            // Esto es crítico para que el dropdown se abra correctamente
            if (inputRef.current) {
              try {
                inputRef.current.focus();
                // Restaurar el focus después de un breve delay para mantener el editor abierto
                // El select nativo abrirá el dropdown y causará blur, pero restauraremos el focus
                setTimeout(() => {
                  if (inputRef.current && selectInteractionRef.current) {
                    try {
                      // Verificar si el elemento activo no es nuestro select
                      if (document.activeElement !== inputRef.current) {
                        inputRef.current.focus();
                      }
                    } catch {
                      // Ignorar errores de focus
                    }
                  }
                }, 10);
                setTimeout(() => {
                  if (inputRef.current && selectInteractionRef.current) {
                    try {
                      if (document.activeElement !== inputRef.current) {
                        inputRef.current.focus();
                      }
                    } catch {
                      // Ignorar errores de focus
                    }
                  }
                }, 50);
              } catch {
                // Ignorar errores de focus
              }
            }
          }}
          onClick={(e) => {
            // Prevenir que el click se propague y cierre el editor
            e.stopPropagation();
            selectInteractionRef.current = true;
            // Asegurar que el select tenga focus cuando se hace click
            if (inputRef.current && document.activeElement !== inputRef.current) {
              try {
                inputRef.current.focus();
              } catch {
                // Ignorar errores de focus
              }
            }
          }}
          onBlur={() => {
            // Para selects, el blur ocurre cuando:
            // 1. Se abre el dropdown (necesitamos mantener el editor abierto)
            // 2. El usuario hace click fuera (debemos cerrar el editor)
            // 3. El usuario selecciona una opción (el onChange ya maneja esto)
            
            // Si el usuario está interactuando con el select, mantener el editor abierto
            if (selectInteractionRef.current) {
              // Restaurar el focus de forma inmediata y en múltiples momentos
              // para contrarrestar el blur del select nativo
              const restoreFocus = () => {
                if (inputRef.current && selectInteractionRef.current) {
                  try {
                    // Solo restaurar si el elemento activo no es nuestro select
                    if (document.activeElement !== inputRef.current) {
                      inputRef.current.focus();
                    }
                  } catch {
                    // Ignorar errores de focus
                  }
                }
              };
              
              // Restaurar focus inmediatamente y en múltiples momentos
              restoreFocus();
              requestAnimationFrame(restoreFocus);
              setTimeout(restoreFocus, 0);
              setTimeout(restoreFocus, 50);
              
              // NO cerrar el editor si hay interacción activa
              return;
            }
            
            // Si no hay interacción activa, verificar después de un delay si realmente se debe cerrar
            // Esto permite que el select procese la selección antes de cerrar
            setTimeout(() => {
              // Solo cerrar si:
              // 1. Ya no hay interacción activa
              // 2. El elemento activo no es nuestro select
              // 3. El elemento activo no es parte del select (como un option)
              if (!selectInteractionRef.current) {
                const currentActive = document.activeElement;
                if (currentActive !== inputRef.current && 
                    (!currentActive || !inputRef.current?.contains(currentActive))) {
                  exitEditing();
                }
              }
            }, 250); // Delay mayor para dar tiempo al select de procesar completamente
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (type === 'combobox') {
      return (
        <>
          <div ref={comboboxRef} className="relative w-full min-w-[150px] max-w-[250px]">
            <div className="relative">
              <input
                ref={(el) => (inputRef.current = el)}
                type="text"
                className={`w-full border ${status === 'error' ? 'border-red-300' : 'border-gray-300'} rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 ${status === 'error' ? 'focus:ring-red-500' : 'focus:ring-brand-red'} ${inputClassName}`}
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
                  if (!showDropdown) {
                    setShowDropdown(true);
                    onDropdownOpen?.();
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation(); // Prevenir que el click se propague
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
        onBlur={() => {
          // Si autoSave está activado y hay un timeout pendiente, guardar inmediatamente
          if (autoSave && autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
            handleSaveWithValue(draft);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        step={type === 'number' ? 'any' : type === 'time' ? '900' : undefined}
      />
    );
  };

  return (
    <div 
      className={`inline-flex flex-col gap-1 ${className} ${isEditing ? 'relative z-[101]' : ''}`}
      style={{ zIndex: isEditing ? 101 : 'auto', position: isEditing ? 'relative' : 'relative' }}
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
            if (!disabled) {
              setIsEditing(true);
            }
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              e.stopPropagation();
              setIsEditing(true);
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

