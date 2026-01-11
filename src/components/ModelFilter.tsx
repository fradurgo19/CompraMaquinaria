import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface ModelFilterProps {
  uniqueModels: string[];
  modelFilter: string[];
  setModelFilter: React.Dispatch<React.SetStateAction<string[]>>;
}

export const ModelFilter = memo(function ModelFilter({
  uniqueModels,
  modelFilter,
  setModelFilter,
}: ModelFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleModelToggle = useCallback((model: string, checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (checked) {
      setModelFilter(prev => [...prev, model]);
    } else {
      setModelFilter(prev => prev.filter(m => m !== model));
    }
    // NO cerrar el dropdown - permitir selección múltiple
  }, [setModelFilter]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setModelFilter([]);
    // NO cerrar el dropdown después de limpiar
  }, [setModelFilter]);

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(prev => !prev);
  }, []);

  // Cerrar dropdown solo cuando se hace click fuera o se presiona Escape
  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      
      const target = event.target as Node;
      // NO cerrar si el click es dentro del contenedor
      if (containerRef.current.contains(target)) {
        return;
      }
      
      // Solo cerrar si el click es completamente fuera
      setOpen(false);
    };

    // Usar setTimeout para que el evento se registre después de que los eventos internos se procesen
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 0);
    
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={handleButtonClick}
        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between gap-1"
        title={modelFilter.length > 0 ? `${modelFilter.length} modelo(s) seleccionado(s)` : 'Seleccionar modelos'}
      >
        <span className="truncate flex-1 text-left">
          {modelFilter.length === 0 ? 'Todos' : `${modelFilter.length} seleccionado(s)`}
        </span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div 
          className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div className="p-1">
            <div className="flex items-center justify-between mb-1 px-1 py-0.5 border-b border-gray-200">
              <span className="text-[10px] font-semibold text-gray-700">Modelos ({uniqueModels.length})</span>
              {modelFilter.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[9px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {uniqueModels.map(model => (
                <label
                  key={model}
                  className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-gray-50 cursor-pointer text-[10px]"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={modelFilter.includes(model)}
                    onChange={(e) => handleModelToggle(model, e.target.checked, e)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0"
                  />
                  <span className="flex-1 text-gray-900 truncate select-none">
                    {model}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
