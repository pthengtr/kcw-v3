"use client";

import * as React from "react";
import ProductItemForm from "@/components/product/item/ProductItemForm";
import ProductItemTable from "@/components/product/item/ProductItemTable";
import SkuForm from "@/components/product/sku/SkuForm";
import SkuTable from "@/components/product/sku/SkuTable";
import BarcodeTable from "@/components/product/sku/BarcodeTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listProductItems,
  deleteProductItem,
  listSkusByProduct,
  deleteSku,
} from "@/components/product/repo";
import type { ProductItem, ProductSku } from "@/components/product/types";

export default function ProductPage() {
  const [items, setItems] = React.useState<ProductItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  // Product dialogs
  const [openItemDlg, setOpenItemDlg] = React.useState<boolean>(false);
  const [editItem, setEditItem] = React.useState<ProductItem | null>(null);

  // SKU dialogs
  const [openSkuDlg, setOpenSkuDlg] = React.useState<boolean>(false);
  const [skuProduct, setSkuProduct] = React.useState<ProductItem | null>(null);
  const [editSku, setEditSku] = React.useState<ProductSku | null>(null);
  const [skuRows, setSkuRows] = React.useState<ProductSku[]>([]);
  const [skuLoading, setSkuLoading] = React.useState<boolean>(false);

  const refresh = React.useCallback(() => {
    setLoading(true);
    listProductItems()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // SKU helpers
  const openSkuForProduct = async (pi: ProductItem) => {
    setSkuProduct(pi);
    setSkuLoading(true);
    setOpenSkuDlg(true);
    const rows = await listSkusByProduct(pi.product_uuid);
    setSkuRows(rows);
    setSkuLoading(false);
  };

  async function refreshSkus() {
    const rows = await listSkusByProduct(skuProduct!.product_uuid);
    setSkuRows(rows);
    setEditSku(null);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
        <Button
          onClick={() => {
            setEditItem(null);
            setOpenItemDlg(true);
          }}
        >
          New Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductItemTable
            data={items}
            isLoading={loading}
            onEdit={(row) => {
              setEditItem(row);
              setOpenItemDlg(true);
            }}
            onDelete={async (row) => {
              await deleteProductItem(row.product_uuid);
              refresh();
            }}
          />
        </CardContent>
      </Card>

      {/* Product Create/Edit */}
      <Dialog open={openItemDlg} onOpenChange={setOpenItemDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editItem ? "Edit Product" : "New Product"}
            </DialogTitle>
          </DialogHeader>
          {editItem ? (
            <ProductItemForm
              mode="edit"
              initial={editItem}
              onSaved={() => {
                // use `saved` if needed
                setOpenItemDlg(false);
                refresh();
              }}
            />
          ) : (
            <ProductItemForm
              mode="create"
              onSaved={() => {
                setOpenItemDlg(false);
                refresh();
              }}
            />
          )}
          {editItem && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => openSkuForProduct(editItem)}
              >
                Manage SKUs…
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SKUs for selected product */}
      <Dialog open={openSkuDlg} onOpenChange={setOpenSkuDlg}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>SKUs — {skuProduct?.product_name ?? ""}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditSku(null);
                }}
              >
                New SKU
              </Button>
            </div>

            <SkuTable
              data={skuRows}
              isLoading={skuLoading}
              onEdit={(row) => setEditSku(row)}
              onDelete={async (row) => {
                await deleteSku(row.sku_uuid);
                const rows = await listSkusByProduct(skuProduct!.product_uuid);
                setSkuRows(rows);
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">
                  {editSku ? "Edit SKU" : "Create SKU"}
                </h3>

                {editSku
                  ? skuProduct && (
                      <SkuForm
                        mode="edit"
                        productUuid={skuProduct.product_uuid}
                        initial={editSku}
                        onSaved={async () => {
                          await refreshSkus();
                          setEditSku(null);
                        }}
                      />
                    )
                  : skuProduct && (
                      <SkuForm
                        mode="create"
                        productUuid={skuProduct.product_uuid}
                        onSaved={async () => {
                          await refreshSkus();
                        }}
                      />
                    )}
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">
                  Barcodes{" "}
                  {editSku ? `(${editSku.sku_code ?? editSku.sku_uuid})` : ""}
                </h3>
                {editSku ? (
                  <BarcodeTable skuUuid={editSku.sku_uuid} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a SKU to manage barcodes.
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
