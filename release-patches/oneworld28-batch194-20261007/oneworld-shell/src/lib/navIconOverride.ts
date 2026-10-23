/* ── AN ICON THAT FOLLOWS WHO YOU ARE RIGHT NOW ─────────────────────────────────────────────
   Lee, 9 Oct 2026 (OneRide): "if you're the actual driver you get the steering wheel; if you're
   the passenger you get a car … it changes for you until you switch sides." A product swaps one
   registered icon name for another (e.g. "car" → "steering") and every NavIcon drawing that name
   — the raised tab first of all — follows. Both names must exist in NAV_ICONS, so the shared pen
   and the reviewed icon set are untouched. Kept in memory; the product decides and persists the
   mode itself. */
import { useEffect, useState } from "react";

const overrides = new Map<string, string>();
const subs = new Set<() => void>();

export function setNavIconOverride(name: string, replacement: string | null): void {
  if (replacement && replacement !== name) overrides.set(name, replacement); else overrides.delete(name);
  subs.forEach(fn => fn());
}

export function useNavIconName(name: string): string {
  const [, bump] = useState(0);
  useEffect(() => { const fn = () => bump(n => n + 1); subs.add(fn); return () => { subs.delete(fn); }; }, []);
  return overrides.get(name) ?? name;
}
