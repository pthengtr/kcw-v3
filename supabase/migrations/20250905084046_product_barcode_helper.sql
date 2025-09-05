begin;

-- 1) Remove the GTIN requirement for primary barcodes
alter table public.product_barcode
  drop constraint if exists product_barcode_primary_is_gtin_ck;

-- (Optional but recommended to keep)
-- If you previously added this partial unique index, it's safe to KEEP it.
-- It only dedupes *true* GTINs by their digits; non-GTIN SKUs are unaffected.
-- create unique index if not exists product_barcode_digits_gtin_ux
--   on public.product_barcode (barcode_digits)
--   where public.is_confident_gtin(barcode);

-- 2) Make the SKU→primary sync trigger *agnostic* (always sync when sku_code is set)
create or replace function public.trg_product_sku_sync_primary_barcode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP in ('INSERT','UPDATE') and new.sku_code is not null then
    -- upsert/move primary to match the sku_code text exactly (raw, not normalized)
    insert into public.product_barcode (barcode, sku_uuid, is_primary)
    values (new.sku_code, new.sku_uuid, true)
    on conflict (barcode) do update
      set sku_uuid   = excluded.sku_uuid,
          is_primary = true;

    -- demote any other primaries for this SKU
    update public.product_barcode
    set is_primary = false
    where sku_uuid = new.sku_uuid
      and barcode <> new.sku_code
      and is_primary = true;
  end if;

  return new;
end
$$;

-- (Your existing trigger object `product_sku_sync_primary_barcode` still points here.)
-- If you had dropped it earlier, recreate it:
-- drop trigger if exists product_sku_sync_primary_barcode on public.product_sku;
-- create trigger product_sku_sync_primary_barcode
--   after insert or update of sku_code on public.product_sku
--   for each row execute function public.trg_product_sku_sync_primary_barcode();

commit;
