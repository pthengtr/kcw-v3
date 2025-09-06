"use client";

import * as React from "react";
import ProductTable from "@/components/product/ProductTable";
import { createClient } from "@/lib/supabase/client";
import { ProductQuery, ProductSkuRow } from "./types";

/** Debounce a primitive value (like a string) */
function useDebouncedValue<T>(value: T, delay = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function ProductPage() {
  const supabase = createClient();

  const [rows, setRows] = React.useState<ProductSkuRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // parent state
  const [query, setQuery] = React.useState<ProductQuery>({
    pageIndex: 0,
    pageSize: 20,
    sortBy: { id: "sku_updated_at", desc: true },
    filters: {
      search: "",
      category: null,
      active: "all",
      sizeKind: null, // single kind for slot inputs
      sizeSlots: {}, // {'1'?:string,'2'?:string,'3'?:string}
    },
  });

  // nested merge helper
  const onQueryChange = React.useCallback((patch: Partial<ProductQuery>) => {
    setQuery((prev) => ({
      ...prev,
      ...patch,
      filters: { ...prev.filters, ...(patch.filters ?? {}) },
    }));
  }, []);

  // ---- Debounce only keystroke fields ----
  const debSearch = useDebouncedValue(query.filters.search ?? "", 250);
  const debPos1 = useDebouncedValue(query.filters.sizeSlots["1"] ?? "", 250);
  const debPos2 = useDebouncedValue(query.filters.sizeSlots["2"] ?? "", 250);
  const debPos3 = useDebouncedValue(query.filters.sizeSlots["3"] ?? "", 250);

  // ---- Fetcher that takes explicit params (no stale closure) ----
  type RpcFilters = {
    page_index: number;
    page_size: number;
    sort_id: string;
    sort_desc: boolean;
    search: string | null;
    category: string | null;
    active: "active" | "inactive" | null;
    size_kind_code: string | null;
    size_pos1: string | null;
    size_pos2: string | null;
    size_pos3: string | null;
  };

  const fetchPageNow = React.useCallback(
    async (_f: RpcFilters) => {
      setLoading(true);
      const { data, error } = await supabase.rpc("rpc_product_skus_v2", { _f });

      if (error) {
        console.error(error);
        setRows([]);
        setTotal(0);
      } else {
        setRows(data ?? []);
        setTotal(data && data.length ? Number(data[0].total_count) : 0);
      }
      setLoading(false);
    },
    [supabase]
  );

  // ---- Drive fetch from debounced text + immediate non-text deps ----
  React.useEffect(() => {
    const { pageIndex, pageSize, sortBy, filters } = query;

    const _f: RpcFilters = {
      page_index: pageIndex,
      page_size: pageSize,
      sort_id: sortBy?.id ?? "sku_updated_at",
      sort_desc: sortBy?.desc ?? true,

      // debounced free text
      search: debSearch.trim() ? debSearch.trim() : null,

      // immediate filters
      category: filters.category ?? null,
      active:
        filters.active === "all"
          ? null
          : (filters.active as "active" | "inactive"),
      size_kind_code: filters.sizeKind ?? null,

      // debounced slot text (only meaningful with a size kind; rpc ignores when kind is null)
      size_pos1: debPos1.trim() ? debPos1.trim() : null,
      size_pos2: debPos2.trim() ? debPos2.trim() : null,
      size_pos3: debPos3.trim() ? debPos3.trim() : null,
    };

    void fetchPageNow(_f);
  }, [
    debSearch,
    debPos1,
    debPos2,
    debPos3,
    query.pageIndex,
    query.pageSize,
    query.sortBy,
    query.filters.category,
    query.filters.active,
    query.filters.sizeKind,
    fetchPageNow,
    query,
  ]);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Products & SKUs</h1>
      <ProductTable
        rows={rows}
        total={total}
        loading={loading}
        query={query}
        onQueryChange={onQueryChange}
      />
    </div>
  );
}
