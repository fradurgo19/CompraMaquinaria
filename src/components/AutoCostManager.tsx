import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, Edit2, X, Calculator } from 'lucide-react';
import { Modal } from '../molecules/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { AutomaticCostRule, ShipmentType } from '../types/database';
import {
  AutoCostRulePayload,
  createAutoCostRule,
  deleteAutoCostRule,
  listAutoCostRules,
  updateAutoCostRule,
} from '../services/autoCostRules.service';
import { showError, showSuccess } from './Toast';

interface AutoCostManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (rules: AutomaticCostRule[]) => void;
}

const SHIPMENT_OPTIONS: Array<{ value: ShipmentType; label: string }> = [
  { value: 'RORO', label: 'RORO' },
  { value: '1X40', label: '1x40' },
  { value: '1X20', label: '1x20' },
  { value: 'LCL', label: 'LCL' },
  { value: 'AEREO', label: 'Aéreo' },
];

const formatMoney = (value?: number | null) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
};

const parseNumber = (value: string) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parsePatterns = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => p.toUpperCase())
    )
  );

export const AutoCostManager = ({ isOpen, onClose, onSaved }: AutoCostManagerProps) => {
  const [rules, setRules] = useState<AutomaticCostRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    brand: '',
    tonnage_min: '',
    tonnage_max: '',
    tonnage_label: '',
    equipment: '',
    m3: '',
    shipment_method: '',
    model_patterns: '',
    ocean_usd: '',
    gastos_pto_cop: '',
    flete_cop: '',
    notes: '',
    active: true,
  });

  useEffect(() => {
    if (isOpen) {
      fetchRules();
      resetForm();
    }
  }, [isOpen]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const data = await listAutoCostRules();
      setRules(data || []);
      onSaved?.(data || []);
    } catch (error) {
      console.error('Error cargando reglas automáticas', error);
      showError('Error al cargar reglas de gastos automáticos');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '',
      brand: '',
      tonnage_min: '',
      tonnage_max: '',
      tonnage_label: '',
      equipment: '',
      m3: '',
      shipment_method: '',
      model_patterns: '',
      ocean_usd: '',
      gastos_pto_cop: '',
      flete_cop: '',
      notes: '',
      active: true,
    });
  };

  const handleEdit = (rule: AutomaticCostRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name || '',
      brand: rule.brand || '',
      tonnage_min: rule.tonnage_min?.toString() || '',
      tonnage_max: rule.tonnage_max?.toString() || '',
      tonnage_label: rule.tonnage_label || '',
      equipment: rule.equipment || '',
      m3: rule.m3?.toString() || '',
      shipment_method: rule.shipment_method || '',
      model_patterns: (rule.model_patterns || []).join(', '),
      ocean_usd: rule.ocean_usd?.toString() || '',
      gastos_pto_cop: rule.gastos_pto_cop?.toString() || '',
      flete_cop: rule.flete_cop?.toString() || '',
      notes: rule.notes || '',
      active: rule.active,
    });
  };

  const buildPayload = (): AutoCostRulePayload => ({
    name: form.name || null,
    brand: form.brand ? form.brand.toUpperCase() : null,
    tonnage_min: parseNumber(form.tonnage_min),
    tonnage_max: parseNumber(form.tonnage_max),
    tonnage_label: form.tonnage_label || null,
    equipment: form.equipment || null,
    m3: parseNumber(form.m3),
    shipment_method: (form.shipment_method as ShipmentType) || null,
    model_patterns: parsePatterns(form.model_patterns),
    ocean_usd: parseNumber(form.ocean_usd),
    gastos_pto_cop: parseNumber(form.gastos_pto_cop),
    flete_cop: parseNumber(form.flete_cop),
    notes: form.notes || null,
    active: form.active,
  });

  const handleSave = async () => {
    try {
      if (!form.model_patterns.trim()) {
        showError('Agrega al menos un modelo');
        return;
      }
      setLoading(true);
      const payload = buildPayload();
      if (editingId) {
        await updateAutoCostRule(editingId, payload);
        showSuccess('Regla actualizada');
      } else {
        await createAutoCostRule(payload);
        showSuccess('Regla creada');
      }
      resetForm();
      fetchRules();
    } catch (error: any) {
      console.error('Error guardando regla', error);
      const message = error?.response?.data?.error || error?.message || 'Error al guardar regla';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    try {
      setLoading(true);
      await deleteAutoCostRule(id);
      showSuccess('Regla eliminada');
      fetchRules();
    } catch (error) {
      console.error('Error eliminando regla', error);
      showError('Error al eliminar regla');
    } finally {
      setLoading(false);
    }
  };

  const totalRules = useMemo(() => rules.length, [rules]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestor de gastos automáticos">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-gray-600">
              Define valores por tonelaje/modelo para OCEAN (USD), Gastos Pto y Traslados Nacionales (COP).
            </p>
            <p className="text-xs text-gray-500">
              Las coincidencias se buscan por modelo exacto o prefijo (ej: ZX200 aplica a ZX200LC).
            </p>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold">
            <Calculator className="w-4 h-4" />
            {totalRules} reglas
          </span>
        </div>

        {/* Formulario */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <Input
            label="Nombre / alias"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Excavadoras 20T RORO"
          />
          <Input
            label="Marca (opcional)"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value.toUpperCase() })}
            placeholder="CATERPILLAR"
          />
          <Select
            label="Método de embarque"
            value={form.shipment_method}
            onChange={(e) => setForm({ ...form, shipment_method: e.target.value })}
            options={[{ value: '', label: 'Cualquiera' }, ...SHIPMENT_OPTIONS]}
          />
          <Input
            label="Tonelaje desde"
            type="number"
            value={form.tonnage_min}
            onChange={(e) => setForm({ ...form, tonnage_min: e.target.value })}
            placeholder="Ej: 18"
          />
          <Input
            label="Tonelaje hasta"
            type="number"
            value={form.tonnage_max}
            onChange={(e) => setForm({ ...form, tonnage_max: e.target.value })}
            placeholder="Ej: 25"
          />
          <Input
            label="Etiqueta tonelaje"
            value={form.tonnage_label}
            onChange={(e) => setForm({ ...form, tonnage_label: e.target.value })}
            placeholder="Ej: 20T - 25T"
          />
          <Input
            label="M3 (desarmada)"
            type="number"
            value={form.m3}
            onChange={(e) => setForm({ ...form, m3: e.target.value })}
            placeholder="Ej: 25"
          />
          <Input
            label="Modelos / prefijos (coma)"
            value={form.model_patterns}
            onChange={(e) => setForm({ ...form, model_patterns: e.target.value })}
            placeholder="ZX200, ZX240, PC200"
            required
          />
          <Input
            label="OCEAN (USD)"
            type="number"
            value={form.ocean_usd}
            onChange={(e) => setForm({ ...form, ocean_usd: e.target.value })}
            placeholder="Ej: 3500"
          />
          <Input
            label="Gastos Pto (COP)"
            type="number"
            value={form.gastos_pto_cop}
            onChange={(e) => setForm({ ...form, gastos_pto_cop: e.target.value })}
            placeholder="Ej: 12000000"
          />
          <Input
            label="Traslados Nacionales (COP)"
            type="number"
            value={form.flete_cop}
            onChange={(e) => setForm({ ...form, flete_cop: e.target.value })}
            placeholder="Ej: 8000000"
          />
          <Input
            label="Notas"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Observaciones internas"
          />
          <label className="flex items-center gap-2 text-sm mt-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded"
            />
            Activa
          </label>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#cf1b22] text-white hover:bg-[#a01419] flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {editingId ? 'Actualizar regla' : 'Guardar regla'}
          </Button>
          <Button onClick={resetForm} variant="secondary" disabled={loading}>
            <X className="w-4 h-4 mr-1" />
            Limpiar
          </Button>
        </div>

        {/* Lista de reglas */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
            <div className="font-semibold text-gray-800">Reglas configuradas</div>
            <Button
              onClick={fetchRules}
              variant="secondary"
              disabled={loading}
              className="text-sm px-3 py-1"
            >
              <Plus className="w-4 h-4 mr-1" />
              Recargar
            </Button>
          </div>
          {loading && rules.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Cargando reglas...</p>
          ) : rules.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No hay reglas configuradas.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {rules.map((rule) => (
                <div key={rule.id} className="px-4 py-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-start">
                  <div>
                    <p className="text-xs text-gray-500">Modelos</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {rule.model_patterns?.length ? rule.model_patterns.join(', ') : '-'}
                    </p>
                    {rule.brand && <p className="text-[11px] text-gray-500">Marca: {rule.brand}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tonelaje</p>
                    <p className="text-sm text-gray-800">
                      {rule.tonnage_min ?? '-'} - {rule.tonnage_max ?? '-'}
                    </p>
                    {rule.tonnage_label && <p className="text-[11px] text-gray-500">{rule.tonnage_label}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Método</p>
                    <p className="text-sm text-gray-800">{rule.shipment_method || 'Cualquiera'}</p>
                    {rule.m3 && <p className="text-[11px] text-gray-500">M3: {rule.m3}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">OCEAN (USD)</p>
                    <p className="text-sm font-semibold text-gray-800">{formatMoney(rule.ocean_usd)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Gastos / Traslados (COP)</p>
                    <p className="text-sm text-gray-800">
                      {formatMoney(rule.gastos_pto_cop)} / {formatMoney(rule.flete_cop)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      onClick={() => handleEdit(rule)}
                      className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 text-sm"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      onClick={() => handleDelete(rule.id)}
                      className="bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1 text-sm"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Borrar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

