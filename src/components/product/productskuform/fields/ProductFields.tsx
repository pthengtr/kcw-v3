"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import type { FormInput, RefsPayload } from "../types";
import CategorySelect from "../../CategorySelect";

export function ProductFields({ opts }: { opts: RefsPayload }) {
  const form = useFormContext<FormInput>();

  return (
    <div className="space-y-3">
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

      <FormField
        control={form.control}
        name="category_code"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Category</FormLabel>
            <FormControl>
              <CategorySelect
                value={(field.value as string | undefined) ?? undefined}
                onChange={(v) => field.onChange(v === "all" ? "" : v)}
                options={opts.categories}
                includeAll={false} // form should FORCE a choice, so no "All"
                placeholder="Select category"
                className="w-full"
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
          <FormItem>
            <FormLabel>Active</FormLabel>
            <div className="flex items-center gap-2">
              <FormControl>
                <Switch
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
