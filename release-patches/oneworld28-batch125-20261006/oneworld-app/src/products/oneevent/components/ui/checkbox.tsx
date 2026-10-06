import * as React from "react";
import { cn } from "@evt/lib/utils";
export interface CheckboxProps {
  checked?: boolean; onCheckedChange?: (v: boolean) => void; disabled?: boolean; className?: string; id?: string;
}
export function Checkbox({ checked = false, onCheckedChange, disabled, className, id }: CheckboxProps) {
  return (
    <button type="button" role="checkbox" id={id} aria-checked={checked} disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn("grid h-5 w-5 place-items-center rounded-[6px] border transition disabled:opacity-40", checked ? "bg-teal border-teal text-white" : "border-ink/25 dark:border-white/25", className)}>
      {checked && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
    </button>
  );
}
export default Checkbox;
