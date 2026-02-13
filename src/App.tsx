import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { PreselectionPage } from './pages/PreselectionPage';
import { AuctionsPage } from './pages/AuctionsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { NewPurchasesPage } from './pages/NewPurchasesPage';
import PagosPage from './pages/PagosPage';
import { ManagementPage } from './pages/ManagementPage';
import { ImportationsPage } from './pages/ImportationsPage';
import { LogisticsPage } from './pages/LogisticsPage';
import { ImportPricesPage } from './pages/ImportPricesPage';
import { EquipmentsPage } from './pages/EquipmentsPage';
import { ServicePage } from './pages/ServicePage';
import { NotificationRulesPage } from './pages/NotificationRulesPage';
import { Navigation } from './organisms/Navigation';
import { Spinner } from './atoms/Spinner';
import { ToastContainer } from './components/Toast';
import { useWebSocket } from './hooks/useWebSocket';
import { useAutoLogout } from './hooks/useAutoLogout';

const LGARCIA_EMAIL = 'lgarcia@partequipos.com';

const NewPurchasesGuard = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isRestricted = userProfile?.email?.toLowerCase() === LGARCIA_EMAIL;

  useEffect(() => {
    if (userProfile && isRestricted) {
      navigate('/equipments', { replace: true });
    }
  }, [userProfile, isRestricted, navigate]);

  if (isRestricted) return null;
  return (
    <AppLayout>
      <NewPurchasesPage />
    </AppLayout>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  // Conectar WebSocket para notificaciones en tiempo real
  const { isConnected } = useWebSocket();
  
  // Cerrar sesión automáticamente después de 30 minutos de inactividad
  useAutoLogout();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="flex-shrink-0">
        <Navigation />
      </header>
      {/* Contenedor con scroll propio: evita que el contenido expandido (p. ej. preselección) solape el nav */}
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {children}
      </main>
      {/* Indicador de conexión WebSocket (opcional) */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {isConnected ? '🟢 WebSocket' : '⚪ WebSocket'}
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastContainer />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <HomePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/preselection"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PreselectionPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/auctions"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AuctionsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchases"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PurchasesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/new-purchases"
            element={
              <ProtectedRoute>
                <NewPurchasesGuard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pagos"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PagosPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/management"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ManagementPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/importations"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ImportationsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/logistics"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <LogisticsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/equipments"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <EquipmentsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/service"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ServicePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notification-rules"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <NotificationRulesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/import-prices"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ImportPricesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
