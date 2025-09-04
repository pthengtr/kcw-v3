// src/lib/types/product.ts
export type ProductSkuRow = {
  sku_uuid: string;
  product_uuid: string;
  sku_code: string | null;
  sku_short_code: string | null;
  default_tax_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_description: string | null; // ← add this
  product_item?: {
    product_uuid: string;
    product_name: string;
    category_code: string;
    product_description?: string | null;
  };
  total_count: number; // from window function
};

// types.ts
export type SortKey =
  | "product_name"
  | "product_description" // ← add this
  | "category_code"
  | "sku_code"
  | "sku_short_code"
  | "default_tax_code"
  | "sku_updated_at";

export type ProductQuery = {
  pageIndex: number;
  pageSize: number;
  sortBy: { id: SortKey; desc: boolean } | null;
  filters: {
    search?: string;
    category?: string | null;
    active?: boolean | "all";
  };
};
