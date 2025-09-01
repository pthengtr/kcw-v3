-- 1) Drop the current BEFORE DELETE trigger
drop trigger if exists product_barcode_prevent_primary_delete on public.product_barcode;

-- 2) Guard function: only block if the parent SKU still exists (i.e., manual delete)
create or replace function public.chk_primary_barcode_manual_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_primary
     and exists (select 1 from public.product_sku s where s.sku_uuid = old.sku_uuid) then
    raise exception 'Cannot delete primary barcode directly. Update SKU.sku_code or delete the SKU.';
  end if;
  return null; -- AFTER trigger; return value is ignored
end
$$;

-- 3) Re-create as an AFTER CONSTRAINT trigger (deferrable is fine; immediate is OK)
create constraint trigger product_barcode_prevent_primary_delete
after delete on public.product_barcode
deferrable initially immediate
for each row execute function public.chk_primary_barcode_manual_delete();

create or replace function public.trg_product_sku_sync_primary_barcode()
returns trigger
language plpgsql
as $$
begin
  -- ignore if sku_code is null
  if new.sku_code is null then
    return new;
  end if;

  -- Try to update existing primary barcode row for this SKU
  update public.product_barcode b
     set barcode = new.sku_code
   where b.sku_uuid = new.sku_uuid
     and b.is_primary = true;

  if not found then
    -- No primary row yet: insert one
    insert into public.product_barcode (barcode, sku_uuid, is_primary)
    values (new.sku_code, new.sku_uuid, true);
  end if;

  return new;
end
$$;

drop trigger if exists product_sku_sync_primary_barcode on public.product_sku;

create trigger product_sku_sync_primary_barcode
after insert or update of sku_code on public.product_sku
for each row execute function public.trg_product_sku_sync_primary_barcode();
