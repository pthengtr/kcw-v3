"use client";

import * as React from "react";
import { listTaxCategories } from "@/components/product/repo";
import type { ProductTaxCategory } from "@/components/product/types";
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
  nullable?: boolean;
  disabled?: boolean;
};

export default function SelectTaxCategory({
  value,
  onChange,
  placeholder = "Select tax",
  disabled,
}: Props) {
  const [items, setItems] = React.useState<ProductTaxCategory[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    setLoading(true);
    listTaxCategories()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {items && (
        <Select
          value={value}
          onValueChange={onChange}
          disabled={disabled || loading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((t) => (
              <SelectItem key={t.tax_code} value={t.tax_code}>
                {t.tax_code} ({t.rate}% {t.tax_type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );
}
