import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/auth';
import { useConfigStore } from './store/config';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Checkout from './pages/Checkout';
import MyOrders from './pages/MyOrders';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import AdminSales from './pages/admin/Sales';
import AdminUsers from './pages/admin/Users';
import AdminSettings from './pages/admin/Settings';

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, initializing } = useAuthStore();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser);
  const loadConfig = useConfigStore((s) => s.loadConfig);

  useEffect(() => {
    loadUser();
    loadConfig();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadUser();
      else loadUser();
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadUser, loadConfig]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '12px', fontWeight: 500 },
        }}
      />
      <Routes>
        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="productos" element={<AdminProducts />} />
          <Route path="ventas" element={<AdminSales />} />
          <Route path="clientes" element={<AdminUsers />} />
          <Route path="configuracion" element={<AdminSettings />} />
        </Route>

        {/* Público */}
        <Route
          path="/"
          element={
            <PublicLayout>
              <Home />
            </PublicLayout>
          }
        />
        <Route
          path="/menu"
          element={
            <PublicLayout>
              <Menu />
            </PublicLayout>
          }
        />
        <Route
          path="/checkout"
          element={
            <PublicLayout>
              <Checkout />
            </PublicLayout>
          }
        />
        <Route
          path="/pedidos"
          element={
            <PublicLayout>
              <ProtectedRoute>
                <MyOrders />
              </ProtectedRoute>
            </PublicLayout>
          }
        />
        <Route
          path="/login"
          element={
            <PublicLayout>
              <Login />
            </PublicLayout>
          }
        />
        <Route
          path="/registro"
          element={
            <PublicLayout>
              <Login />
            </PublicLayout>
          }
        />
        <Route
          path="/recuperar"
          element={
            <PublicLayout>
              <ResetPassword />
            </PublicLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
