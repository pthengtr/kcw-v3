"use client";

import * as React from "react";
import ProductSkuForm from "./ProductSkuForm";
import type { ProductSkuFormMode, ProductSkuInitial } from "./types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import BarcodeManager from "./BarcodeManager";
import ShortCodeManager from "./ShortCodeManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Props = {
  mode: ProductSkuFormMode; // "create" | "update"
  initial?: ProductSkuInitial;
  open: boolean;
  onSaved?: (payload: {
    product_uuid: string;
    sku_uuid: string;
    sku_code: string;
  }) => void;
  onCancel?: () => void;
  onAnyChange?: () => void;
};

export default function ProductSkuFormTabs(props: Props) {
  const { mode, initial, onAnyChange } = props;
  const canManageSkuExtras = mode === "update" && !!initial?.sku_uuid;
  const dirtyRef = React.useRef(false);

  const markDirty = React.useCallback(() => {
    dirtyRef.current = true;
    onAnyChange?.();
  }, [onAnyChange]);

  if (!canManageSkuExtras) {
    // Creation flow (or missing sku_uuid): just show the original form.
    return <ProductSkuForm {...props} />;
  }

  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="barcodes">Barcodes</TabsTrigger>
        <TabsTrigger value="short-codes">Short Codes</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle>SKU Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductSkuForm {...props} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="barcodes">
        {initial?.sku_uuid ? (
          <BarcodeManager skuUuid={initial.sku_uuid} onChanged={markDirty} />
        ) : (
          <Alert>
            <AlertTitle>Unavailable</AlertTitle>
            <AlertDescription>
              You can manage barcodes after the SKU has been created.
            </AlertDescription>
          </Alert>
        )}
      </TabsContent>

      <TabsContent value="short-codes">
        {initial?.sku_uuid ? (
          <ShortCodeManager skuUuid={initial.sku_uuid} onChanged={markDirty} />
        ) : (
          <Alert>
            <AlertTitle>Unavailable</AlertTitle>
            <AlertDescription>
              You can manage short codes after the SKU has been created.
            </AlertDescription>
          </Alert>
        )}
      </TabsContent>
    </Tabs>
  );
}
