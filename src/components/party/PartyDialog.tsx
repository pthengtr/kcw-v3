// PartyDialog.tsx (fix types + keep sonner toasts)

import * as React from "react";
import { useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PARTY_KINDS, Party, PartyKind } from "./types";
import ContactsTab from "./tabs/ContactsTab";
import BankTab from "./tabs/BankTab";
import TaxTab from "./tabs/TaxTab";

// ---- Zod schema ----
// Note: .default("CUSTOMER") makes INPUT optional (can be undefined) and OUTPUT required.
// We'll use z.input<typeof PartyFormSchema> for useForm generics to match resolver input.
const PartyFormSchema = z.object({
  party_name: z.string().min(1, "Required").max(255),
  party_code: z.string().trim().nullable().optional(),
  kind: z
    .enum(PARTY_KINDS as ["CUSTOMER", "SUPPLIER", "BOTH"])
    .default("CUSTOMER"),
  is_active: z.boolean().default(true),
});

// Helpful aliases for clarity
type PartyFormInput = z.input<typeof PartyFormSchema>; // what resolver receives (kind may be undefined)
type PartyFormOutput = z.output<typeof PartyFormSchema>; // parsed result (kind always defined)

export default function PartyDialog({
  open,
  onOpenChange,
  party,
  onCreated,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  party: Party | null;
  onCreated: (p: Party) => void;
  onUpdated: (p: Party) => void;
}) {
  const supabase = React.useMemo(() => createClient(), []);

  const form = useForm<PartyFormInput>({
    resolver: zodResolver(PartyFormSchema),
    defaultValues: {
      party_name: "",
      party_code: "",
      kind: "CUSTOMER", // fine to provide; schema also has a default
      is_active: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (party) {
      // Coerce kind to a valid enum member; fall back to "CUSTOMER"
      const safeKind: PartyKind = (PARTY_KINDS as readonly string[]).includes(
        party.kind
      )
        ? (party.kind as PartyKind)
        : "CUSTOMER";
      form.reset({
        party_name: party.party_name,
        party_code: party.party_code ?? "",
        kind: safeKind,
        is_active: party.is_active,
      });
    } else {
      form.reset({
        party_name: "",
        party_code: "",
        kind: "CUSTOMER",
        is_active: true,
      });
    }
  }, [open, party, form]);

  // Ensure we operate on the *parsed* output so kind is definitely present
  const submit = form.handleSubmit(async (rawValues: PartyFormInput) => {
    const values: PartyFormOutput = PartyFormSchema.parse(rawValues);

    try {
      if (party) {
        const { data, error } = await supabase
          .from("party")
          .update({
            party_code: values.party_code ?? null,
            party_name: values.party_name,
            kind: values.kind,
            is_active: values.is_active,
          })
          .eq("party_uuid", party.party_uuid)
          .select()
          .single();
        if (error) throw error;
        onUpdated(data as Party);
        toast.success("Party saved");
      } else {
        const { data, error } = await supabase
          .from("party")
          .insert({
            party_code: values.party_code ?? null,
            party_name: values.party_name,
            kind: values.kind,
            is_active: values.is_active,
          })
          .select()
          .single();
        if (error) throw error;
        onCreated(data as Party);
        toast.success("Party created", { description: values.party_name });
      }
      onOpenChange(false);
    } catch (e) {
      const message = (e as { message?: string })?.message ?? String(e);
      toast.error("Save failed", { description: message });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{party ? "Edit party" : "Create party"}</DialogTitle>
          <DialogDescription>
            Manage basic info and related contacts, bank & tax details.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="contacts" disabled={!party}>
              Contacts
            </TabsTrigger>
            <TabsTrigger value="bank" disabled={!party}>
              Bank
            </TabsTrigger>
            <TabsTrigger value="tax" disabled={!party}>
              Tax
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="party_code">Code</Label>
                  <Input
                    id="party_code"
                    placeholder="Optional"
                    {...form.register("party_code")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kind">Kind</Label>
                  <Select
                    value={form.watch("kind") ?? "CUSTOMER"}
                    onValueChange={(v) =>
                      form.setValue("kind", v as PartyKind, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="kind">
                      <SelectValue placeholder="Select kind" />
                    </SelectTrigger>
                    <SelectContent>
                      {(PARTY_KINDS as readonly string[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="party_name">Name</Label>
                  <Input
                    id="party_name"
                    placeholder="Company / person name"
                    {...form.register("party_name")}
                  />
                  {form.formState.errors.party_name && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.party_name.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch
                    id="is_active"
                    checked={form.watch("is_active") ?? true}
                    onCheckedChange={(v) => form.setValue("is_active", v)}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button type="submit">
                  {party ? "Save changes" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="contacts">
            {party && <ContactsTab partyUuid={party.party_uuid} />}
          </TabsContent>
          <TabsContent value="bank">
            {party && <BankTab partyUuid={party.party_uuid} />}
          </TabsContent>
          <TabsContent value="tax">
            {party && <TaxTab partyUuid={party.party_uuid} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
