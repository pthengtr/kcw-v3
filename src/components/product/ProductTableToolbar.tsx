// components/product/ProductTableToolbar.tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { ProductQuery, ProductSkuRow } from "./types";
import ProductSkuDialog from "./ProductSkuDialog";

// Reuse the shared category picker

import CategorySelect from "./CategorySelect";
import { useProductRefs } from "./productskuform/useProductRefs";

type Props = {
  query: ProductQuery;
  loading: boolean;
  total: number;
  onQueryChange: (next: Partial<ProductQuery>) => void;

  selected?: ProductSkuRow | null;
  refresh?: () => Promise<void> | void;
};

function ProductTableToolbarBase({
  query,
  loading,
  total,
  onQueryChange,
  selected = null,
  refresh,
}: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const hasSelection = !!selected;
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Load refs once for toolbar dropdowns
  const { opts } = useProductRefs(true);

  type DeleteResult = {
    product_uuid: string;
    ok: boolean;
    error: string | null;
  };

  async function handleDelete() {
    if (!selected) return;
    const ids = [selected.product_uuid];
    try {
      const { data, error } = await supabase.rpc("fn_product_delete_many", {
        _product_uuids: ids,
      });
      if (error) throw error;

      const rows: DeleteResult[] = (data ?? []) as DeleteResult[];
      const failures = rows.filter((r) => !r.ok);
      if (failures.length) {
        const message = failures
          .map((f) => `${f.product_uuid}: ${f.error ?? "unknown error"}`)
          .join("\n");
        alert(`Could not delete:\n${message}`);
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirmOpen(false);
      if (refresh) await Promise.resolve(refresh());
      else onQueryChange({});
    }
  }

  const categoryValue: string | "all" | undefined =
    query.filters.category && query.filters.category.trim() !== ""
      ? query.filters.category
      : "all";

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 border-b bg-muted/40">
      {/* Search */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="tb-search" className="text-xs">
          Search
        </Label>
        <Input
          id="tb-search"
          placeholder="Product/SKU…"
          className="w-60"
          value={query.filters.search ?? ""}
          onChange={(e) =>
            onQueryChange({
              pageIndex: 0,
              filters: { ...query.filters, search: e.target.value },
            })
          }
        />
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="tb-category" className="text-xs">
          Category
        </Label>
        {opts ? (
          <CategorySelect
            triggerId="tb-category"
            value={categoryValue}
            onChange={(v) => {
              const next = v === "all" ? undefined : v;
              onQueryChange({
                pageIndex: 0,
                filters: { ...query.filters, category: next },
              });
            }}
            options={opts.categories}
            includeAll
            placeholder="All categories"
            className="w-40"
          />
        ) : (
          <div className="h-9 w-40 rounded border px-2 text-sm grid place-items-center opacity-70">
            Loading…
          </div>
        )}
      </div>

      {/* Active */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="tb-active" className="text-xs">
          Active
        </Label>
        <Select
          value={String(query.filters.active ?? "all")}
          onValueChange={(v) => {
            const active: boolean | "all" = v === "all" ? "all" : v === "true";
            onQueryChange({
              pageIndex: 0,
              filters: { ...query.filters, active },
            });
          }}
        >
          <SelectTrigger id="tb-active" className="w-28">
            <SelectValue placeholder="Active" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Right-side controls */}
      <div className="ml-auto flex items-end gap-3">
        {/* Page size with label */}
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="tb-page-size" className="text-xs">
              Page size
            </Label>
            <select
              id="tb-page-size"
              className="h-9 rounded border px-2 text-sm"
              value={query.pageSize}
              onChange={(e) =>
                onQueryChange({
                  pageIndex: 0,
                  pageSize: Number(e.target.value),
                })
              }
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>

        <Separator orientation="vertical" className="mx-2 h-8" />

        <span className={cn("text-xs self-end", { "opacity-60": loading })}>
          {loading ? "Loading…" : `${total.toLocaleString()} items`}
        </span>

        {/* Create */}
        <ProductSkuDialog
          mode="create"
          trigger={
            <Button size="sm" className="gap-2 self-end">
              <Plus className="h-4 w-4" /> New
            </Button>
          }
          onSaved={async () => {
            if (refresh) await Promise.resolve(refresh());
            else onQueryChange({});
          }}
        />

        {/* Update */}
        {hasSelection && selected && (
          <ProductSkuDialog
            mode="update"
            initial={{
              product_uuid: selected.product_uuid,
              sku_uuid: selected.sku_uuid,
              product_name: selected.product_item?.product_name ?? "",
              product_description:
                selected.product_description ??
                selected.product_item?.product_description ??
                "",
              category_code: selected.product_item?.category_code ?? "",
              is_active: selected.is_active,
              sku_code: selected.sku_code ?? undefined,
              sku_short_code: selected.sku_short_code ?? undefined,
              default_tax_code: selected.default_tax_code ?? "",
            }}
            trigger={
              <Button size="sm" variant="secondary" className="gap-2 self-end">
                <Edit className="h-4 w-4" /> Update
              </Button>
            }
            onSaved={async () => {
              if (refresh) await Promise.resolve(refresh());
              else onQueryChange({});
            }}
          />
        )}

        {/* Delete */}
        {hasSelection && (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                className="gap-2 self-end"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete 1 item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the product, its SKU, and primary barcode. It may
                  fail if referenced by other records.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

const ProductTableToolbar = React.memo(ProductTableToolbarBase);
ProductTableToolbar.displayName = "ProductTableToolbar";
export default ProductTableToolbar;
