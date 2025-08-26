"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { SkuForm } from "./SkuForm";
import { SkuList } from "./SkuList";
import { useSkus } from "./useSkus";
import { generateNextSkuCode } from "@/components/product/utils";
import type { SkuRow } from "@/components/product/forms/sku/api";
import { createClient } from "@/lib/supabase/client";
import type { SkuFormOutput } from "./schema";

export function SkuManager({
  productUuid,
  categoryCode,
}: {
  productUuid: string | null;
  categoryCode: string;
}) {
  const { skus, loading, load, save, remove } = useSkus(
    productUuid,
    categoryCode
  );
  const [editing, setEditing] = useState<SkuRow | null>(null);

  useEffect(() => {
    void load();
  }, [load, productUuid]);

  const onGenerate = async () => {
    const supabase = createClient();

    if (!productUuid) return "";
    try {
      return await generateNextSkuCode(supabase, categoryCode);
    } catch {
      toast.error("Cannot generate code");
      return "";
    }
  };

  return (
    <div className="space-y-4">
      {!productUuid && (
        <div className="text-sm text-muted-foreground">
          Save product details first to manage SKUs.
        </div>
      )}

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SkuForm
            productUuid={productUuid}
            categoryCode={categoryCode}
            initial={
              editing
                ? ({
                    sku_uuid: editing.sku_uuid,
                    product_uuid: editing.product_uuid,
                    sku_code: editing.sku_code ?? "",
                    uom_code: editing.uom_code,
                    default_tax_code: editing.default_tax_code ?? "VAT7",
                    is_active: !!editing.is_active,
                    sku_short_code: editing.sku_short_code ?? "", // <- coerce null -> ""
                  } satisfies Partial<SkuFormOutput>)
                : null
            }
            onGenerate={onGenerate}
            onCancel={() => setEditing(null)}
            onSubmit={async (vals) => {
              await save(vals);
              setEditing(null);
            }}
          />
        </CardContent>
      </Card>

      <div className="rounded-2xl border">
        <div className="p-3 font-medium">รหัสสินค้า</div>
        {loading ? (
          <div className="p-3 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <SkuList
            skus={skus}
            onEdit={(s) => setEditing(s)}
            onDelete={(s) => {
              if (confirm(`Delete SKU ${s.sku_code}?`)) void remove(s);
            }}
          />
        )}
      </div>
    </div>
  );
}
