"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { LocationRow } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type LocationColumnsArgs = {
  onEdit: (row: LocationRow) => void;
  onDelete: (row: LocationRow) => void;
};

export function locationColumns({
  onEdit,
  onDelete,
}: LocationColumnsArgs): ColumnDef<LocationRow>[] {
  return [
    {
      accessorKey: "location_code",
      header: "รหัส",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.location_code}</span>
      ),
    },
    {
      accessorKey: "location_name",
      header: "ชื่อสถานที่",
      cell: ({ row }) => row.original.location_name,
    },
    {
      accessorKey: "is_active",
      header: "สถานะ",
      cell: ({ row }) =>
        row.original.is_active ? (
          <Badge>ใช้งาน</Badge>
        ) : (
          <Badge variant="secondary">ปิดใช้งาน</Badge>
        ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">การกระทำ</div>,
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(row.original)}
          >
            แก้ไข
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDelete(row.original)}
          >
            ลบ
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
