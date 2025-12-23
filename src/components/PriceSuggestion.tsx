import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Database, AlertCircle, CheckCircle2, X, Settings } from 'lucide-react';
import { apiPost } from '../services/api';
import { Modal } from '../molecules/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { showError } from './Toast';

interface PriceSuggestionProps {
  type: 'auction' | 'pvp' | 'repuestos';
  model: string;
  year?: number | null;
  hours?: number | null;
  costoArancel?: number | null;
  onApply?: (value: number) => void;
  autoFetch?: boolean; // Si es true, busca automáticamente al montar
  compact?: boolean; // Modo compacto para celdas de tabla
  forcePopoverPosition?: 'top' | 'bottom'; // Forzar posición del popover
  onPopoverToggle?: (isOpen: boolean) => void; // Callback cuando el popover se abre/cierra
}

interface SuggestionResponse {
  suggested_price?: number;
  suggested_pvp?: number;
  suggested_rptos?: number;
  suggested_margin?: number;
  confidence: string;
  confidence_score: number;
  price_range: {
    min: number | null;
    max: number | null;
  };
  sources: {
    historical: number;
    current: number;
    total: number;
  };
  sample_records?: any;
  message?: string;
}

export const PriceSuggestion: React.FC<PriceSuggestionProps> = ({
  type,
  model,
  year,
  hours,
  costoArancel,
  onApply,
  autoFetch = false,
  compact = false,
  forcePopoverPosition,
  onPopoverToggle
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  // Valores predeterminados: 2000 horas y 2 años para todos los tipos
  const getDefaultHoursRange = () => 2000;
  const getDefaultYearsRange = () => 2;
  const [hoursRange, setHoursRange] = useState(getDefaultHoursRange());
  const [yearsRange, setYearsRange] = useState(getDefaultYearsRange());
  
  // Hooks para modo compacto (deben estar fuera de condicionales según reglas de React)
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = React.useState<'top' | 'bottom'>('top');

  // Calcular posición del popover (solo cuando es compacto y está abierto)
  React.useEffect(() => {
    if (compact && showDetails && buttonRef.current) {
      // Si se fuerza la posición, usarla directamente (tiene prioridad sobre el cálculo automático)
      if (forcePopoverPosition) {
        setPopoverPosition(forcePopoverPosition);
        return;
      }

      const button = buttonRef.current;
      const rect = button.getBoundingClientRect();
      const popoverHeight = 500; // Altura aproximada del popover (aumentada para incluir registros históricos)
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Si hay más espacio abajo que arriba, o si el espacio arriba es menor que la altura del popover + margen
      if (spaceBelow > spaceAbove || spaceAbove < popoverHeight + 10) {
        setPopoverPosition('bottom');
      } else {
        setPopoverPosition('top');
      }
    }
  }, [compact, showDetails, forcePopoverPosition]);

  // Calcular posición del popover para modo !autoFetch (PreselectionPage)
  React.useEffect(() => {
    if (!autoFetch && compact && showDetails && buttonRef.current) {
      // Si se fuerza la posición, usarla directamente
      if (forcePopoverPosition) {
        setPopoverPosition(forcePopoverPosition);
        return;
      }

      const button = buttonRef.current;
      const rect = button.getBoundingClientRect();
      const popoverHeight = 500;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Si no hay suficiente espacio abajo, mostrar arriba
      if (spaceBelow < popoverHeight + 20) {
        setPopoverPosition('top');
      } else {
        setPopoverPosition('bottom');
      }
    }
  }, [autoFetch, compact, showDetails, forcePopoverPosition]);

  // Notificar al padre cuando el popover se abre/cierra
  React.useEffect(() => {
    if (onPopoverToggle && compact) {
      onPopoverToggle(showDetails);
    }
  }, [showDetails, compact, onPopoverToggle]);

  // Cerrar popover al hacer clic fuera (solo en modo compacto)
  React.useEffect(() => {
    if (!compact || !showDetails) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        popoverRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setShowDetails(false);
      }
    };

    // Agregar listener después de un pequeño delay para evitar que se cierre inmediatamente
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [compact, showDetails]);

  const fetchSuggestion = async (customHoursRange?: number, customYearsRange?: number) => {
    if (!model) {
      return;
    }

    setIsLoading(true);
    try {
      let endpoint = '';
      const rangeHours = customHoursRange !== undefined ? customHoursRange : hoursRange;
      const rangeYears = customYearsRange !== undefined ? customYearsRange : yearsRange;
      let payload: any = { model, year, hours };

      if (type === 'auction') {
        endpoint = '/api/price-suggestions/auction';
        payload.hours_range = rangeHours;
        payload.years_range = rangeYears;
      } else if (type === 'pvp') {
        endpoint = '/api/price-suggestions/pvp';
        payload.costo_arancel = costoArancel;
        payload.hours_range = rangeHours;
        payload.years_range = rangeYears;
      } else if (type === 'repuestos') {
        endpoint = '/api/price-suggestions/repuestos';
        payload.hours_range = rangeHours;
        payload.years_range = rangeYears;
      }

      const response = await apiPost(endpoint, payload);
      // Asegurarse de que siempre haya un objeto suggestion, incluso si no hay datos
      setSuggestion({
        ...response,
        model: model,
        year: year,
        hours: hours
      });
      // Si el popover está abierto, mantenerlo abierto incluso si no hay datos
      // Esto permite que el usuario siga ajustando los rangos
      // No cerrar automáticamente el popover
    } catch (error) {
      console.error('Error obteniendo sugerencia:', error);
      showError('Error al obtener sugerencia de precio');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch && model) {
      fetchSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, year, hours, autoFetch]);

  // Obtener sugerencia automáticamente cuando hay modelo, año y horas (solo en modo compacto y no autoFetch)
  useEffect(() => {
    if (!autoFetch && compact && model && year && hours && !isLoading) {
      // Limpiar sugerencia anterior cuando cambian los parámetros para forzar actualización
      setSuggestion(null);
      setShowDetails(false);
      // Obtener nueva sugerencia
      fetchSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, year, hours, autoFetch, compact]);


  const getSuggestedValue = () => {
    if (!suggestion) return null;
    if (type === 'auction') return suggestion.suggested_price;
    if (type === 'pvp') return suggestion.suggested_pvp;
    if (type === 'repuestos') return suggestion.suggested_rptos;
    return null;
  };

  const suggestedValue = getSuggestedValue();

  const getConfidenceColor = () => {
    if (!suggestion) return 'gray';
    switch (suggestion.confidence) {
      case 'ALTA': return 'green';
      case 'MEDIA': return 'yellow';
      case 'BAJA': return 'orange';
      default: return 'gray';
    }
  };

  const getConfidenceStars = () => {
    if (!suggestion) return 0;
    if (suggestion.confidence === 'ALTA') return 5;
    if (suggestion.confidence === 'MEDIA') return 3;
    if (suggestion.confidence === 'BAJA') return 2;
    return 0;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return '$ ' + new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getTitle = () => {
    if (type === 'auction') return 'Precio Máximo Sugerido';
    if (type === 'pvp') return 'PVP Estimado Sugerido';
    if (type === 'repuestos') return 'Repuestos Sugerido';
    return 'Sugerencia';
  };

  // Obtener sugerencia automáticamente cuando hay modelo, año y horas (solo en modo compacto y no autoFetch)
  useEffect(() => {
    if (!autoFetch && compact && model && year && hours && !suggestion && !isLoading) {
      fetchSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, year, hours, autoFetch, compact]);

  if (!autoFetch) {
    if (compact) {
      const getConfidenceLetter = () => {
        if (!suggestion) return null;
        const confidence = suggestion.confidence;
        if (confidence === 'ALTA') return 'A';
        if (confidence === 'MEDIA') return 'M';
        if (confidence === 'BAJA') return 'B';
        return null;
      };

      const getConfidenceBadge = () => {
        if (!suggestion) return null;
        const letter = getConfidenceLetter();
        if (!letter) return null;
        const color = getConfidenceColor();
        const colorClasses = {
          green: 'bg-green-100 text-green-700 border-green-300',
          yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
          orange: 'bg-orange-100 text-orange-700 border-orange-300',
          gray: 'bg-gray-100 text-gray-700 border-gray-300'
        };
        return (
          <span className={`px-1 py-0.5 rounded text-[9px] font-semibold border ${colorClasses[color] || colorClasses.gray}`}>
            {letter}
          </span>
        );
      };

      return (
        <div className="relative flex items-center justify-end gap-1">
          <button
            ref={buttonRef}
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!model) {
                showError('Se requiere un modelo para obtener la sugerencia');
                return;
              }
              // Si no hay sugerencia, obtenerla primero
              if (!suggestion && !isLoading) {
                await fetchSuggestion();
              }
              // Mostrar el modal siempre que haya una respuesta (incluso si no hay datos)
              // Esperar un momento para que el estado se actualice después de fetchSuggestion
              setTimeout(() => {
                if (suggestion) {
                  setShowDetails(true);
                }
              }, 100);
            }}
            disabled={isLoading || !model}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-200"
          >
            {isLoading ? (
              <>
                <Sparkles className="w-3 h-3 animate-pulse" />
                <span>Cargando...</span>
              </>
            ) : suggestion && suggestedValue ? (
              <>
                <Sparkles className="w-3 h-3" />
                <span className="font-semibold">{formatCurrency(suggestedValue)}</span>
                {getConfidenceBadge()}
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                <span>Ver</span>
              </>
            )}
          </button>

          {/* Popover de detalles - mismo estilo que autoFetch */}
          <AnimatePresence>
            {showDetails && suggestion && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: popoverPosition === 'top' ? -5 : 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: popoverPosition === 'top' ? -5 : 5, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className={`absolute ${popoverPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} z-[10000] w-72 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col`}
                style={{ 
                  right: 0,
                  maxHeight: popoverPosition === 'top' 
                    ? `${Math.min(600, (buttonRef.current?.getBoundingClientRect().top || window.innerHeight) - 20)}px`
                    : `${Math.min(600, Math.max(400, window.innerHeight - (buttonRef.current?.getBoundingClientRect().bottom || 0) - 20))}px`
                }}
              >
                <div className="bg-[#50504f] text-white px-3 py-2 flex items-center justify-between flex-shrink-0">
                  <span className="text-xs font-medium">Sugerencia Histórica</span>
                  <button onClick={() => setShowDetails(false)} className="hover:bg-white/20 rounded p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                <div 
                  className="p-3 space-y-3 overflow-y-auto overflow-x-hidden flex-1"
                  style={{ 
                    maxHeight: 'calc(100% - 40px)',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#cbd5e1 #f1f5f9',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {/* Caso sin datos */}
                  {suggestion.confidence === 'SIN_DATOS' || (!suggestedValue && suggestion.confidence !== 'ALTA' && suggestion.confidence !== 'MEDIA' && suggestion.confidence !== 'BAJA') ? (
                    <div className="text-center py-6">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-700 mb-2">No se encontraron datos históricos</p>
                      <p className="text-xs text-gray-500 mb-1">{suggestion.message || 'No hay registros similares en las bases de datos para este modelo, año y horas.'}</p>
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Parámetros de búsqueda:</p>
                        <p className="text-xs text-gray-500">Modelo: {suggestion.model || 'N/A'}</p>
                        <p className="text-xs text-gray-500">Año: {suggestion.year || 'N/A'}</p>
                        <p className="text-xs text-gray-500">Horas: {suggestion.hours || 'N/A'}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Indicador de carga */}
                      {isLoading && (
                        <div className="text-center py-2">
                          <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-[#cf1b22] border-t-transparent"></div>
                            <span>Actualizando sugerencia...</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Valor sugerido */}
                      <div className="text-center pb-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">{getTitle()}</p>
                        <p className="text-xl font-bold text-[#cf1b22]">{formatCurrency(suggestedValue)}</p>
                        <div className={`inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded ${
                          suggestion.confidence === 'ALTA' ? 'bg-green-100 text-green-700' :
                          suggestion.confidence === 'MEDIA' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          Confianza: {suggestion.confidence}
                        </div>
                      </div>
                      
                      {/* Rango de precios */}
                      {suggestion.price_range && (suggestion.price_range.min || suggestion.price_range.max) && (
                        <div className="text-xs">
                          <p className="text-gray-500 mb-1">Rango de precios:</p>
                          <div className="flex justify-between text-[#50504f] font-medium">
                            <span>Min: {formatCurrency(suggestion.price_range.min)}</span>
                            <span>Max: {formatCurrency(suggestion.price_range.max)}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Fuentes */}
                      <div className="text-xs flex items-center gap-2 text-gray-500">
                        <Database className="w-3 h-3" />
                        <span>{suggestion.sources.total} registros similares</span>
                      </div>
                      
                      {/* Configuración de rango - Solo para tipo auction */}
                      {type === 'auction' && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Configurar Rango de Búsqueda</p>
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10px] text-gray-600 mb-1">
                                Rango de Horas (±)
                              </label>
                              <input
                                type="range"
                                min="100"
                                max="10000"
                                step="100"
                                value={hoursRange}
                                onChange={(e) => {
                                  const newRange = parseInt(e.target.value);
                                  setHoursRange(newRange);
                                  // Actualizar sugerencia automáticamente con el nuevo rango después de actualizar el estado
                                  setTimeout(() => {
                                    fetchSuggestion(newRange, yearsRange);
                                  }, 300);
                                }}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
                              />
                              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                <span>100</span>
                                <span className="font-semibold text-[#50504f]">{hoursRange.toLocaleString('es-CO')} hrs</span>
                                <span>10,000</span>
                              </div>
                              {hours && (
                                <p className="text-[9px] text-gray-400 mt-1">
                                  Búsqueda: {(hours - hoursRange).toLocaleString('es-CO')} a {(hours + hoursRange).toLocaleString('es-CO')} hrs
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-600 mb-1">
                                Rango de Años (±)
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={yearsRange}
                                onChange={(e) => {
                                  const newRange = parseInt(e.target.value);
                                  setYearsRange(newRange);
                                  // Actualizar sugerencia automáticamente con el nuevo rango después de actualizar el estado
                                  setTimeout(() => {
                                    fetchSuggestion(hoursRange, newRange);
                                  }, 300);
                                }}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
                              />
                              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                <span>1</span>
                                <span className="font-semibold text-[#50504f]">{yearsRange} año{yearsRange !== 1 ? 's' : ''}</span>
                                <span>10</span>
                              </div>
                              {year && (
                                <p className="text-[9px] text-gray-400 mt-1">
                                  Búsqueda: {year - yearsRange} a {year + yearsRange}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const defaultHours = getDefaultHoursRange();
                                const defaultYears = getDefaultYearsRange();
                                setHoursRange(defaultHours);
                                setYearsRange(defaultYears);
                                setTimeout(() => {
                                  fetchSuggestion(defaultHours, defaultYears);
                                }, 300);
                              }}
                              className="w-full text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                            >
                              Restaurar Predeterminados
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Registros históricos más importantes */}
                      {suggestion.sample_records?.historical && suggestion.sample_records.historical.length > 0 && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Históricos Destacados</p>
                          <div className="space-y-1.5">
                            {suggestion.sample_records.historical.slice(0, 5).map((record: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  {record.year && (
                                    <span className="font-medium text-gray-700">
                                      {record.year}
                                    </span>
                                  )}
                                  {record.year && record.hours && (
                                    <span className="text-gray-400">•</span>
                                  )}
                                  {record.hours && (
                                    <span className="text-gray-500">
                                      {record.hours.toLocaleString('es-CO')} hrs
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-[#cf1b22]">
                                  {formatCurrency(record.price || record.pvp || record.rptos || record.suggested_price)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Botón aplicar */}
                      {onApply && suggestedValue && suggestion.confidence !== 'SIN_DATOS' && (
                        <div className="pt-2 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => {
                              onApply(suggestedValue);
                              setShowDetails(false);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#cf1b22] text-white text-xs font-medium rounded hover:bg-[#a81820] transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Aplicar valor
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal de configuración */}
          {type === 'auction' && (
            <Modal
              isOpen={showConfigModal}
              onClose={() => setShowConfigModal(false)}
              title="Configurar Rango de Búsqueda"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rango de Horas (±)
                  </label>
                  <Input
                    type="number"
                    value={hoursRange.toString()}
                    onChange={(e) => setHoursRange(parseInt(e.target.value) || 1000)}
                    min="100"
                    max="10000"
                    step="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Búsqueda: {hours ? hours - hoursRange : 'N/A'} a {hours ? hours + hoursRange : 'N/A'} horas
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rango de Años (±)
                  </label>
                  <Input
                    type="number"
                    value={yearsRange.toString()}
                    onChange={(e) => setYearsRange(parseInt(e.target.value) || 1)}
                    min="1"
                    max="10"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Búsqueda: {year ? year - yearsRange : 'N/A'} a {year ? year + yearsRange : 'N/A'}
                  </p>
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setHoursRange(getDefaultHoursRange());
                      setYearsRange(getDefaultYearsRange());
                    }}
                    className="flex-1"
                  >
                    Restaurar Predeterminados
                  </Button>
                  <Button
                    onClick={() => {
                      setShowConfigModal(false);
                      fetchSuggestion();
                    }}
                    className="flex-1"
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={fetchSuggestion}
          disabled={isLoading || !model}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          {isLoading ? 'Calculando...' : 'Ver Sugerencia'}
        </button>

        <AnimatePresence>
          {showDetails && suggestion && (
            <SuggestionModal
              suggestion={suggestion}
              type={type}
              suggestedValue={suggestedValue}
              onClose={() => setShowDetails(false)}
              onApply={onApply}
              formatCurrency={formatCurrency}
              getConfidenceColor={getConfidenceColor}
              getConfidenceStars={getConfidenceStars}
              getTitle={getTitle}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Modo auto-fetch: Muestra inline
  if (isLoading) {
    if (compact) {
      return (
        <div className="flex items-center justify-end gap-1 text-xs text-gray-400">
          <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
        Calculando sugerencia...
      </div>
    );
  }

  // En modo compacto con autoFetch, siempre permitir mostrar el popover para configurar rangos
  // No retornar null incluso si no hay sugerencia, para permitir que el usuario ajuste rangos
  if (!compact || !autoFetch) {
  if (!suggestion || suggestion.confidence === 'SIN_DATOS') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <AlertCircle className="w-4 h-4" />
        Sin datos históricos
      </div>
    );
    }
  }

  // Modo compacto para celdas de tabla
  if (compact) {

    return (
      <div className="relative flex items-center justify-end gap-1">
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
          className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-[#50504f] rounded transition-colors border border-gray-200"
          title="Ver detalles de sugerencia"
        >
          <Sparkles className="w-3 h-3" />
          {suggestion && suggestedValue ? (
            <>
          <span className="font-medium">{formatCurrency(suggestedValue)}</span>
              {suggestion.confidence && suggestion.confidence !== 'SIN_DATOS' && (
          <span className={`text-[10px] px-1 rounded ${
            suggestion.confidence === 'ALTA' ? 'bg-green-100 text-green-700' :
            suggestion.confidence === 'MEDIA' ? 'bg-yellow-100 text-yellow-700' :
            'bg-orange-100 text-orange-700'
          }`}>{suggestion.confidence.charAt(0)}</span>
              )}
            </>
          ) : (
            <span className="font-medium">Ver sugerencia</span>
          )}
        </button>
        {type === 'auction' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowConfigModal(true);
            }}
            className="flex items-center justify-center w-6 h-6 text-xs bg-gray-100 hover:bg-gray-200 text-[#50504f] rounded transition-colors border border-gray-200"
            title="Configurar rango de búsqueda"
          >
            <Settings className="w-3 h-3" />
          </button>
        )}
        
        {/* Popover de detalles */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: popoverPosition === 'top' ? -5 : 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: popoverPosition === 'top' ? -5 : 5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className={`absolute ${popoverPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} right-0 z-[9999] w-72 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col`}
              style={{ 
                maxHeight: popoverPosition === 'top' 
                  ? `${Math.min(600, (buttonRef.current?.getBoundingClientRect().top || window.innerHeight) - 20)}px`
                  : `${Math.min(600, window.innerHeight - (buttonRef.current?.getBoundingClientRect().bottom || 0) - 20)}px`
              }}
            >
              <div className="bg-[#50504f] text-white px-3 py-2 flex items-center justify-between flex-shrink-0">
                <span className="text-xs font-medium">Sugerencia Histórica</span>
                <button onClick={() => setShowDetails(false)} className="hover:bg-white/20 rounded p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
              
              <div 
                className="p-3 space-y-3 overflow-y-auto overflow-x-hidden flex-1"
                style={{ 
                  maxHeight: 'calc(100% - 40px)',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#cbd5e1 #f1f5f9',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {/* Indicador de carga */}
                {isLoading && (
                  <div className="text-center py-2">
                    <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-[#cf1b22] border-t-transparent"></div>
                      <span>Actualizando sugerencia...</span>
                    </div>
                  </div>
                )}
                
                {/* Valor sugerido - Solo mostrar si hay sugerencia con datos */}
                {suggestion && suggestion.confidence !== 'SIN_DATOS' && suggestedValue ? (
                  <>
                <div className="text-center pb-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">{getTitle()}</p>
                  <p className="text-xl font-bold text-[#cf1b22]">{formatCurrency(suggestedValue)}</p>
                  <div className={`inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded ${
                    suggestion.confidence === 'ALTA' ? 'bg-green-100 text-green-700' :
                    suggestion.confidence === 'MEDIA' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    Confianza: {suggestion.confidence}
                  </div>
                </div>
                
                {/* Rango de precios */}
                {suggestion.price_range && (suggestion.price_range.min || suggestion.price_range.max) && (
                  <div className="text-xs">
                    <p className="text-gray-500 mb-1">Rango de precios:</p>
                    <div className="flex justify-between text-[#50504f] font-medium">
                      <span>Min: {formatCurrency(suggestion.price_range.min)}</span>
                      <span>Max: {formatCurrency(suggestion.price_range.max)}</span>
                    </div>
                  </div>
                )}
                
                {/* Fuentes */}
                <div className="text-xs flex items-center gap-2 text-gray-500">
                  <Database className="w-3 h-3" />
                      <span>{suggestion.sources?.total || 0} registros similares</span>
                </div>
                  </>
                ) : (
                  /* Mensaje cuando no hay datos - Siempre mostrar para permitir configurar rangos */
                  <div className="text-center py-4 pb-2 border-b border-gray-100">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-700 mb-1">No se encontraron datos históricos</p>
                    <p className="text-[10px] text-gray-500">Ajusta los rangos de búsqueda abajo para encontrar resultados</p>
                    {suggestion?.message && (
                      <p className="text-[10px] text-gray-400 mt-1 italic">{suggestion.message}</p>
                    )}
                  </div>
                )}
                
                {/* Configuración de rango - Para todos los tipos */}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Configurar Rango de Búsqueda</p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-1">
                        Rango de Horas (±)
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="10000"
                        step="100"
                        value={hoursRange}
                        onChange={(e) => {
                          const newRange = parseInt(e.target.value);
                          setHoursRange(newRange);
                          // Actualizar sugerencia automáticamente con el nuevo rango después de actualizar el estado
                          setTimeout(() => {
                            fetchSuggestion(newRange, yearsRange);
                          }, 300);
                        }}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>100</span>
                        <span className="font-semibold text-[#50504f]">{hoursRange.toLocaleString('es-CO')} hrs</span>
                        <span>10,000</span>
                      </div>
                      {hours && (
                        <p className="text-[9px] text-gray-400 mt-1">
                          Búsqueda: {(hours - hoursRange).toLocaleString('es-CO')} a {(hours + hoursRange).toLocaleString('es-CO')} hrs
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-1">
                        Rango de Años (±)
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={yearsRange}
                        onChange={(e) => {
                          const newRange = parseInt(e.target.value);
                          setYearsRange(newRange);
                          // Actualizar sugerencia automáticamente con el nuevo rango después de actualizar el estado
                          setTimeout(() => {
                            fetchSuggestion(hoursRange, newRange);
                          }, 300);
                        }}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#cf1b22]"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>1</span>
                        <span className="font-semibold text-[#50504f]">{yearsRange} año{yearsRange !== 1 ? 's' : ''}</span>
                        <span>10</span>
                      </div>
                      {year && (
                        <p className="text-[9px] text-gray-400 mt-1">
                          Búsqueda: {year - yearsRange} a {year + yearsRange}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultHours = getDefaultHoursRange();
                        const defaultYears = getDefaultYearsRange();
                        setHoursRange(defaultHours);
                        setYearsRange(defaultYears);
                        setTimeout(() => {
                          fetchSuggestion(defaultHours, defaultYears);
                        }, 300);
                      }}
                      className="w-full text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    >
                      Restaurar Predeterminados
                    </button>
                  </div>
                </div>
                
                {/* Registros históricos más importantes */}
                {suggestion && suggestion.sample_records?.historical && suggestion.sample_records.historical.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Históricos Destacados</p>
                    <div className="space-y-1.5">
                      {suggestion.sample_records.historical.slice(0, 5).map((record: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            {record.year && (
                              <span className="font-medium text-gray-700">
                                {record.year}
                              </span>
                            )}
                            {record.year && record.hours && (
                              <span className="text-gray-400">•</span>
                            )}
                            {record.hours && (
                              <span className="text-gray-500">
                                {record.hours.toLocaleString('es-CO')} hrs
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-[#cf1b22]">
                            {formatCurrency(record.price || record.pvp || record.rptos || record.suggested_price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Botón aplicar */}
                {onApply && suggestion && suggestedValue && suggestion.confidence !== 'SIN_DATOS' && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        onApply(suggestedValue);
                        setShowDetails(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#cf1b22] text-white text-xs font-medium rounded hover:bg-[#a81820] transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Aplicar valor
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de configuración */}
        {type === 'auction' && (
          <Modal
            isOpen={showConfigModal}
            onClose={() => setShowConfigModal(false)}
            title="Configurar Rango de Búsqueda"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rango de Horas (±)
                </label>
                <Input
                  type="number"
                  value={hoursRange.toString()}
                  onChange={(e) => setHoursRange(parseInt(e.target.value) || 1000)}
                  min="100"
                  max="10000"
                  step="100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Búsqueda: {hours ? hours - hoursRange : 'N/A'} a {hours ? hours + hoursRange : 'N/A'} horas
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rango de Años (±)
                </label>
                <Input
                  type="number"
                  value={yearsRange.toString()}
                  onChange={(e) => setYearsRange(parseInt(e.target.value) || 1)}
                  min="1"
                  max="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Búsqueda: {year ? year - yearsRange : 'N/A'} a {year ? year + yearsRange : 'N/A'}
                </p>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setHoursRange(getDefaultHoursRange());
                    setYearsRange(getDefaultYearsRange());
                  }}
                  className="flex-1"
                >
                  Restaurar Predeterminados
                </Button>
                <Button
                  onClick={() => {
                    setShowConfigModal(false);
                    fetchSuggestion();
                  }}
                  className="flex-1"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
      <Sparkles className="w-4 h-4 text-[#cf1b22]" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#50504f]">{formatCurrency(suggestedValue)}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            suggestion.confidence === 'ALTA' ? 'bg-green-100 text-green-700' :
            suggestion.confidence === 'MEDIA' ? 'bg-yellow-100 text-yellow-700' :
            'bg-orange-100 text-orange-700'
          }`}>{suggestion.confidence}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>{suggestion.sources.total} registros</span>
          <button type="button" onClick={() => setShowDetails(true)} className="text-[#cf1b22] hover:underline">
            Detalles
          </button>
        </div>
      </div>
      {onApply && (
        <button
          type="button"
          onClick={() => onApply(suggestedValue!)}
          className="px-3 py-1.5 text-xs bg-[#cf1b22] text-white rounded hover:bg-[#a81820] transition-colors"
        >
          Aplicar
        </button>
      )}

      <AnimatePresence>
        {showDetails && (
          <SuggestionModal
            suggestion={suggestion}
            type={type}
            suggestedValue={suggestedValue}
            onClose={() => setShowDetails(false)}
            onApply={onApply}
            formatCurrency={formatCurrency}
            getConfidenceColor={getConfidenceColor}
            getConfidenceStars={getConfidenceStars}
            getTitle={getTitle}
          />
        )}
      </AnimatePresence>

      {/* Modal de configuración */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Configurar Rango de Búsqueda"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de Horas (±)
            </label>
            <Input
              type="number"
              value={hoursRange.toString()}
              onChange={(e) => setHoursRange(parseInt(e.target.value) || 1000)}
              min="100"
              max="10000"
              step="100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Búsqueda: {hours ? hours - hoursRange : 'N/A'} a {hours ? hours + hoursRange : 'N/A'} horas
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de Años (±)
            </label>
            <Input
              type="number"
              value={yearsRange.toString()}
              onChange={(e) => setYearsRange(parseInt(e.target.value) || 1)}
              min="1"
              max="10"
            />
            <p className="text-xs text-gray-500 mt-1">
              Búsqueda: {year ? year - yearsRange : 'N/A'} a {year ? year + yearsRange : 'N/A'}
            </p>
          </div>
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setHoursRange(1000);
                setYearsRange(1);
              }}
              className="flex-1"
            >
              Restaurar Predeterminados
            </Button>
            <Button
              onClick={() => {
                setShowConfigModal(false);
                fetchSuggestion();
              }}
              className="flex-1"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Modal de detalles
const SuggestionModal: React.FC<any> = ({
  suggestion,
  type,
  suggestedValue,
  onClose,
  onApply,
  formatCurrency,
  getConfidenceStars,
  getTitle
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#50504f] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium text-sm">{getTitle()}</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Caso sin datos */}
          {suggestion.confidence === 'SIN_DATOS' || (!suggestedValue && suggestion.confidence !== 'ALTA' && suggestion.confidence !== 'MEDIA' && suggestion.confidence !== 'BAJA') ? (
            <div className="text-center py-6">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700 mb-2">No se encontraron datos históricos</p>
              <p className="text-xs text-gray-500 mb-1">{suggestion.message || 'No hay registros similares en las bases de datos para este modelo, año y horas.'}</p>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Parámetros de búsqueda:</p>
                <p className="text-xs text-gray-500">Modelo: {suggestion.model || 'N/A'}</p>
                <p className="text-xs text-gray-500">Año: {suggestion.year || 'N/A'}</p>
                <p className="text-xs text-gray-500">Horas: {suggestion.hours || 'N/A'}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Valor Sugerido */}
              <div className="text-center py-3 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Valor Sugerido</p>
                <p className="text-2xl font-bold text-[#cf1b22]">{formatCurrency(suggestedValue)}</p>
                {type === 'pvp' && suggestion.suggested_margin && (
                  <p className="text-xs text-green-600 mt-1">Margen: {suggestion.suggested_margin}%</p>
                )}
              </div>

              {/* Confianza y Registros */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Confianza</p>
                  <p className={`text-sm font-semibold ${
                    suggestion.confidence === 'ALTA' ? 'text-green-600' :
                    suggestion.confidence === 'MEDIA' ? 'text-yellow-600' : 
                    suggestion.confidence === 'BAJA' ? 'text-orange-600' : 'text-gray-500'
                  }`}>{suggestion.confidence || 'N/A'}</p>
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < getConfidenceStars() ? 'bg-[#cf1b22]' : 'bg-gray-300'}`} />
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Registros</p>
                  <p className="text-sm font-semibold text-[#50504f]">{suggestion.sources?.total || 0}</p>
                  <p className="text-[10px] text-gray-400">{suggestion.sources?.historical || 0} hist. + {suggestion.sources?.current || 0} act.</p>
                </div>
              </div>

              {/* Rango de Precios */}
              {suggestion.price_range?.min && suggestion.price_range?.max && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">Rango de Precios</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#50504f]">Min: <strong>{formatCurrency(suggestion.price_range.min)}</strong></span>
                    <span className="text-[#50504f]">Max: <strong>{formatCurrency(suggestion.price_range.max)}</strong></span>
                  </div>
                </div>
              )}

              {/* Registros de Muestra */}
              {suggestion.sample_records && (
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {suggestion.sample_records.historical && suggestion.sample_records.historical.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Históricos ({suggestion.sources?.historical || 0})</p>
                      <div className="space-y-1">
                        {suggestion.sample_records.historical.slice(0, 3).map((record: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-xs">
                            <span className="text-gray-600">{record.model} • {record.year}</span>
                            <span className="font-semibold text-[#50504f]">{formatCurrency(record.price || record.pvp || record.rptos)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggestion.sample_records.current && suggestion.sample_records.current.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Actuales ({suggestion.sources?.current || 0})</p>
                      <div className="space-y-1">
                        {suggestion.sample_records.current.slice(0, 3).map((record: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-xs">
                            <span className="text-gray-600">{record.model} • {record.year}</span>
                            <span className="font-semibold text-[#50504f]">{formatCurrency(record.price || record.pvp || record.rptos)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors"
          >
            Cerrar
          </button>
          {onApply && suggestedValue && suggestion.confidence !== 'SIN_DATOS' && (
            <button
              onClick={() => {
                if (suggestedValue) {
                  onApply(suggestedValue);
                  onClose();
                }
              }}
              className="px-4 py-2 text-sm bg-[#cf1b22] text-white rounded hover:bg-[#a81820] transition-colors"
            >
              Aplicar
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

