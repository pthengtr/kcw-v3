"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ProductSkuFormTabs } from "./productskuform";
import type { ProductSkuFormMode, ProductSkuInitial } from "./productskuform";

export default function ProductSkuDialog({
  mode = "create",
  initial,
  trigger,
  onSaved,
  onDirtyClose,
}: {
  mode?: ProductSkuFormMode;
  initial?: ProductSkuInitial;
  trigger?: React.ReactNode;
  onSaved?: (res: {
    product_uuid: string;
    sku_uuid: string;
    sku_code: string;
  }) => void;
  onDirtyClose?: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  const dirtyRef = React.useRef(false);
  const markDirty = React.useCallback(() => {
    dirtyRef.current = true;
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // if closing and something changed, refresh the table
        if (!next && dirtyRef.current) {
          dirtyRef.current = false;
          onDirtyClose?.();
        }
        setOpen(next);
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New product & SKU" : "Edit product & SKU"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a product, then its first SKU."
              : "Update the product and this SKU."}
          </DialogDescription>
        </DialogHeader>

        <ProductSkuFormTabs
          mode={mode}
          initial={initial}
          open={open}
          onSaved={(res) => {
            onSaved?.(res);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
          onAnyChange={() => {
            // Add/delete barcode or short code
            markDirty();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
