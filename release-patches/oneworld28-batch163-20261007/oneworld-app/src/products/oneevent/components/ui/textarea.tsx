import * as React from "react";
import { cn } from "@evt/lib/utils";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn("w-full rounded-xl border border-ink/25 bg-ink/[0.025] px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal/50 dark:bg-white/5 dark:border-white/20 placeholder:opacity-40", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";
export default Textarea;
