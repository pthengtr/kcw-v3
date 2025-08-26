begin;

-- Create the lookup table for 2-digit product categories
create table if not exists public.product_category (
  category_code text primary key
    check (category_code ~ '^[0-9]{2}$'),         -- exactly 2 digits
  category_name text not null,                    -- your friendly name (you will seed)
  description text null,
  sort_order integer null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
) tablespace pg_default;

-- Optional: case-insensitive uniqueness on name (comment out if names can repeat)
create unique index if not exists product_category_name_ci_ux
  on public.product_category (lower(btrim(category_name)));

-- Ensure the generic set_updated_at() trigger exists; create it if missing.
do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    execute $fn$
      create or replace function public.set_updated_at()
      returns trigger
      language plpgsql
      as $body$
      begin
        new.updated_at := now();
        return new;
      end
      $body$;
    $fn$;
  end if;
end$$;

-- Attach updated_at trigger (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'product_category_set_updated_at'
  ) then
    create trigger product_category_set_updated_at
    before update on public.product_category
    for each row
    execute function public.set_updated_at();
  end if;
end$$;

-- Enable RLS
alter table public.product_category enable row level security;

-- Drop old policies if they exist (safe)
drop policy if exists "product_category_read_auth"   on public.product_category;
drop policy if exists "product_category_insert_auth" on public.product_category;
drop policy if exists "product_category_update_auth" on public.product_category;
drop policy if exists "product_category_delete_auth" on public.product_category;

-- Read for authenticated
create policy "product_category_read_auth"
  on public.product_category
  for select
  to authenticated
  using (true);

-- Insert for authenticated
create policy "product_category_insert_auth"
  on public.product_category
  for insert
  to authenticated
  with check (true);

-- Update for authenticated
create policy "product_category_update_auth"
  on public.product_category
  for update
  to authenticated
  using (true)
  with check (true);

-- Delete for authenticated (optional)
create policy "product_category_delete_auth"
  on public.product_category
  for delete
  to authenticated
  using (true);

commit;
