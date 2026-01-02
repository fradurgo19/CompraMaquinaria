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
}

const normalizeValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isNaN(value)) return '';
  return String(value);
};

export const InlineFieldEditor: React.FC<InlineFieldEditorProps> = ({
  value,
  type = 'text',
  placeholder = 'Click para editar',
  className = '',
  inputClassName = '',
  disabled = false,
  options = [],
  displayFormatter,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(normalizeValue(value));
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(normalizeValue(value));
      setSearchTerm('');
      setShowDropdown(false);
    }
  }, [value, isEditing]);
  
  // Efecto para cerrar el modo de edición cuando el valor se actualiza después de guardar
  useEffect(() => {
    if (isEditing && status === 'saving') {
      const normalizedValue = normalizeValue(value);
      const normalizedDraft = normalizeValue(draft);
      // Si el valor del padre coincide con el draft, significa que se guardó correctamente
      if (normalizedValue === normalizedDraft && normalizedDraft !== '') {
        setStatus('idle');
        setIsEditing(false);
      }
    }
  }, [value, draft, isEditing, status]);

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

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (type === 'combobox' && showDropdown) {
      const handleClickOutside = (event: MouseEvent) => {
        if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [type, showDropdown]);

  // Filtrar opciones para combobox
  const filteredOptions = type === 'combobox' 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const exitEditing = () => {
    setIsEditing(false);
    setDraft(normalizeValue(value));
    setSearchTerm('');
    setShowDropdown(false);
    setHighlightedIndex(-1);
    setStatus('idle');
    setError(null);
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
        handleSaveWithValue(selectedOption.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setShowDropdown(false);
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
          className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red ${inputClassName}`}
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
          className={`min-w-[120px] max-w-[200px] w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red ${inputClassName}`}
          value={draft}
          onChange={(e) => {
            // Solo actualizar el draft, no guardar automáticamente
            setDraft(e.target.value);
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
        <div ref={comboboxRef} className="relative w-full min-w-[150px] max-w-[250px]">
          <div className="relative">
            <input
              ref={(el) => (inputRef.current = el)}
              type="text"
              className={`w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red ${inputClassName}`}
              value={searchTerm !== '' ? searchTerm : draft}
              onChange={(e) => {
                const newSearch = e.target.value;
                setSearchTerm(newSearch);
                setDraft(newSearch);
                setShowDropdown(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
            />
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {showDropdown && filteredOptions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
              {filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                    index === highlightedIndex ? 'bg-blue-100' : ''
                  } ${option.value === draft ? 'bg-blue-50 font-semibold' : ''}`}
                  onClick={() => {
                    setDraft(option.value);
                    setSearchTerm('');
                    setShowDropdown(false);
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
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-500">
              No se encontraron resultados
            </div>
          )}
        </div>
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
        className={`min-w-[100px] max-w-[180px] w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red ${inputClassName}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        step={type === 'number' ? 'any' : type === 'time' ? '900' : undefined}
      />
    );
  };

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      {!isEditing ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={`inline-flex w-full items-center rounded-md border border-gray-200 px-2 py-1 text-left text-xs text-gray-800 transition-colors min-w-[60px] min-h-[24px] ${
            disabled
              ? 'cursor-not-allowed opacity-50 bg-gray-50'
              : 'hover:border-brand-red hover:bg-white hover:text-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red bg-gray-50'
          } ${className}`}
          onClick={() => !disabled && setIsEditing(true)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
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
        <div className="flex flex-col gap-2">
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
              onClick={exitEditing}
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
};

