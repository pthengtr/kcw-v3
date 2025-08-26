"use client";
import { Button } from "@/components/ui/button";
import type { SkuRow } from "@/components/product/forms/sku/api";
import { Pencil, Trash2 } from "lucide-react";

export function SkuList({
  skus,
  onEdit,
  onDelete,
}: {
  skus: SkuRow[];
  onEdit: (s: SkuRow) => void;
  onDelete: (s: SkuRow) => void;
}) {
  if (skus.length === 0)
    return (
      <div className="p-3 text-sm text-muted-foreground">
        ยังไม่มีรหัสสินค้า.
      </div>
    );

  return (
    <div className="divide-y">
      {skus.map((s) => (
        <div key={s.sku_uuid} className="p-3 flex flex-wrap items-center gap-3">
          <div className="w-32">{s.sku_code ?? "—"}</div>
          <div className="w-24 text-muted-foreground">
            {s.sku_short_code ?? ""}
          </div>
          <div className="w-24">{s.uom_code}</div>
          <div className="w-24">{s.default_tax_code ?? ""}</div>
          <div className="w-24">{s.is_active ? "ใช้งาน" : "ไม่ใช้งาน"}</div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(s)}>
              <Pencil />
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(s)}>
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
