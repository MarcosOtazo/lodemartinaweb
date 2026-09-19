import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../types';
import { formatPrice } from '../../lib/utils';
import { TrendingUp, Receipt, Users, ShoppingBag } from 'lucide-react';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders((data || []) as unknown as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter((o) => new Date(o.created_at) >= today && o.status !== 'cancelled');
  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalOrders = orders.filter((o) => o.status !== 'cancelled').length;
  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total), 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;

  const stats = [
    {
      label: 'Ventas de hoy',
      value: formatPrice(todayRevenue),
      sub: `${todayOrders.length} pedidos`,
      icon: TrendingUp,
      color: 'bg-primary',
    },
    {
      label: 'Pedidos pendientes',
      value: String(pendingOrders),
      sub: 'Requieren tu atención',
      icon: ShoppingBag,
      color: 'bg-yellow-500',
    },
    {
      label: 'Ventas totales',
      value: formatPrice(totalRevenue),
      sub: `${totalOrders} pedidos`,
      icon: Receipt,
      color: 'bg-green-500',
    },
    {
      label: 'Ticket promedio',
      value: totalOrders > 0 ? formatPrice(totalRevenue / totalOrders) : '$0.00',
      sub: 'Por pedido',
      icon: Users,
      color: 'bg-blue-500',
    },
  ];

  const recentOrders = orders.slice(0, 8);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-10 w-10 bg-gray-200 rounded-full mb-4" />
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="card p-6">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${stat.color} mb-4`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <p className="text-2xl font-extrabold">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-bold mb-4">Últimos pedidos</h2>
      {recentOrders.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="text-5xl block mb-3">📭</span>
          <p className="font-semibold">Todavía no hay pedidos</p>
          <p className="text-sm text-gray-500 mt-1">Los pedidos que recibas van a aparecer acá</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-6 py-3 font-semibold text-gray-500">Cliente</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Fecha</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Items</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Total</th>
                <th className="px-6 py-3 font-semibold text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium">{order.user_name}</p>
                    <p className="text-xs text-gray-500">{order.user_phone}</p>
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(order.created_at).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {((order.items as unknown) as { quantity: number }[]).reduce((s, i) => s + i.quantity, 0)} items
                  </td>
                  <td className="px-6 py-3 font-bold">{formatPrice(Number(order.total))}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                      {order.status === 'pending' ? 'Pendiente' : order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
