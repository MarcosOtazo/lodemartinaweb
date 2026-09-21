import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { fetchCostData } from '../../lib/costs';
import { useConfigStore } from '../../store/config';
import type { Order, OrderItem, OrderStatus, Product } from '../../types';
import type { Json } from '../../types/database';
import {
  commonSchedule,
  computeIsOpen,
  exportOrdersCSV,
  formatDate,
  formatPrice,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHODS,
  playNotificationSound,
  printOrderTicket,
  cn,
} from '../../lib/utils';
import { Search, ChevronDown, ChevronUp, MessageCircle, Download, Printer, CheckSquare, Plus, Trash2, X } from 'lucide-react';

const ALL_STATUSES: (OrderStatus | 'all')[] = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

export default function AdminSales() {
  const [orders, setOrders] = useState<Order[]>([]);
  const config = useConfigStore((s) => s.config);
  const [loading, setLoading] = useState(true);
  const [productCosts, setProductCosts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualPayment, setManualPayment] = useState<'cash' | 'transfer'>('cash');
  const [manualNotes, setManualNotes] = useState('');
  const [manualItems, setManualItems] = useState<
    { product_id: string; product_name: string; product_price: number; quantity: number }[]
  >([]);
  const [manualSaving, setManualSaving] = useState(false);

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
    fetchCostData().then((d) => setProductCosts(d.productCosts));
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setProducts((data || []) as Product[]));

    const channel = supabase
      .channel('admin-sales')
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

  const orderCost = (order: Order): number => {
    const items = (order.items as unknown as OrderItem[]) || [];
    return items.reduce(
      (s, it) => s + (productCosts[it.product_id] || 0) * it.quantity,
      0
    );
  };

  const orderProfit = (order: Order): number => Number(order.total) - orderCost(order);

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

  const markSelectedDelivered = async () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Marcar ${selected.size} pedido(s) como entregado(s)?`)) return;
    const { error } = await supabase
      .from('orders')
      .update({ status: 'delivered', updated_at: new Date().toISOString() })
      .in('id', [...selected]);
    if (error) {
      toast.error('Error al actualizar los pedidos');
      return;
    }
    toast.success(`${selected.size} pedido(s) marcado(s) como entregado(s)`);
    setSelected(new Set());
    loadOrders();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const deleteOrder = async (order: Order) => {
    if (!confirm(`¿Eliminar el pedido #${order.id.slice(0, 8).toUpperCase()} de ${order.user_name}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('orders').delete().eq('id', order.id);
    if (error) {
      toast.error('Error al eliminar el pedido');
      return;
    }
    toast.success('Pedido eliminado');
    loadOrders();
  };

  const openManualModal = () => {
    setManualName('');
    setManualPhone('');
    setManualPayment('cash');
    setManualNotes('');
    setManualItems([{ product_id: '', product_name: '', product_price: 0, quantity: 1 }]);
    setManualOpen(true);
  };

  const manualSubtotal = manualItems.reduce(
    (s, it) => s + Number(it.product_price || 0) * Number(it.quantity || 0),
    0
  );

  const saveManualOrder = async () => {
    if (!manualName.trim()) {
      toast.error('Ingresá el nombre del cliente');
      return;
    }
    const validItems = manualItems.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      toast.error('Agregá al menos un producto con cantidad');
      return;
    }
    setManualSaving(true);
    try {
      const { error } = await supabase.from('orders').insert({
        user_id: null,
        user_name: manualName.trim(),
        user_phone: manualPhone.trim() || '—',
        items: validItems as unknown as Json,
        subtotal: manualSubtotal,
        delivery_fee: 0,
        total: manualSubtotal,
        status: 'confirmed',
        payment_method: manualPayment,
        notes: [manualNotes.trim(), 'Pedido cargado en local'].filter(Boolean).join(' | '),
      });
      if (error) throw error;
      toast.success('Pedido cargado');
      setManualOpen(false);
      loadOrders();
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar el pedido');
    } finally {
      setManualSaving(false);
    }
  };

  const fromDate = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
  const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;

  const filtered = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch =
      o.user_name.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.user_phone.includes(search);
    const d = new Date(o.created_at);
    const matchesFrom = !fromDate || d >= fromDate;
    const matchesTo = !toDate || d <= toDate;
    return matchesStatus && matchesSearch && matchesFrom && matchesTo;
  });

  const filteredRevenue = filtered
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total), 0);

  const filteredProfit = filtered
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + orderProfit(o), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ventas y pedidos</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <div className="card p-6">
          <p className="text-sm text-gray-500">Pedidos (filtrados)</p>
          <p className="text-2xl font-extrabold">{filtered.length}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Facturación (filtrada)</p>
          <p className="text-2xl font-extrabold text-primary">{formatPrice(filteredRevenue)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Ganancia estimada</p>
          <p className={cn('text-2xl font-extrabold', filteredProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
            {formatPrice(filteredProfit)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Según costos de recetas e insumos</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Pendientes</p>
          <p className="text-2xl font-extrabold text-yellow-600">
            {orders.filter((o) => o.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre, teléfono o nº..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input w-auto"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Desde"
          />
          <span className="text-gray-400 text-sm">a</span>
          <input
            type="date"
            className="input w-auto"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Hasta"
          />
        </div>
        <button onClick={() => exportOrdersCSV(filtered)} className="btn-secondary" title="Exportar CSV">
          <Download className="h-4 w-4" /> Exportar
        </button>
        <button
          onClick={markSelectedDelivered}
          disabled={selected.size === 0}
          className="btn-primary"
          title="Marcar seleccionados como entregados"
        >
          <CheckSquare className="h-4 w-4" /> Entregados ({selected.size})
        </button>
        <button onClick={openManualModal} className="btn-primary" title="Cargar pedido manual (venta en local)">
          <Plus className="h-4 w-4" /> Pedido en local
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto mb-6 pb-1">
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
                <div className="p-5 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 accent-primary shrink-0"
                      title="Seleccionar"
                    />
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
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-primary text-lg">{formatPrice(Number(order.total))}</p>
                      {order.status !== 'cancelled' && (
                        <p className={cn('text-xs font-semibold', orderProfit(order) >= 0 ? 'text-green-600' : 'text-red-600')}>
                          Gana: {formatPrice(orderProfit(order))}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => printOrderTicket(order)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                      title="Imprimir comanda"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteOrder(order)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                      title="Eliminar pedido"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                      title="Detalle"
                    >
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
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
                          {order.status !== 'cancelled' && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Costo estimado</span>
                                <span>{formatPrice(orderCost(order))}</span>
                              </div>
                              <div className="flex justify-between font-bold">
                                <span>Ganancia estimada</span>
                                <span className={orderProfit(order) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatPrice(orderProfit(order))}
                                </span>
                              </div>
                            </>
                          )}
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
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => printOrderTicket(order)} className="btn-secondary text-sm flex-1">
                            <Printer className="h-4 w-4" /> Comanda
                          </button>
                          <a
                            href={`https://wa.me/${order.user_phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-sm flex-1"
                          >
                            <MessageCircle className="h-4 w-4" /> Cliente
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal pedido manual */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setManualOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold">Pedido en local</h2>
                <p className="text-sm text-gray-500">Venta directa en el mostrador</p>
              </div>
              <button onClick={() => setManualOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!computeIsOpen(config.opening_hours) && (
                <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                  ⚠️ Estás fuera del horario de atención
                  {commonSchedule(config.opening_hours) ? ` (${commonSchedule(config.opening_hours)})` : ''}.
                  Como admin podés cargarlo igual.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre del cliente *</label>
                  <input
                    className="input"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
                <div>
                  <label className="label">Teléfono (opcional)</label>
                  <input
                    className="input"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="Ej: 11 1234 5678"
                  />
                </div>
              </div>

              <div>
                <label className="label">Productos</label>
                <div className="space-y-2">
                  {manualItems.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <select
                        className="input flex-1 min-w-[150px]"
                        value={item.product_id}
                        onChange={(e) => {
                          const prod = products.find((p) => p.id === e.target.value);
                          const next = [...manualItems];
                          next[ii] = {
                            ...item,
                            product_id: e.target.value,
                            product_name: prod ? prod.name : '',
                            product_price: prod ? Number(prod.price) : 0,
                          };
                          setManualItems(next);
                        }}
                      >
                        <option value="">Elegí un producto...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatPrice(p.price)})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="input w-20"
                        value={item.quantity}
                        onChange={(e) => {
                          const next = [...manualItems];
                          next[ii] = { ...item, quantity: Number(e.target.value) };
                          setManualItems(next);
                        }}
                        placeholder="Cant."
                      />
                      <span className="text-sm font-semibold text-gray-600 w-24 text-right shrink-0">
                        {item.product_id ? formatPrice(Number(item.product_price) * Number(item.quantity || 0)) : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setManualItems(manualItems.filter((_, i) => i !== ii))}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 shrink-0"
                        aria-label="Quitar producto"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setManualItems([
                        ...manualItems,
                        { product_id: '', product_name: '', product_price: 0, quantity: 1 },
                      ])
                    }
                    className="text-sm text-primary font-semibold hover:underline"
                  >
                    + Agregar producto
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Forma de pago</label>
                  <select
                    className="input"
                    value={manualPayment}
                    onChange={(e) => setManualPayment(e.target.value as 'cash' | 'transfer')}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                  </select>
                </div>
                <div>
                  <label className="label">Total</label>
                  <p className="text-xl font-bold text-primary pt-2">{formatPrice(manualSubtotal)}</p>
                </div>
              </div>

              <div>
                <label className="label">Notas (opcional)</label>
                <input
                  className="input"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Ej: sin cebolla, para llevar..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setManualOpen(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="button" onClick={saveManualOrder} className="btn-primary flex-1" disabled={manualSaving}>
                  {manualSaving ? 'Guardando...' : 'Cargar pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
