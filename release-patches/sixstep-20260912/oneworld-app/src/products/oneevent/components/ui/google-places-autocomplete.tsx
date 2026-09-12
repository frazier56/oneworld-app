import * as React from "react";
import { cn } from "@evt/lib/utils";
// Simplified location input (no Google Maps dependency): free-text entry that
// emits onChange/onSelect. Keeps ported forms functional; can be upgraded to a
// real Places widget later.
export interface GooglePlacesAutocompleteProps {
  value?: string; onChange?: (v: string) => void; onSelect?: (v: string) => void;
  placeholder?: string; className?: string; error?: any; id?: string;
  /** Places API type filter — accepted for compat; the lightweight input does not restrict. */
  types?: string[];
}
export function GooglePlacesAutocomplete({ value = "", onChange, onSelect, placeholder = "Address or city", className, error }: GooglePlacesAutocompleteProps) {
  return (
    <input value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={(e) => onSelect?.(e.target.value)}
      placeholder={placeholder}
      className={cn("w-full rounded-xl border bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal/40 dark:bg-white/5", error ? "border-red-400" : "border-ink/10 dark:border-white/15", className)} />
  );
}
export default GooglePlacesAutocomplete;
