-- 000_barcode_helpers.sql
begin;

-- Helpers (idempotent)
create or replace function public.normalize_digits(s text)
returns text language sql immutable as $$
  select nullif(regexp_replace(coalesce(s, ''), '\D', '', 'g'), '')
$$;

create or replace function public.is_valid_gtin(code text)
returns boolean language plpgsql immutable as $$
declare
  s text; len int; sum int := 0; i int; digit int; check_digit int; expected int; pos_from_right int;
begin
  s := public.normalize_digits(code);
  if s is null then return false; end if;
  len := length(s);
  if len not in (8,12,13,14) then return false; end if;

  check_digit := (substr(s, len, 1))::int;
  for i in reverse len-1..1 loop
    digit := (substr(s, i, 1))::int;
    pos_from_right := len - i;
    if (pos_from_right % 2) = 1 then sum := sum + digit * 3; else sum := sum + digit; end if;
  end loop;

  expected := (10 - (sum % 10)) % 10;
  return expected = check_digit;
end$$;

-- Looks like a GTIN in raw form (no letters; allow spaces, hyphens, optional GS1 AIs like (01))
create or replace function public.is_probable_gtin_raw(raw text)
returns boolean language sql immutable as $$
  select raw is not null
     and raw !~ '[A-Za-z]'
     and raw ~ '^\s*(\(\d{2,}\)\s*)*[\d][\d\s-]*\s*$'
$$;

-- Raw looks like GTIN AND digits pass check-digit
create or replace function public.is_confident_gtin(raw text)
returns boolean language sql immutable as $$
  select public.is_probable_gtin_raw(raw)
     and public.is_valid_gtin(public.normalize_digits(raw));
$$;

-- Helpful expression index for “digits-equality” lookups/dedupes
create index if not exists idx_product_barcode_digits
  on public.product_barcode (public.normalize_digits(barcode));

-- Case-insensitive dedupe aid for short codes (tags)
create index if not exists idx_pssc_sku_lower_short_code
  on public.product_sku_short_code (sku_uuid, lower(btrim(short_code)));

commit;
