/**
 * Página de Inicio - Dashboard Ejecutivo Premium
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Dashboard } from '../components/Dashboard';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet } from '../services/api';
import { Gavel, ShoppingCart, BarChart3, TrendingUp, Package, DollarSign, Truck, Settings, Eye, EyeOff } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import type { ChartVisibility } from '../components/Dashboard';

// Tipo para las claves de gráficos
type ChartKey = 'inversionTotal' | 'precioPromedio' | 'evolucionSubastas' | 'distribucionEstado' | 'tasaExito' | 'noGanadas';

export const HomePage = () => {
  const { userProfile } = useAuth();
  const isGerencia = userProfile?.role === 'gerencia' || userProfile?.email?.toLowerCase() === 'pcano@partequipos.com';
  
  // Estado para controlar visibilidad de gráficos (solo para gerencia)
  const [chartVisibility, setChartVisibility] = useState<ChartVisibility>(() => {
    if (isGerencia) {
      const saved = localStorage.getItem('dashboard_chart_visibility');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Si hay error, usar defaults
        }
      }
      return {
        inversionTotal: true,
        precioPromedio: true,
        evolucionSubastas: true,
        distribucionEstado: true,
        tasaExito: true,
        noGanadas: true,
      };
    }
    return {
      inversionTotal: true,
      precioPromedio: true,
      evolucionSubastas: true,
      distribucionEstado: true,
      tasaExito: true,
      noGanadas: true,
    };
  });

  const [showChartSelector, setShowChartSelector] = useState(false);

  // Guardar preferencias cuando cambien
  useEffect(() => {
    if (isGerencia) {
      localStorage.setItem('dashboard_chart_visibility', JSON.stringify(chartVisibility));
    }
  }, [chartVisibility, isGerencia]);

  const chartLabels: Record<ChartKey, string> = {
    inversionTotal: 'Inversión Total',
    precioPromedio: 'Precio Promedio',
    evolucionSubastas: 'Evolución de Subastas',
    distribucionEstado: 'Distribución por Estado',
    tasaExito: 'Tasa de Éxito',
    noGanadas: 'No Ganadas',
  };

  const toggleChart = (key: ChartKey) => {
    setChartVisibility(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const [stats, setStats] = useState({
    totalMachines: 0,
    totalAuctions: 0,
    totalPurchases: 0,
    wonAuctions: 0,
    lostAuctions: 0,
    pendingAuctions: 0,
    totalInvestment: 0,
    averagePrice: 0,
  });
  const [purchaseStats, setPurchaseStats] = useState({
    activePurchases: 0,
    pendingPayments: 0,
    shipmentsInTransit: 0,
    totalCompleted: 0,
  });
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [auctions, setAuctions] = useState<any[]>([]);
  const [managementKpis, setManagementKpis] = useState({
    totalMachines: 0,
    totalInvestment: 0,
    totalCosts: 0,
    averageMargin: 0,
    okState: 0,
    xState: 0,
    blankState: 0,
    costBreakdown: [
      { categoria: 'PRECIO', monto: 0 },
      { categoria: 'Costos Logística', monto: 0 },
      { categoria: 'Total', monto: 0 },
    ],
    salesDistribution: [
      { name: 'OK', value: 0, color: '#10b981' },
      { name: 'X', value: 0, color: '#ef4444' },
      { name: 'BLANCO', value: 0, color: '#6b7280' },
    ],
  });
  const [managementKpisLoading, setManagementKpisLoading] = useState(false);
  const shouldShowManagementKpis = userProfile?.role === 'gerencia' || userProfile?.role === 'admin';

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (shouldShowManagementKpis) {
      loadManagementKpis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShowManagementKpis]);

  const loadStats = async () => {
    try {
      // Obtener datos según el rol
      if (userProfile?.role === 'sebastian' || userProfile?.role === 'gerencia' || userProfile?.role === 'admin') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const auctionsData = await apiGet<any[]>('/api/auctions');
        setAuctions(auctionsData);
        
        const wonAuctions = auctionsData.filter(a => a.status === 'GANADA').length;
        const lostAuctions = auctionsData.filter(a => a.status === 'PERDIDA').length;
        const pendingAuctions = auctionsData.filter(a => a.status === 'PENDIENTE').length;
        
        // Inversión Total: Suma de las subastas ganadas (solo las GANADAS)
        const wonAuctionsData = auctionsData.filter(a => a.status === 'GANADA');
        
        const totalInvestment = wonAuctionsData
          .filter(a => a.purchased_price)
          .reduce((sum, a) => sum + parseFloat(a.purchased_price || 0), 0);
        
        // Precio Promedio: Promedio de precio de las subastas ganadas
        const pricesFromWonAuctions = wonAuctionsData
          .filter(a => a.purchased_price)
          .map(a => parseFloat(a.purchased_price || 0));
        
        const averagePrice = pricesFromWonAuctions.length > 0 
          ? pricesFromWonAuctions.reduce((sum, price) => sum + price, 0) / pricesFromWonAuctions.length
          : 0;

        setStats({
          totalMachines: auctionsData.length,
          totalAuctions: auctionsData.length,
          totalPurchases: 0,
          wonAuctions,
          lostAuctions,
          pendingAuctions,
          totalInvestment,
          averagePrice,
        });
      } else if (userProfile?.role === 'eliana') {
        // Cargar estadísticas de compras para Eliana
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const purchases = await apiGet<any[]>('/api/purchases');
        
        // Compras Activas (con estado PENDIENTE o DESBOLSADO)
        const activePurchases = purchases.filter(p => 
          p.payment_status === 'PENDIENTE' || p.payment_status === 'DESBOLSADO'
        ).length;
        
        // Pagos Pendientes - calcular monto total
        const pendingPaymentsAmount = purchases
          .filter(p => p.payment_status === 'PENDIENTE')
          .reduce((sum, p) => {
            const exw = parseFloat(p.exw_value_formatted?.replace(/[^0-9.-]/g, '') || '0');
            const disassembly = parseFloat(p.disassembly_load_value || '0');
            const total = exw + disassembly;
            return sum + total;
          }, 0);
        
        // Envíos en Tránsito (con fecha de salida pero sin llegada o fecha de llegada no cumplida)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const shipmentsInTransit = purchases.filter(p => {
          if (!p.shipment_departure_date) return false;
          // Si no tiene fecha de llegada, está en tránsito
          if (!p.shipment_arrival_date) return true;
          // Si tiene fecha de llegada pero no se ha cumplido, está en tránsito
          const arrivalDate = new Date(p.shipment_arrival_date);
          arrivalDate.setHours(0, 0, 0, 0);
          return arrivalDate > today;
        }).length;
        
        // Total Completados (los que tengan fecha de pago)
        const totalCompleted = purchases.filter(p => p.payment_date).length;
        
        setPurchaseStats({
          activePurchases,
          pendingPayments: pendingPaymentsAmount,
          shipmentsInTransit,
          totalCompleted,
        });
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadManagementKpis = async () => {
    try {
      setManagementKpisLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const managementData = await apiGet<Array<Record<string, any>>>('/api/management');
      const toNumber = (value: number | string | null | undefined): number => {
        if (value === null || value === undefined || value === '') return 0;
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return isNaN(num) ? 0 : num;
      };

      const totalMachines = managementData.length;
      const totalInvestment = managementData.reduce((sum, item) => sum + toNumber(item.precio_fob), 0);
      const totalCosts = managementData.reduce(
        (sum, item) =>
          sum +
          toNumber(item.inland) +
          toNumber(item.flete) +
          toNumber(item.gastos_pto) +
          toNumber(item.traslado) +
          toNumber(item.repuestos) +
          toNumber(item.mant_ejec),
        0
      );
      const okState = managementData.filter((i) => i.sales_state === 'OK').length;
      const xState = managementData.filter((i) => i.sales_state === 'X').length;
      const blankState = managementData.filter((i) => !i.sales_state || i.sales_state === 'BLANCO').length;
      const validMargins = managementData
        .filter((item) => toNumber(item.precio_fob) > 0 && toNumber(item.cif_local) > 0)
        .map((item) => {
          const precioFob = toNumber(item.precio_fob);
          const cifLocal = toNumber(item.cif_local);
          const profit = precioFob - cifLocal;
          const margin = cifLocal > 0 ? (profit / cifLocal) * 100 : 0;
          return margin;
        });
      const averageMargin =
        validMargins.length === 0
          ? 0
          : validMargins.reduce((sum, margin) => sum + margin, 0) / validMargins.length;

      setManagementKpis({
        totalMachines,
        totalInvestment,
        totalCosts,
        averageMargin,
        okState,
        xState,
        blankState,
        costBreakdown: [
          { categoria: 'PRECIO', monto: totalInvestment },
          { categoria: 'Costos Logística', monto: totalCosts },
          { categoria: 'Total', monto: totalInvestment + totalCosts },
        ],
        salesDistribution: [
          { name: 'OK', value: okState, color: '#10b981' },
          { name: 'X', value: xState, color: '#ef4444' },
          { name: 'BLANCO', value: blankState, color: '#6b7280' },
        ],
      });
    } catch (error) {
      console.error('Error cargando KPIs de consolidado:', error);
    } finally {
      setManagementKpisLoading(false);
    }
  };

  const formatMillions = (value: number, decimals = 1) => {
    if (!value) return '$0.0M';
    return `$${(value / 1_000_000).toFixed(decimals)}M`;
  };

  const getRoleConfig = () => {
    const role = userProfile?.role;
    switch (role) {
      case 'sebastian':
        return {
          title: 'Panel de Subastas',
          subtitle: 'Sebastián García',
          description: 'Gestiona subastas de maquinaria y archivos de documentación',
          gradient: 'from-brand-red via-primary-600 to-primary-700',
          icon: Gavel,
          mainLink: '/auctions',
        };
      case 'eliana':
        return {
          title: 'Panel de Compras',
          subtitle: 'Eliana Rodríguez',
          description: 'Administra compras, costos y envíos',
          gradient: 'from-brand-red via-primary-700 to-brand-gray',
          icon: ShoppingCart,
          mainLink: '/purchases',
        };
      case 'pagos':
        return {
          title: 'Panel de Pagos',
          subtitle: 'Usuario Pagos',
          description: 'Administra pagos, contravalor, TRM y fechas de pago',
          gradient: 'from-brand-red via-primary-600 to-primary-700',
          icon: Package,
          mainLink: '/pagos',
        };
      case 'gerencia':
        return {
          title: 'Gerencia Panel Ejecutivo / Vista completa: Subastas - BID, Logística Origen y Consolidado - CD',
          subtitle: 'Gerencia',
          description: '',
          gradient: 'from-brand-red via-primary-600 to-brand-gray',
          icon: BarChart3,
          mainLink: '/management',
        };
      case 'importaciones':
        return {
          title: 'Control de Embarques',
          subtitle: 'Usuario Importaciones',
          description: 'Administra fechas de embarque, llegada y nacionalización',
          gradient: 'from-brand-red via-primary-600 to-primary-700',
          icon: Package,
          mainLink: '/importations',
        };
      case 'logistica':
        return {
          title: 'Gestión de Logística',
          subtitle: 'Usuario Logística',
          description: 'Controla movimientos y trazabilidad de máquinas nacionalizadas',
          gradient: 'from-brand-red via-primary-700 to-brand-gray',
          icon: Truck,
          mainLink: '/logistics',
        };
      default:
        return {
          title: 'Panel de Control',
          subtitle: 'Administrador',
          description: 'Gestión completa del sistema',
          gradient: 'from-brand-gray via-secondary-700 to-secondary-800',
          icon: Package,
          mainLink: '/',
        };
    }
  };

  const roleConfig = getRoleConfig();
  const Icon = roleConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        {!(userProfile?.role === 'gerencia') && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-r ${roleConfig.gradient} rounded-2xl shadow-2xl p-4 md:p-6 mb-6 text-white relative overflow-hidden`}
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 opacity-10">
              <Icon className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Icon className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-medium">{roleConfig.subtitle}</p>
                  <h1 className="text-2xl md:text-3xl font-bold">{roleConfig.title}</h1>
                </div>
              </div>
              <p className="text-base text-white/90 max-w-2xl">
                {roleConfig.description}
              </p>
            </div>
          </motion.div>
        )}
        
        {/* Hero Section para Gerencia - Solo un header */}
        {userProfile?.role === 'gerencia' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-r ${roleConfig.gradient} rounded-2xl shadow-2xl p-4 md:p-6 mb-6 text-white relative overflow-hidden`}
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 opacity-10">
              <Icon className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Icon className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-white/80 text-xs font-medium">{roleConfig.subtitle}</p>
                    <h1 className="text-xl md:text-2xl font-bold">{roleConfig.title}</h1>
                  </div>
                </div>
                {/* Botón de gráficos en el header para gerencia */}
                {isGerencia && (
                  <div className="relative z-50">
                    <button
                      onClick={() => setShowChartSelector(!showChartSelector)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm text-white"
                      title="Configurar gráficos visibles"
                    >
                      <Settings className="w-5 h-5" />
                      <span className="hidden md:inline text-sm font-medium">Gráficos Visibles</span>
                    </button>
                    
                    {/* Dropdown de selección de gráficos */}
                    <AnimatePresence>
                      {showChartSelector && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowChartSelector(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
                          >
                            <div className="p-3 bg-gradient-to-r from-brand-red to-primary-600 text-white">
                              <h3 className="text-sm font-semibold">Gráficos Visibles</h3>
                              <p className="text-xs text-white/80 mt-1">Selecciona los gráficos a mostrar</p>
                            </div>
                            <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
                              {(Object.keys(chartLabels) as ChartKey[]).map((key) => {
                                const isVisible = chartVisibility[key];
                                return (
                                  <label
                                    key={key}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                  >
                                    <div className="relative">
                                      <input
                                        type="checkbox"
                                        checked={isVisible}
                                        onChange={() => toggleChart(key)}
                                        className="sr-only"
                                      />
                                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                        isVisible
                                          ? 'bg-brand-red border-brand-red'
                                          : 'bg-white border-gray-300'
                                      }`}>
                                        {isVisible && (
                                          <Eye className="w-3 h-3 text-white" />
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-sm text-gray-700 flex-1">{chartLabels[key]}</span>
                                    {!isVisible && (
                                      <EyeOff className="w-4 h-4 text-gray-400" />
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                            <div className="p-3 border-t border-gray-200 bg-gray-50">
                              <p className="text-xs text-gray-500">
                                <span className="font-semibold">Fijos:</span> Pendiente, Subastas Pendientes, Subastas Ganadas, Total Máquinas
                              </p>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Dashboard para roles con acceso a subastas */}
        {!loading && (userProfile?.role === 'sebastian' || userProfile?.role === 'gerencia' || userProfile?.role === 'admin') && (
          <Dashboard 
            stats={stats} 
            auctions={auctions}
            chartVisibility={isGerencia ? chartVisibility : undefined}
            onChartVisibilityChange={isGerencia ? setChartVisibility : undefined}
            showChartSelector={isGerencia ? showChartSelector : undefined}
            onShowChartSelectorChange={isGerencia ? setShowChartSelector : undefined}
          />
        )}

        {/* KPIs del Consolidado - visibles para Gerencia/Admin */}
        {shouldShowManagementKpis && (
          <div className="space-y-6 my-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-6"
            >
              <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-brand-gray">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-gray-100 rounded-xl">
                    <Package className="w-6 h-6 text-brand-gray" />
                  </div>
                </div>
                <p className="text-sm font-medium text-brand-gray mb-1">Total Máquinas</p>
                <p className="text-3xl font-bold text-brand-gray">
                  {managementKpisLoading ? '...' : managementKpis.totalMachines}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-xl p-6 border-l-4 border-brand-red">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-red-100 rounded-xl">
                    <DollarSign className="w-6 h-6 text-brand-red" />
                  </div>
                </div>
                <p className="text-sm font-medium text-brand-gray mb-1">Inversión Total</p>
                <p className="text-3xl font-bold text-brand-red">
                  {managementKpisLoading ? '...' : formatMillions(managementKpis.totalInvestment, 1)}
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
                  {managementKpisLoading ? '...' : formatMillions(managementKpis.totalCosts, 2)}
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
                  {managementKpisLoading
                    ? '...'
                    : `${managementKpis.averageMargin?.toFixed(1) ?? '0.0'}%`}
                </p>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl shadow-xl p-6"
              >
                <h3 className="text-lg font-bold text-gray-800 mb-4">Desglose de Costos</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={managementKpis.costBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="categoria" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number) => `$${value.toLocaleString('es-CO')}`}
                    />
                    <Bar dataKey="monto" fill="url(#homeColorGradient)" radius={[8, 8, 0, 0]} />
                    <defs>
                      <linearGradient id="homeColorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl shadow-xl p-6"
              >
                <h3 className="text-lg font-bold text-gray-800 mb-4">Estado de Ventas</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={managementKpis.salesDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      {managementKpis.salesDistribution.map((entry, index) => (
                        <Cell key={`mgmt-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-4">
                  {managementKpis.salesDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-600 font-medium">
                        {item.name}: {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Panel especial para Eliana */}
        {userProfile?.role === 'eliana' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-brand-red">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-brand-red" />
                  </div>
                </div>
                <p className="text-sm font-medium text-brand-gray mb-1">Compras Activas</p>
                <p className="text-3xl font-bold text-brand-gray">{purchaseStats.activePurchases}</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-brand-red">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-brand-red" />
                  </div>
                </div>
                <p className="text-sm font-medium text-brand-gray mb-1">Pagos Pendientes</p>
                <p className="text-3xl font-bold text-brand-gray">
                  ¥{(purchaseStats.pendingPayments / 1000000).toFixed(1)}M
          </p>
        </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-brand-gray">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Package className="w-6 h-6 text-brand-gray" />
                  </div>
                </div>
                <p className="text-sm font-medium text-brand-gray mb-1">Envíos en Tránsito</p>
                <p className="text-3xl font-bold text-brand-gray">{purchaseStats.shipmentsInTransit}</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-brand-gray">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-brand-gray" />
                  </div>
                </div>
                <p className="text-sm font-medium text-brand-gray mb-1">Total Completados</p>
                <p className="text-3xl font-bold text-brand-gray">{purchaseStats.totalCompleted}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-brand-gray mb-4">Acceso Rápido</h2>
              <Link
                to="/purchases"
                className="block bg-gradient-to-r from-brand-red to-primary-600 text-white p-6 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all transform hover:scale-105 shadow-lg"
              >
                <ShoppingCart className="w-10 h-10 mb-3" />
                <h3 className="text-xl font-bold mb-2">Gestionar Compras</h3>
                <p className="text-white/90">Crear nuevas compras, gestionar pagos y seguimiento</p>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
