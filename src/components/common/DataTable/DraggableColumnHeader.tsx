import * as React from "react";
import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Header, Column } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import DataTableColumnHeader from "./DataTableColumnHeader";

export function DraggableColumnHeader<TData>({
  column,
  header,
}: {
  column: Column<TData, unknown>;
  header: Header<TData, unknown>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: column.id,
      animateLayoutChanges: (args) =>
        defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const def = column.columnDef.header;
  const headerNode =
    typeof def === "string" || def == null ? (
      <DataTableColumnHeader
        title={typeof def === "string" ? def : String(column.id)}
      />
    ) : (
      flexRender(def, header.getContext())
    );

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Make the whole header draggable; the sensor distance prevents accidental drags
      className="px-3 py-2 select-none cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-2">
        <span className="i-lucide-grip-vertical opacity-60" aria-hidden />
        {headerNode}
      </div>
    </div>
  );
}
