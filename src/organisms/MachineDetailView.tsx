import { useState } from 'react';
import { ManagementRecordWithRelations } from '../types/database';
import { Input } from '../atoms/Input';
import { Button } from '../atoms/Button';
import { Label } from '../atoms/Label';
import { supabase } from '../services/supabase';

interface MachineDetailViewProps {
  record: ManagementRecordWithRelations;
  onUpdate: () => void;
}

export const MachineDetailView = ({ record, onUpdate }: MachineDetailViewProps) => {
  const [activeTab, setActiveTab] = useState<'auction' | 'purchase' | 'calculations'>('auction');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    projected_value: record.projected_value?.toString() || '',
    estimated_pvp: record.estimated_pvp?.toString() || '',
    final_comments: record.final_comments || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('management_table')
        .update({
          projected_value: formData.projected_value
            ? parseFloat(formData.projected_value)
            : null,
          estimated_pvp: formData.estimated_pvp ? parseFloat(formData.estimated_pvp) : null,
          final_comments: formData.final_comments || null,
        })
        .eq('id', record.id);

      if (error) throw error;

      setIsEditing(false);
      onUpdate();
      alert('Datos actualizados correctamente');
    } catch (error) {
      console.error('Error updating management record:', error);
      alert('Error al actualizar. Por favor, intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('auction')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'auction'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Subasta
          </button>
          <button
            onClick={() => setActiveTab('purchase')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'purchase'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Compra / Pago
          </button>
          <button
            onClick={() => setActiveTab('calculations')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'calculations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Cálculos y Costos
          </button>
        </div>
      </div>

      {activeTab === 'auction' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Información de Subasta</h3>
          {record.auction ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha de Subasta</Label>
                <p className="text-gray-800">
                  {new Date(record.auction.auction_date).toLocaleDateString('es-CO')}
                </p>
              </div>
              <div>
                <Label>Número de Lote</Label>
                <p className="text-gray-800">{record.auction.lot_number}</p>
              </div>
              <div>
                <Label>Precio Máximo</Label>
                <p className="text-gray-800">${record.auction.max_price.toLocaleString()}</p>
              </div>
              <div>
                <Label>Precio de Compra</Label>
                <p className="text-gray-800">
                  {record.auction.purchased_price
                    ? `$${record.auction.purchased_price.toLocaleString()}`
                    : '-'}
                </p>
              </div>
              <div>
                <Label>Tipo de Compra</Label>
                <p className="text-gray-800">{record.auction.purchase_type}</p>
              </div>
              <div>
                <Label>Estado</Label>
                <p className="text-gray-800">{record.auction.status}</p>
              </div>
              <div className="col-span-2">
                <Label>Proveedor</Label>
                <p className="text-gray-800">{record.auction.supplier?.name || '-'}</p>
              </div>
              {record.auction.comments && (
                <div className="col-span-2">
                  <Label>Comentarios</Label>
                  <p className="text-gray-800">{record.auction.comments}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No hay información de subasta disponible</p>
          )}
        </div>
      )}

      {activeTab === 'purchase' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Información de Compra</h3>
          {record.purchase ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha de Factura</Label>
                <p className="text-gray-800">
                  {new Date(record.purchase.invoice_date).toLocaleDateString('es-CO')}
                </p>
              </div>
              <div>
                <Label>Incoterm</Label>
                <p className="text-gray-800">{record.purchase.incoterm}</p>
              </div>
              <div>
                <Label>Valor EXW</Label>
                <p className="text-gray-800">${record.purchase.exw_value.toLocaleString()}</p>
              </div>
              <div>
                <Label>Valor FOB</Label>
                <p className="text-gray-800">${record.purchase.fob_value.toLocaleString()}</p>
              </div>
              <div>
                <Label>Valor Desarmado</Label>
                <p className="text-gray-800">
                  ${record.purchase.disassembly_value.toLocaleString()}
                </p>
              </div>
              <div>
                <Label>TRM</Label>
                <p className="text-gray-800">{record.purchase.trm}</p>
              </div>
              <div>
                <Label>Estado de Pago</Label>
                <p className="text-gray-800">{record.purchase.payment_status}</p>
              </div>
              <div>
                <Label>Fecha de Pago</Label>
                <p className="text-gray-800">
                  {record.purchase.payment_date
                    ? new Date(record.purchase.payment_date).toLocaleDateString('es-CO')
                    : '-'}
                </p>
              </div>
              {record.purchase.additional_costs && record.purchase.additional_costs.length > 0 && (
                <div className="col-span-2">
                  <Label>Costos Adicionales</Label>
                  <div className="mt-2 space-y-2">
                    {record.purchase.additional_costs.map((cost) => (
                      <div
                        key={cost.id}
                        className="flex justify-between items-center bg-gray-50 p-2 rounded"
                      >
                        <span>{cost.concept}</span>
                        <span className="font-medium">
                          {cost.amount.toLocaleString()} {cost.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No hay información de compra disponible</p>
          )}
        </div>
      )}

      {activeTab === 'calculations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Cálculos y Costos</h3>
            {!isEditing && (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                Editar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total FOB</Label>
              <p className="text-xl font-bold text-blue-600">
                ${record.total_fob.toLocaleString()}
              </p>
            </div>
            <div>
              <Label>Total CIF</Label>
              <p className="text-xl font-bold text-green-600">
                ${record.total_cif.toLocaleString()}
              </p>
            </div>
            <div>
              <Label>Costos Totales</Label>
              <p className="text-xl font-bold text-orange-600">
                ${record.total_costs.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <Input
              label="Valor Proyectado"
              type="number"
              step="0.01"
              value={formData.projected_value}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, projected_value: e.target.value }))
              }
              disabled={!isEditing}
            />

            <Input
              label="PVP Estimado"
              type="number"
              step="0.01"
              value={formData.estimated_pvp}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, estimated_pvp: e.target.value }))
              }
              disabled={!isEditing}
            />

            <div>
              <Label>Comentarios Finales</Label>
              <textarea
                value={formData.final_comments}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, final_comments: e.target.value }))
                }
                rows={4}
                disabled={!isEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>

            {isEditing && (
              <div className="flex justify-end gap-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      projected_value: record.projected_value?.toString() || '',
                      estimated_pvp: record.estimated_pvp?.toString() || '',
                      final_comments: record.final_comments || '',
                    });
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
