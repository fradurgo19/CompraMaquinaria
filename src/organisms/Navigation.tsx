/**
 * Navegación Premium - Diseño Empresarial
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Gavel, ShoppingCart, BarChart3, Bell, LogOut, User, Package, Truck, Wrench, ClipboardCheck, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../atoms/Button';
import { UserRole } from '../types/database';
import { useState } from 'react';

export const Navigation = () => {
  const { userProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

    return items;
  };

  // Menú categorizado según rol
  const getMenuCategories = () => {
    if (!userProfile) return [];

    // Admin: Todos los módulos
    if (userProfile.role === 'admin') {
      return [
        {
          category: 'Gestión Comercial',
          items: [
            { path: '/preselection', label: 'Preselección', icon: ClipboardCheck },
            { path: '/auctions', label: 'Subastas', icon: Gavel },
            { path: '/purchases', label: 'Compras', icon: ShoppingCart },
          ]
        },
        {
          category: 'Operaciones',
          items: [
            { path: '/importations', label: 'Importaciones', icon: Package },
            { path: '/logistics', label: 'Logística', icon: Truck },
            { path: '/service', label: 'Servicio', icon: Wrench },
          ]
        },
        {
          category: 'Inventario',
          items: [
            { path: '/equipments', label: 'Equipos', icon: Package },
            { path: '/management', label: 'Consolidado', icon: BarChart3 },
          ]
        }
      ];
    }

    // Gerencia: Gestión Comercial
    if (userProfile.role === 'gerencia') {
      return [
        {
          category: 'Módulos',
          items: [
            { path: '/preselection', label: 'Preselección', icon: ClipboardCheck },
            { path: '/auctions', label: 'Subastas', icon: Gavel },
            { path: '/purchases', label: 'Compras', icon: ShoppingCart },
            { path: '/management', label: 'Consolidado', icon: BarChart3 },
          ]
        }
      ];
    }

    // Sebastian: Preselección y Subastas
    if (userProfile.role === 'sebastian') {
      return [
        {
          category: 'Módulos',
          items: [
            { path: '/preselection', label: 'Preselección', icon: ClipboardCheck },
            { path: '/auctions', label: 'Subastas', icon: Gavel },
          ]
        }
      ];
    }

    return [];
  };

  const navItems = getNavItems();
  const menuCategories = getMenuCategories();
  const useDropdown = menuCategories.length > 0;

  const roleColors: Record<UserRole, string> = {
    sebastian: 'from-brand-red to-primary-600',
    eliana: 'from-brand-red to-primary-700',
    gerencia: 'from-brand-gray to-secondary-600',
    admin: 'from-brand-gray to-secondary-700',
    importaciones: 'from-brand-red to-primary-600',
    logistica: 'from-brand-red to-primary-600',
    comerciales: 'from-brand-red to-primary-700',
    jefe_comercial: 'from-brand-gray to-secondary-600',
    servicio: 'from-brand-red to-primary-600',
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
                  ? 'bg-red-50 text-brand-red font-semibold shadow-sm'
                  : 'text-brand-gray hover:bg-gray-50 hover:text-brand-red'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>Inicio</span>
            </Link>

            {/* Menú Dropdown para usuarios con múltiples módulos */}
            {useDropdown ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                    dropdownOpen
                      ? 'bg-red-50 text-brand-red font-semibold shadow-sm'
                      : 'text-brand-gray hover:bg-gray-50 hover:text-brand-red'
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Módulos</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <>
                    {/* Overlay para cerrar dropdown */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDropdownOpen(false)}
                    />
                    
                    {/* Dropdown Content */}
                    <div className={`absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-20 ${
                      menuCategories.length > 1 ? 'min-w-[600px]' : 'min-w-[280px]'
                    }`}>
                      <div className={`grid ${menuCategories.length > 1 ? 'grid-cols-3' : 'grid-cols-1'} gap-4 p-6`}>
                        {menuCategories.map((category) => (
                          <div key={category.category} className="space-y-3">
                            <h3 className="text-xs font-bold text-brand-gray uppercase tracking-wider border-b border-gray-200 pb-2">
                              {category.category}
                            </h3>
                            <div className="space-y-1">
                              {category.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                  <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setDropdownOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                                      isActive(item.path)
                                        ? 'bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md'
                                        : 'text-brand-gray hover:bg-red-50 hover:text-brand-red'
                                    }`}
                                  >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-sm font-medium">{item.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Menú normal para otros usuarios */
              <>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                        isActive(item.path)
                          ? 'bg-red-50 text-brand-red font-semibold shadow-sm'
                          : 'text-brand-gray hover:bg-gray-50 hover:text-brand-red'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="relative p-2.5 text-brand-gray hover:bg-red-50 hover:text-brand-red rounded-xl transition">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-brand-red rounded-full border-2 border-white"></span>
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
              className="flex items-center gap-2 border-2 border-gray-200 hover:border-brand-red hover:bg-red-50 hover:text-brand-red transition"
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
