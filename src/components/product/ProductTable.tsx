"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ProductSkuRow } from "./types";
import type { ProductQuery, SortKey } from "./types";
import DataTableColumnHeader from "../common/DataTable/DataTableColumnHeader";

// client-only table to avoid dnd-kit hydration warnings
import dynamic from "next/dynamic";
const ClientOnlyTable = dynamic(
  () =>
    import("../common/DataTable/ServerDataTable").then(
      (m) => m.ServerDataTable<ProductSkuRow>
    ),
  { ssr: false }
);

import ProductTableToolbar from "./ProductTableToolbar";
import ProductTableFooter from "./ProductTableFooter";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

type Props = {
  rows: ProductSkuRow[];
  total: number;
  loading?: boolean;
  query: ProductQuery;
  onQueryChange: (next: Partial<ProductQuery>) => void;
};

export default function ProductTable({
  rows,
  total,
  loading = false,
  query,
  onQueryChange,
}: Props) {
  // --- NEW: selection state (by sku_uuid) ---
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const selected = React.useMemo(
    () => rows.filter((r) => selectedIds.has(r.sku_uuid)),
    [rows, selectedIds]
  );

  const toggleSelect = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // server-sort helpers
  const sortFor = React.useCallback(
    (id: SortKey): "asc" | "desc" | null => {
      const s = query.sortBy;
      if (!s || s.id !== id) return null;
      return s.desc ? "desc" : "asc";
    },
    [query.sortBy]
  );

  const toggleSort = React.useCallback(
    (id: SortKey) => {
      const s = query.sortBy;
      if (!s || s.id !== id) {
        onQueryChange({ pageIndex: 0, sortBy: { id, desc: false } });
      } else if (!s.desc) {
        onQueryChange({ pageIndex: 0, sortBy: { id, desc: true } });
      } else {
        onQueryChange({ pageIndex: 0, sortBy: null });
      }
    },
    [onQueryChange, query.sortBy]
  );

  const rowIsSelected = React.useCallback(
    (row: ProductSkuRow) => selectedIds.has(row.sku_uuid),
    [selectedIds]
  );

  const getRowClassName = React.useCallback(
    (row: ProductSkuRow) =>
      rowIsSelected(row) ? "bg-primary/5 ring-1 ring-primary/20" : "",
    [rowIsSelected]
  );

  // columns
  const columns = React.useMemo<ColumnDef<ProductSkuRow, unknown>[]>(
    () => [
      {
        id: "product_name",
        accessorFn: (row) => row.product_item?.product_name ?? "",
        header: () => (
          <DataTableColumnHeader
            title="Product"
            onClick={() => toggleSort("product_name")}
            sort={sortFor("product_name")}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.product_item?.product_name ?? ""}
          </span>
        ),
        meta: { minWidth: 220 },
      },
      {
        id: "category_code",
        accessorFn: (row) => row.product_item?.category_code ?? "",
        header: () => (
          <DataTableColumnHeader
            title="Category"
            onClick={() => toggleSort("category_code")}
            sort={sortFor("category_code")}
          />
        ),
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<string>()}</span>
        ),
        meta: { minWidth: 120 },
      },
      {
        id: "sku_code",
        accessorKey: "sku_code",
        header: () => (
          <DataTableColumnHeader
            title="SKU Code"
            onClick={() => toggleSort("sku_code")}
            sort={sortFor("sku_code")}
          />
        ),
        cell: ({ getValue }) => getValue<string>() ?? "",
        meta: { minWidth: 140 },
      },
      {
        id: "sku_short_code",
        accessorKey: "sku_short_code",
        header: () => (
          <DataTableColumnHeader
            title="SKU Short"
            onClick={() => toggleSort("sku_short_code")}
            sort={sortFor("sku_short_code")}
          />
        ),
        cell: ({ getValue }) => getValue<string>() ?? "",
        meta: { minWidth: 120 },
      },
      {
        id: "uom_code",
        accessorKey: "uom_code",
        header: () => (
          <DataTableColumnHeader
            title="UOM"
            onClick={() => toggleSort("uom_code")}
            sort={sortFor("uom_code")}
          />
        ),
        cell: ({ getValue }) => getValue<string>(),
        meta: { minWidth: 80 },
      },
      {
        id: "default_tax_code",
        accessorKey: "default_tax_code",
        header: () => (
          <DataTableColumnHeader
            title="Tax Code"
            onClick={() => toggleSort("default_tax_code")}
            sort={sortFor("default_tax_code")}
          />
        ),
        cell: ({ getValue }) => getValue<string>() ?? "",
        meta: { minWidth: 100 },
      },
      {
        id: "is_active",
        accessorKey: "is_active",
        header: () => (
          <DataTableColumnHeader
            title="Active"
            onClick={() => toggleSort("sku_code")} // or add a dedicated key if you want to sort by active
            sort={null}
          />
        ),
        cell: ({ getValue }) => (getValue<boolean>() ? "Yes" : "No"),
        meta: { minWidth: 80 },
      },
      {
        id: "sku_updated_at",
        accessorFn: (row) => row.updated_at,
        header: () => (
          <DataTableColumnHeader
            title="SKU Updated"
            onClick={() => toggleSort("sku_updated_at")}
            sort={sortFor("sku_updated_at")}
          />
        ),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {fmtDate(getValue<string>())}
          </span>
        ),
        meta: { minWidth: 160 },
      },
    ],
    [sortFor, toggleSort]
  );

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden">
      <ProductTableToolbar
        query={query}
        loading={loading}
        total={total}
        onQueryChange={onQueryChange}
        // NEW: pass selection + simple refresh
        selected={selected}
        refresh={() => onQueryChange({})}
      />

      <ClientOnlyTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.sku_uuid}
        // NEW: toggle selection on click (works without special table APIs)
        onRowClick={(r) => toggleSelect(r.sku_uuid)}
        getRowClassName={(row) => getRowClassName(row)}
        stickyFooter={
          <ProductTableFooter
            query={query}
            total={total}
            onQueryChange={onQueryChange}
          />
        }
      />
    </div>
  );
}
