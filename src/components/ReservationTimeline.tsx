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
  type: 'SEPARADA' | 'RESERVADA';
  cliente: string | null;
  asesor: string | null;
  reservation_id?: string;
}

export const ReservationTimeline = ({ equipmentId }: ReservationTimelineProps) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTimeline = async () => {
      try {
        setLoading(true);
        // Obtener el historial de cambios de estado del equipo
        const equipmentHistory = await apiGet<any[]>(`/api/equipments/${equipmentId}/state-history`);
        
        const timelineEvents: TimelineEvent[] = equipmentHistory.map((item) => ({
          id: item.id,
          date: item.updated_at,
          type: item.state === 'Separada' ? 'SEPARADA' : 'RESERVADA',
          cliente: item.cliente || null,
          asesor: item.asesor || null,
          reservation_id: item.reservation_id,
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
        {events.map((event, index) => (
          <div key={event.id} className="flex items-center gap-2 flex-shrink-0">
            {/* Evento */}
            <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 min-w-[140px] ${
              event.type === 'SEPARADA'
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-green-50 border-green-300'
            }`}>
              {/* Tipo */}
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                event.type === 'SEPARADA'
                  ? 'bg-yellow-200 text-yellow-900'
                  : 'bg-green-200 text-green-900'
              }`}>
                {event.type === 'SEPARADA' ? '📋 Separada' : '✅ Reservada'}
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
              
              {/* Asesor */}
              {event.asesor && (
                <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                  <User className="w-3 h-3" />
                  <span className="truncate max-w-[120px]" title={event.asesor}>
                    {event.asesor}
                  </span>
                </div>
              )}
            </div>
            
            {/* Flecha conectora */}
            {index < events.length - 1 && (
              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
