import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Database, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { apiPost } from '../services/api';

interface PriceSuggestionProps {
  type: 'auction' | 'pvp' | 'repuestos';
  model: string;
  year?: number | null;
  hours?: number | null;
  costoArancel?: number | null;
  onApply?: (value: number) => void;
  autoFetch?: boolean; // Si es true, busca automáticamente al montar
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
  autoFetch = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);

  const fetchSuggestion = async () => {
    if (!model) {
      return;
    }

    setIsLoading(true);
    try {
      let endpoint = '';
      let payload: any = { model, year, hours };

      if (type === 'auction') {
        endpoint = '/api/price-suggestions/auction';
      } else if (type === 'pvp') {
        endpoint = '/api/price-suggestions/pvp';
        payload.costo_arancel = costoArancel;
      } else if (type === 'repuestos') {
        endpoint = '/api/price-suggestions/repuestos';
      }

      const response = await apiPost(endpoint, payload);
      setSuggestion(response);
      setShowDetails(true);
    } catch (error) {
      console.error('Error obteniendo sugerencia:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (autoFetch && model) {
      fetchSuggestion();
    }
  }, [model, year, hours, autoFetch]);

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
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'USD',
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

  if (!autoFetch) {
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
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
        Calculando sugerencia...
      </div>
    );
  }

  if (!suggestion || suggestion.confidence === 'SIN_DATOS') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <AlertCircle className="w-4 h-4" />
        Sin datos históricos
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <div className="flex-1">
          <div className="text-xs text-gray-600 mb-1">{getTitle()}</div>
          <div className="text-2xl font-bold text-indigo-700">
            {formatCurrency(suggestedValue)}
          </div>
          {type === 'pvp' && suggestion.suggested_margin && (
            <div className="text-xs text-green-600 mt-1">
              Margen: {suggestion.suggested_margin}%
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`text-xs px-2 py-1 rounded bg-${getConfidenceColor()}-100 text-${getConfidenceColor()}-700`}>
            {suggestion.confidence}
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < getConfidenceStars() ? 'bg-yellow-400' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <Database className="w-3 h-3" />
          <span>{suggestion.sources.total} registros similares</span>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Ver detalles →
        </button>
      </div>

      {onApply && (
        <button
          type="button"
          onClick={() => onApply(suggestedValue!)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
          Usar {formatCurrency(suggestedValue)}
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
  getConfidenceColor,
  getConfidenceStars,
  getTitle
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              <div>
                <h3 className="text-xl font-bold">{getTitle()}</h3>
                <p className="text-indigo-100 text-sm">Análisis basado en datos históricos</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Valor Sugerido */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border-2 border-indigo-200">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">Valor Sugerido</div>
              <div className="text-4xl font-bold text-indigo-700 mb-3">
                {formatCurrency(suggestedValue)}
              </div>
              {type === 'pvp' && suggestion.suggested_margin && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-semibold">Margen: {suggestion.suggested_margin}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Confianza */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Nivel de Confianza</div>
              <div className={`text-2xl font-bold text-${getConfidenceColor()}-600 mb-2`}>
                {suggestion.confidence}
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      i < getConfidenceStars() ? 'bg-yellow-400' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Registros Analizados</div>
              <div className="text-2xl font-bold text-indigo-600 mb-2">
                {suggestion.sources.total}
              </div>
              <div className="text-xs text-gray-500">
                {suggestion.sources.historical} históricos + {suggestion.sources.current} actuales
              </div>
            </div>
          </div>

          {/* Rango de Precios */}
          {suggestion.price_range.min && suggestion.price_range.max && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-semibold text-gray-700 mb-3">Rango de Precios Encontrados</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Mínimo</div>
                  <div className="text-lg font-bold text-gray-700">
                    {formatCurrency(suggestion.price_range.min)}
                  </div>
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-2 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 rounded-full"></div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Máximo</div>
                  <div className="text-lg font-bold text-gray-700">
                    {formatCurrency(suggestion.price_range.max)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Registros de Muestra */}
          {suggestion.sample_records && (
            <div className="space-y-4">
              {suggestion.sample_records.historical && suggestion.sample_records.historical.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">
                    📊 Datos Históricos ({suggestion.sources.historical})
                  </div>
                  <div className="space-y-2">
                    {suggestion.sample_records.historical.map((record: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg text-sm">
                        <div className="flex items-center gap-3">
                          <div className="font-mono text-gray-700">{record.model}</div>
                          <div className="text-gray-500">
                            {record.year} • {record.hours?.toLocaleString()} hrs
                          </div>
                        </div>
                        <div className="font-bold text-indigo-700">
                          {formatCurrency(record.price || record.pvp || record.rptos)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {suggestion.sample_records.current && suggestion.sample_records.current.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">
                    🆕 Datos Actuales ({suggestion.sources.current})
                  </div>
                  <div className="space-y-2">
                    {suggestion.sample_records.current.map((record: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg text-sm">
                        <div className="flex items-center gap-3">
                          <div className="font-mono text-gray-700">{record.model}</div>
                          <div className="text-gray-500">
                            {record.year} • {record.hours?.toLocaleString()} hrs
                          </div>
                        </div>
                        <div className="font-bold text-green-700">
                          {formatCurrency(record.price || record.pvp || record.rptos)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-xl border-t flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Cancelar
          </button>
          {onApply && (
            <button
              onClick={() => {
                onApply(suggestedValue);
                onClose();
              }}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Usar {formatCurrency(suggestedValue)}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

