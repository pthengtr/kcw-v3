begin;

-- 1) Ensure VAT7 exists (idempotent)
insert into public.product_tax_category (tax_code, rate, tax_type, is_vat, description)
values ('VAT7', 7.00, 'VAT', true, 'VAT 7%')
on conflict (tax_code) do update
  set rate      = excluded.rate,
      tax_type  = excluded.tax_type,
      is_vat    = excluded.is_vat,
      description = coalesce(public.product_tax_category.description, excluded.description);

-- 2) Set DB-level DEFAULT for new rows
alter table public.product_sku
  alter column default_tax_code set default 'VAT7';

-- 3a) Update existing rows that are NULL
update public.product_sku
set default_tax_code = 'VAT7'
where default_tax_code is null;

-- 3b) If you want to force ALL SKUs to VAT7 (uncomment instead of 3a)
-- update public.product_sku
-- set default_tax_code = 'VAT7'
-- where default_tax_code is distinct from 'VAT7';

commit;
