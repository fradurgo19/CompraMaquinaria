/**
 * Página de Consolidado - Dashboard Ejecutivo Premium
 * Tabla Digital con todos los campos
 */

import { useState, useEffect } from 'react';
import { Search, Download, TrendingUp, DollarSign, Package, BarChart3, FileSpreadsheet, Edit2, Eye, Wrench, Calculator, FileText } from 'lucide-react';
import { MachineFiles } from '../components/MachineFiles';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Select } from '../atoms/Select';
import { Modal } from '../molecules/Modal';
import { apiGet, apiPut } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export const ManagementPage = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [consolidado, setConsolidado] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [salesStateFilter, setSalesStateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentRow, setCurrentRow] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewRow, setViewRow] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editData, setEditData] = useState<Record<string, any>>({});

  useEffect(() => {
    loadConsolidado();
  }, []);

  const loadConsolidado = async () => {
    setLoading(true);
    try {
      const data = await apiGet<Array<Record<string, unknown>>>('/api/management');
      setConsolidado(data);
    } catch (err) {
      console.error('Error cargando consolidado:', err);
      showError('Error al cargar el consolidado');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = consolidado.filter((item) => {
    if (salesStateFilter && item.sales_state !== salesStateFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
        return (
        item.model?.toLowerCase().includes(search) ||
        item.serial?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Función helper para convertir valores a número
  const toNumber = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined || value === '') return 0;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? 0 : num;
  };

  // Estadísticas
  const stats = {
    totalMachines: consolidado.length,
    totalInvestment: consolidado.reduce((sum, item) => sum + toNumber(item.precio_fob), 0),
    totalCosts: consolidado.reduce((sum, item) => 
      sum + toNumber(item.inland) + toNumber(item.flete) + toNumber(item.gastos_pto) + 
      toNumber(item.traslado) + toNumber(item.repuestos) + toNumber(item.mant_ejec), 0
    ),
    averageMargin: 0, // Se calculará después
    okState: consolidado.filter(i => i.sales_state === 'OK').length,
    xState: consolidado.filter(i => i.sales_state === 'X').length,
    blankState: consolidado.filter(i => !i.sales_state || i.sales_state === 'BLANCO').length,
  };

  // Calcular margen promedio
  const calculateAverageMargin = () => {
    const validMargins = consolidado
      .filter(item => toNumber(item.precio_fob) > 0 && toNumber(item.cif_local) > 0)
      .map(item => {
        const precioFob = toNumber(item.precio_fob);
        const cifLocal = toNumber(item.cif_local);
        const profit = precioFob - cifLocal;
        const margin = cifLocal > 0 ? (profit / cifLocal) * 100 : 0;
        return margin;
      });

    if (validMargins.length === 0) return 0;
    const avgMargin = validMargins.reduce((sum, margin) => sum + margin, 0) / validMargins.length;
    return avgMargin;
  };

  stats.averageMargin = calculateAverageMargin();

  const salesDistribution = [
    { name: 'OK', value: stats.okState, color: '#10b981' },
    { name: 'X', value: stats.xState, color: '#ef4444' },
    { name: 'BLANCO', value: stats.blankState, color: '#6b7280' },
  ];

  const costBreakdown = [
    { categoria: 'Precio FOB', monto: stats.totalInvestment },
    { categoria: 'Costos Logística', monto: stats.totalCosts },
    { categoria: 'Total', monto: stats.totalInvestment + stats.totalCosts },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEdit = (row: Record<string, any>) => {
    setCurrentRow(row);
    setEditData({
      sales_state: row.sales_state,
      inland: row.inland,
      gastos_pto: row.gastos_pto,
      flete: row.flete,
      traslado: row.traslado,
      repuestos: row.repuestos,
      mant_ejec: row.mant_ejec,
      proyectado: row.proyectado,
      pvp_est: row.pvp_est,
      comentarios: row.comentarios,
    });
    setIsEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!currentRow) return;
    try {
      await apiPut(`/api/management/${currentRow.id}`, editData);
      setIsEditModalOpen(false);
      setCurrentRow(null);
      setEditData({});
      await loadConsolidado();
      showSuccess('Registro actualizado correctamente');
    } catch {
      showError('Error al actualizar el registro');
    }
  };

  // Ver registro (modal de vista)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleView = (row: Record<string, any>) => {
    setViewRow(row);
    setIsViewModalOpen(true);
  };

  const closeView = () => {
    setIsViewModalOpen(false);
    setViewRow(null);
  };

  const handleCancel = () => {
    setIsEditModalOpen(false);
    setCurrentRow(null);
    setEditData({});
  };

  const formatCurrency = (value: number | null | undefined | string) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    const fixedValue = parseFloat(numValue.toFixed(2));
    return `$${fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const formatNumber = (value: number | null | undefined | string) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    const fixedValue = parseFloat(numValue.toFixed(2));
    return fixedValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-gray-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-2xl p-4 md:p-6 mb-6 text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 opacity-10">
            <BarChart3 className="w-32 h-32" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <p className="text-white/80 text-xs font-medium">Vista Ejecutiva</p>
                <h1 className="text-2xl md:text-3xl font-bold">Consolidado General</h1>
              </div>
            </div>
            <p className="text-base text-white/90 max-w-2xl">
              Control financiero integral con actualización automática desde subastas y compras
            </p>
          </div>
        </motion.div>

        {/* KPIs Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Total Máquinas</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalMachines}</p>
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Inversión Total</p>
            <p className="text-3xl font-bold text-indigo-600">
              ${(stats.totalInvestment / 1000000).toFixed(1)}M
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-purple-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Costos Operativos</p>
            <p className="text-3xl font-bold text-purple-600">
              ${(stats.totalCosts / 1000000).toFixed(2)}M
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-green-100 rounded-xl">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Margen Promedio</p>
            <p className="text-3xl font-bold text-green-600">
              {stats.averageMargin ? `${stats.averageMargin.toFixed(1)}%` : '0%'}
            </p>
          </div>
        </motion.div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-xl p-6"
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4">Desglose de Costos</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={costBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="categoria" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number) => `$${value.toLocaleString('es-CO')}`}
                />
                <Bar dataKey="monto" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-xl p-6"
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4">Estado de Ventas</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={salesDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {salesDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              {salesDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-600 font-medium">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Tabla Consolidado */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            {/* Toolbar */}
            <div className="mb-6">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Tabla Consolidado</h2>
                <div className="flex gap-3">
            <Button
                    variant="secondary"
              size="sm"
                    onClick={() => showSuccess('Exportando a Excel...')}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar Excel
            </Button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por modelo o serial..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                    />
                  </div>
                </div>

                <Select
                  value={salesStateFilter}
                  onChange={(e) => setSalesStateFilter(e.target.value)}
                  options={[
                    { value: '', label: 'Todos los estados' },
                    { value: 'OK', label: '✓ OK' },
                    { value: 'X', label: '✗ X' },
                    { value: 'BLANCO', label: '○ Pendiente' },
                  ]}
                  className="min-w-[180px]"
                />
              </div>
            </div>

            {/* Tabla con scroll horizontal */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[2000px]">
                <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                  <tr>
                    {/* CAMPOS MANUALES - Fondo destacado */}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-yellow-500/20">
                      <div className="flex items-center gap-1">
                        Estado
                        <span className="text-yellow-300" title="Campo manual">✎</span>
                      </div>
                    </th>
                    
                    {/* CAMPOS AUTOMÁTICOS - Info básica */}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Modelo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Serial</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Año</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Horas</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">SHIPMENT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">PROVEEDOR</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Tipo Compra</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Incoterm</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-red-600">CRCY</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Tasa</th>
                    
                    {/* CAMPOS FINANCIEROS */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-blue-500/20">Precio FOB</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Inland</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CIF USD</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CIF Local</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Gastos Pto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Flete</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Traslado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Repuestos</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Mant. Ejec.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Cost. Arancel</th>
                    
                    {/* CAMPOS MANUALES - Proyecciones */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-yellow-500/20">
                      <div className="flex items-center gap-1 justify-end">
                        Proyectado
                        <span className="text-yellow-300" title="Campo manual">✎</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-yellow-500/20">
                      <div className="flex items-center gap-1 justify-end">
                        PVP Est.
                        <span className="text-yellow-300" title="Campo manual">✎</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-yellow-500/20">
                      <div className="flex items-center gap-1">
                        Comentarios
                        <span className="text-yellow-300" title="Campo manual">✎</span>
                      </div>
                    </th>
                    
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase sticky right-0 bg-indigo-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={22} className="px-4 py-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
                        <p className="text-gray-600 mt-4">Cargando consolidado...</p>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={22} className="px-4 py-12 text-center">
                        <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-lg">No hay datos en el consolidado</p>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row, index) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-indigo-50 transition"
                      >
                        {/* CAMPO MANUAL: Estado Venta */}
                        <td className="px-4 py-3 bg-yellow-50/50">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            row.sales_state === 'OK' ? 'bg-green-100 text-green-800' :
                            row.sales_state === 'X' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {row.sales_state || '-'}
                          </span>
                        </td>

                        {/* CAMPOS AUTOMÁTICOS */}
                        <td className="px-4 py-3 text-sm text-gray-700">{row.model || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-mono">{row.serial || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.year || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.hours ? row.hours.toLocaleString('es-CO') : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.shipment || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.supplier || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.tipo_compra || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.tipo_incoterm || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-red-600">{row.currency || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatNumber(row.tasa)}
                        </td>

                        {/* CAMPOS FINANCIEROS */}
                        <td className="px-4 py-3 text-sm text-gray-700 text-right bg-blue-50/50">
                          {formatCurrency(row.precio_fob)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right bg-yellow-50/50">
                          <span>{formatCurrency(row.inland)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {formatCurrency(row.cif_usd)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(row.cif_local)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right bg-yellow-50/50">
                          <span>{formatCurrency(row.gastos_pto)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right bg-yellow-50/50">
                          <span>{formatCurrency(row.flete)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right bg-yellow-50/50">
                          <span>{formatCurrency(row.traslado)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right bg-yellow-50/50">
                          <span>{formatCurrency(row.repuestos)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right bg-yellow-50/50">
                          <span>{formatCurrency(row.mant_ejec)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(row.cost_arancel)}</td>

                        {/* CAMPOS MANUALES: Proyecciones */}
                        <td className="px-4 py-3 text-sm text-gray-700 text-right bg-yellow-50/50">
                          <span>{formatCurrency(row.proyectado)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right bg-yellow-50/50">
                          <span>{formatCurrency(row.pvp_est)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 bg-yellow-50/50">
                          <span>{row.comentarios || '-'}</span>
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 sticky right-0 bg-white border-l-2 border-gray-200">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => handleView(row)}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                              title="Ver registro"
                            >
                              <Eye className="w-3.5 h-3.5" /> Ver
                            </button>
                            <button
                              onClick={() => handleEdit(row)}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow"
                              title="Editar registro"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Editar
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
      </Card>
        </motion.div>

        {/* Modal de Edición */}
      <Modal
          isOpen={isEditModalOpen}
          onClose={handleCancel}
          title="Editar Registro - Consolidado General"
        size="xl"
      >
          {currentRow && (
            <div className="space-y-6">
              {/* Encabezado registro */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">
                  <span className="text-blue-700">Modelo:</span> {currentRow.model} |{' '}
                  <span className="text-blue-700">Serie:</span> {currentRow.serial}
                </p>
              </div>

              {/* Resumen de valores (solo lectura) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-white">
                  <p className="text-xs text-gray-500">Precio FOB</p>
                  <p className="text-lg font-bold text-indigo-700">{formatCurrency(currentRow.precio_fob)}</p>
                </div>
                <div className="p-4 rounded-xl border bg-white">
                  <p className="text-xs text-gray-500">CIF USD</p>
                  <p className="text-lg font-bold text-gray-800">{formatCurrency(currentRow.cif_usd)}</p>
                </div>
                <div className="p-4 rounded-xl border bg-white">
                  <p className="text-xs text-gray-500">CIF Local</p>
                  <p className="text-lg font-bold text-gray-800">{formatCurrency(currentRow.cif_local)}</p>
                </div>
              </div>

              {/* Estado de venta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado de Venta</label>
                <select
                  value={editData.sales_state || ''}
                  onChange={(e) => setEditData({...editData, sales_state: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-</option>
                  <option value="OK">OK</option>
                  <option value="X">X</option>
                  <option value="BLANCO">BLANCO</option>
                </select>
              </div>

              {/* GASTOS: Inland, Gastos Pto, Flete, Traslado, Repuestos, Mant. Ejec */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">GASTOS</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inland</label>
                    <input type="number" value={editData.inland || ''} onChange={(e) => setEditData({...editData, inland: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gastos Pto</label>
                    <input type="number" value={editData.gastos_pto || ''} onChange={(e) => setEditData({...editData, gastos_pto: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Flete</label>
                    <input type="number" value={editData.flete || ''} onChange={(e) => setEditData({...editData, flete: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Traslado</label>
                    <input type="number" value={editData.traslado || ''} onChange={(e) => setEditData({...editData, traslado: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Repuestos</label>
                    <input type="number" value={editData.repuestos || ''} onChange={(e) => setEditData({...editData, repuestos: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mant. Ejec.</label>
                    <input type="number" value={editData.mant_ejec || ''} onChange={(e) => setEditData({...editData, mant_ejec: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" />
                  </div>
                </div>
              </div>

              {/* ARANCEL Y VENTA */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">ARANCEL Y VENTA</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 rounded-xl border bg-white">
                    <p className="text-xs text-gray-500">Cost. Arancel</p>
                    <p className="text-lg font-bold text-gray-800">{formatCurrency(currentRow.cost_arancel)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proyectado</label>
                    <input type="number" value={editData.proyectado || ''} onChange={(e) => setEditData({...editData, proyectado: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PVP Est.</label>
                    <input type="number" value={editData.pvp_est || ''} onChange={(e) => setEditData({...editData, pvp_est: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
                    <textarea value={editData.comentarios || ''} onChange={(e) => setEditData({...editData, comentarios: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ingrese comentarios..." />
                  </div>
                </div>
              </div>

              {/* Archivos de la Máquina (subir / eliminar) */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Archivos de la Máquina</h4>
                <div className="p-4 rounded-xl border bg-white">
                  <MachineFiles machineId={currentRow.machine_id} allowUpload={true} />
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="secondary" onClick={handleCancel} className="px-6">Cancelar</Button>
                <Button onClick={handleSave} className="px-6 bg-indigo-600 hover:bg-indigo-700">Guardar Cambios</Button>
              </div>
            </div>
        )}
      </Modal>
      
      {/* Modal de Vista (Ver) */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={closeView}
        title="Ver Registro - Consolidado"
        size="xl"
      >
        {viewRow && (
          <div className="space-y-6">
            {/* DATOS DE LA MAQUINA */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-700" /> DATOS DE LA MAQUINA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">PROVEEDOR</p>
                  <p className="text-sm font-semibold">{viewRow.supplier || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Modelo</p>
                  <p className="text-sm font-semibold">{viewRow.model || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Serial</p>
                  <p className="text-sm font-semibold font-mono">{viewRow.serial || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Año</p>
                  <p className="text-sm font-semibold">{viewRow.year || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Horas</p>
                  <p className="text-sm font-semibold">{viewRow.hours ? Number(viewRow.hours).toLocaleString('es-CO') : '-'}</p>
                </div>
              </div>
            </div>

            {/* TIPO Y VALOR DE COMPRA */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-indigo-600" /> TIPO Y VALOR DE COMPRA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 rounded-xl border">
                <div>
                  <p className="text-xs text-gray-500">Tipo Compra</p>
                  <p className="text-sm font-semibold">{viewRow.tipo_compra || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Incoterm</p>
                  <p className="text-sm font-semibold">{viewRow.tipo_incoterm || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CRCY</p>
                  <p className="text-sm font-semibold text-red-600">{viewRow.currency || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tasa</p>
                  <p className="text-sm font-semibold">{formatNumber(viewRow.tasa)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Precio FOB</p>
                  <p className="text-sm font-bold text-indigo-700">{formatCurrency(viewRow.precio_fob)}</p>
                </div>
              </div>
            </div>

            {/* CIF */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" /> CIF
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">CIF USD</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.cif_usd)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CIF Local</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.cif_local)}</p>
                </div>
              </div>
            </div>

            {/* GASTOS */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" /> GASTOS
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border">
                <div>
                  <p className="text-xs text-gray-500">Inland</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.inland)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gastos Pto</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.gastos_pto)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Flete</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.flete)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Traslado</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.traslado)}</p>
                </div>
              </div>
            </div>

            {/* REPARACIÓN */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-gray-700" /> REPARACIÓN
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">Repuestos</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.repuestos)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Mant. Ejec.</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.mant_ejec)}</p>
                </div>
              </div>
            </div>

            {/* TOTAL GASTO */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-green-700" /> TOTAL GASTO
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border">
                <div>
                  <p className="text-xs text-gray-500">Total Gasto</p>
                  <p className="text-sm font-bold text-green-700">
                    {(() => {
                      const sum = (val: unknown) => {
                        const v = typeof val === 'string' ? parseFloat(val) : (val as number) || 0;
                        return isNaN(v) ? 0 : v;
                      };
                      const total = sum(viewRow.inland) + sum(viewRow.gastos_pto) + sum(viewRow.flete) + sum(viewRow.traslado) + sum(viewRow.repuestos) + sum(viewRow.mant_ejec);
                      return total > 0 ? `$${total.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cost. Arancel</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.cost_arancel)}</p>
                </div>
              </div>
            </div>

            {/* VENTA */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> VENTA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">Proyectado</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.proyectado)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">PVP Est.</p>
                  <p className="text-sm font-semibold">{formatCurrency(viewRow.pvp_est)}</p>
                </div>
              </div>
            </div>

            {/* COMENTARIOS */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-700" /> COMENTARIOS
              </h3>
              <div className="p-4 rounded-xl border">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewRow.comentarios || '-'}</p>
              </div>
            </div>

            {/* Archivos */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-700" /> Archivos de la Máquina
              </h3>
              <div className="p-4 rounded-xl border bg-white">
                <MachineFiles machineId={viewRow.machine_id} allowUpload={false} />
              </div>
            </div>
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
};
