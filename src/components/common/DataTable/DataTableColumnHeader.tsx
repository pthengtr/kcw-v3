import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataTableColumnHeaderProps = {
  title: string;
  /**
   * Optional click handler if you want to drive server-side sorting.
   * If omitted, the header renders as a plain label.
   */
  onClick?: () => void;
  /**
   * Optional sort indicator controlled by the parent.
   * Use "asc", "desc", or null (no sort).
   */
  sort?: "asc" | "desc" | null;
  className?: string;
};

export default function DataTableColumnHeader({
  title,
  onClick,
  sort = null,
  className,
}: DataTableColumnHeaderProps) {
  const SortIcon =
    sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ChevronsUpDown;

  if (!onClick) {
    return (
      <div
        className={cn(
          "flex select-none items-center gap-2 font-medium",
          className
        )}
        title={title}
      >
        <span className="truncate">{title}</span>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-8 px-2 font-medium data-[state=open]:bg-accent",
        "flex items-center gap-2",
        "hover:bg-accent",
        className
      )}
      onClick={onClick}
      title={title}
    >
      <span className="truncate">{title}</span>
      <SortIcon className="h-4 w-4 shrink-0 opacity-60" />
    </Button>
  );
}
