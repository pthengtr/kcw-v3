begin;

-- 1) Drop ALL overloaded variants to avoid PostgREST ambiguity
do $$
declare r record;
begin
  for r in
    select n.nspname schema_name, p.proname func_name,
           pg_get_function_identity_arguments(p.oid) args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='rpc_product_skus'
  loop
    execute format('drop function if exists %I.%I(%s);', r.schema_name, r.func_name, r.args);
  end loop;
end$$;

-- 2) Recreate RPC with explicit size-kind filter + size_kind_label in output
create or replace function public.rpc_product_skus(
  _search     text default null,
  _category   text default null,
  _active     boolean default null,
  _page_index integer default 0,
  _page_size  integer default 50,
  _sort_id    text default 'sku_updated_at',
  _sort_desc  boolean default true,
  _size_kind_codes text[] default null          -- explicit filter (e.g., {'I','C'})
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
  -- sizes
  size_kind_code text,
  size_kind_label text,
  size_tags text[],
  sizes jsonb,
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
  has_size_table boolean;
  search_clause  text;
  sc_join        text := '';
  sc_fields      text := 'coalesce(''{}''::text[], ''{}''::text[]) as sku_short_codes, NULL::text as first_short_code';

  -- sizes
  sz_join   text := '';
  sz_fields text := 'NULL::text as size_kind_code, NULL::text as size_kind_label, coalesce(''{}''::text[], ''{}''::text[]) as size_tags, ''[]''::jsonb as sizes';
begin
  -- Normalize search term
  if _s is not null then
    _needle_like := '%' || regexp_replace(lower(_s), '(%|_)', '\\\1', 'g') || '%';
    _needle_like := regexp_replace(_needle_like, '\s+', '%', 'g');
  end if;

  -- Optional tables presence
  select exists(
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind='r' and n.nspname='public' and c.relname='product_sku_short_code'
  ) into has_sc_table;

  select exists(
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind='r' and n.nspname='public' and c.relname='product_sku_size'
  ) into has_size_table;

  -- Validate sort id
  if _sort_id not in (
    'sku_code','default_tax_code','sku_updated_at','product_name',
    'category_code','product_description','primary_barcode','sku_short_code'
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

  -- Base search (sku, product, barcodes)
  search_clause := '
    ($6::text is null
      or lower(coalesce(s.sku_code, '''')) like $6 escape ''\'' 
      or lower(coalesce(p.product_name, '''')) like $6 escape ''\'' 
      or lower(regexp_replace(coalesce(p.product_description, ''''), ''\s+'', '' '', ''g'')) like $6 escape ''\'' 
      or exists (
          select 1
          from public.product_barcode pb
          where pb.sku_uuid = s.sku_uuid
            and lower(pb.barcode) like $6 escape ''\'' 
      )';

  -- Short codes (optional)
  if has_sc_table then
    search_clause := search_clause || '
      or exists (
          select 1
          from public.product_sku_short_code ss
          where ss.sku_uuid = s.sku_uuid
            and lower(ss.short_code) like $6 escape ''\'' 
      )';
    sc_join := '
      left join lateral (
        select
          array_agg(distinct ss.short_code order by ss.short_code) as sku_short_codes,
          min(ss.short_code) as first_short_code
        from public.product_sku_short_code ss
        where ss.sku_uuid = b.sku_uuid
      ) sc on true
    ';
    sc_fields := 'coalesce(sc.sku_short_codes, ''{}''::text[]) as sku_short_codes, sc.first_short_code';
  end if;

  -- Sizes (optional)
  if has_size_table then
    -- Include size text/label/code in free-text search
    search_clause := search_clause || '
      or exists (
          select 1
          from public.product_sku_size z
          join public.product_size_kind_attr a
            on a.size_kind_code = z.size_kind_code
           and a.attr_pos       = z.attr_pos
          where z.sku_uuid = s.sku_uuid
            and (
              lower(z.size_value) like $6 escape ''\'' or
              lower(a.label_th)   like $6 escape ''\'' or
              lower(coalesce(a.label_en, '''')) like $6 escape ''\'' or
              lower(z.size_kind_code) like $6 escape ''\''          -- search by code (I/C/G/…)
            )
      )';

    -- Also apply explicit size-kind filter (if provided)
    -- Note: this ensures only SKUs that have at least one of the requested kinds are returned.
    search_clause := search_clause || '
      ) and ($8::text[] is null or exists (
        select 1 from public.product_sku_size z2
        where z2.sku_uuid = s.sku_uuid
          and z2.size_kind_code = any($8)
      ))';

    -- Aggregate sizes to display in results, filtered by _size_kind_codes when provided
    sz_join := '
      left join lateral (
        select
          max(z.size_kind_code)                                     as size_kind_code,
          max(k.description)                                        as size_kind_label,
          array_agg(format(''%s: %s'', a.label_th, z.size_value)
                   order by z.attr_pos)                             as size_tags,
          jsonb_agg(jsonb_build_object(
              ''pos'',   z.attr_pos,
              ''label'', a.label_th,
              ''value'', z.size_value
           ) order by z.attr_pos)                                   as sizes
        from public.product_sku_size z
        join public.product_size_kind_attr a
          on a.size_kind_code = z.size_kind_code
         and a.attr_pos       = z.attr_pos
        join public.product_size_kind k
          on k.size_kind_code = z.size_kind_code
        where z.sku_uuid = b.sku_uuid
          and ($8::text[] is null or z.size_kind_code = any($8))
      ) sz on true
    ';
    sz_fields := '
      sz.size_kind_code,
      sz.size_kind_label,
      coalesce(sz.size_tags, ''{}''::text[]) as size_tags,
      coalesce(sz.sizes, ''[]''::jsonb)      as sizes
    ';
  else
    -- close the base search parentheses if size-table branch did not append extra AND
    search_clause := search_clause || ')';
  end if;

  return query
  execute
  'with base as (
     select
       s.sku_uuid, s.product_uuid, s.sku_code, s.default_tax_code, s.is_active,
       s.created_at, s.updated_at,
       p.product_name as _product_name, p.category_code as _category_code,
       p.product_description as _product_description,
       jsonb_build_object(
         ''product_uuid'', p.product_uuid,
         ''product_name'', p.product_name,
         ''category_code'', p.category_code,
         ''product_description'', p.product_description
       ) as product_item
     from public.product_sku s
     join public.product_item p on p.product_uuid = s.product_uuid
     where ' || search_clause || '
       and ($2::text is null or p.category_code ilike ''%''||$2||''%'')
       and ($3::boolean is null or s.is_active = $3)
   ),
   with_codes as (
     select
       b.*,
       coalesce(bc.barcodes, ''{}''::text[]) as barcodes,
       bc.primary_barcode,
       coalesce(bc.barcode_count, 0) as barcode_count,
       ' || sc_fields || ',
       ' || sz_fields || '
     from base b
     left join lateral (
       select
         array_agg(pb.barcode order by pb.is_primary desc, pb.barcode) as barcodes,
         max(pb.barcode) filter (where pb.is_primary) as primary_barcode,
         count(*)::int as barcode_count
       from public.product_barcode pb
       where pb.sku_uuid = b.sku_uuid
     ) bc on true
     ' || sc_join || '
     ' || sz_join || '
   )
   select
     b.sku_uuid, b.product_uuid, b.sku_code, b.default_tax_code, b.is_active,
     b.created_at, b.updated_at,
     b._product_description as product_description,
     b.product_item,
     b.barcodes, b.primary_barcode, b.barcode_count,
     b.sku_short_codes, b.first_short_code,
     b.size_kind_code, b.size_kind_label, b.size_tags, b.sizes,
     count(*) over()::int as total_count
   from with_codes b
   order by ' || order_by || '
   offset $4
   limit  $5'
  using _search, _category, _active, (_page_index * _page_size), _page_size, _needle_like, _size_kind_codes;
end;
$$;

-- 3) Grant (optional)
do $$
begin
  perform 1 from pg_roles where rolname='authenticated';
  if found then
    grant execute on function public.rpc_product_skus(
      text, text, boolean, integer, integer, text, boolean, text[]
    ) to authenticated;
  end if;
end$$;

commit;
