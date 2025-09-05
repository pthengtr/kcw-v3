// components/product/ProductTable.tsx
"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ProductSkuRow } from "./types";
import type { ProductQuery, SortKey } from "./types";
import DataTableColumnHeader from "../common/DataTable/DataTableColumnHeader";

import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

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
  // === Single selection (by sku_uuid) ===
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected = React.useMemo(
    () => rows.find((r) => r.sku_uuid === selectedId) ?? null,
    [rows, selectedId]
  );

  const toggleSelect = React.useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
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
    (row: ProductSkuRow) => selectedId === row.sku_uuid,
    [selectedId]
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
        id: "product_description",
        accessorKey: "product_description",
        header: () => (
          <DataTableColumnHeader
            title="Description"
            onClick={() => toggleSort("product_description")}
            sort={sortFor("product_description")}
          />
        ),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block max-w-[480px] truncate">
            {getValue<string>() ?? ""}
          </span>
        ),
        meta: { minWidth: 280 },
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
            onClick={() => toggleSort("sku_code")}
            sort={null}
          />
        ),
        cell: ({ getValue }) => (getValue<boolean>() ? "Yes" : "No"),
        meta: { minWidth: 80 },
      },
      {
        id: "barcodes",
        accessorKey: "barcodes",
        header: () => (
          <DataTableColumnHeader
            title="Barcodes"
            onClick={() => toggleSort("primary_barcode")} // optional: sorts by primary barcode
            sort={sortFor("primary_barcode")}
          />
        ),
        cell: ({ row }) => (
          <TagOverflowList
            values={row.original.barcodes}
            max={3}
            title="All barcodes"
          />
        ),
        meta: { minWidth: 240 },
      },
      {
        id: "sku_short_codes",
        accessorKey: "sku_short_codes",
        header: () => (
          <DataTableColumnHeader
            title="Short codes"
            onClick={() => toggleSort("primary_barcode")} // or remove sorting here
            sort={null}
          />
        ),
        cell: ({ row }) => (
          <TagOverflowList
            values={row.original.sku_short_codes}
            max={3}
            title="All short codes"
          />
        ),
        meta: { minWidth: 220 },
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
        // single-selected row (or null)
        selected={selected}
        refresh={() => onQueryChange({})}
      />

      <ClientOnlyTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.sku_uuid}
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

function TagOverflowList({
  values,
  max = 3,
  empty = "—",
  title,
}: {
  values: string[] | null | undefined;
  max?: number;
  empty?: string;
  title?: string;
}) {
  const all = Array.isArray(values) ? values.filter(Boolean) : [];
  if (all.length === 0)
    return <span className="text-muted-foreground">{empty}</span>;

  const shown = all.slice(0, max);
  const hidden = all.length - shown.length;
  const allStr = all.join(", ");

  const TagStrip = (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((v) => (
        <Badge key={v} variant="secondary" className="rounded-full px-2 py-0.5">
          {v}
        </Badge>
      ))}
      {hidden > 0 && (
        <Badge variant="outline" className="rounded-full px-2 py-0.5">
          +{hidden}
        </Badge>
      )}
    </div>
  );

  // nice hover; also add native title as fallback
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div title={allStr}>{TagStrip}</div>
      </HoverCardTrigger>
      <HoverCardContent className="max-w-sm">
        {title ? (
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {title}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {all.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="rounded-full px-2 py-0.5"
            >
              {v}
            </Badge>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
