"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LocationRow } from "./types";

export type LocationSelectProps = {
  value?: string | null; // location_uuid
  onChange: (uuid: string | null) => void;
  placeholder?: string;
  includeInactive?: boolean;
  className?: string;
};

export default function LocationSelect({
  value,
  onChange,
  placeholder = "เลือกสถานที่",
  includeInactive = false,
  className,
}: LocationSelectProps) {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    setLoading(true);
    let query = supabase.from("location").select("*").order("location_code");
    if (!includeInactive) query = query.eq("is_active", true);

    query.then(({ data, error }) => {
      if (!error && data) {
        setRows(data as LocationRow[]);
      }
      setLoading(false);
    });
  }, [includeInactive]);

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(v) => onChange(v || null)}
      disabled={loading}
    >
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {rows.map((loc) => (
          <SelectItem key={loc.location_uuid} value={loc.location_uuid}>
            {loc.location_code} — {loc.location_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
