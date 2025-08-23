"use client";

import * as React from "react";
import { listUoms } from "@/components/product/repo";
import type { ProductUom } from "@/components/product/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function SelectUom({
  value,
  onChange,
  placeholder = "Select UOM",
  disabled,
}: Props) {
  const [items, setItems] = React.useState<ProductUom[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    setLoading(true);
    listUoms()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || loading}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((u) => (
          <SelectItem key={u.uom_code} value={u.uom_code}>
            {u.uom_code}
            {u.description ? ` — ${u.description}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
