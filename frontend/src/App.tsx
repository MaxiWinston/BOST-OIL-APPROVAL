import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { OrderProvider } from './context/OrderContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/Admin/Dashboard/Dashboard';
import { AdminOrders } from './pages/Admin/Orders';
import { AdminUsers } from './pages/Admin/Users';
import { SignOffDashboard } from './pages/SignOff/Dashboard';
import { LoadingDockDashboard } from './pages/LoadingDock/Dashboard';
import { TvDisplay } from './pages/LoadingDock/TvDisplay';

function App() {
  return (
    <Router>
      <AuthProvider>
        <OrderProvider>
          <Toaster richColors position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Stage 4 - Public & Kiosk TV Bay Monitor (9-squared Display) */}
            <Route path="/tv-display" element={<TvDisplay />} />
            <Route path="/loadingdock/tv" element={<TvDisplay />} />

            {/* Stage 2 - BOST depot manager */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <AdminOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />

            {/* Stage 3 - Customs */}
            <Route
              path="/signoff/dashboard"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMS_OFFICER']}>
                  <SignOffDashboard />
                </ProtectedRoute>
              }
            />

            {/* Stage 4 - Loading bay */}
            <Route
              path="/loadingdock/dashboard"
              element={
                <ProtectedRoute allowedRoles={['DEPOT_OPERATOR']}>
                  <LoadingDockDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </OrderProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
