create or replace function public.rpc_product_skus_v2(_f jsonb default '{}'::jsonb)
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
  s text := nullif(btrim(coalesce(_f->>'search','')), '');
  needle text := case
    when s is null then null
    else regexp_replace('%' || regexp_replace(lower(s), '(%|_)', '\\\1', 'g') || '%', '\s+', '%', 'g')
  end;

  sort_id text  := coalesce(_f->>'sort_id','sku_updated_at');
  sort_desc bool := coalesce((_f->>'sort_desc')::boolean, true);

  page_index int := coalesce((_f->>'page_index')::int, 0);
  page_size  int := coalesce((_f->>'page_size')::int, 50);

  cat text := nullif(btrim(coalesce(_f->>'category',null)), '');
  act text := lower(nullif(_f->>'active','')); -- 'active' | 'inactive' | null

  kind_codes text[] := case when jsonb_typeof(_f->'size_kind_codes')='array'
                      then (select array_agg(value::text) from jsonb_array_elements_text(_f->'size_kind_codes'))
                      else null end;
  kind_code  text := nullif(_f->>'size_kind_code','');

  pos1_like text := case when nullif(_f->>'size_pos1','') is null then null
                         else '%'||regexp_replace(lower(_f->>'size_pos1'), '(%|_)', '\\\1', 'g')||'%' end;
  pos2_like text := case when nullif(_f->>'size_pos2','') is null then null
                         else '%'||regexp_replace(lower(_f->>'size_pos2'), '(%|_)', '\\\1', 'g')||'%' end;
  pos3_like text := case when nullif(_f->>'size_pos3','') is null then null
                         else '%'||regexp_replace(lower(_f->>'size_pos3'), '(%|_)', '\\\1', 'g')||'%' end;

  order_by text;
begin
  -- validate sort id
  if sort_id not in ('sku_code','default_tax_code','sku_updated_at','product_name',
                     'category_code','product_description','primary_barcode','sku_short_code',
                     'size_pos1','size_pos2','size_pos3') then
    sort_id := 'sku_updated_at';
  end if;

  order_by := case sort_id
    when 'sku_code'            then format('%s %s NULLS LAST', 'v.sku_code',             case when sort_desc then 'DESC' else 'ASC' end)
    when 'default_tax_code'    then format('%s %s NULLS LAST', 'v.default_tax_code',     case when sort_desc then 'DESC' else 'ASC' end)
    when 'product_name'        then format('%s %s NULLS LAST', 'v._product_name',        case when sort_desc then 'DESC' else 'ASC' end)
    when 'category_code'       then format('%s %s NULLS LAST', 'v._category_code',       case when sort_desc then 'DESC' else 'ASC' end)
    when 'product_description' then format('%s %s NULLS LAST', 'v._product_description', case when sort_desc then 'DESC' else 'ASC' end)
    when 'primary_barcode'     then format('%s %s NULLS LAST', 'v.primary_barcode',      case when sort_desc then 'DESC' else 'ASC' end)
    when 'sku_short_code'      then format('%s %s NULLS LAST', 'v.first_short_code',     case when sort_desc then 'DESC' else 'ASC' end)
    when 'size_pos1'           then format('v.pos1n %s NULLS LAST, v.pos1t %s NULLS LAST', case when sort_desc then 'DESC' else 'ASC' end, case when sort_desc then 'DESC' else 'ASC' end)
    when 'size_pos2'           then format('v.pos2n %s NULLS LAST, v.pos2t %s NULLS LAST', case when sort_desc then 'DESC' else 'ASC' end, case when sort_desc then 'DESC' else 'ASC' end)
    when 'size_pos3'           then format('v.pos3n %s NULLS LAST, v.pos3t %s NULLS LAST', case when sort_desc then 'DESC' else 'ASC' end, case when sort_desc then 'DESC' else 'ASC' end)
    else                              format('%s %s NULLS LAST', 'v.updated_at',          case when sort_desc then 'DESC' else 'ASC' end)
  end;

  return query
  execute
  $q$
    with filtered as (
      select v.*
      from public.v_sku_list v
      where
        -- free text
        (
          $1::text is null
          or lower(coalesce(v.sku_code,'')) like $1 escape '\'
          or lower(coalesce(v._product_name,'')) like $1 escape '\'
          or lower(regexp_replace(coalesce(v._product_description,''), '\s+', ' ', 'g')) like $1 escape '\'
          or exists (
            select 1 from unnest(v.barcodes) b where lower(b) like $1 escape '\'
          )
          or exists (
            select 1 from unnest(v.sku_short_codes) sc where lower(sc) like $1 escape '\'
          )
          or exists (
            select 1 from jsonb_array_elements(v.sizes) j
            where lower(coalesce(j->>'value','')) like $1 escape '\'
               or lower(coalesce(j->>'label','')) like $1 escape '\'
          )
          or (lower(coalesce(v.size_kind_code,'')) like $1 escape '\')
        )
        and ($2::text is null or v._category_code ilike '%'||$2||'%')
        and ($3::text is null or (case when $3='active' then v.is_active when $3='inactive' then not v.is_active else true end))
        -- kind filter (either multi or single)
        and (
          ($4::text[] is null and $5::text is null)
          or ( $4::text[] is not null and v.size_kind_code = any($4) )
          or ( $5::text is not null and v.size_kind_code = $5 )
        )
        -- slot filters (only if kind chosen)
        and (
          ($4::text[] is null and $5::text is null)
          or (
            ($6::text is null or lower(coalesce(v.pos1t,'')) like $6 escape '\')
            and ($7::text is null or lower(coalesce(v.pos2t,'')) like $7 escape '\')
            and ($8::text is null or lower(coalesce(v.pos3t,'')) like $8 escape '\')
          )
        )
    )
    select
      f.sku_uuid, f.product_uuid, f.sku_code, f.default_tax_code, f.is_active,
      f.created_at, f.updated_at,
      f._product_description as product_description,
      f.product_item,
      f.barcodes, f.primary_barcode, f.barcode_count,
      f.sku_short_codes, f.first_short_code,
      f.size_kind_code, f.size_kind_label, f.size_tags, f.sizes,
      count(*) over()::int as total_count
    from filtered f
    order by
  $q$ || order_by || $q$
    offset $9
    limit  $10
  $q$
  using
    needle,        -- $1
    cat,           -- $2
    act,           -- $3
    kind_codes,    -- $4
    kind_code,     -- $5
    pos1_like,     -- $6
    pos2_like,     -- $7
    pos3_like,     -- $8
    (page_index * page_size), -- $9
    page_size;     -- $10
end;
$$;

-- grant (optional)
do $$
begin
  perform 1 from pg_roles where rolname='authenticated';
  if found then grant execute on function public.rpc_product_skus_v2(jsonb) to authenticated; end if;
end$$;
