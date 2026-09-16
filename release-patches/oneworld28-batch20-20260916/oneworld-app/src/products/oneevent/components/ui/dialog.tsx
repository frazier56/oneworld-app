import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@evt/lib/utils";

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const DialogCtx = React.createContext<Ctx>({ open: false, setOpen: () => {} });

export function Dialog({ open, defaultOpen, onOpenChange, children }: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(!!defaultOpen);
  const isOpen = open !== undefined ? open : internal;
  const setOpen = (v: boolean) => { if (open === undefined) setInternal(v); onOpenChange?.(v); };
  return <DialogCtx.Provider value={{ open: isOpen, setOpen }}>{children}</DialogCtx.Provider>;
}
export function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { setOpen } = React.useContext(DialogCtx);
  if (asChild && React.isValidElement(children))
    return React.cloneElement(children as any, { onClick: (e: any) => { (children as any).props.onClick?.(e); setOpen(true); } });
  return <button type="button" onClick={() => setOpen(true)}>{children}</button>;
}
export function DialogContent({ className, children, closeLabel = "Close" }: {
  className?: string; children: React.ReactNode; closeLabel?: string;
  /* radix compat — the lightweight dialog ignores focus/outside-press hooks */
  onOpenAutoFocus?: (e?: Event) => void; onEscapeKeyDown?: (e?: Event) => void; onPointerDownOutside?: (e?: Event) => void;
}) {
  const { open, setOpen } = React.useContext(DialogCtx);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className={cn("glass-modal relative z-10 w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl p-5 shadow-2xl", className)}>
        <button onClick={() => setOpen(false)} aria-label={closeLabel} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-lg opacity-60 hover:bg-ink/10 dark:hover:bg-white/10">×</button>
        {children}
      </div>
    </div>,
    document.body
  );
}
export const DialogHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("mb-3 pr-6", className)} {...p} />;
export const DialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("mt-4 flex flex-wrap justify-end gap-2", className)} {...p} />;
export const DialogTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className={cn("text-lg font-bold", className)} {...p} />;
export const DialogDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn("text-sm opacity-65", className)} {...p} />;
export default Dialog;
