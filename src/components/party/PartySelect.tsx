"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Party, PartyKind } from "./types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PartyRowLite = Pick<
  Party,
  "party_uuid" | "party_code" | "party_name" | "kind" | "is_active"
>;

type FetchParams = {
  search: string;
  page: number;
  pageSize: number;
  filterKind?: PartyKind | "ALL";
  activeOnly?: boolean;
};

type PartySelectProps = {
  /** Controlled value: selected party_uuid or null */
  value: string | null;
  /** onChange: receives party_uuid or null when cleared */
  onChange: (next: string | null, selected?: PartyRowLite | null) => void;
  /** Optional filter by kind */
  kindFilter?: PartyKind | "ALL";
  /** Only show active parties (default true) */
  activeOnly?: boolean;
  /** Custom placeholder text */
  placeholder?: string;
  /** Disable the input */
  disabled?: boolean;
  /** Page size for fetching (default 20) */
  pageSize?: number;
  /** Show code next to the name (default true) */
  showCode?: boolean;
  /** ClassName for the trigger button */
  className?: string;
};

export default function PartySelect({
  value,
  onChange,
  kindFilter = "ALL",
  activeOnly = true,
  placeholder = "Select a party…",
  disabled,
  pageSize = 20,
  showCode = true,
  className,
}: PartySelectProps) {
  const supabase = useMemo(() => createClient(), []);

  // UI state
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<PartyRowLite[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<PartyRowLite | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Debounce search input
  const debouncedQuery = useDebounce(query, 250);

  // Load page of results
  const fetchParties = useCallback(
    async ({ search, page, pageSize, filterKind, activeOnly }: FetchParams) => {
      setLoading(true);

      // base query
      let q = supabase
        .from("party")
        .select("party_uuid, party_code, party_name, kind, is_active")
        .order("updated_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (activeOnly) q = q.eq("is_active", true);

      if (filterKind && filterKind !== "ALL") {
        q = q.eq("kind", filterKind);
      }

      if (search.trim()) {
        q = q.or(
          `party_name.ilike.%${search.trim()}%,party_code.ilike.%${search.trim()}%`
        );
      }

      const { data, error } = await q;
      setLoading(false);

      if (error) {
        // Non-fatal: just stop pagination
        setHasMore(false);
        return [];
      }

      const list = (data ?? []) as PartyRowLite[];
      if (list.length < pageSize) setHasMore(false);
      return list;
    },
    [supabase]
  );

  // Handle search or filter change: reset list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPage(0);
      setHasMore(true);
      const list = await fetchParties({
        search: debouncedQuery,
        page: 0,
        pageSize,
        filterKind: kindFilter,
        activeOnly,
      });
      if (!cancelled) setItems(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, kindFilter, activeOnly, fetchParties, pageSize]);

  // Load more
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    const list = await fetchParties({
      search: debouncedQuery,
      page: nextPage,
      pageSize,
      filterKind: kindFilter,
      activeOnly,
    });
    setItems((prev) => [...prev, ...list]);
    setPage(nextPage);
  }, [
    loading,
    hasMore,
    page,
    fetchParties,
    debouncedQuery,
    pageSize,
    kindFilter,
    activeOnly,
  ]);

  // Auto-load label for the controlled value if not in list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!value) {
        setSelected(null);
        return;
      }
      // If we already have it in items, pick that
      const cached = items.find((x) => x.party_uuid === value);
      if (cached) {
        setSelected(cached);
        return;
      }
      // Otherwise fetch just this one
      const { data, error } = await supabase
        .from("party")
        .select("party_uuid, party_code, party_name, kind, is_active")
        .eq("party_uuid", value)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setSelected(null);
      } else {
        setSelected((data as PartyRowLite) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, items, supabase]);

  const handleSelect = useCallback(
    (row: PartyRowLite | null) => {
      setSelected(row);
      onChange(row?.party_uuid ?? null, row);
      setOpen(false);
    },
    [onChange]
  );

  // Infinite-scroll inside CommandList
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
      if (nearBottom) void loadMore();
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  const triggerLabel = selected ? (
    <div className="flex items-center gap-2">
      <span className="truncate max-w-[200px]">{selected.party_name}</span>
      {showCode && selected.party_code && (
        <Badge variant="secondary" className="font-mono">
          {selected.party_code}
        </Badge>
      )}
      <Badge className="uppercase">{selected.kind}</Badge>
    </div>
  ) : (
    <span className="text-muted-foreground">{placeholder}</span>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {triggerLabel}
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[360px]">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={(v) => setQuery(v)}
            placeholder="Search by name or code…"
          />
          <CommandList ref={listRef} className="max-h-72 overflow-auto">
            <CommandEmpty>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading…</span>
                </div>
              ) : (
                "No party found."
              )}
            </CommandEmpty>

            {items.length > 0 && (
              <CommandGroup
                heading={kindFilter === "ALL" ? "All kinds" : kindFilter}
              >
                {items.map((p) => {
                  const isSelected = p.party_uuid === selected?.party_uuid;
                  return (
                    <CommandItem
                      key={p.party_uuid}
                      value={p.party_uuid}
                      onSelect={() => handleSelect(p)}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate">{p.party_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {p.party_code && (
                            <span className="font-mono">{p.party_code}</span>
                          )}
                          <span className="uppercase">{p.kind}</span>
                          {!p.is_active && <span>(inactive)</span>}
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__clear__"
                onSelect={() => handleSelect(null)}
                className="text-destructive"
              >
                Clear selection
              </CommandItem>
              {hasMore && (
                <CommandItem
                  value="__load_more__"
                  onSelect={() => void loadMore()}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </span>
                  ) : (
                    "Load more"
                  )}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Small debounce hook to avoid spamming queries */
function useDebounce<T>(value: T, delay = 250): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
