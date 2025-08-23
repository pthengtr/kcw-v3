"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import SelectUom from "../common/SelectUom";
import SelectTaxCategory from "../common/SelectTaxCategory";
import { newSkuSchema, updateSkuSchema } from "../validation";
import { createSku, updateSku } from "../repo";
import type { ProductSku, UUID } from "../types";

// ---- Use a UNION schema and derive Zod input/output types
const skuSchema = z.union([newSkuSchema, updateSkuSchema]);
type SkuFormIn = z.input<typeof skuSchema>; // is_active?: boolean; sku_uuid optional (create)
type SkuFormOut = z.output<typeof skuSchema>; // is_active: boolean; sku_uuid required on update

type Props =
  | {
      mode: "create";
      productUuid: UUID;
      initial?: undefined;
      onSaved?: (sku: ProductSku) => void;
    }
  | {
      mode: "edit";
      productUuid: UUID;
      initial: ProductSku;
      onSaved?: (sku: ProductSku) => void;
    };

export default function SkuForm(props: Props) {
  const isEdit = props.mode === "edit";

  const form = useForm<SkuFormIn>({
    resolver: zodResolver(skuSchema),
    defaultValues: isEdit
      ? {
          // update shape (has sku_uuid)
          sku_uuid: props.initial.sku_uuid,
          product_uuid: props.initial.product_uuid,
          sku_code: props.initial.sku_code ?? "",
          uom_code: props.initial.uom_code,
          default_tax_code: props.initial.default_tax_code ?? "",
          is_active: props.initial.is_active,
          sku_short_code: props.initial.sku_short_code ?? "",
        }
      : {
          // new shape (no sku_uuid)
          product_uuid: props.productUuid,
          uom_code: "",
          sku_code: "",
          default_tax_code: "",
          // is_active is optional in INPUT due to z.default(true), but you can set it explicitly:
          is_active: true,
          sku_short_code: "",
        },
  });

  const onSubmit = async (raw: SkuFormIn) => {
    // Parse to OUTPUT so defaults are applied and types are concrete
    const values = skuSchema.parse(raw) as SkuFormOut;
    const saved =
      "sku_uuid" in values
        ? await updateSku(values) // update path
        : await createSku(values); // create path
    props.onSaved?.(saved);
  };

  const errors = form.formState.errors as Record<string, { message?: string }>;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label>SKU Code</Label>
        <Input
          {...form.register("sku_code")}
          placeholder="Optional unique code"
        />
        {errors.sku_code?.message && (
          <p className="text-sm text-red-500">{errors.sku_code.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Short Code</Label>
        <Input
          {...form.register("sku_short_code")}
          placeholder="Optional short code"
        />
      </div>

      <div className="space-y-1">
        <Label>UOM</Label>
        <SelectUom
          value={form.watch("uom_code")}
          onChange={(v) =>
            form.setValue("uom_code", v, { shouldValidate: true })
          }
        />
        {errors.uom_code?.message && (
          <p className="text-sm text-red-500">{errors.uom_code.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Default Tax</Label>
        <SelectTaxCategory
          value={form.watch("default_tax_code") ?? ""}
          onChange={(v) =>
            form.setValue("default_tax_code", v || null, {
              shouldValidate: true,
            })
          }
          nullable
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={!!form.watch("is_active")}
          onCheckedChange={(v) =>
            form.setValue("is_active", v, { shouldValidate: true })
          }
          id="sku_is_active"
        />
        <Label htmlFor="sku_is_active">Active</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">{isEdit ? "Save changes" : "Create SKU"}</Button>
      </div>
    </form>
  );
}
