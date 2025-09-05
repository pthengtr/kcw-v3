"use client";

import * as React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Form as ShadForm } from "@/components/ui/form";

import { toast } from "sonner";

import { ProductFields } from "./fields/ProductFields";
import { SkuFields } from "./fields/SkuFields";
import { TaxField } from "./fields/TaxField";
import { useProductRefs } from "./useProductRefs";
import {
  FormSchema,
  type FormInput,
  type ProductSkuFormMode,
  type ProductSkuInitial,
} from "./types";
import { isPostgrestError } from "@/lib/utils";

type Props = {
  mode: ProductSkuFormMode;
  initial?: ProductSkuInitial;
  open: boolean; // controls loading of refs
  onSaved?: (res: {
    product_uuid: string;
    sku_uuid: string;
    sku_code: string;
  }) => void;
  onCancel?: () => void;
};

export default function ProductSkuForm({
  mode,
  initial,
  open,
  onSaved,
  onCancel,
}: Props) {
  const isCreate = mode === "create";

  // default values
  const defaultValues = React.useMemo<FormInput>(
    () => ({
      product_name: initial?.product_name ?? "",
      product_description: initial?.product_description ?? "",
      category_code: initial?.category_code ?? "",
      is_active: initial?.is_active ?? true,
      sku_code: initial?.sku_code ?? "",
      sku_short_code: initial?.sku_short_code ?? "",
      default_tax_code: initial?.default_tax_code ?? "VAT7",
    }),
    [initial]
  );

  const form = useForm<FormInput>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    defaultValues,
  });

  // ensure values refresh when editing a different record
  React.useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  // Load select options
  const { opts, loading: refsLoading } = useProductRefs(open);

  const [submitting, setSubmitting] = React.useState(false);

  function formatSupabaseError(err: unknown) {
    if (isPostgrestError(err)) {
      const title = err.code ? `${err.code}: ${err.message}` : err.message;
      const details = typeof err.details === "string" ? err.details : undefined;
      const hint = typeof err.hint === "string" ? err.hint : undefined;
      const description =
        [details, hint].filter(Boolean).join(" · ") || undefined;
      return { title, description };
    }

    if (err instanceof Error) {
      return {
        title: err.name ? `${err.name}: ${err.message}` : err.message,
        description: undefined,
      };
    }

    return { title: "Something went wrong", description: String(err) };
  }

  async function onSubmit(values: FormInput) {
    const supabase = createClient();
    setSubmitting(true);
    try {
      if (isCreate) {
        const payload = {
          _product_name: values.product_name,
          _product_description: values.product_description,
          _category_code: values.category_code,
          _is_active: values.is_active ?? true,
          _sku_code: values.sku_code?.trim() ? values.sku_code.trim() : null,
          _sku_short_code: values.sku_short_code?.trim()
            ? values.sku_short_code.trim()
            : null,
          _default_tax_code: (values.default_tax_code || "VAT7").trim(),
        } as const;

        const { data, error } = await supabase.rpc(
          "fn_product_create_full",
          payload
        );
        if (error) throw error;

        const res = (Array.isArray(data) ? data[0] : data) as {
          product_uuid: string;
          sku_uuid: string;
          sku_code: string;
        };
        onSaved?.(res);
        form.reset();
        toast.success("Product created", {
          description: `SKU ${res.sku_code}`,
        });
      } else {
        if (!initial?.product_uuid || !initial?.sku_uuid)
          throw new Error("Missing identifiers for update.");

        const payload = {
          _product_uuid: initial.product_uuid,
          _sku_uuid: initial.sku_uuid,
          _product_name: values.product_name,
          _product_description: values.product_description,
          _category_code: values.category_code,
          _is_active: values.is_active ?? true,
          _sku_code: values.sku_code?.trim() ? values.sku_code.trim() : null,
          _sku_short_code: values.sku_short_code?.trim()
            ? values.sku_short_code.trim()
            : null,
          _default_tax_code: values.default_tax_code?.trim()
            ? values.default_tax_code.trim()
            : null, // required
        } as const;

        const { data, error } = await supabase.rpc(
          "fn_product_update_full",
          payload
        );
        if (error) throw error;

        const res = (Array.isArray(data) ? data[0] : data) as {
          product_uuid: string;
          sku_uuid: string;
          sku_code: string;
        };
        onSaved?.(res);
        toast.success("Product updated", {
          description: `SKU ${res.sku_code}`,
        });
      }
    } catch (err) {
      const { title, description } = formatSupabaseError(err);
      toast.error(title, { description });
      console.log(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!opts) {
    // Keep the frame stable for Dialog animation
    return (
      <div className="flex items-center gap-3 p-6">
        {refsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        <span className="text-sm text-muted-foreground">
          Loading references…
        </span>
      </div>
    );
  }

  return (
    <ShadForm {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormProvider {...form}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProductFields opts={opts} />
            <div className="space-y-3">
              <SkuFields />
              <TaxField opts={opts} />
            </div>
          </div>
        </FormProvider>

        <Separator />

        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            {isCreate ? "Create a product + 1 SKU" : "Update product & SKU"}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreate ? "Create" : "Save changes"}
            </Button>
          </div>
        </div>
      </form>
    </ShadForm>
  );
}
