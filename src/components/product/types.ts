// src/components/product/types.ts
export type SortKey =
  | "sku_code"
  | "default_tax_code"
  | "sku_updated_at"
  | "product_name"
  | "category_code"
  | "product_description"
  | "primary_barcode"; // (optional sort for barcode column)

export type ProductSkuRow = {
  sku_uuid: string;
  product_uuid: string;
  sku_code: string | null;
  default_tax_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_description: string | null;
  product_item: {
    product_uuid: string;
    product_name: string;
    category_code: string | null;
    product_description: string | null;
  } | null;

  // NEW:
  barcodes: string[]; // primary first (as returned by RPC)
  primary_barcode: string | null;
  barcode_count: number; // server-provided convenience
  sku_short_codes: string[]; // empty array if you don’t use this table

  // Existing total_count from RPC (read from the first row):
  total_count?: number;
};

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
