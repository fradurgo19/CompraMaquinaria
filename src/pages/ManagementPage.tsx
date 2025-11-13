/**
 * Página de Consolidado - Dashboard Ejecutivo Premium
 * Tabla Digital con todos los campos
 */

import { useState, useEffect, useRef } from 'react';
import { Search, Download, TrendingUp, DollarSign, Package, BarChart3, FileSpreadsheet, Edit, Eye, Wrench, Calculator, FileText, History } from 'lucide-react';
import { MachineFiles } from '../components/MachineFiles';
import { motion } from 'framer-motion';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { ChangeHistory } from '../components/ChangeHistory';
import { useChangeDetection } from '../hooks/useChangeDetection';
import { PriceSuggestion } from '../components/PriceSuggestion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Select } from '../atoms/Select';
import { Modal } from '../molecules/Modal';
import { apiGet, apiPut, apiPost } from '../services/api';
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentRow, setCurrentRow] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewRow, setViewRow] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  
  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Campos a monitorear para control de cambios
  const MONITORED_FIELDS = {
    inland: 'Inland',
    gastos_pto: 'Gastos Puerto',
    flete: 'Flete',
    traslado: 'Traslado',
    repuestos: 'Repuestos',
    mant_ejec: 'Mantenimiento Ejecutado',
    proyectado: 'Valor Proyectado',
    pvp_est: 'PVP Estimado',
    comentarios: 'Comentarios',
    sales_state: 'Estado de Ventas',
  };

  // Hook de detección de cambios (solo cuando hay datos)
  const { hasChanges, changes } = useChangeDetection(
    currentRow && isEditModalOpen ? currentRow : null, 
    currentRow && isEditModalOpen ? editData : null, 
    MONITORED_FIELDS
  );

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

  const filteredData = consolidado
    .filter((item) => {
      // Solo USADOS en Consolidado (filtrar NUEVO y NULL que venga de new_purchases)
      const condition = item.condition || 'USADO';
      return condition === 'USADO';
    })
    .filter((item) => {
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
    { categoria: 'PRECIO', monto: stats.totalInvestment },
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

    // Si hay cambios, mostrar modal de control de cambios
    if (hasChanges && changes.length > 0) {
      setPendingUpdate({ id: currentRow.id, data: editData });
      setShowChangeModal(true);
      return;
    }

    // Si no hay cambios, guardar directamente
    await saveChanges();
  };

  const saveChanges = async (changeReason?: string) => {
    const id = pendingUpdate?.id || currentRow?.id;
    const data = pendingUpdate?.data || editData;

    try {
      await apiPut(`/api/management/${id}`, data);

      // Registrar cambios en el log si hay
      if (hasChanges && changes.length > 0) {
        try {
          await apiPost('/api/change-logs', {
            table_name: 'purchases',
            record_id: id,
            changes: changes,
            change_reason: changeReason || null
          });
          console.log(`📝 ${changes.length} cambios registrados en Consolidado`);
        } catch (logError) {
          console.error('Error registrando cambios:', logError);
        }
      }

      setIsEditModalOpen(false);
      setShowChangeModal(false);
      setCurrentRow(null);
      setEditData({});
      setPendingUpdate(null);
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

  // Funciones helper para estilos de colores
  const getShipmentStyle = (shipment: string | null | undefined) => {
    if (!shipment) return 'text-gray-400';
    const upperShipment = shipment.toUpperCase();
    if (upperShipment.includes('RORO')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
    } else if (upperShipment.includes('1X40')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md';
    }
    return 'text-gray-700';
  };

  const getTipoCompraStyle = (tipoCompra: string | null | undefined) => {
    if (!tipoCompra) return 'text-gray-400';
    const upperTipo = tipoCompra.toUpperCase();
    if (upperTipo.includes('SUBASTA')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md';
    } else if (upperTipo.includes('COMPRA_DIRECTA') || upperTipo.includes('COMPRA DIRECTA')) {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md';
    }
    return 'text-gray-700';
  };

  const getIncotermStyle = (incoterm: string | null | undefined) => {
    if (!incoterm) return 'text-gray-400';
    const upperIncoterm = incoterm.toUpperCase();
    if (upperIncoterm === 'EXW') {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md';
    } else if (upperIncoterm === 'FOB') {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md';
    }
    return 'text-gray-700';
  };

  // Funciones helper para estilos elegantes de datos básicos
  const getModeloStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md whitespace-nowrap';
  };

  const getSerialStyle = (serial: string | null | undefined) => {
    if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
  };

  const getYearStyle = (year: number | string | null | undefined) => {
    if (!year || year === '-' || year === '') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md';
  };

  const getHoursStyle = (hours: number | string | null | undefined) => {
    if (!hours || hours === '-' || hours === '' || hours === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-md';
  };

  const getProveedorStyle = (proveedor: string | null | undefined) => {
    if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md whitespace-nowrap';
  };

  const getMarcaStyle = (marca: string | null | undefined) => {
    if (!marca || marca === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
  };

  // Función para determinar el color de fondo de la fila según la completitud de datos
  const getRowBackgroundByCompleteness = (row: any) => {
    // Campos a validar (deben tener valores > 0 y no ser null/undefined/vacío)
    const fieldsToCheck = [
      'gastos_pto',
      'flete',
      'traslado',
      'repuestos',
      'mant_ejec',
      'inland',
      'proyectado',
      'pvp_est',
      'comentarios'
    ];

    // Verificar si todos los campos tienen valores válidos
    const allFieldsComplete = fieldsToCheck.every(field => {
      const value = row[field];
      
      // Para comentarios, solo verificar que no esté vacío
      if (field === 'comentarios') {
        return value && value !== '' && value !== '-' && value !== null && value !== undefined;
      }
      
      // Para campos numéricos, verificar que sean > 0
      if (value === null || value === undefined || value === '' || value === '-') {
        return false;
      }
      
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      return !isNaN(numValue) && numValue > 0;
    });

    // VERDE: Todos los campos completos
    if (allFieldsComplete) {
      return 'bg-green-50 hover:bg-green-100';
    }
    
    // ROJO: Faltan campos o tienen valores en cero
    return 'bg-red-50 hover:bg-red-100';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-gray-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-brand-red via-primary-600 to-brand-gray rounded-2xl shadow-2xl p-4 md:p-6 mb-6 text-white relative overflow-hidden"
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
          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-brand-gray">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-gray-100 rounded-xl">
                <Package className="w-6 h-6 text-brand-gray" />
              </div>
            </div>
            <p className="text-sm font-medium text-brand-gray mb-1">Total Máquinas</p>
            <p className="text-3xl font-bold text-brand-gray">{stats.totalMachines}</p>
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-brand-red">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-red-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-brand-red" />
              </div>
            </div>
            <p className="text-sm font-medium text-brand-gray mb-1">Inversión Total</p>
            <p className="text-3xl font-bold text-brand-red">
              ${(stats.totalInvestment / 1000000).toFixed(1)}M
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-brand-red">
            <div className="flex items-center justify-between mb-3">
              <div className="p-3 bg-red-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-brand-red" />
              </div>
            </div>
            <p className="text-sm font-medium text-brand-gray mb-1">Costos Operativos</p>
            <p className="text-3xl font-bold text-brand-red">
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

            {/* Barra de Scroll Superior - Sincronizada */}
            <div className="mb-3">
              <div 
                ref={topScrollRef}
                className="overflow-x-auto bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
                style={{ height: '14px' }}
              >
                <div style={{ width: '3500px', height: '1px' }}></div>
              </div>
            </div>

            {/* Tabla con scroll horizontal */}
            <div ref={tableScrollRef} className="overflow-x-auto">
              <table className="w-full min-w-[2000px]">
                <thead className="bg-gradient-to-r from-brand-red to-primary-600 text-white">
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
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '70px' }}>Tipo</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '45px' }}>L.H</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '50px' }}>Brazo</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '45px' }}>Zap</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '45px' }}>Cap</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '45px' }}>Bld</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '45px' }}>G.M</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '45px' }}>G.H</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '60px' }}>Motor</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold uppercase bg-brand-red/10" style={{ maxWidth: '60px' }}>Cabina</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">SHIPMENT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">PROVEEDOR</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">MARCA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase bg-emerald-600">CONDICIÓN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Tipo Compra</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Incoterm</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-red-600">CRCY</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Tasa</th>
                    
                    {/* CAMPOS FINANCIEROS */}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase bg-brand-red/20">PRECIO</th>
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
                    
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase sticky right-0 bg-brand-red">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={34} className="px-4 py-12 text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-red border-t-transparent"></div>
                        <p className="text-gray-600 mt-4">Cargando consolidado...</p>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={34} className="px-4 py-12 text-center">
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
                        className={`transition-colors ${getRowBackgroundByCompleteness(row)}`}
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
                        
                        {/* Especificaciones Técnicas - Compactas */}
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-gray-700 truncate" style={{ maxWidth: '70px' }} title={row.machine_type || '-'}>{row.machine_type || '-'}</td>
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-center" style={{ maxWidth: '45px' }}>
                          {row.wet_line ? (
                            <span className={`px-1 py-0.5 rounded font-semibold text-xs ${
                              row.wet_line === 'SI' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {row.wet_line}
                            </span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-gray-700 text-center" style={{ maxWidth: '50px' }}>{row.arm_type || '-'}</td>
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-gray-700 text-center" style={{ maxWidth: '45px' }}>{row.track_width || '-'}</td>
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-gray-700 text-center" style={{ maxWidth: '45px' }}>{row.bucket_capacity || '-'}</td>
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-center" style={{ maxWidth: '45px' }}>
                          {row.blade ? (
                            <span className={`px-1 py-0.5 rounded font-semibold text-xs ${
                              row.blade === 'SI' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {row.blade}
                            </span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-gray-700 text-center" style={{ maxWidth: '45px' }}>{row.warranty_months || '-'}</td>
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-gray-700 text-center" style={{ maxWidth: '45px' }}>{row.warranty_hours || '-'}</td>
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-gray-700 truncate text-center" style={{ maxWidth: '60px' }} title={row.engine_brand || '-'}>{row.engine_brand || '-'}</td>
                        <td className="px-2 py-3 text-xs bg-red-50/30 text-gray-700 truncate text-center" style={{ maxWidth: '60px' }} title={row.cabin_type || '-'}>{row.cabin_type || '-'}</td>
                        
                        <td className="px-4 py-3 text-sm">
                          {row.shipment ? (
                            <span className={getShipmentStyle(row.shipment)}>
                              {row.shipment}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {row.supplier ? (
                            <span className={getProveedorStyle(row.supplier)}>
                              {row.supplier}
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
                        <td className="px-4 py-3 text-sm">
                          {row.tipo_compra ? (
                            <span className={getTipoCompraStyle(row.tipo_compra)}>
                              {row.tipo_compra === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : row.tipo_compra}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.tipo_incoterm ? (
                            <span className={getIncotermStyle(row.tipo_incoterm)}>
                              {row.tipo_incoterm}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
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
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleView(row)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(row)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setCurrentRow(row);
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
              {/* Encabezado registro - Diseño Premium */}
              <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 p-6 rounded-xl text-white shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-red-100 mb-1">Editando Equipo</p>
                    <p className="text-lg font-bold">
                      {currentRow.model} - S/N {currentRow.serial}
                    </p>
                  </div>
                </div>
              </div>

              {/* Resumen de valores - Tarjetas Premium */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-indigo-600" />
                    <p className="text-xs font-semibold text-indigo-700">PRECIO</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-700">{formatCurrency(currentRow.precio_fob)}</p>
                </div>
                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    <p className="text-xs font-semibold text-purple-700">CIF USD</p>
                  </div>
                  <p className="text-2xl font-bold text-purple-700">{formatCurrency(currentRow.cif_usd)}</p>
                </div>
                <div className="p-5 rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-300 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-[#50504f]" />
                    <p className="text-xs font-semibold text-[#50504f]">CIF LOCAL</p>
                  </div>
                  <p className="text-2xl font-bold text-[#50504f]">{formatCurrency(currentRow.cif_local)}</p>
                </div>
              </div>

              {/* Estado de venta - Card Destacada */}
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-5 rounded-xl border border-yellow-200">
                <label className="block text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Estado de Venta
                </label>
                <select
                  value={editData.sales_state || ''}
                  onChange={(e) => setEditData({...editData, sales_state: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white text-lg font-semibold"
                >
                  <option value="">Seleccionar estado...</option>
                  <option value="OK">✅ OK</option>
                  <option value="X">❌ X</option>
                  <option value="BLANCO">⚪ BLANCO</option>
                </select>
              </div>

              {/* GASTOS - Sección Premium */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200">
                <h4 className="text-sm font-semibold text-indigo-800 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  GASTOS OPERACIONALES
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      💰 Inland
                    </label>
                    <input type="number" value={editData.inland || ''} onChange={(e) => setEditData({...editData, inland: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      🚢 Gastos Pto
                    </label>
                    <input type="number" value={editData.gastos_pto || ''} onChange={(e) => setEditData({...editData, gastos_pto: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      📦 Flete
                    </label>
                    <input type="number" value={editData.flete || ''} onChange={(e) => setEditData({...editData, flete: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      🚚 Traslado
                    </label>
                    <input type="number" value={editData.traslado || ''} onChange={(e) => setEditData({...editData, traslado: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      🔧 Repuestos
                    </label>
                    <input type="number" value={editData.repuestos || ''} onChange={(e) => setEditData({...editData, repuestos: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                    
                    {/* Sugerencia de Repuestos */}
                    {currentRow && currentRow.model && (
                      <div className="mt-3">
                        <PriceSuggestion
                          type="repuestos"
                          model={currentRow.model}
                          year={currentRow.year}
                          hours={currentRow.hours}
                          autoFetch={true}
                          onApply={(value) => setEditData({...editData, repuestos: value})}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                      ⚙️ Mant. Ejec.
                    </label>
                    <input type="number" value={editData.mant_ejec || ''} onChange={(e) => setEditData({...editData, mant_ejec: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* ARANCEL Y VENTA - Sección Premium */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-xl border border-green-200">
                <h4 className="text-sm font-semibold text-green-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  PROYECCIÓN Y VENTA
                </h4>
                
                {/* Costo Arancel - Solo lectura */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 rounded-xl bg-white border-2 border-green-300 shadow-sm">
                    <p className="text-xs text-green-700 font-semibold mb-1">Costo Arancel (Automático)</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(currentRow.cost_arancel)}</p>
                  </div>
                </div>
                
                {/* Campos editables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                      📊 Proyectado
                    </label>
                    <input type="number" value={editData.proyectado || ''} onChange={(e) => setEditData({...editData, proyectado: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white text-lg font-semibold" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                      💵 PVP Estimado
                    </label>
                    <input type="number" value={editData.pvp_est || ''} onChange={(e) => setEditData({...editData, pvp_est: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white text-lg font-semibold" placeholder="0.00" />
                    
                    {/* Sugerencia de PVP Estimado */}
                    {currentRow && currentRow.model && (
                      <div className="mt-3">
                        <PriceSuggestion
                          type="pvp"
                          model={currentRow.model}
                          year={currentRow.year}
                          hours={currentRow.hours}
                          costoArancel={currentRow.cost_arancel}
                          autoFetch={true}
                          onApply={(value) => setEditData({...editData, pvp_est: value})}
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Comentarios */}
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    📝 Comentarios
                  </label>
                  <textarea value={editData.comentarios || ''} onChange={(e) => setEditData({...editData, comentarios: e.target.value})} rows={4} className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] bg-white" placeholder="Ingrese observaciones del equipo..." />
                </div>
              </div>

              {/* Archivos de la Máquina (subir / eliminar) */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Archivos de la Máquina</h4>
                <div className="p-4 rounded-xl border bg-white">
                  <MachineFiles machineId={currentRow.machine_id} allowUpload={true} />
                </div>
              </div>

              {/* Botones - Diseño Empresarial */}
              <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-200">
                <Button variant="secondary" onClick={handleCancel} className="px-8 py-3 text-base bg-gray-100 hover:bg-gray-200 text-[#50504f] font-semibold">
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="px-8 py-3 text-base bg-gradient-to-r from-[#cf1b22] to-red-700 hover:from-red-800 hover:to-red-900 text-white font-semibold shadow-lg">
                  💾 Guardar Cambios
                </Button>
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
                  <p className="text-xs text-gray-500">PRECIO</p>
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
        {currentRow && (
          <ChangeHistory 
            tableName="purchases" 
            recordId={currentRow.id}
            purchaseId={currentRow.id}
          />
        )}
      </Modal>
      </div>
    </div>
  );
};
