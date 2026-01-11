import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

interface ModelFilterProps {
  uniqueModels: string[];
  modelFilter: string[];
  setModelFilter: React.Dispatch<React.SetStateAction<string[]>>;
}

// Ref global para mantener el estado del dropdown abierto entre re-renders
// Esto evita que el dropdown se cierre cuando el componente se desmonta y vuelve a montar
const dropdownStateRef = new Map<string, boolean>();

export const ModelFilter = memo(function ModelFilter({
  uniqueModels,
  modelFilter,
  setModelFilter,
}: ModelFilterProps) {
  // Usar un ID único para este componente (basado en uniqueModels para estabilidad)
  const componentId = useMemo(() => {
    return `model-filter-${uniqueModels.join('-').slice(0, 50)}`;
  }, [uniqueModels]);
  
  // Inicializar el estado desde el ref global si existe
  const [open, setOpenState] = useState(() => {
    return dropdownStateRef.get(componentId) || false;
  });
  
  // Sincronizar el estado con el ref global
  const setOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setOpenState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      dropdownStateRef.set(componentId, newValue);
      return newValue;
    });
  }, [componentId]);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Usar useCallback para estabilizar la función setModelFilter
  // Esto evita que React trate el componente como nuevo en cada render
  const handleModelToggle = useCallback((model: string, checked: boolean) => {
    if (checked) {
      setModelFilter(prev => [...prev, model]);
    } else {
      setModelFilter(prev => prev.filter(m => m !== model));
    }
  }, [setModelFilter]);
  
  const handleClear = useCallback(() => {
    setModelFilter([]);
  }, [setModelFilter]);
  
  // Restaurar el estado del dropdown cuando el componente se monta
  useEffect(() => {
    const savedState = dropdownStateRef.get(componentId);
    if (savedState !== undefined && savedState !== open) {
      setOpenState(savedState);
    }
  }, [componentId, open]);

  // Cerrar dropdown solo cuando se hace click fuera - solución definitiva
  useEffect(() => {
    if (!open) return;
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      
      const target = event.target as Node;
      
      // Si el click es dentro del contenedor, NO cerrar
      // Los elementos internos usan stopPropagation para prevenir que el evento llegue aquí
      // Esta verificación es un respaldo adicional
      if (dropdownRef.current.contains(target)) {
        return;
      }
      
      // Solo cerrar si el click es completamente fuera
      setOpen(false);
    };
    
    // Usar click en bubbling normal (sin capture) para que stopPropagation funcione correctamente
    // Los elementos internos previenen propagación, por lo que este listener solo recibe clicks fuera
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(prev => !prev);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between gap-1"
        title={modelFilter.length > 0 ? `${modelFilter.length} modelo(s) seleccionado(s)` : 'Seleccionar modelos'}
      >
        <span className="truncate flex-1 text-left">
          {modelFilter.length === 0 ? 'Todos' : `${modelFilter.length} seleccionado(s)`}
        </span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div 
          className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-1">
            <div className="flex items-center justify-between mb-1 px-1 py-0.5 border-b border-gray-200">
              <span className="text-[10px] font-semibold text-gray-700">Modelos ({uniqueModels.length})</span>
              {modelFilter.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-[9px] text-blue-600 hover:text-blue-800"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div 
              className="space-y-0.5 max-h-48 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
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
                    onChange={(e) => {
                      e.stopPropagation();
                      handleModelToggle(model, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span 
                    className="flex-1 text-gray-900 truncate"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
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
}, (prevProps, nextProps) => {
  // Comparación personalizada para React.memo
  // Solo re-renderizar si cambian las props relevantes
  // PERO ignorar cambios en modelFilter para mantener el estado interno
  return (
    prevProps.uniqueModels === nextProps.uniqueModels &&
    prevProps.setModelFilter === nextProps.setModelFilter
    // NO comparamos modelFilter aquí - el componente maneja su propio estado
  );
});
