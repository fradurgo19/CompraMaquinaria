/**
 * Navegación Premium - Diseño Empresarial
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Gavel, ShoppingCart, BarChart3, Bell, LogOut, User, Package, Truck, Wrench, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../atoms/Button';
import { UserRole } from '../types/database';

export const Navigation = () => {
  const { userProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getNavItems = () => {
    if (!userProfile) return [];

    const items = [];

    // Sebastián: Preselección y Subastas
    if (userProfile.role === 'sebastian') {
      items.push({ path: '/preselection', label: 'Preselección', icon: ClipboardCheck });
      items.push({ path: '/auctions', label: 'Subastas', icon: Gavel });
    }

    // Eliana: Solo Compras
    if (userProfile.role === 'eliana') {
      items.push({ path: '/purchases', label: 'Compras', icon: ShoppingCart });
    }

    // Importaciones: Solo Importaciones
    if (userProfile.role === 'importaciones') {
      items.push({ path: '/importations', label: 'Importaciones', icon: Package });
    }

    // Logística: Solo Logística
    if (userProfile.role === 'logistica') {
      items.push({ path: '/logistics', label: 'Logística', icon: Truck });
    }

    // Servicio: Solo Servicio
    if (userProfile.role === 'servicio') {
      items.push({ path: '/service', label: 'Servicio', icon: Wrench });
    }

    // Comerciales: Solo Equipos
    if (userProfile.role === 'comerciales') {
      items.push({ path: '/equipments', label: 'Equipos', icon: Wrench });
    }

    // Jefe Comercial: Solo Equipos
    if (userProfile.role === 'jefe_comercial') {
      items.push({ path: '/equipments', label: 'Equipos', icon: Wrench });
    }

    // Gerencia: Ve TODO (Preselección, Subastas, Compras, Consolidado)
    if (userProfile.role === 'gerencia') {
      items.push({ path: '/preselection', label: 'Preselección', icon: ClipboardCheck });
      items.push({ path: '/auctions', label: 'Subastas', icon: Gavel });
      items.push({ path: '/purchases', label: 'Compras', icon: ShoppingCart });
      items.push({ path: '/management', label: 'Consolidado', icon: BarChart3 });
    }

    // Admin: Acceso completo
    if (userProfile.role === 'admin') {
      items.push({ path: '/preselection', label: 'Preselección', icon: ClipboardCheck });
      items.push({ path: '/auctions', label: 'Subastas', icon: Gavel });
      items.push({ path: '/purchases', label: 'Compras', icon: ShoppingCart });
      items.push({ path: '/management', label: 'Consolidado', icon: BarChart3 });
    }

    return items;
  };

  const navItems = getNavItems();

  const roleColors: Record<UserRole, string> = {
    sebastian: 'from-blue-500 to-blue-600',
    eliana: 'from-purple-500 to-purple-600',
    gerencia: 'from-indigo-500 to-indigo-600',
    admin: 'from-gray-600 to-gray-700',
    importaciones: 'from-green-500 to-green-600',
    logistica: 'from-orange-500 to-orange-600',
    comerciales: 'from-teal-500 to-teal-600',
    jefe_comercial: 'from-cyan-500 to-cyan-600',
    servicio: 'from-teal-600 to-teal-700',
  };

  const roleColor = roleColors[userProfile?.role || 'admin'];

  return (
    <nav className="bg-white shadow-xl border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <div className="flex items-center justify-center p-1 bg-white rounded-xl shadow-lg group-hover:shadow-xl transition">
              <img 
                src="https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png" 
                alt="Logo" 
                className="h-12 w-auto object-contain"
              />
            </div>
          </Link>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                isActive('/')
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>Inicio</span>
            </Link>

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="relative p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            {/* User Profile */}
            <div className={`flex items-center gap-3 px-4 py-2 bg-gradient-to-r ${roleColor} rounded-xl text-white shadow-lg`}>
              <div className="hidden md:block text-right">
                <p className="text-sm font-semibold">{userProfile?.full_name}</p>
                <p className="text-xs opacity-90 capitalize">{userProfile?.role}</p>
              </div>
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <User className="w-5 h-5" />
              </div>
            </div>

            {/* Logout */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2 border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Salir</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
