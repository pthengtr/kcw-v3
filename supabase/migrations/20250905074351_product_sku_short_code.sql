begin;

-- 1) Drop any constraints that reference product_sku.sku_code_norm
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
    where n.nspname = 'public'
      and t.relname = 'product_sku'
      and a.attname = 'sku_code_norm'
  loop
    execute format('alter table public.product_sku drop constraint %I', r.conname);
  end loop;
end$$;

-- 2) Drop any indexes that include sku_code_norm
do $$
declare
  r record;
begin
  for r in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename  = 'product_sku'
      and indexdef ilike '%(sku_code_norm%'
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end$$;

-- 3) Drop the column
alter table public.product_sku
  drop column if exists sku_code_norm;

-- 4) Ensure the case/space-insensitive uniqueness on sku_code still exists
create unique index if not exists product_sku_code_ci_ux
  on public.product_sku (lower(btrim(sku_code)))
  where (sku_code is not null);

commit;
