-- 20250823_rls_party_simple.sql

-- Enable RLS on all party-related tables
alter table public.party              enable row level security;
alter table public.party_bank_info    enable row level security;
alter table public.party_contact      enable row level security;
alter table public.party_tax_info     enable row level security;

-- PARTY
drop policy if exists "party all for authenticated" on public.party;
create policy "party all for authenticated"
on public.party
for all
to authenticated
using (true)
with check (true);

-- PARTY_BANK_INFO
drop policy if exists "party_bank all for authenticated" on public.party_bank_info;
create policy "party_bank all for authenticated"
on public.party_bank_info
for all
to authenticated
using (true)
with check (true);

-- PARTY_CONTACT
drop policy if exists "party_contact all for authenticated" on public.party_contact;
create policy "party_contact all for authenticated"
on public.party_contact
for all
to authenticated
using (true)
with check (true);

-- PARTY_TAX_INFO
drop policy if exists "party_tax all for authenticated" on public.party_tax_info;
create policy "party_tax all for authenticated"
on public.party_tax_info
for all
to authenticated
using (true)
with check (true);
