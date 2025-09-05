begin;

-- 0) Helpful lookup index (safe to re-run)
create index if not exists idx_product_barcode_barcode on public.product_barcode (barcode);
create index if not exists idx_product_barcode_sku_uuid on public.product_barcode (sku_uuid);

-- 1) Drop global uniqueness on (barcode) if present
alter table public.product_barcode
  drop constraint if exists product_barcode_pkey;

drop index if exists product_barcode_barcode_key;
drop index if exists product_barcode_ux;   -- just in case of old names

-- 2) Data repair BEFORE adding partial-unique rules
-- 2a) Ensure at most one primary per SKU (keep one winner)
with ranked as (
  select ctid,
         row_number() over (partition by sku_uuid order by is_primary desc, barcode asc) as rn
  from public.product_barcode
  where is_primary = true
)
update public.product_barcode p
set is_primary = false
from ranked r
where p.ctid = r.ctid and r.rn > 1;

-- 2b) Ensure a barcode isn't primary for multiple SKUs (keep one winner)
with ranked as (
  select ctid,
         row_number() over (partition by barcode order by is_primary desc, sku_uuid asc) as rn
  from public.product_barcode
  where is_primary = true
)
update public.product_barcode p
set is_primary = false
from ranked r
where p.ctid = r.ctid and r.rn > 1;

-- 3) Enforce partial-unique rules (primary-only)
--    (a) One PRIMARY per SKU
create unique index if not exists product_barcode_primary_per_sku_ux
  on public.product_barcode (sku_uuid)
  where is_primary = true;

--    (b) One PRIMARY per BARCODE text
create unique index if not exists product_barcode_primary_per_barcode_ux
  on public.product_barcode (barcode)
  where is_primary = true;

-- 4) GTIN helpers are optional now; no CHECK constraints are added.
--    (Keep your normalize_digits/is_valid_gtin funcs if you still use them elsewhere.)

-- 5) Replace the sync trigger to avoid ON CONFLICT (works with duplicate secondaries)
create or replace function public.trg_product_sku_sync_primary_barcode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _ctid tid;
begin
  if TG_OP in ('INSERT','UPDATE') and new.sku_code is not null then
    -- (i) If another SKU currently has this barcode as PRIMARY, demote it
    update public.product_barcode
    set is_primary = false
    where barcode = new.sku_code
      and sku_uuid <> new.sku_uuid
      and is_primary = true;

    -- (ii) Prefer to reuse an existing row for this barcode (any SKU), move it to this SKU
    select ctid into _ctid
    from public.product_barcode
    where barcode = new.sku_code
    order by is_primary desc  -- prefer promoting an existing primary record if present
    limit 1;

    if _ctid is not null then
      update public.product_barcode
      set sku_uuid = new.sku_uuid,
          is_primary = true
      where ctid = _ctid;
    else
      -- No existing row with this barcode: insert a fresh PRIMARY
      insert into public.product_barcode (barcode, sku_uuid, is_primary)
      values (new.sku_code, new.sku_uuid, true);
    end if;

    -- (iii) Ensure only one PRIMARY for this SKU (demote any others on this SKU)
    update public.product_barcode
    set is_primary = false
    where sku_uuid = new.sku_uuid
      and barcode <> new.sku_code
      and is_primary = true;
  end if;

  return new;
end
$$;

-- 6) Ensure the trigger object points to the function above
drop trigger if exists product_sku_sync_primary_barcode on public.product_sku;

create trigger product_sku_sync_primary_barcode
  after insert or update of sku_code on public.product_sku
  for each row execute function public.trg_product_sku_sync_primary_barcode();

commit;
