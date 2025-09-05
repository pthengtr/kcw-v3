begin;

-- 1) Drop the old version that still had _sku_short_code (if present)
drop function if exists public.fn_product_update_full(
  uuid,   -- _product_uuid
  uuid,   -- _sku_uuid
  text,   -- _product_name
  text,   -- _product_description
  text,   -- _category_code
  boolean,-- _is_active
  text,   -- _sku_code
  text,   -- _sku_short_code  <-- removed in new version
  text    -- _default_tax_code
);

-- 2) If you created an incorrect new version (with _default_tax_code after a defaulted param), drop it too
drop function if exists public.fn_product_update_full(
  uuid, uuid, text, text, text, boolean, text, text
);

-- 3) Recreate with corrected parameter order:
--    required args first, THEN defaults
create or replace function public.fn_product_update_full(
  _product_uuid        uuid,
  _sku_uuid            uuid,
  _product_name        text,
  _product_description text,
  _category_code       text,
  _default_tax_code    text,               -- required (moved up)
  _is_active           boolean default true,
  _sku_code            text default null
)
returns table (
  product_uuid uuid,
  sku_uuid     uuid,
  sku_code     text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cc        text;
  v_name      text;
  v_desc      text;
  v_sku_code  text;
begin
  if _product_uuid is null or _sku_uuid is null then
    raise exception 'product_uuid and sku_uuid are required' using errcode = 'P0001';
  end if;

  v_name := nullif(btrim(_product_name), '');
  v_desc := nullif(btrim(_product_description), '');
  v_cc   := nullif(btrim(_category_code), '');

  if v_name is null then
    raise exception 'product_name is required' using errcode = 'P0001';
  end if;
  if v_cc is null or v_cc !~ '^[0-9]{2}$' then
    raise exception 'category_code must be two digits' using errcode = 'P0001';
  end if;

  -- validate refs (category + tax)
  if not exists (select 1 from public.product_category c where c.category_code = v_cc) then
    raise exception 'Unknown category_code: %', v_cc using errcode = 'P0001';
  end if;

  if _default_tax_code is null
     or not exists (select 1 from public.product_tax_category t where t.tax_code = _default_tax_code) then
    raise exception 'Unknown default_tax_code: %', _default_tax_code using errcode = 'P0001';
  end if;

  -- decide sku_code (autogen or validate); exclude current sku_uuid from uniqueness checks
  if _sku_code is null or btrim(_sku_code) = '' then
    with nums as (select gs as n from generate_series(1, 999999) gs),
    existing as (
      select coalesce(nullif(regexp_replace(s.sku_code,'^[0-9]{2}([0-9]+)$','\1'),''),'0')::int as n
      from public.product_sku s
      where s.sku_code ~ '^[0-9]{2}[0-9]+$'
        and substring(s.sku_code,1,2) = v_cc
        and s.sku_uuid <> _sku_uuid
    ),
    candidate as (
      select n from nums left join existing e using (n)
      where e.n is null order by n limit 1
    )
    select v_cc || to_char(n,'FM000000') into v_sku_code from candidate;

    if v_sku_code is null then
      raise exception 'Unable to generate sku_code for category %', v_cc using errcode = 'P0001';
    end if;
  else
    v_sku_code := btrim(_sku_code);
    if substring(v_sku_code,1,2) <> v_cc then
      raise exception 'sku_code "%" does not match category_code prefix "%"', v_sku_code, v_cc using errcode = 'P0001';
    end if;
    if exists (select 1 from public.product_sku s where s.sku_code = v_sku_code and s.sku_uuid <> _sku_uuid) then
      raise exception 'sku_code "%" already exists', v_sku_code using errcode = 'P0001';
    end if;
  end if;

  -- update product
  update public.product_item pi
     set product_name        = v_name,
         product_description = v_desc,
         category_code       = v_cc,
         is_active           = coalesce(_is_active, true)
   where pi.product_uuid = _product_uuid;

  if not found then
    raise exception 'product not found: %', _product_uuid using errcode = 'P0001';
  end if;

  -- update sku
  update public.product_sku s
     set sku_code         = v_sku_code,
         default_tax_code = _default_tax_code,
         is_active        = coalesce(_is_active, true)
   where s.sku_uuid = _sku_uuid;

  if not found then
    raise exception 'sku not found: %', _sku_uuid using errcode = 'P0001';
  end if;

  return query
    select _product_uuid as product_uuid,
           _sku_uuid     as sku_uuid,
           v_sku_code    as sku_code;
end
$$;

-- 4) Privileges
revoke all on function public.fn_product_update_full(uuid, uuid, text, text, text, text, boolean, text) from public;
grant execute on function public.fn_product_update_full(uuid, uuid, text, text, text, text, boolean, text) to authenticated;

commit;
