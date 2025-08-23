"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { TaxInfoRow } from "../types";

type DraftTax = {
  legal_name: string;
  tax_payer_id: string;
  address: string;
  is_default: boolean;
};

export default function TaxTab({ partyUuid }: { partyUuid: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [rows, setRows] = React.useState<TaxInfoRow[]>([]);
  const [draft, setDraft] = React.useState<DraftTax>({
    legal_name: "",
    tax_payer_id: "",
    address: "",
    is_default: false,
  });

  const load = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("party_tax_info")
      .select(
        "tax_info_uuid, party_uuid, legal_name, tax_payer_id, address, is_default, updated_at"
      )
      .eq("party_uuid", partyUuid)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error)
      toast.error("Load tax profiles failed", { description: error.message });
    else setRows((data ?? []) as TaxInfoRow[]);
  }, [partyUuid, supabase]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!draft.legal_name.trim()) return;
    if (draft.is_default)
      await supabase
        .from("party_tax_info")
        .update({ is_default: false })
        .eq("party_uuid", partyUuid);
    const { data, error } = await supabase
      .from("party_tax_info")
      .insert({ party_uuid: partyUuid, ...draft })
      .select()
      .single();
    if (error) {
      toast.error("Add tax profile failed", { description: error.message });
      return;
    }
    setRows((prev) => [data as TaxInfoRow, ...prev]);
    setDraft({
      legal_name: "",
      tax_payer_id: "",
      address: "",
      is_default: false,
    });
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("party_tax_info")
      .delete()
      .eq("tax_info_uuid", id);
    if (error) {
      toast.error("Delete tax profile failed", { description: error.message });
      return;
    }
    setRows((prev) => prev.filter((r) => r.tax_info_uuid !== id));
  }

  async function setDefault(id: string, next: boolean) {
    if (next)
      await supabase
        .from("party_tax_info")
        .update({ is_default: false })
        .eq("party_uuid", partyUuid);
    const { error } = await supabase
      .from("party_tax_info")
      .update({ is_default: next })
      .eq("tax_info_uuid", id);
    if (error) {
      toast.error("Update tax profile failed", { description: error.message });
      return;
    }
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        is_default: r.tax_info_uuid === id ? next : next ? false : r.is_default,
      }))
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="space-y-2 lg:col-span-2">
            <Label>Legal name</Label>
            <Input
              value={draft.legal_name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, legal_name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Tax ID</Label>
            <Input
              value={draft.tax_payer_id}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tax_payer_id: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 lg:col-span-6">
            <Label>Address</Label>
            <Input
              value={draft.address}
              onChange={(e) =>
                setDraft((d) => ({ ...d, address: e.target.value }))
              }
            />
          </div>
          <div className="flex items-center gap-2 lg:col-span-1">
            <Switch
              checked={draft.is_default}
              onCheckedChange={(v) =>
                setDraft((d) => ({ ...d, is_default: v }))
              }
            />
            <Label>Default</Label>
          </div>
          <div className="lg:col-span-6 flex justify-end">
            <Button onClick={add}>
              <Plus className="h-4 w-4 mr-2" />
              Add tax profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.tax_info_uuid}>
            <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-6 gap-3 items-start">
              <div className="font-medium col-span-2">{r.legal_name}</div>
              <div className="col-span-1">{r.tax_payer_id || "—"}</div>
              <div className="col-span-2 whitespace-pre-wrap">
                {r.address || "—"}
              </div>
              <div className="flex items-center justify-end gap-2 col-span-1">
                <Switch
                  checked={!!r.is_default}
                  onCheckedChange={(v) => setDefault(r.tax_info_uuid, v)}
                />
                <Button
                  variant="destructive"
                  onClick={() => remove(r.tax_info_uuid)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!rows.length && (
          <p className="text-sm text-muted-foreground">No tax profiles yet.</p>
        )}
      </div>
    </div>
  );
}
