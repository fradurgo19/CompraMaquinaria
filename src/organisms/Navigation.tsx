/**
 * Navegación Premium - Diseño Empresarial
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Gavel, ShoppingCart, BarChart3, Bell, LogOut, User, Package, Truck, Wrench, ClipboardCheck, ChevronDown, Database, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../atoms/Button';
import { UserRole } from '../types/database';
import { useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationCenter } from '../components/NotificationCenter';

export const Navigation = () => {
  const { userProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

    // Eliana: Solo Compras
    if (userProfile.role === 'eliana') {
      items.push({ path: '/purchases', label: 'Compras', icon: ShoppingCart });
    }

    // Pagos: Solo Pagos
    if (userProfile.role === 'pagos') {
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

    // Gerencia: Ve TODO (Preselección, Subastas, Compras, Pagos, Consolidado)
    if (userProfile.role === 'gerencia') {
      items.push({ path: '/preselection', label: 'Preselección', icon: ClipboardCheck });
      items.push({ path: '/auctions', label: 'Subastas - BID', icon: Gavel });
      items.push({ path: '/purchases', label: 'Logística Origen', icon: ShoppingCart });
      items.push({ path: '/pagos', label: 'Pagos', icon: Package });
      items.push({ path: '/management', label: 'Consolidado - CD', icon: BarChart3 });
    }

    // Admin: Ve TODO
    if (userProfile.role === 'admin') {
      items.push({ path: '/preselection', label: 'Preselección', icon: ClipboardCheck });
      items.push({ path: '/auctions', label: 'Subastas - BID', icon: Gavel });
      items.push({ path: '/purchases', label: 'Logística Origen', icon: ShoppingCart });
      items.push({ path: '/pagos', label: 'Pagos', icon: Package });
      items.push({ path: '/management', label: 'Consolidado - CD', icon: BarChart3 });
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
            { path: '/auctions', label: 'Subastas - BID', icon: Gavel },
            { path: '/purchases', label: 'Logística Origen', icon: ShoppingCart },
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
            { path: '/management', label: 'Consolidado - CD', icon: BarChart3 },
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
            { path: '/auctions', label: '1. Subastas - BID', icon: Gavel },
            { path: '/purchases', label: '2. Logística Origen', icon: ShoppingCart },
            { path: '/management', label: '3. Consolidado - CD', icon: BarChart3 },
          ]
        },
        {
          category: 'Otros',
          items: [
            { path: '/new-purchases', label: 'Compras Nuevos', icon: Package },
            { path: '/equipments', label: 'Equipos', icon: Wrench },
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

    // Sebastian: Preselección, Subastas y Compras
    if (userProfile.role === 'sebastian') {
      return [
        {
          category: 'Módulos',
          items: [
            { path: '/preselection', label: 'Preselección', icon: ClipboardCheck },
            { path: '/auctions', label: 'Subastas', icon: Gavel },
            { path: '/purchases', label: 'Compras', icon: ShoppingCart },
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
    pagos: 'from-brand-red to-primary-600',
  };

  const roleColor = roleColors[userProfile?.role || 'admin'];

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevenir scroll del body cuando el menú móvil está abierto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
    <nav className="bg-white shadow-xl border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo y Menú Hamburguesa */}
          <div className="flex items-center gap-3">
            {/* Botón Menú Hamburguesa (solo móvil) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-brand-gray hover:bg-red-50 hover:text-brand-red rounded-xl transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            <Link to="/" className="flex items-center gap-3 group" onClick={() => setMobileMenuOpen(false)}>
              <div className="flex items-center justify-center p-1 bg-white rounded-xl shadow-lg group-hover:shadow-xl transition">
                <img 
                  src="https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png" 
                  alt="Logo" 
                  className="h-12 w-auto object-contain"
                />
              </div>
              <div className="hidden sm:block overflow-hidden">
                <h1 className="text-xl sm:text-2xl font-bold text-brand-red tracking-tight whitespace-nowrap">
                  Flexi Maquinaria
                </h1>
                <p className="text-xs text-brand-gray hidden lg:block">Sistema de Gestión</p>
              </div>
            </Link>
          </div>

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
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all text-white font-semibold ${
                    dropdownOpen
                      ? 'bg-red-700 shadow-lg'
                      : 'bg-red-600 hover:bg-red-700 hover:text-white shadow-md'
                  }`}
                  style={{ 
                    width: '125%',
                    fontSize: '1.25em'
                  }}
                >
                  <BarChart3 className="w-6 h-6" />
                  <span>Módulos</span>
                  <ChevronDown className={`w-5 h-5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
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
            <div className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 bg-gradient-to-r ${roleColor} rounded-xl text-white shadow-lg`}>
              <div className="hidden sm:block text-right">
                <p className="text-xs sm:text-sm font-semibold">{userProfile?.full_name}</p>
                <p className="text-xs opacity-90 capitalize hidden md:block">{userProfile?.role}</p>
              </div>
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
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

      {/* Menú Móvil - Sidebar */}
      {mobileMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-in-out overflow-y-auto">
            <div className="p-6">
              {/* Header del Sidebar */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-brand-red to-primary-600 rounded-xl">
                    <img 
                      src="https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png" 
                      alt="Logo" 
                      className="h-8 w-auto object-contain"
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-brand-red">Flexi Maquinaria</h2>
                    <p className="text-xs text-brand-gray">Sistema de Gestión</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Información del Usuario */}
              <div className={`mb-6 p-4 bg-gradient-to-r ${roleColor} rounded-xl text-white`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{userProfile?.full_name}</p>
                    <p className="text-xs opacity-90 capitalize">{userProfile?.role}</p>
                  </div>
                </div>
              </div>

              {/* Navegación */}
              <div className="space-y-2">
                {/* Inicio */}
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive('/')
                      ? 'bg-red-50 text-brand-red font-semibold shadow-sm'
                      : 'text-brand-gray hover:bg-gray-50 hover:text-brand-red'
                  }`}
                >
                  <Home className="w-5 h-5" />
                  <span>Inicio</span>
                </Link>

                {/* Menú con categorías o items simples */}
                {useDropdown ? (
                  menuCategories.map((category) => (
                    <div key={category.category} className="mt-4">
                      <h3 className="text-xs font-bold text-brand-gray uppercase tracking-wider px-4 mb-2">
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
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${
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
                  ))
                ) : (
                  navItems.map((item) => {
                    const Icon = item.icon;
                    const badgeCount = getModuleBadgeCount(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${
                          isActive(item.path)
                            ? 'bg-red-50 text-brand-red font-semibold shadow-sm'
                            : 'text-brand-gray hover:bg-gray-50 hover:text-brand-red'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          <span>{item.label}</span>
                        </div>
                        {badgeCount > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white">
                            {badgeCount}
                          </span>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>

              {/* Botón Salir en móvil */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 hover:border-brand-red hover:bg-red-50 hover:text-brand-red rounded-xl transition text-brand-gray font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Salir</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
