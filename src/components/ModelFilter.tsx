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
  const isMouseDownInsideRef = useRef(false);

  const handleModelToggle = useCallback((model: string, checked: boolean, e: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Si está presionado Ctrl o Cmd, permitir selección múltiple
    const isCtrlKey = (e as React.MouseEvent).ctrlKey || (e as React.MouseEvent).metaKey;
    
    if (checked) {
      setModelFilter(prev => {
        if (prev.includes(model)) return prev;
        return [...prev, model];
      });
    } else {
      setModelFilter(prev => prev.filter(m => m !== model));
    }
    // NO cerrar el dropdown - permitir selección múltiple
  }, [setModelFilter]);

  const handleCheckboxChange = useCallback((model: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    handleModelToggle(model, e.target.checked, e);
  }, [handleModelToggle]);

  const handleLabelClick = useCallback((model: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Si está presionado Ctrl o Cmd, toggle el checkbox
    const isCtrlKey = e.ctrlKey || e.metaKey;
    if (isCtrlKey) {
      const checkbox = e.currentTarget.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        handleModelToggle(model, checkbox.checked, e);
      }
    }
  }, [handleModelToggle]);

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
      // Si el mouseDown fue dentro, no cerrar
      if (isMouseDownInsideRef.current) {
        isMouseDownInsideRef.current = false;
        return;
      }

      if (!containerRef.current) return;
      
      const target = event.target as Node;
      // NO cerrar si el click es dentro del contenedor
      if (containerRef.current.contains(target)) {
        return;
      }
      
      // Solo cerrar si el click es completamente fuera
      setOpen(false);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const target = event.target as Node;
      isMouseDownInsideRef.current = containerRef.current.contains(target);
    };

    // Usar capture phase para capturar eventos antes de que se propaguen
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('click', handleClickOutside, true);
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
            isMouseDownInsideRef.current = true;
          }}
        >
          <div className="p-1">
            <div className="flex items-center justify-between mb-1 px-1 py-0.5 border-b border-gray-200">
              <span className="text-[10px] font-semibold text-gray-700">Modelos ({uniqueModels.length})</span>
              {modelFilter.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    isMouseDownInsideRef.current = true;
                  }}
                  className="text-[9px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {uniqueModels.map(model => {
                const isChecked = modelFilter.includes(model);
                return (
                  <label
                    key={model}
                    className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-gray-50 cursor-pointer text-[10px]"
                    onClick={(e) => handleLabelClick(model, e)}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      isMouseDownInsideRef.current = true;
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleCheckboxChange(model, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        isMouseDownInsideRef.current = true;
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        isMouseDownInsideRef.current = true;
                      }}
                      className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0"
                    />
                    <span className="flex-1 text-gray-900 truncate select-none">
                      {model}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
