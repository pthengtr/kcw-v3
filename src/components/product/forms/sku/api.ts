"use client";
import { createClient } from "@/lib/supabase/client";

export type SkuInput = {
  product_uuid: string;
  sku_code: string;
  uom_code: string;
  default_tax_code: string;
  is_active: boolean;
  sku_short_code: string | null;
};

export type SkuRow = { sku_uuid: string } & SkuInput;

const sb = createClient();

export async function listSkus(product_uuid: string) {
  const { data, error } = await sb
    .from("product_sku")
    .select("*")
    .eq("product_uuid", product_uuid)
    .order("sku_code", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SkuRow[];
}

export async function createSku(input: SkuInput) {
  const { error } = await sb.from("product_sku").insert(input);
  if (error) throw error;
}

export async function updateSku(sku_uuid: string, patch: Partial<SkuInput>) {
  const { error } = await sb
    .from("product_sku")
    .update(patch)
    .eq("sku_uuid", sku_uuid);
  if (error) throw error;
}

export async function deleteSku(sku_uuid: string) {
  const { error } = await sb
    .from("product_sku")
    .delete()
    .eq("sku_uuid", sku_uuid);
  if (error) throw error;
}
