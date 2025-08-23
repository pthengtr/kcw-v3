"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  BANK_ACCOUNT_TYPES,
  BankAccountType,
  BankInfoRow,
  isBankType,
} from "../types";

type DraftBank = {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
  account_type: BankAccountType;
  is_default: boolean;
};

export default function BankTab({ partyUuid }: { partyUuid: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [rows, setRows] = React.useState<BankInfoRow[]>([]);
  const [draft, setDraft] = React.useState<DraftBank>({
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_branch: "",
    account_type: "OTHER",
    is_default: false,
  });

  const load = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("party_bank_info")
      .select(
        "bank_info_uuid, party_uuid, bank_name, bank_account_name, bank_account_number, bank_branch, account_type, is_default, created_at, updated_at"
      )
      .eq("party_uuid", partyUuid)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) toast.error("Load banks failed", { description: error.message });
    else setRows((data ?? []) as BankInfoRow[]);
  }, [partyUuid, supabase]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!draft.bank_name.trim() || !draft.bank_account_number.trim()) return;
    if (draft.is_default) {
      await supabase
        .from("party_bank_info")
        .update({ is_default: false })
        .eq("party_uuid", partyUuid);
    }
    const { data, error } = await supabase
      .from("party_bank_info")
      .insert({ party_uuid: partyUuid, ...draft })
      .select()
      .single();
    if (error) {
      toast.error("Add bank failed", { description: error.message });
      return;
    }
    setRows((prev) => [data as BankInfoRow, ...prev]);
    setDraft({
      bank_name: "",
      bank_account_name: "",
      bank_account_number: "",
      bank_branch: "",
      account_type: "OTHER",
      is_default: false,
    });
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("party_bank_info")
      .delete()
      .eq("bank_info_uuid", id);
    if (error) {
      toast.error("Delete bank failed", { description: error.message });
      return;
    }
    setRows((prev) => prev.filter((r) => r.bank_info_uuid !== id));
  }

  async function setDefault(id: string, next: boolean) {
    if (next)
      await supabase
        .from("party_bank_info")
        .update({ is_default: false })
        .eq("party_uuid", partyUuid);
    const { error } = await supabase
      .from("party_bank_info")
      .update({ is_default: next })
      .eq("bank_info_uuid", id);
    if (error) {
      toast.error("Update bank failed", { description: error.message });
      return;
    }
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        is_default:
          r.bank_info_uuid === id ? next : next ? false : r.is_default,
      }))
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="space-y-2 lg:col-span-2">
            <Label>Bank</Label>
            <Input
              value={draft.bank_name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, bank_name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Account name</Label>
            <Input
              value={draft.bank_account_name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, bank_account_name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Account no.</Label>
            <Input
              value={draft.bank_account_number}
              onChange={(e) =>
                setDraft((d) => ({ ...d, bank_account_number: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Branch</Label>
            <Input
              value={draft.bank_branch}
              onChange={(e) =>
                setDraft((d) => ({ ...d, bank_branch: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Type</Label>
            <Select
              value={draft.account_type}
              onValueChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  account_type: isBankType(v) ? v : "OTHER",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {(BANK_ACCOUNT_TYPES as readonly string[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Add bank
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.bank_info_uuid}>
            <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-6 gap-3 items-center">
              <div className="font-medium">{r.bank_name}</div>
              <div className="truncate">{r.bank_account_name}</div>
              <div className="font-mono">{r.bank_account_number}</div>
              <div>{r.bank_branch || "—"}</div>
              <div className="text-sm uppercase">{r.account_type}</div>
              <div className="flex items-center justify-end gap-2">
                <Switch
                  checked={!!r.is_default}
                  onCheckedChange={(v) => setDefault(r.bank_info_uuid, v)}
                />
                <Button
                  variant="destructive"
                  onClick={() => remove(r.bank_info_uuid)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!rows.length && (
          <p className="text-sm text-muted-foreground">No bank info yet.</p>
        )}
      </div>
    </div>
  );
}
