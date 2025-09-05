begin;

-- 1) (Optional) keep a handy index for lookups
create index if not exists idx_product_barcode_digits
  on public.product_barcode (public.normalize_digits(barcode));

-- 2) Demote conflicting primaries that share the same GTIN digits
--    Keep one winner per (barcode_digits) among confident GTINs.
with ranked as (
  select
    ctid,
    public.normalize_digits(barcode) as digits,
    row_number() over (
      partition by public.normalize_digits(barcode)
      order by is_primary desc, sku_uuid asc, barcode asc
    ) as rn,
    is_primary
  from public.product_barcode
  where public.is_confident_gtin(barcode)
    and is_primary = true
)
update public.product_barcode p
set is_primary = false
from ranked r
where p.ctid = r.ctid
  and r.is_primary = true
  and r.rn > 1;

-- 3) Enforce uniqueness **only for primaries** on GTIN digits
--    (so secondaries can coexist with duplicate digits)
create unique index if not exists product_barcode_primary_per_gtin_digits_ux
  on public.product_barcode (public.normalize_digits(barcode))
  where is_primary = true
    and public.is_confident_gtin(barcode);

-- (Optional) If you also have/keep this one, it ensures the *raw* primary text
-- is unique too; safe to keep or drop based on your preference:
create unique index if not exists product_barcode_primary_per_barcode_ux
  on public.product_barcode (barcode)
  where is_primary = true;

commit;
