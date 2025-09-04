begin;

-- 1) Drop ALL existing overloads of public.rpc_product_skus (any signatures)
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rpc_product_skus'
  loop
    execute format('drop function if exists %s;', r.sig);
  end loop;
end$$;

-- 2) Create the new UOM-free version
create function public.rpc_product_skus(
  _search      text default null,
  _category    text default null,
  _active      boolean default null,
  _page_index  integer default 0,
  _page_size   integer default 50,
  _sort_id     text default 'sku_updated_at',
  _sort_desc   boolean default true
)
returns table (
  sku_uuid             uuid,
  product_uuid         uuid,
  sku_code             text,
  sku_short_code       text,
  default_tax_code     text,
  is_active            boolean,
  created_at           timestamptz,
  updated_at           timestamptz,
  product_description  text,
  product_item         jsonb,
  total_count          bigint
)
language plpgsql
as $$
declare
  order_by     text;
  _needle_like text;  -- normalized wildcard pattern built from _search
  _s           text := nullif(trim(coalesce(_search, '')), '');
begin
  -- Build a LIKE pattern: spaces → wildcards, escape %/_
  if _s is not null then
    _needle_like := '%' || regexp_replace(lower(_s), '(%|_)', '\\\1', 'g') || '%';
    _needle_like := regexp_replace(_needle_like, '\s+', '%', 'g');
  end if;

  -- Validate sort id (uom_code removed)
  if _sort_id not in (
    'sku_code','sku_short_code','default_tax_code',
    'sku_updated_at','product_name','category_code','product_description'
  ) then
    _sort_id := 'sku_updated_at';
  end if;

  order_by := case _sort_id
    when 'sku_code'            then format('%I.%I %s NULLS LAST', 'b','sku_code',             case when _sort_desc then 'DESC' else 'ASC' end)
    when 'sku_short_code'      then format('%I.%I %s NULLS LAST', 'b','sku_short_code',       case when _sort_desc then 'DESC' else 'ASC' end)
    when 'default_tax_code'    then format('%I.%I %s NULLS LAST', 'b','default_tax_code',     case when _sort_desc then 'DESC' else 'ASC' end)
    when 'product_name'        then format('%I.%I %s NULLS LAST', 'b','_product_name',        case when _sort_desc then 'DESC' else 'ASC' end)
    when 'category_code'       then format('%I.%I %s NULLS LAST', 'b','_category_code',       case when _sort_desc then 'DESC' else 'ASC' end)
    when 'product_description' then format('%I.%I %s NULLS LAST', 'b','_product_description', case when _sort_desc then 'DESC' else 'ASC' end)
    else                            format('%I.%I %s NULLS LAST', 'b','updated_at',           case when _sort_desc then 'DESC' else 'ASC' end)
  end;

  return query
  execute
  'with base as (
     select
       s.sku_uuid,
       s.product_uuid,
       s.sku_code,
       s.sku_short_code,
       s.default_tax_code,
       s.is_active,
       s.created_at,
       s.updated_at,
       p.product_name         as _product_name,
       p.category_code        as _category_code,
       p.product_description  as _product_description,
       jsonb_build_object(
         ''product_uuid'',        p.product_uuid,
         ''product_name'',        p.product_name,
         ''category_code'',       p.category_code,
         ''product_description'', p.product_description
       ) as product_item
     from public.product_sku as s
     join public.product_item as p
       on p.product_uuid = s.product_uuid
     where
       ($6::text is null
         or lower(coalesce(s.sku_code, '''')) like $6 escape ''\'' 
         or lower(coalesce(s.sku_short_code, '''')) like $6 escape ''\'' 
         or lower(coalesce(p.product_name, '''')) like $6 escape ''\'' 
         or lower(regexp_replace(coalesce(p.product_description, ''''), ''\s+'', '' '', ''g'')) like $6 escape ''\'' 
       )
       and ($2::text is null or p.category_code ilike ''%''||$2||''%'')
       and ($3::boolean is null or s.is_active = $3)
   )
   select
     b.sku_uuid,
     b.product_uuid,
     b.sku_code,
     b.sku_short_code,
     b.default_tax_code,
     b.is_active,
     b.created_at,
     b.updated_at,
     b._product_description as product_description,
     b.product_item,
     count(*) over() as total_count
   from base as b
   order by ' || order_by || '
   offset $4
   limit  $5'
  using _search, _category, _active, (_page_index * _page_size), _page_size, _needle_like;
end;
$$;

-- (Optional) Grant execute to your app role(s)
-- grant execute on function public.rpc_product_skus(text, text, boolean, integer, integer, text, boolean) to authenticated;

commit;
