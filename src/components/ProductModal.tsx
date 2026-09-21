import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Plus, Minus } from 'lucide-react';
import type { Product, ProductOptionGroup, SelectedOption } from '../types';
import { useCartStore } from '../store/cart';
import { useConfigStore } from '../store/config';
import { formatPrice, cn } from '../lib/utils';

interface ProductModalProps {
  product: Product | null;
  optionGroups: ProductOptionGroup[];
  onClose: () => void;
}

export default function ProductModal({ product, optionGroups, onClose }: ProductModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');
  const addItem = useCartStore((s) => s.addItem);
  const config = useConfigStore((s) => s.config);

  const total = useMemo(() => {
    if (!product) return 0;
    const optionsPrice = Object.values(selected)
      .flat()
      .reduce((sum, itemId) => {
        for (const group of optionGroups) {
          const item = group.items.find((i) => i.id === itemId);
          if (item) return sum + Number(item.price);
        }
        return sum;
      }, 0);
    return (Number(product.price) + optionsPrice) * quantity;
  }, [product, selected, optionGroups, quantity]);

  if (!product) return null;

  const toggleItem = (group: ProductOptionGroup, itemId: string) => {
    const current = selected[group.id] || [];
    if (group.multiple) {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      if (next.length > group.max_selections) {
        toast.error(`Máximo ${group.max_selections} opciones en "${group.name}"`);
        return;
      }
      setSelected({ ...selected, [group.id]: next });
    } else {
      setSelected({ ...selected, [group.id]: current.includes(itemId) ? [] : [itemId] });
    }
  };

  const handleAdd = () => {
    const selectedOptions: SelectedOption[] = [];
    for (const group of optionGroups) {
      const ids = selected[group.id] || [];
      const minRequired = group.required ? Math.max(group.min_selections, 1) : group.min_selections;
      if (ids.length < minRequired) {
        toast.error(`Seleccioná al menos ${minRequired} opción${minRequired > 1 ? 'es' : ''} en "${group.name}"`);
        return;
      }
      for (const itemId of ids) {
        const item = group.items.find((i) => i.id === itemId);
        if (item) {
          selectedOptions.push({
            group_name: group.name,
            item_name: item.name,
            price: Number(item.price),
          });
        }
      }
    }
    addItem(product, quantity, selectedOptions, notes || undefined);
    toast.success(`${product.name} agregado`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Imagen */}
        <div className="relative h-52 shrink-0 bg-gray-100">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary-light">
              {config.logo_url ? (
                <img src={config.logo_url} alt={config.site_name} className="h-32 w-32 rounded-full object-cover" />
              ) : (
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white text-5xl font-bold">
                  {config.site_name.charAt(0)}
                </span>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
          {product.description && (
            <p className="text-gray-500 mt-1 text-sm leading-relaxed">{product.description}</p>
          )}

          {/* Grupos de opciones */}
          {optionGroups.map((group) => (
            <div key={group.id} className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-gray-900">{group.name}</h3>
                {group.required && (
                  <span className="text-xs font-semibold bg-primary-light text-primary px-2 py-0.5 rounded-full">
                    Obligatorio
                  </span>
                )}
                {group.multiple && group.max_selections > 1 && (
                  <span className="text-xs text-gray-400">(hasta {group.max_selections})</span>
                )}
              </div>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const isSelected = (selected[group.id] || []).includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(group, item.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-primary-light'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-md border-2',
                            group.multiple ? 'rounded' : 'rounded-full',
                            isSelected ? 'border-primary bg-primary text-white' : 'border-gray-300'
                          )}
                        >
                          {isSelected && <Plus className="h-3.5 w-3.5 rotate-45" />}
                        </span>
                        <span className="font-medium text-sm">{item.name}</span>
                      </span>
                      {Number(item.price) > 0 && (
                        <span className="text-sm font-semibold text-gray-700">
                          +{formatPrice(Number(item.price))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notas */}
          <div className="mt-5">
            <label className="label">Nota para este producto (opcional)</label>
            <input
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: sin huevo, bien cocido..."
            />
          </div>
        </div>

        {/* Footer fijo */}
        <div className="shrink-0 border-t border-gray-100 p-4 flex items-center gap-3 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-2.5 rounded-xl border-2 border-gray-200 hover:border-primary"
              aria-label="Restar"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="font-bold text-lg w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-2.5 rounded-xl border-2 border-gray-200 hover:border-primary"
              aria-label="Sumar"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button onClick={handleAdd} className="btn-primary flex-1 py-3 text-base">
            Agregar · {formatPrice(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
