import type { Product } from '../types';
import { useConfigStore } from '../store/config';
import { formatPrice } from '../lib/utils';

interface ProductRowProps {
  product: Product;
  onOpen: (product: Product) => void;
}

export default function ProductRow({ product, onOpen }: ProductRowProps) {
  const config = useConfigStore((s) => s.config);

  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      className="w-full flex items-center gap-4 p-3 rounded-2xl bg-white border border-gray-100 hover:border-primary hover:shadow-sm transition-all text-left"
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover shrink-0 bg-gray-100"
          loading="lazy"
        />
      ) : (
        <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl bg-primary-light flex items-center justify-center shrink-0 overflow-hidden">
          {config.logo_url ? (
            <img src={config.logo_url} alt={config.site_name} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white text-xl font-bold">
              {config.site_name.charAt(0)}
            </span>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-gray-900 leading-snug">{product.name}</h3>
        {product.description && (
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>
        )}
        <p className="font-extrabold text-primary mt-1.5 text-lg">{formatPrice(product.price)}</p>
      </div>
      <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white font-bold text-xl shadow-sm">
        +
      </span>
    </button>
  );
}
