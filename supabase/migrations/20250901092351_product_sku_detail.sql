create or replace function public.fn_product_sku_detail(_sku_uuid uuid)
returns table(
  product_uuid        uuid,
  sku_uuid            uuid,
  product_name        text,
  product_description text,
  category_code       text,
  is_active           boolean,
  sku_code            text,
  sku_short_code      text,
  uom_code            text,
  default_tax_code    text
)
language sql
stable
set search_path = public
as $$
  select
    p.product_uuid,
    s.sku_uuid,
    p.product_name,
    p.product_description,
    p.category_code,
    s.is_active,
    s.sku_code,
    s.sku_short_code,
    s.uom_code,
    s.default_tax_code
  from public.product_sku s
  join public.product_item p on p.product_uuid = s.product_uuid
  where s.sku_uuid = _sku_uuid
$$;

grant execute on function public.fn_product_sku_detail(uuid) to authenticated;
