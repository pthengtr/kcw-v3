create or replace function public.fn_product_update_full(
  _product_uuid        uuid,
  _sku_uuid            uuid,
  _product_name        text,
  _product_description text,
  _category_code       text,
  _is_active           boolean,
  _sku_code            text,    -- blank => autogen
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

  if not exists (select 1 from public.product_category c where c.category_code = v_cc) then
    raise exception 'Unknown category_code: %', v_cc using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.product_uom u where btrim(u.uom_code) = btrim(_uom_code)) then
    raise exception 'Unknown uom_code: %', _uom_code using errcode = 'P0001';
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

  -- update product (✅ fully qualified)
  update public.product_item pi
     set product_name        = v_name,
         product_description = v_desc,
         category_code       = v_cc,
         is_active           = coalesce(_is_active, true)
   where pi.product_uuid = _product_uuid;

  if not found then
    raise exception 'product not found: %', _product_uuid using errcode = 'P0001';
  end if;

  -- update sku (✅ fully qualified)
  update public.product_sku s
     set sku_code         = v_sku_code,
         uom_code         = _uom_code,
         sku_short_code   = nullif(btrim(_sku_short_code), ''),
         default_tax_code = _default_tax_code,
         is_active        = coalesce(_is_active, true)
   where s.sku_uuid = _sku_uuid;

  if not found then
    raise exception 'sku not found: %', _sku_uuid using errcode = 'P0001';
  end if;

  -- explicit aliases on return to avoid any name confusion
  return query
    select _product_uuid as product_uuid,
           _sku_uuid     as sku_uuid,
           v_sku_code    as sku_code;
end
$$;
