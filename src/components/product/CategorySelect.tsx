// components/common/CategorySelect.tsx
"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Option = { value: string; label: string };

type Props = {
  value: string | "all" | undefined;
  onChange: (v: string | "all") => void;
  options: Option[];
  includeAll?: boolean; // default true
  placeholder?: string;
  className?: string;
  /** Connects <Label htmlFor="..."> to the trigger for a11y */
  triggerId?: string;
};

export default function CategorySelect({
  value,
  onChange,
  options,
  includeAll = true,
  placeholder = "Select category",
  className,
  triggerId,
}: Props) {
  return (
    <Select
      value={value ?? (includeAll ? "all" : undefined)}
      onValueChange={onChange}
    >
      <SelectTrigger id={triggerId} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
