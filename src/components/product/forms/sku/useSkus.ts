"use client";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  listSkus,
  createSku,
  updateSku,
  deleteSku,
  type SkuRow,
  type SkuInput,
} from "@/components/product/forms/sku/api";
import { generateNextSkuCode } from "@/components/product/utils";
import type { SkuFormOutput } from "./schema";
import { createClient } from "@/lib/supabase/client";

export function useSkus(productUuid: string | null, categoryCode: string) {
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!productUuid) {
      setSkus([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listSkus(productUuid);
      setSkus(data);
    } catch {
      toast.error("Failed to load SKUs");
    } finally {
      setLoading(false);
    }
  }, [productUuid]);

  const save = useCallback(
    async (values: SkuFormOutput) => {
      const supabase = createClient();

      let finalCode = values.sku_code.trim();
      if (!finalCode)
        finalCode = await generateNextSkuCode(supabase, categoryCode);

      const exists = skus.some(
        (s) => s.sku_code === finalCode && s.sku_uuid !== values.sku_uuid
      );
      if (exists) {
        toast.error("Duplicate SKU", {
          description: `SKU \"${finalCode}\" already exists.`,
        });
        throw new Error("DUP");
      }

      if (values.sku_uuid) {
        await updateSku(values.sku_uuid, {
          sku_code: finalCode,
          uom_code: values.uom_code,
          default_tax_code: values.default_tax_code,
          is_active: values.is_active,
          sku_short_code: values.sku_short_code || null,
        });
        toast.success("SKU updated");
      } else {
        const payload: SkuInput = {
          product_uuid: values.product_uuid,
          sku_code: finalCode,
          uom_code: values.uom_code,
          default_tax_code: values.default_tax_code,
          is_active: values.is_active,
          sku_short_code: values.sku_short_code || null,
        };
        await createSku(payload);
        toast.success("SKU added");
      }
      await load();
    },
    [categoryCode, skus, load]
  );

  const remove = useCallback(async (row: SkuRow) => {
    await deleteSku(row.sku_uuid);
    toast.success("SKU deleted");
    setSkus((prev) => prev.filter((s) => s.sku_uuid !== row.sku_uuid));
  }, []);

  return { skus, loading, load, save, remove };
}
