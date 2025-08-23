import { z } from "zod";

export const newProductItemSchema = z.object({
  product_name: z.string().trim().min(1, "Name is required").max(200),
  product_description: z.string().trim().max(2000).nullish(),
  is_active: z.boolean().default(true),
});

export const updateProductItemSchema = newProductItemSchema.extend({
  product_uuid: z.string().uuid(),
});

export const newSkuSchema = z.object({
  product_uuid: z.string().uuid(),
  sku_code: z.string().trim().min(1).max(120).nullish(),
  uom_code: z.string().trim().min(1, "UOM is required"),
  default_tax_code: z.string().trim().min(1).nullish(),
  is_active: z.boolean().default(true),
  sku_short_code: z.string().trim().max(40).nullish(),
});

export const updateSkuSchema = newSkuSchema.extend({
  sku_uuid: z.string().uuid(),
});

export const newBarcodeSchema = z.object({
  barcode: z.string().trim().min(3, "Barcode is too short").max(64),
  sku_uuid: z.string().uuid(),
  is_primary: z.boolean().default(false),
});

// Inferred form types
export type NewProductItemForm = z.infer<typeof newProductItemSchema>;
export type UpdateProductItemForm = z.infer<typeof updateProductItemSchema>;
export type NewSkuForm = z.infer<typeof newSkuSchema>;
export type UpdateSkuForm = z.infer<typeof updateSkuSchema>;
export type NewBarcodeForm = z.infer<typeof newBarcodeSchema>;
