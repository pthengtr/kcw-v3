// lib/utils/sku.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateNextSkuCode(
  sb: SupabaseClient,
  category_code: string
): Promise<string> {
  const prefix = category_code;
  const { data, error } = await sb
    .from("product_sku")
    .select("sku_code")
    .ilike("sku_code", `${prefix}%`);

  if (error) throw error;

  const used = new Set<number>();
  for (const row of data ?? []) {
    const s = row.sku_code ?? "";
    const tail = s.slice(prefix.length);
    if (/^\d{6}$/.test(tail)) used.add(Number(tail));
  }
  let n = 0;
  while (used.has(n) && n < 1_000_000) n++;
  return `${prefix}${String(n).padStart(6, "0")}`;
}

export function validateSkuCodeFormat(
  code: string,
  category_code: string
): boolean {
  const re = new RegExp(`^${category_code}\\d{6}$`);
  return re.test(code);
}
