/**
 * Tarjeta de Estadísticas - Componente Premium
 */

import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  loading?: boolean;
}

const colorClasses = {
  blue: {
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    icon: 'bg-blue-100 text-blue-600',
    trend: 'text-blue-600',
  },
  green: {
    bg: 'bg-gradient-to-br from-green-500 to-green-600',
    icon: 'bg-green-100 text-green-600',
    trend: 'text-green-600',
  },
  yellow: {
    bg: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
    icon: 'bg-yellow-100 text-yellow-600',
    trend: 'text-yellow-600',
  },
  red: {
    bg: 'bg-gradient-to-br from-red-500 to-red-600',
    icon: 'bg-red-100 text-red-600',
    trend: 'text-red-600',
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
    icon: 'bg-purple-100 text-purple-600',
    trend: 'text-purple-600',
  },
};

export const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = 'blue',
  loading = false 
}: StatCardProps) => {
  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-lg ${colors.icon}`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-sm font-medium ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          {loading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse w-24"></div>
          ) : (
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          )}
        </div>
      </div>
      
      <div className={`h-1 ${colors.bg}`}></div>
    </motion.div>
  );
};

