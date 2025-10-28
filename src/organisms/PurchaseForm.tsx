import { useState, FormEvent, useEffect } from 'react';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { PurchaseWithRelations, PaymentStatus, Currency, AdditionalCost } from '../types/database';
import { useSuppliers } from '../hooks/useSuppliers';
import { useMachines } from '../hooks/useMachines';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Trash2, Plus } from 'lucide-react';

interface PurchaseFormProps {
  purchase?: PurchaseWithRelations | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PurchaseForm = ({ purchase, onSuccess, onCancel }: PurchaseFormProps) => {
  const { user } = useAuth();
  const { suppliers } = useSuppliers();
  const { machines } = useMachines();

  const [formData, setFormData] = useState({
    machine_id: purchase?.machine_id || '',
    supplier_id: purchase?.supplier_id || '',
    invoice_date: purchase?.invoice_date || '',
    incoterm: purchase?.incoterm || 'FOB',
    exw_value: purchase?.exw_value?.toString() || '0',
    fob_value: purchase?.fob_value?.toString() || '0',
    disassembly_value: purchase?.disassembly_value?.toString() || '0',
    usd_rate: purchase?.usd_rate?.toString() || '1',
    jpy_rate: purchase?.jpy_rate?.toString() || '',
    trm: purchase?.trm?.toString() || '',
    port: purchase?.port || '',
    shipping_type: purchase?.shipping_type || '',
    departure_date: purchase?.departure_date || '',
    payment_status: purchase?.payment_status || 'PENDING',
    payment_date: purchase?.payment_date || '',
  });

  const [additionalCosts, setAdditionalCosts] = useState<Partial<AdditionalCost>[]>(
    purchase?.additional_costs || []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (formData.departure_date && !purchase?.estimated_arrival_date) {
      const departureDate = new Date(formData.departure_date);
      departureDate.setDate(departureDate.getDate() + 45);
      const estimatedArrival = departureDate.toISOString().split('T')[0];
      setFormData((prev) => ({ ...prev, estimated_arrival_date: estimatedArrival }));
    }
  }, [formData.departure_date, purchase?.estimated_arrival_date]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const addAdditionalCost = () => {
    setAdditionalCosts([...additionalCosts, { concept: '', amount: 0, currency: 'USD' }]);
  };

  const removeAdditionalCost = (index: number) => {
    setAdditionalCosts(additionalCosts.filter((_, i) => i !== index));
  };

  const updateAdditionalCost = (
    index: number,
    field: keyof AdditionalCost,
    value: string | number
  ) => {
    const updated = [...additionalCosts];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalCosts(updated);
  };

  const calculateTotals = () => {
    const fob = parseFloat(formData.fob_value) || 0;
    const exw = parseFloat(formData.exw_value) || 0;
    const disassembly = parseFloat(formData.disassembly_value) || 0;

    const additionalTotal = additionalCosts.reduce((sum, cost) => {
      return sum + (parseFloat(cost.amount?.toString() || '0') || 0);
    }, 0);

    const totalFOB = fob + exw + disassembly;
    const totalCIF = totalFOB + additionalTotal;

    return { totalFOB, totalCIF };
  };

  const { totalFOB, totalCIF } = calculateTotals();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.machine_id) newErrors.machine_id = 'Máquina requerida';
    if (!formData.supplier_id) newErrors.supplier_id = 'Proveedor requerido';
    if (!formData.invoice_date) newErrors.invoice_date = 'Fecha de factura requerida';
    if (!formData.trm) newErrors.trm = 'TRM requerida';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !user) return;

    setLoading(true);
    try {
      const purchaseData = {
        machine_id: formData.machine_id,
        supplier_id: formData.supplier_id,
        invoice_date: formData.invoice_date,
        incoterm: formData.incoterm,
        exw_value: parseFloat(formData.exw_value),
        fob_value: parseFloat(formData.fob_value),
        disassembly_value: parseFloat(formData.disassembly_value),
        usd_rate: parseFloat(formData.usd_rate),
        jpy_rate: formData.jpy_rate ? parseFloat(formData.jpy_rate) : null,
        trm: parseFloat(formData.trm),
        port: formData.port || null,
        shipping_type: formData.shipping_type || null,
        departure_date: formData.departure_date || null,
        estimated_arrival_date: formData.departure_date
          ? new Date(new Date(formData.departure_date).getTime() + 45 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0]
          : null,
        payment_status: formData.payment_status as PaymentStatus,
        payment_date: formData.payment_date || null,
        created_by: user.id,
      };

      let purchaseId = purchase?.id;

      if (purchase) {
        const { error } = await supabase
          .from('purchases')
          .update(purchaseData)
          .eq('id', purchase.id);

        if (error) throw error;

        await supabase.from('additional_costs').delete().eq('purchase_id', purchase.id);
      } else {
        const { data, error } = await supabase
          .from('purchases')
          .insert(purchaseData)
          .select()
          .single();

        if (error) throw error;
        purchaseId = data.id;
      }

      if (additionalCosts.length > 0 && purchaseId) {
        const costsToInsert = additionalCosts
          .filter((cost) => cost.concept && cost.amount)
          .map((cost) => ({
            purchase_id: purchaseId,
            concept: cost.concept!,
            amount: parseFloat(cost.amount!.toString()),
            currency: (cost.currency || 'USD') as Currency,
          }));

        if (costsToInsert.length > 0) {
          const { error } = await supabase.from('additional_costs').insert(costsToInsert);
          if (error) throw error;
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Error al guardar la compra. Por favor, intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto px-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Máquina"
          value={formData.machine_id}
          onChange={(e) => handleChange('machine_id', e.target.value)}
          options={machines.map((m) => ({
            value: m.id,
            label: `${m.model} - ${m.serial}`,
          }))}
          error={errors.machine_id}
          required
        />

        <Select
          label="Proveedor"
          value={formData.supplier_id}
          onChange={(e) => handleChange('supplier_id', e.target.value)}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          error={errors.supplier_id}
          required
        />

        <Input
          label="Fecha de Factura"
          type="date"
          value={formData.invoice_date}
          onChange={(e) => handleChange('invoice_date', e.target.value)}
          error={errors.invoice_date}
          required
        />

        <Select
          label="Incoterm"
          value={formData.incoterm}
          onChange={(e) => handleChange('incoterm', e.target.value)}
          options={[
            { value: 'EXW', label: 'EXW' },
            { value: 'FOB', label: 'FOB' },
            { value: 'CIF', label: 'CIF' },
          ]}
          required
        />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Valores Base</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Valor EXW (USD)"
            type="number"
            step="0.01"
            value={formData.exw_value}
            onChange={(e) => handleChange('exw_value', e.target.value)}
          />

          <Input
            label="Valor FOB (USD)"
            type="number"
            step="0.01"
            value={formData.fob_value}
            onChange={(e) => handleChange('fob_value', e.target.value)}
          />

          <Input
            label="Valor Desarmado (USD)"
            type="number"
            step="0.01"
            value={formData.disassembly_value}
            onChange={(e) => handleChange('disassembly_value', e.target.value)}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Tasas de Cambio</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Tasa USD"
            type="number"
            step="0.0001"
            value={formData.usd_rate}
            onChange={(e) => handleChange('usd_rate', e.target.value)}
          />

          <Input
            label="Tasa JPY"
            type="number"
            step="0.0001"
            value={formData.jpy_rate}
            onChange={(e) => handleChange('jpy_rate', e.target.value)}
          />

          <Input
            label="TRM (COP)"
            type="number"
            step="0.01"
            value={formData.trm}
            onChange={(e) => handleChange('trm', e.target.value)}
            error={errors.trm}
            required
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Costos Adicionales</h3>
          <Button type="button" size="sm" onClick={addAdditionalCost}>
            <Plus className="w-4 h-4 mr-1" />
            Agregar Costo
          </Button>
        </div>

        {additionalCosts.map((cost, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            <div className="md:col-span-2">
              <Input
                label="Concepto"
                value={cost.concept || ''}
                onChange={(e) => updateAdditionalCost(index, 'concept', e.target.value)}
                placeholder="Ej: Flete, Inland, Repuestos"
              />
            </div>
            <Input
              label="Monto"
              type="number"
              step="0.01"
              value={cost.amount?.toString() || ''}
              onChange={(e) => updateAdditionalCost(index, 'amount', parseFloat(e.target.value))}
            />
            <div className="flex gap-2">
              <Select
                label="Moneda"
                value={cost.currency || 'USD'}
                onChange={(e) => updateAdditionalCost(index, 'currency', e.target.value)}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'COP', label: 'COP' },
                  { value: 'JPY', label: 'JPY' },
                ]}
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => removeAdditionalCost(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Envío</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Puerto"
            value={formData.port}
            onChange={(e) => handleChange('port', e.target.value)}
          />

          <Input
            label="Tipo de Envío"
            value={formData.shipping_type}
            onChange={(e) => handleChange('shipping_type', e.target.value)}
          />

          <Input
            label="Fecha de Salida"
            type="date"
            value={formData.departure_date}
            onChange={(e) => handleChange('departure_date', e.target.value)}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Estado de Pago"
            value={formData.payment_status}
            onChange={(e) => handleChange('payment_status', e.target.value)}
            options={[
              { value: 'PENDING', label: 'Pendiente' },
              { value: 'PARTIAL', label: 'Parcial' },
              { value: 'RELEASED', label: 'Liberado' },
            ]}
            required
          />

          <Input
            label="Fecha de Pago"
            type="date"
            value={formData.payment_date}
            onChange={(e) => handleChange('payment_date', e.target.value)}
          />
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border-t">
        <h3 className="text-lg font-medium mb-2">Totales Calculados</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Total FOB</Label>
            <p className="text-2xl font-bold text-blue-600">${totalFOB.toLocaleString()}</p>
          </div>
          <div>
            <Label>Total CIF</Label>
            <p className="text-2xl font-bold text-green-600">${totalCIF.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 border-t pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : purchase ? 'Actualizar' : 'Crear Compra'}
        </Button>
      </div>
    </form>
  );
};
