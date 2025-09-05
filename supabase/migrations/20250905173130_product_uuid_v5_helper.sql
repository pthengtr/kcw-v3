-- Supabase / Postgres (installs into schema "extensions" if provided)
create extension if not exists "uuid-ossp" with schema extensions;

-- Keep your existing name but wrap the built-in
create or replace function public.uuid_v5(ns uuid, name text)
returns uuid
language sql
immutable
set search_path = public, extensions
as $$
  select uuid_generate_v5(ns, name);
$$;
