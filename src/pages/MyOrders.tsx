import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import type { Order, OrderItem } from '../types';
import {
  formatDate,
  formatPrice,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
} from '../lib/utils';

export default function MyOrders() {
  const { user, loading: authLoading } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: '/pedidos' } });
      return;
    }

    supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data || []) as unknown as Order[]);
        setLoading(false);
      });

    const channel = supabase
      .channel('my-orders-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        () => {
          supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => setOrders((data || []) as unknown as Order[]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, navigate]);

  if (loading || authLoading) {
    return (
      <div className="container-main py-12">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container-main py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Mis Pedidos</h1>

      {orders.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="text-6xl block mb-4">🧾</span>
          <h2 className="text-xl font-bold">Todavía no hiciste pedidos</h2>
          <p className="text-gray-500 mt-2">Cuando hagas tu primer pedido, lo vas a ver acá</p>
          <button onClick={() => navigate('/menu')} className="btn-primary mt-6">
            Ver menú
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const items = (order.items as unknown as OrderItem[]) || [];
            return (
              <div key={order.id} className="card p-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                  <div>
                    <p className="font-bold text-lg">Pedido #{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${ORDER_STATUS_COLORS[order.status]}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  {items.map((item, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          {item.quantity}x {item.product_name}
                        </span>
                        <span className="font-medium">{formatPrice(item.product_price * item.quantity)}</span>
                      </div>
                      {item.selected_options && item.selected_options.length > 0 && (
                        <ul className="mt-0.5 space-y-0.5">
                          {item.selected_options.map((opt, j) => (
                            <li key={j} className="text-xs text-gray-400 pl-3">
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
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {PAYMENT_METHODS[order.payment_method] || order.payment_method}
                    {order.delivery_address && (
                      <span className="block text-xs mt-1">📍 {order.delivery_address}</span>
                    )}
                  </div>
                  <p className="font-bold text-primary">{formatPrice(Number(order.total))}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
