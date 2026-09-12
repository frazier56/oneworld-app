import * as React from "react";
import { cn } from "@evt/lib/utils";
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("block text-sm font-medium mb-1.5 opacity-80", className)} {...props} />
  )
);
Label.displayName = "Label";
export default Label;
