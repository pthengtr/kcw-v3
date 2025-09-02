"use client";

import * as React from "react";
import {
  ColumnDef,
  getCoreRowModel,
  useReactTable,
  ColumnOrderState,
  VisibilityState,
  ColumnPinningState,
  RowSelectionState,
  flexRender,
} from "@tanstack/react-table";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { cn } from "@/lib/utils";
import { DraggableColumnHeader } from "./DraggableColumnHeader";
import { DataTableViewOptions } from "./DataTableViewOptions";

export type ServerDataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  className?: string;
  getRowId?: (originalRow: TData, index: number) => string;
  onRowClick?: (row: TData) => void;
  getRowClassName?: (row: TData) => string;
  stickyFooter?: React.ReactNode;
};

export function ServerDataTable<TData>({
  columns,
  data,
  className,
  getRowId,
  onRowClick,
  getRowClassName,
  stickyFooter,
}: ServerDataTableProps<TData>) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(
    {}
  );
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const table = useReactTable<TData>({
    data,
    columns,
    getRowId,
    state: { columnVisibility, columnOrder, columnPinning, rowSelection },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    enableRowSelection: true,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 6 } })
  );

  // Keep exact rendered header order for reordering math
  const headerOrderRef = React.useRef<string[]>([]);
  const handleDragEnd = (event: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentOrder = headerOrderRef.current;
    const oldIndex = currentOrder.indexOf(String(active.id));
    const newIndex = currentOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setColumnOrder(arrayMove(currentOrder, oldIndex, newIndex));
  };

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/40">
        <DataTableViewOptions table={table} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((hg) => {
                const headerOrder = hg.headers
                  .filter((h) => !h.isPlaceholder)
                  .map((h) => h.column.id);
                headerOrderRef.current = headerOrder;

                return (
                  <tr key={hg.id}>
                    <SortableContext
                      items={headerOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {hg.headers.map((header) => {
                        if (header.isPlaceholder) return <th key={header.id} />;
                        const col = header.column;
                        return (
                          <th
                            key={header.id}
                            className="border-b p-0 align-bottom relative"
                            style={{ width: col.getSize() }}
                          >
                            <DraggableColumnHeader
                              column={col}
                              header={header}
                            />
                            {/* resize handle */}
                            {col.getCanResize() && (
                              <div
                                onMouseDown={header.getResizeHandler()} // ✅ use header
                                onTouchStart={header.getResizeHandler()} // ✅ use header
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/40"
                              />
                            )}
                          </th>
                        );
                      })}
                    </SortableContext>
                  </tr>
                );
              })}
            </thead>

            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-muted/40",
                    getRowClassName
                      ? getRowClassName(row.original as TData)
                      : undefined
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

            {stickyFooter && (
              <tfoot className="sticky bottom-0 bg-background">
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length}>
                    {stickyFooter}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </DndContext>
      </div>
    </div>
  );
}
