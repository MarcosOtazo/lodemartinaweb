import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Order, OrderItem, OrderStatus } from '../../types';
import {
  formatDate,
  formatPrice,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
  cn,
} from '../../lib/utils';
import { Search, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

const ALL_STATUSES: (OrderStatus | 'all')[] = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

export default function AdminSales() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setOrders((data || []) as unknown as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('admin-sales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) {
      toast.error('Error al actualizar el estado');
      return;
    }
    toast.success(`Pedido marcado como "${ORDER_STATUS_LABELS[status]}"`);
    loadOrders();
  };

  const filtered = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch =
      o.user_name.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.user_phone.includes(search);
    return matchesStatus && matchesSearch;
  });

  const filteredRevenue = filtered
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ventas y pedidos</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card p-6">
          <p className="text-sm text-gray-500">Pedidos (filtrados)</p>
          <p className="text-2xl font-extrabold">{filtered.length}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Facturación (filtrada)</p>
          <p className="text-2xl font-extrabold text-primary">{formatPrice(filteredRevenue)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Pendientes</p>
          <p className="text-2xl font-extrabold text-yellow-600">
            {orders.filter((o) => o.status === 'pending').length}
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre, teléfono o nº de pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                statusFilter === status
                  ? 'bg-secondary text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {status === 'all' ? 'Todos' : ORDER_STATUS_LABELS[status]}
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
          <span className="text-5xl block mb-3">📭</span>
          <p className="font-semibold">No hay pedidos con esos filtros</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const items = (order.items as unknown as OrderItem[]) || [];
            const isExpanded = expandedId === order.id;
            return (
              <div key={order.id} className="card">
                <div
                  className="p-5 cursor-pointer flex items-center justify-between flex-wrap gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-bold">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', ORDER_STATUS_COLORS[order.status])}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {order.user_name} · {order.user_phone} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-primary text-lg">{formatPrice(Number(order.total))}</p>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-sm text-gray-500 mb-2">DETALLE</h4>
                        <div className="space-y-1.5">
                          {items.map((item, i) => (
                            <div key={i} className="text-sm">
                              <div className="flex justify-between">
                                <span>{item.quantity}x {item.product_name}</span>
                                <span className="font-medium">{formatPrice(item.product_price * item.quantity)}</span>
                              </div>
                              {item.selected_options && item.selected_options.length > 0 && (
                                <ul className="mt-0.5">
                                  {item.selected_options.map((opt, j) => (
                                    <li key={j} className="text-xs text-gray-500 pl-3">
                                      • {opt.item_name}
                                      {opt.price > 0 && ` (+${formatPrice(opt.price)})`}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {item.notes && <p className="text-xs text-primary pl-3 mt-0.5">Nota: {item.notes}</p>}
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-gray-100 mt-3 pt-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Subtotal</span>
                            <span>{formatPrice(Number(order.subtotal))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Envío</span>
                            <span>{formatPrice(Number(order.delivery_fee))}</span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>Total</span>
                            <span className="text-primary">{formatPrice(Number(order.total))}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-gray-500 mb-2">INFORMACIÓN</h4>
                        <div className="space-y-1.5 text-sm">
                          <p>💳 {PAYMENT_METHODS[order.payment_method] || order.payment_method}</p>
                          {order.delivery_address && <p>📍 {order.delivery_address}</p>}
                          {order.notes && <p>📝 {order.notes}</p>}
                        </div>
                        <h4 className="font-semibold text-sm text-gray-500 mt-4 mb-2">ACTUALIZAR ESTADO</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'] as OrderStatus[]).map(
                            (status) => (
                              <button
                                key={status}
                                onClick={() => updateStatus(order.id, status)}
                                className={cn(
                                  'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                                  order.status === status
                                    ? 'bg-secondary text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                )}
                              >
                                {ORDER_STATUS_LABELS[status]}
                              </button>
                            )
                          )}
                        </div>
                        <a
                          href={`https://wa.me/${order.user_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary mt-4 text-sm w-full"
                        >
                          <MessageCircle className="h-4 w-4" /> Contactar al cliente
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
