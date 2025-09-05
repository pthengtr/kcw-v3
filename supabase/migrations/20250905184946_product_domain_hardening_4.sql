-- YYYYMMDDHHMM_fix_primary_barcode_guard.sql
begin;

-- Guard: block manual delete of current primary, but allow cascades (no parent SKU)
create or replace function public.chk_primary_barcode_manual_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Only care if the row being deleted is currently primary
  if old.is_primary then
    -- If the parent SKU still exists, this is a manual delete -> block
    if exists (select 1 from public.product_sku s where s.sku_uuid = old.sku_uuid) then
      raise exception 'Cannot delete a primary barcode directly. Demote it or replace it first.'
        using errcode = '23514'; -- check_violation
    end if;
    -- else: parent SKU is already gone (e.g., ON DELETE CASCADE) -> allow
  end if;

  -- AFTER/CONSTRAINT DELETE trigger should return NULL
  return null;
end
$fn$;

-- Reattach as DEFERRABLE so it plays well with cascades in the same statement/txn
drop trigger if exists product_barcode_prevent_primary_delete on public.product_barcode;

create constraint trigger product_barcode_prevent_primary_delete
after delete on public.product_barcode
deferrable initially deferred
for each row
execute function public.chk_primary_barcode_manual_delete();

commit;
