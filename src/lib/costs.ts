import { supabase } from './supabase';

export interface CostData {
  insumosCost: Map<string, number>;
  recetaCosts: Map<string, number>;
  productCosts: Record<string, number>;
  optionCosts: Record<string, number>;
}

export async function fetchCostData(): Promise<CostData> {
  const [iRes, rRes, ingRes, subRes, prRes, piRes, oiRes, viiRes, poRes] = await Promise.all([
    supabase.from('insumos').select('*'),
    supabase.from('recetas').select('*'),
    supabase.from('receta_ingredientes').select('*'),
    supabase.from('receta_subrecetas').select('*'),
    supabase.from('producto_recetas').select('*'),
    supabase.from('producto_insumos').select('*'),
    supabase.from('option_items').select('*'),
    supabase.from('option_item_insumos').select('*'),
    supabase.from('product_options').select('*'),
  ]);

  const insumos = (iRes.data || []) as unknown as Array<{ id: string; cost: number; quantity: number }>;
  const insumosCost = new Map<string, number>();
  insumos.forEach((i) => {
    const bulk = Number(i.quantity) || 1;
    insumosCost.set(i.id, Number(i.cost) / (bulk > 0 ? bulk : 1));
  });

  const ingredients = (ingRes.data || []) as unknown as Array<{
    receta_id: string;
    insumo_id: string;
    quantity: number;
  }>;
  const subs = (subRes.data || []) as unknown as Array<{ receta_id: string; subreceta_id: string }>;
  const prodRecetas = (prRes.data || []) as unknown as Array<{ product_id: string; receta_id: string }>;
  const prodInsumos = (piRes.data || []) as unknown as Array<{
    product_id: string;
    insumo_id: string;
    quantity: number;
  }>;
  const recetas = (rRes.data || []) as unknown as Array<{ id: string }>;

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

  const recetaCosts = new Map<string, number>();
  const costOf = (id: string, visited: Set<string>): number => {
    if (recetaCosts.has(id)) return recetaCosts.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);
    let cost = (ingMap.get(id) || []).reduce(
      (s, ing) => s + (insumosCost.get(ing.insumo_id) || 0) * ing.quantity,
      0
    );
    cost += (subMap.get(id) || []).reduce((s, sub) => s + costOf(sub, visited), 0);
    recetaCosts.set(id, cost);
    return cost;
  };
  recetas.forEach((r) => costOf(r.id, new Set()));

  const productCosts: Record<string, number> = {};
  prodRecetas.forEach((pr) => {
    productCosts[pr.product_id] =
      (productCosts[pr.product_id] || 0) + (recetaCosts.get(pr.receta_id) || 0);
  });
  prodInsumos.forEach((pi) => {
    productCosts[pi.product_id] =
      (productCosts[pi.product_id] || 0) + (insumosCost.get(pi.insumo_id) || 0) * Number(pi.quantity);
  });

  // Costo por variante (option item) y mapeo a producto para los pedidos
  const optionItems = (oiRes.data || []) as unknown as Array<{
    id: string;
    option_id: string;
    name: string;
  }>;
  const optionInsumos = (viiRes.data || []) as unknown as Array<{
    option_item_id: string;
    insumo_id: string;
    quantity: number;
  }>;
  const productOptions = (poRes.data || []) as unknown as Array<{ id: string; product_id: string }>;

  const optionItemCost = new Map<string, number>();
  optionInsumos.forEach((oi) => {
    const cur = optionItemCost.get(oi.option_item_id) || 0;
    optionItemCost.set(
      oi.option_item_id,
      cur + (insumosCost.get(oi.insumo_id) || 0) * Number(oi.quantity)
    );
  });
  const optionToProduct = new Map<string, string>();
  productOptions.forEach((po) => optionToProduct.set(po.id, po.product_id));

  const optionCosts: Record<string, number> = {};
  optionItems.forEach((it) => {
    const productId = optionToProduct.get(it.option_id);
    const cost = optionItemCost.get(it.id) || 0;
    if (productId && cost > 0) {
      optionCosts[`${productId}::${it.name}`] = cost;
    }
  });

  return { insumosCost, recetaCosts, productCosts, optionCosts };
}
