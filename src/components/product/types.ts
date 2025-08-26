// lib/types/product.ts
import { z } from "zod";

export const ProductSchema = z.object({
  product_uuid: z.uuid().optional(),
  product_name: z.string().min(1),
  product_description: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  category_code: z.string().regex(/^\d{2}$/),
});
export type ProductInput = z.infer<typeof ProductSchema>; // DB/output type
export type ProductForm = z.input<typeof ProductSchema>; // <-- FORM/INPUT type (use this in RHF)

export const SkuSchema = z.object({
  sku_uuid: z.string().uuid().optional(),
  product_uuid: z.string().uuid(),
  sku_code: z.string().min(1).nullable().optional(),
  uom_code: z.string().min(1),
  default_tax_code: z.string().min(1).default("VAT7"),
  is_active: z.boolean().default(true),
  sku_short_code: z.string().nullable().optional(),
});
export type SkuInput = z.infer<typeof SkuSchema>;

export const BarcodeSchema = z.object({
  barcode: z.string().min(1),
  sku_uuid: z.string().uuid(),
  is_primary: z.boolean().default(false),
});
export type BarcodeInput = z.infer<typeof BarcodeSchema>;

// lib/types/product.ts  (add a type that matches RPC output; reuse existing where possible)
export type ProductSearchRow = {
  product_uuid: string;
  product_name: string;
  product_description: string | null;
  category_code: string;
  is_active: boolean;
  sku_codes: string[];
  sku_short_codes: (string | null)[];
  score: string | number; // numeric from Postgres -> js string by default; you can Number() it if needed
};

export type ProductItemRow = {
  product_uuid: string;
  product_name: string;
  product_description: string | null;
  category_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductListItem = {
  product_uuid: string;
  product_name: string;
  product_description: string | null;
  category_code: string;
  is_active: boolean;
  sku_codes: string[];
  sku_short_codes: (string | null)[];
};

export type SkuRow = {
  sku_uuid: string;
  product_uuid: string;
  sku_code: string | null;
  uom_code: string;
  default_tax_code: string | null;
  is_active: boolean;
  sku_short_code: string | null;
};

export type BarcodeRow = {
  barcode: string;
  sku_uuid: string;
  is_primary: boolean;
};

export type Category = { category_code: string; category_name: string };
export type Uom = { uom_code: string; description: string | null };
export type Tax = { tax_code: string; description: string | null };
