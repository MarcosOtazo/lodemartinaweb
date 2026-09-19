import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Category, Product, ProductCategory } from '../../types';
import { formatPrice, cn } from '../../lib/utils';
import { Plus, Pencil, Trash2, X, Search, Tags } from 'lucide-react';

type OptionItemDraft = {
  id?: string;
  name: string;
  price: number;
  _deleted?: boolean;
};

type OptionGroupDraft = {
  id?: string;
  name: string;
  required: boolean;
  multiple: boolean;
  min_selections: number;
  max_selections: number;
  items: OptionItemDraft[];
  _deleted?: boolean;
};

type CategoryUpdate = {
  name?: string;
  image_url?: string | null;
  sort_order?: number;
};

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  price: 0,
  category: 'hamburguesas' as ProductCategory,
  image_url: null as string | null,
  is_active: true,
  sort_order: 0,
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `cat-${Date.now()}`;
}

export default function AdminProducts() {
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | typeof EMPTY_PRODUCT | null>(null);
  const [optionGroups, setOptionGroups] = useState<OptionGroupDraft[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<ProductCategory | 'all'>('all');

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('category')
      .order('sort_order');
    setProducts((data || []) as Product[]);
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');
    setCategories((data || []) as Category[]);
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const openEditor = async (product: Product | null) => {
    setImageFile(null);
    setOptionsError(null);
    if (product) {
      const { data, error } = await supabase
        .from('product_options')
        .select('*, option_items(*)')
        .eq('product_id', product.id)
        .order('sort_order');
      if (error) {
        console.error('Error al cargar opciones:', error.message);
        setOptionGroups([]);
        setOptionsError(error.message);
      } else {
        const rows = (data || []) as unknown as Array<{
          id: string;
          name: string;
          required: boolean;
          multiple: boolean;
          min_selections: number;
          max_selections: number;
          option_items: Array<{ id: string; name: string; price: number }>;
        }>;
        const groups: OptionGroupDraft[] = rows.map((g) => ({
          id: g.id,
          name: g.name,
          required: g.required,
          multiple: g.multiple,
          min_selections: g.min_selections,
          max_selections: g.max_selections,
          items:
            g.option_items.length > 0
              ? g.option_items.map((it) => ({ id: it.id, name: it.name, price: Number(it.price) }))
              : [{ name: '', price: 0 }],
        }));
        setOptionGroups(groups);
      }
      setEditing(product);
    } else {
      setOptionGroups([]);
      setEditing({ ...EMPTY_PRODUCT });
    }
  };

  const saveOptionGroups = async (productId: string) => {
    for (const group of optionGroups) {
      if (group._deleted) {
        if (group.id) {
          const { error } = await supabase.from('product_options').delete().eq('id', group.id);
          if (error) throw error;
        }
        continue;
      }
      if (!group.name.trim()) continue;

      let groupId = group.id;
      if (groupId) {
        const { error } = await supabase
          .from('product_options')
          .update({
            name: group.name,
            required: group.required,
            multiple: group.multiple,
            min_selections: group.min_selections,
            max_selections: group.max_selections,
          })
          .eq('id', groupId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('product_options')
          .insert({
            product_id: productId,
            name: group.name,
            required: group.required,
            multiple: group.multiple,
            min_selections: group.min_selections,
            max_selections: group.max_selections,
            sort_order: optionGroups.indexOf(group),
          })
          .select()
          .single();
        if (error) throw error;
        groupId = data.id;
      }

      for (const item of group.items) {
        if (item._deleted) {
          if (item.id) {
            const { error } = await supabase.from('option_items').delete().eq('id', item.id);
            if (error) throw error;
          }
          continue;
        }
        if (!item.name.trim()) continue;
        if (item.id) {
          const { error } = await supabase
            .from('option_items')
            .update({ name: item.name, price: item.price })
            .eq('id', item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('option_items').insert({
            option_id: groupId,
            name: item.name,
            price: item.price,
            sort_order: group.items.indexOf(item),
          });
          if (error) throw error;
        }
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (editing.price <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }
    setSaving(true);

    try {
      let imageUrl = editing.image_url;

      if (imageFile) {
        if (editing.image_url) {
          const oldPath = editing.image_url.split('/').pop();
          if (oldPath) await supabase.storage.from('product-images').remove([oldPath]);
        }
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `prod-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        imageUrl = publicUrl.publicUrl;
      }

      let productId: string;

      if ('id' in editing) {
        productId = editing.id;
        const { error } = await supabase
          .from('products')
          .update({
            name: editing.name,
            description: editing.description,
            price: editing.price,
            category: editing.category,
            image_url: imageUrl,
            is_active: editing.is_active,
            sort_order: editing.sort_order,
          })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Producto actualizado');
      } else {
        const { data, error } = await supabase.from('products').insert({
          name: editing.name,
          description: editing.description,
          price: editing.price,
          category: editing.category,
          image_url: imageUrl,
          is_active: editing.is_active,
          sort_order: editing.sort_order,
        }).select().single();
        if (error) throw error;
        productId = data.id;
        toast.success('Producto creado');
      }

      await saveOptionGroups(productId);

      setEditing(null);
      setOptionGroups([]);
      setImageFile(null);
      loadProducts();
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) {
      toast.error('Error al eliminar');
      return;
    }
    if (product.image_url) {
      const path = product.image_url.split('/').pop();
      if (path) await supabase.storage.from('product-images').remove([path]);
    }
    toast.success('Producto eliminado');
    loadProducts();
  };

  const updateCategory = async (cat: Category, updates: CategoryUpdate) => {
    const { error } = await supabase.from('categories').update(updates).eq('id', cat.id);
    if (error) {
      toast.error('Error al guardar la categoría');
      return;
    }
    toast.success('Categoría actualizada');
    loadCategories();
  };

  const uploadCategoryImage = async (cat: Category, file: File) => {
    try {
      if (cat.image_url) {
        const oldPath = cat.image_url.split('/').pop();
        if (oldPath) await supabase.storage.from('product-images').remove([oldPath]);
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `cat-${cat.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      await updateCategory(cat, { image_url: publicUrl.publicUrl });
    } catch (error) {
      console.error(error);
      toast.error('Error al subir la imagen');
    }
  };

  const addCategory = async () => {
    const name = prompt('Nombre de la nueva categoría:');
    if (!name || !name.trim()) return;
    const id = slugify(name.trim());
    const { error } = await supabase
      .from('categories')
      .insert({ id, name: name.trim(), sort_order: categories.length + 1 });
    if (error) {
      if (error.code === '23505') toast.error('Ya existe una categoría con ese nombre');
      else toast.error('Error al crear la categoría');
      return;
    }
    toast.success('Categoría creada');
    loadCategories();
  };

  const deleteCategory = async (cat: Category) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"? Los productos que la usen quedarán sin categoría.`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', cat.id);
    if (error) {
      toast.error('Error al eliminar la categoría');
      return;
    }
    toast.success('Categoría eliminada');
    loadCategories();
  };

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('categories')}
            className={cn('btn-secondary', tab === 'categories' && 'bg-primary text-white hover:bg-primary-hover')}
          >
            <Tags className="h-4 w-4" /> Categorías
          </button>
          <button
            onClick={() => setTab('products')}
            className={cn('btn-secondary', tab === 'products' && 'bg-primary text-white hover:bg-primary-hover')}
          >
            Productos
          </button>
          {tab === 'products' && (
            <button onClick={() => openEditor(null)} className="btn-primary">
              <Plus className="h-4 w-4" /> Nuevo producto
            </button>
          )}
        </div>
      </div>

      {tab === 'categories' ? (
        /* ============ CATEGORÍAS ============ */
        <>
          <div className="flex justify-end mb-4">
            <button onClick={addCategory} className="btn-primary">
              <Plus className="h-4 w-4" /> Nueva categoría
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="card p-4">
                <div className="flex items-center gap-4">
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="h-20 w-20 rounded-xl object-cover" />
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-gray-100 flex items-center justify-center text-3xl">
                      🍽️
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <label className="label">Nombre</label>
                    <input
                      className="input"
                      value={cat.name}
                      onChange={(e) => updateCategory(cat, { name: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={() => deleteCategory(cat)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 self-start shrink-0"
                    aria-label="Eliminar categoría"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3">
                  <label className="btn-secondary cursor-pointer w-full">
                    {cat.image_url ? 'Cambiar imagen' : 'Subir imagen'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadCategoryImage(cat, f);
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ============ PRODUCTOS ============ */
        <>
          <div className="flex gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input w-auto"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as ProductCategory | 'all')}
            >
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-16 w-16 bg-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <span className="text-5xl block mb-3">🍽️</span>
              <p className="font-semibold">No hay productos</p>
              <p className="text-sm text-gray-500 mt-1">Creá tu primer producto con el botón "Nuevo producto"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((product) => (
                <div key={product.id} className="card p-4 flex items-center gap-4">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                      🍽️
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold truncate">{product.name}</p>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                        {categories.find((c) => c.id === product.category)?.name || product.category}
                      </span>
                      {!product.is_active && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-xs font-medium text-red-700">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{product.description || 'Sin descripción'}</p>
                  </div>
                  <p className="font-bold text-primary whitespace-nowrap">{formatPrice(product.price)}</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditor(product)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal editar/crear producto */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">
                {'id' in editing ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setEditing(null)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ej: Hamburguesa Clásica"
                  required
                />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea
                  className="input min-h-[80px] resize-y"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Medallón de carne, queso, lechuga, tomate..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Precio *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <select
                    className="input"
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value as ProductCategory })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Orden (menor = primero)</label>
                  <input
                    type="number"
                    className="input"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select
                    className="input"
                    value={editing.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.value === 'active' })}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Foto del producto</label>
                <div className="flex items-center gap-4">
                  {(imageFile || editing.image_url) && (
                    <img
                      src={imageFile ? URL.createObjectURL(imageFile) : editing.image_url!}
                      alt="Preview"
                      className="h-20 w-20 rounded-lg object-cover border border-gray-200"
                    />
                  )}
                  <label className="btn-secondary cursor-pointer">
                    {imageFile ? 'Cambiar foto' : editing.image_url ? 'Cambiar foto' : 'Subir foto'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>

              {/* ===== OPCIONES / VARIANTES ===== */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">
                    Opciones y variantes{' '}
                    {optionGroups.length > 0 && (
                      <span className="text-sm font-normal text-gray-400">({optionGroups.length} grupo{optionGroups.length > 1 ? 's' : ''})</span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setOptionGroups([
                        ...optionGroups,
                        {
                          name: '',
                          required: false,
                          multiple: true,
                          min_selections: 0,
                          max_selections: 99,
                          items: [{ name: '', price: 0 }],
                        },
                      ])
                    }
                    className="btn-secondary text-sm"
                  >
                    <Plus className="h-4 w-4" /> Agregar grupo
                  </button>
                </div>
                <p className="text-xs text-gray-400 -mt-1 mb-3">
                  El grupo es la pregunta (ej: "¿Extras?", "¿Tamaño?"). Adentro van las variantes con
                  su nombre y precio extra (ej: Bacon +$500). Con "Única opción" el cliente elige una
                  sola; con "Obligatorio" no puede avanzar sin elegir.
                </p>
                {optionsError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-3">
                    Error al cargar las opciones: {optionsError}
                  </p>
                )}

                <div className="space-y-4">
                  {optionGroups.map((group, gi) =>
                    group._deleted ? null : (
                    <div key={gi} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          className="input flex-1"
                          value={group.name}
                          onChange={(e) => {
                            const next = [...optionGroups];
                            next[gi] = { ...group, name: e.target.value };
                            setOptionGroups(next);
                          }}
                          placeholder="Nombre del grupo (ej: Extras)"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...optionGroups];
                            next[gi] = { ...group, _deleted: true };
                            setOptionGroups(next);
                          }}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                          aria-label="Eliminar grupo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={group.required}
                            onChange={(e) => {
                              const next = [...optionGroups];
                              next[gi] = { ...group, required: e.target.checked };
                              setOptionGroups(next);
                            }}
                          />
                          Obligatorio
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!group.multiple}
                            onChange={(e) => {
                              const next = [...optionGroups];
                              next[gi] = { ...group, multiple: !e.target.checked };
                              setOptionGroups(next);
                            }}
                          />
                          Única opción
                        </label>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((item, ii) =>
                          item._deleted ? null : (
                          <div key={ii} className="flex items-center gap-2">
                            <input
                              className="input flex-1"
                              value={item.name}
                              onChange={(e) => {
                                const next = [...optionGroups];
                                const items = [...group.items];
                                items[ii] = { ...item, name: e.target.value };
                                next[gi] = { ...group, items };
                                setOptionGroups(next);
                              }}
                              placeholder="Nombre de la variante (ej: Bacon)"
                            />
                            <div className="relative w-32 shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">+$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input pl-8"
                                value={item.price}
                                onChange={(e) => {
                                  const next = [...optionGroups];
                                  const items = [...group.items];
                                  items[ii] = { ...item, price: Number(e.target.value) };
                                  next[gi] = { ...group, items };
                                  setOptionGroups(next);
                                }}
                                placeholder="0"
                                title="Precio extra de esta variante"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...optionGroups];
                                const items = [...group.items];
                                items[ii] = { ...item, _deleted: true };
                                next[gi] = { ...group, items };
                                setOptionGroups(next);
                              }}
                              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 shrink-0"
                              aria-label="Eliminar variante"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...optionGroups];
                            next[gi] = { ...group, items: [...group.items, { name: '', price: 0 }] };
                            setOptionGroups(next);
                          }}
                          className="text-sm text-primary font-semibold hover:underline"
                        >
                          + Agregar variante
                        </button>
                      </div>
                    </div>
                    )
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
