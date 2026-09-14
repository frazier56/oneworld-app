import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@evt/lib/utils";
type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const C = React.createContext<Ctx>({ open: false, setOpen: () => {} });
export function Sheet({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(false);
  const isOpen = open !== undefined ? open : internal;
  const setOpen = (v: boolean) => { if (open === undefined) setInternal(v); onOpenChange?.(v); };
  return <C.Provider value={{ open: isOpen, setOpen }}>{children}</C.Provider>;
}
export function SheetTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { setOpen } = React.useContext(C);
  if (asChild && React.isValidElement(children))
    return React.cloneElement(children as any, { onClick: (e: any) => { (children as any).props.onClick?.(e); setOpen(true); } });
  return <button type="button" onClick={() => setOpen(true)}>{children}</button>;
}
export function SheetContent({ side = "right", className, children }: { side?: "right" | "left" | "bottom" | "top"; className?: string; children: React.ReactNode }) {
  const { open, setOpen } = React.useContext(C);
  if (!open) return null;
  const pos = side === "right" ? "right-0 top-0 h-full w-[92vw] max-w-md" : side === "left" ? "left-0 top-0 h-full w-[92vw] max-w-md" : side === "bottom" ? "bottom-0 inset-x-0 max-h-[88vh] rounded-t-3xl" : "top-0 inset-x-0 max-h-[88vh] rounded-b-3xl";
  return createPortal(
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className={cn("glass-modal absolute overflow-y-auto p-5 shadow-2xl", pos, className)}>
        {/* v29 EP (Lee): "that X is critical — it's the only way out of the screen, and I could
            barely see it." 3× the presence: a real 44px tap target on a visible chip. */}
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-border bg-secondary text-2xl font-semibold text-foreground shadow-sm hover:bg-ink/10 dark:hover:bg-white/10">×</button>
        {children}
      </div>
    </div>,
    document.body
  );
}
export const SheetHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("mb-3 pr-6", className)} {...p} />;
export const SheetTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className={cn("text-lg font-bold", className)} {...p} />;
export const SheetDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn("text-sm opacity-65", className)} {...p} />;
export const SheetFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("mt-4 flex gap-2", className)} {...p} />;
export default Sheet;
