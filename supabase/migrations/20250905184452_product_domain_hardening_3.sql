-- YYYYMMDDHHMM_guard_primary_barcode.sql
begin;

-- 1) Guard function: block manual deletion of the current primary barcode
create or replace function public.chk_primary_barcode_manual_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Only block when the row being deleted is currently primary.
  -- (Server flows that demote first, then delete, will be allowed.)
  if old.is_primary then
    raise exception 'Cannot delete a primary barcode directly. Demote it or replace it first.'
      using errcode = '23514'; -- check_violation
  end if;

  -- AFTER/CONSTRAINT DELETE triggers should return NULL
  return null;
end
$fn$;

-- 2) Re-attach the trigger as a DEFERRABLE constraint trigger
--    DEFERRABLE INITIALLY DEFERRED makes it safe with ON DELETE CASCADE of SKUs.
drop trigger if exists product_barcode_prevent_primary_delete on public.product_barcode;

create constraint trigger product_barcode_prevent_primary_delete
after delete on public.product_barcode
deferrable initially deferred
for each row
execute function public.chk_primary_barcode_manual_delete();

commit;
