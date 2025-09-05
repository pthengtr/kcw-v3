alter table public.product_sku_short_code
  add column if not exists short_code_norm text
  generated always as (lower(btrim(short_code))) stored;

-- unique per SKU using columns (not expressions)
do $$
begin
  -- drop old expression index if you made it
  if exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='product_sku_short_code_per_sku_ci_ux'
  ) then
    execute 'drop index public.product_sku_short_code_per_sku_ci_ux';
  end if;
end$$;

alter table public.product_sku_short_code
  add constraint product_sku_short_code_per_sku_norm_ux
  unique (sku_uuid, short_code_norm);
