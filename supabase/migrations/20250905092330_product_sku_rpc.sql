begin;

-- drop previous version so signature matches
drop function if exists public.rpc_product_skus(
  text, text, boolean, integer, integer, text, boolean
);

create or replace function public.rpc_product_skus(
  _search     text default null,
  _category   text default null,
  _active     boolean default null,
  _page_index integer default 0,
  _page_size  integer default 50,
  _sort_id    text default 'sku_updated_at',
  _sort_desc  boolean default true
)
returns table (
  sku_uuid uuid,
  product_uuid uuid,
  sku_code text,
  default_tax_code text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  product_description text,
  product_item jsonb,
  barcodes text[],
  primary_barcode text,
  barcode_count integer,
  sku_short_codes text[],
  first_short_code text,
  total_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  order_by       text;
  _needle_like   text;
  _s             text := nullif(trim(coalesce(_search, '')), '');
  has_sc_table   boolean;
  search_clause  text;
  sc_join        text := '';
  sc_fields      text := 'coalesce(''{}''::text[], ''{}''::text[]) as sku_short_codes, NULL::text as first_short_code';

  -- FIXED: normalized variants of the search input (use proper quoting & args)
  _sdigits text := case when _s is not null then public.normalize_digits(_s) end;
  _sfuzzy  text := case when _s is not null then lower(regexp_replace(_s, '[\s-]', '', 'g')) end;
begin
  -- Build LIKE pattern: escape %/_ and collapse spaces to %
  if _s is not null then
    _needle_like := '%' || regexp_replace(lower(_s), '(%|_)', '\\\1', 'g') || '%';
    _needle_like := regexp_replace(_needle_like, '\s+', '%', 'g');
  end if;

  -- Optional table: product_sku_short_code
  select exists(
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'public' and c.relname = 'product_sku_short_code'
  ) into has_sc_table;

  -- Validate sort id (keep 'sku_short_code' mapping to first_short_code)
  if _sort_id not in (
    'sku_code','default_tax_code',
    'sku_updated_at','product_name','category_code','product_description',
    'primary_barcode','sku_short_code'
  ) then
    _sort_id := 'sku_updated_at';
  end if;

  order_by := case _sort_id
    when 'sku_code'            then format('%I.%I %s NULLS LAST', 'b','sku_code',             case when _sort_desc then 'DESC' else 'ASC' end)
    when 'default_tax_code'    then format('%I.%I %s NULLS LAST', 'b','default_tax_code',     case when _sort_desc then 'DESC' else 'ASC' end)
    when 'product_name'        then format('%I.%I %s NULLS LAST', 'b','_product_name',        case when _sort_desc then 'DESC' else 'ASC' end)
    when 'category_code'       then format('%I.%I %s NULLS LAST', 'b','_category_code',       case when _sort_desc then 'DESC' else 'ASC' end)
    when 'product_description' then format('%I.%I %s NULLS LAST', 'b','_product_description', case when _sort_desc then 'DESC' else 'ASC' end)
    when 'primary_barcode'     then format('%I.%I %s NULLS LAST', 'b','primary_barcode',      case when _sort_desc then 'DESC' else 'ASC' end)
    when 'sku_short_code'      then format('%I.%I %s NULLS LAST', 'b','first_short_code',     case when _sort_desc then 'DESC' else 'ASC' end)
    else                            format('%I.%I %s NULLS LAST', 'b','updated_at',           case when _sort_desc then 'DESC' else 'ASC' end)
  end;

  -- Build WHERE clause (same as your last version; keeps dynamic SQL)
  search_clause := '
    ($6::text is null
      or lower(coalesce(s.sku_code, '''')) like $6 escape ''\'' 
      or lower(coalesce(p.product_name, '''')) like $6 escape ''\''
      or lower(regexp_replace(coalesce(p.product_description, ''''), ''\s+'', '' '', ''g'')) like $6 escape ''\''
      or exists (
          select 1
          from public.product_barcode pb
          where pb.sku_uuid = s.sku_uuid
            and (
              (length($7) in (8,12,13,14) and public.normalize_digits(pb.barcode) = $7)
              or (lower(regexp_replace(coalesce(pb.barcode, ''''), ''[\s-]'', '''', ''g'')) like ''%''||$8||''%'')
              or (lower(coalesce(pb.barcode, '''')) like $6 escape ''\'')
            )
      )';

  if has_sc_table then
    search_clause := search_clause || '
      or exists (
          select 1
          from public.product_sku_short_code ss
          where ss.sku_uuid = s.sku_uuid
            and (
              lower(btrim(ss.short_code)) like ''%''||$8||''%''
              or lower(ss.short_code)     like $6 escape ''\''
            )
      )';
  end if;

  search_clause := search_clause || ')';

  return query
  execute
  'with base as (
     select
       s.sku_uuid,
       s.product_uuid,
       s.sku_code,
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
     where ' || search_clause || '
       and ($2::text is null or p.category_code ilike ''%''||$2||''%'')
       and ($3::boolean is null or s.is_active = $3)
   ),
   with_codes as (
     select
       b.*,
       coalesce(bc.barcodes, ''{}''::text[]) as barcodes,
       bc.primary_barcode,
       coalesce(bc.barcode_count, 0)         as barcode_count,
       ' || sc_fields || '
     from base b
     left join lateral (
       select
         array_agg(pb.barcode order by pb.is_primary desc, pb.barcode) as barcodes,
         max(pb.barcode) filter (where pb.is_primary)                  as primary_barcode,
         count(*)::int                                                 as barcode_count
       from public.product_barcode pb
       where pb.sku_uuid = b.sku_uuid
     ) bc on true
     ' || sc_join || '
   )
   select
     b.sku_uuid,
     b.product_uuid,
     b.sku_code,
     b.default_tax_code,
     b.is_active,
     b.created_at,
     b.updated_at,
     b._product_description as product_description,
     b.product_item,
     b.barcodes,
     b.primary_barcode,
     b.barcode_count,
     b.sku_short_codes,
     b.first_short_code,
     count(*) over()::int as total_count
   from with_codes as b
   order by ' || order_by || '
   offset $4
   limit  $5'
  using _search, _category, _active, (_page_index * _page_size), _page_size, _needle_like, _sdigits, _sfuzzy;
end;
$$;

grant execute on function public.rpc_product_skus(
  text, text, boolean, integer, integer, text, boolean
) to authenticated;

comment on function public.rpc_product_skus(text, text, boolean, integer, integer, text, boolean)
is 'Search & paginate product SKUs; normalized barcode search (GTIN exact + fuzzy), optional short-code search, returns aggregated barcodes & sku_short_codes.';

commit;
