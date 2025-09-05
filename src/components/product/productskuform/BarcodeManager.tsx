"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Trash2, Plus } from "lucide-react";
import { isValidGtin, gtinType, normalizeDigits } from "./barcode-utils";

type BarcodeRow = {
  barcode: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  skuUuid: string;
  onChanged?: () => void; // NEW
};

export default function BarcodeManager({ skuUuid, onChanged }: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [rows, setRows] = React.useState<BarcodeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [newBarcode, setNewBarcode] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_barcode")
      .select("barcode,is_primary,created_at,updated_at")
      .eq("sku_uuid", skuUuid)
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Failed to load barcodes", { description: error.message });
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [skuUuid, supabase]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const raw = newBarcode.trim();
    if (!raw) {
      toast.error("Barcode is required");
      return;
    }

    const normalized = normalizeDigits(raw);
    if (!isValidGtin(normalized)) {
      toast.error("Not a standard barcode", {
        description:
          "Only GTIN-8/12/13/14 with a valid check digit are accepted. Try adding this as a Short Code instead.",
      });
      return;
    }

    setAdding(true);
    const { error } = await supabase.from("product_barcode").insert({
      sku_uuid: skuUuid,
      barcode: raw, // keep original formatting; DB has computed columns for search/digits
      // no is_primary control here; primary is tied to sku_code on the server
    });

    if (error) {
      toast.error("Could not add barcode", { description: error.message });
    } else {
      const t = gtinType(raw);
      toast.success(`Barcode added${t ? ` (${t})` : ""}`);
      setNewBarcode("");
      onChanged?.();
      await load();
    }
    setAdding(false);
  }

  async function deleteBarcode(barcode: string) {
    const { error } = await supabase
      .from("product_barcode")
      .delete()
      .eq("sku_uuid", skuUuid)
      .eq("barcode", barcode);

    if (error) {
      toast.error("Delete failed", { description: error.message });
    } else {
      toast.success("Barcode deleted");
      onChanged?.();
      await load();
    }
  }

  function isPrimaryRow(r: BarcodeRow): boolean {
    return !!r.is_primary; // rely solely on DB
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle>Barcodes</CardTitle>
        <form onSubmit={onAdd} className="flex items-center gap-2">
          <Input
            placeholder="Add standard barcode (GTIN-8/12/13/14)…"
            value={newBarcode}
            onChange={(e) => setNewBarcode(e.target.value)}
            className="w-72"
          />
          <Button type="submit" disabled={adding}>
            {adding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </Button>
        </form>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading barcodes…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No barcodes yet.</p>
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const primary = isPrimaryRow(r);
                  return (
                    <TableRow key={r.barcode}>
                      <TableCell className="font-medium">{r.barcode}</TableCell>
                      <TableCell>
                        {primary ? (
                          <Badge className="gap-1">Primary</Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            Secondary
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {primary ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Primary barcode cannot be deleted. Change the SKU
                              code if needed.
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDelete(r.barcode)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </CardContent>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={() => setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete barcode</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium">{pendingDelete ?? ""}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingDelete) await deleteBarcode(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
