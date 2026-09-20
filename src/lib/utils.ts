import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CartItem, DaySchedule, Order, OrderItem, ProductCategory } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  hamburguesas: 'Hamburguesas',
  tostadas: 'Tostadas',
  combos: 'Combos',
  bebidas: 'Bebidas',
};

export const CATEGORY_EMOJIS: Record<ProductCategory, string> = {
  hamburguesas: '🍔',
  tostadas: '🥪',
  combos: '🍟',
  bebidas: '🥤',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const PAYMENT_METHODS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

export function buildWhatsAppMessage(
  items: OrderItem[],
  subtotal: number,
  deliveryFee: number,
  total: number,
  customerName: string,
  paymentMethod: string,
  deliveryAddress?: string,
  notes?: string
): string {
  const lines: string[] = [];
  lines.push('🛎️ *NUEVO PEDIDO - Lo de Martina*');
  lines.push('');
  lines.push(`👤 *Cliente:* ${customerName}`);
  lines.push('');
  lines.push('📋 *Detalle del pedido:*');
  items.forEach((item, i) => {
    lines.push(`  ${i + 1}. ${item.quantity}x ${item.product_name} - ${formatPrice(item.product_price * item.quantity)}`);
    if (item.selected_options && item.selected_options.length > 0) {
      item.selected_options.forEach((opt) => {
        lines.push(
          `      ↳ ${opt.item_name}${opt.price > 0 ? ` (+${formatPrice(opt.price)})` : ''}`
        );
      });
    }
    if (item.notes) lines.push(`      ↳ Nota: ${item.notes}`);
  });
  lines.push('');
  lines.push(`💰 *Subtotal:* ${formatPrice(subtotal)}`);
  if (deliveryFee > 0) lines.push(`🛵 *Envío:* ${formatPrice(deliveryFee)}`);
  lines.push(`*TOTAL: ${formatPrice(total)}*`);
  lines.push('');
  lines.push(`💳 *Forma de pago:* ${PAYMENT_METHODS[paymentMethod] || paymentMethod}`);
  if (deliveryAddress) lines.push(`📍 *Dirección:* ${deliveryAddress}`);
  if (notes) lines.push(`📝 *Notas:* ${notes}`);
  lines.push('');
  lines.push('¡Gracias! 🙌');

  return encodeURIComponent(lines.join('\n'));
}

export function openWhatsApp(message: string, phoneNumber: string) {
  const clean = phoneNumber.replace(/\D/g, '');
  const url = `https://wa.me/${clean}?text=${message}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toOrderItems(items: CartItem[]): OrderItem[] {
  return items.map(({ key: _key, product: _product, selected_options, ...rest }) => ({
    ...rest,
    selected_options: selected_options.length > 0 ? selected_options : undefined,
  }));
}

export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export const DEFAULT_WEEK: Record<string, DaySchedule> = {
  monday: { open: '20:00', close: '00:00', closed: false },
  tuesday: { open: '20:00', close: '00:00', closed: false },
  wednesday: { open: '20:00', close: '00:00', closed: false },
  thursday: { open: '20:00', close: '00:00', closed: false },
  friday: { open: '20:00', close: '00:00', closed: false },
  saturday: { open: '20:00', close: '00:00', closed: false },
  sunday: { open: '20:00', close: '00:00', closed: true },
};

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function computeIsOpen(hours: Record<string, DaySchedule>): boolean {
  const now = new Date();
  const todayKey = DAY_KEYS[(now.getDay() + 6) % 7];
  const yesterdayKey = DAY_KEYS[(now.getDay() + 5) % 7];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const checkDay = (day: DaySchedule | undefined, sameDay: boolean): boolean => {
    if (!day || day.closed || !day.open || !day.close) return false;
    const open = parseTimeToMinutes(day.open);
    const close = parseTimeToMinutes(day.close);
    if (close > open) return sameDay && nowMin >= open && nowMin < close;
    if (sameDay) return nowMin >= open;
    return nowMin < close;
  };

  return checkDay(hours[todayKey], true) || checkDay(hours[yesterdayKey], false);
}

function scheduleEqual(a: DaySchedule | undefined, b: DaySchedule | undefined): boolean {
  if (!a || !b) return a === b;
  return a.closed === b.closed && a.open === b.open && a.close === b.close;
}

export function groupSchedule(hours: Record<string, DaySchedule>): { days: string; range: string }[] {
  const groups: { days: string; range: string }[] = [];
  let startIdx = 0;
  for (let i = 0; i < DAY_KEYS.length; i++) {
    const cur = hours[DAY_KEYS[i]];
    const next = hours[DAY_KEYS[i + 1]];
    const sameAsNext = next !== undefined && scheduleEqual(cur, next);
    if (!sameAsNext) {
      const day = hours[DAY_KEYS[startIdx]];
      const daysLabel =
        startIdx === i
          ? DAY_LABELS[DAY_KEYS[i]]
          : `${DAY_LABELS[DAY_KEYS[startIdx]]} a ${DAY_LABELS[DAY_KEYS[i]]}`;
      const range = day?.closed ? 'Cerrado' : `${day?.open} a ${day?.close} hs`;
      groups.push({ days: daysLabel, range });
      startIdx = i + 1;
    }
  }
  return groups;
}

export function commonSchedule(hours: Record<string, DaySchedule>): string | null {
  const working = DAY_KEYS
    .map((k) => hours[k])
    .filter((d) => d && !d.closed && d.open && d.close);
  if (working.length === 0) return null;
  const ranges = working.map((d) => `${d.open}-${d.close}`);
  return new Set(ranges).size === 1 ? `${working[0].open} a ${working[0].close} hs` : null;
}

export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.15);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch {
    /* sin audio disponible */
  }
}

export function exportOrdersCSV(orders: Order[]) {
  const header = [
    'Nº pedido',
    'Fecha',
    'Cliente',
    'Teléfono',
    'Items',
    'Subtotal',
    'Envío',
    'Total',
    'Estado',
    'Pago',
    'Dirección',
    'Notas',
  ];
  const rows = orders.map((o) => {
    const items = (o.items as unknown as OrderItem[]) || [];
    const itemsText = items
      .map((it) => {
        const opts = (it.selected_options || [])
          .map((opt) => `${opt.item_name}${opt.price > 0 ? `(+${opt.price})` : ''}`)
          .join(', ');
        return `${it.quantity}x ${it.product_name}${opts ? ` [${opts}]` : ''}${it.notes ? ` (${it.notes})` : ''}`;
      })
      .join('; ');
    return [
      o.id.slice(0, 8).toUpperCase(),
      formatDate(o.created_at),
      o.user_name,
      o.user_phone,
      itemsText,
      o.subtotal,
      o.delivery_fee,
      o.total,
      ORDER_STATUS_LABELS[o.status] || o.status,
      PAYMENT_METHODS[o.payment_method] || o.payment_method,
      o.delivery_address || '',
      o.notes || '',
    ];
  });
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printOrderTicket(order: Order) {
  const items = (order.items as unknown as OrderItem[]) || [];
  const rows = items
    .map(
      (it) => `
      <div class="item">
        <div>
          <strong>${it.quantity}x ${it.product_name}</strong>
          ${(it.selected_options || [])
            .map((opt) => `<div class="opt">· ${opt.item_name}${opt.price > 0 ? ` (+$${opt.price})` : ''}</div>`)
            .join('')}
          ${it.notes ? `<div class="opt">Nota: ${it.notes}</div>` : ''}
        </div>
        <span>$${Number(it.product_price * it.quantity).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
      </div>`
    )
    .join('');

  const w = window.open('', '_blank', 'width=360,height=640');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comanda ${order.id.slice(0, 8).toUpperCase()}</title>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; color: #000; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
    .sub { text-align: center; font-size: 11px; margin-bottom: 12px; }
    .item { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .opt { font-size: 11px; color: #444; }
    hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
    .total { font-size: 16px; font-weight: bold; display: flex; justify-content: space-between; }
    .info { font-size: 12px; margin-top: 8px; }
  </style></head><body>
    <h1>${'Lo de Martina'}</h1>
    <div class="sub">Comanda #${order.id.slice(0, 8).toUpperCase()}<br>${formatDate(order.created_at)}</div>
    <hr>
    ${rows}
    <hr>
    <div class="total"><span>TOTAL</span><span>$${Number(order.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
    <div class="info">
      Cliente: ${order.user_name}<br>
      Tel: ${order.user_phone}<br>
      Pago: ${PAYMENT_METHODS[order.payment_method] || order.payment_method}<br>
      ${order.delivery_address ? `Dirección: ${order.delivery_address}<br>` : ''}
      ${order.notes ? `Notas: ${order.notes}` : ''}
    </div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
