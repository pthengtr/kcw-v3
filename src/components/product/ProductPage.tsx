// components/product/ProductPage.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  ProductItemRow,
  ProductListItem,
  ProductSearchRow,
} from "@/components/product/types";
import { DataTable } from "@/components/product/table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type ColumnDef } from "@tanstack/react-table";
import { ProductDrawer } from "@/components/product/drawers/ProductDrawer";

export default function ProductPage() {
  const sb = useMemo(() => createClient(), []);
  const [query, setQuery] = useState<string>("");
  const [rows, setRows] = useState<ProductListItem[]>([]);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const [editing, setEditing] = useState<ProductItemRow | null>(null);

  const search = useCallback(async () => {
    const { data, error } = await sb.rpc("search_products", {
      q: query,
      limit_count: 100,
      offset_count: 0,
    });
    if (error) throw error;

    const shaped: ProductListItem[] = (data as ProductSearchRow[]).map((r) => ({
      product_uuid: r.product_uuid,
      product_name: r.product_name,
      product_description: r.product_description,
      category_code: r.category_code,
      is_active: r.is_active,
      sku_codes: r.sku_codes ?? [],
      sku_short_codes: r.sku_short_codes ?? [],
    }));
    setRows(shaped);
  }, [sb, query]);
  useEffect(() => {
    void search();
  }, [search]);

  const columns = useMemo<ColumnDef<ProductListItem>[]>(
    () => [
      {
        accessorKey: "product_name",
        header: "Name",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.product_name}</div>
        ),
      },
      {
        accessorKey: "category_code",
        header: "Category",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.category_code}</Badge>
        ),
      },
      {
        accessorKey: "product_description",
        header: "Description",
        cell: ({ row }) => (
          <div className="text-muted-foreground line-clamp-2">
            {row.original.product_description ?? "—"}
          </div>
        ),
      },
      {
        id: "skus",
        header: "SKUs",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.sku_codes.map((c) => (
              <Badge key={c} variant="outline">
                {c}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                // fetch full row for edit
                const { data } = await sb
                  .from("product_item")
                  .select("*")
                  .eq("product_uuid", row.original.product_uuid)
                  .single();
                setEditing(data as ProductItemRow);
                setOpenDrawer(true);
              }}
            >
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [sb]
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search: SKU code, short code, name, description"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-lg"
        />
        <Button
          onClick={() => {
            setEditing(null);
            setOpenDrawer(true);
          }}
        >
          New Product
        </Button>
      </div>
      <Separator />
      <DataTable<ProductListItem> columns={columns} data={rows} />

      <ProductDrawer
        open={openDrawer}
        onOpenChange={setOpenDrawer}
        initial={editing}
        onSaved={() => void search()}
      />
    </div>
  );
}
