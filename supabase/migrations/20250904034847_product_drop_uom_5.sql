begin;

-- 1) Drop ALL existing overloads of fn_product_refs (any signatures)
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'fn_product_refs'
  loop
    execute format('drop function if exists %s;', r.sig);
  end loop;
end$$;

-- 2) Create the new UOM-free function (no args)
create function public.fn_product_refs()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'value', c.category_code,
                 'label', c.category_code || ' — ' || c.category_name
               )
               order by c.category_code
             )
      from public.product_category c
    ), '[]'::jsonb),

    'taxes', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'value', t.tax_code,
                 'label',
                   t.tax_code
                   || coalesce(' — ' || nullif(t.description, ''), '')
                   || ' — ' || to_char(t.rate, 'FM999990.##') || '%'
               )
               order by t.tax_code
             )
      from public.product_tax_category t
    ), '[]'::jsonb)
  );
$$;

-- 3) (Optional) Grant to your application role(s)
-- grant execute on function public.fn_product_refs() to authenticated;

commit;
