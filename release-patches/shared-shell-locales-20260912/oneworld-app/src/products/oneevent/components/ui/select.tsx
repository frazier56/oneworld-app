import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@evt/lib/utils";

/** Custom glass Select.
 *  - Pointer events so it fires once per tap on touch (no ghost-click double-tap).
 *  - Label committed SYNCHRONOUSLY on tap so the display never lags "one behind".
 *  - On close, swallows the very next click (capture phase, one-shot) so the tap
 *    that selected an item can't "pass through" the closing sheet and also
 *    activate the button behind it (calendar / toggle). (Lee, Jul 22) */
type Ctx = {
  value?: string;
  commit: (v: string, label: React.ReactNode) => void;
  open: boolean; setOpen: (v: boolean) => void; closeSoft: () => void;
  openedAt: React.MutableRefObject<number>;
  label: React.ReactNode; setLabel: (n: React.ReactNode) => void;
};
const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
const C = React.createContext<Ctx>({ open: false, setOpen: () => {}, closeSoft: () => {}, commit: () => {}, openedAt: { current: 0 }, label: null, setLabel: () => {} });

// Absorb the ghost click that follows a touch, so it can't hit whatever is now
// under the finger after the sheet closes.
function swallowNextClick() {
  const swallow = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
  document.addEventListener("click", swallow, { capture: true, once: true } as any);
  setTimeout(() => document.removeEventListener("click", swallow, { capture: true } as any), 500);
}

export function Select({ value, defaultValue, onValueChange, children }: { value?: string; defaultValue?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(defaultValue);
  const [open, _setOpen] = React.useState(false);
  const [label, setLabel] = React.useState<React.ReactNode>(null);
  const openedAt = React.useRef(0);
  const val = value !== undefined ? value : internal;
  const setOpen = React.useCallback((v: boolean) => { if (v) openedAt.current = now(); _setOpen(v); }, []);
  const closeSoft = React.useCallback(() => { swallowNextClick(); _setOpen(false); }, []);
  const commit = (v: string, node: React.ReactNode) => {
    setLabel(node);
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
    swallowNextClick();
    _setOpen(false);
  };
  return <C.Provider value={{ value: val, commit, open, setOpen, closeSoft, openedAt, label, setLabel }}>{children}</C.Provider>;
}

export function SelectTrigger({ className, children }: { className?: string; children: React.ReactNode }) {
  const { setOpen } = React.useContext(C);
  const act = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); setOpen(true); };
  return (
    <button type="button" onPointerUp={act} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") act(e); }}
      style={{ touchAction: "manipulation" }}
      className={cn("flex w-full items-center justify-between gap-2 rounded-xl border border-ink/25 bg-ink/[0.025] px-4 py-2.5 text-left dark:bg-white/5 dark:border-white/20", className)}>
      {children}<span className="shrink-0 text-teal">▾</span>
    </button>
  );
}
export function SelectValue({ placeholder, displayValue }: { placeholder?: string; displayValue?: React.ReactNode }) {
  const { label, value } = React.useContext(C);
  return <span className="truncate">{displayValue ?? (label || value || <span className="opacity-40">{placeholder}</span>)}</span>;
}
export function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, closeSoft, openedAt } = React.useContext(C);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-6"
      style={{ touchAction: "manipulation" }}
      onPointerUp={() => { if (now() - openedAt.current < 350) return; closeSoft(); }}>
      <div className={cn("glass-modal max-h-[60vh] w-full max-w-[320px] space-y-1 overflow-y-auto rounded-3xl p-3 shadow-2xl", className)}
        onPointerUp={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body
  );
}
export function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(C);
  React.useEffect(() => { if (ctx.value === value) ctx.setLabel(children); }, [ctx.value, value, children]);
  const active = ctx.value === value;
  return (
    <button type="button"
      onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); ctx.commit(value, children); }}
      style={{ touchAction: "manipulation" }}
      className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition", active ? "bg-teal text-white" : "hover:bg-teal/10", className)}>
      {children}{active && <span>✓</span>}
    </button>
  );
}
export const SelectGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SelectLabel = ({ children }: { children: React.ReactNode }) => <p className="px-3 py-1 text-xs font-bold uppercase opacity-40">{children}</p>;
export const SelectSeparator = () => <div className="my-1 h-px bg-ink/10 dark:bg-white/10" />;
export default Select;
