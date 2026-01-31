/**
 * Panel de Administración de Reglas de Notificación
 * Solo Admin
 */

import { useState, useEffect } from 'react';
import { Bell, Plus, Power, Edit2, Trash2, Play, RefreshCw, Activity } from 'lucide-react';
import { DataTable } from '../organisms/DataTable';
import { Button } from '../atoms/Button';
import { Modal } from '../molecules/Modal';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../components/Toast';
import { NotificationRuleForm } from '../components/NotificationRuleForm';
import { apiGet, apiPost, apiDelete } from '../services/api';

interface NotificationRule {
  id: string;
  rule_code: string;
  name: string;
  description: string | null;
  module_source: string;
  module_target: string;
  trigger_event: string;
  trigger_condition: Record<string, unknown>;
  notification_type: 'urgent' | 'warning' | 'info' | 'success';
  notification_priority: number;
  notification_title_template: string;
  notification_message_template: string;
  target_roles: string[];
  target_users: string[] | null;
  action_type: string | null;
  action_url_template: string | null;
  is_active: boolean;
  check_frequency_minutes: number;
  expires_in_days: number;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  creator_email?: string;
}

export const NotificationRulesPage = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [stats, setStats] = useState({
    total_rules: 0,
    active_rules: 0,
    inactive_rules: 0,
    modules_covered: 0
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<NotificationRule | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const data = await apiGet<NotificationRule[]>('/api/notification-rules');
      setRules(data);
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Error al cargar reglas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await apiGet<typeof stats>('/api/notification-rules/stats/summary');
      setStats(data);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- inicial solo al montar
  }, []);

  const handleToggle = async (id: string) => {
    try {
      const updatedRule = await apiPost<NotificationRule>(`/api/notification-rules/${id}/toggle`, {});
      showSuccess(`Regla ${updatedRule.is_active ? 'activada' : 'desactivada'}`);
      
      fetchRules();
      fetchStats();
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Error al cambiar estado de regla');
      console.error(error);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const result = await apiPost<{ totalNotificationsCreated?: number }>('/api/notification-rules/test', {});
      showSuccess(`Prueba completada: ${result.totalNotificationsCreated || 0} notificación(es) generada(s)`);
    } catch (error) {
      showError('Error ejecutando prueba');
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (id: string, rule_code: string) => {
    if (!confirm(`¿Eliminar la regla "${rule_code}"? Esta acción no se puede deshacer.`)) return;

    try {
      await apiDelete(`/api/notification-rules/${id}`);
      showSuccess('Regla eliminada');
      fetchRules();
      fetchStats();
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : 'Error al eliminar regla');
      console.error(error);
    }
  };

  const columns = [
    {
      key: 'is_active',
      label: 'ESTADO',
      sortable: true,
      render: (row: NotificationRule) => (
        <button
          onClick={() => handleToggle(row.id)}
          className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
            row.is_active 
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Power className="w-3 h-3" />
          {row.is_active ? 'Activa' : 'Inactiva'}
        </button>
      )
    },
    {
      key: 'rule_code',
      label: 'CÓDIGO',
      sortable: true,
      render: (row: NotificationRule) => (
        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{row.rule_code}</span>
      )
    },
    {
      key: 'name',
      label: 'NOMBRE',
      sortable: true,
      render: (row: NotificationRule) => (
        <div>
          <p className="font-semibold">{row.name}</p>
          {row.description && <p className="text-xs text-gray-500">{row.description}</p>}
        </div>
      )
    },
    {
      key: 'module_source',
      label: 'ORIGEN → DESTINO',
      render: (row: NotificationRule) => (
        <span className="text-xs">
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{row.module_source}</span>
          {' → '}
          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">{row.module_target}</span>
        </span>
      )
    },
    {
      key: 'notification_type',
      label: 'TIPO',
      sortable: true,
      render: (row: NotificationRule) => {
        const colors = {
          urgent: 'bg-red-100 text-red-800',
          warning: 'bg-yellow-100 text-yellow-800',
          info: 'bg-blue-100 text-blue-800',
          success: 'bg-green-100 text-green-800'
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[row.notification_type]}`}>
            {row.notification_type}
          </span>
        );
      }
    },
    {
      key: 'notification_priority',
      label: 'PRIORIDAD',
      sortable: true,
      render: (row: NotificationRule) => (
        <span className="font-bold text-gray-700">{row.notification_priority}</span>
      )
    },
    {
      key: 'target_roles',
      label: 'ROLES / USUARIOS',
      render: (row: NotificationRule) => (
        <div className="space-y-1">
          {row.target_roles && row.target_roles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.target_roles.map((role) => (
                <span key={role} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs">
                  {role}
                </span>
              ))}
            </div>
          )}
          {row.target_users && row.target_users.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {row.target_users.map((userId) => (
                <span key={userId} className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-xs" title={`Usuario ID: ${userId}`}>
                  👤 Usuario ({userId.substring(0, 8)}...)
                </span>
              ))}
            </div>
          )}
          {(!row.target_roles || row.target_roles.length === 0) && (!row.target_users || row.target_users.length === 0) && (
            <span className="text-gray-400 text-xs">Sin destinatarios</span>
          )}
        </div>
      )
    },
    {
      key: 'check_frequency_minutes',
      label: 'FRECUENCIA',
      sortable: true,
      render: (row: NotificationRule) => (
        <span className="text-xs text-gray-600">{row.check_frequency_minutes}min</span>
      )
    },
    {
      key: 'actions',
      label: 'ACCIONES',
      render: (row: NotificationRule) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectedRule(row);
              setIsModalOpen(true);
            }}
            className="p-1 hover:bg-blue-100 rounded"
            title="Ver detalles"
          >
            <Edit2 className="w-4 h-4 text-blue-600" />
          </button>
          <button
            onClick={() => handleDelete(row.id, row.rule_code)}
            className="p-1 hover:bg-red-100 rounded"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )
    }
  ];

  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-semibold">
            ⛔ Acceso Denegado: Solo administradores pueden acceder a este panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1800px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="w-8 h-8 text-brand-red" />
              Panel de Reglas de Notificación
            </h1>
            <p className="text-gray-600 mt-1">Gestionar triggers automáticos y alertas del sistema</p>
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Ejecutar Prueba
                </>
              )}
            </Button>
            
            <Button
              onClick={() => {
                setSelectedRule(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-brand-red hover:bg-primary-600"
            >
              <Plus className="w-5 h-5" />
              Nueva Regla
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Total Reglas</p>
                <p className="text-3xl font-bold text-blue-900">{stats.total_rules}</p>
              </div>
              <Activity className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Activas</p>
                <p className="text-3xl font-bold text-green-900">{stats.active_rules}</p>
              </div>
              <Power className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 font-medium">Inactivas</p>
                <p className="text-3xl font-bold text-gray-900">{stats.inactive_rules}</p>
              </div>
              <Bell className="w-10 h-10 text-gray-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">Módulos</p>
                <p className="text-3xl font-bold text-purple-900">{stats.modules_covered}</p>
              </div>
              <Activity className="w-10 h-10 text-purple-600" />
            </div>
        </div>
      </div>
      </div>

      {/* Tabla */}
      <DataTable
        data={rules}
        columns={columns}
        isLoading={loading}
      />

      {/* Modal de Formulario */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRule(null);
        }}
        title={selectedRule ? 'Editar Regla' : 'Nueva Regla'}
        size="xl"
      >
        <NotificationRuleForm
          rule={selectedRule}
          onSuccess={() => {
            setIsModalOpen(false);
            setSelectedRule(null);
            fetchRules();
            fetchStats();
          }}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedRule(null);
          }}
        />
      </Modal>
    </div>
  );
};

