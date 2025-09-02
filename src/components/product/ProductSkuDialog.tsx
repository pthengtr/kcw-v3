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

import { ProductSkuForm } from "./productskuform";
import type { ProductSkuFormMode, ProductSkuInitial } from "./productskuform";

export default function ProductSkuDialog({
  mode = "create",
  initial,
  trigger,
  onSaved,
}: {
  mode?: ProductSkuFormMode;
  initial?: ProductSkuInitial;
  trigger?: React.ReactNode;
  onSaved?: (res: {
    product_uuid: string;
    sku_uuid: string;
    sku_code: string;
  }) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

        <ProductSkuForm
          mode={mode}
          initial={initial}
          open={open}
          onSaved={(res) => {
            onSaved?.(res);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
