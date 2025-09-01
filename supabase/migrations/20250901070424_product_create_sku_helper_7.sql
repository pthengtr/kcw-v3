create or replace function public.fn_product_create_full(
  _product_name        text,
  _product_description text,
  _category_code       text,
  _is_active           boolean,
  _sku_code            text,   -- nullable: autogenerate if null/blank
  _uom_code            text,
  _sku_short_code      text,
  _default_tax_code    text
)
returns table (product_uuid uuid, sku_uuid uuid, sku_code text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_product_uuid uuid;
  v_sku_uuid     uuid;
  v_sku_code     text;
  v_cc           text;
  v_name         text;
  v_desc         text;
begin
  -- normalize
  v_name := nullif(btrim(_product_name), '');
  v_desc := nullif(btrim(_product_description), '');
  v_cc   := nullif(btrim(_category_code), '');
  if v_name is null then
    raise exception 'product_name is required' using errcode = 'P0001';
  end if;
  if v_cc is null or v_cc !~ '^[0-9]{2}$' then
    raise exception 'category_code must be two digits (00..99)' using errcode = 'P0001';
  end if;

  -- validate refs
  if not exists (select 1 from public.product_category c where c.category_code = v_cc) then
    raise exception 'Unknown category_code: %', v_cc using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.product_uom u where btrim(u.uom_code) = btrim(_uom_code)) then
    raise exception 'Unknown uom_code: %', _uom_code using errcode = 'P0001';
  end if;

  if _default_tax_code is not null and
     not exists (select 1 from public.product_tax_category t where t.tax_code = _default_tax_code) then
    raise exception 'Unknown default_tax_code: %', _default_tax_code using errcode = 'P0001';
  end if;

  -- sku_code (auto or validate)
  if _sku_code is null or btrim(_sku_code) = '' then
    -- Auto-generate: CC + 6 digits (fills gaps: 01000001, 01000002, ...)
    with nums as (
      select gs as n from generate_series(1, 999999) gs
    ),
    existing as (
      select coalesce(
               nullif(regexp_replace(s.sku_code,'^[0-9]{2}([0-9]+)$','\1'),''),'0'
             )::int as n
      from public.product_sku s
      where s.sku_code ~ '^[0-9]{2}[0-9]+$'
        and substring(s.sku_code,1,2) = v_cc
    ),
    candidate as (
      select n
      from nums
      left join existing e using (n)
      where e.n is null
      order by n
      limit 1
    )
    select v_cc || to_char(n, 'FM000000') into v_sku_code
    from candidate;

    if v_sku_code is null then
      raise exception 'Unable to generate sku_code for category %', v_cc using errcode = 'P0001';
    end if;
  else
    v_sku_code := btrim(_sku_code);
    if substring(v_sku_code,1,2) <> v_cc then
      raise exception 'sku_code "%" does not match category_code prefix "%"', v_sku_code, v_cc using errcode = 'P0001';
    end if;
    if exists (select 1 from public.product_sku s where s.sku_code = v_sku_code) then
      raise exception 'sku_code "%" already exists', v_sku_code using errcode = 'P0001';
    end if;
  end if;

  -- deterministic UUIDs (match your seed script)
  v_product_uuid := public.uuid_v5('11111111-1111-1111-1111-111111111111'::uuid, v_sku_code);
  v_sku_uuid     := public.uuid_v5('33333333-3333-3333-3333-333333333333'::uuid, v_sku_code);

  -- upsert product (use constraint name to avoid OUT-var ambiguity)
  insert into public.product_item (
    product_uuid, product_name, product_description, is_active, category_code
  ) values (
    v_product_uuid, v_name, v_desc, coalesce(_is_active, true), v_cc
  )
  on conflict on constraint product_item_pkey do update
    set product_name        = excluded.product_name,
        product_description = excluded.product_description,
        is_active           = excluded.is_active,
        category_code       = excluded.category_code;

  -- upsert sku
  insert into public.product_sku (
    sku_uuid, product_uuid, sku_code, uom_code, default_tax_code,
    sku_short_code, is_active
  ) values (
    v_sku_uuid, v_product_uuid, v_sku_code, _uom_code, _default_tax_code,
    nullif(btrim(_sku_short_code), ''), coalesce(_is_active, true)
  )
  on conflict on constraint product_sku_pkey do update
    set sku_code         = excluded.sku_code,
        uom_code         = excluded.uom_code,
        default_tax_code = excluded.default_tax_code,
        sku_short_code   = excluded.sku_short_code,
        is_active        = excluded.is_active;

  return query select v_product_uuid, v_sku_uuid, v_sku_code;
end$$;

grant execute on function public.fn_product_create_full(
  text, text, text, boolean, text, text, text, text
) to authenticated;
