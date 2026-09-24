import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatPrice, formatDate } from '../../lib/utils';
import type { User } from '../../types';
import { Search, Users as UsersIcon } from 'lucide-react';

interface ClientRow extends User {
  orders_count: number;
  total_spent: number;
}

export default function AdminUsers() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
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

      const rows = ((profilesRes.data || []) as unknown as User[])
        .filter((p) => p.role !== 'admin')
        .map((p) => ({
          ...p,
          orders_count: stats.get(p.id)?.count || 0,
          total_spent: stats.get(p.id)?.spent || 0,
        }));
      setClients(rows);
      setLoading(false);
    });
  }, []);

  const filtered = clients.filter(
    (c) =>
      (c.client_number ? String(c.client_number) : '').includes(search) ||
      (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clientes registrados</h1>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="input pl-9"
           placeholder="Buscar por N.º, nombre, email o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
          <p className="font-semibold">Todavía no hay clientes registrados</p>
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
                 <th className="px-6 py-3 font-semibold text-gray-500">Cliente</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Teléfono</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Registro</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Pedidos</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Total gastado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
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
                        <p className="font-medium">{client.full_name || 'Sin nombre'}</p>
                        <p className="text-xs text-gray-500">{client.email}</p>
                      </div>
                    </div>
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
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 text-xs text-gray-400 flex items-center gap-1.5">
            <UsersIcon className="h-3.5 w-3.5" /> {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} registrado{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
