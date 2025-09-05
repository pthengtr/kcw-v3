create or replace function public.fn_next_sku_n(v_cc text)
returns int
language plpgsql
strict
security definer
set search_path = public
as $fn$
declare
  v_next int;
begin
  -- per-category xact-scoped advisory lock
  perform pg_advisory_xact_lock( hashtext('sku_cat:' || coalesce(v_cc,''))::bigint );

  with nums(n) as (
    select gs from generate_series(1, 999999) gs
  ),
  existing(n) as (
    select coalesce(
             nullif(regexp_replace(s.sku_code,'^[0-9]{2}([0-9]+)$','\1'),''),'0'
           )::int
    from public.product_sku s
    where s.sku_code ~ '^[0-9]{2}[0-9]+$'
      and substring(s.sku_code,1,2) = v_cc
  ),
  candidate(n) as (
    select n
    from nums
    left join existing e using (n)
    where e.n is null
    order by n
    limit 1
  )
  select c.n into v_next from candidate c;

  if v_next is null then
    raise exception 'Unable to generate sku_code for category %', v_cc using errcode = 'P0001';
  end if;

  return v_next;
end
$fn$;
