import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Wrench } from 'lucide-react';
import { apiGet, apiPut } from '../services/api';
import { ServiceRecord } from '../types/database';
import { showError, showSuccess } from '../components/Toast';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';

export const ServicePage = () => {
  const [data, setData] = useState<ServiceRecord[]>([]);
  const [filtered, setFiltered] = useState<ServiceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ start_staging: string; end_staging: string }>({ start_staging: '', end_staging: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [current, setCurrent] = useState<ServiceRecord | null>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!search) return setFiltered(data);
    const s = search.toLowerCase();
    setFiltered(
      data.filter(r => (r.model || '').toLowerCase().includes(s) || (r.serial || '').toLowerCase().includes(s) || (r.supplier_name || '').toLowerCase().includes(s))
    );
  }, [search, data]);

  const load = async () => {
    try {
      const rows = await apiGet<ServiceRecord[]>('/api/service');
      setData(rows);
      setFiltered(rows);
    } catch {
      showError('Error al cargar Servicio');
    }
  };

  const startEdit = (row: ServiceRecord) => {
    setEditing(row.id);
    setCurrent(row);
    setForm({
      start_staging: row.start_staging ? new Date(row.start_staging).toISOString().split('T')[0] : '',
      end_staging: row.end_staging ? new Date(row.end_staging).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const save = async (id: string) => {
    try {
      await apiPut(`/api/service/${id}`, form);
      setEditing(null);
      setIsModalOpen(false);
      setCurrent(null);
      await load();
      showSuccess('Alistamiento actualizado');
    } catch {
      showError('Error al guardar');
    }
  };

  const cancel = () => {
    setEditing(null);
    setForm({ start_staging: '', end_staging: '' });
    setIsModalOpen(false);
    setCurrent(null);
  };

  const fdate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-CO') : '-');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-2 bg-white rounded-xl shadow">
            <Wrench className="w-7 h-7 text-teal-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Servicio</h1>
            <p className="text-gray-600">Alistamiento y preparación de máquinas</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por modelo, serial o proveedor..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">PROVEEDOR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">MODELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">SERIAL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">EMB. SALIDA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">EMB. LLEGADA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">PUERTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">FECHA MOV.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">INICIO ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">FIN ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase sticky right-0 bg-teal-700 z-10">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{r.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{r.model || '-'}</td>
                    <td className="px-4 py-3 text-sm font-mono">{r.serial || '-'}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.shipment_departure_date)}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.shipment_arrival_date)}</td>
                    <td className="px-4 py-3 text-sm">{r.port_of_destination || '-'}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.nationalization_date)}</td>
                    <td className="px-4 py-3 text-sm">{r.current_movement || '-'}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.current_movement_date)}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.start_staging)}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.end_staging)}</td>
                    <td className="px-4 py-3 sticky right-0 bg-white z-10">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => startEdit(r)} className="px-3 py-1 bg-teal-600 text-white rounded text-xs">Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
      <Modal isOpen={isModalOpen} onClose={cancel} title="Editar Alistamiento" size="md">
        {current && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl">
              <div>
                <p className="text-xs text-gray-500">Modelo</p>
                <p className="text-sm font-semibold">{current.model || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Serial</p>
                <p className="text-sm font-semibold font-mono">{current.serial || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Proveedor</p>
                <p className="text-sm font-semibold">{current.supplier_name || '-'}</p>
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inicio Alistamiento</label>
                <input type="date" value={form.start_staging} onChange={(e) => setForm({ ...form, start_staging: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin Alistamiento</label>
                <input type="date" value={form.end_staging} onChange={(e) => setForm({ ...form, end_staging: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>

            {/* Archivos específicos de Servicio */}
            {current.machine_id && (
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Documentación y Fotos de Servicio</h4>
                <MachineFiles 
                  machineId={current.machine_id}
                  allowUpload={true}
                  allowDelete={false}
                  enablePhotos={true}
                  enableDocs={true}
                  uploadExtraFields={{ scope: 'SERVICIO' }}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={cancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={() => save(current.id)} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Guardar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};


