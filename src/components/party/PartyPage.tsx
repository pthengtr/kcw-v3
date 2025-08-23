"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { Party } from "./types";
import PartyTable from "./PartyTable";
import PartyDialog from "./PartyDialog";
import DeleteDialog from "./DeleteDialog";

export default function PartyPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [deleting, setDeleting] = useState<Party | null>(null);

  const fetchParties = useCallback(async () => {
    setLoading(true);
    const s = search.trim();
    const query = supabase
      .from("party")
      .select(
        "party_uuid, party_code, party_name, kind, is_active, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(500);

    const { data, error } = s
      ? await query.or(`party_name.ilike.%${s}%,party_code.ilike.%${s}%`)
      : await query;

    if (error) {
      toast.error("Load failed", { description: error.message });
    } else {
      setRows((data ?? []) as Party[]);
    }
    setLoading(false);
  }, [search, supabase]);

  useEffect(() => {
    const t = setTimeout(fetchParties, 250);
    return () => clearTimeout(t);
  }, [fetchParties]);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-2xl">Party Management</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or name…"
                className="pl-8 w-[260px]"
              />
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New Party
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <PartyTable
            data={rows}
            loading={loading}
            onEdit={(p) => {
              setEditing(p);
              setOpen(true);
            }}
            onDelete={(p) => setDeleting(p)}
            onReorder={(next) => setRows(next)}
          />
        </CardContent>
      </Card>

      <PartyDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        party={editing}
        onCreated={(p) => setRows((prev) => [p, ...prev])}
        onUpdated={(p) =>
          setRows((prev) =>
            prev.map((x) => (x.party_uuid === p.party_uuid ? p : x))
          )
        }
      />

      <DeleteDialog
        itemName={deleting?.party_name}
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const { error } = await supabase
            .from("party")
            .delete()
            .eq("party_uuid", deleting.party_uuid);
          if (error) {
            toast.error("Delete failed", { description: error.message });
          } else {
            setRows((prev) =>
              prev.filter((r) => r.party_uuid !== deleting.party_uuid)
            );
            toast.success("Deleted", {
              description: `Removed “${deleting.party_name}”.`,
            });
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
