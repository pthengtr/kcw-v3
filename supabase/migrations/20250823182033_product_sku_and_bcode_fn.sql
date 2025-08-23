begin;

-- 0) Ensure pgcrypto exists for digest()
-- Ensure pgcrypto is available in the `extensions` schema
create extension if not exists pgcrypto with schema extensions;

-- Deterministic UUID v5 using extensions.digest()
create or replace function public.uuid_v5(ns uuid, name text)
returns uuid
language sql
immutable
as $$
with nsb as (
  select decode(replace(ns::text, '-', ''), 'hex')::bytea as b
),
h as (
  -- schema-qualified digest to avoid "function digest(...) does not exist"
  select extensions.digest((select b from nsb) || convert_to(name, 'UTF8'), 'sha1')::bytea as b
),
s as (
  select substring(b from 1 for 16) as b from h
),
v as (
  -- set version (byte 6 high nibble = 0101b) and variant (byte 8 high bits = 10b)
  select
    set_byte(
      set_byte(b, 6, (get_byte(b,6) & 15)  | 80),
      8, (get_byte(b,8) & 63) | 128
    ) as b
  from s
)
select (
  encode(substring(b from 1  for 4),'hex') || '-' ||
  encode(substring(b from 5  for 2),'hex') || '-' ||
  encode(substring(b from 7  for 2),'hex') || '-' ||
  encode(substring(b from 9  for 2),'hex') || '-' ||
  encode(substring(b from 11 for 6),'hex')
)::uuid
from v;
$$;


-- 2) Safety net UOM
insert into public.product_uom (uom_code, description)
values ('EA', 'Single unit')
on conflict (uom_code) do nothing;

-- 3) Schema tweak for ACODE on SKU + helpful indexes
alter table public.product_sku
  add column if not exists sku_short_code text;

create index if not exists idx_product_sku_short_code_ci
  on public.product_sku (lower(btrim(sku_short_code)));

create index if not exists idx_product_barcode_group2
  on public.product_barcode ((substring(barcode from 1 for 2)));

-- 4) Next barcode allocator (group = first 2 digits)
create or replace function public.fn_next_bcode(group2 text)
returns text
language plpgsql
as $$
declare
  g text;
  last_suffix int;
  next_suffix int;
  next_code text;
begin
  -- normalize & validate group (exactly 2 digits)
  g := regexp_replace(coalesce(group2,''), '\D', '', 'g');
  if length(g) <> 2 then
    raise exception 'Group must be exactly 2 digits, got: %', group2
      using errcode = '22023';
  end if;

  -- per-group transactional advisory lock
  perform pg_advisory_xact_lock(hashtext('bcode_group_' || g));

  -- largest 6-digit suffix among 8-digit numeric barcodes in this group
  select coalesce(max(substring(barcode from 3 for 6)::int), 0)
    into last_suffix
  from public.product_barcode
  where barcode ~ '^[0-9]{8}$'
    and substring(barcode from 1 for 2) = g;

  if last_suffix >= 999999 then
    raise exception 'Group % is exhausted (>= 999999).', g;
  end if;

  next_suffix := last_suffix + 1;
  next_code := g || lpad(next_suffix::text, 6, '0');

  -- paranoia check (advisory lock already prevents races)
  if exists (select 1 from public.product_barcode where barcode = next_code) then
    raise exception 'Race detected: barcode % already exists. Retry.', next_code
      using errcode = '40001';
  end if;

  return next_code;
end
$$;

commit;
