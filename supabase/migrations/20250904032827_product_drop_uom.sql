begin;

-- 1. Drop foreign key constraint from product_sku to product_uom
alter table if exists public.product_sku
  drop constraint if exists product_sku_uom_code_fkey;

-- 2. Drop the column uom_code from product_sku
alter table if exists public.product_sku
  drop column if exists uom_code;

-- 3. Drop the product_uom table itself
drop table if exists public.product_uom cascade;

commit;
