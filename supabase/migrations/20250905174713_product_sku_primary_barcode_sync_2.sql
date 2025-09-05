-- Keep barcodes in lockstep with sku_code and DELETE the previous primary.

create or replace function public.trg_sku_sync_primary_barcode()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- INSERT: ensure a primary row exists for sku_code
  if tg_op = 'INSERT' then
    if new.sku_code is not null and btrim(new.sku_code) <> '' then
      insert into public.product_barcode (sku_uuid, barcode, is_primary)
      values (new.sku_uuid, new.sku_code, true)
      on conflict (sku_uuid, barcode)
      do update set is_primary = true;  -- idempotent
    end if;
    return new;
  end if;

  -- UPDATE: only act if sku_code actually changed
  if tg_op = 'UPDATE' and (new.sku_code is distinct from old.sku_code) then
    if new.sku_code is null or btrim(new.sku_code) = '' then
      -- If you allow blank sku_code, do nothing; otherwise you could raise here.
      return new;
    end if;

    -- 1) Demote any existing primary for this SKU (avoids partial-unique conflict)
    update public.product_barcode
       set is_primary = false
     where sku_uuid   = new.sku_uuid
       and is_primary = true;

    -- 2) Upsert the new primary row (new sku_code)
    insert into public.product_barcode (sku_uuid, barcode, is_primary)
    values (new.sku_uuid, new.sku_code, true)
    on conflict (sku_uuid, barcode)
    do update set is_primary = excluded.is_primary;

    -- 3) DELETE the previous primary row (now demoted), if it’s different
    if old.sku_code is not null and old.sku_code <> new.sku_code then
      delete from public.product_barcode
       where sku_uuid = new.sku_uuid
         and barcode  = old.sku_code
         and is_primary = false;  -- ensure we never delete a primary here
    end if;

    return new;
  end if;

  return new;
end
$fn$;

-- Recreate triggers to use the updated function
drop trigger if exists sku_sync_primary_barcode_ins on public.product_sku;
create trigger sku_sync_primary_barcode_ins
after insert on public.product_sku
for each row execute function public.trg_sku_sync_primary_barcode();

drop trigger if exists sku_sync_primary_barcode_upd on public.product_sku;
create trigger sku_sync_primary_barcode_upd
after update of sku_code on public.product_sku
for each row execute function public.trg_sku_sync_primary_barcode();
