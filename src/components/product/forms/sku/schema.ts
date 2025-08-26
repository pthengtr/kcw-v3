import { z } from "zod";
import { validateSkuCodeFormat } from "@/components/product/utils";

export const makeSkuSchema = (categoryCode: string) =>
  z
    .object({
      sku_uuid: z.string().uuid().optional(),
      product_uuid: z.string().uuid({ message: "Missing product ID" }),
      sku_code: z
        .string()
        .trim()
        .optional()
        .transform((v) => v ?? "")
        .refine(
          (val) => val === "" || validateSkuCodeFormat(val, categoryCode),
          { message: `SKU must match ${categoryCode}<6 digits>.` }
        ),
      uom_code: z.string().min(1, "UOM is required"),
      default_tax_code: z.string().min(1, "Tax is required"),
      is_active: z.boolean().default(true),
      sku_short_code: z
        .string()
        .max(20)
        .or(z.literal(""))
        .optional()
        .transform((v) => v ?? ""),
    })
    .superRefine((vals, ctx) => {
      if (vals.sku_short_code && /[^A-Za-z0-9_-]/.test(vals.sku_short_code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sku_short_code"],
          message: "Short code must be alphanumeric, dash or underscore",
        });
      }
    });

export type SkuSchema = ReturnType<typeof makeSkuSchema>;
export type SkuFormInput = z.input<SkuSchema>;
export type SkuFormOutput = z.output<SkuSchema>;
