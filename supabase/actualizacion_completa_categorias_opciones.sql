-- ============================================================
-- LO DE MARTINA - Actualizacion completa: categorias dinamicas
-- (con imagenes y sin limite de cantidad) + opciones de productos
-- Se puede ejecutar siempre, sin importar que haya corrido antes.
-- Supabase: SQL Editor -> New query -> pegar todo -> Run
-- ============================================================

-- 1. Quitar la restriccion de productos que limitaba a 4 categorias
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'products'
      AND constraint_name = 'products_category_check'
  ) THEN
    ALTER TABLE public.products DROP CONSTRAINT products_category_check;
  END IF;
END $$;

-- 2. CATEGORIES (dinamicas, con imagen, sin limite)
DROP TABLE IF EXISTS public.categories CASCADE;

CREATE TABLE public.categories (
  id text primary key,
  name text not null,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver categorias"
  ON public.categories FOR SELECT USING (true);

CREATE POLICY "Solo admin puede modificar categorias"
  ON public.categories FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Categorias iniciales
INSERT INTO public.categories (id, name, sort_order) VALUES
  ('hamburguesas', 'Hamburguesas', 1),
  ('tostadas', 'Tostadas', 2),
  ('combos', 'Combos', 3),
  ('bebidas', 'Bebidas', 4)
ON CONFLICT (id) DO NOTHING;

-- 3. PRODUCT OPTIONS (grupos de opciones/variantes)
DROP TABLE IF EXISTS public.product_options CASCADE;
DROP TABLE IF EXISTS public.option_items CASCADE;

CREATE TABLE public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  required boolean not null default false,
  multiple boolean not null default true,
  min_selections int not null default 0,
  max_selections int not null default 99,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver opciones de productos"
  ON public.product_options FOR SELECT USING (true);

CREATE POLICY "Solo admin puede modificar opciones de productos"
  ON public.product_options FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 4. OPTION ITEMS (cada variante/opcional)
CREATE TABLE public.option_items (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_options(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

ALTER TABLE public.option_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver items de opciones"
  ON public.option_items FOR SELECT USING (true);

CREATE POLICY "Solo admin puede modificar items de opciones"
  ON public.option_items FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));
