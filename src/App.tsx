import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { AuctionsPage } from './pages/AuctionsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { ManagementPage } from './pages/ManagementPage';
import { ImportationsPage } from './pages/ImportationsPage';
import { LogisticsPage } from './pages/LogisticsPage';
import { EquipmentsPage } from './pages/EquipmentsPage';
import { ServicePage } from './pages/ServicePage';
import { Navigation } from './organisms/Navigation';
import { Spinner } from './atoms/Spinner';
import { ToastContainer } from './components/Toast';

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
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      {children}
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
