import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, User, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useCartStore } from '../store/cart';
import { useConfigStore } from '../store/config';
import { cn } from '../lib/utils';
import CartDrawer from './CartDrawer';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const count = useCartStore((s) => s.count());
  const config = useConfigStore((s) => s.config);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    navigate('/');
  };

  const navLinks = [
    { to: '/', label: 'Inicio' },
    { to: '/menu', label: 'Menú' },
    { to: '/pedidos', label: 'Mis Pedidos' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="container-main flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.site_name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white text-lg font-bold">
                {config.site_name.charAt(0)}
              </span>
            )}
            <span className="text-xl font-extrabold tracking-tight text-gray-900">
              {config.site_name}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Carrito"
            >
              <ShoppingBag className="h-6 w-6 text-gray-700" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                  {count}
                </span>
              )}
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-white text-sm font-bold">
                    {(user.full_name || user.email).charAt(0).toUpperCase()}
                  </div>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-lg border border-gray-100 py-1 z-50">
                     <div className="px-4 py-2 border-b border-gray-100">
                       <p className="text-sm font-semibold truncate">{user.full_name || user.email}</p>
                       <p className="text-xs text-gray-500 truncate">{user.email}</p>
                       {user.client_number && (
                         <p className="text-xs text-primary font-semibold mt-1">
                           N.º cliente: {user.client_number}
                         </p>
                       )}
                     </div>
                    <Link
                      to="/pedidos"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <User className="h-4 w-4" /> Mis pedidos
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <LayoutDashboard className="h-4 w-4" /> Panel Admin
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className={cn('btn-primary hidden sm:inline-flex')}
              >
                Iniciar sesión
              </Link>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-full hover:bg-gray-100"
              aria-label="Menú"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {link.label}
              </Link>
            ))}
            {!user && (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary-light"
              >
                Iniciar sesión
              </Link>
            )}
          </nav>
        )}
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
