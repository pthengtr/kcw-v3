create or replace view public.v_sku_list as
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
    'product_uuid',        p.product_uuid,
    'product_name',        p.product_name,
    'category_code',       p.category_code,
    'product_description', p.product_description
  ) as product_item,

  -- barcodes
  coalesce(bc.barcodes, '{}'::text[]) as barcodes,
  bc.primary_barcode,
  coalesce(bc.barcode_count, 0)       as barcode_count,

  -- short codes
  coalesce(sc.sku_short_codes, '{}'::text[]) as sku_short_codes,
  sc.first_short_code,

  -- sizes (single kind per SKU assumed; if multiples exist, this picks the max…adjust as needed)
  sz.size_kind_code,
  sz.size_kind_label,
  coalesce(sz.size_tags, '{}'::text[]) as size_tags,
  coalesce(sz.sizes, '[]'::jsonb)      as sizes,

  -- precomputed columns for size sorting
  sz.pos1n, sz.pos1t, sz.pos2n, sz.pos2t, sz.pos3n, sz.pos3t
from public.product_sku s
join public.product_item p on p.product_uuid = s.product_uuid
left join lateral (
  select
    array_agg(pb.barcode order by pb.is_primary desc, pb.barcode) as barcodes,
    max(pb.barcode) filter (where pb.is_primary)                  as primary_barcode,
    count(*)::int                                                 as barcode_count
  from public.product_barcode pb
  where pb.sku_uuid = s.sku_uuid
) bc on true
left join lateral (
  select
    array_agg(distinct ss.short_code order by ss.short_code) as sku_short_codes,
    min(ss.short_code) as first_short_code
  from public.product_sku_short_code ss
  where ss.sku_uuid = s.sku_uuid
) sc on true
left join lateral (
  select
    max(z.size_kind_code)                                     as size_kind_code,
    max(k.description)                                        as size_kind_label,
    array_agg(format('%s: %s', a.label_th, z.size_value)
             order by z.attr_pos)                             as size_tags,
    jsonb_agg(jsonb_build_object(
        'pos',   z.attr_pos,
        'label', a.label_th,
        'value', z.size_value
     ) order by z.attr_pos)                                   as sizes,
    max(case when z.attr_pos=1 then public.fn_first_number(z.size_value) end) as pos1n,
    max(case when z.attr_pos=1 then z.size_value end)         as pos1t,
    max(case when z.attr_pos=2 then public.fn_first_number(z.size_value) end) as pos2n,
    max(case when z.attr_pos=2 then z.size_value end)         as pos2t,
    max(case when z.attr_pos=3 then public.fn_first_number(z.size_value) end) as pos3n,
    max(case when z.attr_pos=3 then z.size_value end)         as pos3t
  from public.product_sku_size z
  join public.product_size_kind_attr a
    on a.size_kind_code = z.size_kind_code
   and a.attr_pos       = z.attr_pos
  join public.product_size_kind k
    on k.size_kind_code = z.size_kind_code
  where z.sku_uuid = s.sku_uuid
) sz on true;
