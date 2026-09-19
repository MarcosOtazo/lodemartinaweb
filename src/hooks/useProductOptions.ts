import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ProductOptionGroup } from '../types';

export function useProductOptions(productIds: string[]) {
  const [groups, setGroups] = useState<Record<string, ProductOptionGroup[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('product_options')
      .select('*, option_items(*)')
      .in('product_id', productIds)
      .order('sort_order')
      .then(({ data }) => {
        if (cancelled) return;
        const byProduct: Record<string, ProductOptionGroup[]> = {};
        for (const row of (data || []) as unknown as (ProductOptionGroup & { option_items?: unknown })[]) {
          const rawItems = Array.isArray(row.option_items)
            ? (row.option_items as ProductOptionGroup['items'])
            : [];
          const group = {
            ...row,
            items: [...rawItems].sort((a, b) => a.sort_order - b.sort_order),
          } as ProductOptionGroup;
          if (!byProduct[group.product_id]) byProduct[group.product_id] = [];
          byProduct[group.product_id].push(group);
        }
        setGroups(byProduct);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productIds.join(',')]);

  return { groups, loading };
}
