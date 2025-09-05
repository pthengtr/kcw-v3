-- Primary follows sku_code: ensure a row exists and is_primary=true;
-- demote others to is_primary=false. Idempotent & safe with your unique indexes.

create or replace function public.trg_sku_sync_primary_barcode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- only act when sku_code is present
  if new.sku_code is null or btrim(new.sku_code) = '' then
    return new;
  end if;

  -- 1) Upsert the primary row for (sku_uuid, sku_code)
  insert into public.product_barcode (sku_uuid, barcode, is_primary)
  values (new.sku_uuid, new.sku_code, true)
  on conflict (sku_uuid, barcode)
  do update set is_primary = true;

  -- 2) Demote all other barcodes for this SKU
  update public.product_barcode
     set is_primary = false
   where sku_uuid = new.sku_uuid
     and barcode <> new.sku_code
     and is_primary = true;

  -- (optional) If you prefer to drop the old primary instead of demoting it:
  -- if tg_op = 'UPDATE' and old.sku_code is not null and old.sku_code <> new.sku_code then
  --   delete from public.product_barcode
  --   where sku_uuid = new.sku_uuid and barcode = old.sku_code;
  -- end if;

  return new;
end
$$;

drop trigger if exists sku_sync_primary_barcode_ins on public.product_sku;
create trigger sku_sync_primary_barcode_ins
after insert on public.product_sku
for each row execute function public.trg_sku_sync_primary_barcode();

drop trigger if exists sku_sync_primary_barcode_upd on public.product_sku;
create trigger sku_sync_primary_barcode_upd
after update of sku_code on public.product_sku
for each row execute function public.trg_sku_sync_primary_barcode();
