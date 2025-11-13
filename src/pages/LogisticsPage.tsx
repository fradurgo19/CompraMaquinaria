/**
 * Módulo de Logística
 * Vista de máquinas nacionalizadas con gestión de movimientos
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, Truck, Package, Plus, Eye, Edit, History } from 'lucide-react';
import { MachineFiles } from '../components/MachineFiles';
import { apiGet, apiPost, apiPut } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { Modal } from '../molecules/Modal';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { useChangeDetection } from '../hooks/useChangeDetection';

interface LogisticsRow {
  id: string;
  mq: string;
  tipo: string;
  shipment: string;
  supplier_name: string;
  brand: string;
  model: string;
  serial: string;
  invoice_date: string;
  payment_date: string;
  shipment_departure_date: string;
  shipment_arrival_date: string;
  port_of_destination: string;
  nationalization_date: string;
  mc: string | null;
  condition: string | null; // NUEVO o USADO
  current_movement: string | null;
  current_movement_date: string | null;
  current_movement_plate: string | null;
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
  const [selectedRowData, setSelectedRowData] = useState<LogisticsRow | null>(null);
  const [movements, setMovements] = useState<MachineMovement[]>([]);
  const [mcCode, setMcCode] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [movementDate, setMovementDate] = useState('');
  const [movementPlate, setMovementPlate] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<LogisticsRow | null>(null);

  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

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

  // Limpiar placa si el movimiento no es "SALIÓ"
  useEffect(() => {
    if (!movementDescription.includes('SALIÓ')) {
      setMovementPlate('');
    }
  }, [movementDescription]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await apiGet<LogisticsRow[]>('/api/purchases');
      // Mostrar TODOS los registros sin restricciones
      setData(response);
      setFilteredData(response);
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
    setSelectedRowData(row);
    setMcCode(row.mc || ''); // Cargar el MC si ya existe
    await fetchMovements(row.id);
  };


  const handleSaveMC = async () => {
    if (!selectedRow || !mcCode || mcCode.trim() === '') {
      showError('Por favor ingrese el código MC');
      return;
    }

    try {
      await apiPut(`/api/purchases/${selectedRow}`, {
        mc: mcCode.trim().toUpperCase()
      });

      // Actualizar los datos locales
      if (selectedRowData) {
        setSelectedRowData({ ...selectedRowData, mc: mcCode.trim().toUpperCase() });
      }

      showSuccess('Código MC guardado exitosamente');
      await fetchData(); // Recargar la lista
    } catch (error) {
      console.error('Error al guardar MC:', error);
      showError('Error al guardar el código MC');
    }
  };

  const handleAddMovement = async () => {
    // ⚠️ VALIDACIÓN: Debe existir MC antes de permitir movimientos
    if (!selectedRowData?.mc || selectedRowData.mc.trim() === '') {
      showError('⚠️ Debe ingresar y guardar el código MC antes de poder registrar movimientos');
      return;
    }

    if (!selectedRow || !movementDescription || !movementDate) {
      showError('Por favor complete todos los campos del movimiento');
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
          current_movement_plate: movementPlate,
        });
      } catch (updateError) {
        console.error('Error al actualizar current_movement:', updateError);
        // Continuar aunque falle la actualización
      }

      showSuccess('Movimiento agregado exitosamente');
      setMovementDescription('');
      setMovementDate('');
      setMovementPlate('');
      await fetchMovements(selectedRow);
      await fetchData(); // Recargar la lista para mostrar el último movimiento
    } catch (error) {
      console.error('Error al agregar el movimiento:', error);
      showError('Error al agregar el movimiento');
    }
  };

  // Sincronizar scroll superior con tabla
  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;

    if (!topScroll || !tableScroll) return;

    const handleTopScroll = () => {
      if (tableScroll && !tableScroll.contains(document.activeElement)) {
        tableScroll.scrollLeft = topScroll.scrollLeft;
      }
    };

    const handleTableScroll = () => {
      if (topScroll) {
        topScroll.scrollLeft = tableScroll.scrollLeft;
      }
    };

    topScroll.addEventListener('scroll', handleTopScroll);
    tableScroll.addEventListener('scroll', handleTableScroll);

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableScroll.removeEventListener('scroll', handleTableScroll);
    };
  }, []);

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

  // Funciones helper para estilos elegantes
  const getProveedorStyle = (proveedor: string | null | undefined) => {
    if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md';
  };

  const getModeloStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md whitespace-nowrap';
  };

  const getSerialStyle = (serial: string | null | undefined) => {
    if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
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

  const getMovimientoStyle = (movimiento: string | null | undefined) => {
    if (!movimiento || movimiento === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md';
  };

  const getKPIStats = () => {
    const nationalized = data.filter((row) => row.nationalization_date);
    return {
      total: nationalized.length,
      withMovements: 0, // TODO: Implementar contador real cuando tengamos la data
    };
  };

  const stats = getKPIStats();

  // Función para determinar el color de fondo de la fila según el movimiento actual
  const getRowBackgroundByMovement = (movement: string | null) => {
    if (!movement || movement === '' || movement === '-') {
      // SIN MOVIMIENTO → Rojo
      return 'bg-red-50 hover:bg-red-100';
    }
    
    const movementUpper = movement.toUpperCase();
    
    // ENTREGADO A CLIENTE → Verde
    if (movementUpper.includes('ENTREGADO A CLIENTE')) {
      return 'bg-green-50 hover:bg-green-100';
    }
    
    // EN (GUARNE, BOGOTÁ, BARRANQUILLA) → Azul
    if (movementUpper.includes('EN GUARNE') || 
        movementUpper.includes('EN BOGOTÁ') || 
        movementUpper.includes('EN BARRANQUILLA')) {
      return 'bg-blue-50 hover:bg-blue-100';
    }
    
    // SALIÓ PARA... → Amarillo
    if (movementUpper.includes('SALIÓ')) {
      return 'bg-yellow-50 hover:bg-yellow-100';
    }
    
    // PARQUEADERO → Rojo
    if (movementUpper.includes('PARQUEADERO')) {
      return 'bg-red-50 hover:bg-red-100';
    }
    
    // Default → Gris
    return 'bg-gray-50 hover:bg-gray-100';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
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
              <div className="bg-red-100 rounded-full p-3">
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

        {/* Barra de Scroll Superior - Sincronizada */}
        <div className="mb-3">
          <div 
            ref={topScrollRef}
            className="overflow-x-auto bg-gradient-to-r from-blue-100 to-gray-100 rounded-lg shadow-inner"
            style={{ height: '14px' }}
          >
            <div style={{ width: '2500px', height: '1px' }}></div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div ref={tableScrollRef} className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-brand-red to-primary-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MQ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">TIPO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase bg-emerald-600">CONDICIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SHIPMENT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PROVEEDOR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MARCA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MODELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SERIAL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA FACTURA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA PAGO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE SALIDA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE LLEGADA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PUERTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase bg-yellow-600">MC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PLACA MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA DE MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase sticky right-0 bg-brand-red z-10">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={18} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="px-4 py-8 text-center text-gray-500">
                      No hay máquinas nacionalizadas
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`transition-colors ${getRowBackgroundByMovement(row.current_movement)}`}
                    >
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">{row.mq || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.tipo || '-'}</td>
                      
                      {/* CONDICIÓN - NUEVO o USADO */}
                      <td className="px-4 py-3 text-sm">
                        {row.condition === 'NUEVO' ? (
                          <span className="px-3 py-1 rounded-full font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md">
                            NUEVO
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
                            USADO
                          </span>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 text-sm text-gray-700">{row.shipment || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {row.supplier_name ? (
                          <span className={getProveedorStyle(row.supplier_name)}>
                            {row.supplier_name}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">{row.brand || '-'}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
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
                        {formatDate(row.shipment_departure_date) !== '-' ? (
                          <span className={getFechaStyle(formatDate(row.shipment_departure_date))}>
                            {formatDate(row.shipment_departure_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatDate(row.shipment_arrival_date) !== '-' ? (
                          <span className={getFechaStyle(formatDate(row.shipment_arrival_date))}>
                            {formatDate(row.shipment_arrival_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.port_of_destination ? (
                          <span className={getPuertoStyle(row.port_of_destination)}>
                            {row.port_of_destination}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatDate(row.nationalization_date) !== '-' ? (
                          <span className={getNacionalizacionStyle(formatDate(row.nationalization_date))}>
                            {formatDate(row.nationalization_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* MC - Código de Movimiento */}
                      <td className="px-4 py-3 text-sm">
                        {row.mc ? (
                          <span className="px-2 py-1 rounded-lg font-bold text-sm bg-yellow-100 text-yellow-900 border-2 border-yellow-400 shadow-sm">
                            {row.mc}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg text-xs bg-red-100 text-red-600 border border-red-300">
                            Sin MC
                          </span>
                        )}
                      </td>
                      
                      {/* MOVIMIENTO - Mostrar último movimiento */}
                      <td className="px-4 py-3 text-sm">
                        {row.current_movement ? (
                          <span className={getMovimientoStyle(row.current_movement)}>
                            {row.current_movement}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* PLACA MOVIMIENTO */}
                      <td className="px-4 py-3 text-sm">
                        {row.current_movement_plate ? (
                          <span className="px-2 py-1 rounded-lg font-semibold text-sm bg-blue-100 text-blue-800 border border-blue-200">
                            {row.current_movement_plate}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* FECHA DE MOVIMIENTO - Mostrar última fecha */}
                      <td className="px-4 py-3 text-sm">
                        {formatDate(row.current_movement_date) !== '-' ? (
                          <span className={getFechaStyle(formatDate(row.current_movement_date))}>
                            {formatDate(row.current_movement_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 sticky right-0 bg-white z-10" style={{ minWidth: 180 }}>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleViewTimeline(row)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver trazabilidad"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleViewTimeline(row)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              console.log('🔍 Abriendo historial de Logistics:', row.id, 'Purchase ID:', row.id);
                              setHistoryRecord(row);
                              setIsHistoryOpen(true);
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Historial de cambios"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
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
                {/* Formulario para agregar MC (Código de Movimiento) */}
                <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                  <h3 className="text-lg font-bold mb-2 text-yellow-900 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    Código MC (Requerido)
                  </h3>
                  <p className="text-xs text-yellow-800 mb-4">
                    Debe ingresar el código MC antes de poder registrar movimientos logísticos
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={mcCode}
                      onChange={(e) => setMcCode(e.target.value.toUpperCase())}
                      placeholder="Ingrese código MC (ej: MC-2024-001)"
                      className="flex-1 px-4 py-2 border-2 border-yellow-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 font-bold"
                      disabled={!!selectedRowData?.mc}
                    />
                    <button
                      onClick={handleSaveMC}
                      disabled={!!selectedRowData?.mc || !mcCode || mcCode.trim() === ''}
                      className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                        selectedRowData?.mc 
                          ? 'bg-green-500 text-white cursor-not-allowed' 
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      }`}
                    >
                      {selectedRowData?.mc ? '✓ MC Guardado' : 'Guardar MC'}
                    </button>
                  </div>
                  {selectedRowData?.mc && (
                    <p className="text-sm text-green-700 mt-2 font-semibold flex items-center gap-2">
                      <span className="text-xl">✓</span>
                      MC autorizado: <span className="px-3 py-1 bg-green-100 border-2 border-green-400 rounded-lg">{selectedRowData.mc}</span>
                    </p>
                  )}
                </div>

                {/* Formulario para agregar movimiento */}
                <div className={`mb-6 p-4 rounded-lg transition-all ${
                  selectedRowData?.mc 
                    ? 'bg-green-50 border-2 border-green-400' 
                    : 'bg-gray-100 border-2 border-gray-300 opacity-60'
                }`}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    {selectedRowData?.mc ? '✓' : '🔒'} Agregar Movimiento
                    {!selectedRowData?.mc && <span className="text-xs text-red-600 font-normal">(Requiere código MC)</span>}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción del Movimiento
                      </label>
                      <select
                        value={movementDescription}
                        onChange={(e) => setMovementDescription(e.target.value)}
                        disabled={!selectedRowData?.mc}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="PARQUEADERO CARTAGENA">PARQUEADERO CARTAGENA</option>
                        <option value="PARQUEADERO BUENAVENTURA">PARQUEADERO BUENAVENTURA</option>
                        <option value="EN GUARNE">EN GUARNE</option>
                        <option value="EN BOGOTÁ">EN BOGOTÁ</option>
                        <option value="EN BARRANQUILLA">EN BARRANQUILLA</option>
                        <option value="SALIÓ PARA CALI">SALIÓ PARA CALI</option>
                        <option value="SALIÓ PARA GUARNE">SALIÓ PARA GUARNE</option>
                        <option value="SALIÓ PARA BOGOTÁ">SALIÓ PARA BOGOTÁ</option>
                        <option value="ENTREGADO A CLIENTE">ENTREGADO A CLIENTE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Placa Movimiento {!movementDescription.includes('SALIÓ') && movementDescription && (
                          <span className="text-xs text-gray-500 italic">(Solo para movimientos de salida)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={movementPlate}
                        onChange={(e) => setMovementPlate(e.target.value)}
                        placeholder={movementDescription.includes('SALIÓ') ? "Ej: ABC123" : "Solo para SALIÓ"}
                        disabled={!selectedRowData?.mc || !movementDescription.includes('SALIÓ')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha del Movimiento
                      </label>
                      <input
                        type="date"
                        value={movementDate}
                        onChange={(e) => setMovementDate(e.target.value)}
                        disabled={!selectedRowData?.mc}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddMovement}
                    disabled={!selectedRowData?.mc}
                    className={`px-4 py-2 rounded flex items-center gap-2 font-semibold transition-all ${
                      selectedRowData?.mc
                        ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    {selectedRowData?.mc ? 'Agregar Movimiento' : '🔒 MC Requerido'}
                  </button>
                </div>

                {/* Línea de tiempo */}
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-red-300"></div>
                  <div className="space-y-4">
                    {movements.map((movement, index) => (
                      <div key={movement.id} className="relative flex items-start gap-4">
                        <div className="relative z-10">
                          <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center text-white font-bold">
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

                {/* Archivos de Logística */}
                <div className="mt-8">
                  {(() => {
                    const row = data.find(r => r.id === selectedRow);
                    const machineId = (row as any)?.machine_id;
                    return machineId ? (
                      <div className="bg-gradient-to-r from-blue-50 to-gray-50 rounded-xl p-6 border border-blue-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-lg shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">Gestión de Archivos</h3>
                            <p className="text-sm text-gray-600">Fotos y documentos de la máquina en el módulo de Logística</p>
                          </div>
                        </div>
                        
                        <MachineFiles 
                          machineId={machineId}
                          allowUpload={true}
                          allowDelete={true}
                          currentScope="LOGISTICA"
                          uploadExtraFields={{ scope: 'LOGISTICA' }}
                        />
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-yellow-400 p-3 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-yellow-900">Archivos no disponibles</h3>
                            <p className="text-sm text-yellow-800">No hay información de máquina asociada a este registro.</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Historial */}
        <Modal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          title="Historial de Cambios - Todos los Módulos"
          size="lg"
        >
          {historyRecord && (
            <ChangeHistory 
              tableName="purchases" 
              recordId={historyRecord.id}
              purchaseId={historyRecord.id}
            />
          )}
        </Modal>
      </div>
    </div>
  );
};

