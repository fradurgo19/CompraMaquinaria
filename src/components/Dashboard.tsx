/**
 * Dashboard Ejecutivo Premium
 * Vista general con KPIs y estadísticas
 */

import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Package, CheckCircle, Clock, XCircle, Settings, Eye, EyeOff } from 'lucide-react';
import { StatCard } from './StatCard';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  stats: {
    totalMachines: number;
    totalAuctions: number;
    totalPurchases: number;
    wonAuctions: number;
    lostAuctions: number;
    pendingAuctions: number;
    totalInvestment: number;
    averagePrice: number;
  };
  auctions?: Array<{ auction_date?: string; status?: string }>;
  chartVisibility?: ChartVisibility; // Estado de visibilidad de gráficos (opcional, para control externo)
  onChartVisibilityChange?: (visibility: ChartVisibility) => void; // Callback para cambios (opcional)
  showChartSelector?: boolean; // Si se muestra el selector (opcional)
  onShowChartSelectorChange?: (show: boolean) => void; // Callback para mostrar/ocultar selector (opcional)
}

const COLORS = {
  ganada: '#10b981',
  perdida: '#ef4444',
  pendiente: '#f59e0b',
};

// Gráficos configurables
type ChartKey = 'inversionTotal' | 'precioPromedio' | 'evolucionSubastas' | 'distribucionEstado' | 'tasaExito' | 'noGanadas' | 'totalMaquinas' | 'costosOperativos' | 'margenPromedio' | 'desgloseCostos' | 'estadoVentas';

export interface ChartVisibility {
  inversionTotal: boolean;
  precioPromedio: boolean;
  evolucionSubastas: boolean;
  distribucionEstado: boolean;
  tasaExito: boolean;
  noGanadas: boolean;
  totalMaquinas: boolean;
  costosOperativos: boolean;
  margenPromedio: boolean;
  desgloseCostos: boolean;
  estadoVentas: boolean;
}

export const Dashboard = ({ 
  stats, 
  auctions = [], 
  chartVisibility: externalChartVisibility,
  onChartVisibilityChange,
  showChartSelector: externalShowChartSelector,
  onShowChartSelectorChange
}: DashboardProps) => {
  const { userProfile } = useAuth();
  const isGerencia = userProfile?.role === 'gerencia' || userProfile?.email?.toLowerCase() === 'pcano@partequipos.com';
  
  // Estado interno para controlar visibilidad de gráficos (solo si no se pasa externamente)
  const [internalChartVisibility, setInternalChartVisibility] = useState<ChartVisibility>(() => {
    if (isGerencia) {
      // Cargar preferencias guardadas o usar defaults
      const saved = localStorage.getItem('dashboard_chart_visibility');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Si hay error, usar defaults
        }
      }
      // Defaults: todos visibles excepto los que el usuario quiera ocultar
      return {
        inversionTotal: true,
        precioPromedio: true,
        evolucionSubastas: true,
        distribucionEstado: true,
        tasaExito: true,
        noGanadas: true,
        totalMaquinas: true,
        costosOperativos: true,
        margenPromedio: true,
        desgloseCostos: true,
        estadoVentas: true,
      };
    }
    // Para otros usuarios, todos visibles
    return {
      inversionTotal: true,
      precioPromedio: true,
      evolucionSubastas: true,
      distribucionEstado: true,
      tasaExito: true,
      noGanadas: true,
      totalMaquinas: true,
      costosOperativos: true,
      margenPromedio: true,
      desgloseCostos: true,
      estadoVentas: true,
    };
  });

  // Usar estado externo si está disponible, sino usar interno
  const chartVisibility = externalChartVisibility ?? internalChartVisibility;
  const [internalShowChartSelector, setInternalShowChartSelector] = useState(false);
  const showChartSelector = externalShowChartSelector !== undefined ? externalShowChartSelector : internalShowChartSelector;

  // Guardar preferencias cuando cambien
  useEffect(() => {
    if (isGerencia && !externalChartVisibility) {
      localStorage.setItem('dashboard_chart_visibility', JSON.stringify(internalChartVisibility));
    }
  }, [internalChartVisibility, isGerencia, externalChartVisibility]);

  const toggleChart = (key: ChartKey) => {
    const newVisibility = {
      ...chartVisibility,
      [key]: !chartVisibility[key],
    };
    
    if (onChartVisibilityChange) {
      onChartVisibilityChange(newVisibility);
    } else {
      setInternalChartVisibility(newVisibility);
    }
  };

  const handleShowChartSelectorChange = (show: boolean) => {
    if (onShowChartSelectorChange) {
      onShowChartSelectorChange(show);
    } else {
      setInternalShowChartSelector(show);
    }
  };

  const chartLabels: Record<ChartKey, string> = {
    inversionTotal: 'Inversión Total',
    precioPromedio: 'Precio Promedio',
    evolucionSubastas: 'Evolución de Subastas',
    distribucionEstado: 'Distribución por Estado',
    tasaExito: 'Tasa de Éxito',
    noGanadas: 'No Ganadas',
    totalMaquinas: 'Total Máquinas',
    costosOperativos: 'Costos Operativos',
    margenPromedio: 'Margen Promedio',
    desgloseCostos: 'Desglose de Costos',
    estadoVentas: 'Estado de Ventas',
  };
  const auctionStatusData = [
    { name: 'Ganadas', value: stats.wonAuctions, color: COLORS.ganada },
    { name: 'Perdidas', value: stats.lostAuctions, color: COLORS.perdida },
    { name: 'Pendientes', value: stats.pendingAuctions, color: COLORS.pendiente },
  ];

  // Generar datos mensuales reales desde las subastas
  const generateMonthlyData = (): Array<{ mes: string; date: Date; subastas: number; ganadas: number }> => {
    const currentDate = new Date();
    const last6Months: Array<{ mes: string; date: Date; subastas: number; ganadas: number }> = [];
    
    // Obtener los últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const mes = date.toLocaleDateString('es-CO', { month: 'short' });
      last6Months.push({ mes, date, subastas: 0, ganadas: 0 });
    }
    
    // Contar subastas por mes
    auctions.forEach((auction: { auction_date?: string; status?: string }) => {
      if (auction.auction_date) {
        const auctionDate = new Date(auction.auction_date);
        
        // Buscar el mes correspondiente
        for (let i = 0; i < last6Months.length; i++) {
          const monthData = last6Months[i];
          const nextMonthData = last6Months[i + 1];
          
          if (auctionDate >= monthData.date && 
              (i === last6Months.length - 1 || auctionDate < nextMonthData.date)) {
            monthData.subastas++;
            if (auction.status === 'GANADA') {
              monthData.ganadas++;
            }
            break;
          }
        }
      }
    });
    
    return last6Months;
  };

  const monthlyData = generateMonthlyData();

  return (
    <div className="space-y-6">
      {/* Header - Oculto para gerencia (ya tienen header en HomePage) */}
      {!isGerencia && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-brand-red via-primary-600 to-brand-gray rounded-2xl shadow-2xl p-4 md:p-6 text-white relative"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">Panel de Control Ejecutivo</h1>
              <p className="text-white/80 text-sm">Sistema de Gestión de Maquinaria Usada</p>
            </div>
            <div className="text-right hidden md:block">
              <p className="text-xs text-white/70">Última actualización</p>
              <p className="text-sm font-semibold">{new Date().toLocaleDateString('es-CO', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              })}</p>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Selector de gráficos flotante para gerencia - Siempre visible si no se controla desde HomePage */}
      {isGerencia && externalShowChartSelector === undefined && (
        <div className="flex justify-end mb-4">
          <div className="relative z-50">
            <button
              onClick={() => handleShowChartSelectorChange(!showChartSelector)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-red via-primary-600 to-brand-gray hover:opacity-90 rounded-lg transition-all text-white font-medium shadow-md"
              title="Configurar gráficos visibles"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden md:inline text-sm">Gráficos Visibles</span>
            </button>
            
            {/* Dropdown de selección de gráficos */}
            <AnimatePresence>
              {showChartSelector && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => handleShowChartSelectorChange(false)}
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
        </div>
      )}

      {/* KPIs Grid - Para gerencia: primero los fijos, luego los configurables */}
      {isGerencia ? (
        <>
          {/* KPIs FIJOS para gerencia - Primero */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Máquinas - SIEMPRE VISIBLE */}
            <StatCard
              title="Total Máquinas"
              value={stats.totalMachines}
              icon={Package}
              color="blue"
              trend={{ value: 12, isPositive: true }}
            />
            {/* Subastas Ganadas - SIEMPRE VISIBLE */}
            <StatCard
              title="Subastas Ganadas"
              value={stats.wonAuctions}
              icon={CheckCircle}
              color="green"
            />
            {/* Subastas Pendientes - SIEMPRE VISIBLE */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500 rounded-lg">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-700">Subastas Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-900">{stats.pendingAuctions}</p>
                </div>
              </div>
            </motion.div>
            {/* Pendiente - SIEMPRE VISIBLE (usando pendingAuctions como referencia) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-lg">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-700">Pendiente</p>
                  <p className="text-2xl font-bold text-amber-900">{stats.pendingAuctions}</p>
                </div>
              </div>
            </motion.div>
          </div>
          
          {/* KPIs CONFIGURABLES para gerencia - Después */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Inversión Total - CONFIGURABLE */}
            {chartVisibility.inversionTotal && (
              <StatCard
                title="Inversión Total"
                value={`$${(stats.totalInvestment / 1000).toFixed(0)}K`}
                icon={DollarSign}
                color="purple"
                trend={{ value: 8, isPositive: true }}
              />
            )}
            {/* Precio Promedio - CONFIGURABLE */}
            {chartVisibility.precioPromedio && (
              <StatCard
                title="Precio Promedio"
                value={`$${(stats.averagePrice / 1000).toFixed(0)}K`}
                icon={TrendingUp}
                color="yellow"
              />
            )}
          </div>
        </>
      ) : (
        /* Para otros usuarios: orden normal */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Máquinas - SIEMPRE VISIBLE */}
          <StatCard
            title="Total Máquinas"
            value={stats.totalMachines}
            icon={Package}
            color="blue"
            trend={{ value: 12, isPositive: true }}
          />
          {/* Subastas Ganadas - SIEMPRE VISIBLE */}
          <StatCard
            title="Subastas Ganadas"
            value={stats.wonAuctions}
            icon={CheckCircle}
            color="green"
          />
          {/* Inversión Total - CONFIGURABLE */}
          {(!isGerencia || chartVisibility.inversionTotal) && (
            <StatCard
              title="Inversión Total"
              value={`$${(stats.totalInvestment / 1000).toFixed(0)}K`}
              icon={DollarSign}
              color="purple"
              trend={{ value: 8, isPositive: true }}
            />
          )}
          {/* Precio Promedio - CONFIGURABLE */}
          {(!isGerencia || chartVisibility.precioPromedio) && (
            <StatCard
              title="Precio Promedio"
              value={`$${(stats.averagePrice / 1000).toFixed(0)}K`}
              icon={TrendingUp}
              color="yellow"
            />
          )}
        </div>
      )}

      {/* Charts Section */}
      {((!isGerencia || chartVisibility.evolucionSubastas) || (!isGerencia || chartVisibility.distribucionEstado)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart - Evolución Mensual - CONFIGURABLE */}
          {(!isGerencia || chartVisibility.evolucionSubastas) && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Evolución de Subastas
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Bar dataKey="subastas" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="ganadas" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600">Total Subastas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">Ganadas</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Pie Chart - Estado de Subastas - CONFIGURABLE */}
          {(!isGerencia || chartVisibility.distribucionEstado) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Distribución por Estado
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={auctionStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={(props: any) => {
                      const percent = props.percent ?? 0;
                      const name = props.name ?? '';
                      return `${name} ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {auctionStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4 text-sm">
                {auctionStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-600">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tasa de Éxito - CONFIGURABLE */}
          {(!isGerencia || chartVisibility.tasaExito) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700">Tasa de Éxito</p>
                  <p className="text-2xl font-bold text-green-900">
                    {stats.totalAuctions > 0 
                      ? Math.round((stats.wonAuctions / stats.totalAuctions) * 100) 
                      : 0}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* En Proceso (Subastas Pendientes) - SIEMPRE VISIBLE para no gerencia, oculto para gerencia (ya está en KPIs fijos) */}
          {!isGerencia && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500 rounded-lg">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-700">Subastas Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-900">{stats.pendingAuctions}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* No Ganadas - CONFIGURABLE */}
          {(!isGerencia || chartVisibility.noGanadas) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500 rounded-lg">
                  <XCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700">No Ganadas</p>
                  <p className="text-2xl font-bold text-red-900">{stats.lostAuctions}</p>
                </div>
              </div>
            </motion.div>
          )}
      </div>
    </div>
  );
};

