begin;

-- 1) Rename older tables to product_category_seed_raw, if present
do $$
begin
  -- from product_category_seed -> product_category_seed_raw
  if to_regclass('public.product_category_seed_raw') is null
     and to_regclass('public.product_category_seed') is not null then
    execute 'alter table public.product_category_seed rename to product_category_seed_raw';
  end if;

  -- from category_seed -> product_category_seed_raw
  if to_regclass('public.product_category_seed_raw') is null
     and to_regclass('public.category_seed') is not null then
    execute 'alter table public.category_seed rename to product_category_seed_raw';
  end if;
end$$;

-- 2) Ensure the target table exists (uppercase columns, all text)
create table if not exists public.product_category_seed_raw (
  "ID"       text,
  "JOURMODE" text,
  "MAIN"     text,
  "NAME"     text,
  "DETAIL"   text,
  "BCODE"    text,
  "EXMPT"    text,
  "MORE"     text,
  created_at timestamptz not null default now()
) tablespace pg_default;

-- 3) Rename any old index names to the new canonical one
do $$
begin
  -- old name from the very first version
  if to_regclass('public.idx_category_seed_bcode_prefix') is not null
     and to_regclass('public.idx_product_category_seed_raw_bcode_prefix') is null then
    execute 'alter index public.idx_category_seed_bcode_prefix rename to idx_product_category_seed_raw_bcode_prefix';
  end if;

  -- old name from the intermediate product_category_seed table
  if to_regclass('public.idx_product_category_seed_bcode_prefix') is not null
     and to_regclass('public.idx_product_category_seed_raw_bcode_prefix') is null then
    execute 'alter index public.idx_product_category_seed_bcode_prefix rename to idx_product_category_seed_raw_bcode_prefix';
  end if;
end$$;

-- 4) Ensure the prefix index exists on the new table
create index if not exists idx_product_category_seed_raw_bcode_prefix
  on public.product_category_seed_raw ((left("BCODE", 2)));

commit;
