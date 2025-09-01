BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_product_skus(
  _page_index INT,
  _page_size  INT,
  _sort_id    TEXT DEFAULT 'sku_updated_at',
  _sort_desc  BOOLEAN DEFAULT TRUE,
  _search     TEXT DEFAULT NULL,
  _category   TEXT DEFAULT NULL,
  _active     BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  sku_uuid UUID,
  product_uuid UUID,
  sku_code TEXT,
  sku_short_code TEXT,
  uom_code TEXT,
  default_tax_code TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  product_item JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  order_by TEXT;
BEGIN
  IF _sort_id NOT IN (
    'sku_code','sku_short_code','uom_code','default_tax_code',
    'sku_updated_at','product_name','category_code'
  ) THEN
    _sort_id := 'sku_updated_at';
  END IF;

  order_by := CASE _sort_id
    WHEN 'sku_code'         THEN format('%I.%I %s NULLS LAST', 'b','sku_code',         CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'sku_short_code'   THEN format('%I.%I %s NULLS LAST', 'b','sku_short_code',   CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'uom_code'         THEN format('%I.%I %s NULLS LAST', 'b','uom_code',         CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'default_tax_code' THEN format('%I.%I %s NULLS LAST', 'b','default_tax_code', CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'product_name'     THEN format('%I.%I %s NULLS LAST', 'b','_product_name',    CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'category_code'    THEN format('%I.%I %s NULLS LAST', 'b','_category_code',   CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    ELSE                         format('%I.%I %s NULLS LAST', 'b','updated_at',       CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
  END;

  RETURN QUERY
  EXECUTE
  'WITH base AS (
     SELECT
       s.sku_uuid,
       s.product_uuid,
       s.sku_code,
       s.sku_short_code,
       s.uom_code,
       s.default_tax_code,
       s.is_active,
       s.created_at,
       s.updated_at,
       p.product_name  AS _product_name,
       p.category_code AS _category_code,
       jsonb_build_object(
         ''product_uuid'', p.product_uuid,
         ''product_name'', p.product_name,
         ''category_code'', p.category_code
       ) AS product_item
     FROM public.product_sku AS s
     JOIN public.product_item AS p
       ON p.product_uuid = s.product_uuid
     WHERE
       ($1::text IS NULL 
         OR s.sku_code ILIKE ''%''||$1||''%''
         OR s.sku_short_code ILIKE ''%''||$1||''%''   -- 👈 added
         OR p.product_name ILIKE ''%''||$1||''%'')
       AND ($2::text IS NULL OR p.category_code ILIKE ''%''||$2||''%'')
       AND ($3::boolean IS NULL OR s.is_active = $3)
   )
   SELECT
     b.sku_uuid,
     b.product_uuid,
     b.sku_code,
     b.sku_short_code,
     b.uom_code,
     b.default_tax_code,
     b.is_active,
     b.created_at,
     b.updated_at,
     b.product_item,
     COUNT(*) OVER() AS total_count
   FROM base AS b
   ORDER BY ' || order_by || '
   OFFSET $4
   LIMIT  $5'
  USING _search, _category, _active, (_page_index * _page_size), _page_size;
END;
$$;

COMMIT;
