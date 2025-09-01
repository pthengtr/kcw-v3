create or replace function public.fn_product_refs()
returns jsonb
language sql
stable
set search_path = public
as $$
select jsonb_build_object(
  'categories', coalesce((
    select jsonb_agg(jsonb_build_object(
             'value', c.category_code,
             'label', c.category_code || ' — ' || c.category_name
           ) order by c.category_code)
    from public.product_category c
  ), '[]'::jsonb),

  'uoms', coalesce((
    select jsonb_agg(jsonb_build_object(
             'value', u.uom_code,
             'label', u.uom_code || coalesce(' — ' || nullif(u.description, ''), '')
           ) order by u.uom_code)
    from public.product_uom u
  ), '[]'::jsonb),

  'taxes', coalesce((
    select jsonb_agg(jsonb_build_object(
             'value', t.tax_code,
             'label',
               t.tax_code
               || coalesce(' — ' || nullif(t.description, ''), '')
               || ' — ' || to_char(t.rate, 'FM999990.##') || '%'
           ) order by t.tax_code)
    from public.product_tax_category t
  ), '[]'::jsonb)
);
$$;

grant execute on function public.fn_product_refs() to authenticated;
