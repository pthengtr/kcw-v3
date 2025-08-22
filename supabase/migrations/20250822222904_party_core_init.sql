-- component: party
-- purpose: core party tables, enums, triggers, indexes
-- notes: idempotent where safe

begin;

-- 0) Extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- 1) ENUMs (in schema public)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'party_kind' and n.nspname = 'public'
  ) then
    create type public.party_kind as enum ('SUPPLIER','CUSTOMER','BOTH');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'bank_account_type' and n.nspname = 'public'
  ) then
    create type public.bank_account_type as enum ('CHECKING','SAVINGS','OTHER');
  end if;
end$$;

-- 2) Core party
create table if not exists public.party (
  party_uuid   uuid primary key default gen_random_uuid(),
  party_code   text unique,              -- optional human code
  party_name   text not null,
  kind         public.party_kind not null default 'CUSTOMER',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- (optional) case-insensitive unique for party_code; replace the simple UNIQUE
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.party'::regclass and conname = 'party_party_code_key'
  ) then
    execute 'alter table public.party drop constraint party_party_code_key';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname='public' and tablename='party' and indexname='party_code_ci_ux'
  ) then
    execute 'create unique index party_code_ci_ux on public.party (lower(btrim(party_code)))';
  end if;
end$$;

-- trigram index on name
create index if not exists idx_party_name_trgm
  on public.party using gin (party_name public.gin_trgm_ops);

-- 3) Tax info (drop-and-create was requested; create fresh)
drop table if exists public.party_tax_info cascade;

create table public.party_tax_info (
  tax_info_uuid uuid primary key default gen_random_uuid(),
  party_uuid    uuid not null references public.party(party_uuid) on delete cascade,
  legal_name    text,
  tax_payer_id  text,
  address       text,
  is_default    boolean not null default false,  -- <-- added (needed for filtered unique)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists ux_party_tax_info_default
  on public.party_tax_info (party_uuid)
  where (is_default);

-- 4) Bank accounts
create table if not exists public.party_bank_info (
  bank_info_uuid      uuid primary key default gen_random_uuid(),
  party_uuid          uuid not null references public.party(party_uuid) on delete cascade,
  bank_name           text not null,
  bank_account_name   text not null,
  bank_account_number text not null,
  bank_branch         text,
  account_type        public.bank_account_type default 'OTHER',
  is_default          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (party_uuid, bank_name, bank_account_number)
);

create unique index if not exists ux_party_bank_default
  on public.party_bank_info (party_uuid)
  where (is_default);

-- 5) Contacts
create table if not exists public.party_contact (
  contact_uuid   uuid primary key default gen_random_uuid(),
  party_uuid     uuid not null references public.party(party_uuid) on delete cascade,
  contact_name   text not null,
  role_title     text,
  email          text,
  phone          text,
  is_primary     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists ux_party_contact_primary
  on public.party_contact (party_uuid)
  where (is_primary);

-- 6) updated_at trigger fn (public)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

-- attach triggers (guard with exists checks)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'party_set_updated_at') then
    create trigger party_set_updated_at
      before update on public.party
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'party_tax_set_updated_at') then
    create trigger party_tax_set_updated_at
      before update on public.party_tax_info
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'party_bank_set_updated_at') then
    create trigger party_bank_set_updated_at
      before update on public.party_bank_info
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'party_contact_set_updated_at') then
    create trigger party_contact_set_updated_at
      before update on public.party_contact
      for each row execute function public.set_updated_at();
  end if;
end$$;

commit;
