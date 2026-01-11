import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface ModelFilterProps {
  uniqueModels: string[];
  modelFilter: string[];
  setModelFilter: React.Dispatch<React.SetStateAction<string[]>>;
}

// SOLUCIÓN DEFINITIVA: Estado global persistente fuera del ciclo de vida de React
// Usar un objeto simple en lugar de Map para acceso directo
const globalDropdownState: { [key: string]: boolean } = {};
const GLOBAL_DROPDOWN_ID = 'model-filter-global';

// Helpers para leer/escribir el estado global
const getGlobalOpenState = (): boolean => {
  return globalDropdownState[GLOBAL_DROPDOWN_ID] === true;
};

const setGlobalOpenState = (value: boolean): void => {
  globalDropdownState[GLOBAL_DROPDOWN_ID] = value;
};

export const ModelFilter = memo(function ModelFilter({
  uniqueModels,
  modelFilter,
  setModelFilter,
}: ModelFilterProps) {
  // #region agent log
  const logData = {location:'ModelFilter.tsx:render',message:'Component rendered',data:{modelFilterLength:modelFilter.length,uniqueModelsLength:uniqueModels.length,globalState:getGlobalOpenState()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,D'};
  console.log('[DEBUG]', logData);
  fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  // #endregion
  
  // SOLUCIÓN DEFINITIVA: Leer el estado directamente del objeto global en cada render
  // NO usar useState - esto evita cualquier problema de sincronización
  const open = getGlobalOpenState();
  
  // Usar un contador para forzar re-render cuando cambia el estado global
  const [, forceUpdate] = useState(0);
  const triggerUpdate = useCallback(() => {
    forceUpdate(prev => prev + 1);
  }, []);
  
  // Función para cambiar el estado global y forzar re-render
  const setOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const currentValue = getGlobalOpenState();
    const newValue = typeof value === 'function' ? value(currentValue) : value;
    setGlobalOpenState(newValue);
    // #region agent log
    const logData = {location:'ModelFilter.tsx:setOpen',message:'Setting open state',data:{prev:currentValue,newValue,globalState:getGlobalOpenState()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'};
    console.log('[DEBUG]', logData);
    fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    // #endregion
    // Forzar re-render para que el componente refleje el cambio
    triggerUpdate();
  }, [triggerUpdate]);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // #region agent log
  useEffect(() => {
    const logData = {location:'ModelFilter.tsx:mount',message:'Component mounted',data:{open,modelFilterLength:modelFilter.length,globalState:getGlobalOpenState()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C,D'};
    console.log('[DEBUG]', logData);
    fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    return () => {
      const unmountLogData = {location:'ModelFilter.tsx:unmount',message:'Component unmounted',data:{open,globalState:getGlobalOpenState()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C,D'};
      console.log('[DEBUG]', unmountLogData);
      fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(unmountLogData)}).catch(()=>{});
    };
  }, [open, modelFilter.length]);
  // #endregion
  
  // CRÍTICO: Sincronizar el render con el estado global después de montar
  // Si el estado global es true pero el render muestra false, forzar actualización
  useEffect(() => {
    const globalState = getGlobalOpenState();
    if (globalState && !open) {
      // #region agent log
      const logData = {location:'ModelFilter.tsx:sync-state',message:'Syncing state from global',data:{globalState,currentOpen:open},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'};
      console.log('[DEBUG]', logData);
      fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
      // #endregion
      triggerUpdate();
    }
  }, [open, triggerUpdate]);
  
  // Usar useCallback para estabilizar la función setModelFilter
  const handleModelToggle = useCallback((model: string, checked: boolean) => {
    // #region agent log
    const logData = {location:'ModelFilter.tsx:handleModelToggle',message:'Checkbox onChange triggered',data:{model,checked,currentOpen:open,currentModelFilter:modelFilter},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'};
    console.log('[DEBUG]', logData);
    fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    // #endregion
    if (checked) {
      setModelFilter(prev => [...prev, model]);
    } else {
      setModelFilter(prev => prev.filter(m => m !== model));
    }
  }, [setModelFilter, open, modelFilter]);
  
  const handleClear = useCallback(() => {
    setModelFilter([]);
  }, [setModelFilter]);

  // Cerrar dropdown solo cuando se hace click fuera
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
      
      // Verificar si el click es dentro del botón
      const isInsideButton = dropdownRef.current.contains(target);
      
      // Verificar si el click es dentro del dropdown (que está en un Portal en document.body)
      const dropdownElement = document.querySelector('[data-model-filter-dropdown]');
      const isInsideDropdown = dropdownElement?.contains(target);
      
      // #region agent log
      const logData = {location:'ModelFilter.tsx:handleClickOutside',message:'Click outside handler',data:{isInsideButton,isInsideDropdown,targetTagName:(target as Element)?.tagName,targetType:(target as Element)?.nodeName,currentOpen:open,dropdownExists:!!dropdownElement},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
      console.log('[DEBUG]', logData);
      fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
      // #endregion
      
      // Si el click es dentro del botón o del dropdown, NO cerrar
      if (isInsideButton || isInsideDropdown) {
        return;
      }
      
      // Solo cerrar si el click es completamente fuera
      setOpen(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, setOpen]);

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
      {open && dropdownRef.current && createPortal(
        <div 
          data-model-filter-dropdown
          className="fixed z-[9999] bg-white border border-gray-300 rounded shadow-lg"
          style={{
            top: `${dropdownRef.current.getBoundingClientRect().bottom + window.scrollY + 4}px`,
            left: `${dropdownRef.current.getBoundingClientRect().left + window.scrollX}px`,
            width: `${dropdownRef.current.offsetWidth}px`,
          }}
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
        </div>,
        document.body
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Comparación personalizada para React.memo
  // Solo re-renderizar si cambian las props relevantes
  // PERO ignorar cambios en modelFilter para mantener el estado interno
  const shouldSkipRender = (
    prevProps.uniqueModels === nextProps.uniqueModels &&
    prevProps.setModelFilter === nextProps.setModelFilter
    // NO comparamos modelFilter aquí - el componente maneja su propio estado
  );
  
  // #region agent log
  const logData = {location:'ModelFilter.tsx:React.memo',message:'Memo comparison',data:{shouldSkipRender,prevModelFilterLength:prevProps.modelFilter.length,nextModelFilterLength:nextProps.modelFilter.length,uniqueModelsEqual:prevProps.uniqueModels === nextProps.uniqueModels,setModelFilterEqual:prevProps.setModelFilter === nextProps.setModelFilter},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
  console.log('[DEBUG]', logData);
  fetch('http://127.0.0.1:7244/ingest/2a0b4a7a-804f-4422-b338-a8adbe67df69',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  // #endregion
  
  return shouldSkipRender;
});
