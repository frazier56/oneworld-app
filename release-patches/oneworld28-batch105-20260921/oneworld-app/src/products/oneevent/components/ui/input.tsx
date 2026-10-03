import * as React from "react";
import { cn } from "@evt/lib/utils";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("w-full rounded-xl border border-ink/25 bg-ink/[0.025] px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal/50 dark:bg-white/5 dark:border-white/20 placeholder:opacity-40", className)} {...props} />
  )
);
Input.displayName = "Input";
export default Input;
