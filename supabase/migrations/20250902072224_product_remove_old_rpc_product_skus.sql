-- 00x_remove_old_overloads_rpc_product_skus.sql
-- Remove older/previous overloads of rpc_product_skus that cause ambiguity (PGRST203).

BEGIN;

DO $$
DECLARE
  r record;
  keep_args constant text := 'text, text, boolean, text, boolean, integer, integer';
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rpc_product_skus'
  LOOP
    -- Drop any overload whose argument list is NOT the canonical one
    IF r.args <> keep_args THEN
      EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s);', r.nspname, r.proname, r.args);
    END IF;
  END LOOP;
END$$;

COMMIT;
