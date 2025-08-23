export type UUID = string;

export type ProductItem = {
  product_uuid: UUID;
  product_name: string;
  product_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductUom = {
  uom_code: string;
  description: string | null;
};

export type ProductTaxCategory = {
  tax_code: string;
  rate: number; // numeric(5,2)
  tax_type: "VAT" | "ZERO" | "EXEMPT" | "NONVAT";
  is_vat: boolean;
  description: string | null;
};

export type ProductSku = {
  sku_uuid: UUID;
  product_uuid: UUID;
  sku_code: string | null;
  uom_code: string;
  default_tax_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sku_short_code: string | null;
};

export type ProductBarcode = {
  barcode: string;
  sku_uuid: UUID;
  is_primary: boolean;
};

// -------- UI-layer shapes --------
export type NewProductItemInput = {
  product_name: string;
  product_description?: string | null;
  is_active?: boolean;
};

export type UpdateProductItemInput = NewProductItemInput & {
  product_uuid: UUID;
};

export type NewSkuInput = {
  product_uuid: UUID;
  sku_code?: string | null;
  uom_code: string;
  default_tax_code?: string | null;
  is_active?: boolean;
  sku_short_code?: string | null;
};

export type UpdateSkuInput = NewSkuInput & {
  sku_uuid: UUID;
};

export type NewBarcodeInput = {
  barcode: string;
  sku_uuid: UUID;
  is_primary?: boolean;
};
