-- Drop all overloads of these functions, regardless of signature
do $$
declare
  r record;
  -- set to ' CASCADE' (with leading space) if you want to force-drop dependents
  v_cascade text := '';
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('fn_product_create_full', 'fn_product_update_full')
  loop
    execute format('drop function if exists %I.%I(%s)%s;',
                   r.nspname, r.proname, r.args, v_cascade);
    -- optional: RAISE NOTICE 'dropped %.%(%).', r.nspname, r.proname, r.args;
  end loop;
end
$$;
