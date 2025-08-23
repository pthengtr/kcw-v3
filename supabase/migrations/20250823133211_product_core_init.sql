-- =========================================================
-- KCW v3: Product Domain (product_* naming)
-- Safe migration: renames old tables if present, then creates new ones
-- =========================================================

-- UUID & helpers
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------
-- 1) Rename legacy tables (if you had already created non-prefixed)
-- -----------------------------------------------------------------
do $$
begin
  -- uom -> product_uom
  if to_regclass('public.product_uom') is null and to_regclass('public.uom') is not null then
    execute 'alter table public.uom rename to product_uom';
  end if;

  -- tax_category -> product_tax_category
  if to_regclass('public.product_tax_category') is null and to_regclass('public.tax_category') is not null then
    execute 'alter table public.tax_category rename to product_tax_category';
  end if;

  -- product -> product_item
  if to_regclass('public.product_item') is null and to_regclass('public.product') is not null then
    execute 'alter table public.product rename to product_item';
  end if;

  -- sku -> product_sku
  if to_regclass('public.product_sku') is null and to_regclass('public.sku') is not null then
    execute 'alter table public.sku rename to product_sku';
  end if;

  -- barcode -> product_barcode
  if to_regclass('public.product_barcode') is null and to_regclass('public.barcode') is not null then
    execute 'alter table public.barcode rename to product_barcode';
  end if;
end
$$;

-- ----------------------------------------------------------
-- 2) Core tables (product_* names)
-- ----------------------------------------------------------

-- Units of measure
create table if not exists public.product_uom (
  uom_code     text primary key,
  description  text
);

-- Tax categories
create table if not exists public.product_tax_category (
  tax_code    text primary key,                  -- e.g. 'VAT7', 'VAT0', 'EXEMPT', 'NONVAT'
  rate        numeric(5,2) not null,             -- percentage
  tax_type    text not null default 'VAT'
              check (tax_type in ('VAT','ZERO','EXEMPT','NONVAT')),
  is_vat      boolean not null default true,
  description text
);

-- Product (master)
create table if not exists public.product_item (
  product_uuid         uuid primary key default gen_random_uuid(),
  product_name         text not null,
  product_description  text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- SKU (sellable/stock-keeping unit)
create table if not exists public.product_sku (
  sku_uuid          uuid primary key default gen_random_uuid(),
  product_uuid      uuid not null references public.product_item (product_uuid) on delete cascade,
  sku_code          text unique,
  uom_code          text not null references public.product_uom (uom_code),
  default_tax_code  text references public.product_tax_category (tax_code),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);


-- Barcodes
create table if not exists public.product_barcode (
  barcode     text primary key,
  sku_uuid    uuid not null references public.product_sku (sku_uuid) on delete cascade,
  is_primary  boolean not null default false
);

-- ----------------------------------------------------------
-- 3) Helpful indexes & constraints
-- ----------------------------------------------------------

-- Case-insensitive uniqueness for sku_code (allows trimming too)
create unique index if not exists product_sku_code_ci_ux
  on public.product_sku (lower(btrim(sku_code)))
  where sku_code is not null;

-- Trigram index for fuzzy product name search
create index if not exists idx_product_item_name_trgm
  on public.product_item using gin (product_name gin_trgm_ops);

-- Only one primary barcode per SKU
create unique index if not exists product_barcode_primary_per_sku_ux
  on public.product_barcode (sku_uuid)
  where is_primary = true;

-- ----------------------------------------------------------
-- 4) updated_at trigger for *_item and *_sku
-- ----------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;

drop trigger if exists product_item_set_updated_at on public.product_item;
create trigger product_item_set_updated_at
before update on public.product_item
for each row
execute function public.set_updated_at();

drop trigger if exists product_sku_set_updated_at on public.product_sku;
create trigger product_sku_set_updated_at
before update on public.product_sku
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------
-- 5) (Optional) Simple RLS setup - authenticated full access
--     Uncomment if you want these now (Supabase-friendly).
-- ----------------------------------------------------------

-- Enable RLS
alter table public.product_uom          enable row level security;
alter table public.product_tax_category enable row level security;
alter table public.product_item         enable row level security;
alter table public.product_sku          enable row level security;
alter table public.product_barcode      enable row level security;

-- SELECT policies (create only if missing)
do $pl$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_uom' and policyname='uom_auth_select'
  ) then
    execute 'create policy uom_auth_select on public.product_uom for select to authenticated using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_tax_category' and policyname='tax_auth_select'
  ) then
    execute 'create policy tax_auth_select on public.product_tax_category for select to authenticated using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_item' and policyname='item_auth_select'
  ) then
    execute 'create policy item_auth_select on public.product_item for select to authenticated using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_sku' and policyname='sku_auth_select'
  ) then
    execute 'create policy sku_auth_select on public.product_sku for select to authenticated using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_barcode' and policyname='barcode_auth_select'
  ) then
    execute 'create policy barcode_auth_select on public.product_barcode for select to authenticated using (true)';
  end if;
end
$pl$;

-- INSERT/UPDATE/DELETE policies (all authenticated)
do $pl$
begin
  if not exists (select 1 from pg_policies where policyname='uom_auth_modify') then
    execute 'create policy uom_auth_modify on public.product_uom for all to authenticated using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where policyname='tax_auth_modify') then
    execute 'create policy tax_auth_modify on public.product_tax_category for all to authenticated using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where policyname='item_auth_modify') then
    execute 'create policy item_auth_modify on public.product_item for all to authenticated using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where policyname='sku_auth_modify') then
    execute 'create policy sku_auth_modify on public.product_sku for all to authenticated using (true) with check (true)';
  end if;

  if not exists (select 1 from pg_policies where policyname='barcode_auth_modify') then
    execute 'create policy barcode_auth_modify on public.product_barcode for all to authenticated using (true) with check (true)';
  end if;
end
$pl$;

