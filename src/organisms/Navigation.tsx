/**
 * Navegación Premium - Diseño Empresarial
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Gavel, ShoppingCart, BarChart3, Bell, LogOut, User, Package, Truck, Wrench, ClipboardCheck, ChevronDown, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../atoms/Button';
import { UserRole } from '../types/database';
import { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationCenter } from '../components/NotificationCenter';

export const Navigation = () => {
  const { userProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  // Hook de notificaciones
  const {
    notifications,
    unreadCount,
    moduleCounts,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh
  } = useNotifications();

  const isActive = (path: string) => location.pathname === path;

  // Obtener módulo desde el path
  const getModuleFromPath = (path: string): string => {
    const moduleMap: { [key: string]: string } = {
      '/preselection': 'preselection',
      '/auctions': 'auctions',
      '/purchases': 'purchases',
      '/new-purchases': 'new_purchases',
      '/pagos': 'pagos',
      '/importations': 'importations',
      '/logistics': 'logistics',
      '/service': 'service',
      '/equipments': 'equipments',
      '/management': 'management'
    };
    return moduleMap[path] || '';
  };

  // Obtener contador de notificaciones para un módulo
  const getModuleBadgeCount = (path: string): number => {
    const module = getModuleFromPath(path);
    if (!module) return 0;
    const moduleData = moduleCounts.find(m => m.module_target === module);
    return moduleData?.unread || 0;
  };

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

    // Eliana: Compras y Pagos
    if (userProfile.role === 'eliana') {
      items.push({ path: '/purchases', label: 'Compras', icon: ShoppingCart });
      items.push({ path: '/pagos', label: 'Pagos', icon: Package });
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

    // Jefe Comercial: Compras Nuevos y Equipos
    if (userProfile.role === 'jefe_comercial') {
      items.push({ path: '/new-purchases', label: 'Compras Nuevos', icon: Package });
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
            { path: '/new-purchases', label: 'Compras Nuevos', icon: Package },
            { path: '/pagos', label: 'Pagos', icon: Package },
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
        },
        {
          category: 'Administración',
          items: [
            { path: '/notification-rules', label: 'Reglas de Notificación', icon: Bell },
            { path: '/admin/import-prices', label: 'Importar Históricos', icon: Database },
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
            { path: '/new-purchases', label: 'Compras Nuevos', icon: Package },
            { path: '/management', label: 'Consolidado', icon: BarChart3 },
          ]
        }
      ];
    }

    // Jefe Comercial: Compras Nuevos y Equipos
    if (userProfile.role === 'jefe_comercial') {
      return [
        {
          category: 'Gestión Comercial',
          items: [
            { path: '/new-purchases', label: 'Compras Nuevos', icon: Package },
          ]
        },
        {
          category: 'Inventario',
          items: [
            { path: '/equipments', label: 'Equipos', icon: Package },
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
    <>
    <nav className="bg-white shadow-xl border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center p-1 bg-white rounded-xl shadow-lg group-hover:shadow-xl transition">
              <img 
                src="https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png" 
                alt="Logo" 
                className="h-12 w-auto object-contain"
              />
            </div>
            <div className="hidden lg:block overflow-hidden" style={{ width: '280px' }}>
              <h1 className="text-2xl font-bold text-brand-red tracking-tight whitespace-nowrap animate-slide">
                Flexi Maquinaria
              </h1>
              <p className="text-xs text-brand-gray">Sistema de Gestión</p>
            </div>
            <style>{`
              @keyframes slide {
                0% { transform: translateX(-100%); }
                50% { transform: translateX(0%); }
                100% { transform: translateX(100%); }
              }
              .animate-slide {
                animation: slide 8s ease-in-out infinite;
              }
            `}</style>
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
                                const badgeCount = getModuleBadgeCount(item.path);
                                return (
                                  <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setDropdownOpen(false)}
                                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-all ${
                                      isActive(item.path)
                                        ? 'bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md'
                                        : 'text-brand-gray hover:bg-red-50 hover:text-brand-red'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Icon className="w-5 h-5" />
                                      <span className="text-sm font-medium">{item.label}</span>
                                    </div>
                                    {badgeCount > 0 && (
                                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                                        isActive(item.path)
                                          ? 'bg-white text-brand-red'
                                          : 'bg-red-600 text-white'
                                      }`}>
                                        {badgeCount}
                                      </span>
                                    )}
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
                  const badgeCount = getModuleBadgeCount(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all relative ${
                        isActive(item.path)
                          ? 'bg-red-50 text-brand-red font-semibold shadow-sm'
                          : 'text-brand-gray hover:bg-gray-50 hover:text-brand-red'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white">
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button 
              onClick={() => setNotificationPanelOpen(true)}
              className="relative p-2.5 text-brand-gray hover:bg-red-50 hover:text-brand-red rounded-xl transition"
              title={`${unreadCount} notificaciones sin leer`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 border-2 border-white animate-pulse shadow-lg">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
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

      {/* Centro de Notificaciones */}
      <NotificationCenter
        isOpen={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onRefresh={refresh}
      />
    </>
  );
};
