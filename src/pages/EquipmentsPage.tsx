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

interface EquipmentRow {
  id: string;
  purchase_id: string;
  
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">COMENTARIOS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={25} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={25} className="px-4 py-8 text-center text-gray-500">
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
                      <td className="px-4 py-3 text-sm text-gray-700">{row.supplier_name || '-'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.model || '-'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">{row.serial || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.year || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.hours || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.shipment_departure_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.shipment_arrival_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.port_of_destination || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.nationalization_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.current_movement || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.current_movement_date)}</td>
                      
                      {/* SERIE COMPLETA */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{formatNumber(row.full_serial)}</span>
                      </td>
                      
                      {/* ESTADO */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{row.state || '-'}</span>
                      </td>
                      
                      {/* TIPO DE MAQUINA */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{row.machine_type || '-'}</span>
                      </td>
                      
                      {/* LÍNEA HUMEDA */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{row.wet_line || '-'}</span>
                      </td>
                      
                      {/* TIPO BRAZO */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{row.arm_type || '-'}</span>
                      </td>
                      
                      {/* ANCHO ZAPATAS */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{formatNumber(row.track_width)}</span>
                      </td>
                      
                      {/* CAPACIDAD CUCARÓN */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{formatNumber(row.bucket_capacity)}</span>
                      </td>
                      
                      {/* GARANTIA MESES */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{formatNumber(row.warranty_months)}</span>
                      </td>
                      
                      {/* GARANTIA HORAS */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{formatNumber(row.warranty_hours)}</span>
                      </td>
                      
                      {/* MARCA MOTOR */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{row.engine_brand || '-'}</span>
                      </td>
                      
                      {/* TIPO CABINA */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{row.cabin_type || '-'}</span>
                      </td>
                      
                      {/* OBSERVACIONES COMERCIALES */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{row.commercial_observations || '-'}</span>
                      </td>
                      
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatNumber(row.pvp_est)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.comments || '-'}</td>
                      
                      <td className="px-4 py-3">
                        {canEdit() && (
                          <button
                            onClick={() => handleEdit(row)}
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
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
    </div>
  );
};

