create or replace function public.fn_first_number(_raw text)
returns numeric
language sql
immutable
as $$
/*
  - If no digits → NULL (avoids 22P02).
  - Converts Thai digits ๐-๙ to 0-9.
  - Treats comma as decimal separator.
  - Extracts first token like 12 or 12.34
*/
with norm as (
  select case
           when _raw is null then null
           else translate(replace(_raw, ',', '.'), '๐๑๒๓๔๕๖๗๘๙', '0123456789')
         end as s
),
m as (
  select regexp_match(s, '([0-9]+(?:\.[0-9]+)?)') as arr from norm
)
select case
         when arr is null then null
         else (arr)[1]::numeric
       end
from m;
$$;
