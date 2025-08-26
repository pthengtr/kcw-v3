// components/product/inputs/TaxSelect.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tax } from "@/components/product/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaxSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const sb = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Tax[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from("product_tax_category")
        .select("tax_code,description")
        .order("tax_code");
      if (error) throw error;
      setItems((data ?? []) as Tax[]);
    })();
  }, [sb]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select tax code" />
      </SelectTrigger>
      <SelectContent>
        {items.map((t) => (
          <SelectItem key={t.tax_code} value={t.tax_code}>
            {t.tax_code} {t.description ? `— ${t.description}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
