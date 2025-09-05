-- 1) Table for many short codes (tags) per SKU
create table if not exists public.product_sku_short_code (
  short_code_uuid uuid not null default gen_random_uuid(),
  sku_uuid uuid not null,
  short_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_sku_short_code_pkey primary key (short_code_uuid),
  constraint product_sku_short_code_sku_fk
    foreign key (sku_uuid) references public.product_sku (sku_uuid) on delete cascade,
  constraint product_sku_short_code_not_blank
    check (btrim(short_code) <> '')
) TABLESPACE pg_default;

-- Per-SKU uniqueness (case/space-insensitive) e.g. 'AB', ' ab ' => same
create unique index if not exists product_sku_short_code_per_sku_ci_ux
  on public.product_sku_short_code (sku_uuid, lower(btrim(short_code)));

-- Search helpers
create index if not exists idx_product_sku_short_code_text_trgm
  on public.product_sku_short_code using gin (short_code gin_trgm_ops);
create index if not exists idx_product_sku_short_code_updated_at
  on public.product_sku_short_code using btree (updated_at);

-- Keep updated_at fresh (assumes public.set_updated_at() exists)
create trigger product_sku_short_code_set_updated_at
before update on public.product_sku_short_code
for each row execute function public.set_updated_at();

-- Optional: normalize input (trim only; keep original casing for display)
create or replace function public.trg_product_sku_short_code_normalize()
returns trigger language plpgsql as $$
begin
  new.short_code := btrim(new.short_code);
  return new;
end$$;

drop trigger if exists product_sku_short_code_normalize on public.product_sku_short_code;
create trigger product_sku_short_code_normalize
before insert or update of short_code on public.product_sku_short_code
for each row execute function public.trg_product_sku_short_code_normalize();

-- ===== product_sku_short_code: RLS for authenticated =====
alter table public.product_sku_short_code enable row level security;
-- (Optional) enforce even for table owner:
-- alter table public.product_sku_short_code force row level security;

-- Lock down generic PUBLIC and open to authenticated
revoke all on table public.product_sku_short_code from public;
grant select, insert, update, delete on table public.product_sku_short_code to authenticated;

-- Read
create policy "sku_short_code select (authenticated)"
  on public.product_sku_short_code
  for select
  to authenticated
  using (true);

-- Insert
create policy "sku_short_code insert (authenticated)"
  on public.product_sku_short_code
  for insert
  to authenticated
  with check (true);

-- Update
create policy "sku_short_code update (authenticated)"
  on public.product_sku_short_code
  for update
  to authenticated
  using (true)
  with check (true);

-- Delete
create policy "sku_short_code delete (authenticated)"
  on public.product_sku_short_code
  for delete
  to authenticated
  using (true);

-- (Usually already set, but just in case)
grant usage on schema public to authenticated;

begin;

-- Drop the old per-column index (if you created it earlier)
drop index if exists idx_product_sku_short_code_ci;

-- Remove the legacy column from product_sku
alter table public.product_sku
  drop column if exists sku_short_code;

commit;
