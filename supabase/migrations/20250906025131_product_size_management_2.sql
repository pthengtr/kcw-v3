-- MIGRATION: SKU size categories + per-SKU size values (template + free-form)
begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- 0) Prereqs / helpers
-- ──────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_trgm;

-- Ensure updated_at helper exists (no-op if you already have it)
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'set_updated_at' and pg_function_is_visible(oid)
  ) then
    execute $fn$
      create or replace function public.set_updated_at()
      returns trigger language plpgsql as $body$
      begin
        new.updated_at := now();
        return new;
      end
      $body$;
    $fn$;
  end if;
end$$;

-- Extract first number (e.g. '10mm' -> 10)
create or replace function public.fn_first_number(_raw text)
returns numeric
language sql
immutable
as $$
  select case
    when _raw is null then null
    else nullif(regexp_replace(_raw, '^.*?([0-9]+(\.[0-9]+)?).*$','\1'), '')::numeric
  end
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1) Lookups: size kinds and slot labels
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.product_size_kind (
  size_kind_code text primary key,   -- 'I','C','G',...
  description    text not null       -- Thai label shown in UI
);

create table if not exists public.product_size_kind_attr (
  size_kind_code text not null references public.product_size_kind(size_kind_code) on delete cascade,
  attr_pos       smallint not null check (attr_pos between 1 and 3),
  label_th       text not null,
  label_en       text null,
  constraint product_size_kind_attr_pkey primary key (size_kind_code, attr_pos)
);

-- Seed kinds (Thai)
insert into public.product_size_kind (size_kind_code, description) values
  ('I', 'ลูกปืน'),
  ('C', 'ซีล'),
  ('G', 'ยอยกากบาท'),
  ('D', 'บู๊ช'),
  ('K', 'จานคลัช'),
  ('P', 'กรองเครื่อง'),
  ('F', 'กรองอากาศ'),
  ('E', 'ลูกปืน เข็ม/กรงนก'),
  ('Q', 'ลูกหมาก'),
  ('L', 'สายอ่อน'),
  ('A', 'ถ่าน'),
  ('R', 'ลูกยาง')
on conflict (size_kind_code) do update set description = excluded.description;

-- Seed slot labels per kind (Thai)
insert into public.product_size_kind_attr (size_kind_code, attr_pos, label_th) values
  ('I',1,'ใน'),('I',2,'นอก'),('I',3,'หนา'),
  ('C',1,'ใน'),('C',2,'นอก'),('C',3,'หนา'),
  ('G',1,'ปลอก'),('G',2,'ยาว'),('G',3,'ล็อค'),
  ('D',1,'ใน'),('D',2,'นอก'),('D',3,'หนา'),
  ('K',1,'ยาว(นิ้ว)'),('K',2,'ฟัน'),('K',3,'ขนาดรู'),
  ('P',1,'ใน'),('P',2,'นอก'),('P',3,'สูง'),
  ('F',1,'ใน'),('F',2,'นอก'),('F',3,'หนา'),
  ('E',1,'ใน'),('E',2,'นอก'),('E',3,'หนา'),
  ('Q',1,'เตเปอร์'),('Q',2,'แกนโต'),
  ('L',1,'หัวสาย 1'),('L',2,'หัวสาย 2'),('L',3,'ยาว'),
  ('A',1,'หนา'),('A',2,'กว้าง'),('A',3,'ยาว'),
  ('R',1,'ใน'),('R',2,'นอก'),('R',3,'หนา')
on conflict (size_kind_code, attr_pos) do update set label_th = excluded.label_th;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2) Core table: product_sku_size (supports template mode OR free-form)
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.product_sku_size (
  sku_uuid        uuid not null references public.product_sku(sku_uuid) on delete cascade,

  -- Free-form mode:
  size_attr       text null,
  size_attr_norm  text generated always as (lower(btrim(size_attr))) stored,

  -- UI template mode:
  size_kind_code  text null,
  attr_pos        smallint null check (attr_pos between 1 and 3),

  -- Value:
  size_value      text not null,
  numeric_value   numeric generated always as (public.fn_first_number(size_value)) stored,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- If table existed earlier without these columns, add them
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='product_sku_size' and column_name='size_kind_code') then
    alter table public.product_sku_size add column size_kind_code text null;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='product_sku_size' and column_name='attr_pos') then
    alter table public.product_sku_size add column attr_pos smallint null check (attr_pos between 1 and 3);
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='product_sku_size' and column_name='size_attr_norm') then
    alter table public.product_sku_size add column size_attr_norm text generated always as (lower(btrim(size_attr))) stored;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='product_sku_size' and column_name='numeric_value') then
    alter table public.product_sku_size add column numeric_value numeric generated always as (public.fn_first_number(size_value)) stored;
  end if;
end$$;

-- Mode check: exactly one mode must be used
do $$
begin
  if not exists (select 1 from pg_constraint where conname='product_sku_size_mode_chk') then
    alter table public.product_sku_size
      add constraint product_sku_size_mode_chk check (
        (size_kind_code is not null and attr_pos is not null and size_attr is null)
        or
        (size_kind_code is null and attr_pos is null and size_attr is not null)
      );
  end if;
end$$;

-- Composite FK for template mode
do $$
begin
  if not exists (select 1 from pg_constraint where conname='product_sku_size_kind_pos_fkey') then
    alter table public.product_sku_size
      add constraint product_sku_size_kind_pos_fkey
      foreign key (size_kind_code, attr_pos)
      references public.product_size_kind_attr(size_kind_code, attr_pos)
      on delete restrict;
  end if;
end$$;

-- updated_at trigger
do $$
begin
  if not exists (select 1 from pg_trigger where tgname='product_sku_size_set_updated_at') then
    create trigger product_sku_size_set_updated_at
      before update on public.product_sku_size
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- Uniqueness:
--   free-form: one per (sku, attr)
create unique index if not exists product_sku_size_attr_ci_ux
  on public.product_sku_size (sku_uuid, size_attr_norm)
  where size_attr_norm is not null;

--   template: one per (sku, kind, slot)
create unique index if not exists product_sku_size_kind_slot_ux
  on public.product_sku_size (sku_uuid, size_kind_code, attr_pos)
  where size_kind_code is not null and attr_pos is not null;

-- Helpful indexes
create index if not exists idx_product_sku_size_numeric
  on public.product_sku_size (coalesce(size_attr_norm, ''), numeric_value);

create index if not exists idx_product_sku_size_kind
  on public.product_sku_size (size_kind_code, attr_pos);

create index if not exists idx_product_sku_size_value_trgm
  on public.product_sku_size using gin (size_value gin_trgm_ops);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3) Read helpers for UI
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_size_kinds()
returns table(size_kind_code text, label_th text, attr_count integer)
language sql
stable
as $$
  select k.size_kind_code,
         k.description as label_th,
         count(a.*)::int as attr_count
  from public.product_size_kind k
  left join public.product_size_kind_attr a
    on a.size_kind_code = k.size_kind_code
  group by k.size_kind_code, k.description
  order by k.size_kind_code;
$$;

create or replace function public.fn_size_template(_kind text)
returns table(attr_pos smallint, label_th text, label_en text)
language sql
stable
as $$
  select a.attr_pos, a.label_th, a.label_en
  from public.product_size_kind_attr a
  where a.size_kind_code = _kind
  order by a.attr_pos;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4) Write helpers for UI
-- ──────────────────────────────────────────────────────────────────────────────
-- Upsert a single slot (template mode)
create or replace function public.fn_sku_size_set_slot(
  _sku uuid, _kind text, _pos smallint, _value text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.product_sku_size (sku_uuid, size_kind_code, attr_pos, size_value)
  values (_sku, _kind, _pos, _value)
  on conflict (sku_uuid, size_kind_code, attr_pos)
  do update set size_value = excluded.size_value, updated_at = now();
$$;

-- Bulk upsert from JSON object like {"1":"10mm","2":"20mm"}
create or replace function public.fn_sku_size_set_slots(
  _sku uuid, _kind text, _slots jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  -- Upsert provided slots
  insert into public.product_sku_size (sku_uuid, size_kind_code, attr_pos, size_value)
  select _sku, _kind, (k)::smallint, _slots->>k
  from jsonb_object_keys(_slots) as t(k)
  on conflict (sku_uuid, size_kind_code, attr_pos)
  do update set size_value = excluded.size_value, updated_at = now();

  -- Optional: remove slots of this kind not present in payload
  delete from public.product_sku_size
  where sku_uuid = _sku and size_kind_code = _kind
    and attr_pos not in (select (k)::smallint from jsonb_object_keys(_slots) as t(k));
end;
$$;

-- (Optional) Free-form setter (kept for odd cases)
create or replace function public.fn_sku_size_set(
  _sku uuid, _attr text, _value text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.product_sku_size (sku_uuid, size_attr, size_value)
  values (_sku, _attr, _value)
  on conflict (sku_uuid, size_attr_norm)
  do update set size_attr = excluded.size_attr,
               size_value = excluded.size_value,
               updated_at = now();
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5) View with resolved labels
-- ──────────────────────────────────────────────────────────────────────────────
create or replace view public.v_sku_sizes as
select
  s.sku_uuid,
  -- Prefer template label, fall back to free-form name
  coalesce(a.label_th, s.size_attr) as label_th,
  a.label_en,
  s.size_value,
  s.numeric_value,
  s.size_kind_code,
  s.attr_pos
from public.product_sku_size s
left join public.product_size_kind_attr a
  on a.size_kind_code = s.size_kind_code
 and a.attr_pos = s.attr_pos;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6) (Optional) Grants for Supabase "authenticated" role
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  perform 1
  from pg_roles where rolname = 'authenticated';

  if found then
    grant select on public.product_size_kind to authenticated;
    grant select on public.product_size_kind_attr to authenticated;
    grant select on public.v_sku_sizes to authenticated;

    grant execute on function public.fn_size_kinds() to authenticated;
    grant execute on function public.fn_size_template(text) to authenticated;
    grant execute on function public.fn_sku_size_set_slot(uuid, text, smallint, text) to authenticated;
    grant execute on function public.fn_sku_size_set_slots(uuid, text, jsonb) to authenticated;
    grant execute on function public.fn_sku_size_set(uuid, text, text) to authenticated;
  end if;
end$$;

commit;
