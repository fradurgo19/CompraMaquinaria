/**
 * Centro de Notificaciones - Panel Lateral Empresarial
 * Sistema multinivel con filtros y acciones rápidas
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { 
  Bell, X, Check, Trash2, ExternalLink, AlertTriangle, 
  Info, CheckCircle, Filter, Clock
} from 'lucide-react';
import { Notification } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export const NotificationCenter = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onRefresh
}: NotificationCenterProps) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');

  const getTypeConfig = (type: string) => {
    const configs = {
      urgent: { 
        icon: AlertTriangle, 
        color: 'bg-red-100 text-red-800 border-red-300',
        bgColor: 'bg-red-50',
        iconColor: 'text-red-600'
      },
      warning: { 
        icon: AlertTriangle, 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        bgColor: 'bg-yellow-50',
        iconColor: 'text-yellow-600'
      },
      info: { 
        icon: Info, 
        color: 'bg-blue-100 text-blue-800 border-blue-300',
        bgColor: 'bg-blue-50',
        iconColor: 'text-blue-600'
      },
      success: { 
        icon: CheckCircle, 
        color: 'bg-green-100 text-green-800 border-green-300',
        bgColor: 'bg-green-50',
        iconColor: 'text-green-600'
      }
    };
    return configs[type as keyof typeof configs] || configs.info;
  };

  const getModuleLabel = (module: string) => {
    const labels: { [key: string]: string } = {
      'auctions': 'Subastas',
      'purchases': 'Compras',
      'importations': 'Importaciones',
      'logistics': 'Logística',
      'service': 'Servicio',
      'equipments': 'Equipos',
      'management': 'Consolidado'
    };
    return labels[module] || module;
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'urgent') return n.type === 'urgent';
    return true;
  });

  const handleAction = (notification: Notification) => {
    if (notification.action_url) {
      navigate(notification.action_url);
      onMarkAsRead(notification.id);
      onClose();
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffMins < 1440) return `Hace ${Math.floor(diffMins / 60)}h`;
    return `Hace ${Math.floor(diffMins / 1440)}d`;
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99990]"
          />
        )}
      </AnimatePresence>

      {/* Panel Lateral */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-white shadow-2xl z-[99999] flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-red to-primary-600 text-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Bell className="w-7 h-7" />
                  <div>
                    <h2 className="text-2xl font-bold">Notificaciones</h2>
                    <p className="text-sm text-white/80">
                      {unreadCount} sin leer de {notifications.length} total
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Filtros */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    filter === 'all'
                      ? 'bg-white text-brand-red shadow'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  Todas ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    filter === 'unread'
                      ? 'bg-white text-brand-red shadow'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  No Leídas ({unreadCount})
                </button>
                <button
                  onClick={() => setFilter('urgent')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    filter === 'urgent'
                      ? 'bg-white text-brand-red shadow'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  Urgentes
                </button>
              </div>
            </div>

            {/* Acciones Rápidas */}
            {unreadCount > 0 && (
              <div className="px-6 py-3 bg-gray-50 border-b flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {unreadCount} notificación{unreadCount !== 1 ? 'es' : ''} sin leer
                </span>
                <button
                  onClick={onMarkAllAsRead}
                  className="text-sm text-brand-red hover:text-primary-600 font-semibold flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Marcar todas como leídas
                </button>
              </div>
            )}

            {/* Lista de Notificaciones */}
            <div className="flex-1 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Bell className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-600 font-semibold mb-2">
                    {filter === 'unread' ? 'Sin notificaciones pendientes' : 'No hay notificaciones'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Las alertas de otros módulos aparecerán aquí
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredNotifications.map((notification) => {
                    const config = getTypeConfig(notification.type);
                    const Icon = config.icon;

                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 hover:bg-gray-50 transition-colors ${
                          !notification.is_read ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          {/* Icono */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
                            <Icon className={`w-5 h-5 ${config.iconColor}`} />
                          </div>

                          {/* Contenido */}
                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${config.color}`}>
                                    {getModuleLabel(notification.module_source)}
                                  </span>
                                  {!notification.is_read && (
                                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                                  )}
                                </div>
                                <h4 className="font-semibold text-gray-900 text-sm leading-tight">
                                  {notification.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-1">
                                {!notification.is_read && (
                                  <button
                                    onClick={() => onMarkAsRead(notification.id)}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    title="Marcar como leída"
                                  >
                                    <Check className="w-4 h-4 text-green-600" />
                                  </button>
                                )}
                                <button
                                  onClick={() => onDelete(notification.id)}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4 text-gray-500" />
                                </button>
                              </div>
                            </div>

                            {/* Mensaje */}
                            <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                              {notification.message}
                            </p>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(notification.created_at)}
                              </div>
                              {notification.action_url && (
                                <button
                                  onClick={() => handleAction(notification)}
                                  className="flex items-center gap-1 px-3 py-1 bg-brand-red hover:bg-primary-600 text-white text-xs rounded-lg transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Ver
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};

