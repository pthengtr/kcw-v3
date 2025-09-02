import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { RefsPayload } from "./types";

export function useProductRefs(open: boolean) {
  const [opts, setOpts] = React.useState<RefsPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!open) return;
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("fn_product_refs");
        if (error) throw error;
        if (!cancelled) {
          setOpts({
            categories: data?.categories ?? [],
            uoms: data?.uoms ?? [],
            taxes: data?.taxes ?? [],
          });
        }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return { opts, loading, error };
}
