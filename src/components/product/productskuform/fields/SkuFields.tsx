"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import type { FormInput } from "../types";

export function SkuFields() {
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
              <Input value={field.value ?? ""} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
