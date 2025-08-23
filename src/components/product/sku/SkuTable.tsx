"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import type { ProductSku } from "../types";

type Props = {
  data: ProductSku[];
  onEdit: (row: ProductSku) => void;
  onDelete: (row: ProductSku) => void;
  isLoading?: boolean;
};

export default function SkuTable({ data, onEdit, onDelete, isLoading }: Props) {
  const columns = React.useMemo<ColumnDef<ProductSku>[]>(
    () => [
      {
        accessorKey: "sku_code",
        header: "SKU Code",
        cell: ({ row }) => row.original.sku_code ?? "",
      },
      {
        accessorKey: "sku_short_code",
        header: "Short",
        cell: ({ row }) => row.original.sku_short_code ?? "",
      },
      {
        accessorKey: "uom_code",
        header: "UOM",
      },
      {
        accessorKey: "default_tax_code",
        header: "Tax",
        cell: ({ row }) => row.original.default_tax_code ?? "",
      },
      {
        accessorKey: "is_active",
        header: "Active",
        cell: ({ row }) => (row.original.is_active ? "Yes" : "No"),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(row.original)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(row.original)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [onDelete, onEdit]
  );

  return (
    <DataTable<ProductSku, unknown>
      columns={columns}
      data={data}
      isLoading={isLoading}
    />
  );
}
