"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, Plus, Trash2 } from "lucide-react";

type ShortCodeRow = {
  short_code_uuid: string;
  short_code: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  skuUuid: string;
  onChanged?: () => void; // NEW
};

export default function ShortCodeManager({ skuUuid, onChanged }: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [rows, setRows] = React.useState<ShortCodeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [newShort, setNewShort] = React.useState("");
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_sku_short_code")
      .select("short_code_uuid,short_code,created_at,updated_at")
      .eq("sku_uuid", skuUuid)
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Failed to load short codes", { description: error.message });
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
    const val = newShort.trim();
    if (!val) {
      toast.error("Short code is required");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("product_sku_short_code").insert({
      sku_uuid: skuUuid,
      short_code: val,
    });
    if (error) {
      toast.error("Could not add short code", { description: error.message });
    } else {
      toast.success("Short code added");
      setNewShort("");
      onChanged?.();
      await load();
    }
    setAdding(false);
  }

  async function deleteAction(uuid: string) {
    const { error } = await supabase
      .from("product_sku_short_code")
      .delete()
      .eq("short_code_uuid", uuid)
      .eq("sku_uuid", skuUuid);

    if (error) {
      toast.error("Delete failed", { description: error.message });
    } else {
      toast.success("Short code deleted");
      onChanged?.();
      await load();
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle>Short Codes</CardTitle>
        <form onSubmit={onAdd} className="flex items-center gap-2">
          <Input
            placeholder="Add short code…"
            value={newShort}
            onChange={(e) => setNewShort(e.target.value)}
            className="w-56"
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
            Loading short codes…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No short codes yet.</p>
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Short Code</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.short_code_uuid}>
                    <TableCell className="font-medium">
                      {r.short_code}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDeleteId(r.short_code_uuid)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </CardContent>

      <AlertDialog
        open={!!pendingDeleteId}
        onOpenChange={() => setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete short code</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected short code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingDeleteId) await deleteAction(pendingDeleteId);
                setPendingDeleteId(null);
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
