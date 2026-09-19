import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, SelectedOption } from '../types';

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, selectedOptions?: SelectedOption[], notes?: string) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  subtotal: () => number;
  count: () => number;
}

function buildKey(product: Product, selectedOptions: SelectedOption[]): string {
  const opts = [...selectedOptions]
    .sort((a, b) => (a.group_name + a.item_name).localeCompare(b.group_name + b.item_name))
    .map((o) => `${o.group_name}:${o.item_name}`)
    .join('|');
  return `${product.id}${opts ? '::' + opts : ''}`;
}

function unitPrice(product: Product, selectedOptions: SelectedOption[]): number {
  return product.price + selectedOptions.reduce((s, o) => s + o.price, 0);
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1, selectedOptions = [], notes) => {
        const key = buildKey(product, selectedOptions);
        const price = unitPrice(product, selectedOptions);
        const existing = get().items.find((i) => i.key === key);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.key === key ? { ...i, quantity: i.quantity + quantity, notes: notes || i.notes } : i
            ),
          });
        } else {
          set({
            items: [
              ...get().items,
              {
                key,
                product_id: product.id,
                product_name: product.name,
                product_price: price,
                quantity,
                notes,
                product,
                selected_options: selectedOptions,
              },
            ],
          });
        }
      },

      removeItem: (key) => {
        set({ items: get().items.filter((i) => i.key !== key) });
      },

      updateQuantity: (key, quantity) => {
        if (quantity <= 0) {
          get().removeItem(key);
          return;
        }
        set({
          items: get().items.map((i) => (i.key === key ? { ...i, quantity } : i)),
        });
      },

      clear: () => set({ items: [] }),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.product_price * i.quantity, 0),

      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'lodemartina-cart-v2' }
  )
);
