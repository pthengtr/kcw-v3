-- =========================================================
-- RLS for product_seed_raw (authenticated full access)
-- =========================================================

-- (Optional but recommended) tighten default grants
revoke all on table public.product_seed_raw from public;

-- Grant privileges so policies can apply
grant select, insert, update, delete on table public.product_seed_raw to authenticated;

-- Enable RLS
alter table public.product_seed_raw enable row level security;

-- SELECT policy (create only if missing)
do $pl$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'product_seed_raw'
      and policyname = 'seed_raw_auth_select'
  ) then
    execute 'create policy seed_raw_auth_select on public.product_seed_raw
             for select to authenticated using (true)';
  end if;
end
$pl$;

-- INSERT/UPDATE/DELETE policy (create only if missing)
do $pl$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'product_seed_raw'
      and policyname = 'seed_raw_auth_modify'
  ) then
    execute 'create policy seed_raw_auth_modify on public.product_seed_raw
             for all to authenticated using (true) with check (true)';
  end if;
end
$pl$;
