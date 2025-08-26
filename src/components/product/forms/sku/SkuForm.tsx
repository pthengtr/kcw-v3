"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UomSelect } from "@/components/product/inputs/UomSelect";
import { TaxSelect } from "@/components/product/inputs/TaxSelect";
import { cn } from "@/lib/utils";
import type { SkuFormInput, SkuFormOutput } from "./schema";
import { makeSkuSchema } from "./schema";

export type SkuFormProps = {
  productUuid: string | null;
  categoryCode: string;
  initial?: Partial<SkuFormOutput> | null;
  onSubmit: (values: SkuFormOutput) => Promise<void> | void;
  onGenerate: () => Promise<string> | string;
  onCancel?: () => void;
};

export function SkuForm({
  productUuid,
  categoryCode,
  initial,
  onSubmit,
  onGenerate,
  onCancel,
}: SkuFormProps) {
  const schema = makeSkuSchema(categoryCode);
  const form = useForm<SkuFormInput, unknown, SkuFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      product_uuid: productUuid ?? "",
      sku_uuid: initial?.sku_uuid,
      sku_code: initial?.sku_code ?? "",
      uom_code: initial?.uom_code ?? "",
      default_tax_code: initial?.default_tax_code ?? "VAT7",
      is_active: initial?.is_active ?? true,
      sku_short_code: initial?.sku_short_code ?? "",
    },
  });

  const submit = form.handleSubmit(async (vals) => {
    await onSubmit(vals);
  });

  return (
    <Form {...form}>
      <div className="contents">
        {/* SKU Code */}
        <FormField
          name="sku_code"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>รหัสสินค้า</FormLabel>
              <div className="flex gap-2 mt-1">
                <FormControl>
                  <Input
                    {...field}
                    className={cn(
                      form.formState.errors.sku_code &&
                        "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const code = await onGenerate();
                    form.setValue("sku_code", String(code), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                >
                  สร้างรหัสใหม่
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* UOM */}
        <FormField
          name="uom_code"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>หน่วย</FormLabel>
              <FormControl>
                <UomSelect value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Tax */}
        <FormField
          name="default_tax_code"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>ค่าเริ่มต้นภาษี</FormLabel>
              <FormControl>
                <TaxSelect value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Short Code */}
        <FormField
          name="sku_short_code"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>ชื่อย่อสินค้า</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  className={cn(
                    form.formState.errors.sku_short_code &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Active */}
        <FormField
          name="is_active"
          control={form.control}
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormLabel className="mt-1">ใช้งาน</FormLabel>
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

        <input type="hidden" {...form.register("product_uuid")} />

        <div className="md:col-span-3 flex gap-2">
          <Button
            type="button"
            disabled={!productUuid}
            onClick={() => submit()}
          >
            {initial?.sku_uuid ? "แก้ไขรหัสสินค้า" : "เพิ่มรหัสสินค้า"}
          </Button>
          {initial?.sku_uuid && onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              ยกเลิก
            </Button>
          )}
        </div>
      </div>
    </Form>
  );
}
