import { PostgrestError } from "@supabase/supabase-js";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// If you use the official type:
export function isPostgrestError(e: unknown): e is PostgrestError {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as PostgrestError).message === "string"
  );
}
