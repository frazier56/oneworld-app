import * as React from "react";
import { cn } from "@evt/lib/utils";

type Variant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type Size = "default" | "sm" | "lg" | "icon";

/* TEAL SWEEP: teal is the family STATE colour; the action button wears the brand (orange)
   ramp — same job as the shell's .btn-primary. */
const VAR: Record<Variant, string> = {
  default: "bg-brand text-white hover:bg-brand-dark",
  destructive: "bg-red-500 text-white hover:bg-red-600",
  outline: "border border-ink/15 dark:border-white/15 hover:bg-brand/10",
  secondary: "bg-ink/5 dark:bg-white/10 hover:bg-ink/10",
  ghost: "hover:bg-brand/10",
  link: "text-brand underline-offset-4 hover:underline",
};
const SIZ: Record<Size, string> = {
  default: "h-10 px-4 py-2", sm: "h-9 px-3 text-sm", lg: "h-11 px-6", icon: "h-10 w-10",
};

export function buttonVariants({ variant = "default", size = "default", className = "" }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none", VAR[variant], SIZ[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; asChild?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => (
    <button ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
  )
);
Button.displayName = "Button";
export default Button;
