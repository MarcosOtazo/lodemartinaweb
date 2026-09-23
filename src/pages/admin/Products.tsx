import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useConfigStore } from '../../store/config';
import type { Category, Insumo, Product, ProductCategory, Receta } from '../../types';
import { formatPrice, cn, compatibleUnits, toBaseQuantity, fromBaseQuantity, unitCostOf } from '../../lib/utils';
import { Plus, Pencil, Trash2, X, Search, Tags, ChefHat, Wallet, Copy, Package } from 'lucide-react';

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
  receta_id: null as string | null,
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
  const config = useConfigStore((s) => s.config);
  const [tab, setTab] = useState<'products' | 'categories' | 'insumos' | 'recetas'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [recetas, setRecetas] = useState<(Receta & { cost: number; ingredients: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | typeof EMPTY_PRODUCT | null>(null);
  const [optionGroups, setOptionGroups] = useState<OptionGroupDraft[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<ProductCategory | 'all'>('all');
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [insumoDraft, setInsumoDraft] = useState<{
    id?: string;
    name: string;
    unit: string;
    cost: number;
    category: string;
    quantity: number;
  } | null>(null);
  const [insumoSaving, setInsumoSaving] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<{ id?: string; name: string } | null>(null);
  const [recipeRows, setRecipeRows] = useState<
    { id?: string; insumo_id: string; unit: string; quantity: number; _deleted?: boolean }[]
  >([]);
  const [subRows, setSubRows] = useState<
    { id?: string; subreceta_id: string; _deleted?: boolean }[]
  >([]);
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [productRecipeRows, setProductRecipeRows] = useState<
    { id?: string; receta_id: string; _deleted?: boolean }[]
  >([]);
  const [productInsumoRows, setProductInsumoRows] = useState<
    { id?: string; insumo_id: string; unit: string; quantity: number; _deleted?: boolean }[]
  >([]);
  const [itemInsumoRows, setItemInsumoRows] = useState<
    Record<string, { id?: string; insumo_id: string; unit: string; quantity: number; _deleted?: boolean }[]>
  >({});
  const [variantInsumoDraft, setVariantInsumoDraft] = useState<{ key: string; itemName: string } | null>(null);
  const [productCosts, setProductCosts] = useState<Record<string, number>>({});
  const [recipeUsage, setRecipeUsage] = useState<Record<string, number>>({});

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
    const cats = (data || []) as Category[];
    setCategories(cats);
    setCategoryNames((prev) => {
      const next = { ...prev };
      cats.forEach((c) => {
        if (next[c.id] === undefined) next[c.id] = c.name;
      });
      return next;
    });
  };

  const loadInsumos = async () => {
    const { data } = await supabase.from('insumos').select('*').order('name');
    setInsumos((data || []) as Insumo[]);
  };

  const loadRecetas = async () => {
    const [rRes, ingRes, subRes, prRes, piRes, iRes, oiRes, viiRes, poRes] = await Promise.all([
      supabase.from('recetas').select('*').order('name'),
      supabase.from('receta_ingredientes').select('*'),
      supabase.from('receta_subrecetas').select('*'),
      supabase.from('producto_recetas').select('*'),
      supabase.from('producto_insumos').select('*'),
      supabase.from('insumos').select('*'),
      supabase.from('option_items').select('*'),
      supabase.from('option_item_insumos').select('*'),
      supabase.from('product_options').select('*'),
    ]);
    const insumosData = (iRes.data || []) as Insumo[];
    const costMap = new Map(insumosData.map((i) => [i.id, unitCostOf(i)]));
    const ingredients = (ingRes.data || []) as unknown as {
      receta_id: string;
      insumo_id: string;
      quantity: number;
    }[];
    const subs = (subRes.data || []) as unknown as { receta_id: string; subreceta_id: string }[];
    const prodRecetas = (prRes.data || []) as unknown as { product_id: string; receta_id: string }[];
    const prodInsumos = (piRes.data || []) as unknown as {
      product_id: string;
      insumo_id: string;
      quantity: number;
    }[];

    const ingMap = new Map<string, { insumo_id: string; quantity: number }[]>();
    ingredients.forEach((ing) => {
      if (!ingMap.has(ing.receta_id)) ingMap.set(ing.receta_id, []);
      ingMap.get(ing.receta_id)!.push({ insumo_id: ing.insumo_id, quantity: Number(ing.quantity) });
    });
    const subMap = new Map<string, string[]>();
    subs.forEach((s) => {
      if (!subMap.has(s.receta_id)) subMap.set(s.receta_id, []);
      subMap.get(s.receta_id)!.push(s.subreceta_id);
    });

    const recetaCostMap = new Map<string, number>();
    const costOf = (id: string, visited: Set<string>): number => {
      if (recetaCostMap.has(id)) return recetaCostMap.get(id)!;
      if (visited.has(id)) return 0;
      visited.add(id);
      let cost = (ingMap.get(id) || []).reduce(
        (s, ing) => s + (costMap.get(ing.insumo_id) || 0) * ing.quantity,
        0
      );
      cost += (subMap.get(id) || []).reduce((s, sub) => s + costOf(sub, visited), 0);
      recetaCostMap.set(id, cost);
      return cost;
    };
    const recetasData = (rRes.data || []) as Receta[];
    recetasData.forEach((r) => costOf(r.id, new Set()));

    setRecetas(
      recetasData.map((r) => ({
        ...r,
        cost: recetaCostMap.get(r.id) || 0,
        ingredients: (ingMap.get(r.id) || []).length + (subMap.get(r.id) || []).length,
      }))
    );

    const byProduct = new Map<string, number>();
    const usage = new Map<string, number>();
    prodRecetas.forEach((pr) => {
      const cur = byProduct.get(pr.product_id) || 0;
      byProduct.set(pr.product_id, cur + (recetaCostMap.get(pr.receta_id) || 0));
      usage.set(pr.receta_id, (usage.get(pr.receta_id) || 0) + 1);
    });
    prodInsumos.forEach((pi) => {
      const cur = byProduct.get(pi.product_id) || 0;
      byProduct.set(pi.product_id, cur + (costMap.get(pi.insumo_id) || 0) * Number(pi.quantity));
    });

    // Costo de las variantes por producto (se suman todas)
    const optionItems = (oiRes.data || []) as unknown as Array<{ id: string; option_id: string }>;
    const optionInsumos = (viiRes.data || []) as unknown as Array<{
      option_item_id: string;
      insumo_id: string;
      quantity: number;
    }>;
    const productOptions = (poRes.data || []) as unknown as Array<{ id: string; product_id: string }>;

    const itemCost = new Map<string, number>();
    optionInsumos.forEach((oi) => {
      const cur = itemCost.get(oi.option_item_id) || 0;
      itemCost.set(oi.option_item_id, cur + (costMap.get(oi.insumo_id) || 0) * Number(oi.quantity));
    });
    const optionToProduct = new Map<string, string>();
    productOptions.forEach((po) => optionToProduct.set(po.id, po.product_id));
    optionItems.forEach((it) => {
      const productId = optionToProduct.get(it.option_id);
      if (!productId) return;
      const cost = itemCost.get(it.id) || 0;
      if (cost > 0) {
        byProduct.set(productId, (byProduct.get(productId) || 0) + cost);
      }
    });

    setProductCosts(Object.fromEntries(byProduct));
    setRecipeUsage(Object.fromEntries(usage));
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadInsumos();
    loadRecetas();
  }, []);

  const saveInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insumoDraft) return;
    if (!insumoDraft.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setInsumoSaving(true);
    const { error } = insumoDraft.id
      ? await supabase
          .from('insumos')
          .update({
            name: insumoDraft.name.trim(),
            unit: insumoDraft.unit.trim() || 'unidad',
            cost: insumoDraft.cost,
            category: insumoDraft.category.trim() || 'Otros',
            quantity: insumoDraft.quantity > 0 ? insumoDraft.quantity : 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', insumoDraft.id)
      : await supabase.from('insumos').insert({
          name: insumoDraft.name.trim(),
          unit: insumoDraft.unit.trim() || 'unidad',
          cost: insumoDraft.cost,
          category: insumoDraft.category.trim() || 'Otros',
          quantity: insumoDraft.quantity > 0 ? insumoDraft.quantity : 1,
        });
    setInsumoSaving(false);
    if (error) {
      toast.error('Error al guardar el insumo');
      return;
    }
    toast.success(insumoDraft.id ? 'Insumo actualizado' : 'Insumo creado');
    setInsumoDraft(null);
    loadInsumos();
  };

  const deleteInsumo = async (insumo: Insumo) => {
    if (!confirm(`¿Eliminar "${insumo.name}"? Se va a quitar de todas las recetas que lo usen.`)) return;
    const { error } = await supabase.from('insumos').delete().eq('id', insumo.id);
    if (error) {
      toast.error('Error al eliminar el insumo');
      return;
    }
    toast.success('Insumo eliminado');
    loadInsumos();
    loadRecetas();
  };

  const openRecipeDraft = async (receta: (Receta & { cost: number; ingredients: number }) | null) => {
    if (receta) {
      const [ingRes, subRes] = await Promise.all([
        supabase.from('receta_ingredientes').select('*').eq('receta_id', receta.id).order('created_at'),
        supabase.from('receta_subrecetas').select('*').eq('receta_id', receta.id).order('created_at'),
      ]);
      setRecipeRows(
        ((ingRes.data || []) as unknown as { id: string; insumo_id: string; quantity: number; unit: string }[]).map(
          (r) => {
            const insumo = insumos.find((i) => i.id === r.insumo_id);
            const unit = r.unit && compatibleUnits(insumo?.unit || r.unit).includes(r.unit) ? r.unit : insumo?.unit || 'unidad';
            return {
              id: r.id,
              insumo_id: r.insumo_id,
              unit,
              quantity: Number(fromBaseQuantity(insumo?.unit || unit, unit, Number(r.quantity)).toFixed(4)),
            };
          }
        )
      );
      setSubRows(
        ((subRes.data || []) as unknown as { id: string; subreceta_id: string }[]).map((s) => ({
          id: s.id,
          subreceta_id: s.subreceta_id,
        }))
      );
      setRecipeDraft({ id: receta.id, name: receta.name });
    } else {
      setRecipeRows([{ insumo_id: '', unit: 'unidad', quantity: 0 }]);
      setSubRows([]);
      setRecipeDraft({ name: '' });
    }
  };

  const saveReceta = async () => {
    if (!recipeDraft) return;
    if (!recipeDraft.name.trim()) {
      toast.error('Ponle un nombre a la receta');
      return;
    }
    setRecipeSaving(true);
    try {
      let recetaId = recipeDraft.id;
      if (recetaId) {
        const { error } = await supabase
          .from('recetas')
          .update({ name: recipeDraft.name.trim(), updated_at: new Date().toISOString() })
          .eq('id', recetaId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('recetas')
          .insert({ name: recipeDraft.name.trim() })
          .select()
          .single();
        if (error) throw error;
        recetaId = data.id;
      }
      for (const row of recipeRows) {
        if (row._deleted) {
          if (row.id) await supabase.from('receta_ingredientes').delete().eq('id', row.id);
          continue;
        }
        if (!row.insumo_id || Number(row.quantity) <= 0) continue;
        const insumo = insumos.find((i) => i.id === row.insumo_id);
        const baseQty = insumo ? toBaseQuantity(insumo.unit, row.unit, Number(row.quantity)) : Number(row.quantity);
        if (row.id) {
          const { error } = await supabase
            .from('receta_ingredientes')
            .update({ insumo_id: row.insumo_id, quantity: baseQty, unit: row.unit })
            .eq('id', row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('receta_ingredientes').insert({
            receta_id: recetaId,
            insumo_id: row.insumo_id,
            quantity: baseQty,
            unit: row.unit,
          });
          if (error) throw error;
        }
      }
      for (const row of subRows) {
        if (row._deleted) {
          if (row.id) await supabase.from('receta_subrecetas').delete().eq('id', row.id);
          continue;
        }
        if (!row.subreceta_id || row.subreceta_id === recetaId) continue;
        if (row.id) {
          const { error } = await supabase
            .from('receta_subrecetas')
            .update({ subreceta_id: row.subreceta_id })
            .eq('id', row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('receta_subrecetas').insert({
            receta_id: recetaId,
            subreceta_id: row.subreceta_id,
          });
          if (error) throw error;
        }
      }
      toast.success('Receta guardada');
      setRecipeDraft(null);
      loadRecetas();
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar la receta');
    } finally {
      setRecipeSaving(false);
    }
  };

  const deleteReceta = async (receta: Receta) => {
    if (!confirm(`¿Eliminar la receta "${receta.name}"? Los productos que la usan van a quedar sin receta.`)) return;
    const { error } = await supabase.from('recetas').delete().eq('id', receta.id);
    if (error) {
      toast.error('Error al eliminar la receta');
      return;
    }
    toast.success('Receta eliminada');
    loadRecetas();
    loadProducts();
  };

  const recipeCost = recipeRows.reduce((s, row) => {
    if (row._deleted || !row.insumo_id) return s;
    const insumo = insumos.find((i) => i.id === row.insumo_id);
    if (!insumo) return s;
    const baseQty = toBaseQuantity(insumo.unit, row.unit, Number(row.quantity || 0));
    return s + unitCostOf(insumo) * baseQty;
  }, 0);
  const subCost = subRows.reduce((s, row) => {
    if (row._deleted || !row.subreceta_id) return s;
    const receta = recetas.find((r) => r.id === row.subreceta_id);
    return s + (receta ? receta.cost : 0);
  }, 0);
  const totalRecipeCost = recipeCost + subCost;

  const openEditor = async (product: Product | null) => {
    setImageFile(null);
    setOptionsError(null);
    if (product) {
      const [optRes, prRes, piRes] = await Promise.all([
        supabase.from('product_options').select('*, option_items(*)').eq('product_id', product.id).order('sort_order'),
        supabase.from('producto_recetas').select('*').eq('product_id', product.id),
        supabase.from('producto_insumos').select('*').eq('product_id', product.id),
      ]);
      const { data, error } = optRes;
      let loadedGroups: OptionGroupDraft[] = [];
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
        loadedGroups = rows.map((g) => ({
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
        setOptionGroups(loadedGroups);
      }
      setProductRecipeRows(
        ((prRes.data || []) as unknown as { id: string; receta_id: string }[]).map((r) => ({
          id: r.id,
          receta_id: r.receta_id,
        }))
      );
      setProductInsumoRows(
        ((piRes.data || []) as unknown as { id: string; insumo_id: string; quantity: number; unit: string }[]).map(
          (r) => {
            const insumo = insumos.find((i) => i.id === r.insumo_id);
            const unit =
              r.unit && compatibleUnits(insumo?.unit || r.unit).includes(r.unit) ? r.unit : insumo?.unit || 'unidad';
            return {
              id: r.id,
              insumo_id: r.insumo_id,
              unit,
              quantity: Number(fromBaseQuantity(insumo?.unit || unit, unit, Number(r.quantity)).toFixed(4)),
            };
          }
        )
      );
      setEditing(product);
      const itemIds = loadedGroups.flatMap((g) => g.items.filter((it) => it.id).map((it) => it.id as string));
      if (itemIds.length > 0) {
        const { data: vii } = await supabase
          .from('option_item_insumos')
          .select('*')
          .in('option_item_id', itemIds);
        const map: Record<string, { id?: string; insumo_id: string; unit: string; quantity: number; _deleted?: boolean }[]> = {};
        for (const row of (vii || []) as unknown as {
          id: string;
          option_item_id: string;
          insumo_id: string;
          quantity: number;
          unit: string;
        }[]) {
          const insumo = insumos.find((i) => i.id === row.insumo_id);
          const unit = row.unit && compatibleUnits(insumo?.unit || row.unit).includes(row.unit) ? row.unit : insumo?.unit || 'unidad';
          if (!map[row.option_item_id]) map[row.option_item_id] = [];
          map[row.option_item_id].push({
            id: row.id,
            insumo_id: row.insumo_id,
            unit,
            quantity: Number(fromBaseQuantity(insumo?.unit || unit, unit, Number(row.quantity)).toFixed(4)),
          });
        }
        setItemInsumoRows(map);
      } else {
        setItemInsumoRows({});
      }
    } else {
      setOptionGroups([]);
      setProductRecipeRows([]);
      setProductInsumoRows([]);
      setItemInsumoRows({});
      setEditing({ ...EMPTY_PRODUCT });
    }
  };

  const saveOptionGroups = async (productId: string) => {
    for (let gi = 0; gi < optionGroups.length; gi++) {
      const group = optionGroups[gi];
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
            sort_order: gi,
          })
          .select()
          .single();
        if (error) throw error;
        groupId = data.id;
      }

      for (let ii = 0; ii < group.items.length; ii++) {
        const item = group.items[ii];
        if (item._deleted) {
          if (item.id) {
            const { error } = await supabase.from('option_items').delete().eq('id', item.id);
            if (error) throw error;
          }
          continue;
        }
        if (!item.name.trim()) continue;

        let itemId = item.id;
        if (itemId) {
          const { error } = await supabase
            .from('option_items')
            .update({ name: item.name, price: item.price })
            .eq('id', itemId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('option_items')
            .insert({
              option_id: groupId,
              name: item.name,
              price: item.price,
              sort_order: ii,
            })
            .select()
            .single();
          if (error) throw error;
          itemId = data.id;
        }

        const key = item.id || `new-${gi}-${ii}`;
        const rows = itemInsumoRows[key] || [];
        for (const row of rows) {
          if (row._deleted) {
            if (row.id) await supabase.from('option_item_insumos').delete().eq('id', row.id);
            continue;
          }
          if (!row.insumo_id || Number(row.quantity) <= 0) continue;
          const insumo = insumos.find((i) => i.id === row.insumo_id);
          const baseQty = insumo ? toBaseQuantity(insumo.unit, row.unit, Number(row.quantity)) : Number(row.quantity);
          if (row.id) {
            const { error } = await supabase
              .from('option_item_insumos')
              .update({ insumo_id: row.insumo_id, quantity: baseQty, unit: row.unit })
              .eq('id', row.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('option_item_insumos').insert({
              option_item_id: itemId,
              insumo_id: row.insumo_id,
              quantity: baseQty,
              unit: row.unit,
            });
            if (error) throw error;
          }
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
      await saveProductCosts(productId);

      setEditing(null);
      setOptionGroups([]);
      setImageFile(null);
      loadProducts();
      loadRecetas();
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  const saveProductCosts = async (productId: string) => {
    for (const row of productRecipeRows) {
      if (row._deleted) {
        if (row.id) await supabase.from('producto_recetas').delete().eq('id', row.id);
        continue;
      }
      if (!row.receta_id) continue;
      if (row.id) {
        const { error } = await supabase
          .from('producto_recetas')
          .update({ receta_id: row.receta_id })
          .eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('producto_recetas').insert({
          product_id: productId,
          receta_id: row.receta_id,
        });
        if (error) throw error;
      }
    }
    for (const row of productInsumoRows) {
      if (row._deleted) {
        if (row.id) await supabase.from('producto_insumos').delete().eq('id', row.id);
        continue;
      }
      if (!row.insumo_id || Number(row.quantity) <= 0) continue;
      const insumo = insumos.find((i) => i.id === row.insumo_id);
      const baseQty = insumo ? toBaseQuantity(insumo.unit, row.unit, Number(row.quantity)) : Number(row.quantity);
      if (row.id) {
        const { error } = await supabase
          .from('producto_insumos')
          .update({ insumo_id: row.insumo_id, quantity: baseQty, unit: row.unit })
          .eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('producto_insumos').insert({
          product_id: productId,
          insumo_id: row.insumo_id,
          quantity: baseQty,
          unit: row.unit,
        });
        if (error) throw error;
      }
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

  const duplicateProduct = async (product: Product) => {
    try {
      const { data: newProd, error } = await supabase
        .from('products')
        .insert({
          name: `${product.name} (copia)`,
          description: product.description,
          price: product.price,
          category: product.category,
          image_url: product.image_url,
          is_active: product.is_active,
          sort_order: Number(product.sort_order) + 1,
        })
        .select()
        .single();
      if (error) throw error;
      const newId = newProd.id;

      const { data: opts } = await supabase
        .from('product_options')
        .select('*, option_items(*)')
        .eq('product_id', product.id);
      for (const g of (opts || []) as unknown as Array<{
        name: string;
        required: boolean;
        multiple: boolean;
        min_selections: number;
        max_selections: number;
        sort_order: number;
        option_items: Array<{ id: string; name: string; price: number; sort_order: number }>;
      }>) {
        const { data: newGroup, error: gErr } = await supabase
          .from('product_options')
          .insert({
            product_id: newId,
            name: g.name,
            required: g.required,
            multiple: g.multiple,
            min_selections: g.min_selections,
            max_selections: g.max_selections,
            sort_order: g.sort_order,
          })
          .select()
          .single();
        if (gErr) throw gErr;
        for (const it of g.option_items || []) {
          const { data: newItem, error: itErr } = await supabase
            .from('option_items')
            .insert({
              option_id: newGroup.id,
              name: it.name,
              price: Number(it.price),
              sort_order: it.sort_order,
            })
            .select()
            .single();
          if (itErr) throw itErr;
          const { data: vii } = await supabase
            .from('option_item_insumos')
            .select('*')
            .eq('option_item_id', it.id);
          for (const row of (vii || []) as unknown as {
            insumo_id: string;
            quantity: number;
            unit: string;
          }[]) {
            const { error: viErr } = await supabase.from('option_item_insumos').insert({
              option_item_id: newItem.id,
              insumo_id: row.insumo_id,
              quantity: row.quantity,
              unit: row.unit,
            });
            if (viErr) throw viErr;
          }
        }
      }

      const { data: prs } = await supabase
        .from('producto_recetas')
        .select('*')
        .eq('product_id', product.id);
      for (const r of (prs || []) as unknown as { receta_id: string }[]) {
        const { error: prErr } = await supabase.from('producto_recetas').insert({
          product_id: newId,
          receta_id: r.receta_id,
        });
        if (prErr) throw prErr;
      }

      const { data: pis } = await supabase
        .from('producto_insumos')
        .select('*')
        .eq('product_id', product.id);
      for (const i of (pis || []) as unknown as { insumo_id: string; quantity: number; unit: string }[]) {
        const { error: piErr } = await supabase.from('producto_insumos').insert({
          product_id: newId,
          insumo_id: i.insumo_id,
          quantity: i.quantity,
          unit: i.unit,
        });
        if (piErr) throw piErr;
      }

      toast.success('Producto duplicado');
      loadProducts();
      loadRecetas();
    } catch (error) {
      console.error(error);
      toast.error('Error al duplicar el producto');
    }
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
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTab('products')}
            className={cn('btn-secondary', tab === 'products' && 'bg-primary text-white hover:bg-primary-hover')}
          >
            Productos
          </button>
          <button
            onClick={() => setTab('categories')}
            className={cn('btn-secondary', tab === 'categories' && 'bg-primary text-white hover:bg-primary-hover')}
          >
            <Tags className="h-4 w-4" /> Categorías
          </button>
          <button
            onClick={() => setTab('insumos')}
            className={cn('btn-secondary', tab === 'insumos' && 'bg-primary text-white hover:bg-primary-hover')}
          >
            <Wallet className="h-4 w-4" /> Insumos
          </button>
          <button
            onClick={() => setTab('recetas')}
            className={cn('btn-secondary', tab === 'recetas' && 'bg-primary text-white hover:bg-primary-hover')}
          >
            <ChefHat className="h-4 w-4" /> Recetas
          </button>
          {tab === 'products' && (
            <button onClick={() => openEditor(null)} className="btn-primary">
              <Plus className="h-4 w-4" /> Nuevo producto
            </button>
          )}
          {tab === 'insumos' && (
            <button
              onClick={() => setInsumoDraft({ name: '', unit: 'unidad', cost: 0, category: 'Otros', quantity: 1 })}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" /> Nuevo insumo
            </button>
          )}
          {tab === 'recetas' && (
            <button onClick={() => openRecipeDraft(null)} className="btn-primary">
              <Plus className="h-4 w-4" /> Nueva receta
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
                      value={categoryNames[cat.id] ?? cat.name}
                      onChange={(e) =>
                        setCategoryNames((prev) => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      onBlur={() => {
                        const draft = (categoryNames[cat.id] ?? '').trim();
                        if (draft && draft !== cat.name) {
                          updateCategory(cat, { name: draft });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      placeholder="Nombre de la categoría"
                    />
                    {(categoryNames[cat.id] ?? cat.name) !== cat.name && (
                      <p className="text-xs text-primary mt-1">Tocá afuera o presioná Enter para guardar</p>
                    )}
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
      ) : tab === 'insumos' ? (
        /* ============ INSUMOS ============ */
        <>
          {insumos.length === 0 ? (
            <div className="card p-12 text-center">
              <span className="text-5xl block mb-3">🧾</span>
              <p className="font-semibold">Todavía no hay insumos cargados</p>
              <p className="text-sm text-gray-500 mt-1">
                Cargá tus materias primas con su costo (ej: Carne picada · kg · $10.000)
              </p>
              <button
                onClick={() => setInsumoDraft({ name: '', unit: 'unidad', cost: 0, category: 'Otros', quantity: 1 })}
                className="btn-primary mt-6"
              >
                <Plus className="h-4 w-4" /> Cargar primer insumo
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                const grouped = insumos.reduce<Record<string, Insumo[]>>((acc, i) => {
                  const cat = i.category || 'Otros';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(i);
                  return acc;
                }, {});
                return Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="text-lg">🧺</span> {cat}
                      <span className="text-xs font-normal text-gray-400">({items.length})</span>
                    </h3>
                    <div className="card overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-left">
                            <th className="px-6 py-3 font-semibold text-gray-500">Insumo</th>
                            <th className="px-6 py-3 font-semibold text-gray-500">Costo</th>
                            <th className="px-6 py-3 font-semibold text-gray-500">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((insumo) => {
                            const bulk = Number(insumo.quantity) || 1;
                            return (
                              <tr key={insumo.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-6 py-3">
                                  <p className="font-medium">{insumo.name}</p>
                                  {bulk > 1 && (
                                    <p className="text-xs text-gray-400">
                                      {bulk} {insumo.unit} a {formatPrice(Number(insumo.cost))}
                                    </p>
                                  )}
                                </td>
                                <td className="px-6 py-3 font-bold text-primary whitespace-nowrap">
                                  {formatPrice(unitCostOf(insumo))}{' '}
                                  <span className="text-xs text-gray-400 font-normal">/ {insumo.unit}</span>
                                </td>
                                <td className="px-6 py-3">
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() =>
                                        setInsumoDraft({
                                          id: insumo.id,
                                          name: insumo.name,
                                          unit: insumo.unit,
                                          cost: Number(insumo.cost),
                                          category: insumo.category || 'Otros',
                                          quantity: bulk,
                                        })
                                      }
                                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary"
                                      aria-label="Editar insumo"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteInsumo(insumo)}
                                      className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                                      aria-label="Eliminar insumo"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </>
      ) : tab === 'recetas' ? (
        /* ============ RECETAS ============ */
        <>
          {recetas.length === 0 ? (
            <div className="card p-12 text-center">
              <span className="text-5xl block mb-3">👨‍🍳</span>
              <p className="font-semibold">Todavía no hay recetas</p>
              <p className="text-sm text-gray-500 mt-1">
                Armá tus recetas con los insumos y después asignalas a cada producto
              </p>
              <button onClick={() => openRecipeDraft(null)} className="btn-primary mt-6">
                <Plus className="h-4 w-4" /> Crear primera receta
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recetas.map((receta) => (
                <div key={receta.id} className="card p-4 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-xl shrink-0">
                    👨‍🍳
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{receta.name}</p>
                    <p className="text-sm text-gray-500">
                      {receta.ingredients} insumo{receta.ingredients !== 1 ? 's' : ''} ·{' '}
                      <span className="font-semibold text-gray-700">
                        Costo: {formatPrice(receta.cost)}
                      </span>
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">
                    {recipeUsage[receta.id] || 0} producto(s) la usan
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openRecipeDraft(receta)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary"
                      aria-label="Editar receta"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteReceta(receta)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                      aria-label="Eliminar receta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    <div className="h-16 w-16 rounded-lg bg-primary-light flex items-center justify-center overflow-hidden">
                      {config.logo_url ? (
                        <img src={config.logo_url} alt={config.site_name} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">
                          {config.site_name.charAt(0)}
                        </span>
                      )}
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
                    {productCosts[product.id] !== undefined ? (
                      <p className="text-xs mt-1 text-gray-500">
                        <span className="font-semibold text-gray-700">
                          Costo: {formatPrice(productCosts[product.id])}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs mt-1 text-gray-400 italic">Sin costos cargados</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary whitespace-nowrap">{formatPrice(product.price)}</p>
                    {productCosts[product.id] !== undefined &&
                      (() => {
                        const cost = productCosts[product.id];
                        const price = Number(product.price);
                        const profit = price - cost;
                        const marginPct = price > 0 ? (profit / price) * 100 : 0;
                        const markupPct = cost > 0 ? (profit / cost) * 100 : null;
                        return (
                          <div className="text-xs whitespace-nowrap">
                            <span className={cn('block font-semibold', profit >= 0 ? 'text-green-600' : 'text-red-600')}>
                              {profit >= 0 ? 'Gana' : 'Pierde'}: {formatPrice(Math.abs(profit))}
                            </span>
                            {markupPct !== null && (
                              <span className={cn('block font-bold', markupPct >= 0 ? 'text-green-700' : 'text-red-600')}>
                                {markupPct >= 0 ? '+' : ''}
                                {markupPct.toFixed(0)}% s/ costo
                              </span>
                            )}
                            <span className="text-gray-400">
                              ({marginPct.toFixed(0)}% margen)
                            </span>
                          </div>
                        );
                      })()}
                  </div>
                  <div className="flex gap-1 items-center">
                    <button
                      onClick={() => duplicateProduct(product)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary"
                      aria-label="Duplicar producto"
                      title="Duplicar producto"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
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
              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-bold text-gray-900 mb-1">Costos del producto</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Asignale una o más recetas y/o insumos directos para calcular cuánto cuesta producirlo.
                </p>

                {/* Recetas asignadas */}
                <div className="space-y-2 mb-4">
                  {productRecipeRows.map((row, ri) =>
                    row._deleted ? null : (
                      <div key={ri} className="flex items-center gap-2">
                        <select
                          className="input flex-1"
                          value={row.receta_id}
                          onChange={(e) => {
                            const next = [...productRecipeRows];
                            next[ri] = { ...row, receta_id: e.target.value };
                            setProductRecipeRows(next);
                          }}
                        >
                          <option value="">Elegí una receta...</option>
                          {recetas.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} (costo: {formatPrice(r.cost)})
                            </option>
                          ))}
                        </select>
                        <span className="text-sm font-semibold text-gray-600 w-24 text-right shrink-0">
                          {(() => {
                            const receta = recetas.find((r) => r.id === row.receta_id);
                            return receta ? formatPrice(receta.cost) : '';
                          })()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...productRecipeRows];
                            next[ri] = { ...row, _deleted: true };
                            setProductRecipeRows(next);
                          }}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 shrink-0"
                          aria-label="Quitar receta"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setProductRecipeRows([...productRecipeRows, { receta_id: '' }])}
                    className="text-sm text-primary font-semibold hover:underline"
                  >
                    + Agregar receta
                  </button>
                </div>

                {/* Insumos directos */}
                <div className="space-y-2">
                  {productInsumoRows.map((row, pi) =>
                    row._deleted ? null : (
                      <div key={pi} className="flex items-center gap-2 flex-wrap">
                        <select
                          className="input flex-1 min-w-[140px]"
                          value={row.insumo_id}
                          onChange={(e) => {
                            const insumo = insumos.find((i) => i.id === e.target.value);
                            const next = [...productInsumoRows];
                            next[pi] = {
                              ...row,
                              insumo_id: e.target.value,
                              unit: insumo ? insumo.unit : row.unit,
                            };
                            setProductInsumoRows(next);
                          }}
                        >
                          <option value="">+ Insumo directo...</option>
                          {insumos.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({formatPrice(unitCostOf(i))} / {i.unit})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          className="input w-24"
                          value={row.quantity}
                          onChange={(e) => {
                            const next = [...productInsumoRows];
                            next[pi] = { ...row, quantity: Number(e.target.value) };
                            setProductInsumoRows(next);
                          }}
                          placeholder="Cant."
                        />
                        <select
                          className="input w-20"
                          value={row.unit}
                          onChange={(e) => {
                            const next = [...productInsumoRows];
                            next[pi] = { ...row, unit: e.target.value };
                            setProductInsumoRows(next);
                          }}
                          disabled={!row.insumo_id}
                          title="Unidad"
                        >
                          {compatibleUnits(
                            insumos.find((i) => i.id === row.insumo_id)?.unit || row.unit
                          ).map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...productInsumoRows];
                            next[pi] = { ...row, _deleted: true };
                            setProductInsumoRows(next);
                          }}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 shrink-0"
                          aria-label="Quitar insumo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setProductInsumoRows([
                        ...productInsumoRows,
                        { insumo_id: '', unit: 'unidad', quantity: 0 },
                      ])
                    }
                    className="text-sm text-primary font-semibold hover:underline"
                  >
                    + Agregar insumo
                  </button>
                </div>

                {(() => {
                  const recetasCost = productRecipeRows.reduce((s, row) => {
                    if (row._deleted) return s;
                    const receta = recetas.find((r) => r.id === row.receta_id);
                    return s + (receta ? receta.cost : 0);
                  }, 0);
                  const insumosCost = productInsumoRows.reduce((s, row) => {
                    if (row._deleted || !row.insumo_id) return s;
                    const insumo = insumos.find((i) => i.id === row.insumo_id);
                    if (!insumo) return s;
                    const baseQty = toBaseQuantity(insumo.unit, row.unit, Number(row.quantity || 0));
                    return s + unitCostOf(insumo) * baseQty;
                  }, 0);
                  const variantsCost = optionGroups.reduce((s, group, gi) => {
                    if (group._deleted) return s;
                    return (
                      s +
                      group.items.reduce((s2, item, ii) => {
                        if (item._deleted || !item.name.trim()) return s2;
                        const key = item.id || `new-${gi}-${ii}`;
                        const rows = itemInsumoRows[key] || [];
                        return (
                          s2 +
                          rows.reduce((s3, row) => {
                            if (row._deleted || !row.insumo_id) return s3;
                            const insumo = insumos.find((i) => i.id === row.insumo_id);
                            if (!insumo) return s3;
                            const baseQty = toBaseQuantity(insumo.unit, row.unit, Number(row.quantity || 0));
                            return s3 + unitCostOf(insumo) * baseQty;
                          }, 0)
                        );
                      }, 0)
                    );
                  }, 0);
                  const variantsPrice = optionGroups.reduce((s, group) => {
                    if (group._deleted) return s;
                    return s + group.items.reduce((s2, item) => {
                      if (item._deleted || !item.name.trim()) return s2;
                      return s2 + Number(item.price || 0);
                    }, 0);
                  }, 0);
                  const totalCost = recetasCost + insumosCost + variantsCost;
                  const totalPrice = Number(editing.price) + variantsPrice;
                  const profit = totalPrice - totalCost;
                  if (totalCost <= 0) return null;
                  const marginPct = totalPrice > 0 ? (profit / totalPrice) * 100 : 0;
                  const markupPct = totalCost > 0 ? (profit / totalCost) * 100 : null;
                  return (
                    <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Costo total (incluye variantes)</span>
                        <span className="font-bold">{formatPrice(totalCost)}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">Ganancia</span>
                        <span className={profit >= 0 ? 'font-bold text-green-600' : 'font-bold text-red-600'}>
                          {profit >= 0 ? 'Gana' : 'Pierde'} {formatPrice(Math.abs(profit))}
                        </span>
                      </div>
                      {markupPct !== null && (
                        <div className="flex justify-between mt-1">
                          <span className="text-gray-600">Marcaje sobre costo</span>
                          <span className={cn('font-bold', markupPct >= 0 ? 'text-green-700' : 'text-red-600')}>
                            {markupPct >= 0 ? '+' : ''}
                            {markupPct.toFixed(0)}%
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">Margen sobre venta</span>
                        <span className="font-semibold text-gray-500">{marginPct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })()}
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
                              onClick={() =>
                                setVariantInsumoDraft({
                                  key: item.id || `new-${gi}-${ii}`,
                                  itemName: item.name.trim() || `Variante ${ii + 1}`,
                                })
                              }
                              className="p-2 rounded-lg hover:bg-primary-light text-gray-500 hover:text-primary shrink-0"
                              aria-label="Insumos de la variante"
                              title="Insumos y costo de esta variante"
                            >
                              <Package className="h-4 w-4" />
                            </button>
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

      {/* Modal insumo (crear/editar) */}
      {insumoDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setInsumoDraft(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{insumoDraft.id ? 'Editar insumo' : 'Nuevo insumo'}</h2>
              <button onClick={() => setInsumoDraft(null)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveInsumo} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input
                  className="input"
                  value={insumoDraft.name}
                  onChange={(e) => setInsumoDraft({ ...insumoDraft, name: e.target.value })}
                  placeholder="Ej: Carne picada"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Categoría</label>
                  <select
                    className="input"
                    value={insumoDraft.category}
                    onChange={(e) => setInsumoDraft({ ...insumoDraft, category: e.target.value })}
                  >
                    <option value="Carnes">Carnes</option>
                    <option value="Pollo y cerdo">Pollo y cerdo</option>
                    <option value="Panificados">Panificados</option>
                    <option value="Lácteos y quesos">Lácteos y quesos</option>
                    <option value="Verduras y hortalizas">Verduras y hortalizas</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Envasados y secos">Envasados y secos</option>
                    <option value="Condimentos">Condimentos</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <div>
                  <label className="label">Unidad</label>
                  <select
                    className="input"
                    value={insumoDraft.unit}
                    onChange={(e) => setInsumoDraft({ ...insumoDraft, unit: e.target.value })}
                  >
                    <option value="unidad">unidad</option>
                    <option value="kg">kg</option>
                    <option value="gr">gr</option>
                    <option value="litro">litro</option>
                    <option value="ml">ml</option>
                    <option value="docena">docena</option>
                    <option value="porción">porción</option>
                  </select>
                </div>
              </div>
              {['unidad', 'docena', 'porción'].includes(insumoDraft.unit) ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Cantidad que incluye</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="input"
                      value={insumoDraft.quantity}
                      onChange={(e) => setInsumoDraft({ ...insumoDraft, quantity: Number(e.target.value) })}
                      placeholder="Ej: 100"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Precio del bulto ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={insumoDraft.cost}
                      onChange={(e) => setInsumoDraft({ ...insumoDraft, cost: Number(e.target.value) })}
                      placeholder="Ej: 8000"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="label">Costo por {insumoDraft.unit} ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={insumoDraft.cost}
                    onChange={(e) => setInsumoDraft({ ...insumoDraft, cost: Number(e.target.value) })}
                    placeholder="0"
                    required
                  />
                </div>
              )}
              {['unidad', 'docena', 'porción'].includes(insumoDraft.unit) &&
              Number(insumoDraft.quantity) > 1 &&
              Number(insumoDraft.cost) > 0 ? (
                <p className="text-xs font-semibold text-primary rounded-lg bg-primary-light p-2">
                  Costo por {insumoDraft.unit}: {formatPrice(unitCostOf(insumoDraft))}
                </p>
              ) : null}
              <p className="text-xs text-gray-400">
                {['unidad', 'docena', 'porción'].includes(insumoDraft.unit)
                  ? `Ej: 100 unidades a $8.000 → en la receta ponés las unidades que uses y calcula solo ($80 por unidad).`
                  : `Ej: "Carne picada" · kg · $10.000 → 1 kg cuesta $10.000. En la receta usás kg o gr (ej: 150 gr).`}
              </p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setInsumoDraft(null)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={insumoSaving}>
                  {insumoSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal receta */}
      {recipeDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRecipeDraft(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{recipeDraft.id ? 'Editar receta' : 'Nueva receta'}</h2>
              <button onClick={() => setRecipeDraft(null)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nombre de la receta *</label>
                <input
                  className="input"
                  value={recipeDraft.name}
                  onChange={(e) => setRecipeDraft({ ...recipeDraft, name: e.target.value })}
                  placeholder="Ej: Receta hamburguesa clásica"
                />
              </div>

              {/* Filas de insumos */}
              <div className="space-y-3">
                {recipeRows.map((row, ri) =>
                  row._deleted ? null : (
                    <div key={ri} className="flex items-center gap-2 flex-wrap">
                      <select
                        className="input flex-1 min-w-[160px]"
                        value={row.insumo_id}
                        onChange={(e) => {
                          const insumo = insumos.find((i) => i.id === e.target.value);
                          const next = [...recipeRows];
                          next[ri] = {
                            ...row,
                            insumo_id: e.target.value,
                            unit: insumo ? insumo.unit : row.unit,
                          };
                          setRecipeRows(next);
                        }}
                      >
                        <option value="">Elegí un insumo...</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({formatPrice(Number(i.cost))} / {i.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="input w-24"
                        value={row.quantity}
                        onChange={(e) => {
                          const next = [...recipeRows];
                          next[ri] = { ...row, quantity: Number(e.target.value) };
                          setRecipeRows(next);
                        }}
                        placeholder="Cant."
                      />
                      <select
                        className="input w-20"
                        value={row.unit}
                        onChange={(e) => {
                          const next = [...recipeRows];
                          next[ri] = { ...row, unit: e.target.value };
                          setRecipeRows(next);
                        }}
                        disabled={!row.insumo_id}
                        title="Unidad"
                      >
                        {compatibleUnits(
                          insumos.find((i) => i.id === row.insumo_id)?.unit || row.unit
                        ).map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm font-semibold text-gray-600 w-24 text-right shrink-0">
                        {(() => {
                          const insumo = insumos.find((i) => i.id === row.insumo_id);
                          if (!insumo) return '';
                          const baseQty = toBaseQuantity(insumo.unit, row.unit, Number(row.quantity || 0));
                          return formatPrice(unitCostOf(insumo) * baseQty);
                        })()}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...recipeRows];
                          next[ri] = { ...row, _deleted: true };
                          setRecipeRows(next);
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 shrink-0"
                        aria-label="Quitar insumo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() =>
                    setRecipeRows([...recipeRows, { insumo_id: '', unit: 'unidad', quantity: 0 }])
                  }
                  className="text-sm text-primary font-semibold hover:underline"
                >
                  + Agregar insumo
                </button>
              </div>

              {/* Sub-recetas */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900">Recetas dentro de esta receta (opcional)</h3>
                {subRows.map((row, si) =>
                  row._deleted ? null : (
                    <div key={si} className="flex items-center gap-2">
                      <select
                        className="input flex-1"
                        value={row.subreceta_id}
                        onChange={(e) => {
                          const next = [...subRows];
                          next[si] = { ...row, subreceta_id: e.target.value };
                          setSubRows(next);
                        }}
                      >
                        <option value="">Elegí una receta...</option>
                        {recetas
                          .filter((r) => r.id !== recipeDraft.id)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} (costo: {formatPrice(r.cost)})
                            </option>
                          ))}
                      </select>
                      <span className="text-sm font-semibold text-gray-600 w-24 text-right shrink-0">
                        {(() => {
                          const receta = recetas.find((r) => r.id === row.subreceta_id);
                          return receta ? formatPrice(receta.cost) : '';
                        })()}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...subRows];
                          next[si] = { ...row, _deleted: true };
                          setSubRows(next);
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 shrink-0"
                        aria-label="Quitar sub-receta"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setSubRows([...subRows, { subreceta_id: '' }])}
                  className="text-sm text-primary font-semibold hover:underline"
                >
                  + Agregar receta
                </button>
              </div>

              {/* Resumen de costos */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Costo total de la receta</span>
                  <span className="font-bold">{formatPrice(totalRecipeCost)}</span>
                </div>
                <p className="text-xs text-gray-400">
                  Después asigná esta receta a un producto y vas a ver el % de costo y la ganancia
                  según su precio de venta.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRecipeDraft(null)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="button" onClick={saveReceta} className="btn-primary flex-1" disabled={recipeSaving}>
                  {recipeSaving ? 'Guardando...' : 'Guardar receta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal insumos de variante */}
      {variantInsumoDraft &&
        (() => {
          const rows = itemInsumoRows[variantInsumoDraft.key] || [];
          const setRows = (next: typeof rows) =>
            setItemInsumoRows((prev) => ({ ...prev, [variantInsumoDraft.key]: next }));
          const totalCost = rows.reduce((s, row) => {
            if (row._deleted || !row.insumo_id) return s;
            const insumo = insumos.find((i) => i.id === row.insumo_id);
            if (!insumo) return s;
            const baseQty = toBaseQuantity(insumo.unit, row.unit, Number(row.quantity || 0));
            return s + unitCostOf(insumo) * baseQty;
          }, 0);
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setVariantInsumoDraft(null)} />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <div>
                    <h2 className="text-xl font-bold">Insumos de la variante</h2>
                    <p className="text-sm text-gray-500">{variantInsumoDraft.itemName}</p>
                  </div>
                  <button onClick={() => setVariantInsumoDraft(null)} className="p-2 rounded-full hover:bg-gray-100">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    {rows.map((row, ri) =>
                      row._deleted ? null : (
                        <div key={ri} className="flex items-center gap-2 flex-wrap">
                          <select
                            className="input flex-1 min-w-[140px]"
                            value={row.insumo_id}
                            onChange={(e) => {
                              const insumo = insumos.find((i) => i.id === e.target.value);
                              const next = [...rows];
                              next[ri] = {
                                ...row,
                                insumo_id: e.target.value,
                                unit: insumo ? insumo.unit : row.unit,
                              };
                              setRows(next);
                            }}
                          >
                            <option value="">Elegí un insumo...</option>
                            {insumos.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({formatPrice(unitCostOf(i))} / {i.unit})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            className="input w-24"
                            value={row.quantity}
                            onChange={(e) => {
                              const next = [...rows];
                              next[ri] = { ...row, quantity: Number(e.target.value) };
                              setRows(next);
                            }}
                            placeholder="Cant."
                          />
                          <select
                            className="input w-20"
                            value={row.unit}
                            onChange={(e) => {
                              const next = [...rows];
                              next[ri] = { ...row, unit: e.target.value };
                              setRows(next);
                            }}
                            disabled={!row.insumo_id}
                            title="Unidad"
                          >
                            {compatibleUnits(
                              insumos.find((i) => i.id === row.insumo_id)?.unit || row.unit
                            ).map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                          <span className="text-sm font-semibold text-gray-600 w-20 text-right shrink-0">
                            {(() => {
                              const insumo = insumos.find((i) => i.id === row.insumo_id);
                              if (!insumo) return '';
                              const baseQty = toBaseQuantity(insumo.unit, row.unit, Number(row.quantity || 0));
                              return formatPrice(unitCostOf(insumo) * baseQty);
                            })()}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...rows];
                              next[ri] = { ...row, _deleted: true };
                              setRows(next);
                            }}
                            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 shrink-0"
                            aria-label="Quitar insumo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setRows([...rows, { insumo_id: '', unit: 'unidad', quantity: 0 }])}
                      className="text-sm text-primary font-semibold hover:underline"
                    >
                      + Agregar insumo
                    </button>
                  </div>

                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 flex justify-between text-sm">
                    <span className="text-gray-600">Costo de esta variante</span>
                    <span className="font-bold">{formatPrice(totalCost)}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Se guarda junto con el producto. Cuando un pedido incluye esta variante, su
                    costo se descuenta de la ganancia.
                  </p>

                  <button
                    type="button"
                    onClick={() => setVariantInsumoDraft(null)}
                    className="btn-primary w-full"
                  >
                    Listo
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
