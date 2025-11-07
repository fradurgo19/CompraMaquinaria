/**
 * Página de Inicio - Dashboard Ejecutivo Premium
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Dashboard } from '../components/Dashboard';
import { motion } from 'framer-motion';
import { apiGet } from '../services/api';
import { Gavel, ShoppingCart, BarChart3, TrendingUp, Package, DollarSign, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HomePage = () => {
  const { userProfile } = useAuth();
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

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          description: 'Administra compras, pagos, costos y envíos',
          gradient: 'from-brand-red via-primary-700 to-brand-gray',
          icon: ShoppingCart,
          mainLink: '/purchases',
        };
      case 'gerencia':
        return {
          title: 'Panel Ejecutivo',
          subtitle: 'Gerencia',
          description: 'Vista completa: subastas, compras y consolidado financiero',
          gradient: 'from-brand-gray via-secondary-600 to-brand-gray',
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

        {/* Dashboard para roles con acceso a subastas */}
        {!loading && (userProfile?.role === 'sebastian' || userProfile?.role === 'gerencia' || userProfile?.role === 'admin') && (
          <Dashboard stats={stats} auctions={auctions} />
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
