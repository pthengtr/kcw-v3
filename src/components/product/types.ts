// src/components/product/types.ts
export type SortKey =
  | "sku_code"
  | "default_tax_code"
  | "sku_updated_at"
  | "product_name"
  | "category_code"
  | "product_description"
  | "primary_barcode"; // (optional sort for barcode column)

export type ProductSkuSizeItem = {
  pos: number;
  label: string; // e.g., 'ใน', 'นอก', 'หนา'
  value: string; // e.g., '10mm'
};

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

  // --- NEW from rpc_product_skus (Option B) ---
  size_kind_code?: string | null; // e.g. 'I', 'C', ...
  size_kind_label?: string | null; // e.g. 'ลูกปืน' (Thai description)
  size_tags?: string[] | null; // ["ใน: 10mm","นอก: 20mm","หนา: 5mm"]
  sizes?: ProductSkuSizeItem[]; // detailed objects if you need them
};

export type RpcProductSkusArgs = {
  _search?: string | null;
  _category?: string | null;
  _active?: boolean | null;
  _page_index?: number;
  _page_size?: number;
  _sort_id?: string;
  _sort_desc?: boolean;
  _size_kind_codes?: string[] | null; // <-- new explicit filter
};

// 1) Types
// filters additions
export type ActiveFilter = "all" | "active" | "inactive";
export type SizeSlotPos = 1 | 2 | 3;
export type SizeSlotKey = "1" | "2" | "3";
export type SizeSlots = Partial<Record<SizeSlotKey, string>>;

export type SizeAttr = { attr_pos: 1 | 2 | 3; label_th: string };
export type ProductQuery = {
  pageIndex: number;
  pageSize: number;
  sortBy: { id: string; desc: boolean } | null;
  filters: {
    search: string;
    category: string | null;
    active: ActiveFilter;
    sizeKind: string | null; // single select for this UX
    sizeSlots: SizeSlots; // slot-specific inputs
  };
};
