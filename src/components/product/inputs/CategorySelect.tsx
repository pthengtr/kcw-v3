// components/product/inputs/CategorySelect.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/components/product/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CategorySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const sb = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Category[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from("product_category")
        .select("category_code,category_name")
        .order("category_code");
      if (error) throw error;
      setItems((data ?? []) as Category[]);
    })();
  }, [sb]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select category" />
      </SelectTrigger>
      <SelectContent>
        {items.map((c) => (
          <SelectItem key={c.category_code} value={c.category_code}>
            {c.category_code} — {c.category_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
