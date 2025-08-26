// components/product/drawers/ProductDrawer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CategorySelect } from "@/components/product/inputs/CategorySelect";
import {
  ProductForm,
  ProductSchema,
  type ProductItemRow,
} from "@/components/product/types";
import { createClient } from "@/lib/supabase/client";
import { SkuManager } from "@/components/product/forms/sku/SkuManager";
import { BarcodeManager } from "@/components/product/forms/BarcodeManager";

export function ProductDrawer({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ProductItemRow | null;
  onSaved: () => void;
}) {
  const sb = useMemo(() => createClient(), []);
  const [productUuid, setProductUuid] = useState<string | null>(
    initial?.product_uuid ?? null
  );

  const form = useForm<ProductForm>({
    resolver: zodResolver(ProductSchema),
    defaultValues: initial
      ? {
          product_uuid: initial.product_uuid,
          product_name: initial.product_name,
          product_description: initial.product_description ?? null,
          is_active: initial.is_active ?? true, // ensure boolean, not undefined
          category_code: initial.category_code,
        }
      : {
          product_uuid: undefined,
          product_name: "",
          product_description: null,
          is_active: true,
          category_code: "10",
        },
  });

  useEffect(() => {
    if (initial) {
      form.reset({
        product_uuid: initial.product_uuid,
        product_name: initial.product_name,
        product_description: initial.product_description,
        is_active: initial.is_active,
        category_code: initial.category_code,
      });
      setProductUuid(initial.product_uuid);
    } else {
      form.reset({
        product_name: "",
        product_description: null,
        is_active: true,
        category_code: "10",
      });
      setProductUuid(null);
    }
  }, [initial, form]);

  // ✅ Make the handler match SubmitHandler<ProductForm>
  const onSubmit: SubmitHandler<ProductForm> = async (values) => {
    // ⬇️ Parse to get fully-typed output (is_active is guaranteed boolean)
    const parsed = ProductSchema.parse(values);

    const payload = {
      product_name: parsed.product_name,
      product_description: parsed.product_description ?? null,
      is_active: parsed.is_active, // now boolean
      category_code: parsed.category_code,
    };

    if (productUuid) {
      const { error } = await sb
        .from("product_item")
        .update(payload)
        .eq("product_uuid", productUuid);
      if (error) throw error;
    } else {
      const { data, error } = await sb
        .from("product_item")
        .insert(payload)
        .select("product_uuid")
        .single();
      if (error) throw error;
      setProductUuid(data.product_uuid as string);
    }
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>
            {productUuid ? "Edit Product" : "New Product"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="product_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <CategorySelect
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="product_description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Description"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormLabel>Active</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>

            <Separator className="my-2" />

            <Tabs defaultValue="skus">
              <TabsList>
                <TabsTrigger value="skus">รหัสสินค้า</TabsTrigger>
                <TabsTrigger value="barcodes">บาร์โค๊ด</TabsTrigger>
              </TabsList>

              <TabsContent value="skus" className="pt-4">
                <SkuManager
                  productUuid={productUuid}
                  categoryCode={form.watch("category_code")}
                />
              </TabsContent>

              <TabsContent value="barcodes" className="pt-4">
                <BarcodeManager productUuid={productUuid} />
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
