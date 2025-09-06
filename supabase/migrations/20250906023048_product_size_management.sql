begin;

-- Optional: fuzzy search later
create extension if not exists pg_trgm;

-- Ensure you have an updated_at trigger helper
do $$
begin
  if not exists (select 1 from pg_proc where proname='set_updated_at' and pg_function_is_visible(oid)) then
    execute $fn$
      create or replace function public.set_updated_at()
      returns trigger language plpgsql as $body$
      begin new.updated_at := now(); return new; end
      $body$;
    $fn$;
  end if;
end$$;

-- Helper: first number from a text like '10mm' -> 10
create or replace function public.fn_first_number(_raw text)
returns numeric
language sql
immutable
as $$
  select case
    when _raw is null then null
    else nullif(regexp_replace(_raw, '^.*?([0-9]+(\.[0-9]+)?).*$','\1'), '')::numeric
  end
$$;

-- CORE: sizes per SKU
create table if not exists public.product_sku_size (
  sku_uuid        uuid not null
    references public.product_sku(sku_uuid) on delete cascade,

  -- Free-form attribute name; we also store a normalized copy
  size_attr       text not null,
  size_attr_norm  text
    generated always as (lower(btrim(size_attr))) stored,

  -- Free-form value (e.g., '10mm', '24', 'height-5mm')
  size_value      text not null,

  -- Convenience numeric for range filters/sorting (null if no number)
  numeric_value   numeric
    generated always as (public.fn_first_number(size_value)) stored,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint product_sku_size_attr_not_blank check (length(btrim(size_attr)) > 0),
  constraint product_sku_size_value_not_blank check (length(btrim(size_value)) > 0)
);

-- Keep updated_at current
do $$
begin
  if not exists (select 1 from pg_trigger where tgname='product_sku_size_set_updated_at') then
    create trigger product_sku_size_set_updated_at
      before update on public.product_sku_size
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- One value per (SKU, attribute) ignoring case/whitespace on the attr name
create unique index if not exists product_sku_size_attr_ci_ux
  on public.product_sku_size (sku_uuid, size_attr_norm);

-- Useful lookups
create index if not exists idx_product_sku_size_sku
  on public.product_sku_size (sku_uuid);

create index if not exists idx_product_sku_size_attr
  on public.product_sku_size (size_attr_norm);

-- Fast numeric filtering like INNER between 9 and 11
create index if not exists idx_product_sku_size_numeric
  on public.product_sku_size (size_attr_norm, numeric_value);

-- Optional fuzzy value search
create index if not exists idx_product_sku_size_value_trgm
  on public.product_sku_size using gin (size_value gin_trgm_ops);

commit;

