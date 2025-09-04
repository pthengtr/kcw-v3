import { z } from "zod";

export type ProductSkuFormMode = "create" | "update";

export type ProductSkuInitial = {
  product_uuid?: string;
  sku_uuid?: string;
  product_name?: string;
  product_description?: string | undefined;
  category_code?: string; // 2 digits
  is_active?: boolean;
  sku_code?: string | undefined; // optional in create => autogen
  sku_short_code?: string | undefined;
  default_tax_code?: string | undefined;
};

export const FormSchema = z
  .object({
    product_name: z.string().trim().min(1, "Product name is required"),

    // required
    product_description: z.string().trim().min(1, "Description is required"),

    category_code: z
      .string()
      .trim()
      .regex(/^\d{2}$/, "Select a category (two digits)"),

    is_active: z.boolean().optional(), // optional in schema, default in defaultValues

    sku_code: z.string().optional(), // optional, blank => autogen

    sku_short_code: z.string().optional(),

    // required
    default_tax_code: z.string().trim().min(1, "Select a tax code"),
  })
  .superRefine((val, ctx) => {
    const cat = val.category_code?.trim(); // e.g. "12"
    const sku = (val.sku_code ?? "").trim(); // e.g. "12-ABC-001"
    const m = sku.match(/^(\d{2})/); // leading two digits, if any
    if (m && cat && m[1] !== cat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sku_code"],
        message: `SKU code must start with category ${cat}`,
      });
    }
  });

export type FormInput = z.input<typeof FormSchema>;

export type Option = { value: string; label: string };
export type RefsPayload = {
  categories: Option[];
  uoms: Option[];
  taxes: Option[];
};
