begin;

-- =========================================================
-- 0) Helpers (GTIN + digits) — define unconditionally
--    (CREATE OR REPLACE is idempotent; avoids dollar-quote nesting issues)
-- =========================================================
-- normalize_digits: keep param name "s"
create or replace function public.normalize_digits(s text)
returns text
language sql
immutable
as $fn$
  select regexp_replace(coalesce(s,''), '[^0-9]', '', 'g')
$fn$;

create or replace function public.is_confident_gtin(raw text)
returns boolean
language plpgsql
immutable
as $fn$
declare
  s_norm text;
  L int;
  body text;
  check_digit int;
  sum_ int := 0;
  d int;
  i int;
  cd int;
begin
  s_norm := public.normalize_digits(raw);
  if s_norm = '' then return false; end if;

  L := length(s_norm);
  if L not in (8,12,13,14) then return false; end if;

  body := substring(s_norm from 1 for L-1);
  check_digit := (substring(s_norm from L for 1))::int;

  -- Mod-10 weighting from the right: 3,1,3,1,...
  for i in 0..length(body)-1 loop
    d := (substring(body from L-1-i for 1))::int;
    if (i % 2) = 0 then
      sum_ := sum_ + d * 3;
    else
      sum_ := sum_ + d;
    end if;
  end loop;

  cd := (10 - (sum_ % 10)) % 10;
  return cd = check_digit;
end
$fn$;


-- =========================================================
-- 1) Race-safe SKU autogen helper + wire into RPCs
-- =========================================================
create or replace function public.fn_next_sku_n(v_cc text)
returns int
language plpgsql
strict
security definer
set search_path = public
as $fn$
declare
  n int;
begin
  -- Guard per-category with an xact-scoped advisory lock
  perform pg_advisory_xact_lock( hashtext('sku_cat:' || coalesce(v_cc,''))::bigint );

  with nums as (select gs as n from generate_series(1, 999999) gs),
  existing as (
    select coalesce(nullif(regexp_replace(s.sku_code,'^[0-9]{2}([0-9]+)$','\1'),''),'0')::int as n
    from public.product_sku s
    where s.sku_code ~ '^[0-9]{2}[0-9]+$'
      and substring(s.sku_code,1,2) = v_cc
  ),
  candidate as (
    select n from nums left join existing e using (n)
    where e.n is null order by n limit 1
  )
  select n into n from candidate;

  if n is null then
    raise exception 'Unable to generate sku_code for category %', v_cc using errcode = 'P0001';
  end if;

  return n;
end
$fn$;

-- Drop ANY overloads of the two RPCs to avoid PostgREST confusion
do $outer$
declare r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname in ('fn_product_create_full','fn_product_update_full')
  loop
    execute format('drop function if exists %I.%I(%s);', r.nspname, r.proname, r.args);
  end loop;
end
$outer$;

-- Recreate CREATE RPC (no _sku_short_code)
create or replace function public.fn_product_create_full(
  _product_name        text,
  _product_description text,
  _category_code       text,
  _is_active           boolean default true,
  _sku_code            text default null,
  _default_tax_code    text default null
)
returns table (product_uuid uuid, sku_uuid uuid, sku_code text)
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_product_uuid uuid;
  v_sku_uuid     uuid;
  v_sku_code     text;
  v_cc           text;
  v_name         text;
  v_desc         text;
begin
  v_name := nullif(btrim(_product_name), '');
  v_desc := nullif(btrim(_product_description), '');
  v_cc   := nullif(btrim(_category_code), '');

  if v_name is null then
    raise exception 'product_name is required' using errcode = 'P0001';
  end if;
  if v_cc is null or v_cc !~ '^[0-9]{2}$' then
    raise exception 'category_code must be two digits (00..99)' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.product_category c where c.category_code = v_cc) then
    raise exception 'Unknown category_code: %', v_cc using errcode = 'P0001';
  end if;

  if _default_tax_code is not null and
     not exists (select 1 from public.product_tax_category t where t.tax_code = _default_tax_code) then
    raise exception 'Unknown default_tax_code: %', _default_tax_code using errcode = 'P0001';
  end if;

  if _sku_code is null or btrim(_sku_code) = '' then
    select v_cc || to_char(public.fn_next_sku_n(v_cc), 'FM000000') into v_sku_code;
  else
    v_sku_code := btrim(_sku_code);
    if substring(v_sku_code,1,2) <> v_cc then
      raise exception 'sku_code "%" does not match category_code prefix "%"', v_sku_code, v_cc using errcode = 'P0001';
    end if;
    if exists (select 1 from public.product_sku s where s.sku_code = v_sku_code) then
      raise exception 'sku_code "%" already exists', v_sku_code using errcode = 'P0001';
    end if;
  end if;

  -- Deterministic UUIDs (assumes public.uuid_v5 is present)
  v_product_uuid := public.uuid_v5('11111111-1111-1111-1111-111111111111'::uuid, v_sku_code);
  v_sku_uuid     := public.uuid_v5('33333333-3333-3333-3333-333333333333'::uuid, v_sku_code);

  insert into public.product_item (product_uuid, product_name, product_description, is_active, category_code)
  values (v_product_uuid, v_name, v_desc, coalesce(_is_active, true), v_cc)
  on conflict on constraint product_item_pkey do update
    set product_name        = excluded.product_name,
        product_description = excluded.product_description,
        is_active           = excluded.is_active,
        category_code       = excluded.category_code;

  insert into public.product_sku (sku_uuid, product_uuid, sku_code, default_tax_code, is_active)
  values (v_sku_uuid, v_product_uuid, v_sku_code, _default_tax_code, coalesce(_is_active, true))
  on conflict on constraint product_sku_pkey do update
    set sku_code         = excluded.sku_code,
        default_tax_code = excluded.default_tax_code,
        is_active        = excluded.is_active;

  return query select v_product_uuid, v_sku_uuid, v_sku_code;
end
$fn$;

-- Recreate UPDATE RPC (no _sku_short_code) — required first, then defaults
create or replace function public.fn_product_update_full(
  _product_uuid        uuid,
  _sku_uuid            uuid,
  _product_name        text,
  _product_description text,
  _category_code       text,
  _default_tax_code    text,               -- required
  _is_active           boolean default true,
  _sku_code            text default null
)
returns table (product_uuid uuid, sku_uuid uuid, sku_code text)
language plpgsql
security definer
set search_path = public
as $fn$
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

  if _default_tax_code is null
     or not exists (select 1 from public.product_tax_category t where t.tax_code = _default_tax_code) then
    raise exception 'Unknown default_tax_code: %', _default_tax_code using errcode = 'P0001';
  end if;

  if _sku_code is null or btrim(_sku_code) = '' then
    select v_cc || to_char(public.fn_next_sku_n(v_cc), 'FM000000') into v_sku_code;
  else
    v_sku_code := btrim(_sku_code);
    if substring(v_sku_code,1,2) <> v_cc then
      raise exception 'sku_code "%" does not match category_code prefix "%"', v_sku_code, v_cc using errcode = 'P0001';
    end if;
    if exists (select 1 from public.product_sku s where s.sku_code = v_sku_code and s.sku_uuid <> _sku_uuid) then
      raise exception 'sku_code "%" already exists', v_sku_code using errcode = 'P0001';
    end if;
  end if;

  update public.product_item pi
     set product_name        = v_name,
         product_description = v_desc,
         category_code       = v_cc,
         is_active           = coalesce(_is_active, true)
   where pi.product_uuid = _product_uuid;
  if not found then
    raise exception 'product not found: %', _product_uuid using errcode = 'P0001';
  end if;

  update public.product_sku s
     set sku_code         = v_sku_code,
         default_tax_code = _default_tax_code,
         is_active        = coalesce(_is_active, true)
   where s.sku_uuid = _sku_uuid;
  if not found then
    raise exception 'sku not found: %', _sku_uuid using errcode = 'P0001';
  end if;

  return query select _product_uuid, _sku_uuid, v_sku_code;
end
$fn$;

-- =========================================================
-- 2) Enforce: non-primary barcodes must be GTIN
-- =========================================================
do $outer$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_barcode_nonprimary_must_be_gtin_chk'
      and connamespace = 'public'::regnamespace
  ) then
    execute $ddl$
      alter table public.product_barcode
        add constraint product_barcode_nonprimary_must_be_gtin_chk
        check (is_primary = true or public.is_confident_gtin(barcode));
    $ddl$;
  end if;
end
$outer$;

-- =========================================================
-- 3) Index cleanup (drop dup partial uniques)
-- =========================================================
drop index if exists public.product_barcode_one_primary_per_sku_ux;
drop index if exists public.product_barcode_primary_value_ux;
-- keep: product_barcode_primary_per_sku_ux and product_barcode_primary_per_barcode_ux

-- =========================================================
-- 4) Sync primary barcode with sku_code (DELETE old primary)
-- =========================================================
create or replace function public.trg_sku_sync_primary_barcode()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    if new.sku_code is not null and btrim(new.sku_code) <> '' then
      insert into public.product_barcode (sku_uuid, barcode, is_primary)
      values (new.sku_uuid, new.sku_code, true)
      on conflict (sku_uuid, barcode) do update set is_primary = true;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and (new.sku_code is distinct from old.sku_code) then
    if new.sku_code is null or btrim(new.sku_code) = '' then
      return new;
    end if;

    -- demote any primaries
    update public.product_barcode
       set is_primary = false
     where sku_uuid   = new.sku_uuid
       and is_primary = true;

    -- upsert new primary
    insert into public.product_barcode (sku_uuid, barcode, is_primary)
    values (new.sku_uuid, new.sku_code, true)
    on conflict (sku_uuid, barcode)
    do update set is_primary = excluded.is_primary;

    -- delete the previous primary (now demoted)
    if old.sku_code is not null and old.sku_code <> new.sku_code then
      delete from public.product_barcode
       where sku_uuid   = new.sku_uuid
         and barcode    = old.sku_code
         and is_primary = false;
    end if;

    return new;
  end if;

  return new;
end
$fn$;

drop trigger if exists sku_sync_primary_barcode_ins on public.product_sku;
create trigger sku_sync_primary_barcode_ins
after insert on public.product_sku
for each row execute function public.trg_sku_sync_primary_barcode();

drop trigger if exists sku_sync_primary_barcode_upd on public.product_sku;
create trigger sku_sync_primary_barcode_upd
after update of sku_code on public.product_sku
for each row execute function public.trg_sku_sync_primary_barcode();

commit;
