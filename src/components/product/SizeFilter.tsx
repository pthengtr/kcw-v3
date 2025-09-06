"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { SizeAttr, SizeSlotKey } from "./types";
import { Button } from "../ui/button";
import { ArrowDown, ArrowUp } from "lucide-react";

type SizeKind = { size_kind_code: string; description: string };

export type SizeFilterValue = {
  sizeKind: string | null; // e.g. 'I' | null
  sizeSlots: Partial<Record<SizeSlotKey, string>>; // {'1'?:string,'2'?:string,'3'?:string}
};

// SizeFilter.tsx (new props)
type SortSpec = { id: string; desc: boolean } | null;

type Props = {
  value: SizeFilterValue;
  onChange: (next: SizeFilterValue) => void;
  currentSort?: SortSpec;
  onSortChange?: (
    id: "size_pos1" | "size_pos2" | "size_pos3",
    desc: boolean
  ) => void;
  className?: string;
  selectWidthClass?: string;
  inputWidthClass?: string;
};

export default function SizeFilter({
  value,
  onChange,
  currentSort,
  onSortChange,
  className,
  selectWidthClass = "w-44",
  inputWidthClass = "w-40",
}: Props) {
  const supabase = React.useMemo(() => createClient(), []);

  const [sizeKindOpts, setSizeKindOpts] = React.useState<SizeKind[]>([]);
  const [sizeTemplate, setSizeTemplate] = React.useState<SizeAttr[]>([]);

  // load kinds once
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("product_size_kind")
        .select("size_kind_code, description")
        .order("description", { ascending: true });
      if (!cancelled && !error) setSizeKindOpts(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // load slot labels when kind changes
  React.useEffect(() => {
    let cancelled = false;
    if (!value.sizeKind) {
      setSizeTemplate([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("product_size_kind_attr")
        .select("attr_pos,label_th")
        .eq("size_kind_code", value.sizeKind)
        .order("attr_pos", { ascending: true });
      if (!cancelled && !error) {
        const template: SizeAttr[] = (data ?? []).map((d) => ({
          attr_pos: Number(d.attr_pos) as SizeAttr["attr_pos"], // 1|2|3
          label_th: d.label_th,
        }));
        setSizeTemplate(template);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, value.sizeKind]);

  return (
    <div className={className}>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="tb-size-kind" className="text-xs">
            หมวด
          </Label>
          <Select
            value={value.sizeKind ?? "all"}
            onValueChange={(v) =>
              onChange({
                sizeKind: v === "all" ? null : v,
                sizeSlots: {}, // reset slots when kind changes
              })
            }
          >
            <SelectTrigger id="tb-size-kind" className={selectWidthClass}>
              <SelectValue placeholder="ค้นหาตามขนาด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ค้นหาตามขนาด</SelectItem>
              {sizeKindOpts.map((k) => (
                <SelectItem key={k.size_kind_code} value={k.size_kind_code}>
                  {k.description} ({k.size_kind_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sizeTemplate.map((t) => {
          const key = String(t.attr_pos) as SizeSlotKey; // '1' | '2' | '3'
          const sortId = `size_pos${t.attr_pos}` as
            | "size_pos1"
            | "size_pos2"
            | "size_pos3";
          const isActive = currentSort?.id === sortId;
          const isDesc = isActive ? currentSort!.desc : false;

          return (
            <div key={t.attr_pos} className="flex flex-col gap-1">
              <Label className="text-xs">{t.label_th}</Label>
              <div className="flex items-center gap-2">
                <Input
                  className={inputWidthClass}
                  value={value.sizeSlots[key] ?? ""}
                  onChange={(e) =>
                    onChange({
                      sizeKind: value.sizeKind,
                      sizeSlots: { ...value.sizeSlots, [key]: e.target.value },
                    })
                  }
                  placeholder="e.g. 10mm"
                />
                <Button
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  size="icon"
                  disabled={!value.sizeKind} // require a kind to give sort meaning
                  onClick={() =>
                    onSortChange?.(sortId, isActive ? !isDesc : false)
                  }
                  title={`Sort ${t.label_th} ${
                    isActive ? (isDesc ? "ASC" : "DESC") : "ASC"
                  }`}
                >
                  {isActive ? (
                    isDesc ? (
                      <ArrowDown size={16} />
                    ) : (
                      <ArrowUp size={16} />
                    )
                  ) : (
                    <ArrowUp size={16} />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
