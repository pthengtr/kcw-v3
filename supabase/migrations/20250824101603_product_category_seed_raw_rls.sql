begin;

-- Enable RLS
alter table public.product_category_seed_raw enable row level security;

-- Clean up old policies if they exist
drop policy if exists "seed_raw_select_auth" on public.product_category_seed_raw;
drop policy if exists "seed_raw_insert_auth" on public.product_category_seed_raw;
drop policy if exists "seed_raw_update_auth" on public.product_category_seed_raw;
drop policy if exists "seed_raw_delete_auth" on public.product_category_seed_raw;

-- Read for authenticated
create policy "seed_raw_select_auth"
  on public.product_category_seed_raw
  for select
  to authenticated
  using (true);

-- Insert for authenticated
create policy "seed_raw_insert_auth"
  on public.product_category_seed_raw
  for insert
  to authenticated
  with check (true);

-- Update for authenticated
create policy "seed_raw_update_auth"
  on public.product_category_seed_raw
  for update
  to authenticated
  using (true)
  with check (true);

-- Delete for authenticated (optional; include if you want them to be able to wipe rows)
create policy "seed_raw_delete_auth"
  on public.product_category_seed_raw
  for delete
  to authenticated
  using (true);

commit;
