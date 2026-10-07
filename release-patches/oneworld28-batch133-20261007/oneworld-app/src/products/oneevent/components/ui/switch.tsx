import * as React from "react";
import { cn } from "@evt/lib/utils";
export interface SwitchProps {
  checked?: boolean; onCheckedChange?: (v: boolean) => void; disabled?: boolean; className?: string; id?: string;
}
export function Switch({ checked = false, onCheckedChange, disabled, className, id }: SwitchProps) {
  return (
    <button type="button" role="switch" id={id} aria-checked={checked} disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-40", checked ? "bg-teal" : "bg-ink/20 dark:bg-white/20", className)}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
export default Switch;
