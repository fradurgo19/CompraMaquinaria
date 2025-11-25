/**
 * Componente para mostrar historial de cambios de un registro
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, User, FileText, ChevronRight } from 'lucide-react';
import { apiGet } from '../services/api';

interface ChangeLog {
  id: string;
  table_name: string;
  module_name?: string | null;
  field_name: string;
  field_label: string;
  old_value: string;
  new_value: string;
  change_reason: string | null;
  changed_by_email: string;
  changed_by_name: string;
  changed_at: string;
}

interface ChangeHistoryProps {
  tableName: string;
  recordId: string;
  purchaseId?: string; // Para obtener historial de módulos anteriores
}

export const ChangeHistory = ({ tableName, recordId, purchaseId }: ChangeHistoryProps) => {
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    loadHistory();
  }, [tableName, recordId, purchaseId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      console.log(`📋 Cargando historial de ${tableName} - ID: ${recordId}`, purchaseId ? `Purchase ID: ${purchaseId}` : '');
      
      // Si hay purchaseId, obtener historial completo de todos los módulos
      if (purchaseId) {
        console.log(`🔍 Usando endpoint FULL: /api/change-logs/full/${purchaseId}`);
        const data = await apiGet<ChangeLog[]>(`/api/change-logs/full/${purchaseId}`);
        console.log(`✅ Historial completo cargado: ${data.length} cambio(s)`, data);
        setLogs(data || []);
      } else {
        // Solo historial de esta tabla específica
        console.log(`🔍 Usando endpoint normal: /api/change-logs/${tableName}/${recordId}`);
        const data = await apiGet<ChangeLog[]>(`/api/change-logs/${tableName}/${recordId}`);
        console.log(`✅ Historial cargado: ${data.length} cambio(s)`, data);
        setLogs(data || []);
      }
    } catch (error) {
      console.error('❌ Error cargando historial:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const groupByDate = () => {
    const grouped: { [key: string]: ChangeLog[] } = {};
    logs.forEach(log => {
      const date = new Date(log.changed_at).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(log);
    });
    return grouped;
  };

  const getModuleLabel = (log: ChangeLog) => {
    const moduleKey = (log.module_name || log.table_name || '').toLowerCase();
    const moduleLabels: Record<string, { text: string; color: string }> = {
      'purchases': { text: 'Compras', color: 'bg-red-100 text-red-800 border-red-300' },
      'compras': { text: 'Compras', color: 'bg-red-100 text-red-800 border-red-300' },
      'service_records': { text: 'Servicio', color: 'bg-orange-100 text-orange-800 border-orange-300' },
      'servicio': { text: 'Servicio', color: 'bg-orange-100 text-orange-800 border-orange-300' },
      'equipments': { text: 'Equipos', color: 'bg-green-100 text-green-800 border-green-300' },
      'equipos': { text: 'Equipos', color: 'bg-green-100 text-green-800 border-green-300' },
      'auctions': { text: 'Subasta', color: 'bg-purple-100 text-purple-800 border-purple-300' },
      'subasta': { text: 'Subasta', color: 'bg-purple-100 text-purple-800 border-purple-300' },
      'preselections': { text: 'Preselección', color: 'bg-amber-100 text-amber-800 border-amber-300' },
      'preseleccion': { text: 'Preselección', color: 'bg-amber-100 text-amber-800 border-amber-300' },
      'logistica': { text: 'Logística', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      'importaciones': { text: 'Importaciones', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
      'pagos': { text: 'Pagos', color: 'bg-pink-100 text-pink-800 border-pink-300' },
      'management': { text: 'Consolidado', color: 'bg-slate-100 text-slate-800 border-slate-300' },
      'new-purchases': { text: 'Nuevas Compras', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    };
    return moduleLabels[moduleKey] || {
      text: log.module_name || log.table_name || 'Otro',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
    };
  };

  if (loading) {
    return <p className="text-sm text-gray-500 text-center py-4">Cargando historial...</p>;
  }

  if (logs.length === 0) {
    return (
      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Sin cambios registrados</p>
        <p className="text-xs text-gray-500 mt-1">No hay historial de modificaciones para este registro</p>
        <p className="text-xs text-gray-400 mt-2 font-mono">
          Tabla: {tableName} | ID: {recordId}
        </p>
      </div>
    );
  }

  const groupedLogs = groupByDate();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-orange-600" />
        <h3 className="text-lg font-bold text-gray-900">Historial de Cambios</h3>
        <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full">
          {logs.length} cambio{logs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {Object.entries(groupedLogs).map(([date, dateLogs]) => (
        <div key={date} className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 px-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            {date}
          </h4>
          {dateLogs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="ml-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => toggleExpand(log.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded border ${getModuleLabel(log).color}`}>
                      {getModuleLabel(log).text}
                    </span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                      {log.field_label || log.field_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.changed_at).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <User className="w-3 h-3" />
                    {log.changed_by_name || log.changed_by_email}
                  </div>
                </div>
                <ChevronRight 
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expanded.includes(log.id) ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {expanded.includes(log.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 border-t"
                >
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Anterior:</p>
                      <p className="text-sm font-semibold text-red-700 break-words">
                        {log.old_value || 'Sin valor'}
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Nuevo:</p>
                      <p className="text-sm font-semibold text-green-700 break-words">
                        {log.new_value || 'Sin valor'}
                      </p>
                    </div>
                  </div>
                  {log.change_reason && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Razón:</p>
                      <p className="text-sm text-gray-800 italic">"{log.change_reason}"</p>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
};

