import * as React from "react";
import { cn } from "@evt/lib/utils";
type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const C = React.createContext<Ctx>({ open: false, setOpen: () => {} });
export function Popover({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(false);
  const isOpen = open !== undefined ? open : internal;
  const setOpen = (v: boolean) => { if (open === undefined) setInternal(v); onOpenChange?.(v); };
  return <C.Provider value={{ open: isOpen, setOpen }}><div className="relative inline-block">{children}</div></C.Provider>;
}
export function PopoverTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { open, setOpen } = React.useContext(C);
  if (asChild && React.isValidElement(children))
    return React.cloneElement(children as any, { onClick: (e: any) => { (children as any).props.onClick?.(e); setOpen(!open); } });
  return <button type="button" onClick={() => setOpen(!open)}>{children}</button>;
}
export function PopoverContent({ className, align = "center", children }: { className?: string; align?: "start" | "center" | "end"; children: React.ReactNode }) {
  const { open, setOpen } = React.useContext(C);
  if (!open) return null;
  const al = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <>
      <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
      <div className={cn("glass-modal absolute z-[111] mt-2 min-w-[12rem] rounded-2xl p-2 shadow-2xl", al, className)}>{children}</div>
    </>
  );
}
export default Popover;
