// components/product/forms/SkuManager.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SkuRow } from "@/components/product/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { UomSelect } from "@/components/product/inputs/UomSelect";
import { TaxSelect } from "@/components/product/inputs/TaxSelect";
import {
  generateNextSkuCode,
  validateSkuCodeFormat,
} from "@/components/product/utils";

export function SkuManager({
  productUuid,
  categoryCode,
}: {
  productUuid: string | null;
  categoryCode: string;
}) {
  const sb = useMemo(() => createClient(), []);
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [editing, setEditing] = useState<Partial<SkuRow>>({
    sku_uuid: undefined,
    product_uuid: productUuid ?? "",
    sku_code: "",
    uom_code: "",
    default_tax_code: "VAT7",
    is_active: true,
    sku_short_code: "",
  });

  const load = useCallback(
    async function () {
      if (!productUuid) {
        setSkus([]);
        return;
      }
      setLoading(true);
      const { data, error } = await sb
        .from("product_sku")
        .select("*")
        .eq("product_uuid", productUuid)
        .order("sku_code", { ascending: true });
      setLoading(false);
      if (error) throw error;
      setSkus((data ?? []) as SkuRow[]);
    },
    [productUuid, sb]
  );

  useEffect(() => {
    void load();
  }, [load, productUuid]);

  async function handleGenerate() {
    const code = await generateNextSkuCode(sb, categoryCode);
    setEditing((e) => ({ ...e, sku_code: code }));
  }

  async function saveSku() {
    if (!productUuid) return;
    if (!editing.uom_code || !editing.default_tax_code) return;

    // Allow blank sku_code to auto-generate here
    let finalCode = (editing.sku_code ?? "").trim();
    if (!finalCode) {
      finalCode = await generateNextSkuCode(sb, categoryCode);
    } else if (!validateSkuCodeFormat(finalCode, categoryCode)) {
      throw new Error(`SKU must match ${categoryCode}<6 digits>.`);
    }

    if (editing.sku_uuid) {
      const { error } = await sb
        .from("product_sku")
        .update({
          sku_code: finalCode,
          uom_code: editing.uom_code,
          default_tax_code: editing.default_tax_code,
          is_active: editing.is_active ?? true,
          sku_short_code: editing.sku_short_code ?? null,
        })
        .eq("sku_uuid", editing.sku_uuid);
      if (error) throw error;
    } else {
      const { error } = await sb.from("product_sku").insert({
        product_uuid: productUuid,
        sku_code: finalCode,
        uom_code: editing.uom_code!,
        default_tax_code: editing.default_tax_code!,
        is_active: editing.is_active ?? true,
        sku_short_code: editing.sku_short_code ?? null,
      });
      if (error) throw error;
    }
    setEditing({
      sku_uuid: undefined,
      product_uuid: productUuid,
      sku_code: "",
      uom_code: "",
      default_tax_code: "VAT7",
      is_active: true,
      sku_short_code: "",
    });
    await load();
  }

  async function editRow(row: SkuRow) {
    setEditing({ ...row });
  }

  return (
    <div className="space-y-4">
      {!productUuid && (
        <div className="text-sm text-muted-foreground">
          Save product details first to manage SKUs.
        </div>
      )}

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>SKU Code</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder={`${categoryCode}000001`}
                value={editing.sku_code ?? ""}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, sku_code: e.target.value }))
                }
              />
              <Button type="button" variant="outline" onClick={handleGenerate}>
                Generate
              </Button>
            </div>
          </div>
          <div>
            <Label>UOM</Label>
            <UomSelect
              value={editing.uom_code ?? ""}
              onChange={(v) => setEditing((p) => ({ ...p, uom_code: v }))}
            />
          </div>
          <div>
            <Label>Tax</Label>
            <TaxSelect
              value={editing.default_tax_code ?? "VAT7"}
              onChange={(v) =>
                setEditing((p) => ({ ...p, default_tax_code: v }))
              }
            />
          </div>
          <div>
            <Label>Short Code</Label>
            <Input
              value={editing.sku_short_code ?? ""}
              onChange={(e) =>
                setEditing((p) => ({ ...p, sku_short_code: e.target.value }))
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Label>Active</Label>
            <Switch
              checked={editing.is_active ?? true}
              onCheckedChange={(v) =>
                setEditing((p) => ({ ...p, is_active: v }))
              }
            />
          </div>
          <div className="md:col-span-3">
            <Button disabled={!productUuid} onClick={() => void saveSku()}>
              {editing.sku_uuid ? "Update SKU" : "Add SKU"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-2xl border">
        <div className="p-3 font-medium">Existing SKUs</div>
        <div className="divide-y">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading…</div>
          ) : skus.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              No SKUs yet.
            </div>
          ) : (
            skus.map((s) => (
              <div
                key={s.sku_uuid}
                className="p-3 flex flex-wrap items-center gap-3"
              >
                <div className="w-32">{s.sku_code ?? "—"}</div>
                <div className="w-24 text-muted-foreground">
                  {s.sku_short_code ?? ""}
                </div>
                <div className="w-24">{s.uom_code}</div>
                <div className="w-24">{s.default_tax_code ?? ""}</div>
                <div className="w-24">
                  {s.is_active ? "Active" : "Inactive"}
                </div>
                <div className="ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void editRow(s)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
