begin;

alter table public.product_category
  drop column if exists description,
  drop column if exists sort_order,
  drop column if exists is_active;

commit;
