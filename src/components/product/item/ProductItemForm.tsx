"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { newProductItemSchema, updateProductItemSchema } from "../validation";
import { createProductItem, updateProductItem } from "../repo";
import type { ProductItem } from "../types";

// ✅ 1) Use a UNION schema for the resolver
const itemSchema = z.union([newProductItemSchema, updateProductItemSchema]);

// 2) Derive INPUT and OUTPUT types
type ItemFormIn = z.input<typeof itemSchema>; // is_active?: boolean
type ItemFormOut = z.output<typeof itemSchema>; // is_active: boolean

type Props =
  | { mode: "create"; initial?: undefined; onSaved?: (p: ProductItem) => void }
  | { mode: "edit"; initial: ProductItem; onSaved?: (p: ProductItem) => void };

export default function ProductItemForm(props: Props) {
  const isEdit = props.mode === "edit";

  const form = useForm<ItemFormIn>({
    resolver: zodResolver(itemSchema),
    defaultValues: isEdit
      ? {
          // update shape (has product_uuid)
          product_uuid: props.initial.product_uuid,
          product_name: props.initial.product_name,
          product_description: props.initial.product_description,
          is_active: props.initial.is_active,
        }
      : {
          // new shape (no product_uuid)
          product_name: "",
          product_description: "",
          is_active: true,
        },
  });

  useEffect(() => {
    if (isEdit) {
      form.reset({
        product_uuid: props.initial.product_uuid,
        product_name: props.initial.product_name,
        product_description: props.initial.product_description,
        is_active: props.initial.is_active,
      });
    } else {
      form.reset({
        product_name: "",
        product_description: "",
        is_active: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, props.initial?.product_uuid]);

  // ✅ 2) Discriminate on submit by presence of product_uuid
  const onSubmit = async (raw: ItemFormIn) => {
    const values = itemSchema.parse(raw) as ItemFormOut; // now is_active is guaranteed boolean
    const saved =
      "product_uuid" in values
        ? await updateProductItem(values)
        : await createProductItem(values);
    props.onSaved?.(saved);
  };
  const errors = form.formState.errors as Record<string, { message?: string }>;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label>Name</Label>
        <Input {...form.register("product_name")} placeholder="Product name" />
        {errors.product_name?.message && (
          <p className="text-sm text-red-500">{errors.product_name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea
          {...form.register("product_description")}
          placeholder="Optional description"
          rows={3}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={!!form.watch("is_active")}
          onCheckedChange={(v) =>
            form.setValue("is_active", v, { shouldValidate: true })
          }
          id="is_active"
        />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => form.reset()}>
          Reset
        </Button>
        <Button type="submit">{isEdit ? "Save changes" : "Create"}</Button>
      </div>
    </form>
  );
}
