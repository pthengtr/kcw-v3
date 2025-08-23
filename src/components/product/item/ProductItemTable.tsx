"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import type { ProductItem } from "../types";

type Props = {
  data: ProductItem[];
  onEdit: (row: ProductItem) => void;
  onDelete: (row: ProductItem) => void;
  isLoading?: boolean;
};

export default function ProductItemTable({
  data,
  onEdit,
  onDelete,
  isLoading,
}: Props) {
  const columns = React.useMemo<ColumnDef<ProductItem>[]>(
    () => [
      {
        accessorKey: "product_name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.product_name}</span>
        ),
      },
      {
        accessorKey: "product_description",
        header: "Description",
        cell: ({ row }) => row.original.product_description ?? "",
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
    [onEdit, onDelete]
  );

  return (
    <DataTable<ProductItem, unknown>
      columns={columns}
      data={data}
      isLoading={isLoading}
    />
  );
}
