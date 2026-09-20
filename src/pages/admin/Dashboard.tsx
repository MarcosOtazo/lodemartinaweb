import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Order, OrderItem } from '../../types';
import { formatPrice, playNotificationSound } from '../../lib/utils';
import { TrendingUp, Receipt, ShoppingBag, Users, Trophy } from 'lucide-react';

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    setOrders((data || []) as unknown as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        playNotificationSound();
        toast('🛎️ ¡Nuevo pedido!', { icon: '🔔' });
        loadOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 3600 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 3600 * 1000);
  const monday = new Date(startOfToday);
  const dayOfWeek = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayOfWeek);
  const mondayLastWeek = new Date(monday.getTime() - 7 * 24 * 3600 * 1000);

  const valid = orders.filter((o) => o.status !== 'cancelled');
  const todayOrders = valid.filter((o) => new Date(o.created_at) >= startOfToday);
  const yesterdayOrders = valid.filter(
    (o) => new Date(o.created_at) >= startOfYesterday && new Date(o.created_at) < startOfToday
  );
  const weekOrders = valid.filter((o) => {
    const d = new Date(o.created_at);
    const weekEnd = new Date(monday.getTime() + 7 * 24 * 3600 * 1000);
    return d >= monday && d < weekEnd;
  });
  const lastWeekOrders = valid.filter(
    (o) => new Date(o.created_at) >= mondayLastWeek && new Date(o.created_at) < monday
  );

  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + Number(o.total), 0);
  const weekRevenue = weekOrders.reduce((s, o) => s + Number(o.total), 0);
  const lastWeekRevenue = lastWeekOrders.reduce((s, o) => s + Number(o.total), 0);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const avgTicket = valid.length > 0 ? valid.reduce((s, o) => s + Number(o.total), 0) / valid.length : 0;

  const revenueDiff =
    yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : todayRevenue > 0
        ? 100
        : 0;
  const weekDiff =
    lastWeekRevenue > 0 ? Math.round(((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : weekRevenue > 0 ? 100 : 0;

  // Gráfico últimos 7 días
  const daysData = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(startOfWeek.getTime() + i * 24 * 3600 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const dayOrders = valid.filter((o) => {
      const d = new Date(o.created_at);
      return d >= dayStart && d < dayEnd;
    });
    return {
      label: DAY_NAMES[dayStart.getDay()],
      revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0),
      count: dayOrders.length,
    };
  });
  const maxDayRevenue = Math.max(...daysData.map((d) => d.revenue), 1);

  // Productos más vendidos (últimos 300 pedidos)
  const soldMap = new Map<string, number>();
  valid.forEach((o) => {
    const items = (o.items as unknown as OrderItem[]) || [];
    items.forEach((it) => {
      soldMap.set(it.product_name, (soldMap.get(it.product_name) || 0) + it.quantity);
    });
  });
  const topProducts = [...soldMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTop = topProducts.length > 0 ? topProducts[0][1] : 1;

  const stats = [
    {
      label: 'Ventas de hoy',
      value: formatPrice(todayRevenue),
      sub: `${todayOrders.length} pedidos · ${revenueDiff >= 0 ? '▲' : '▼'} ${Math.abs(revenueDiff)}% vs ayer`,
      icon: TrendingUp,
      color: 'bg-primary',
    },
    {
      label: 'Esta semana',
      value: formatPrice(weekRevenue),
      sub: `${weekOrders.length} pedidos · ${weekDiff >= 0 ? '▲' : '▼'} ${Math.abs(weekDiff)}% vs semana pasada`,
      icon: Receipt,
      color: 'bg-green-500',
    },
    {
      label: 'Pedidos pendientes',
      value: String(pendingCount),
      sub: 'Requieren tu atención',
      icon: ShoppingBag,
      color: 'bg-yellow-500',
    },
    {
      label: 'Ticket promedio',
      value: formatPrice(avgTicket),
      sub: `${valid.length} pedidos en total`,
      icon: Users,
      color: 'bg-blue-500',
    },
  ];

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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Gráfico de la semana */}
        <div className="lg:col-span-3 card p-6">
          <h2 className="font-bold mb-4">Ventas de los últimos 7 días</h2>
          <div className="flex items-end justify-between gap-2 h-44">
            {daysData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] font-semibold text-gray-500">
                  {d.revenue > 0 ? `$${Math.round(d.revenue / 1000)}k` : ''}
                </span>
                <div
                  className="w-full max-w-[42px] rounded-t-lg bg-primary transition-all"
                  style={{
                    height: `${Math.max((d.revenue / maxDayRevenue) * 100, d.revenue > 0 ? 6 : 2)}%`,
                    opacity: d.revenue > 0 ? 1 : 0.15,
                  }}
                />
                <span className="text-[11px] text-gray-500">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-3">
            <span>{daysData.reduce((s, d) => s + d.count, 0)} pedidos</span>
            <span className="font-bold text-primary">{formatPrice(weekRevenue)}</span>
          </div>
        </div>

        {/* Más vendidos */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Más vendidos
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay ventas registradas</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map(([name, qty], i) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium truncate">
                      {i + 1}. {name}
                    </span>
                    <span className="font-bold text-gray-600 shrink-0 ml-2">{qty} vend.</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(qty / maxTop) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Últimos pedidos */}
      <h2 className="text-lg font-bold mb-4">Últimos pedidos</h2>
      {orders.length === 0 ? (
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
              {orders.slice(0, 8).map((order) => (
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
