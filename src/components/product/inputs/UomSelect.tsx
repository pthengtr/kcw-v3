// components/product/inputs/UomSelect.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Uom } from "@/components/product/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function UomSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const sb = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Uom[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from("product_uom")
        .select("uom_code,description")
        .order("uom_code");
      if (error) throw error;
      setItems((data ?? []) as Uom[]);
    })();
  }, [sb]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="เลือกหน่วย" />
      </SelectTrigger>
      <SelectContent>
        {items.map((u) => (
          <SelectItem key={u.uom_code} value={u.uom_code}>
            {u.uom_code} {u.description ? `— ${u.description}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
