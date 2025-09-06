alter table public.product_sku_size enable row level security;

-- Read
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_sku_size' and policyname='product_sku_size_read') then
    create policy product_sku_size_read
      on public.product_sku_size
      for select
      to authenticated
      using (true);
  end if;
end$$;

-- Insert
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_sku_size' and policyname='product_sku_size_insert') then
    create policy product_sku_size_insert
      on public.product_sku_size
      for insert
      to authenticated
      with check (true);
  end if;
end$$;

-- Update
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_sku_size' and policyname='product_sku_size_update') then
    create policy product_sku_size_update
      on public.product_sku_size
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end$$;

-- Delete
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_sku_size' and policyname='product_sku_size_delete') then
    create policy product_sku_size_delete
      on public.product_sku_size
      for delete
      to authenticated
      using (true);
  end if;
end$$;
