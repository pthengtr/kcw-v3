begin;

-- 1) Replace the view so it no longer depends on size_attr / size_attr_norm
create or replace view public.v_sku_sizes as
select
  s.sku_uuid,
  a.label_th,
  a.label_en,
  s.size_value,
  s.numeric_value,
  s.size_kind_code,
  s.attr_pos
from public.product_sku_size s
join public.product_size_kind_attr a
  on a.size_kind_code = s.size_kind_code
 and a.attr_pos = s.attr_pos;

-- 2) Drop the free-form unique index if it exists (it referenced size_attr_norm)
do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='product_sku_size_attr_ci_ux'
  ) then
    execute 'drop index public.product_sku_size_attr_ci_ux';
  end if;
end$$;

-- 3) Drop the generated column FIRST (it depends on size_attr)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='product_sku_size' and column_name='size_attr_norm'
  ) then
    alter table public.product_sku_size drop column size_attr_norm;
  end if;
end$$;

-- 4) Now drop size_attr safely
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='product_sku_size' and column_name='size_attr'
  ) then
    alter table public.product_sku_size drop column size_attr;
  end if;
end$$;

-- 5) Ensure NOT NULLs and the template-only unique index
alter table public.product_sku_size
  alter column size_kind_code set not null,
  alter column attr_pos set not null;

do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='product_sku_size_kind_slot_ux'
  ) then
    execute 'drop index public.product_sku_size_kind_slot_ux';
  end if;

  execute 'create unique index if not exists product_sku_size_kind_slot_ux
           on public.product_sku_size (sku_uuid, size_kind_code, attr_pos)';
end$$;

commit;
