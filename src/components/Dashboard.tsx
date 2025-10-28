/**
 * Dashboard Ejecutivo Premium
 * Vista general con KPIs y estadísticas
 */

import { TrendingUp, DollarSign, Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import { StatCard } from './StatCard';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
  auctions?: any[];
}

const COLORS = {
  ganada: '#10b981',
  perdida: '#ef4444',
  pendiente: '#f59e0b',
};

export const Dashboard = ({ stats, auctions = [] }: DashboardProps) => {
  const auctionStatusData = [
    { name: 'Ganadas', value: stats.wonAuctions, color: COLORS.ganada },
    { name: 'Perdidas', value: stats.lostAuctions, color: COLORS.perdida },
    { name: 'Pendientes', value: stats.pendingAuctions, color: COLORS.pendiente },
  ];

  // Generar datos mensuales reales desde las subastas
  const generateMonthlyData = () => {
    const currentDate = new Date();
    const last6Months = [];
    
    // Obtener los últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const mes = date.toLocaleDateString('es-CO', { month: 'short' });
      last6Months.push({ mes, date, subastas: 0, ganadas: 0 });
    }
    
    // Contar subastas por mes
    auctions.forEach(auction => {
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
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-2xl p-4 md:p-6 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Panel de Control Ejecutivo</h1>
            <p className="text-blue-100 text-sm">Sistema de Gestión de Maquinaria Usada</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs text-blue-100">Última actualización</p>
            <p className="text-sm font-semibold">{new Date().toLocaleDateString('es-CO', { 
              day: 'numeric', 
              month: 'short', 
              year: 'numeric' 
            })}</p>
          </div>
        </div>
      </motion.div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Máquinas"
          value={stats.totalMachines}
          icon={Package}
          color="blue"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Subastas Ganadas"
          value={stats.wonAuctions}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Inversión Total"
          value={`$${(stats.totalInvestment / 1000).toFixed(0)}K`}
          icon={DollarSign}
          color="purple"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Precio Promedio"
          value={`$${(stats.averagePrice / 1000).toFixed(0)}K`}
          icon={TrendingUp}
          color="yellow"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Evolución Mensual */}
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

        {/* Pie Chart - Estado de Subastas */}
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
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <p className="text-sm font-medium text-yellow-700">En Proceso</p>
              <p className="text-2xl font-bold text-yellow-900">{stats.pendingAuctions}</p>
            </div>
          </div>
        </motion.div>

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
      </div>
    </div>
  );
};

