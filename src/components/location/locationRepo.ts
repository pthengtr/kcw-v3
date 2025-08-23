import { createClient } from "@/lib/supabase/client";
import type { LocationInput, LocationRow } from "./types";

const TABLE = "location";

export async function listLocations(query?: {
  search?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ rows: LocationRow[]; total: number }> {
  const supabase = createClient();
  let req = supabase
    .from(TABLE)
    .select("*", { count: "exact" })
    .order("location_code", { ascending: true });

  if (query?.activeOnly) req = req.eq("is_active", true);

  if (query?.search && query.search.trim()) {
    const s = query.search.trim();
    // ilike on name or code
    req = req.or(`location_name.ilike.%${s}%,location_code.ilike.%${s}%`);
  }

  if (typeof query?.limit === "number") req = req.limit(query.limit);

  if (typeof query?.offset === "number") {
    const start = query.offset;
    const end = start + (query.limit ?? 50) - 1;
    req = req.range(start, end);
  }

  const { data, error, count } = await req;
  if (error) throw error;
  return {
    rows: (data ?? []) as LocationRow[],
    total: count ?? data?.length ?? 0,
  };
}

export async function upsertLocation(
  input: LocationInput
): Promise<LocationRow> {
  const supabase = createClient();
  const payload = {
    location_uuid: input.location_uuid,
    location_code: input.location_code.trim(),
    location_name: input.location_name.trim(),
    is_active: input.is_active,
  };
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "location_uuid" })
    .select()
    .single();

  if (error) throw error;
  return data as LocationRow;
}

export async function insertLocation(
  input: Omit<LocationInput, "location_uuid">
): Promise<LocationRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      location_code: input.location_code.trim(),
      location_name: input.location_name.trim(),
      is_active: input.is_active,
    })
    .select()
    .single();

  if (error) throw error;
  return data as LocationRow;
}

export async function updateLocation(
  input: LocationInput
): Promise<LocationRow> {
  if (!input.location_uuid)
    throw new Error("location_uuid is required for update");

  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      location_code: input.location_code.trim(),
      location_name: input.location_name.trim(),
      is_active: input.is_active,
    })
    .eq("location_uuid", input.location_uuid)
    .select()
    .single();

  if (error) throw error;
  return data as LocationRow;
}

export async function removeLocation(uuid: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("location_uuid", uuid);
  if (error) throw error;
}
