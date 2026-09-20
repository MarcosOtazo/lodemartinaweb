import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/utils';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const { signIn, signUp, loading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error);
      } else {
        toast.success('¡Bienvenido de nuevo!');
        navigate(from, { replace: true });
      }
    } else {
      if (!fullName.trim()) {
        toast.error('Ingresá tu nombre');
        return;
      }
      const { error } = await signUp(email, password, fullName, phone);
      if (error) {
        toast.error(error);
      } else {
        toast.success('¡Cuenta creada! Ya podés hacer pedidos');
        navigate(from, { replace: true });
      }
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h1>
          <p className="text-gray-500 mt-2">
            {mode === 'login'
              ? 'Ingresá para hacer pedidos y ver tu historial'
              : 'Registrate para hacer pedidos más rápido'}
          </p>
        </div>

        <div className="card p-6">
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              onClick={() => setMode('login')}
              className={cn(
                'flex-1 py-2 rounded-md text-sm font-semibold transition-colors',
                mode === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              )}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setMode('register')}
              className={cn(
                'flex-1 py-2 rounded-md text-sm font-semibold transition-colors',
                mode === 'register' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              )}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="label" htmlFor="fullName">Nombre completo</label>
                  <input
                    id="fullName"
                    type="text"
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Martina Gómez"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Teléfono (opcional)</label>
                  <input
                    id="phone"
                    type="tel"
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 11 1234 5678"
                  />
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@email.com"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Procesando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
            {mode === 'login' && (
              <Link
                to="/recuperar"
                className="block text-center text-sm text-gray-500 hover:text-primary transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          {mode === 'login' ? (
            <>
              ¿No tenés cuenta?{' '}
              <Link to="/registro" className="text-primary font-semibold hover:underline">
                Registrate acá
              </Link>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Ingresá acá
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
