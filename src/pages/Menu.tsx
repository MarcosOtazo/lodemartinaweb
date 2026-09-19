import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Category, Product, ProductCategory, ProductOptionGroup } from '../types';
import { cn } from '../lib/utils';
import { useProductOptions } from '../hooks/useProductOptions';
import ProductRow from '../components/ProductRow';
import ProductModal from '../components/ProductModal';

const FALLBACK_EMOJIS: Record<string, string> = {
  hamburguesas: '🍔',
  tostadas: '🥪',
  combos: '🍟',
  bebidas: '🥤',
};

export default function Menu() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('categoria');
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<ProductCategory>(
    (param as ProductCategory) || 'hamburguesas'
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (param && param.trim()) {
      setActiveCategory(param as ProductCategory);
    }
  }, [param]);

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setCategories((data || []) as Category[]));
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('products')
      .select('*')
      .eq('category', activeCategory)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setProducts(data || []);
        setLoading(false);
      });
  }, [activeCategory]);

  const { groups } = useProductOptions(products.map((p) => p.id));
  const modalGroups: ProductOptionGroup[] = selectedProduct ? groups[selectedProduct.id] || [] : [];

  const handleCategory = (cat: ProductCategory) => {
    setActiveCategory(cat);
    setSearchParams({ categoria: cat });
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="container-main py-4 sm:py-6 max-w-3xl">
      {/* Volver */}
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-primary transition-colors mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      {/* Tabs de categorías (scroll horizontal en mobile) */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4 sticky top-16 bg-gray-50 z-30 pt-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategory(cat.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-colors shrink-0',
              activeCategory === cat.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
            )}
          >
            <span>{FALLBACK_EMOJIS[cat.id] || '🍽️'}</span>
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white border border-gray-100 p-3 animate-pulse flex gap-4">
              <div className="h-20 w-20 rounded-xl bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-5 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 card">
          <span className="text-6xl block mb-4">{FALLBACK_EMOJIS[activeCategory] || '🍽️'}</span>
          <h2 className="text-xl font-bold text-gray-900">No hay productos en esta categoría</h2>
          <p className="text-gray-500 mt-2">Pronto vamos a estar cargando novedades. ¡Volvé a mirar!</p>
        </div>
      ) : (
        <div className="space-y-3 pb-8">
          {products.map((product) => (
            <ProductRow key={product.id} product={product} onOpen={setSelectedProduct} />
          ))}
        </div>
      )}

      <ProductModal
        product={selectedProduct}
        optionGroups={modalGroups}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
