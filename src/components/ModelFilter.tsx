import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ModelFilterProps {
  uniqueModels: string[];
  modelFilter: string[];
  setModelFilter: React.Dispatch<React.SetStateAction<string[]>>;
}

export function ModelFilter({
  uniqueModels,
  modelFilter,
  setModelFilter,
}: ModelFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Logs para depuración
  console.log('[ModelFilter] Render:', {
    isOpen,
    modelFilterLength: modelFilter.length,
    modelFilter,
    uniqueModelsLength: uniqueModels.length,
  });

  const handleToggle = (model: string) => {
    console.log('[ModelFilter] handleToggle llamado:', {
      model,
      currentModelFilter: modelFilter,
      isOpen,
    });

    setModelFilter(prev => {
      const newFilter = prev.includes(model)
        ? prev.filter(m => m !== model)
        : [...prev, model];
      
      console.log('[ModelFilter] setModelFilter:', {
        prev,
        newFilter,
        model,
        wasIncluded: prev.includes(model),
      });

      return newFilter;
    });
  };

  const handleClear = () => {
    console.log('[ModelFilter] handleClear llamado');
    setModelFilter([]);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    console.log('[ModelFilter] handleButtonClick:', {
      currentIsOpen: isOpen,
      willToggleTo: !isOpen,
    });
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    console.log('[ModelFilter] isOpen cambió a:', isOpen);
  }, [isOpen]);

  useEffect(() => {
    console.log('[ModelFilter] modelFilter cambió:', {
      modelFilter,
      length: modelFilter.length,
    });
  }, [modelFilter]);

  useEffect(() => {
    if (!isOpen) return;

    console.log('[ModelFilter] Dropdown abierto, agregando event listeners');

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInside = containerRef.current?.contains(target);
      
      console.log('[ModelFilter] handleClickOutside:', {
        target: (target as Element)?.tagName,
        isInside,
        isOpen,
      });

      if (!isInside) {
        console.log('[ModelFilter] Click fuera del contenedor, cerrando dropdown');
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('[ModelFilter] Escape presionado, cerrando dropdown');
        setIsOpen(false);
      }
    };

    // Usar timeout para evitar que se cierre inmediatamente
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    document.addEventListener('keydown', handleEscape);

    return () => {
      console.log('[ModelFilter] Cleanup: removiendo event listeners');
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={handleButtonClick}
        className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between gap-1"
      >
        <span className="truncate flex-1 text-left">
          {modelFilter.length === 0 ? 'Todos' : `${modelFilter.length} seleccionado(s)`}
        </span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div 
          className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg"
        >
          <div className="p-1">
            <div className="flex items-center justify-between mb-1 px-1 py-0.5 border-b border-gray-200">
              <span className="text-[10px] font-semibold text-gray-700">Modelos ({uniqueModels.length})</span>
              {modelFilter.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="text-[9px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {uniqueModels.map(model => {
                const checked = modelFilter.includes(model);
                return (
                  <label
                    key={model}
                    className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-gray-50 cursor-pointer text-[10px]"
                    onClick={(e) => {
                      console.log('[ModelFilter] Label clicked:', { model, checked, event: e.type });
                      e.stopPropagation();
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        console.log('[ModelFilter] Checkbox onChange:', {
                          model,
                          checked: e.target.checked,
                          currentModelFilter: modelFilter,
                          eventType: e.type,
                        });
                        e.stopPropagation();
                        handleToggle(model);
                      }}
                      onClick={(e) => {
                        console.log('[ModelFilter] Checkbox onClick:', {
                          model,
                          checked: e.currentTarget.checked,
                          eventType: e.type,
                        });
                        e.stopPropagation();
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
}
