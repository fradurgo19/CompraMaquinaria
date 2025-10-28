/**
 * Página de Importaciones
 * Solo visible para usuario importaciones@partequipos.com
 * Vista de lista de compras con campos específicos editables
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, Package, Truck, MapPin } from 'lucide-react';
import { apiGet, apiPut } from '../services/api';
import { showSuccess, showError } from '../components/Toast';

interface ImportationRow {
  id: string;
  mq: string;
  purchase_type: string;
  shipment_type_v2: string;
  supplier_name: string;
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
        item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredData(filtered);
  };

  const handleEdit = (row: ImportationRow) => {
    setEditingRow(row.id);
    setEditData({
      port_of_destination: row.port_of_destination || '',
      shipment_departure_date: formatDateForInput(row.shipment_departure_date),
      shipment_arrival_date: formatDateForInput(row.shipment_arrival_date),
      nationalization_date: formatDateForInput(row.nationalization_date),
    });
  };

  const handleSave = async (id: string) => {
    try {
      // Actualizar en purchases
      await apiPut(`/api/purchases/${id}`, editData);
      setEditingRow(null);
      await loadImportations();
      showSuccess('Datos de importación actualizados correctamente');
    } catch {
      showError('Error al actualizar los datos');
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 py-8">
      <div className="max-w-[1600px] mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-600 via-green-700 to-emerald-600 rounded-2xl shadow-2xl p-4 md:p-6 mb-6 text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 opacity-10">
            <Truck className="w-32 h-32" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <Package className="w-8 h-8" />
              </div>
              <div>
                <p className="text-white/80 text-xs font-medium">Gestión de Importaciones</p>
                <h1 className="text-2xl md:text-3xl font-bold">Control de Embarques</h1>
              </div>
            </div>
            <p className="text-base text-white/90 max-w-2xl">
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
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
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

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">MQ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">TIPO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">SHIPMENT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">PROVEEDOR</th>
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
                    <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                      No hay importaciones registradas
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hover:bg-indigo-50 transition"
                    >
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">{row.mq || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          row.purchase_type === 'SUBASTA' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {row.purchase_type || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.shipment_type_v2 || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.supplier_name || '-'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.model || '-'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">{row.serial || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.invoice_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.payment_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.location || '-'}</td>
                      
                      {/* EMBARQUE SALIDA - Editable */}
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <input
                            type="date"
                            value={editData.shipment_departure_date || formatDateForInput(row.shipment_departure_date)}
                            onChange={(e) => setEditData({...editData, shipment_departure_date: e.target.value})}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{formatDate(row.shipment_departure_date)}</span>
                        )}
                      </td>
                      
                      {/* EMBARQUE LLEGADA - Editable */}
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <input
                            type="date"
                            value={editData.shipment_arrival_date || formatDateForInput(row.shipment_arrival_date)}
                            onChange={(e) => setEditData({...editData, shipment_arrival_date: e.target.value})}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{formatDate(row.shipment_arrival_date)}</span>
                        )}
                      </td>
                      
                      {/* PUERTO - Editable */}
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <select
                            value={editData.port_of_destination || row.port_of_destination || ''}
                            onChange={(e) => setEditData({...editData, port_of_destination: e.target.value})}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="">-</option>
                            <option value="BUENAVENTURA">BUENAVENTURA</option>
                            <option value="CARTAGENA">CARTAGENA</option>
                            <option value="SANTA MARTA">SANTA MARTA</option>
                          </select>
                        ) : (
                          <span className="text-sm text-gray-700">{row.port_of_destination || '-'}</span>
                        )}
                      </td>
                      
                      {/* NACIONALIZACIÓN - Editable */}
                      <td className="px-4 py-3 bg-yellow-50">
                        {editingRow === row.id ? (
                          <input
                            type="date"
                            value={editData.nationalization_date || formatDateForInput(row.nationalization_date)}
                            onChange={(e) => setEditData({...editData, nationalization_date: e.target.value})}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{formatDate(row.nationalization_date)}</span>
                        )}
                      </td>
                      
                      {/* Acciones */}
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(row.id)}
                              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={handleCancel}
                              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(row)}
                            className="px-3 py-1 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

