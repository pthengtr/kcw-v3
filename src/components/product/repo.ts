import { createClient } from "@/lib/supabase/client";
import type {
  ProductItem,
  ProductSku,
  ProductBarcode,
  ProductUom,
  ProductTaxCategory,
  NewProductItemInput,
  UpdateProductItemInput,
  NewSkuInput,
  UpdateSkuInput,
  NewBarcodeInput,
  UUID,
} from "./types";

// Create client locally to avoid cross-imports; still uses your env.
const supabase = createClient();

function err(msg: string): never {
  throw new Error(msg);
}

// ------- Product Items -------
export async function listProductItems(): Promise<ProductItem[]> {
  const { data, error } = await supabase
    .from("product_item")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) err(error.message);

  return data as ProductItem[];
}

export async function createProductItem(
  input: NewProductItemInput
): Promise<ProductItem> {
  const { data, error } = await supabase
    .from("product_item")
    .insert({
      product_name: input.product_name,
      product_description: input.product_description ?? null,
      is_active: input.is_active ?? true,
    })
    .select("*")
    .single();
  if (error) err(error.message);
  return data as ProductItem;
}

export async function updateProductItem(
  input: UpdateProductItemInput
): Promise<ProductItem> {
  const { data, error } = await supabase
    .from("product_item")
    .update({
      product_name: input.product_name,
      product_description: input.product_description ?? null,
      is_active: input.is_active ?? true,
    })
    .eq("product_uuid", input.product_uuid)
    .select("*")
    .single();
  if (error) err(error.message);
  return data as ProductItem;
}

export async function deleteProductItem(id: UUID): Promise<void> {
  const { error } = await supabase
    .from("product_item")
    .delete()
    .eq("product_uuid", id);
  if (error) err(error.message);
}

// ------- SKUs -------
export async function listSkusByProduct(
  productUuid: UUID
): Promise<ProductSku[]> {
  const { data, error } = await supabase
    .from("product_sku")
    .select("*")
    .eq("product_uuid", productUuid)
    .order("updated_at", { ascending: false });
  if (error) err(error.message);
  return data as ProductSku[];
}

export async function createSku(input: NewSkuInput): Promise<ProductSku> {
  const { data, error } = await supabase
    .from("product_sku")
    .insert({
      product_uuid: input.product_uuid,
      sku_code: input.sku_code ?? null,
      uom_code: input.uom_code,
      default_tax_code: input.default_tax_code ?? null,
      is_active: input.is_active ?? true,
      sku_short_code: input.sku_short_code ?? null,
    })
    .select("*")
    .single();
  if (error) err(error.message);
  return data as ProductSku;
}

export async function updateSku(input: UpdateSkuInput): Promise<ProductSku> {
  const { data, error } = await supabase
    .from("product_sku")
    .update({
      sku_code: input.sku_code ?? null,
      uom_code: input.uom_code,
      default_tax_code: input.default_tax_code ?? null,
      is_active: input.is_active ?? true,
      sku_short_code: input.sku_short_code ?? null,
    })
    .eq("sku_uuid", input.sku_uuid)
    .select("*")
    .single();
  if (error) err(error.message);
  return data as ProductSku;
}

export async function deleteSku(id: UUID): Promise<void> {
  const { error } = await supabase
    .from("product_sku")
    .delete()
    .eq("sku_uuid", id);
  if (error) err(error.message);
}

// ------- Barcodes -------
export async function listBarcodesBySku(
  skuUuid: UUID
): Promise<ProductBarcode[]> {
  const { data, error } = await supabase
    .from("product_barcode")
    .select("*")
    .eq("sku_uuid", skuUuid)
    .order("is_primary", { ascending: false });
  if (error) err(error.message);
  return data as ProductBarcode[];
}

export async function addBarcode(
  input: NewBarcodeInput
): Promise<ProductBarcode> {
  const { data, error } = await supabase
    .from("product_barcode")
    .insert({
      barcode: input.barcode,
      sku_uuid: input.sku_uuid,
      is_primary: input.is_primary ?? false,
    })
    .select("*")
    .single();
  if (error) err(error.message);
  return data as ProductBarcode;
}

export async function deleteBarcode(barcode: string): Promise<void> {
  const { error } = await supabase
    .from("product_barcode")
    .delete()
    .eq("barcode", barcode);
  if (error) err(error.message);
}

// ------- Lookup (UOM / Tax) -------
export async function listUoms(): Promise<ProductUom[]> {
  const { data, error } = await supabase
    .from("product_uom")
    .select("*")
    .order("uom_code");
  if (error) err(error.message);
  return data as ProductUom[];
}

export async function listTaxCategories(): Promise<ProductTaxCategory[]> {
  const { data, error } = await supabase
    .from("product_tax_category")
    .select("*")
    .order("tax_code");
  if (error) err(error.message);

  console.log("tex info", data);
  return data as ProductTaxCategory[];
}
