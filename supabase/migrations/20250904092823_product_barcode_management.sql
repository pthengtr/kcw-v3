-- 0) Safety: drop old triggers if present (to recreate them)
drop trigger if exists product_barcode_guard_primary on public.product_barcode;
drop trigger if exists product_barcode_prevent_primary_delete on public.product_barcode;

-- 1) Allow duplicate barcodes across SKUs by changing the PK
alter table public.product_barcode
  drop constraint if exists product_barcode_pkey;

-- Use a composite primary key so each (barcode, sku_uuid) row is unique,
-- while the same barcode can exist on multiple SKUs.
alter table public.product_barcode
  add primary key (barcode, sku_uuid);

-- (Optional but handy for auditing)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='product_barcode' and column_name='created_at'
  ) then
    alter table public.product_barcode
      add column created_at timestamptz not null default now(),
      add column updated_at timestamptz not null default now();
  end if;
end$$;

-- 2) Indexes & constraints that encode the business rules

-- One primary per SKU
create unique index if not exists product_barcode_one_primary_per_sku_ux
  on public.product_barcode (sku_uuid)
  where (is_primary = true);

-- Primary barcode value must be globally unique among primaries
create unique index if not exists product_barcode_primary_value_ux
  on public.product_barcode (barcode)
  where (is_primary = true);

-- Never duplicate the exact same (sku_uuid, barcode) row
create unique index if not exists product_barcode_per_sku_value_ux
  on public.product_barcode (sku_uuid, barcode);

-- Keep your existing "group2" prefix index (still useful for lookups)
-- (already in your script)
-- create index if not exists idx_product_barcode_group2 ... substring(barcode from 1 for 2)

-- 3) Triggers to keep things tidy

-- (a) Auto-demote any old primary when a new primary is inserted/updated,
--     and give friendlier errors if a primary clashes.
create or replace function public.trg_product_barcode_guard_primary()
returns trigger
language plpgsql
as $$
begin
  -- normalize minor whitespace (optional)
  new.barcode := btrim(new.barcode);

  if new.is_primary then
    -- Demote existing primary for this SKU (if any)
    update public.product_barcode
       set is_primary = false,
           updated_at = now()
     where sku_uuid = new.sku_uuid
       and is_primary = true
       and (barcode, sku_uuid) is distinct from (new.barcode, new.sku_uuid);

    -- Friendly check: primary value cannot be used by another primary
    if exists (
      select 1
        from public.product_barcode b
       where b.barcode = new.barcode
         and b.is_primary = true
         and b.sku_uuid <> new.sku_uuid
    ) then
      -- The unique index will also catch this, but this message is clearer.
      raise exception 'Primary barcode "%" already used by another SKU', new.barcode
        using errcode = '23505';
    end if;
  end if;

  -- update timestamp if column exists
  begin
    new.updated_at := now();
  exception when undefined_column then
    -- ignore if updated_at not present
  end;

  return new;
end
$$;

create trigger product_barcode_guard_primary
before insert or update of barcode, is_primary
on public.product_barcode
for each row
execute function public.trg_product_barcode_guard_primary();

-- (b) Keep your "no manual delete of primary" policy
create or replace function public.chk_primary_barcode_manual_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_primary then
    raise exception 'Cannot delete a primary barcode directly. Demote it or replace it first.'
      using errcode = '23514';
  end if;
  return null;
end
$$;

create constraint trigger product_barcode_prevent_primary_delete
after delete on public.product_barcode
deferrable initially immediate
for each row
execute function public.chk_primary_barcode_manual_delete();

-- 4) (Already in your domain) keep the SKU -> primary barcode in sync
--     When sku_code changes, ensure there is a primary barcode row with that value.
create or replace function public.trg_product_sku_sync_primary_barcode()
returns trigger
language plpgsql
as $$
begin
  if new.sku_code is null or btrim(new.sku_code) = '' then
    return new; -- nothing to sync
  end if;

  -- Upsert the (sku_uuid, barcode) pair as primary; the other trigger will demote old primary.
  insert into public.product_barcode (barcode, sku_uuid, is_primary)
  values (btrim(new.sku_code), new.sku_uuid, true)
  on conflict (sku_uuid, barcode) do update
        set is_primary = excluded.is_primary,
            updated_at = now();

  return new;
end
$$;

-- (Re)create the SKU trigger using your existing name
drop trigger if exists product_sku_sync_primary_barcode on public.product_sku;
create trigger product_sku_sync_primary_barcode
after insert or update of sku_code
on public.product_sku
for each row
execute function public.trg_product_sku_sync_primary_barcode();

-- 5) (Keep your updated_at trigger on product_barcode if you want)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='product_barcode' and column_name='updated_at'
  ) then
    drop trigger if exists product_barcode_set_updated_at on public.product_barcode;
    create trigger product_barcode_set_updated_at
    before update on public.product_barcode
    for each row
    execute function public.set_updated_at();
  end if;
end$$;
