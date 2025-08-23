"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { LocationRow } from "./types";
import LocationForm from "./LocationForm";
import { useLocations } from "./useLocations";
import { locationColumns } from "./LocationColumns";

export default function LocationTable() {
  const { rows, fetchAll, createOne, updateOne, removeOne } = useLocations();
  const [open, setOpen] = useState<boolean>(false);
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "location_code", desc: false },
  ]);
  const [pageSize, setPageSize] = useState<number>(20);
  const [pageIndex, setPageIndex] = useState<number>(0);

  useEffect(() => {
    void fetchAll({ search: globalFilter });
  }, [fetchAll, globalFilter]);

  const columns = useMemo<ColumnDef<LocationRow>[]>(() => {
    return locationColumns({
      onEdit: (r) => {
        setEditing(r);
        setOpen(true);
      },
      onDelete: async (r) => {
        if (confirm(`ลบสถานที่ ${r.location_name}?`)) {
          await removeOne(r.location_uuid);
        }
      },
    });
  }, [removeOne]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      setPageIndex(next.pageIndex);
      setPageSize(next.pageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-2 justify-between items-center">
          <Input
            placeholder="ค้นหา (รหัส/ชื่อ)"
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-[260px]"
          />
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            เพิ่มสถานที่
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={
                        header.column.getCanSort()
                          ? "cursor-pointer select-none"
                          : undefined
                      }
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm">
            แสดง {table.getRowModel().rows.length} รายการ (ทั้งหมด {rows.length}
            )
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / หน้า
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                ก่อนหน้า
              </Button>
              <span className="text-sm">
                หน้า {table.getState().pagination.pageIndex + 1} /{" "}
                {table.getPageCount() || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>
                {editing ? "แก้ไขสถานที่" : "เพิ่มสถานที่"}
              </DialogTitle>
            </DialogHeader>
            <LocationForm
              initial={editing ?? undefined}
              onSubmit={async (values) => {
                if (editing) {
                  await updateOne({
                    location_uuid: editing.location_uuid,
                    location_code: values.location_code,
                    location_name: values.location_name,
                    is_active: values.is_active,
                  });
                } else {
                  await createOne({
                    location_code: values.location_code,
                    location_name: values.location_name,
                    is_active: values.is_active,
                  });
                }
                setOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
