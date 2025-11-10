/**
 * Formulario de Regla de Notificación
 * Para crear y editar reglas parametrizables
 */

import { useState, FormEvent, useEffect } from 'react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { showSuccess, showError } from './Toast';

interface NotificationRuleFormProps {
  rule?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const MODULES = [
  { value: 'preselection', label: 'Preselección' },
  { value: 'auctions', label: 'Subastas' },
  { value: 'purchases', label: 'Compras' },
  { value: 'equipments', label: 'Equipos' },
  { value: 'logistics', label: 'Logística' },
  { value: 'service', label: 'Servicio' },
  { value: 'importations', label: 'Importaciones' },
  { value: 'management', label: 'Consolidado' },
];

const TRIGGER_EVENTS = [
  { value: 'record_created', label: 'Registro Creado' },
  { value: 'status_changed', label: 'Estado Cambiado' },
  { value: 'field_changed', label: 'Campo Modificado' },
  { value: 'periodic_check', label: 'Verificación Periódica' },
  { value: 'date_approaching', label: 'Fecha Próxima' },
];

const NOTIFICATION_TYPES = [
  { value: 'urgent', label: '🔴 Urgente', color: 'red' },
  { value: 'warning', label: '🟡 Advertencia', color: 'yellow' },
  { value: 'info', label: '🔵 Información', color: 'blue' },
  { value: 'success', label: '🟢 Éxito', color: 'green' },
];

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'sebastian', label: 'Sebastián' },
  { value: 'gerencia', label: 'Gerencia' },
  { value: 'eliana', label: 'Eliana' },
  { value: 'importaciones', label: 'Importaciones' },
  { value: 'logistica', label: 'Logística' },
  { value: 'servicio', label: 'Servicio' },
  { value: 'comerciales', label: 'Comerciales' },
  { value: 'jefe_comercial', label: 'Jefe Comercial' },
];

export const NotificationRuleForm = ({ rule, onSuccess, onCancel }: NotificationRuleFormProps) => {
  const [formData, setFormData] = useState({
    rule_code: rule?.rule_code || '',
    name: rule?.name || '',
    description: rule?.description || '',
    module_source: rule?.module_source || '',
    module_target: rule?.module_target || '',
    trigger_event: rule?.trigger_event || 'periodic_check',
    notification_type: rule?.notification_type || 'info',
    notification_priority: rule?.notification_priority?.toString() || '50',
    notification_title_template: rule?.notification_title_template || '',
    notification_message_template: rule?.notification_message_template || '',
    action_url_template: rule?.action_url_template || '',
    check_frequency_minutes: rule?.check_frequency_minutes?.toString() || '60',
    expires_in_days: rule?.expires_in_days?.toString() || '7',
    // Campos de condición
    condition_field: '',
    condition_operator: 'equals',
    condition_value: '',
  });

  const [selectedRoles, setSelectedRoles] = useState<string[]>(rule?.target_roles || ['admin']);
  const [conditions, setConditions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rule?.trigger_condition) {
      // Cargar condiciones existentes
      const conds = Object.entries(rule.trigger_condition).map(([key, value]) => ({
        field: key,
        operator: 'equals',
        value: value
      }));
      setConditions(conds);
    }
  }, [rule]);

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

  const addCondition = () => {
    if (!formData.condition_field || !formData.condition_value) {
      showError('Complete el campo y valor de la condición');
      return;
    }

    setConditions(prev => [...prev, {
      field: formData.condition_field,
      operator: formData.condition_operator,
      value: formData.condition_value
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
      const token = localStorage.getItem('token');
      
      // Construir objeto de condición
      const trigger_condition: any = {};
      conditions.forEach(cond => {
        trigger_condition[cond.field] = cond.value;
      });

      const payload = {
        rule_code: formData.rule_code.toUpperCase().replace(/\s+/g, '_'),
        name: formData.name,
        description: formData.description || null,
        module_source: formData.module_source,
        module_target: formData.module_target,
        trigger_event: formData.trigger_event,
        trigger_condition,
        notification_type: formData.notification_type,
        notification_priority: parseInt(formData.notification_priority),
        notification_title_template: formData.notification_title_template,
        notification_message_template: formData.notification_message_template,
        target_roles: selectedRoles,
        target_users: null,
        action_type: 'navigate',
        action_url_template: formData.action_url_template || null,
        check_frequency_minutes: parseInt(formData.check_frequency_minutes),
        expires_in_days: parseInt(formData.expires_in_days),
        is_active: true,
      };

      const url = rule 
        ? `http://localhost:3000/api/notification-rules/${rule.id}`
        : 'http://localhost:3000/api/notification-rules';
      
      const method = rule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar regla');
      }

      showSuccess(rule ? 'Regla actualizada exitosamente' : 'Regla creada exitosamente');
      onSuccess();
    } catch (error) {
      console.error('Error guardando regla:', error);
      showError(error instanceof Error ? error.message : 'Error al guardar regla');
    } finally {
      setLoading(false);
    }
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
          value={formData.trigger_event}
          onChange={(e) => handleChange('trigger_event', e.target.value)}
          options={TRIGGER_EVENTS}
          required
        />

        {/* Condiciones */}
        <div className="mt-4">
          <Label>Condiciones de Disparo</Label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={formData.condition_field}
              onChange={(e) => handleChange('condition_field', e.target.value)}
              placeholder="Campo (ej: decision)"
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
              placeholder="Valor (ej: PENDIENTE)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <Button type="button" onClick={addCondition} size="sm" variant="secondary">
              + Agregar
            </Button>
          </div>

          {/* Lista de condiciones */}
          {conditions.length > 0 && (
            <div className="space-y-2">
              {conditions.map((cond, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border border-yellow-300">
                  <span className="text-sm flex-1">
                    <code className="bg-gray-100 px-2 py-1 rounded">{cond.field}</code>
                    {' '}{cond.operator === 'equals' ? '=' : cond.operator}{' '}
                    <code className="bg-gray-100 px-2 py-1 rounded">{cond.value}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCondition(idx)}
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
          {loading ? 'Guardando...' : rule ? 'Actualizar Regla' : 'Crear Regla'}
        </Button>
      </div>
    </form>
  );
};

