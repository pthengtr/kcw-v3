"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ProductQuery } from "./types";

type Props = {
  query: ProductQuery;
  total: number;
  onQueryChange: (next: Partial<ProductQuery>) => void;
};

function ProductTableFooterBase({ query, total, onQueryChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, query.pageSize)));
  const canPrev = query.pageIndex > 0;
  const canNext = query.pageIndex + 1 < pageCount;

  return (
    <div className="flex items-center justify-between p-2">
      <div className="text-sm text-muted-foreground">
        Page <span className="font-medium">{query.pageIndex + 1}</span> of{" "}
        <span className="font-medium">{pageCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQueryChange({ pageIndex: 0 })}
          disabled={!canPrev}
        >
          « First
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onQueryChange({ pageIndex: Math.max(0, query.pageIndex - 1) })
          }
          disabled={!canPrev}
        >
          ‹ Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQueryChange({ pageIndex: query.pageIndex + 1 })}
          disabled={!canNext}
        >
          Next ›
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQueryChange({ pageIndex: pageCount - 1 })}
          disabled={!canNext}
        >
          Last »
        </Button>
      </div>
    </div>
  );
}

const ProductTableFooter = React.memo(ProductTableFooterBase);
ProductTableFooter.displayName = "ProductTableFooter";
export default ProductTableFooter;
