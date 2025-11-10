/**
 * Página de Importaciones
 * Solo visible para usuario importaciones@partequipos.com
 * Vista de lista de compras con campos específicos editables
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Package, Truck, MapPin, Clock } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { useChangeDetection } from '../hooks/useChangeDetection';

interface ImportationRow {
  id: string;
  machine_id?: string;
  mq: string;
  purchase_type: string;
  shipment_type_v2: string;
  supplier_name: string;
  brand: string;
  model: string;
  serial: string;
  invoice_date: string;
  payment_date: string;
  location: string;
  port_of_destination: string;
  shipment_departure_date: string;
  shipment_arrival_date: string;
  nationalization_date: string;
}

export const ImportationsPage = () => {
  const [importations, setImportations] = useState<ImportationRow[]>([]);
  const [filteredData, setFilteredData] = useState<ImportationRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ImportationRow>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ImportationRow | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);

  // Campos a monitorear para control de cambios
  const MONITORED_FIELDS = {
    port_of_destination: 'Puerto de Destino',
    shipment_departure_date: 'Fecha Embarque Salida',
    shipment_arrival_date: 'Fecha Embarque Llegada',
    nationalization_date: 'Fecha de Nacionalización',
  };

  // Hook de detección de cambios
  const { hasChanges, changes } = useChangeDetection(
    selectedRow, 
    editData, 
    MONITORED_FIELDS
  );

  useEffect(() => {
    loadImportations();
  }, []);

  useEffect(() => {
    filterData();
  }, [searchTerm, importations]);

  const loadImportations = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ImportationRow[]>('/api/purchases');
      setImportations(data);
    } catch (err) {
      console.error('Error cargando importaciones:', err);
      showError('Error al cargar las importaciones');
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = importations;

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredData(filtered);
  };

  const handleEdit = (row: ImportationRow) => {
    setSelectedRow(row);
    setEditingRow(row.id);
    setEditData({
      port_of_destination: row.port_of_destination || '',
      shipment_departure_date: formatDateForInput(row.shipment_departure_date),
      shipment_arrival_date: formatDateForInput(row.shipment_arrival_date),
      nationalization_date: formatDateForInput(row.nationalization_date),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (id: string) => {
    // Si hay cambios, mostrar modal de control de cambios
    if (hasChanges && changes.length > 0) {
      setPendingUpdate({ id, data: editData });
      setShowChangeModal(true);
      return;
    }

    // Si no hay cambios, guardar directamente
    await saveChanges();
  };

  const saveChanges = async (changeReason?: string) => {
    const id = pendingUpdate?.id || selectedRow?.id;
    const data = pendingUpdate?.data || editData;

    try {
      // Actualizar en purchases
      await apiPut(`/api/purchases/${id}`, data);

      // Registrar cambios en el log si hay
      if (hasChanges && changes.length > 0) {
        try {
          await apiPost('/api/change-logs', {
            table_name: 'purchases',
            record_id: id,
            changes: changes,
            change_reason: changeReason || null
          });
          console.log(`📝 ${changes.length} cambios registrados en Importaciones`);
        } catch (logError) {
          console.error('Error registrando cambios:', logError);
        }
      }

      setEditingRow(null);
      setIsModalOpen(false);
      setShowChangeModal(false);
      setSelectedRow(null);
      setPendingUpdate(null);
      await loadImportations();
      showSuccess('Datos de importación actualizados correctamente');
    } catch {
      showError('Error al actualizar los datos');
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
    setIsModalOpen(false);
    setSelectedRow(null);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateForInput = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Funciones helper para estilos elegantes
  const getProveedorStyle = (proveedor: string | null | undefined) => {
    if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md';
  };

  const getMarcaStyle = (marca: string | null | undefined) => {
    if (!marca || marca === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md';
  };

  const getModeloStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
  };

  const getSerialStyle = (serial: string | null | undefined) => {
    if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
  };

  const getUbicacionStyle = (ubicacion: string | null | undefined) => {
    if (!ubicacion || ubicacion === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
  };

  const getFechaStyle = (fecha: string | null | undefined) => {
    if (!fecha || fecha === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md';
  };

  const getPuertoStyle = (puerto: string | null | undefined) => {
    if (!puerto || puerto === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md';
  };

  const getNacionalizacionStyle = (fecha: string | null | undefined) => {
    if (!fecha || fecha === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md';
  };

  // Función para determinar el color de fondo de la fila según el progreso logístico
  const getRowBackgroundStyle = (row: ImportationRow) => {
    const hasDeparture = row.shipment_departure_date && row.shipment_departure_date !== '';
    const hasArrival = row.shipment_arrival_date && row.shipment_arrival_date !== '';
    const hasPort = row.port_of_destination && row.port_of_destination !== '';
    const hasNationalization = row.nationalization_date && row.nationalization_date !== '';

    // Verde: Tiene EMBARQUE SALIDA + EMBARQUE LLEGADA + PUERTO + NACIONALIZACIÓN
    if (hasDeparture && hasArrival && hasPort && hasNationalization) {
      return 'bg-green-50 hover:bg-green-100';
    }
    
    // Naranja: Tiene EMBARQUE SALIDA + EMBARQUE LLEGADA + PUERTO
    if (hasDeparture && hasArrival && hasPort) {
      return 'bg-orange-50 hover:bg-orange-100';
    }
    
    // Amarillo: Solo tiene EMBARQUE SALIDA
    if (hasDeparture) {
      return 'bg-yellow-50 hover:bg-yellow-100';
    }
    
    // Gris: Sin EMBARQUE SALIDA (pendiente)
    return 'bg-gray-50 hover:bg-gray-100';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6 mb-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 opacity-5">
            <Truck className="w-32 h-32 text-gray-400" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-50 rounded-xl">
                <Package className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-gray-600 text-xs font-medium">Gestión de Importaciones</p>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Control de Embarques</h1>
              </div>
            </div>
            <p className="text-base text-gray-600 max-w-2xl">
              Administra fechas de embarque, llegada y nacionalización
            </p>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-brand-gray">
            <Package className="w-8 h-8 text-blue-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">Total Importaciones</p>
            <p className="text-3xl font-bold text-gray-900">{importations.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <Calendar className="w-8 h-8 text-yellow-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">En Tránsito</p>
            <p className="text-3xl font-bold text-yellow-600">
              {importations.filter(i => i.shipment_departure_date && !i.shipment_arrival_date).length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <Truck className="w-8 h-8 text-green-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">Llegadas</p>
            <p className="text-3xl font-bold text-green-600">
              {importations.filter(i => i.shipment_arrival_date).length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-brand-red">
            <MapPin className="w-8 h-8 text-purple-600 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">Nacionalizadas</p>
            <p className="text-3xl font-bold text-purple-600">
              {importations.filter(i => i.nationalization_date).length}
            </p>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-xl p-6"
        >
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por modelo, serie o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-red-50 to-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">MQ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">TIPO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">SHIPMENT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">PROVEEDOR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">MARCA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">MODELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">SERIAL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">FECHA FACTURA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">FECHA PAGO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">UBICACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">EMBARQUE SALIDA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">EMBARQUE LLEGADA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">PUERTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                      No hay importaciones registradas
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`transition-colors ${getRowBackgroundStyle(row)}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">{row.mq || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          row.purchase_type === 'SUBASTA' ? 'bg-red-100 text-brand-red' : 'bg-gray-100 text-brand-gray'
                        }`}>
                          {row.purchase_type === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : (row.purchase_type || '-')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.shipment_type_v2 || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {row.supplier_name ? (
                          <span className={getProveedorStyle(row.supplier_name)}>
                            {row.supplier_name}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.brand ? (
                          <span className={getMarcaStyle(row.brand)}>
                            {row.brand}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.model ? (
                          <span className={getModeloStyle(row.model)}>
                            {row.model}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.serial ? (
                          <span className={getSerialStyle(row.serial)}>
                            {row.serial}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.invoice_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.payment_date)}</td>
                      <td className="px-4 py-3 text-sm">
                        {row.location ? (
                          <span className={getUbicacionStyle(row.location)}>
                            {row.location}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* EMBARQUE SALIDA */}
                      <td className="px-4 py-3">
                        {formatDate(row.shipment_departure_date) !== '-' ? (
                          <span className={getFechaStyle(formatDate(row.shipment_departure_date))}>
                            {formatDate(row.shipment_departure_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* EMBARQUE LLEGADA */}
                      <td className="px-4 py-3">
                        {formatDate(row.shipment_arrival_date) !== '-' ? (
                          <span className={getFechaStyle(formatDate(row.shipment_arrival_date))}>
                            {formatDate(row.shipment_arrival_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* PUERTO */}
                      <td className="px-4 py-3">
                        {row.port_of_destination ? (
                          <span className={getPuertoStyle(row.port_of_destination)}>
                            {row.port_of_destination}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* NACIONALIZACIÓN */}
                      <td className="px-4 py-3">
                        {formatDate(row.nationalization_date) !== '-' ? (
                          <span className={getNacionalizacionStyle(formatDate(row.nationalization_date))}>
                            {formatDate(row.nationalization_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedRow(row);
                              setIsHistoryOpen(true);
                            }}
                            className="px-2 py-1 bg-white border-2 border-orange-500 text-orange-600 rounded text-xs hover:bg-orange-50"
                            title="Ver historial de cambios"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(row)}
                            className="px-3 py-1 bg-brand-red text-white rounded text-sm hover:bg-primary-600"
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
        {/* Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCancel}
          title="Editar Importación"
          size="md"
        >
          {selectedRow && (
            <div className="space-y-4">
              {/* Resumen del registro */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">SHIPMENT</p>
                  <p className="text-sm font-semibold">{selectedRow.shipment_type_v2 || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">PROVEEDOR</p>
                  <p className="text-sm font-semibold">{selectedRow.supplier_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">MODELO</p>
                  <p className="text-sm font-semibold">{selectedRow.model || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">SERIAL</p>
                  <p className="text-sm font-semibold font-mono">{selectedRow.serial || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">FECHA FACTURA</p>
                  <p className="text-sm">{selectedRow.invoice_date ? new Date(selectedRow.invoice_date).toLocaleDateString('es-CO') : '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Embarque Salida</label>
                  <input
                    type="date"
                    value={editData.shipment_departure_date || ''}
                    onChange={(e) => setEditData({ ...editData, shipment_departure_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Embarque Llegada</label>
                  <input
                    type="date"
                    value={editData.shipment_arrival_date || ''}
                    onChange={(e) => setEditData({ ...editData, shipment_arrival_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puerto</label>
                  <select
                    value={editData.port_of_destination || ''}
                    onChange={(e) => setEditData({ ...editData, port_of_destination: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  >
                    <option value="">-</option>
                    <option value="BUENAVENTURA">BUENAVENTURA</option>
                    <option value="CARTAGENA">CARTAGENA</option>
                    <option value="SANTA MARTA">SANTA MARTA</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nacionalización</label>
                  <input
                    type="date"
                    value={editData.nationalization_date || ''}
                    onChange={(e) => setEditData({ ...editData, nationalization_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                  />
                </div>
              </div>

              {/* Archivos de Importaciones */}
              {selectedRow.machine_id && (
                <div className="pt-4">
                  <div className="bg-gradient-to-r from-indigo-50 to-gray-50 rounded-xl p-6 border border-indigo-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-3 rounded-lg shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Gestión de Archivos</h3>
                        <p className="text-sm text-gray-600">Fotos y documentos de la máquina en el módulo de Importaciones</p>
                      </div>
                    </div>
                    
                    <MachineFiles 
                      machineId={selectedRow.machine_id} 
                      allowUpload={true} 
                      allowDelete={true}
                      currentScope="IMPORTACIONES"
                      uploadExtraFields={{ scope: 'IMPORTACIONES' }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSave(selectedRow.id)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Guardar cambios
                </button>
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
          {selectedRow && (
            <ChangeHistory 
              tableName="purchases" 
              recordId={selectedRow.id}
              purchaseId={selectedRow.id}
            />
          )}
        </Modal>
      </div>
    </div>
  );
};

