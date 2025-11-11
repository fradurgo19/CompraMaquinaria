import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Wrench, Eye, Edit, History } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../services/api';
import { ServiceRecord } from '../types/database';
import { showError, showSuccess } from '../components/Toast';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { useChangeDetection } from '../hooks/useChangeDetection';

export const ServicePage = () => {
  const [data, setData] = useState<ServiceRecord[]>([]);
  const [filtered, setFiltered] = useState<ServiceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ start_staging: string; end_staging: string }>({ start_staging: '', end_staging: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [current, setCurrent] = useState<ServiceRecord | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [originalForm, setOriginalForm] = useState<{ start_staging: string; end_staging: string } | null>(null);

  // Campos a monitorear para control de cambios
  const MONITORED_FIELDS = {
    start_staging: 'Inicio Alistamiento',
    end_staging: 'Fin Alistamiento',
  };

  // Hook de detección de cambios
  const { hasChanges, changes } = useChangeDetection(
    originalForm, 
    form, 
    MONITORED_FIELDS
  );

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
    const formValues = {
      start_staging: row.start_staging ? new Date(row.start_staging).toISOString().split('T')[0] : '',
      end_staging: row.end_staging ? new Date(row.end_staging).toISOString().split('T')[0] : '',
    };
    setForm(formValues);
    setOriginalForm(formValues); // Guardar valores originales
    setIsModalOpen(true);
  };

  const save = async (id: string) => {
    // Si hay cambios, mostrar modal de control de cambios
    if (hasChanges && changes.length > 0) {
      setPendingUpdate({ id, data: form });
      setShowChangeModal(true);
      return;
    }

    // Si no hay cambios, guardar directamente
    await saveChanges();
  };

  const saveChanges = async (changeReason?: string) => {
    const id = pendingUpdate?.id || current?.id;
    const data = pendingUpdate?.data || form;

    console.log('💾 Guardando cambios en Service...');
    console.log('  - ID:', id);
    console.log('  - Data:', data);
    console.log('  - hasChanges:', hasChanges);
    console.log('  - changes:', changes);

    try {
      await apiPut(`/api/service/${id}`, data);

      // Registrar cambios en el log si hay
      if (hasChanges && changes.length > 0) {
        console.log('📝 Intentando registrar cambios en change_logs...');
        try {
          const logPayload = {
            table_name: 'service_records',
            record_id: id,
            changes: changes,
            change_reason: changeReason || null
          };
          console.log('  - Payload:', logPayload);
          
          const result = await apiPost('/api/change-logs', logPayload);
          console.log(`✅ ${changes.length} cambios registrados en Servicio`, result);
        } catch (logError) {
          console.error('❌ Error registrando cambios:', logError);
        }
      } else {
        console.log('⚠️ No hay cambios para registrar (hasChanges:', hasChanges, 'changes.length:', changes.length, ')');
      }

      setEditing(null);
      setIsModalOpen(false);
      setShowChangeModal(false);
      setCurrent(null);
      setPendingUpdate(null);
      setOriginalForm(null);
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

  // Función para determinar el color de fondo de la fila según el progreso de alistamiento
  const getRowBackgroundStyle = (row: ServiceRecord) => {
    const hasEndStaging = row.end_staging && row.end_staging !== '';
    const hasStartStaging = row.start_staging && row.start_staging !== '';
    const hasDeparture = row.shipment_departure_date && row.shipment_departure_date !== '';

    // Verde: Tiene FIN ALIST.
    if (hasEndStaging) {
      return 'bg-green-50 hover:bg-green-100';
    }
    
    // Amarillo: Tiene INICIO ALIST. pero no FIN ALIST.
    if (hasStartStaging) {
      return 'bg-yellow-50 hover:bg-yellow-100';
    }
    
    // Rojo: Tiene EMB. SALIDA pero no INICIO ALIST.
    if (hasDeparture) {
      return 'bg-red-50 hover:bg-red-100';
    }
    
    // Gris: Sin fechas (pendiente)
    return 'bg-gray-50 hover:bg-gray-100';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-slate-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
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
              <thead className="bg-gradient-to-r from-brand-red to-primary-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PROVEEDOR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MARCA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase bg-emerald-600">CONDICIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MODELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SERIAL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMB. SALIDA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMB. LLEGADA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PUERTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase bg-yellow-600">MC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA MOV.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">INICIO ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FIN ALIST.</th>
                  <th className="px-2 py-3 text-center text-xs font-semibold text-white uppercase sticky right-0 bg-brand-red z-10" style={{ minWidth: 140 }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((r) => (
                  <tr key={r.id} className={`transition-colors ${getRowBackgroundStyle(r)}`}>
                    <td className="px-4 py-3 text-sm">{r.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{r.brand || '-'}</td>
                    
                    {/* CONDICIÓN */}
                    <td className="px-4 py-3 text-sm">
                      {r.condition === 'NUEVO' ? (
                        <span className="px-3 py-1 rounded-full font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md">
                          NUEVO
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
                          USADO
                        </span>
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-sm font-semibold">{r.model || '-'}</td>
                    <td className="px-4 py-3 text-sm font-mono">{r.serial || '-'}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.shipment_departure_date)}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.shipment_arrival_date)}</td>
                    <td className="px-4 py-3 text-sm">{r.port_of_destination || '-'}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.nationalization_date)}</td>
                    <td className="px-4 py-3 text-sm">
                      {r.mc ? (
                        <span className="px-2 py-1 rounded-lg font-bold text-sm bg-yellow-100 text-yellow-900 border-2 border-yellow-400">
                          {r.mc}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg text-xs bg-red-100 text-red-600 border border-red-300">
                          Sin MC
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{r.current_movement || '-'}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.current_movement_date)}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.start_staging)}</td>
                    <td className="px-4 py-3 text-sm">{fdate(r.end_staging)}</td>
                    <td className="px-2 py-3 sticky right-0 bg-white z-10" style={{ minWidth: 140 }}>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => startEdit(r)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEdit(r)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            console.log('🔍 Abriendo historial de Service:', r.id, r);
                            setCurrent(r);
                            setIsHistoryOpen(true);
                          }}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Historial de cambios"
                        >
                          <History className="w-4 h-4" />
                        </button>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl">
              <div>
                <p className="text-xs text-gray-500">Proveedor</p>
                <p className="text-sm font-semibold">{current.supplier_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Marca</p>
                <p className="text-sm font-semibold">{current.brand || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Modelo</p>
                <p className="text-sm font-semibold">{current.model || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Serial</p>
                <p className="text-sm font-semibold font-mono">{current.serial || '-'}</p>
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
              <div className="pt-4">
                <div className="bg-gradient-to-r from-orange-50 to-gray-50 rounded-xl p-6 border border-orange-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-lg shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Gestión de Archivos</h3>
                      <p className="text-sm text-gray-600">Fotos y documentos de la máquina en el módulo de Servicio</p>
                    </div>
                  </div>
                  
                  <MachineFiles 
                    machineId={current.machine_id}
                    allowUpload={true}
                    allowDelete={true}
                    currentScope="SERVICIO"
                    uploadExtraFields={{ scope: 'SERVICIO' }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={cancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={() => save(current.id)} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Guardar</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Control de Cambios */}
      <ChangeLogModal
        isOpen={showChangeModal}
        changes={changes}
        onConfirm={(reason) => {
          setShowChangeModal(false);
          saveChanges(reason);
        }}
        onCancel={() => {
          setShowChangeModal(false);
          setPendingUpdate(null);
        }}
      />

      {/* Modal de Historial */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Historial de Cambios - Todos los Módulos"
        size="lg"
      >
        {current && (
          <ChangeHistory 
            tableName="service_records" 
            recordId={current.id}
            purchaseId={current.purchase_id}
          />
        )}
      </Modal>
    </div>
  );
};


