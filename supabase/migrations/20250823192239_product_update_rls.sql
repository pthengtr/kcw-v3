-- Product: items / sku / barcode / lookups
alter table public.product_item        enable row level security;
alter table public.product_sku         enable row level security;
alter table public.product_barcode     enable row level security;
alter table public.product_uom         enable row level security;
alter table public.product_tax_category enable row level security;

-- READ policies
create policy "read product_item (auth)" on public.product_item
  for select to authenticated using (true);

create policy "read product_sku (auth)" on public.product_sku
  for select to authenticated using (true);

create policy "read product_barcode (auth)" on public.product_barcode
  for select to authenticated using (true);

create policy "read product_uom (auth)" on public.product_uom
  for select to authenticated using (true);

create policy "read product_tax_category (auth)" on public.product_tax_category
  for select to authenticated using (true);

-- WRITE policies (optional; add only what you need)
create policy "insert product_item (auth)" on public.product_item
  for insert to authenticated with check (true);
create policy "update product_item (auth)" on public.product_item
  for update to authenticated using (true) with check (true);
create policy "delete product_item (auth)" on public.product_item
  for delete to authenticated using (true);

create policy "insert product_sku (auth)" on public.product_sku
  for insert to authenticated with check (true);
create policy "update product_sku (auth)" on public.product_sku
  for update to authenticated using (true) with check (true);
create policy "delete product_sku (auth)" on public.product_sku
  for delete to authenticated using (true);

create policy "insert product_barcode (auth)" on public.product_barcode
  for insert to authenticated with check (true);
create policy "delete product_barcode (auth)" on public.product_barcode
  for delete to authenticated using (true);
