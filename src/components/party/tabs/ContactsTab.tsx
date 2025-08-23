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
import { ContactRow } from "../types";

type DraftContact = {
  contact_name: string;
  role_title: string;
  email: string;
  phone: string;
  is_primary: boolean;
};

export default function ContactsTab({ partyUuid }: { partyUuid: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [rows, setRows] = React.useState<ContactRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftContact>({
    contact_name: "",
    role_title: "",
    email: "",
    phone: "",
    is_primary: false,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("party_contact")
      .select(
        "contact_uuid, party_uuid, contact_name, role_title, email, phone, is_primary, created_at, updated_at"
      )
      .eq("party_uuid", partyUuid)
      .order("updated_at", { ascending: false });
    if (error)
      toast.error("Load contacts failed", { description: error.message });
    else setRows((data ?? []) as ContactRow[]);
    setLoading(false);
  }, [partyUuid, supabase]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!draft.contact_name.trim()) return;
    const { data, error } = await supabase
      .from("party_contact")
      .insert({ party_uuid: partyUuid, ...draft })
      .select()
      .single();
    if (error) {
      toast.error("Add contact failed", { description: error.message });
      return;
    }
    setRows((prev) => [data as ContactRow, ...prev]);
    setDraft({
      contact_name: "",
      role_title: "",
      email: "",
      phone: "",
      is_primary: false,
    });
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("party_contact")
      .delete()
      .eq("contact_uuid", id);
    if (error) {
      toast.error("Delete contact failed", { description: error.message });
      return;
    }
    setRows((prev) => prev.filter((r) => r.contact_uuid !== id));
  }

  async function markPrimary(id: string, next: boolean) {
    // UX: optimistic single-primary
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        is_primary: r.contact_uuid === id ? next : false,
      }))
    );
    if (next)
      await supabase
        .from("party_contact")
        .update({ is_primary: false })
        .eq("party_uuid", partyUuid);
    const { error } = await supabase
      .from("party_contact")
      .update({ is_primary: next })
      .eq("contact_uuid", id);
    if (error)
      toast.error("Update contact failed", { description: error.message });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="space-y-2 lg:col-span-2">
            <Label>Name</Label>
            <Input
              value={draft.contact_name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contact_name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Role</Label>
            <Input
              value={draft.role_title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, role_title: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) =>
                setDraft((d) => ({ ...d, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Phone</Label>
            <Input
              value={draft.phone}
              onChange={(e) =>
                setDraft((d) => ({ ...d, phone: e.target.value }))
              }
            />
          </div>
          <div className="flex items-center gap-2 lg:col-span-1">
            <Switch
              checked={draft.is_primary}
              onCheckedChange={(v) =>
                setDraft((d) => ({ ...d, is_primary: v }))
              }
            />
            <Label>Primary</Label>
          </div>
          <div className="lg:col-span-6 flex justify-end">
            <Button onClick={add}>
              <Plus className="h-4 w-4 mr-2" />
              Add contact
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.contact_uuid}>
            <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <div className="font-medium">{r.contact_name}</div>
                <div className="text-sm text-muted-foreground">
                  {r.role_title || "—"}
                </div>
              </div>
              <div>{r.email || "—"}</div>
              <div>{r.phone || "—"}</div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!r.is_primary}
                  onCheckedChange={(v) => markPrimary(r.contact_uuid, v)}
                />
                <span className="text-sm">Primary</span>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => remove(r.contact_uuid)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!rows.length && !loading && (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        )}
      </div>
    </div>
  );
}
