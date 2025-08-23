"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/common/DataTable";
import type { ProductBarcode, UUID } from "../types";
import { addBarcode, deleteBarcode, listBarcodesBySku } from "../repo";

type Props = {
  skuUuid: UUID;
};

export default function BarcodeTable({ skuUuid }: Props) {
  const [rows, setRows] = React.useState<ProductBarcode[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  const [barcode, setBarcode] = React.useState<string>("");
  const [isPrimary, setIsPrimary] = React.useState<boolean>(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const data = await listBarcodesBySku(skuUuid);
    setRows(data);
    setLoading(false);
  }, [skuUuid]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAdd = async () => {
    const code = barcode.trim();
    if (!code) return;
    await addBarcode({
      barcode: code,
      sku_uuid: skuUuid,
      is_primary: isPrimary,
    });
    setBarcode("");
    setIsPrimary(false);
    await refresh();
  };

  const onDelete = React.useCallback(
    async (code: string) => {
      await deleteBarcode(code);
      await refresh();
    },
    [refresh]
  );

  const columns = React.useMemo<ColumnDef<ProductBarcode>[]>(
    () => [
      {
        accessorKey: "barcode",
        header: "Barcode",
      },
      {
        accessorKey: "is_primary",
        header: "Primary",
        cell: ({ row }) => (row.original.is_primary ? "Yes" : "No"),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(row.original.barcode)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [onDelete]
  );

  return (
    <div className="space-y-4">
      {/* Inline creator */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-56 space-y-1">
          <Label className="text-sm">New barcode</Label>
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan or type barcode"
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="primary_sw"
            checked={isPrimary}
            onCheckedChange={setIsPrimary}
          />
          <Label htmlFor="primary_sw" className="text-sm">
            Primary
          </Label>
        </div>
        <Button onClick={onAdd}>Add</Button>
      </div>

      <DataTable<ProductBarcode, unknown>
        columns={columns}
        data={rows}
        isLoading={loading}
      />
    </div>
  );
}
