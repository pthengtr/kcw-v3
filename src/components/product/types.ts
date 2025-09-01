// src/lib/types/product.ts
export type ProductSkuRow = {
  sku_uuid: string;
  product_uuid: string;
  sku_code: string | null;
  sku_short_code: string | null;
  uom_code: string;
  default_tax_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_item: {
    product_uuid: string;
    product_name: string;
    category_code: string | null;
  } | null;
  total_count: number; // from window function
};

export type SortKey =
  | "sku_code"
  | "sku_short_code"
  | "uom_code"
  | "default_tax_code"
  | "sku_updated_at"
  | "product_name"
  | "category_code";

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
