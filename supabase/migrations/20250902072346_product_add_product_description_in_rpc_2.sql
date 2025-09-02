-- 001_add_product_description_to_rpc_product_skus.sql
-- Purpose: expose product_description in rpc_product_skus and allow sorting by it

BEGIN;

-- Drop existing overload (adjust the signature below if yours differs)
DROP FUNCTION IF EXISTS public.rpc_product_skus(
  text,      -- _search
  text,      -- _category
  boolean,   -- _active
  text,      -- _sort_id
  boolean,   -- _sort_desc
  integer,   -- _page_index
  integer    -- _page_size
);

CREATE FUNCTION public.rpc_product_skus(
  _search     text      DEFAULT NULL,
  _category   text      DEFAULT NULL,
  _active     boolean   DEFAULT NULL,
  _sort_id    text      DEFAULT 'sku_updated_at',
  _sort_desc  boolean   DEFAULT true,
  _page_index integer   DEFAULT 0,
  _page_size  integer   DEFAULT 50
)
RETURNS TABLE (
  sku_uuid            uuid,
  product_uuid        uuid,
  sku_code            text,
  sku_short_code      text,
  uom_code            text,
  default_tax_code    text,
  is_active           boolean,
  created_at          timestamptz,
  updated_at          timestamptz,
  product_description text,     -- NEW: surfaced as a top-level column
  product_item        jsonb,    -- includes product_description too
  total_count         bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  order_by TEXT;
BEGIN
  IF _sort_id NOT IN (
    'sku_code','sku_short_code','uom_code','default_tax_code',
    'sku_updated_at','product_name','category_code','product_description'
  ) THEN
    _sort_id := 'sku_updated_at';
  END IF;

  order_by := CASE _sort_id
    WHEN 'sku_code'            THEN format('%I.%I %s NULLS LAST', 'b','sku_code',            CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'sku_short_code'      THEN format('%I.%I %s NULLS LAST', 'b','sku_short_code',      CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'uom_code'            THEN format('%I.%I %s NULLS LAST', 'b','uom_code',            CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'default_tax_code'    THEN format('%I.%I %s NULLS LAST', 'b','default_tax_code',    CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'product_name'        THEN format('%I.%I %s NULLS LAST', 'b','_product_name',       CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'category_code'       THEN format('%I.%I %s NULLS LAST', 'b','_category_code',      CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'product_description' THEN format('%I.%I %s NULLS LAST', 'b','_product_description',CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    ELSE                            format('%I.%I %s NULLS LAST', 'b','updated_at',          CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
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
       p.product_name         AS _product_name,
       p.category_code        AS _category_code,
       p.product_description  AS _product_description,
       jsonb_build_object(
         ''product_uuid'',        p.product_uuid,
         ''product_name'',        p.product_name,
         ''category_code'',       p.category_code,
         ''product_description'', p.product_description
       ) AS product_item
     FROM public.product_sku AS s
     JOIN public.product_item AS p
       ON p.product_uuid = s.product_uuid
     WHERE
       ($1::text IS NULL 
         OR s.sku_code ILIKE ''%''||$1||''%''
         OR s.sku_short_code ILIKE ''%''||$1||''%''
         OR p.product_name ILIKE ''%''||$1||''%''
         OR p.product_description ILIKE ''%''||$1||''%'')
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
     b._product_description AS product_description,
     b.product_item,
     COUNT(*) OVER() AS total_count
   FROM base AS b
   ORDER BY ' || order_by || '
   OFFSET $4
   LIMIT  $5'
  USING _search, _category, _active, (_page_index * _page_size), _page_size;
END;
$$;

-- Lock down/allow execution as you prefer (Supabase: grant to authenticated)
REVOKE ALL ON FUNCTION public.rpc_product_skus(text,text,boolean,text,boolean,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_product_skus(text,text,boolean,text,boolean,integer,integer) TO authenticated;

COMMENT ON FUNCTION public.rpc_product_skus(text,text,boolean,text,boolean,integer,integer)
  IS 'List SKUs with product context, supports search/sort/pagination. Includes product_description.';

COMMIT;
