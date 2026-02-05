/**
 * Formulario de Regla de Notificación
 * Para crear y editar reglas parametrizables
 */

import { useState, FormEvent, useEffect, useMemo } from 'react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { showSuccess, showError } from './Toast';
import { apiGet, apiPost, apiPut } from '../services/api';

/** Regla tal como viene del API (parcial para crear/editar) */
interface NotificationRuleRecord {
  id?: string;
  rule_code?: string;
  name?: string;
  description?: string | null;
  module_source?: string;
  module_target?: string;
  trigger_event?: string;
  trigger_condition?: Record<string, unknown>;
  notification_type?: string;
  notification_priority?: number;
  notification_title_template?: string;
  notification_message_template?: string;
  target_roles?: string[];
  target_users?: string[] | null;
  action_url_template?: string | null;
  check_frequency_minutes?: number;
  expires_in_days?: number;
}

interface NotificationRuleFormProps {
  rule?: NotificationRuleRecord | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface TriggerConditionRow {
  field: string;
  operator: string;
  value: string;
  id: string;
}

const MODULES = [
  { value: 'preselection', label: 'Preselección' },
  { value: 'auctions', label: 'Subastas' },
  { value: 'purchases', label: 'Compras' },
  { value: 'pagos', label: 'Pagos' },
  { value: 'equipments', label: 'Equipos' },
  { value: 'logistics', label: 'Logística' },
  { value: 'service', label: 'Servicio' },
  { value: 'importations', label: 'Importaciones' },
  { value: 'management', label: 'Consolidado' },
];

const TRIGGER_EVENTS = [
  { value: 'record_created', label: 'Registro Creado' },
  { value: 'status_change', label: 'Cambio de Estado' },
  { value: 'status_changed', label: 'Estado Cambiado (alias)' },
  { value: 'field_changed', label: 'Campo Modificado' },
  { value: 'purchase_price_fields_changed', label: 'Campos de precio/compras modificados (PRECIO COMPRA, VALOR+BP, GASTOS+LAVADO, DESENSAMBLAJE) → Pagos' },
  { value: 'periodic_check', label: 'Verificación Periódica' },
  { value: 'date_approaching', label: 'Fecha Próxima' },
  { value: 'invoice_missing', label: 'Factura Faltante' },
  { value: 'invoice_date_added', label: 'Fecha de Factura Agregada' },
  { value: 'nationalization_complete', label: 'Nacionalización Completa' },
  { value: 'staging_complete', label: 'Alistamiento Completo' },
  { value: 'no_movement', label: 'Sin Movimiento' },
];

const NOTIFICATION_TYPES = [
  { value: 'urgent', label: '🔴 Urgente', color: 'red' },
  { value: 'warning', label: '🟡 Advertencia', color: 'yellow' },
  { value: 'info', label: '🔵 Información', color: 'blue' },
  { value: 'success', label: '🟢 Éxito', color: 'green' },
];

const ROLES = [
  // Roles generales del sistema
  { value: 'admin', label: 'Admin' },
  { value: 'sebastian', label: 'Sebastián' },
  { value: 'gerencia', label: 'Gerencia' },
  { value: 'eliana', label: 'Eliana' },
  { value: 'importaciones', label: 'Importaciones' },
  { value: 'logistica', label: 'Logística' },
  { value: 'servicio', label: 'Servicio' },
  { value: 'comerciales', label: 'Comerciales' },
  { value: 'jefe_comercial', label: 'Jefe Comercial' },
  // Roles solicitados para notificaciones comerciales específicas
  { value: 'comercial123', label: 'Comercial 123' },
  { value: 'pagos', label: 'Pagos (LFlorez)' },
];

export const NotificationRuleForm = ({ rule, onSuccess, onCancel }: NotificationRuleFormProps) => {
  // Estado inicial - si rule está disponible, usar sus valores; si no, usar defaults
  const [formData, setFormData] = useState(() => {
    // Si rule ya está disponible al momento de crear el estado, usarlo
    if (rule) {
      return {
        rule_code: rule.rule_code || '',
        name: rule.name || '',
        description: rule.description || '',
        module_source: rule.module_source || '',
        module_target: rule.module_target || '',
        trigger_event: rule.trigger_event || 'periodic_check', // Importante: usar el valor exacto de la BD
        notification_type: rule.notification_type || 'info',
        notification_priority: rule.notification_priority?.toString() || '50',
        notification_title_template: rule.notification_title_template || '',
        notification_message_template: rule.notification_message_template || '',
        action_url_template: rule.action_url_template || '',
        check_frequency_minutes: rule.check_frequency_minutes?.toString() || '60',
        expires_in_days: rule.expires_in_days?.toString() || '7',
        condition_field: '',
        condition_operator: 'equals',
        condition_value: '',
      };
    }
    // Si no hay rule, usar valores por defecto
    return {
      rule_code: '',
      name: '',
      description: '',
      module_source: '',
      module_target: '',
      trigger_event: 'periodic_check',
      notification_type: 'info',
      notification_priority: '50',
      notification_title_template: '',
      notification_message_template: '',
      action_url_template: '',
      check_frequency_minutes: '60',
      expires_in_days: '7',
      condition_field: '',
      condition_operator: 'equals',
      condition_value: '',
    };
  });

  const [selectedRoles, setSelectedRoles] = useState<string[]>(rule?.target_roles || ['admin']);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(rule?.target_users || []);
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string, full_name: string, email: string, role: string}>>([]);
  const [filteredUsers, setFilteredUsers] = useState<Array<{id: string, full_name: string, email: string, role: string}>>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [conditions, setConditions] = useState<TriggerConditionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const nextConditionId = () => `cond-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Actualizar estados cuando cambie la regla (al editar)
  useEffect(() => {
    if (rule) {
      console.log('🔍 Cargando regla para editar:', {
        id: rule.id,
        trigger_event: rule.trigger_event,
        rule_code: rule.rule_code
      });
      
      setSelectedRoles(rule.target_roles || []);
      setSelectedUsers(rule.target_users || []);
      
      // Asegurar que trigger_event se establezca correctamente, incluso si es un valor personalizado
      const triggerEventValue = rule.trigger_event || 'periodic_check';
      
      setFormData(prev => ({
        ...prev,
        rule_code: rule.rule_code || '',
        name: rule.name || '',
        description: rule.description || '',
        module_source: rule.module_source || '',
        module_target: rule.module_target || '',
        trigger_event: triggerEventValue, // Usar el valor exacto de la BD
        notification_type: rule.notification_type || 'info',
        notification_priority: rule.notification_priority?.toString() || '50',
        notification_title_template: rule.notification_title_template || '',
        notification_message_template: rule.notification_message_template || '',
        action_url_template: rule.action_url_template || '',
        check_frequency_minutes: rule.check_frequency_minutes?.toString() || '60',
        expires_in_days: rule.expires_in_days?.toString() || '7',
        condition_field: '',
        condition_operator: 'equals',
        condition_value: '',
      }));

      if (rule.trigger_condition && typeof rule.trigger_condition === 'object') {
        const conds: TriggerConditionRow[] = Object.entries(rule.trigger_condition).map(([key, value]) => ({
          field: key,
          operator: 'equals',
          value: String(value ?? ''),
          id: nextConditionId(),
        }));
        setConditions(conds);
      } else {
        setConditions([]);
      }
    } else {
      // Resetear para nueva regla
      setSelectedRoles(['admin']);
      setSelectedUsers([]);
      setConditions([]);
    }
  }, [rule]);

  // Cargar lista de usuarios disponibles (solo una vez al montar)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const users = await apiGet<Array<{id: string, full_name: string, email: string, role: string}>>('/api/notification-rules/users/list');
        setAvailableUsers(users);
        setFilteredUsers(users);
      } catch (error) {
        console.error('Error cargando usuarios:', error);
        showError('Error al cargar lista de usuarios');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Filtrar usuarios según búsqueda
  useEffect(() => {
    if (!userSearchTerm) {
      setFilteredUsers(availableUsers);
      return;
    }

    const term = userSearchTerm.toLowerCase();
    const filtered = availableUsers.filter(user => 
      user.full_name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.role?.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  }, [userSearchTerm, availableUsers]);

  // Calcular opciones de trigger_event dinámicamente
  const triggerEventOptions = useMemo(() => {
    const currentValue = formData.trigger_event;
    const hasCurrentValue = TRIGGER_EVENTS.some(opt => opt.value === currentValue);
    
    // Crear lista de opciones, empezando con las estándar
    let options = [...TRIGGER_EVENTS];
    
    // Si hay un valor actual que no está en las opciones estándar, agregarlo al inicio
    if (currentValue && currentValue !== '' && !hasCurrentValue) {
      options = [
        {
          value: currentValue,
          label: `${currentValue} (valor actual - personalizado)`
        },
        ...options
      ];
    }
    
    return options;
  }, [formData.trigger_event]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const addCondition = () => {
    if (!formData.condition_field || !formData.condition_value) {
      showError('Complete el campo y valor de la condición');
      return;
    }

    setConditions(prev => [...prev, {
      field: formData.condition_field,
      operator: formData.condition_operator,
      value: formData.condition_value,
      id: nextConditionId(),
    }]);

    setFormData(prev => ({
      ...prev,
      condition_field: '',
      condition_value: ''
    }));
  };

  const removeCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!formData.rule_code || !formData.name || !formData.module_source || !formData.module_target) {
      showError('Complete todos los campos obligatorios');
      return;
    }

    if (selectedRoles.length === 0) {
      showError('Seleccione al menos un rol');
      return;
    }

    setLoading(true);
    try {
      const trigger_condition: Record<string, string> = {};
      conditions.forEach(cond => {
        trigger_condition[cond.field] = cond.value;
      });

      const payload = {
        rule_code: formData.rule_code.toUpperCase().replaceAll(/\s+/g, '_'),
        name: formData.name,
        description: formData.description || null,
        module_source: formData.module_source,
        module_target: formData.module_target,
        trigger_event: formData.trigger_event,
        trigger_condition,
        notification_type: formData.notification_type,
        notification_priority: Number.parseInt(formData.notification_priority, 10),
        notification_title_template: formData.notification_title_template,
        notification_message_template: formData.notification_message_template,
        target_roles: selectedRoles,
        target_users: selectedUsers.length > 0 ? selectedUsers : null,
        action_type: 'navigate',
        action_url_template: formData.action_url_template || null,
        check_frequency_minutes: Number.parseInt(formData.check_frequency_minutes, 10),
        expires_in_days: Number.parseInt(formData.expires_in_days, 10),
        is_active: true,
      };

      if (rule?.id) {
        await apiPut(`/api/notification-rules/${rule.id}`, payload);
      } else {
        await apiPost('/api/notification-rules', payload);
      }

      showSuccess(rule ? 'Regla actualizada exitosamente' : 'Regla creada exitosamente');
      onSuccess();
    } catch (error: unknown) {
      console.error('Error guardando regla:', error);
      const message = error instanceof Error ? error.message : 'Error al guardar regla';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const getSubmitButtonLabel = (isLoading: boolean, currentRule: NotificationRuleRecord | null | undefined): string => {
    if (isLoading) return 'Guardando...';
    return currentRule ? 'Actualizar Regla' : 'Crear Regla';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
      {/* Información Básica */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 mb-3">📋 Información Básica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Código de Regla *"
            value={formData.rule_code}
            onChange={(e) => handleChange('rule_code', e.target.value)}
            placeholder="PRESEL_PENDING"
            required
          />
          <Input
            label="Nombre de Regla *"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Preselecciones Pendientes"
            required
          />
        </div>
        <div className="mt-4">
          <Label>Descripción</Label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red"
            placeholder="Descripción de la regla..."
          />
        </div>
      </div>

      {/* Módulos */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-bold text-purple-900 mb-3">🔗 Módulos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Módulo Origen (Evento) *"
            value={formData.module_source}
            onChange={(e) => handleChange('module_source', e.target.value)}
            options={[
              { value: '', label: 'Seleccionar...' },
              ...MODULES
            ]}
            required
          />
          <Select
            label="Módulo Destino (Notificación) *"
            value={formData.module_target}
            onChange={(e) => handleChange('module_target', e.target.value)}
            options={[
              { value: '', label: 'Seleccionar...' },
              ...MODULES
            ]}
            required
          />
        </div>
      </div>

      {/* Trigger */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-bold text-yellow-900 mb-3">⚡ Evento Disparador</h3>
        <Select
          label="Tipo de Evento *"
          value={formData.trigger_event || ''}
          onChange={(e) => {
            console.log('🔄 Cambiando trigger_event:', e.target.value);
            handleChange('trigger_event', e.target.value);
          }}
          options={triggerEventOptions}
          required
        />
        {/* Debug info - solo en desarrollo */}
        {import.meta.env.DEV && formData.trigger_event && (
          <p className="mt-1 text-xs text-gray-500">
            Valor actual: <code>{formData.trigger_event}</code>
          </p>
        )}
        {formData.trigger_event && !TRIGGER_EVENTS.some(opt => opt.value === formData.trigger_event) && (
          <p className="mt-2 text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
            <strong>Nota:</strong> Este es un valor personalizado. Asegúrate de que el sistema pueda procesarlo correctamente.
          </p>
        )}

        {/* Condiciones */}
        <div className="mt-4">
          <Label>Condiciones de Disparo</Label>
          {formData.trigger_event === 'field_changed' && (
            <p className="text-xs text-yellow-700 mb-2">
              Para Campo Modificado use: campo <code className="bg-yellow-100 px-1 rounded">field_name</code>, valor el nombre del campo en BD (ej: <code className="bg-yellow-100 px-1 rounded">hours</code> para HORAS).
            </p>
          )}
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={formData.condition_field}
              onChange={(e) => handleChange('condition_field', e.target.value)}
              placeholder={formData.trigger_event === 'field_changed' ? 'field_name' : 'Campo (ej: decision)'}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <select
              value={formData.condition_operator}
              onChange={(e) => handleChange('condition_operator', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="equals">=</option>
              <option value="not_equals">≠</option>
              <option value="greater">{'>'}</option>
              <option value="less">{'<'}</option>
            </select>
            <input
              type="text"
              value={formData.condition_value}
              onChange={(e) => handleChange('condition_value', e.target.value)}
              placeholder={formData.trigger_event === 'field_changed' ? 'hours (para HORAS)' : 'Valor (ej: PENDIENTE)'}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <Button type="button" onClick={addCondition} size="sm" variant="secondary">
              + Agregar
            </Button>
          </div>

          {/* Lista de condiciones */}
          {conditions.length > 0 && (
            <div className="space-y-2">
              {conditions.map((cond) => (
                <div key={cond.id} className="flex items-center gap-2 bg-white p-2 rounded border border-yellow-300">
                  <span className="text-sm flex-1">
                    <code className="bg-gray-100 px-2 py-1 rounded">{cond.field}</code>
                    {' '}{cond.operator === 'equals' ? '=' : cond.operator}{' '}
                    <code className="bg-gray-100 px-2 py-1 rounded">{cond.value}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCondition(conditions.findIndex((c) => c.id === cond.id))}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    ✕ Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notificación */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-bold text-red-900 mb-3">🔔 Configuración de Notificación</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Tipo de Notificación *"
            value={formData.notification_type}
            onChange={(e) => handleChange('notification_type', e.target.value)}
            options={NOTIFICATION_TYPES}
            required
          />
          <Input
            label="Prioridad (1-100) *"
            type="number"
            min="1"
            max="100"
            value={formData.notification_priority}
            onChange={(e) => handleChange('notification_priority', e.target.value)}
            required
          />
        </div>

        <div className="mt-4">
          <Input
            label="Template Título *"
            value={formData.notification_title_template}
            onChange={(e) => handleChange('notification_title_template', e.target.value)}
            placeholder="⏳ Preselecciones Pendientes"
            required
          />
        </div>

        <div className="mt-4">
          <Label>Template Mensaje *</Label>
          <textarea
            value={formData.notification_message_template}
            onChange={(e) => handleChange('notification_message_template', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red"
            placeholder="Hay {{count}} preselección(es) esperando respuesta"
            required
          />
        </div>

        <div className="mt-4">
          <Input
            label="URL de Acción"
            value={formData.action_url_template}
            onChange={(e) => handleChange('action_url_template', e.target.value)}
            placeholder="/preselection"
          />
          <p className="text-xs text-gray-500 mt-1">URL a la que se dirigirá al hacer clic</p>
        </div>
      </div>

      {/* Roles */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h3 className="font-bold text-indigo-900 mb-3">👥 Roles Destinatarios *</h3>
        <p className="text-sm text-indigo-700 mb-3">Seleccione uno o más roles que recibirán esta notificación</p>
        <div className="flex flex-wrap gap-2">
          {ROLES.map(role => (
            <button
              key={role.value}
              type="button"
              onClick={() => handleRoleToggle(role.value)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                selectedRoles.includes(role.value)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-100'
              }`}
            >
              {selectedRoles.includes(role.value) && '✓ '}
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* Usuarios Específicos */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
        <h3 className="font-bold text-teal-900 mb-3">👤 Usuarios Específicos (Opcional)</h3>
        <p className="text-sm text-teal-700 mb-3">Seleccione usuarios específicos que recibirán esta notificación además de los roles</p>
        
        {loadingUsers ? (
          <div className="text-center py-4 text-teal-600">Cargando usuarios...</div>
        ) : (
          <>
            {/* Buscador de usuarios */}
            <div className="mb-3">
              <input
                type="text"
                id="user-search"
                placeholder="Buscar por nombre, email o rol..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Lista de usuarios seleccionados */}
            {selectedUsers.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-semibold text-teal-800 mb-2">Usuarios seleccionados ({selectedUsers.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(userId => {
                    const user = availableUsers.find(u => u.id === userId);
                    if (!user) return null;
                    return (
                      <div
                        key={userId}
                        className="px-3 py-1 bg-teal-600 text-white rounded-lg text-sm flex items-center gap-2"
                      >
                        {user.full_name} ({user.email})
                        <button
                          type="button"
                          onClick={() => handleUserToggle(userId)}
                          className="ml-1 hover:text-red-200"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lista de usuarios disponibles */}
            <div className="max-h-60 overflow-y-auto border border-teal-200 rounded-lg bg-white">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {availableUsers.length === 0 
                    ? 'No hay usuarios disponibles' 
                    : 'No se encontraron usuarios que coincidan con la búsqueda'}
                </div>
              ) : (
                <div className="divide-y divide-teal-100">
                  {filteredUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center p-3 hover:bg-teal-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        className="mr-3 h-4 w-4 text-teal-600 focus:ring-teal-500 border-teal-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-teal-900">{user.full_name}</div>
                        <div className="text-xs text-teal-600">{user.email}</div>
                        <div className="text-xs text-teal-500">Rol: {user.role}</div>
                      </div>
                      {selectedUsers.includes(user.id) && (
                        <span className="text-teal-600 font-bold">✓</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Información sobre usuarios importantes */}
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-800 mb-2">📌 Usuarios importantes a considerar:</p>
              <div className="text-xs text-yellow-700 space-y-1 mb-2">
                {['sdonado@partequiposusa.com', 'pcano@partequipos.com', 'lgonzalez@partequipos.com', 'lflorez@partequipos.com', 'cvargas@partequipos.com'].map(email => {
                  const user = availableUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
                  return (
                    <div key={email} className="flex items-center gap-2">
                      <span>• {email}</span>
                      {user ? (
                        <span className="text-green-600 font-semibold">✓ Disponible</span>
                      ) : (
                        <span className="text-red-600 font-semibold">✗ No encontrado</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-yellow-600 italic">
                Nota: Estos usuarios deben existir en el sistema para poder seleccionarlos. 
                Si no aparecen, verifica que estén registrados en la base de datos.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Configuración Temporal */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-bold text-green-900 mb-3">⏱️ Configuración Temporal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Frecuencia de Verificación (minutos) *"
            type="number"
            min="5"
            value={formData.check_frequency_minutes}
            onChange={(e) => handleChange('check_frequency_minutes', e.target.value)}
            required
          />
          <Input
            label="Expira en (días) *"
            type="number"
            min="1"
            value={formData.expires_in_days}
            onChange={(e) => handleChange('expires_in_days', e.target.value)}
            required
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {getSubmitButtonLabel(loading, rule)}
        </Button>
      </div>
    </form>
  );
};

