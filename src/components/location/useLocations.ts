"use client";

import { useCallback, useState } from "react";
import type { LocationRow, LocationInput } from "./types";
import {
  listLocations,
  insertLocation,
  updateLocation,
  removeLocation,
} from "./locationRepo";

type ListOpts = { search?: string; activeOnly?: boolean };
type NewLocation = Omit<LocationInput, "location_uuid">;
type UpdatePayload = Pick<
  LocationInput,
  "location_uuid" | "location_code" | "location_name" | "is_active"
>;

export function useLocations() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (opts?: ListOpts) => {
    try {
      setLoading(true);
      setError(null);
      const { rows, total } = await listLocations(opts);
      setRows(rows);
      setTotal(total);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createOne = useCallback(async (payload: NewLocation) => {
    const row = await insertLocation(payload);
    setRows((prev) => [row, ...prev]);
    setTotal((t) => t + 1);
    return row;
  }, []);

  const updateOne = useCallback(async (payload: UpdatePayload) => {
    const row = await updateLocation(payload);
    setRows((prev) =>
      prev.map((r) => (r.location_uuid === row.location_uuid ? row : r))
    );
    return row;
  }, []);

  const removeOne = useCallback(async (uuid: string) => {
    await removeLocation(uuid);
    setRows((prev) => prev.filter((r) => r.location_uuid !== uuid));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  return {
    rows,
    total,
    loading,
    error,
    fetchAll,
    createOne,
    updateOne,
    removeOne,
  };
}
