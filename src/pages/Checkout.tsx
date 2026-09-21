import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useCartStore } from '../store/cart';
import { useConfigStore } from '../store/config';
import {
  buildWhatsAppMessage,
  commonSchedule,
  computeIsOpen,
  formatPrice,
  openWhatsApp,
  toOrderItems,
  cn,
} from '../lib/utils';
import type { Json } from '../types/database';

const BANK_DETAILS = {
  alias: 'lodemartina.mp',
  name: 'Marcos Gabriel Otazo',
  bank: 'Mercado Pago',
};

export default function Checkout() {
  const { items, subtotal, clear } = useCartStore();
  const { user } = useAuthStore();
  const config = useConfigStore((s) => s.config);
  const navigate = useNavigate();

  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = deliveryType === 'delivery' ? Number(config.delivery_fee) || 0 : 0;
  const total = subtotal() + deliveryFee;
  const belowMinimum = Number(config.min_order_amount) > 0 && subtotal() < Number(config.min_order_amount);
  const cashAmountNum = Number(cashAmount);
  const change = cashAmountNum > 0 ? cashAmountNum - total : 0;
  const isOpen = computeIsOpen(config.opening_hours);
  const scheduleText = commonSchedule(config.opening_hours);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOpen) {
      toast.error('Estamos cerrados en este momento');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      toast.error('Completá tu nombre y teléfono');
      return;
    }
    if (belowMinimum) {
      toast.error(`El pedido mínimo es ${formatPrice(Number(config.min_order_amount))}`);
      return;
    }
    if (paymentMethod === 'cash' && (cashAmountNum <= 0 || cashAmountNum < total)) {
      toast.error('Ingresá con cuánto vas a pagar en efectivo');
      return;
    }
    setSubmitting(true);

    const paymentLabel =
      paymentMethod === 'cash'
        ? `Efectivo (con ${formatPrice(cashAmountNum)}${change > 0 ? `, vuelto ${formatPrice(change)}` : ''})`
        : 'Transferencia';
    const paymentInfo =
      paymentMethod === 'cash'
        ? `Paga con: ${formatPrice(cashAmountNum)}${change > 0 ? ` (vuelto: ${formatPrice(change)})` : ''}`
        : 'Paga con transferencia (alias: lodemartina.mp)';
    const finalNotes = [notes, paymentInfo].filter(Boolean).join(' | ');

    try {
      if (user) {
        const { error } = await supabase
          .from('orders')
          .insert({
            user_id: user.id,
            user_name: name,
            user_phone: phone,
            items: toOrderItems(items) as unknown as Json,
            subtotal: subtotal(),
            delivery_fee: deliveryFee,
            total,
            payment_method: paymentMethod,
            delivery_address: deliveryType === 'delivery' ? address : null,
            notes: finalNotes,
          })
          .select()
          .single();
        if (error) throw error;
      }

      const message = buildWhatsAppMessage(
        toOrderItems(items),
        subtotal(),
        deliveryFee,
        total,
        name,
        paymentLabel,
        deliveryType === 'delivery' ? address : undefined,
        finalNotes
      );

      const whatsappNumber = config.whatsapp_number || import.meta.env.VITE_WHATSAPP_NUMBER;
      if (whatsappNumber) {
        openWhatsApp(message, whatsappNumber);
      } else {
        toast.error('No hay número de WhatsApp configurado. Contactanos por otro medio.');
      }

      clear();
      toast.success('¡Pedido enviado! Te contactaremos por WhatsApp');
      navigate(user ? '/pedidos' : '/');
    } catch (error) {
      console.error(error);
      toast.error('Hubo un error al procesar tu pedido. Intentalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container-main py-20 text-center">
        <h1 className="text-2xl font-bold">Tu carrito está vacío</h1>
        <p className="text-gray-500 mt-2">Agregá productos antes de continuar</p>
        <button onClick={() => navigate('/menu')} className="btn-primary mt-6">
          Ver menú
        </button>
      </div>
    );
  }

  return (
    <div className="container-main py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Finalizar pedido</h1>

      {!isOpen && (
        <div className="card p-5 mb-6 bg-red-50 border-red-200 flex items-start gap-3">
          <span className="text-2xl">😴</span>
          <div>
            <p className="font-bold text-red-700">Estamos cerrados por el momento</p>
            <p className="text-sm text-red-600">
              {scheduleText
                ? `Nuestro horario de atención es de ${scheduleText}.`
                : 'Volvé a intentarlo en nuestro horario de atención.'}{' '}
              Podés armar el carrito, pero el pedido se envía solo cuando estamos abiertos.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">
          {/* Datos de contacto */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Tus datos</h2>
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="name">Nombre</label>
                <input
                  id="name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="phone">Teléfono / WhatsApp</label>
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 11 1234 5678"
                  required
                />
              </div>
            </div>
          </div>

          {/* Tipo de entrega */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Entrega</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setDeliveryType('pickup')}
                className={cn(
                  'p-4 rounded-xl border-2 text-center transition-colors',
                  deliveryType === 'pickup' ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <span className="text-2xl block mb-1">🏪</span>
                <span className="font-semibold">Retiro en local</span>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType('delivery')}
                className={cn(
                  'p-4 rounded-xl border-2 text-center transition-colors',
                  deliveryType === 'delivery' ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <span className="text-2xl block mb-1">🛵</span>
                <span className="font-semibold">Envío a domicilio</span>
              </button>
            </div>
            {deliveryType === 'delivery' && (
              <div>
                <label className="label" htmlFor="address">Dirección de entrega</label>
                <input
                  id="address"
                  className="input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, número, piso, depto, referencias..."
                  required
                />
              </div>
            )}
          </div>

          {/* Pago */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Forma de pago</h2>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'cash', label: 'Efectivo', emoji: '💵' },
                { key: 'transfer', label: 'Transferencia', emoji: '🏦' },
              ] as const).map((method) => (
                <button
                  key={method.key}
                  type="button"
                  onClick={() => setPaymentMethod(method.key)}
                  className={cn(
                    'p-4 rounded-xl border-2 text-center transition-colors',
                    paymentMethod === method.key ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <span className="text-2xl block mb-1">{method.emoji}</span>
                  <span className="font-semibold text-sm">{method.label}</span>
                </button>
              ))}
            </div>

            {paymentMethod === 'cash' ? (
              <div className="mt-4">
                <label className="label" htmlFor="cashAmount">¿Con cuánto pagás?</label>
                <input
                  id="cashAmount"
                  type="number"
                  min="0"
                  className="input"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder={`Total: ${formatPrice(total)} — Ej: 20000`}
                />
                {cashAmountNum > 0 && cashAmountNum >= total ? (
                  <p className="text-sm font-semibold text-green-700 mt-2">
                    Tu vuelto: {formatPrice(change)}
                  </p>
                ) : cashAmountNum > 0 ? (
                  <p className="text-sm font-semibold text-red-600 mt-2">
                    Faltan {formatPrice(total - cashAmountNum)} para completar el total
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2 text-sm">
                <p className="font-semibold text-gray-700">Datos para la transferencia:</p>
                <p>
                  <span className="text-gray-500">Alias: </span>
                  <span className="font-bold text-gray-900">{BANK_DETAILS.alias}</span>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(BANK_DETAILS.alias);
                      toast.success('Alias copiado');
                    }}
                    className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
                  >
                    <Copy className="h-3.5 w-3.5" /> copiar
                  </button>
                </p>
                <p>
                  <span className="text-gray-500">Titular: </span>
                  <span className="font-medium text-gray-900">{BANK_DETAILS.name}</span>
                </p>
                <p>
                  <span className="text-gray-500">Banco: </span>
                  <span className="font-medium text-gray-900">{BANK_DETAILS.bank}</span>
                </p>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Notas (opcional)</h2>
            <textarea
              className="input min-h-[100px] resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="¿Algo que debamos saber? Ej: sin cebolla, timbrar dos veces..."
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-4 text-lg"
            disabled={submitting || !isOpen}
          >
            {!isOpen
              ? 'Cerrado por el momento 😴'
              : submitting
                ? 'Enviando...'
                : 'Confirmar pedido por WhatsApp 🟢'}
          </button>
          {!user && (
            <p className="text-sm text-gray-500 text-center">
              💡 <span className="font-medium">Tip:</span>{' '}
              <button
                type="button"
                onClick={() => navigate('/login', { state: { from: '/checkout' } })}
                className="text-primary hover:underline"
              >
                Iniciá sesión
              </button>{' '}
              para guardar tu pedido y ver el historial.
            </p>
          )}
        </form>

        {/* Resumen */}
        <div className="lg:col-span-2">
          <div className="card p-6 sticky top-24">
            <h2 className="text-lg font-bold mb-4">Tu pedido</h2>
            <div className="space-y-3 mb-4 max-h-[40vh] overflow-y-auto">
              {items.map((item) => (
                <div key={item.key} className="flex justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {item.quantity}x {item.product_name}
                    </p>
                    {item.selected_options.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5">
                        {item.selected_options.map((opt, i) => (
                          <li key={i} className="text-xs text-gray-500">
                            • {opt.item_name}
                            {opt.price > 0 && <span> (+{formatPrice(opt.price)})</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.notes && <p className="text-xs text-primary">Nota: {item.notes}</p>}
                  </div>
                  <p className="font-semibold shrink-0">{formatPrice(item.product_price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatPrice(subtotal())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Envío</span>
                <span className="font-semibold">
                  {deliveryFee > 0 ? formatPrice(deliveryFee) : 'Gratis'}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
            </div>
            {belowMinimum && (
              <p className="mt-4 text-sm text-red-600 font-medium">
                El pedido mínimo es {formatPrice(Number(config.min_order_amount))}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
