-- db/migrations/20250826_search_products.sql
create or replace function public.search_products(
  q text,
  limit_count integer default 50,
  offset_count integer default 0
)
returns table (
  product_uuid uuid,
  product_name text,
  product_description text,
  category_code text,
  is_active boolean,
  sku_codes text[],
  sku_short_codes text[],
  score numeric
)
language sql
stable
-- SECURITY INVOKER by default; keeps your RLS policies in effect
as $$
  with needle as (
    select coalesce(nullif(trim(q), ''), '') as q
  ),
  base as (
    select
      p.product_uuid,
      p.product_name,
      p.product_description,
      p.category_code,
      p.is_active,
      p.updated_at,                       -- ✅ include updated_at here
      -- simple relevance score
      (case when p.product_name ilike '%'||n.q||'%' then 1 else 0 end)*3 +
      (case when exists (
        select 1 from public.product_sku s
        where s.product_uuid = p.product_uuid
          and (s.sku_code ilike '%'||n.q||'%' or s.sku_short_code ilike '%'||n.q||'%')
      ) then 1 else 0 end)*2 +
      (case when p.product_description ilike '%'||n.q||'%' then 1 else 0 end) as score
    from public.product_item p
    cross join needle n
    where n.q = ''
       or p.product_name ilike '%'||n.q||'%'
       or p.product_description ilike '%'||n.q||'%'
       or exists (
          select 1 from public.product_sku s
          where s.product_uuid = p.product_uuid
            and (s.sku_code ilike '%'||n.q||'%' or s.sku_short_code ilike '%'||n.q||'%')
       )
  ),
  page as (
    select *
    from base
    order by score desc, updated_at desc
    limit limit_count offset offset_count
  )
  select
    pg.product_uuid,
    pg.product_name,
    pg.product_description,
    pg.category_code,
    pg.is_active,
    coalesce(array_remove(array_agg(s.sku_code), null), '{}')         as sku_codes,
    coalesce(array_remove(array_agg(s.sku_short_code), null), '{}')   as sku_short_codes,
    pg.score::numeric                                                 as score
  from page pg
  left join public.product_sku s on s.product_uuid = pg.product_uuid
  group by
    pg.product_uuid, pg.product_name, pg.product_description,
    pg.category_code, pg.is_active, pg.updated_at, pg.score
  order by pg.score desc, pg.updated_at desc;
$$;

comment on function public.search_products(text, integer, integer)
  is 'Search products by name/description and SKUs, returns aggregated SKUs, paginated.';
