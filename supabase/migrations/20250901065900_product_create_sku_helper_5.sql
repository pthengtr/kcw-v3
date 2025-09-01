-- 1) Remove any old definitions to avoid inlining the wrong one
drop function if exists public.uuid_v5(uuid, text);

-- 2) Recreate as PL/pgSQL with safe search_path and explicit cast
create or replace function public.uuid_v5(ns uuid, name text)
returns uuid
language plpgsql
immutable
set search_path = public, extensions, pg_temp
as $$
declare
  nsb bytea;
  h   bytea;
  b   bytea;
begin
  -- namespace as raw bytes
  nsb := decode(replace(ns::text, '-', ''), 'hex')::bytea;

  -- SHA-1 over ns || name (pgcrypto's digest; schema resolved via search_path)
  h := digest(nsb || convert_to(name, 'UTF8'), 'sha1'::text);

  -- first 16 bytes
  b := substring(h from 1 for 16);

  -- RFC 4122 fields (version 5 + variant)
  b := set_byte(b, 6, (get_byte(b,6) & 15)  | 80);   -- version 5 (0x50)
  b := set_byte(b, 8, (get_byte(b,8) & 63) | 128);   -- variant 10xx

  return (
    encode(substring(b from 1  for 4),'hex') || '-' ||
    encode(substring(b from 5  for 2),'hex') || '-' ||
    encode(substring(b from 7  for 2),'hex') || '-' ||
    encode(substring(b from 9  for 2),'hex') || '-' ||
    encode(substring(b from 11 for 6),'hex')
  )::uuid;
end$$;
