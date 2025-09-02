"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import type { FormInput, RefsPayload } from "../types";

export function SkuFields({ opts }: { opts: RefsPayload }) {
  const form = useFormContext<FormInput>();
  return (
    <>
      <FormField
        control={form.control}
        name="sku_code"
        render={({ field }) => (
          <FormItem>
            <FormLabel>SKU code (optional)</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
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
      <FormField
        control={form.control}
        name="uom_code"
        render={({ field }) => (
          <FormItem>
            <FormLabel>UOM</FormLabel>
            <Select
              value={field.value || undefined}
              onValueChange={field.onChange}
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
    </>
  );
}
