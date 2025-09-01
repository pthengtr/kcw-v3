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
    delete from public.product_item where product_uuid = _product_uuid; -- cascades to SKU + barcode
    if not found then
      raise exception 'product not found: %', _product_uuid using errcode = 'P0001';
    end if;
  exception
    when foreign_key_violation then
      raise exception 'Cannot delete: product is referenced by other records' using errcode = 'P0001';
  end;
end$$;

grant execute on function public.fn_product_delete_one(uuid) to authenticated;


