-- Function: sync primary barcode to match sku_code
create or replace function trg_product_sku_sync_primary_barcode()
returns trigger
language plpgsql
as $$
begin
  -- nothing to do if sku_code is null
  if new.sku_code is null then
    return new;
  end if;

  -- Upsert the primary barcode for this SKU.
  -- Uses your unique partial index "product_barcode_primary_per_sku_ux"
  -- so each sku_uuid has at most one is_primary=true.
  insert into public.product_barcode (barcode, sku_uuid, is_primary)
  values (new.sku_code, new.sku_uuid, true)
  on conflict on constraint product_barcode_primary_per_sku_ux
  do update set barcode = excluded.barcode;

  -- Note: if "barcode" (the text) already exists for SOME OTHER SKU as a
  -- non-primary/extra barcode, the PK on product_barcode(barcode) will
  -- raise an error. That's intentional: barcodes must be globally unique.
  return new;
end;
$$;

drop trigger if exists product_sku_sync_primary_barcode on public.product_sku;

create trigger product_sku_sync_primary_barcode
after insert or update of sku_code
on public.product_sku
for each row
execute function trg_product_sku_sync_primary_barcode();


