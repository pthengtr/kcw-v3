"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
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

export function TaxField({ opts }: { opts: RefsPayload }) {
  const form = useFormContext<FormInput>();
  return (
    <FormField
      control={form.control}
      name="default_tax_code"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Default tax</FormLabel>
          <Select value={field.value ?? "VAT7"} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select tax code" />
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
  );
}
