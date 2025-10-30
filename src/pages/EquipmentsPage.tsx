/**
 * Módulo de Equipos
 * Vista de máquinas para venta con datos de Logística y Consolidado
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Package, Plus, Edit2, Check, X } from 'lucide-react';
import { apiGet, apiPut } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { EquipmentModal } from '../organisms/EquipmentModal';
import { Modal } from '../molecules/Modal';
import { MachineFiles } from '../components/MachineFiles';

interface EquipmentRow {
  id: string;
  purchase_id: string;
  machine_id?: string;
  
  // Datos de Logística
  supplier_name: string;
  model: string;
  serial: string;
  shipment_departure_date: string;
  shipment_arrival_date: string;
  port_of_destination: string;
  nationalization_date: string;
  current_movement: string;
  current_movement_date: string;
  
  // Datos de Consolidado
  year: number;
  hours: number;
  pvp_est: number;
  comments: string;
  real_sale_price?: number;
  
  // Especificaciones
  full_serial: number;
  state: string;
  machine_type: string;
  wet_line: string;
  arm_type: string;
  track_width: number;
  bucket_capacity: number;
  warranty_months: number;
  warranty_hours: number;
  engine_brand: string;
  cabin_type: string;
  commercial_observations: string;
  
  // Fechas de Alistamiento (sincronizadas desde service_records)
  start_staging?: string | null;
  end_staging?: string | null;
}

const MACHINE_TYPES = [
  'BRAZO LARGO 30 TON', 'GRUA HITACHI ZX75UR', 'ACOPLE RAPIDO 12TON', 'MARUJUN TELESCOPIC ARM',
  'MANDIBULA MINICARGADOR', 'ENGANCHE PARA EXCAVADORA 20TON', 'CHASIS LBX460', 'BRAZO LARGO 20 TON',
  'ALMEJA GIRATORIA 20TON', 'BALDE SH240-5', 'MOTOSOLDADOR MULTIQUIP', 'BALDE USADO 3TON',
  'BALDE USADO 20 TON', 'BRAZO ESTANDAR 20 TON', 'LINEA HUMEDA ZX200', 'LINEA HUMEDA SK210',
  'BROCA PARA AHOYADOR', 'BRAZO LARGO 16.5MTS', 'MARTILLO HIDRAULICO OKADA',
  'MASTIL DE PERFORACIÓN TECOP MCD45HP', 'BARREDORA PARA MINICARGADOR',
  'MONTACARGAS LIUGONG F7035M', 'RETROCARGADOR CASE 580N', 'PONTONES GET240D',
  'VIBROCOMPACTADORAMMANNASC70', 'EXCAVADORA LBX 210X3E', 'MINICARGADOR CASE SR200B',
  'ALIMENTADOR VIBRATORIO - ZSW600x150', 'EXCAVADORA KOBELCO SK330LC',
  'MINIEXCAVADORA HITACHI EX5-2', 'EXCAVADORA SUMITOMO SH210-5',
  'RETROCARGADOR CASE 575SV', 'EXCAVADORA HITACHI ZX75US-3', 'EXCAVADORA KUBOTA K70-3',
  'EXCAVADORA HITACHI ZX120-3', 'EXCAVADORA CASE CX240C-8',
  'EXCAVADORA HITACHI ZX210LC-5B', 'MINIEXCAVADORA YANMAR VIO35-7',
  'BALDE EXCAVADORA (ROCK DUTY)', 'RODILLO VIBRATORIO PARA MINICARGADOR',
  'BRAZO EXCAVADOR PARA MINICARGADOR', 'MOTONIVELADORA CASE 845B-2',
  'PULVERIZADORA NPK', 'MARTILLO HIDRAULICO FURUKAWA',
  'EXTENDEDORA DE ASFALTO SIMEX', 'CANGURO AMMANN ACR70D',
  'MINIEXCAVADORA YANMAR VIO17-1B', 'MINIEXCAVADORA YANMAR VIO35-6B',
  'VIBROCOMPACTADOR AMMANN ARX 26-2', 'MINICARGADOR CASE SR175B',
  'MINICARGADOR CASE SR220B', 'VIBROCOMPACTADOR CASE 1107EX',
  'EXCAVADORA YANMAR VIO80-1', 'EXCAVADORA HITACHI ZX130-5G',
  'BULLDOZER CATERPILLAR D3C', 'BULLDOZER KOMATSU D39PX',
  'EXCAVADORA YANMAR VIO70-3', 'MINIEXCAVADORA AIRMAN AX50U-3',
  'MINIEXCAVADORA HITACHI ZX30U-5A', 'MINIEXCAVADORA HITACHI ZX35U-5A',
  'EXCAVADORA LBX130X3E', 'EXCAVADORA KUBOTA K120-3',
  'EXCAVADORA SUMITOMO SH200-5', 'EXCAVADORA HITACHI ZX200-5',
  'EXCAVADORA HITACHI ZX210LCH-5G', 'EXCAVADORA HITACHI ZX135US-3',
  'MINICARGADOR CASE SR210B', 'EXCAVADORA HITACHI ZX350LC-5B',
  'EXCAVADORA HITACHI ZX75US-5B', 'EXCAVADORA HITACHI ZX200-6',
  'EXCAVADORA HITACHI ZX130-5B', 'EXCAVADORA HITACHI ZX225US-5B',
  'VOLQUETA * CHASIS MERCEDES-BENZ ATEGO 1726K', 'EXCAVADORA HITACHI ZX200-5B',
  'EXCAVADORA HITACHI ZX210K-5B', 'RETROCARGADOR CASE 580SV',
  'EXCAVADORA HITACHI ZX120-5B', 'MINIEXCAVADORA HITACHI ZX40U-5B',
  'EXCAVADORA HITACHI ZX330', 'EXCAVADORA HITACHI ZX200X-5B-U'
];

const STATES = ['Libre', 'Ok dinero y OC', 'Lista, Pendiente Entrega', 'Reservada', 'Disponible'];
const WET_LINE_OPTIONS = ['SI', 'No'];
const ARM_TYPE_OPTIONS = ['ESTANDAR', 'N/A'];
const ENGINE_BRANDS = ['N/A', 'ISUZU', 'MITSUBISHI', 'FPT', 'YANMAR', 'KUBOTA', 'PERKINS', 'CUMMINS', 'CATERPILLAR', 'KOMATSU'];
const CABIN_TYPES = ['N/A', 'CABINA CERRADA / AIRE ACONDICIONADO', 'CANOPY'];

export const EquipmentsPage = () => {
  const { userProfile } = useAuth();
  const [data, setData] = useState<EquipmentRow[]>([]);
  const [filteredData, setFilteredData] = useState<EquipmentRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRow | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewEquipment, setViewEquipment] = useState<EquipmentRow | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = data.filter(
        (row) =>
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
      const response = await apiGet<EquipmentRow[]>('/api/equipments');
      setData(response);
      setFilteredData(response);
    } catch {
      showError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = () => {
    return userProfile?.role === 'comerciales' || userProfile?.role === 'jefe_comercial';
  };

  const canAdd = () => {
    return userProfile?.role === 'jefe_comercial';
  };

  const handleEdit = (row: EquipmentRow) => {
    setSelectedEquipment(row);
    setModalOpen(true);
  };

  const handleView = (row: EquipmentRow) => {
    setViewEquipment(row);
    setViewOpen(true);
  };


  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return '-';
    }
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Funciones helper para estilos elegantes
  const getProveedorStyle = (proveedor: string | null | undefined) => {
    if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md';
  };

  const getModeloStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md';
  };

  const getSerialStyle = (serial: string | null | undefined) => {
    if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
  };

  const getYearStyle = (year: number | string | null | undefined) => {
    if (!year || year === '-' || year === '' || year === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md';
  };

  const getHoursStyle = (hours: number | string | null | undefined) => {
    if (!hours || hours === '-' || hours === '' || hours === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-md';
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

  const getNumberStyle = (value: number | string | null | undefined) => {
    if (!value || value === '-' || value === '' || value === 0 || value === '0') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md';
  };

  const getTextoStyle = (texto: string | null | undefined) => {
    if (!texto || texto === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md';
  };

  const getEstadoStyle = (estado: string | null | undefined) => {
    if (!estado || estado === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    const upperEstado = estado.toUpperCase();
    if (upperEstado.includes('LIBRE') || upperEstado.includes('DISPONIBLE')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md';
    } else if (upperEstado.includes('RESERVADA')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 shadow-md';
    } else if (upperEstado.includes('OK')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md';
    }
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-gray-500 to-slate-500 text-white shadow-md';
  };

  const getPrecioStyle = (precio: number | null | undefined) => {
    if (!precio || precio === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md';
  };

  const getStagingStyle = (fecha: string | null | undefined) => {
    if (!fecha || fecha === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
  };

  const getKPIStats = () => {
    const total = data.length;
    const disponibles = data.filter((row) => row.state === 'Disponible').length;
    const reservadas = data.filter((row) => row.state === 'Reservada').length;
    const totalValue = data.reduce((sum, row) => {
      const value = typeof row.pvp_est === 'string' ? parseFloat(row.pvp_est) : (row.pvp_est || 0);
      return sum + value;
    }, 0);
    
    return {
      total,
      disponibles,
      reservadas,
      totalValue,
    };
  };

  const stats = getKPIStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Equipos</h1>
              <p className="text-gray-600">Gestión de equipos para venta</p>
            </div>
            {canAdd() && (
              <button 
                onClick={() => {
                  setSelectedEquipment(null);
                  setModalOpen(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Agregar Equipo
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Equipos</p>
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
                <p className="text-sm text-gray-600 mb-1">Disponibles</p>
                <p className="text-3xl font-bold text-green-600">{stats.disponibles}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <Package className="w-8 h-8 text-green-600" />
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
                <p className="text-sm text-gray-600 mb-1">Reservadas</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.reservadas}</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <Package className="w-8 h-8 text-yellow-600" />
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
                <p className="text-sm text-gray-600 mb-1">Valor Total</p>
                <p className="text-3xl font-bold text-purple-600">
                  ${stats.totalValue?.toLocaleString('es-CO') || '0'}
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <Package className="w-8 h-8 text-purple-600" />
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
              placeholder="Buscar por modelo o serie..."
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PROVEEDOR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MODELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SERIE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">AÑO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">HORAS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE SALIDA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">EMBARQUE LLEGADA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PUERTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">NACIONALIZACIÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">FECHA DE MOVIMIENTO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">SERIE COMPLETA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">ESTADO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">TIPO DE MAQUINA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">LÍNEA HUMEDA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">TIPO BRAZO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">ANCHO ZAPATAS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">CAP. CUCHARÓN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">GAR. MESES</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">GAR. HORAS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">MARCA MOTOR</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">TIPO CABINA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">OBS. COMERCIALES</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PVP EST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">PRECIO VENTA REAL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">COMENTARIOS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase bg-orange-600">INICIO ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase bg-orange-600">FIN ALIST.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase sticky right-0 bg-blue-700 z-10">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={27} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={27} className="px-4 py-8 text-center text-gray-500">
                      No hay equipos registrados
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
                      <td className="px-4 py-3 text-sm">
                        {row.year ? (
                          <span className={getYearStyle(row.year)}>
                            {row.year}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.hours ? (
                          <span className={getHoursStyle(row.hours)}>
                            {row.hours.toLocaleString('es-CO')}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
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
                      <td className="px-4 py-3 text-sm">
                        {row.current_movement ? (
                          <span className={getMovimientoStyle(row.current_movement)}>
                            {row.current_movement}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatDate(row.current_movement_date) !== '-' ? (
                          <span className={getFechaStyle(formatDate(row.current_movement_date))}>
                            {formatDate(row.current_movement_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* SERIE COMPLETA */}
                      <td className="px-4 py-3 text-sm">
                        {row.full_serial ? (
                          <span className={getNumberStyle(row.full_serial)}>
                            {formatNumber(row.full_serial)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* ESTADO */}
                      <td className="px-4 py-3 text-sm">
                        {row.state ? (
                          <span className={getEstadoStyle(row.state)}>
                            {row.state}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* TIPO DE MAQUINA */}
                      <td className="px-4 py-3 text-sm">
                        {row.machine_type ? (
                          <span className={getTextoStyle(row.machine_type)}>
                            {row.machine_type}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* LÍNEA HUMEDA */}
                      <td className="px-4 py-3 text-sm">
                        {row.wet_line ? (
                          <span className={getTextoStyle(row.wet_line)}>
                            {row.wet_line}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* TIPO BRAZO */}
                      <td className="px-4 py-3 text-sm">
                        {row.arm_type ? (
                          <span className={getTextoStyle(row.arm_type)}>
                            {row.arm_type}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* ANCHO ZAPATAS */}
                      <td className="px-4 py-3 text-sm">
                        {row.track_width ? (
                          <span className={getNumberStyle(row.track_width)}>
                            {formatNumber(row.track_width)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* CAPACIDAD CUCARÓN */}
                      <td className="px-4 py-3 text-sm">
                        {row.bucket_capacity ? (
                          <span className={getNumberStyle(row.bucket_capacity)}>
                            {formatNumber(row.bucket_capacity)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* GARANTIA MESES */}
                      <td className="px-4 py-3 text-sm">
                        {row.warranty_months ? (
                          <span className={getNumberStyle(row.warranty_months)}>
                            {formatNumber(row.warranty_months)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* GARANTIA HORAS */}
                      <td className="px-4 py-3 text-sm">
                        {row.warranty_hours ? (
                          <span className={getNumberStyle(row.warranty_hours)}>
                            {formatNumber(row.warranty_hours)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* MARCA MOTOR */}
                      <td className="px-4 py-3 text-sm">
                        {row.engine_brand ? (
                          <span className={getTextoStyle(row.engine_brand)}>
                            {row.engine_brand}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* TIPO CABINA */}
                      <td className="px-4 py-3 text-sm">
                        {row.cabin_type ? (
                          <span className={getTextoStyle(row.cabin_type)}>
                            {row.cabin_type}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* OBSERVACIONES COMERCIALES */}
                      <td className="px-4 py-3 text-sm">
                        {row.commercial_observations ? (
                          <span className={getTextoStyle(row.commercial_observations)}>
                            {row.commercial_observations}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        {row.pvp_est ? (
                          <span className={getPrecioStyle(row.pvp_est)}>
                            {formatNumber(row.pvp_est)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.real_sale_price != null ? (
                          <span className={getPrecioStyle(row.real_sale_price)}>
                            {formatNumber(row.real_sale_price)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.comments ? (
                          <span className={getTextoStyle(row.comments)}>
                            {row.comments}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* INICIO ALISTAMIENTO */}
                      <td className="px-4 py-3 text-sm">
                        {formatDate(row.start_staging || null) !== '-' ? (
                          <span className={getStagingStyle(formatDate(row.start_staging || null))}>
                            {formatDate(row.start_staging || null)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* FIN ALISTAMIENTO */}
                      <td className="px-4 py-3 text-sm">
                        {formatDate(row.end_staging || null) !== '-' ? (
                          <span className={getStagingStyle(formatDate(row.end_staging || null))}>
                            {formatDate(row.end_staging || null)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 sticky right-0 bg-white z-10" style={{ minWidth: 160 }}>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleView(row)}
                            className="px-2 py-1 text-xs rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                          >
                            Ver
                          </button>
                          {canEdit() && (
                            <button
                              onClick={() => handleEdit(row)}
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <EquipmentModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEquipment(null);
        }}
        equipment={selectedEquipment}
        onSuccess={fetchData}
      />

      {/* View Modal */}
      <Modal
        isOpen={viewOpen}
        onClose={() => { setViewOpen(false); setViewEquipment(null); }}
        title="Detalle del Equipo"
        size="lg"
      >
        {viewEquipment && (
          <div className="space-y-6">
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl">
              <div>
                <p className="text-xs text-gray-500 mb-1">PROVEEDOR</p>
                {viewEquipment.supplier_name ? (
                  <span className={getProveedorStyle(viewEquipment.supplier_name)}>
                    {viewEquipment.supplier_name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">MODELO</p>
                {viewEquipment.model ? (
                  <span className={getModeloStyle(viewEquipment.model)}>
                    {viewEquipment.model}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">SERIE</p>
                {viewEquipment.serial ? (
                  <span className={getSerialStyle(viewEquipment.serial)}>
                    {viewEquipment.serial}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 font-mono">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">AÑO</p>
                {viewEquipment.year ? (
                  <span className={getYearStyle(viewEquipment.year)}>
                    {viewEquipment.year}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">HORAS</p>
                {viewEquipment.hours ? (
                  <span className={getHoursStyle(viewEquipment.hours)}>
                    {viewEquipment.hours.toLocaleString('es-CO')}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">SERIE COMPLETA</p>
                {viewEquipment.full_serial ? (
                  <span className={getNumberStyle(viewEquipment.full_serial)}>
                    {formatNumber(viewEquipment.full_serial)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">ESTADO</p>
                {viewEquipment.state ? (
                  <span className={getEstadoStyle(viewEquipment.state)}>
                    {viewEquipment.state}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">MOVIMIENTO</p>
                {viewEquipment.current_movement ? (
                  <span className={getMovimientoStyle(viewEquipment.current_movement)}>
                    {viewEquipment.current_movement}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
            </div>

            {/* Logística */}
            <div className="border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Logística</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">EMBARQUE SALIDA</p>
                  {formatDate(viewEquipment.shipment_departure_date) !== '-' ? (
                    <span className={getFechaStyle(formatDate(viewEquipment.shipment_departure_date))}>
                      {formatDate(viewEquipment.shipment_departure_date)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">EMBARQUE LLEGADA</p>
                  {formatDate(viewEquipment.shipment_arrival_date) !== '-' ? (
                    <span className={getFechaStyle(formatDate(viewEquipment.shipment_arrival_date))}>
                      {formatDate(viewEquipment.shipment_arrival_date)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">PUERTO</p>
                  {viewEquipment.port_of_destination ? (
                    <span className={getPuertoStyle(viewEquipment.port_of_destination)}>
                      {viewEquipment.port_of_destination}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">NACIONALIZACIÓN</p>
                  {formatDate(viewEquipment.nationalization_date) !== '-' ? (
                    <span className={getNacionalizacionStyle(formatDate(viewEquipment.nationalization_date))}>
                      {formatDate(viewEquipment.nationalization_date)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">FECHA DE MOVIMIENTO</p>
                  {formatDate(viewEquipment.current_movement_date) !== '-' ? (
                    <span className={getFechaStyle(formatDate(viewEquipment.current_movement_date))}>
                      {formatDate(viewEquipment.current_movement_date)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Especificaciones */}
            <div className="border rounded-xl p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Especificaciones</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tipo de Máquina</p>
                  {viewEquipment.machine_type ? (
                    <span className={getTextoStyle(viewEquipment.machine_type)}>
                      {viewEquipment.machine_type}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Estado</p>
                  {viewEquipment.state ? (
                    <span className={getEstadoStyle(viewEquipment.state)}>
                      {viewEquipment.state}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Línea Húmeda</p>
                  {viewEquipment.wet_line ? (
                    <span className={getTextoStyle(viewEquipment.wet_line)}>
                      {viewEquipment.wet_line}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tipo Brazo</p>
                  {viewEquipment.arm_type ? (
                    <span className={getTextoStyle(viewEquipment.arm_type)}>
                      {viewEquipment.arm_type}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Ancho Zapatas</p>
                  {viewEquipment.track_width ? (
                    <span className={getNumberStyle(viewEquipment.track_width)}>
                      {formatNumber(viewEquipment.track_width)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Cap. Cucharón</p>
                  {viewEquipment.bucket_capacity ? (
                    <span className={getNumberStyle(viewEquipment.bucket_capacity)}>
                      {formatNumber(viewEquipment.bucket_capacity)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Garantía Meses</p>
                  {viewEquipment.warranty_months ? (
                    <span className={getNumberStyle(viewEquipment.warranty_months)}>
                      {formatNumber(viewEquipment.warranty_months)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Garantía Horas</p>
                  {viewEquipment.warranty_hours ? (
                    <span className={getNumberStyle(viewEquipment.warranty_hours)}>
                      {formatNumber(viewEquipment.warranty_hours)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Marca Motor</p>
                  {viewEquipment.engine_brand ? (
                    <span className={getTextoStyle(viewEquipment.engine_brand)}>
                      {viewEquipment.engine_brand}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tipo Cabina</p>
                  {viewEquipment.cabin_type ? (
                    <span className={getTextoStyle(viewEquipment.cabin_type)}>
                      {viewEquipment.cabin_type}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Venta */}
            <div className="border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Venta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">PVP Est.</p>
                  {viewEquipment.pvp_est ? (
                    <span className={getPrecioStyle(viewEquipment.pvp_est)}>
                      ${viewEquipment.pvp_est.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Precio de Venta Real</p>
                  {viewEquipment.real_sale_price != null ? (
                    <span className={getPrecioStyle(viewEquipment.real_sale_price)}>
                      ${viewEquipment.real_sale_price.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Observaciones y Comentarios */}
            <div className="border rounded-xl p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Observaciones y Comentarios</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Obs. Comerciales</p>
                  {viewEquipment.commercial_observations ? (
                    <span className={getTextoStyle(viewEquipment.commercial_observations)}>
                      {viewEquipment.commercial_observations}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Comentarios</p>
                  {viewEquipment.comments ? (
                    <span className={getTextoStyle(viewEquipment.comments)}>
                      {viewEquipment.comments}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Fechas de Alistamiento */}
            <div className="border rounded-xl p-4 border-orange-200 bg-orange-50">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Alistamiento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">INICIO ALIST.</p>
                  {formatDate(viewEquipment.start_staging || null) !== '-' ? (
                    <span className={getStagingStyle(formatDate(viewEquipment.start_staging || null))}>
                      {formatDate(viewEquipment.start_staging || null)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">FIN ALIST.</p>
                  {formatDate(viewEquipment.end_staging || null) !== '-' ? (
                    <span className={getStagingStyle(formatDate(viewEquipment.end_staging || null))}>
                      {formatDate(viewEquipment.end_staging || null)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Archivos comerciales: solo ver */}
            {viewEquipment.machine_id && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Material Comercial</h3>
                <MachineFiles 
                  machineId={viewEquipment.machine_id}
                  allowUpload={false}
                  allowDelete={false}
                  enablePhotos={true}
                  enableDocs={true}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

