import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@evt/lib/utils";

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const C = React.createContext<Ctx>({ open: false, setOpen: () => {} });

export function AlertDialog({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(false);
  const isOpen = open !== undefined ? open : internal;
  const setOpen = (v: boolean) => { if (open === undefined) setInternal(v); onOpenChange?.(v); };
  return <C.Provider value={{ open: isOpen, setOpen }}>{children}</C.Provider>;
}
export function AlertDialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { setOpen } = React.useContext(C);
  if (asChild && React.isValidElement(children))
    return React.cloneElement(children as any, { onClick: (e: any) => { (children as any).props.onClick?.(e); setOpen(true); } });
  return <button type="button" onClick={() => setOpen(true)}>{children}</button>;
}
export function AlertDialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open, setOpen } = React.useContext(C);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className={cn("glass-modal relative z-10 w-full max-w-md rounded-3xl p-5 shadow-2xl", className)}>{children}</div>
    </div>,
    document.body
  );
}
export const AlertDialogHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("mb-3", className)} {...p} />;
export const AlertDialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("mt-4 flex flex-wrap justify-end gap-2", className)} {...p} />;
export const AlertDialogTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className={cn("text-lg font-bold", className)} {...p} />;
export const AlertDialogDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn("text-sm opacity-65", className)} {...p} />;
export function AlertDialogAction({ className, onClick, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = React.useContext(C);
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white active:scale-[.98]", className)} onClick={(e) => { onClick?.(e); setOpen(false); }} {...p}>{children}</button>;
}
export function AlertDialogCancel({ className, onClick, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = React.useContext(C);
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl border border-ink/15 px-4 py-2.5 font-semibold dark:border-white/15", className)} onClick={(e) => { onClick?.(e); setOpen(false); }} {...p}>{children}</button>;
}
export default AlertDialog;
