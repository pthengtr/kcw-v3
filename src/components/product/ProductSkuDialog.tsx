"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus } from "lucide-react";
import {
  Form as ShadForm,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

export type ProductSkuFormMode = "create" | "update";

export type ProductSkuInitial = {
  product_uuid?: string;
  sku_uuid?: string;
  product_name?: string;
  product_description?: string | undefined;
  category_code?: string; // 2 digits
  is_active?: boolean;
  sku_code?: string | undefined; // optional in create => autogen
  uom_code?: string;
  sku_short_code?: string | undefined;
  default_tax_code?: string | undefined;
};

const FormSchema = z.object({
  product_name: z.string().trim().min(1, "Product name is required"),

  // ✅ required now
  product_description: z.string().trim().min(1, "Description is required"),

  category_code: z
    .string()
    .trim()
    .regex(/^\d{2}$/, "Select a category (two digits)"),

  is_active: z.boolean().optional(), // still optional here, we default in defaultValues

  sku_code: z.string().optional(), // optional, blank => autogen

  uom_code: z.string().trim().min(1, "Select a UOM"),

  sku_short_code: z.string().optional(),

  // ✅ required now
  default_tax_code: z.string().trim().min(1, "Select a tax code"),
});

type FormInput = z.input<typeof FormSchema>;

type Option = { value: string; label: string };
type RefsPayload = { categories: Option[]; uoms: Option[]; taxes: Option[] };

async function fetchOptions(): Promise<RefsPayload> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_product_refs");
  if (error) throw error;
  return {
    categories: (data?.categories ?? []) as Option[],
    uoms: (data?.uoms ?? []) as Option[],
    taxes: (data?.taxes ?? []) as Option[],
  };
}

export default function ProductSkuDialog({
  mode = "create",
  initial,
  trigger,
  onSaved,
}: {
  mode?: ProductSkuFormMode;
  initial?: ProductSkuInitial;
  trigger?: React.ReactNode;
  onSaved?: (res: {
    product_uuid: string;
    sku_uuid: string;
    sku_code: string;
  }) => void;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [open, setOpen] = React.useState(false);
  const [loadingRefs, setLoadingRefs] = React.useState(true);
  const [opts, setOpts] = React.useState<RefsPayload>({
    categories: [],
    uoms: [],
    taxes: [],
  });
  const [submitting, setSubmitting] = React.useState(false);
  const isCreate = mode === "create";

  const defaultFormValues = React.useMemo(
    () => ({
      product_name: initial?.product_name ?? "",
      product_description: initial?.product_description ?? "",
      category_code: initial?.category_code ?? "", // empty to force selection
      is_active: initial?.is_active ?? true,
      sku_code: isCreate ? undefined : initial?.sku_code ?? undefined,
      uom_code: initial?.uom_code ?? "", // empty to force selection
      sku_short_code: initial?.sku_short_code ?? "",
      default_tax_code: initial?.default_tax_code ?? "", // ← always a string
    }),
    [initial, isCreate]
  );

  const form = useForm<FormInput>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    defaultValues: defaultFormValues,
  });

  // inside ProductSkuDialog
  React.useEffect(() => {
    const run = async () => {
      if (!open || mode !== "update") return;
      if (!initial?.sku_uuid) return;

      // if description already present, you can skip; otherwise fetch detail
      const missing =
        !initial?.product_description ||
        initial.product_description.length === 0;

      if (!missing) {
        // ensure form reflects latest `initial`
        form.reset({
          product_name: initial.product_name ?? "",
          product_description: initial.product_description ?? "",
          category_code: initial.category_code ?? "",
          is_active: initial.is_active ?? true,
          sku_code: initial.sku_code ?? "",
          uom_code: initial.uom_code ?? "",
          sku_short_code: initial.sku_short_code ?? "",
          default_tax_code: initial.default_tax_code ?? "",
        });
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("fn_product_sku_detail", {
          _sku_uuid: initial.sku_uuid,
        });
        if (error) throw error;

        const row = (Array.isArray(data) ? data[0] : data) as {
          product_name: string;
          product_description: string | null;
          category_code: string;
          is_active: boolean;
          sku_code: string | null;
          uom_code: string;
          sku_short_code: string | null;
          default_tax_code: string;
        };

        form.reset({
          product_name: row.product_name ?? "",
          product_description: row.product_description ?? "",
          category_code: row.category_code ?? "",
          is_active: row.is_active ?? true,
          sku_code: row.sku_code ?? "",
          uom_code: row.uom_code ?? "",
          sku_short_code: row.sku_short_code ?? "",
          default_tax_code: row.default_tax_code ?? "",
        });
      } catch (e) {
        // optional: surface an error toast
        console.error(e);
      }
    };
    run();
    // re-run when opening or switching selection
  }, [
    open,
    mode,
    initial?.sku_uuid,
    initial?.product_description,
    initial?.product_name,
    initial?.category_code,
    initial?.is_active,
    initial?.sku_code,
    initial?.uom_code,
    initial?.sku_short_code,
    initial?.default_tax_code,
    form,
  ]);

  // Reset the form whenever the dialog closes (and also when initial changes)
  React.useEffect(() => {
    if (!open) {
      form.reset(defaultFormValues);
    }
  }, [open, defaultFormValues, form]);

  // lazy-load refs on first open
  React.useEffect(() => {
    if (!open || !loadingRefs) return;
    (async () => {
      try {
        const data = await fetchOptions();
        setOpts(data);
      } finally {
        setLoadingRefs(false);
      }
    })();
  }, [open, loadingRefs]);

  async function handleSubmit(values: FormInput) {
    try {
      setSubmitting(true);
      if (isCreate) {
        // normalize optionals/empties to null for RPC
        const payload = {
          _product_name: values.product_name,
          _product_description: values.product_description ?? null,
          _category_code: values.category_code,
          _is_active: values.is_active ?? true,
          _sku_code:
            values.sku_code && values.sku_code.trim()
              ? values.sku_code.trim()
              : null,
          _uom_code: values.uom_code,
          _sku_short_code:
            values.sku_short_code && values.sku_short_code.trim()
              ? values.sku_short_code.trim()
              : null,
          _default_tax_code:
            values.default_tax_code && values.default_tax_code.trim()
              ? values.default_tax_code.trim()
              : null,
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

        onSaved?.({
          product_uuid: res.product_uuid,
          sku_uuid: res.sku_uuid,
          sku_code: res.sku_code,
        });
        setOpen(false);
        form.reset();
      } else {
        if (!initial?.product_uuid || !initial?.sku_uuid) {
          throw new Error("Missing IDs for update.");
        }
        const payload = {
          _product_uuid: initial.product_uuid,
          _sku_uuid: initial.sku_uuid,
          _product_name: values.product_name,
          _product_description: values.product_description,
          _category_code: values.category_code,
          _is_active: values.is_active ?? true,
          _sku_code:
            values.sku_code && values.sku_code.trim()
              ? values.sku_code.trim()
              : null, // blank => autogen
          _uom_code: values.uom_code,
          _sku_short_code:
            values.sku_short_code && values.sku_short_code.trim()
              ? values.sku_short_code.trim()
              : null,
          _default_tax_code: values.default_tax_code, // required in your schema
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
        setOpen(false);
        form.reset();
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.log(e);
        alert(e.message);
      } else {
        console.log(e);
        alert(String(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const Trigger = trigger ?? (
    <Button size="sm" className="gap-2">
      <Plus className="h-4 w-4" /> New Product & SKU
    </Button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset(defaultFormValues); // immediate reset on close
      }}
    >
      <DialogTrigger asChild>{Trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isCreate ? "Create Product + SKU" : "Update Product + SKU"}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Create a product and its single SKU. Leave SKU code blank to auto-generate (CC######)."
              : "Update product & SKU details. (Barcode/size tabs coming soon.)"}
          </DialogDescription>
        </DialogHeader>

        <ShadForm {...form}>
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            {/* Product */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="product_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="product_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="category_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={(v) => field.onChange(v)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {opts.categories.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Active</FormLabel>
                      <div className="flex h-10 items-center gap-3 rounded-md border px-3">
                        <Switch
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                        <span className="text-sm">
                          {field.value ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* SKU */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="sku_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU code (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="CC######" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Leave blank to auto-generate (category-prefixed).
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="uom_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UOM</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={(v) => field.onChange(v)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select UOM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {opts.uoms.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku_short_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="default_tax_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default tax</FormLabel>
                    <Select
                      value={field.value || undefined} // "" → placeholder, but RHF keeps it as string
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tax" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {opts.taxes.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Footer */}
            <div className="md:col-span-2 mt-2 flex items-center justify-between">
              {loadingRefs && (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading reference
                  data…
                </div>
              )}
              <div className="ml-auto flex gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}{" "}
                  {isCreate ? "Create" : "Save changes"}
                </Button>
              </div>
            </div>
          </form>
        </ShadForm>
      </DialogContent>
    </Dialog>
  );
}
