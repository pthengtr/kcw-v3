begin;

-- Digits-only and fuzzy-search projections
alter table public.product_barcode
  add column if not exists barcode_digits text
  generated always as (public.normalize_digits(barcode)) stored,
  add column if not exists barcode_search text
  generated always as (lower(regexp_replace(coalesce(barcode,''), '[\s-]', '', 'g'))) stored;

-- Indexes for fast exact/fuzzy lookup
create index if not exists idx_product_barcode_digits on public.product_barcode (barcode_digits);
create index if not exists idx_product_barcode_search on public.product_barcode (barcode_search);

-- If you search tags/short-codes too:
create index if not exists idx_pssc_lower_short_code on public.product_sku_short_code (sku_uuid, lower(btrim(short_code)));

commit;
