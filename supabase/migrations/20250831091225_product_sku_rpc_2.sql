-- === Migration: RPC + indexes for product_sku x product_item listing ===
-- Run inside your database (psql / Supabase SQL editor)

BEGIN;

-- 0) Extensions
DO $$
BEGIN
  -- for ILIKE + %search% performance
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    CREATE EXTENSION pg_trgm;
  END IF;
END$$;

-- 1) Helpful indexes (idempotent)
-- text search on SKU code
CREATE INDEX IF NOT EXISTS idx_product_sku_code_trgm
  ON public.product_sku USING gin (sku_code gin_trgm_ops);

-- text search on Product name
CREATE INDEX IF NOT EXISTS idx_product_item_name_trgm
  ON public.product_item USING gin (product_name gin_trgm_ops);

-- filter on category
CREATE INDEX IF NOT EXISTS idx_product_item_category_code
  ON public.product_item (category_code);

-- sort on SKU updated_at (DESC in query still uses this index)
CREATE INDEX IF NOT EXISTS idx_product_sku_updated_at
  ON public.product_sku (updated_at);

-- (optional but common) FK fan-out
CREATE INDEX IF NOT EXISTS idx_product_sku_product_uuid
  ON public.product_sku (product_uuid);

-- 2) RPC: server paging + filter + sort (safe dynamic order by)
--    Returns a page of SKU rows joined with minimal product fields plus a window total_count.
CREATE OR REPLACE FUNCTION public.rpc_product_skus(
  _page_index INT,
  _page_size  INT,
  _sort_id    TEXT DEFAULT 'sku_updated_at', -- one of: sku_code, sku_short_code, uom_code, default_tax_code, sku_updated_at, product_name, category_code
  _sort_desc  BOOLEAN DEFAULT TRUE,
  _search     TEXT DEFAULT NULL,             -- matches sku_code OR product_name (ILIKE)
  _category   TEXT DEFAULT NULL,             -- matches product_item.category_code (ILIKE)
  _active     BOOLEAN DEFAULT NULL           -- NULL=all, TRUE/FALSE filter s.is_active
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
  product_item JSONB,        -- { product_uuid, product_name, category_code }
  total_count BIGINT         -- same value on each row (window count)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  order_by TEXT;
BEGIN
  -- Whitelist sort_id to avoid SQL injection and mistakes
  IF _sort_id NOT IN (
    'sku_code','sku_short_code','uom_code','default_tax_code',
    'sku_updated_at','product_name','category_code'
  ) THEN
    _sort_id := 'sku_updated_at';
  END IF;

  -- Build safe ORDER BY with identifiers (%I) and ASC/DESC token
  order_by := CASE _sort_id
    WHEN 'sku_code'         THEN format('%I %s NULLS LAST', 's.sku_code',         CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'sku_short_code'   THEN format('%I %s NULLS LAST', 's.sku_short_code',   CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'uom_code'         THEN format('%I %s NULLS LAST', 's.uom_code',         CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'default_tax_code' THEN format('%I %s NULLS LAST', 's.default_tax_code', CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'product_name'     THEN format('%I %s NULLS LAST', 'p.product_name',     CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'category_code'    THEN format('%I %s NULLS LAST', 'p.category_code',    CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    ELSE                         format('%I %s NULLS LAST', 's.updated_at',       CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
  END;

  -- Return the page with a window total_count; filter parameters are bound via USING.
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
       jsonb_build_object(
         ''product_uuid'', p.product_uuid,
         ''product_name'', p.product_name,
         ''category_code'', p.category_code
       ) AS product_item
     FROM public.product_sku AS s
     JOIN public.product_item AS p
       ON p.product_uuid = s.product_uuid
     WHERE
       ($1::text IS NULL OR s.sku_code ILIKE ''%''||$1||''%'' OR p.product_name ILIKE ''%''||$1||''%'')
       AND ($2::text IS NULL OR p.category_code ILIKE ''%''||$2||''%'')
       AND ($3::boolean IS NULL OR s.is_active = $3)
   )
   SELECT
     b.*,
     COUNT(*) OVER() AS total_count
   FROM base AS b
   ORDER BY ' || order_by || '
   OFFSET $4
   LIMIT  $5'
  USING _search, _category, _active, (_page_index * _page_size), _page_size;
END;
$$;

-- (Optional) Grant execute to roles your app uses (Supabase anon/authenticated)
-- GRANT EXECUTE ON FUNCTION public.rpc_product_skus(INT,INT,TEXT,BOOLEAN,TEXT,TEXT,BOOLEAN) TO anon, authenticated;

COMMIT;
