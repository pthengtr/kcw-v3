-- Allow primary barcode delete only when we explicitly set a flag in-session
create or replace function public.trg_product_barcode_prevent_primary_delete()
returns trigger
language plpgsql
as $$
begin
  -- Look for our allow flag; treat missing as 'off'
  if coalesce(current_setting('app.allow_primary_barcode_delete', true), 'off') <> 'on' then
    if old.is_primary then
      raise exception 'Cannot delete primary barcode directly. Update SKU.sku_code or delete the SKU.';
    end if;
  end if;

  return old;
end$$;

create or replace function public.trg_product_sku_sync_primary_barcode()
returns trigger
language plpgsql
as $$
begin
  -- Allow deleting/replacing the current primary barcode for this SKU
  perform set_config('app.allow_primary_barcode_delete', 'on', true);

  -- Remove any existing primary for this SKU (may delete 0 rows)
  delete from public.product_barcode
  where sku_uuid = new.sku_uuid
    and is_primary = true;

  -- Ensure the primary mirrors NEW.sku_code; if barcode already exists elsewhere, re-point it
  insert into public.product_barcode (barcode, sku_uuid, is_primary)
  values (new.sku_code, new.sku_uuid, true)
  on conflict (barcode) do update
    set sku_uuid   = excluded.sku_uuid,
        is_primary = true;

  return new;
end$$;
