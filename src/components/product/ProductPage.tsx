"use client";

import * as React from "react";

import ProductTable from "@/components/product/ProductTable";
import { createClient } from "@/lib/supabase/client";
import { ProductQuery, ProductSkuRow } from "./types";

export default function ProductPage() {
  const supabase = createClient();

  const [rows, setRows] = React.useState<ProductSkuRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const [query, setQuery] = React.useState<ProductQuery>({
    pageIndex: 0,
    pageSize: 20,
    sortBy: { id: "sku_updated_at", desc: true },
    filters: { search: "", category: "", active: "all" },
  });

  // inside your ProductPage component
  const fetchPage = React.useCallback(async () => {
    setLoading(true);
    const { pageIndex, pageSize, sortBy, filters } = query;

    const { data, error } = await supabase.rpc("rpc_product_skus", {
      _page_index: pageIndex,
      _page_size: pageSize,
      _sort_id: sortBy?.id ?? "sku_updated_at",
      _sort_desc: sortBy?.desc ?? true,
      _search: filters.search || null,
      _category: filters.category?.trim() || null,
      _active: filters.active === "all" ? null : !!filters.active,
    });

    if (error) {
      console.error(error);
      setRows([]);
      setTotal(0);
    } else {
      setRows(data ?? []);
      setTotal(data && data.length ? Number(data[0].total_count) : 0);
    }
    setLoading(false);
  }, [query, supabase]);

  // Debounce when typing text filters
  const debRef = React.useRef<number | null>(null);
  const schedule = React.useCallback(
    (debounce: boolean) => {
      if (debRef.current) window.clearTimeout(debRef.current);
      if (debounce) {
        debRef.current = window.setTimeout(() => {
          debRef.current = null;
          void fetchPage();
        }, 250);
      } else {
        void fetchPage();
      }
    },
    [fetchPage]
  );

  React.useEffect(() => {
    const debounce = !!query.filters.search || !!query.filters.category;
    schedule(debounce);
  }, [query, schedule]);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Products & SKUs</h1>
      <ProductTable
        rows={rows}
        total={total}
        loading={loading}
        query={query}
        onQueryChange={(next) => setQuery((prev) => ({ ...prev, ...next }))}
      />
    </div>
  );
}
