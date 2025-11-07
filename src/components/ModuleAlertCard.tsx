/**
 * Tarjeta de Alertas del Módulo (Nivel 2)
 * Mini-card flotante que muestra alertas contextuales
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ExternalLink, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Notification } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

interface ModuleAlertCardProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onOpenCenter: () => void;
  onDismiss: () => void;
}

export const ModuleAlertCard = ({ 
  notifications, 
  onMarkAsRead, 
  onOpenCenter,
  onDismiss 
}: ModuleAlertCardProps) => {
  const navigate = useNavigate();

  if (notifications.length === 0) return null;

  const unreadNotifications = notifications.filter(n => !n.is_read);
  const urgentCount = unreadNotifications.filter(n => n.type === 'urgent').length;
  const warningCount = unreadNotifications.filter(n => n.type === 'warning').length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      default: return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.action_url) {
      navigate(notification.action_url);
    }
    onMarkAsRead(notification.id);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="mb-6"
      >
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">
                  {unreadNotifications.length} Nueva{unreadNotifications.length !== 1 ? 's' : ''} Alerta{unreadNotifications.length !== 1 ? 's' : ''}
                </h3>
                <p className="text-white/80 text-xs">
                  {urgentCount > 0 && `${urgentCount} urgente${urgentCount !== 1 ? 's' : ''}`}
                  {urgentCount > 0 && warningCount > 0 && ' • '}
                  {warningCount > 0 && `${warningCount} importante${warningCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Ocultar alertas"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Lista de Alertas (máximo 3) */}
          <div className="p-4 space-y-2">
            {unreadNotifications.slice(0, 3).map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                  notification.type === 'urgent' 
                    ? 'bg-red-50 border-red-200 hover:border-red-400' 
                    : notification.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-400'
                    : 'bg-blue-50 border-blue-200 hover:border-blue-400'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-2">
                  {getTypeIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900 mb-1 leading-tight">
                      {notification.title}
                    </h4>
                    <p className="text-xs text-gray-700 line-clamp-2">
                      {notification.message}
                    </p>
                  </div>
                  {notification.action_url && (
                    <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={onOpenCenter}
              className="flex-1 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg border-2 border-gray-300 transition-all shadow-sm hover:shadow"
            >
              Ver Todas ({notifications.length})
            </button>
            {unreadNotifications.length > 0 && (
              <button
                onClick={() => {
                  unreadNotifications.forEach(n => onMarkAsRead(n.id));
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow flex items-center gap-2"
                title="Marcar como leídas"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

