-- =========================================
-- Location domain (table, indexes, trigger, RLS)
-- =========================================

-- Extensions needed
create extension if not exists pgcrypto;   -- for gen_random_uuid()
create extension if not exists pg_trgm;    -- for trigram search

-- 1) Table
create table if not exists public.location (
  location_uuid uuid not null default gen_random_uuid(),
  location_code text not null,
  location_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint location_pkey primary key (location_uuid),
  constraint location_code_key unique (location_code)
);

-- 2) Case-insensitive unique index on code (trim + lower)
create unique index if not exists location_code_ci_ux
  on public.location (lower(btrim(location_code)));

-- 3) Trigram index for fast partial search on name
create index if not exists idx_location_name_trgm
  on public.location using gin (location_name gin_trgm_ops);

-- 4) Ensure the "set_updated_at" trigger function exists
do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    create or replace function public.set_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at := now();
      return new;
    end
    $fn$;
  end if;
end$$;

-- 5) BEFORE UPDATE trigger to maintain updated_at
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'location_set_updated_at'
  ) then
    create trigger location_set_updated_at
      before update on public.location
      for each row
      execute function public.set_updated_at();
  end if;
end$$;

-- 6) Row-Level Security (authenticated only)
alter table public.location enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'location'
      and policyname = 'location_auth_rls'
  ) then
    create policy location_auth_rls
      on public.location
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end$$;
