/**
 * Módulo de Logística
 * Vista de máquinas nacionalizadas con gestión de movimientos
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Truck, Package, Plus } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../services/api';
import { showSuccess, showError } from '../components/Toast';

interface LogisticsRow {
  id: string;
  mq: string;
  tipo: string;
  shipment: string;
  supplier_name: string;
  model: string;
  serial: string;
  invoice_date: string;
  payment_date: string;
  shipment_departure_date: string;
  shipment_arrival_date: string;
  port_of_destination: string;
  nationalization_date: string;
  current_movement: string | null;
  current_movement_date: string | null;
}

interface MachineMovement {
  id: string;
  purchase_id: string;
  movement_description: string;
  movement_date: string;
  created_at: string;
}

export const LogisticsPage = () => {
  const [data, setData] = useState<LogisticsRow[]>([]);
  const [filteredData, setFilteredData] = useState<LogisticsRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [movements, setMovements] = useState<MachineMovement[]>([]);
  const [movementDescription, setMovementDescription] = useState('');
  const [movementDate, setMovementDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = data.filter(
        (row) =>
          row.mq.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.serial.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(data);
    }
  }, [searchTerm, data]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await apiGet<LogisticsRow[]>('/api/purchases');
      // Filtrar solo las compras con fecha de nacionalización
      const nationalized = response.filter((row) => row.nationalization_date);
      setData(nationalized);
      setFilteredData(nationalized);
    } catch {
      showError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async (purchaseId: string) => {
    try {
      const response = await apiGet<MachineMovement[]>(`/api/movements/${purchaseId}`);
      setMovements(response);
    } catch {
      showError('Error al cargar los movimientos');
    }
  };

  const handleViewTimeline = async (row: LogisticsRow) => {
    setSelectedRow(row.id);
    await fetchMovements(row.id);
  };


  const handleAddMovement = async () => {
    if (!selectedRow || !movementDescription || !movementDate) {
      showError('Por favor complete todos los campos');
      return;
    }

    try {
      // Agregar movimiento
      await apiPost('/api/movements', {
        purchase_id: selectedRow,
        movement_description: movementDescription,
        movement_date: movementDate,
      });

      // Actualizar current_movement en purchases
      try {
        await apiPut(`/api/purchases/${selectedRow}`, {
          current_movement: movementDescription,
          current_movement_date: movementDate,
        });
      } catch (updateError) {
        console.error('Error al actualizar current_movement:', updateError);
        // Continuar aunque falle la actualización
      }

      showSuccess('Movimiento agregado exitosamente');
      setMovementDescription('');
      setMovementDate('');
      await fetchMovements(selectedRow);
      await fetchData(); // Recargar la lista para mostrar el último movimiento
    } catch (error) {
      console.error('Error al agregar el movimiento:', error);
      showError('Error al agregar el movimiento');
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return '-';
    }
  };


  const getKPIStats = () => {
    const nationalized = data.filter((row) => row.nationalization_date);
    return {
      total: nationalized.length,
      withMovements: 0, // TODO: Implementar contador real cuando tengamos la data
    };
  };

  const stats = getKPIStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Logística</h1>
          <p className="text-gray-600">Gestión de movimientos de máquinas nacionalizadas</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Nacionalizadas</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Con Movimientos</p>
                <p className="text-3xl font-bold text-green-600">{stats.withMovements}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <Truck className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por MQ, modelo o serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MQ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">TIPO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SHIPMENT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PROVEEDOR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MODELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SERIAL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA FACTURA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA PAGO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE SALIDA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE LLEGADA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PUERTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA DE MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">ACCIONES</th>
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
                      No hay máquinas nacionalizadas
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">{row.mq || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.tipo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.shipment || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.supplier_name || '-'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.model || '-'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">{row.serial || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.invoice_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.payment_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.shipment_departure_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.shipment_arrival_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.port_of_destination || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 bg-yellow-50">{formatDate(row.nationalization_date)}</td>
                      
                      {/* MOVIMIENTO - Mostrar último movimiento */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {row.current_movement || '-'}
                      </td>
                      
                      {/* FECHA DE MOVIMIENTO - Mostrar última fecha */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDate(row.current_movement_date)}
                      </td>
                      
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewTimeline(row)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Ver Trazabilidad
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Trazabilidad */}
        {selectedRow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            >
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Trazabilidad de Máquina</h2>
                  <button
                    onClick={() => setSelectedRow(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Formulario para agregar movimiento */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Agregar Movimiento</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción del Movimiento
                      </label>
                      <select
                        value={movementDescription}
                        onChange={(e) => setMovementDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="PARQUEADERO CARTAGENA">PARQUEADERO CARTAGENA</option>
                        <option value="PARQUEADERO BUENAVENTURA">PARQUEADERO BUENAVENTURA</option>
                        <option value="SALIÓ PARA CALI">SALIÓ PARA CALI</option>
                        <option value="SALIÓ PARA GUARNE">SALIÓ PARA GUARNE</option>
                        <option value="SALIÓ PARA BOGOTÁ">SALIÓ PARA BOGOTÁ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha del Movimiento
                      </label>
                      <input
                        type="date"
                        value={movementDate}
                        onChange={(e) => setMovementDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddMovement}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Movimiento
                  </button>
                </div>

                {/* Línea de tiempo */}
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-300"></div>
                  <div className="space-y-4">
                    {movements.map((movement, index) => (
                      <div key={movement.id} className="relative flex items-start gap-4">
                        <div className="relative z-10">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-900">{movement.movement_description}</h4>
                            <span className="text-sm text-gray-500">{formatDate(movement.movement_date)}</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Registrado: {new Date(movement.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

