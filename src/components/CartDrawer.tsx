import { useNavigate } from 'react-router-dom';
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../store/cart';
import { formatPrice, cn } from '../lib/utils';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, subtotal, clear } = useCartStore();
  const navigate = useNavigate();

  const goToCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-50 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-xl transition-transform duration-300 flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Tu pedido
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Tu carrito está vacío</p>
              <p className="text-sm text-gray-400 mt-1">Agregá productos del menú</p>
              <button
                onClick={() => {
                  onClose();
                  navigate('/menu');
                }}
                className="btn-primary mt-4"
              >
                Ver menú
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.key} className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                {item.product.image_url && (
                  <img
                    src={item.product.image_url}
                    alt={item.product_name}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm">{item.product_name}</p>
                    <button
                      onClick={() => removeItem(item.key)}
                      className="text-gray-400 hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {item.selected_options.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {item.selected_options.map((opt, i) => (
                        <li key={i} className="text-xs text-gray-500">
                          • {opt.item_name}
                          {opt.price > 0 && <span className="text-gray-400"> (+{formatPrice(opt.price)})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.notes && <p className="text-xs text-primary mt-1">Nota: {item.notes}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        className="p-1 rounded-md bg-white border border-gray-200 hover:border-primary"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-semibold text-sm w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="p-1 rounded-md bg-white border border-gray-200 hover:border-primary"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="font-bold text-sm">{formatPrice(item.product_price * item.quantity)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="text-xl font-bold">{formatPrice(subtotal())}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={clear} className="btn-secondary flex-1">
                Vaciar
              </button>
              <button onClick={goToCheckout} className="btn-primary flex-[2]">
                Continuar pedido
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
