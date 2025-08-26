-- 1) Replace the sync trigger to delete+insert (no ON CONFLICT on partial index)

create or replace function trg_product_sku_sync_primary_barcode()
returns trigger
language plpgsql
as $$
begin
  -- if no code, nothing to sync
  if new.sku_code is null then
    return new;
  end if;

  -- remove any existing primary for this SKU (your partial unique index enforces at most one)
  delete from public.product_barcode
  where sku_uuid = new.sku_uuid
    and is_primary = true;

  -- insert the new primary barcode = sku_code
  insert into public.product_barcode (barcode, sku_uuid, is_primary)
  values (new.sku_code, new.sku_uuid, true);

  -- note: if a *different* SKU already has this barcode (PK on barcode), this will raise,
  -- which is usually what you want: barcodes must be globally unique.
  return new;
end;
$$;

drop trigger if exists product_sku_sync_primary_barcode on public.product_sku;

create trigger product_sku_sync_primary_barcode
after insert or update of sku_code
on public.product_sku
for each row
execute function trg_product_sku_sync_primary_barcode();


-- 2) Keep the guard to ensure a primary row always matches sku_code
create or replace function trg_product_barcode_guard_primary()
returns trigger
language plpgsql
as $$
declare
  v_sku_code text;
begin
  if new.is_primary then
    select sku_code into v_sku_code
    from public.product_sku
    where sku_uuid = new.sku_uuid;

    if v_sku_code is null then
      raise exception 'Cannot set primary barcode before SKU has a sku_code';
    end if;

    if new.barcode is distinct from v_sku_code then
      -- prefer strict: reject rather than silently fixing (avoids surprises)
      raise exception 'Primary barcode (%) must equal SKU sku_code (%)', new.barcode, v_sku_code;
      -- or uncomment to silently fix:
      -- new.barcode := v_sku_code;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists product_barcode_guard_primary on public.product_barcode;

create trigger product_barcode_guard_primary
before insert or update of barcode, is_primary
on public.product_barcode
for each row
execute function trg_product_barcode_guard_primary();


-- 3) Optional: block direct deletion of the primary barcode
create or replace function trg_product_barcode_prevent_primary_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_primary then
    raise exception 'Cannot delete primary barcode directly. Update SKU.sku_code or delete the SKU.';
  end if;
  return old;
end;
$$;

drop trigger if exists product_barcode_prevent_primary_delete on public.product_barcode;

create trigger product_barcode_prevent_primary_delete
before delete on public.product_barcode
for each row
execute function trg_product_barcode_prevent_primary_delete();
