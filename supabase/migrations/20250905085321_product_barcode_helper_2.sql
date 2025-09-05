begin;

-- 0) Helpful index (safe to re-run)
create index if not exists idx_product_barcode_sku_uuid
  on public.product_barcode (sku_uuid);

-- 1) Dedupe rows that share the same barcode, keeping a single winner
--    Preference: primary=true first, then stable order by sku_uuid
with ranked as (
  select
    ctid,
    barcode,
    sku_uuid,
    is_primary,
    row_number() over (
      partition by barcode
      order by is_primary desc, sku_uuid asc
    ) as rn
  from public.product_barcode
)
delete from public.product_barcode p
using ranked r
where p.ctid = r.ctid
  and r.rn > 1;

-- 2) Ensure the PK/unique exists on (barcode) so ON CONFLICT works
alter table public.product_barcode
  drop constraint if exists product_barcode_pkey;

alter table public.product_barcode
  add constraint product_barcode_pkey primary key (barcode);

-- 3) Keep/restore "one primary per SKU" (partial unique)
create unique index if not exists product_barcode_primary_per_sku_ux
  on public.product_barcode (sku_uuid)
  where is_primary = true;

-- 4) (Re)create your GTIN-agnostic sync trigger function (uses ON CONFLICT)
create or replace function public.trg_product_sku_sync_primary_barcode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP in ('INSERT','UPDATE') and new.sku_code is not null then
    -- Upsert/move primary to match the sku_code exactly
    insert into public.product_barcode (barcode, sku_uuid, is_primary)
    values (new.sku_code, new.sku_uuid, true)
    on conflict (barcode) do update
      set sku_uuid   = excluded.sku_uuid,
          is_primary = true;

    -- Demote any other primaries for this SKU
    update public.product_barcode
    set is_primary = false
    where sku_uuid = new.sku_uuid
      and barcode <> new.sku_code
      and is_primary = true;
  end if;

  return new;
end
$$;

commit;
