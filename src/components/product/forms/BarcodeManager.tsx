// components/product/forms/BarcodeManager.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BarcodeRow, SkuRow } from "@/components/product/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function BarcodeManager({
  productUuid,
}: {
  productUuid: string | null;
}) {
  const sb = useMemo(() => createClient(), []);
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [barcodes, setBarcodes] = useState<BarcodeRow[]>([]);
  const [newCode, setNewCode] = useState<string>("");
  const [asPrimary, setAsPrimary] = useState<boolean>(false);

  const loadSkus = useCallback(
    async function () {
      if (!productUuid) {
        setSkus([]);
        return;
      }
      const { data, error } = await sb
        .from("product_sku")
        .select(
          "sku_uuid,product_uuid,sku_code,uom_code,default_tax_code,is_active,sku_short_code"
        )
        .eq("product_uuid", productUuid)
        .order("sku_code", { ascending: true });
      if (error) throw error;
      setSkus((data ?? []) as SkuRow[]);
      if ((data ?? []).length > 0 && !selectedSku) {
        setSelectedSku((data![0] as SkuRow).sku_uuid);
      }
    },
    [productUuid, sb, selectedSku]
  );

  const loadBarcodes = useCallback(
    async function (sku_uuid: string) {
      const { data, error } = await sb
        .from("product_barcode")
        .select("*")
        .eq("sku_uuid", sku_uuid)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      setBarcodes((data ?? []) as BarcodeRow[]);
    },
    [sb]
  );

  useEffect(() => {
    void loadSkus();
  }, [loadSkus, productUuid]);

  useEffect(() => {
    if (selectedSku) void loadBarcodes(selectedSku);
  }, [loadBarcodes, selectedSku]);

  async function addBarcode() {
    if (!selectedSku || !newCode.trim()) return;

    if (asPrimary) {
      // unset current primary for sku
      await sb
        .from("product_barcode")
        .update({ is_primary: false })
        .eq("sku_uuid", selectedSku)
        .eq("is_primary", true);
    }
    const { error } = await sb.from("product_barcode").upsert(
      {
        barcode: newCode.trim(),
        sku_uuid: selectedSku,
        is_primary: asPrimary,
      },
      { onConflict: "barcode" }
    );
    if (error) throw error;
    setNewCode("");
    setAsPrimary(false);
    await loadBarcodes(selectedSku);
  }

  async function setPrimary(code: string) {
    // enforce single primary
    await sb
      .from("product_barcode")
      .update({ is_primary: false })
      .eq("sku_uuid", selectedSku)
      .eq("is_primary", true);
    await sb
      .from("product_barcode")
      .update({ is_primary: true })
      .eq("barcode", code);
    await loadBarcodes(selectedSku);
  }

  async function removeBarcode(code: string) {
    await sb.from("product_barcode").delete().eq("barcode", code);
    await loadBarcodes(selectedSku);
  }

  return (
    <div className="space-y-4">
      {!productUuid && (
        <div className="text-sm text-muted-foreground">
          Save product first to manage barcodes.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>SKU</Label>
          <Select value={selectedSku} onValueChange={setSelectedSku}>
            <SelectTrigger>
              <SelectValue placeholder="Choose SKU" />
            </SelectTrigger>
            <SelectContent>
              {skus.map((s) => (
                <SelectItem key={s.sku_uuid} value={s.sku_uuid}>
                  {s.sku_code ?? s.sku_uuid.slice(0, 6)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>New Barcode</Label>
          <Input
            placeholder="EAN/UPC/Custom"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 mt-6">
          <Switch checked={asPrimary} onCheckedChange={setAsPrimary} />
          <span>Set as primary</span>
          <Button
            className="ml-auto"
            onClick={() => void addBarcode()}
            disabled={!selectedSku || !newCode.trim()}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border">
        <div className="p-3 font-medium">Barcodes</div>
        <div className="divide-y">
          {barcodes.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              No barcodes yet.
            </div>
          ) : (
            barcodes.map((b) => (
              <div key={b.barcode} className="p-3 flex items-center gap-3">
                <div className="w-64">{b.barcode}</div>
                <div className="text-sm">{b.is_primary ? "Primary" : ""}</div>
                <div className="ml-auto flex gap-2">
                  {!b.is_primary && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void setPrimary(b.barcode)}
                    >
                      Set Primary
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void removeBarcode(b.barcode)}
                  >
                    Delete
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
