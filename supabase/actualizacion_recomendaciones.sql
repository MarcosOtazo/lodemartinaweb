alter table public.site_config
  add column if not exists testimonials jsonb not null default '[]'::jsonb;
