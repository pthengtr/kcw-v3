create unique index if not exists product_sku_one_per_product_ux
on public.product_sku (product_uuid);

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
set search_path = public
as $$
declare
  v_product_uuid uuid;
  v_sku_uuid     uuid;
  v_sku_code     text;
  v_cc           text;  -- normalized category code
  v_name         text;
  v_desc         text;
begin
  -- Normalize inputs
  v_name := nullif(btrim(_product_name), '');
  v_desc := nullif(btrim(_product_description), '');
  v_cc   := nullif(btrim(_category_code), '');
  if v_name is null then
    raise exception 'product_name is required' using errcode = 'P0001';
  end if;
  if v_cc is null or v_cc !~ '^[0-9]{2}$' then
    raise exception 'category_code must be two digits (e.g., 00..99)' using errcode = 'P0001';
  end if;

  -- Validate referential inputs exist
  if not exists (select 1 from public.product_category c where c.category_code = v_cc) then
    raise exception 'Unknown category_code: %', v_cc using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.product_uom u where u.uom_code = _uom_code) then
    raise exception 'Unknown uom_code: %', _uom_code using errcode = 'P0001';
  end if;

  if _default_tax_code is not null and
     not exists (select 1 from public.product_tax_category t where t.tax_code = _default_tax_code) then
    raise exception 'Unknown default_tax_code: %', _default_tax_code using errcode = 'P0001';
  end if;

  -- Derive/validate SKU code
  if _sku_code is null or btrim(_sku_code) = '' then
    -- Autogenerate: first available CC + 6-digit number, filling gaps.
    -- Example: '07' -> '07000001', '07000002', ...
    with nums as (
      select gs as n
      from generate_series(1, 999999) gs
    ),
    existing as (
      select coalesce(
               nullif(regexp_replace(s.sku_code, '^[0-9]{2}([0-9]+)$', '\1'), ''),
               '0'
             )::int as n
      from public.product_sku s
      where s.sku_code ~ '^[0-9]{2}[0-9]+$'
        and substring(s.sku_code, 1, 2) = v_cc
    ),
    candidates as (
      select n
      from nums
      left join existing e using (n)
      where e.n is null
      order by n
      limit 1
    )
    select format('%s%06s', v_cc, n::text) into v_sku_code
    from candidates;

    if v_sku_code is null then
      raise exception 'Unable to generate sku_code for category % (exhausted range)', v_cc using errcode = 'P0001';
    end if;
  else
    v_sku_code := btrim(_sku_code);
    -- Must start with category prefix
    if substring(v_sku_code, 1, 2) <> v_cc then
      raise exception 'sku_code "%" does not match category_code prefix "%"', v_sku_code, v_cc using errcode = 'P0001';
    end if;
    -- Must be unique
    if exists (select 1 from public.product_sku s where s.sku_code = v_sku_code) then
      raise exception 'sku_code "%" already exists', v_sku_code using errcode = 'P0001';
    end if;
  end if;

  -- Create product
  insert into public.product_item (
    product_uuid, product_name, product_description, is_active, category_code
  ) values (
    gen_random_uuid(), v_name, v_desc, coalesce(_is_active, true), v_cc
  )
  returning product_uuid into v_product_uuid;

  -- Create its single SKU (active mirrors product; sku_code set per rules above)
  insert into public.product_sku (
    sku_uuid, product_uuid, sku_code, uom_code, default_tax_code,
    sku_short_code, is_active
  ) values (
    gen_random_uuid(), v_product_uuid, v_sku_code, _uom_code, _default_tax_code,
    nullif(btrim(_sku_short_code), ''), coalesce(_is_active, true)
  )
  returning sku_uuid into v_sku_uuid;

  -- NOTE:
  -- Your existing triggers will sync/create the primary barcode from sku_code.

  return query select v_product_uuid, v_sku_uuid, v_sku_code;
end$$;

grant execute on function public.fn_product_create_full(
  text, text, text, boolean, text, text, text, text
) to authenticated;
