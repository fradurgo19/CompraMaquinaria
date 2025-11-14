import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

type InlineFieldType = 'text' | 'number' | 'textarea' | 'select' | 'date';

export interface InlineFieldOption {
  label: string;
  value: string;
}

interface InlineFieldEditorProps {
  value: string | number | null | undefined;
  type?: InlineFieldType;
  placeholder?: string;
  className?: string;
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
  disabled = false,
  options = [],
  displayFormatter,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(normalizeValue(value));
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(normalizeValue(value));
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const exitEditing = () => {
    setIsEditing(false);
    setDraft(normalizeValue(value));
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

    if (type === 'date') {
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
      setStatus('error');
      setError(err.message || 'No se pudo guardar');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && type !== 'textarea') {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      exitEditing();
    }
  };

  const renderInput = () => {
    if (type === 'textarea') {
      return (
        <textarea
          ref={(el) => (inputRef.current = el)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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

    return (
      <input
        ref={(el) => (inputRef.current = el)}
        type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        step={type === 'number' ? 'any' : undefined}
      />
    );
  };

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      {!isEditing ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={`inline-flex w-full items-center rounded-md border border-transparent px-2 py-1 text-left text-sm text-gray-800 transition-colors ${
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'hover:border-brand-red hover:bg-white hover:text-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red'
          }`}
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

