import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setHasRecoverySession(!!data.session);
        setChecking(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasRecoverySession(true);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Ingresá tu email');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/recuperar`,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes('rate') || error.message.includes('limit')
          ? 'Esperá unos minutos antes de volver a intentar'
          : 'No pudimos enviar el correo. Revisá el email ingresado.'
      );
    } else {
      toast.success('Te enviamos un correo con el link para cambiar tu contraseña');
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error('No pudimos guardar la contraseña. Volvé a usar el link del correo.');
    } else {
      toast.success('¡Contraseña actualizada!');
      await loadUser();
      navigate('/');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {hasRecoverySession ? 'Elegí tu nueva contraseña' : 'Recuperar contraseña'}
          </h1>
          <p className="text-gray-500 mt-2">
            {hasRecoverySession
              ? 'Ingresá una contraseña nueva para tu cuenta'
              : 'Te enviamos un link por email para que elijas una nueva'}
          </p>
        </div>

        <div className="card p-6">
          {checking ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          ) : hasRecoverySession ? (
            <form onSubmit={savePassword} className="space-y-4">
              <div>
                <label className="label" htmlFor="password">Nueva contraseña</label>
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
              <div>
                <label className="label" htmlFor="confirm">Repetí la contraseña</label>
                <input
                  id="confirm"
                  type="password"
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="La misma de arriba"
                  minLength={6}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          ) : (
            <form onSubmit={sendEmail} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">Tu email</label>
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
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link de recuperación'}
              </button>
              <p className="text-sm text-gray-500 text-center">
                Revisá tu correo (también la carpeta de spam) después de enviar.
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿Ya la recordaste?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Volvé a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
