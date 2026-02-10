/**
 * Componente de Timeline de Reservas
 * Muestra el historial de separaciones y reservas de una máquina
 */

import { useState, useEffect } from 'react';
import { Clock, User, Building2, ArrowRight } from 'lucide-react';
import { apiGet } from '../services/api';

interface ReservationTimelineProps {
  equipmentId: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: 'SEPARADA' | 'RESERVADA' | 'RECHAZADA' | 'FECHA_LIMITE_MODIFICADA';
  cliente: string | null;
  asesor: string | null;
  reservation_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  deadline_date?: string | null;
}

function getEventStyles(type: TimelineEvent['type']) {
  const map: Record<TimelineEvent['type'], { boxStyle: string; badgeStyle: string; label: string }> = {
    SEPARADA: { boxStyle: 'bg-yellow-50 border-yellow-300', badgeStyle: 'bg-yellow-200 text-yellow-900', label: '📋 Separada' },
    RECHAZADA: { boxStyle: 'bg-red-50 border-red-300', badgeStyle: 'bg-red-200 text-red-900', label: '❌ Rechazada' },
    FECHA_LIMITE_MODIFICADA: { boxStyle: 'bg-purple-50 border-purple-300', badgeStyle: 'bg-purple-200 text-purple-900', label: '📅 Fecha límite modificada' },
    RESERVADA: { boxStyle: 'bg-green-50 border-green-300', badgeStyle: 'bg-green-200 text-green-900', label: '✅ Reservada' },
  };
  return map[type];
}

export const ReservationTimeline = ({ equipmentId }: ReservationTimelineProps) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTimeline = async () => {
      try {
        setLoading(true);
        // Obtener el historial de cambios de estado del equipo
        const equipmentHistory = await apiGet<Array<{ id: string; state: string; updated_at: string; cliente?: string | null; asesor?: string | null; reservation_id?: string | null; old_value?: string | null; new_value?: string | null; deadline_date?: string | null }>>(`/api/equipments/${equipmentId}/state-history`);
        
        const mapStateToType = (state: string): TimelineEvent['type'] => {
          if (state === 'Separada') return 'SEPARADA';
          if (state === 'Rechazada') return 'RECHAZADA';
          if (state === 'Fecha límite modificada') return 'FECHA_LIMITE_MODIFICADA';
          return 'RESERVADA';
        };
        const timelineEvents: TimelineEvent[] = equipmentHistory.map((item) => ({
            id: item.id,
            date: item.updated_at,
            type: mapStateToType(item.state),
            cliente: item.cliente || null,
            asesor: item.asesor || null,
            reservation_id: item.reservation_id,
            old_value: item.old_value ?? null,
            new_value: item.new_value ?? null,
            deadline_date: item.deadline_date ?? null,
          }));
        
        setEvents(timelineEvents);
      } catch (error) {
        console.error('Error al cargar timeline:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    if (equipmentId) {
      loadTimeline();
    }
  }, [equipmentId]);

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-500 text-center">Cargando historial...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-blue-600" />
        <h3 className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
          Historial de Separaciones y Reservas
        </h3>
      </div>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {events.map((event, index) => {
          const { boxStyle, badgeStyle, label } = getEventStyles(event.type);
          return (
          <div key={event.id} className="flex items-center gap-2 flex-shrink-0">
            {/* Evento */}
            <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 min-w-[140px] ${boxStyle}`}>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badgeStyle}`}>
                {label}
              </div>
              
              {/* Fecha */}
              <div className="flex items-center gap-1 text-xs text-gray-700 mt-1">
                <Clock className="w-3 h-3" />
                <span>
                  {new Date(event.date).toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </span>
              </div>
              
              {/* Cliente */}
              {event.cliente && (
                <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                  <Building2 className="w-3 h-3" />
                  <span className="truncate max-w-[120px]" title={event.cliente}>
                    {event.cliente}
                  </span>
                </div>
              )}
              {/* Fecha límite modificada: mostrar antigua → nueva */}
              {event.type === 'FECHA_LIMITE_MODIFICADA' && (event.old_value != null || event.new_value != null) && (
                <div className="flex flex-col items-center gap-0.5 text-xs text-gray-600 mt-1">
                  <span className="line-through">{event.old_value || '-'}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span>{event.new_value || '-'}</span>
                </div>
              )}
              
              {/* Asesor */}
              {event.asesor && (
                <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                  <User className="w-3 h-3" />
                  <span className="truncate max-w-[120px]" title={event.asesor}>
                    {event.asesor}
                  </span>
                </div>
              )}
              {/* Fecha límite del proceso (cuando aplica) */}
              {event.deadline_date && event.type !== 'FECHA_LIMITE_MODIFICADA' && (
                <div className="text-xs text-gray-500 mt-1">
                  F. límite: {new Date(event.deadline_date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              )}
            </div>
            
            {/* Flecha conectora */}
            {index < events.length - 1 && (
              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};
