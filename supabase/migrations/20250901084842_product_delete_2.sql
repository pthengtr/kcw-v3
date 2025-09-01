create or replace function public.fn_product_delete_many(_product_uuids uuid[])
returns table(product_uuid uuid, ok boolean, error text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  id uuid;
begin
  if _product_uuids is null or array_length(_product_uuids,1) is null then
    return;
  end if;

  foreach id in array _product_uuids loop
    begin
      delete from public.product_item pi
      where pi.product_uuid = id;  -- ✅ qualified column

      if found then
        product_uuid := id; ok := true; error := null; return next;
      else
        product_uuid := id; ok := false; error := 'not found'; return next;
      end if;

    exception
      when foreign_key_violation then
        product_uuid := id; ok := false; error := 'referenced by other records'; return next;
      when others then
        product_uuid := id; ok := false; error := sqlerrm; return next;
    end;
  end loop;
end$$;

grant execute on function public.fn_product_delete_many(uuid[]) to authenticated;

create or replace function public.fn_product_delete_one(_product_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if _product_uuid is null then
    raise exception 'product_uuid is required' using errcode = 'P0001';
  end if;

  begin
    delete from public.product_item pi
    where pi.product_uuid = _product_uuid;  -- ✅ qualified

    if not found then
      raise exception 'product not found: %', _product_uuid using errcode = 'P0001';
    end if;
  exception
    when foreign_key_violation then
      raise exception 'Cannot delete: product is referenced by other records' using errcode = 'P0001';
  end;
end$$;

grant execute on function public.fn_product_delete_one(uuid) to authenticated;
