-- Upsert a size attribute for a SKU
create or replace function public.fn_sku_size_set(
  _sku uuid,
  _attr text,
  _value text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.product_sku_size (sku_uuid, size_attr, size_value)
  values (_sku, _attr, _value)
  on conflict (sku_uuid, size_attr_norm)
  do update set size_attr = excluded.size_attr,  -- keep original casing from latest write
                size_value = excluded.size_value,
                updated_at = now();
$$;

-- Delete a size attribute from a SKU
create or replace function public.fn_sku_size_delete(
  _sku uuid,
  _attr text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.product_sku_size
  where sku_uuid = _sku
    and size_attr_norm = lower(btrim(_attr));
$$;

-- Fetch sizes as JSON (attr -> value) for a SKU
create or replace function public.fn_sku_sizes_json(_sku uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(s.size_attr, s.size_value order by s.size_attr_norm),
    '{}'::jsonb
  )
  from public.product_sku_size s
  where s.sku_uuid = _sku;
$$;
