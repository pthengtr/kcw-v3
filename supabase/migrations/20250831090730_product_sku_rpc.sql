-- 1) Ensure trigram (you already use it)
-- create extension if not exists pg_trgm;

-- 2) Create the RPC
create or replace function public.rpc_product_skus(
  _page_index int,
  _page_size  int,
  _sort_id    text default 'sku_updated_at',  -- allowed: sku_code, sku_short_code, uom_code, default_tax_code, sku_updated_at, product_name, category_code
  _sort_desc  boolean default true,
  _search     text default null,              -- matches sku_code OR product_name (ILIKE)
  _category   text default null,              -- matches product_item.category_code (ILIKE)
  _active     boolean default null            -- null = all, true/false filter sku.is_active
)
returns table (
  sku_uuid uuid,
  product_uuid uuid,
  sku_code text,
  sku_short_code text,
  uom_code text,
  default_tax_code text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  product_item jsonb,        -- { product_uuid, product_name, category_code }
  total_count bigint         -- window count (same value on each row of the page)
)
language plpgsql
stable
as $$
declare
  order_by text;
begin
  -- whitelist sort_id to avoid SQL injection
  if _sort_id not in ('sku_code','sku_short_code','uom_code','default_tax_code','sku_updated_at','product_name','category_code') then
    _sort_id := 'sku_updated_at';
  end if;

  -- build ORDER BY safely
  order_by := case _sort_id
    when 'sku_code'         then format('s.sku_code %s nulls last',        case when _sort_desc then 'desc' else 'asc' end)
    when 'sku_short_code'   then format('s.sku_short_code %s nulls last',  case when _sort_desc then 'desc' else 'asc' end)
    when 'uom_code'         then format('s.uom_code %s nulls last',        case when _sort_desc then 'desc' else 'asc' end)
    when 'default_tax_code' then format('s.default_tax_code %s nulls last',case when _sort_desc then 'desc' else 'asc' end)
    when 'product_name'     then format('p.product_name %s nulls last',    case when _sort_desc then 'desc' else 'asc' end)
    when 'category_code'    then format('p.category_code %s nulls last',   case when _sort_desc then 'desc' else 'asc' end)
    else                         format('s.updated_at %s nulls last',      case when _sort_desc then 'desc' else 'asc' end)
  end;

  return query
  execute format($f$
    with base as (
      select
        s.sku_uuid,
        s.product_uuid,
        s.sku_code,
        s.sku_short_code,
        s.uom_code,
        s.default_tax_code,
        s.is_active,
        s.created_at,
        s.updated_at,
        jsonb_build_object(
          'product_uuid', p.product_uuid,
          'product_name', p.product_name,
          'category_code', p.category_code
        ) as product_item
      from public.product_sku s
      join public.product_item p on p.product_uuid = s.product_uuid
      where
        (%1$s is null or s.sku_code ilike '%' || %1$s || '%' or p.product_name ilike '%' || %1$s || '%') and
        (%2$s is null or p.category_code ilike '%' || %2$s || '%') and
        (%3$s is null or s.is_active = %3$s)
    )
    select
      b.*,
      count(*) over() as total_count
    from base b
    order by %4$s
    offset %5$s
    limit  %6$s
  $f$, -- placeholders mapping below
    _search, _category, _active, order_by, (_page_index * _page_size), _page_size
  );
end;
$$;

-- (Optional) grant execute to anon/authenticated (Supabase does this for public schema typically)
-- grant execute on function public.rpc_product_skus(int,int,text,boolean,text,text,boolean) to anon, authenticated;
