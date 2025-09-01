-- === Migration: fix rpc_product_skus ORDER BY to use outer alias b ===
BEGIN;

-- Ensure pg_trgm exists (for ILIKE search performance)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE EXTENSION pg_trgm;
  END IF;
END$$;

-- Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_product_sku_code_trgm
  ON public.product_sku USING gin (sku_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_item_name_trgm
  ON public.product_item USING gin (product_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_item_category_code
  ON public.product_item (category_code);

CREATE INDEX IF NOT EXISTS idx_product_sku_updated_at
  ON public.product_sku (updated_at);

CREATE INDEX IF NOT EXISTS idx_product_sku_product_uuid
  ON public.product_sku (product_uuid);

-- RPC: server paging + filter + sort (safe and correct aliasing)
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
  -- Whitelist sort_id
  IF _sort_id NOT IN (
    'sku_code','sku_short_code','uom_code','default_tax_code',
    'sku_updated_at','product_name','category_code'
  ) THEN
    _sort_id := 'sku_updated_at';
  END IF;

  -- We order in the OUTER query over alias b.
  -- For product fields, project them in the CTE as _product_name / _category_code.
  order_by := CASE _sort_id
    WHEN 'sku_code'         THEN format('%I.%I %s NULLS LAST', 'b','sku_code',         CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'sku_short_code'   THEN format('%I.%I %s NULLS LAST', 'b','sku_short_code',   CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'uom_code'         THEN format('%I.%I %s NULLS LAST', 'b','uom_code',         CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'default_tax_code' THEN format('%I.%I %s NULLS LAST', 'b','default_tax_code', CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'product_name'     THEN format('%I.%I %s NULLS LAST', 'b','_product_name',    CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    WHEN 'category_code'    THEN format('%I.%I %s NULLS LAST', 'b','_category_code',   CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END)
    ELSE                         format('%I.%I %s NULLS LAST', 'b','updated_at',       CASE WHEN _sort_desc THEN 'DESC' ELSE 'ASC' END) -- sku_updated_at
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
       -- expose product fields both as JSON and as sortable columns
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
       ($1::text IS NULL OR s.sku_code ILIKE ''%''||$1||''%'' OR p.product_name ILIKE ''%''||$1||''%'')
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
