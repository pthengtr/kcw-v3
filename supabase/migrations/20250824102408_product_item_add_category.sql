begin;

-- 0) Ensure the category lookup exists (minimal shape)
create table if not exists public.product_category (
  category_code text primary key
    check (category_code ~ '^[0-9]{2}$'),
  category_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1) Add category_code to product_item (and a helper index)
alter table public.product_item
  add column if not exists category_code text;

create index if not exists idx_product_item_category_code
  on public.product_item (category_code);

-- 2) Backfill product_item.category_code from SKUs
--    Prefer product_sku.category_code (if that column exists),
--    else infer from 8-digit sku_code prefix (left(sku_code, 2)).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='product_sku' and column_name='category_code'
  ) then
    -- Use SKU.category_code, pick the most frequent per product
    with src as (
      select s.product_uuid, s.category_code
      from public.product_sku s
      where s.category_code ~ '^[0-9]{2}$'
    ),
    ranked as (
      select
        product_uuid,
        category_code,
        count(*) as cnt,
        row_number() over (partition by product_uuid order by count(*) desc, category_code asc) as rn
      from src
      group by product_uuid, category_code
    )
    update public.product_item pi
    set category_code = r.category_code
    from ranked r
    where r.rn = 1
      and pi.product_uuid = r.product_uuid
      and (pi.category_code is distinct from r.category_code);
  else
    -- No SKU.category_code column: derive from 8-digit sku_code prefix
    with src as (
      select s.product_uuid, left(s.sku_code, 2) as category_code
      from public.product_sku s
      where s.sku_code ~ '^[0-9]{8}$'
    ),
    ranked as (
      select
        product_uuid,
        category_code,
        count(*) as cnt,
        row_number() over (partition by product_uuid order by count(*) desc, category_code asc) as rn
      from src
      group by product_uuid, category_code
    )
    update public.product_item pi
    set category_code = r.category_code
    from ranked r
    where r.rn = 1
      and r.category_code ~ '^[0-9]{2}$'
      and pi.product_uuid = r.product_uuid
      and (pi.category_code is distinct from r.category_code);
  end if;
end$$;

-- 3) Ensure any used codes exist in product_category (so FK won't fail)
insert into public.product_category (category_code, category_name)
select d.code, 'Imported ' || d.code
from (
  select distinct category_code as code
  from public.product_item
  where category_code ~ '^[0-9]{2}$'
) d
on conflict (category_code) do nothing;

-- 4) Add a CHECK on product_item to enforce 2-digit shape (nullable is allowed)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_item_category_code_ck'
      and conrelid = 'public.product_item'::regclass
  ) then
    alter table public.product_item
      add constraint product_item_category_code_ck
      check (
        category_code is null or category_code ~ '^[0-9]{2}$'
      );
  end if;
end$$;

-- 5) Add the FK product_item.category_code -> product_category(category_code)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_item_category_code_fkey'
      and conrelid = 'public.product_item'::regclass
  ) then
    alter table public.product_item
      add constraint product_item_category_code_fkey
      foreign key (category_code)
      references public.product_category (category_code);
  end if;
end$$;

-- 6) (Optional) Make NOT NULL if every row has a value
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='product_item'
      and column_name='category_code' and is_nullable='YES'
  ) and not exists (
    select 1 from public.product_item where category_code is null
  ) then
    alter table public.product_item
      alter column category_code set not null;
  end if;
end$$;

commit;
