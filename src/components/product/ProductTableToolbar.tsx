// components/product/ProductTableToolbar.tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

type Props = {
  query: ProductQuery;
  loading: boolean;
  total: number;
  onQueryChange: (next: Partial<ProductQuery>) => void;

  /** Single selected row (or null) */
  selected?: ProductSkuRow | null;
  /** Optional: force a table refresh after actions */
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

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-muted/40">
      {/* Search & Filters (left) */}
      <Input
        placeholder="Search product or SKU…"
        className="w-60"
        value={query.filters.search ?? ""}
        onChange={(e) =>
          onQueryChange({
            pageIndex: 0,
            filters: { ...query.filters, search: e.target.value },
          })
        }
      />

      <Input
        placeholder="Category code…"
        className="w-40"
        value={query.filters.category ?? ""}
        onChange={(e) =>
          onQueryChange({
            pageIndex: 0,
            filters: { ...query.filters, category: e.target.value },
          })
        }
      />

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
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Active" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="true">Active</SelectItem>
          <SelectItem value="false">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {/* Right-side: counters, page size, actions */}
      <div className="ml-auto flex items-center gap-2">
        <span className={cn("text-xs", { "opacity-60": loading })}>
          {loading ? "Loading…" : `${total.toLocaleString()} items`}
        </span>

        <select
          className="h-8 rounded border px-2 text-sm"
          value={query.pageSize}
          onChange={(e) =>
            onQueryChange({ pageIndex: 0, pageSize: Number(e.target.value) })
          }
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>

        <Separator orientation="vertical" className="mx-2 h-6" />

        {/* Create */}
        <ProductSkuDialog
          mode="create"
          trigger={
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New
            </Button>
          }
          onSaved={async () => {
            if (refresh) await Promise.resolve(refresh());
            else onQueryChange({});
          }}
        />

        {/* Update: show when one is selected */}
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
                "", // not in row payload; loaded via RPC if needed
              category_code: selected.product_item?.category_code ?? "",
              is_active: selected.is_active,
              sku_code: selected.sku_code ?? undefined,
              uom_code: selected.uom_code,
              sku_short_code: selected.sku_short_code ?? undefined,
              default_tax_code: selected.default_tax_code ?? "",
            }}
            trigger={
              <Button size="sm" variant="secondary" className="gap-2">
                <Edit className="h-4 w-4" /> Update
              </Button>
            }
            onSaved={async () => {
              if (refresh) await Promise.resolve(refresh());
              else onQueryChange({});
            }}
          />
        )}

        {/* Delete: single item */}
        {hasSelection && (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="gap-2">
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
