begin;

-- Enable RLS on lookups
alter table public.product_size_kind enable row level security;
alter table public.product_size_kind_attr enable row level security;

-- Read-only to authenticated (no insert/update/delete policies -> locked down)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_size_kind' and policyname='product_size_kind_read'
  ) then
    create policy product_size_kind_read
      on public.product_size_kind
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_size_kind_attr' and policyname='product_size_kind_attr_read'
  ) then
    create policy product_size_kind_attr_read
      on public.product_size_kind_attr
      for select
      to authenticated
      using (true);
  end if;
end$$;

-- Ensure product_sku_size has RLS (so v_sku_sizes is protected via base table)
alter table public.product_sku_size enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_sku_size' and policyname='product_sku_size_read'
  ) then
    create policy product_sku_size_read
      on public.product_sku_size
      for select
      to authenticated
      using (true);
  end if;

  -- Optional: allow authenticated to write sizes (match your current posture).
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_sku_size' and policyname='product_sku_size_insert'
  ) then
    create policy product_sku_size_insert
      on public.product_sku_size
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_sku_size' and policyname='product_sku_size_update'
  ) then
    create policy product_sku_size_update
      on public.product_sku_size
      for update
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_sku_size' and policyname='product_sku_size_delete'
  ) then
    create policy product_sku_size_delete
      on public.product_sku_size
      for delete
      to authenticated
      using (true);
  end if;
end$$;

-- Grant read access on the view (RLS applies via base tables)
do $$
begin
  perform 1 from pg_catalog.pg_class c
   join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='v_sku_sizes';

  if found then
    grant select on public.v_sku_sizes to authenticated;
  end if;
end$$;

commit;
