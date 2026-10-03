import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { formatPrice, formatDate, cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth';
import type { User, UserRole } from '../../types';
import { Search, Users as UsersIcon } from 'lucide-react';

interface ClientRow extends User {
  orders_count: number;
  total_spent: number;
}

type RoleFilter = 'all' | UserRole;

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'client', label: 'Clientes' },
  { key: 'admin', label: 'Admins' },
];

export default function AdminUsers() {
  const currentUser = useAuthStore((s) => s.user);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadUsers = () => {
    setLoading(true);
    Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('user_id, total, status').limit(1000),
    ]).then(([profilesRes, ordersRes]) => {
      const orders = (ordersRes.data || []) as unknown as Array<{
        user_id: string | null;
        total: number;
        status: string;
      }>;
      const stats = new Map<string, { count: number; spent: number }>();
      orders.forEach((o) => {
        if (!o.user_id || o.status === 'cancelled') return;
        const cur = stats.get(o.user_id) || { count: 0, spent: 0 };
        cur.count++;
        cur.spent += Number(o.total);
        stats.set(o.user_id, cur);
      });

      const rows = ((profilesRes.data || []) as unknown as User[]).map((p) => ({
        ...p,
        orders_count: stats.get(p.id)?.count || 0,
        total_spent: stats.get(p.id)?.spent || 0,
      }));
      setClients(rows);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const adminCount = clients.filter((c) => c.role === 'admin').length;

  const changeRole = async (client: ClientRow, role: UserRole) => {
    if (client.role === role) return;

    if (currentUser && client.id === currentUser.id) {
      toast.error('No podés cambiar tu propio rol');
      return;
    }

    if (role === 'client' && client.role === 'admin' && adminCount <= 1) {
      toast.error('Debe quedar al menos un admin');
      return;
    }

    const confirmed = confirm(
      `¿Cambiar a ${client.full_name || client.email} a ${role === 'admin' ? 'admin' : 'cliente'}?`
    );
    if (!confirmed) return;

    setSavingId(client.id);
    const { error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', client.id);
    setSavingId(null);

    if (error) {
      toast.error(error.message || 'No se pudo cambiar el rol');
      return;
    }

    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, role } : c)));
    toast.success(
      `${client.full_name || client.email} ahora es ${role === 'admin' ? 'admin' : 'cliente'}`
    );
  };

  const filtered = clients.filter((c) => {
    if (roleFilter !== 'all' && c.role !== roleFilter) return false;
    const term = search.toLowerCase();
    return (
      (c.client_number ? String(c.client_number) : '').includes(search) ||
      (c.full_name || '').toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.phone || '').includes(search)
    );
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clientes y administradores</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por N.º, nombre, email o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg bg-gray-100 p-1 w-fit">
          {ROLE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setRoleFilter(filter.key)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-semibold transition-colors',
                roleFilter === filter.key ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="text-5xl block mb-3">👥</span>
          <p className="font-semibold">No hay usuarios para mostrar</p>
          <p className="text-sm text-gray-500 mt-1">
            Cuando alguien cree una cuenta en la web, va a aparecer acá
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-6 py-3 font-semibold text-gray-500">N.º cliente</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Usuario</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Rol</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Teléfono</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Registro</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Pedidos</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Total gastado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const isSelf = currentUser?.id === client.id;
                return (
                  <tr key={client.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 font-semibold text-primary">
                      {client.client_number || '—'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-primary font-bold">
                          {(client.full_name || client.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">
                            {client.full_name || 'Sin nombre'}
                            {isSelf && (
                              <span className="ml-2 text-xs font-semibold text-primary">(vos)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{client.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <select
                        className="input py-1.5 text-sm w-32"
                        value={client.role}
                        disabled={savingId === client.id || isSelf}
                        title={isSelf ? 'No podés cambiar tu propio rol' : 'Cambiar rol'}
                        onChange={(e) => changeRole(client, e.target.value as UserRole)}
                      >
                        <option value="client">Cliente</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{client.phone || '—'}</td>
                    <td className="px-6 py-3 text-gray-500">{formatDate(client.created_at)}</td>
                    <td className="px-6 py-3">
                      <span className="font-bold">{client.orders_count}</span>
                    </td>
                    <td className="px-6 py-3 font-bold text-primary">
                      {formatPrice(client.total_spent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-6 py-3 text-xs text-gray-400 flex items-center gap-1.5">
            <UsersIcon className="h-3.5 w-3.5" /> {filtered.length} usuario{filtered.length !== 1 ? 's' : ''} · {adminCount} admin{adminCount !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
