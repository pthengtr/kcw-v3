-- 1) Enable pgcrypto (needed for digest, gen_random_uuid, etc.)
create extension if not exists "pgcrypto";

create or replace function public.uuid_v5(ns uuid, name text)
returns uuid
language plpgsql
immutable
as $$
declare
  nsb bytea;
  h   bytea;
  b   bytea;
begin
  -- namespace as 16 raw bytes
  nsb := decode(replace(ns::text, '-', ''), 'hex')::bytea;

  -- SHA-1 over ns || name (schema-qualify digest to the Supabase extensions schema)
  h := extensions.digest(nsb || convert_to(name, 'UTF8'), 'sha1'::text);

  -- take first 16 bytes
  b := substring(h from 1 for 16);

  -- set RFC 4122 version/variant (v5)
  b := set_byte(b, 6, (get_byte(b,6) & 15)  | 80);   -- version 5 (0b0101 << 4 = 0x50 = 80)
  b := set_byte(b, 8, (get_byte(b,8) & 63) | 128);   -- variant 10xx

  return (
    encode(substring(b from 1  for 4),'hex') || '-' ||
    encode(substring(b from 5  for 2),'hex') || '-' ||
    encode(substring(b from 7  for 2),'hex') || '-' ||
    encode(substring(b from 9  for 2),'hex') || '-' ||
    encode(substring(b from 11 for 6),'hex')
  )::uuid;
end$$;

