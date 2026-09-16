import Chevron from "./Chevron";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/i18n";
import { pickerCopy, pickerLocale } from "../lib/pickerCopy";
import { IconCalendar } from "./ActionIcons";

/** Glass date + time pickers (Lee, Jul 11): the native OS dialogs are black/archaic
 *  and ignore our brand — these match the drawer/modal canon instead.
 *
 *  ── PROMOTED FROM ONEJOB, 11 Aug 2026 ─────────────────────────────────────────────────────
 *  This lived in `products/onejob/components/Pickers.tsx` for a month while OneHome shipped a
 *  native `<input type="date">`. Lee, 11 Aug: *"You see a black calendar in one of these
 *  pictures, and that's an old school calendar, and that's not the calendar we use… these are
 *  brother and sister apps, and they should be using the same code whenever possible."*
 *
 *  So it MOVED here rather than being copied. OneJob now imports it back from the shell, which
 *  is the only arrangement where the two apps cannot drift: there is one file, and a fix to it
 *  is a fix everywhere. A copy would have been the same bug again in three weeks.
 *
 *  Two things changed on the way across, both because the shell serves six products:
 *    · the hard-coded `#0FB5A6` chevron became `var(--brand-deep)`, so the picker takes the
 *      HOST product's hue instead of painting OneJob's teal into OneHome.
 *    · `GlassDate` gained `min` / `max`. It used to hard-floor at today, which is correct for a
 *      job and wrong for a listing's "available from" or anyone's date of birth. Omit `min` to
 *      keep the old today-floor; pass `min=""` to unlock the past. */

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 px-6" onClick={onClose}>
      <div className="glass-modal w-full max-w-[320px] rounded-3xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function GlassDate({ value, onChange, invalid, min, max }:
  { value: string; onChange: (v: string) => void; invalid?: boolean; min?: string; max?: string }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = value ? new Date(value + "T00:00") : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const locale = pickerLocale(lang);
  /* `min` defaults to today, which is right for a job that has not happened yet — but a listing's
     "available from" can legitimately be in the past, and a birthday always is. Pass min="" to
     unlock the whole calendar. (OneHome, 11 Aug 2026.) */
  const floor = min === undefined ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()
              : min ? new Date(min + "T00:00") : null;
  const ceil = max ? new Date(max + "T00:00") : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const days: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= new Date(view.y, view.m + 1, 0).getDate(); d++) days.push(new Date(view.y, view.m, d));
    return days;
  }, [view]);

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const label = value
    ? new Date(value + "T00:00").toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : pickerCopy(lang).date;
  const wk = [...Array(7)].map((_, i) => new Date(2023, 0, i + 1).toLocaleDateString(locale, { weekday: "narrow" }));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`input flex items-center justify-between text-left ${value ? "" : "opacity-50"}${invalid ? " !border-red-400 ring-2 ring-red-300/50" : ""}`}>
        <span className="inline-flex items-center gap-1.5"><IconCalendar size={14} className="opacity-70" />{label}</span><Chevron color="var(--brand-deep)" />
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <div className="mb-2 flex items-center justify-between px-1">
            <button type="button" aria-label={pickerCopy(lang).previousMonth} onClick={() => setView(v => ({ y: v.m === 0 ? v.y - 1 : v.y, m: v.m === 0 ? 11 : v.m - 1 }))}
              className="grid h-9 w-9 place-items-center rounded-full text-lg text-brand hover:bg-brand/10">‹</button>
            <p className="font-bold capitalize">{new Date(view.y, view.m, 1).toLocaleDateString(locale, { month: "long", year: "numeric" })}</p>
            <button type="button" aria-label={pickerCopy(lang).nextMonth} onClick={() => setView(v => ({ y: v.m === 11 ? v.y + 1 : v.y, m: v.m === 11 ? 0 : v.m + 1 }))}
              className="grid h-9 w-9 place-items-center rounded-full text-brand hover:bg-brand/10"><Chevron dir="right" size="sm" color="var(--brand-deep)" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {wk.map((w, i) => <span key={i} className="py-1 text-[10px] font-bold uppercase opacity-40">{w}</span>)}
            {grid.map((d, i) => {
              if (!d) return <span key={i} />;
              const past = (floor !== null && d < floor) || (ceil !== null && d > ceil);
              const isSel = value === iso(d);
              const isToday = d.getTime() === today.getTime();
              return (
                <button key={i} type="button" disabled={past}
                  onClick={() => { onChange(iso(d)); setOpen(false); }}
                  className={`grid aspect-square place-items-center rounded-full text-sm font-semibold transition
                    ${isSel ? "bg-brand text-white" : isToday ? "ring-1 ring-brand text-brand" : past ? "opacity-25" : "hover:bg-brand/10"}`}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}

export function GlassTime({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const locale = pickerLocale(lang);
  const slots = useMemo(() => {
    const out: string[] = [];
    for (let m = 6 * 60; m < 24 * 60; m += 15) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    for (let m = 0; m < 6 * 60; m += 15) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    return out;
  }, []);
  const fmt = (hm: string) => {
    const [h, m] = hm.split(":").map(Number);
    return new Date(2023, 0, 1, h, m).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`input flex items-center justify-between text-left ${value ? "" : "opacity-50"}`}>
        <span>🕐 {value ? fmt(value) : pickerCopy(lang).time}</span><Chevron color="var(--brand-deep)" />
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <p className="mb-2 px-1 font-bold">{pickerCopy(lang).time}</p>
          <div className="grid max-h-[45vh] grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {slots.map(s => (
              <button key={s} type="button" onClick={() => { onChange(s); setOpen(false); }}
                className={`rounded-xl px-2 py-2.5 text-sm font-semibold transition ${value === s ? "bg-brand text-white" : "bg-ink/5 hover:bg-brand/10 dark:bg-white/10"}`}>
                {fmt(s)}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

/** OneEvent-style time picker — hour + minute dropdowns and an AM/PM segmented
 *  toggle (ported from OneEvent's CreateEventForm TimePicker, themed to OneJob's
 *  GlassSelect + teal tokens). Value is "HH:MM" 24h. */
export function GlassTimePicker({ value, onChange, defaultTime = "09:00" }: { value: string; onChange: (v: string) => void; defaultTime?: string }) {
  const { lang } = useI18n();
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = ["00", "15", "30", "45"];
  /* The picker SHOWS 09:00 AM when `value` is empty, but the parent state stayed "" — so anything
     derived from the start time (the duration -> end time calculation) sat dead until the user
     nudged AM/PM. What you see must be what the form holds: commit the default on mount.
     (Lee: "it's like it's asleep... it should automatically calculate the end time", Jul 26 2026) */
  useEffect(() => { if (!value) onChange(defaultTime); }, []);
  const parsed = useMemo(() => {
    if (!value) return { h: 9, m: "00", ampm: "AM" };
    const [hh, mm] = value.split(":");
    let h = parseInt(hh); const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12; if (h === 0) h = 12;
    return { h, m: mm || "00", ampm };
  }, [value]);
  const build = (h: number, m: string, ampm: string) => {
    let hour24 = h;
    if (ampm === "PM" && h !== 12) hour24 = h + 12;
    if (ampm === "AM" && h === 12) hour24 = 0;
    onChange(`${String(hour24).padStart(2, "0")}:${m}`);
  };
  // FIX-B (Jul 26 2026): 78px + the .input padding + chevron truncated "00" → "0..". Widen and
  // tighten the padding so the two-digit hour/minute always shows in full.
  const centered = "!w-[92px] shrink-0 !px-2.5 !justify-center text-center font-semibold";
  return (
    <div className="flex items-center gap-1.5">
      <GlassSelect value={String(parsed.h) as any} ariaLabel={pickerCopy(lang).hour}
        onChange={v => build(Number(v), parsed.m, parsed.ampm)}
        options={hours.map(h => ({ value: String(h) as any, label: String(h).padStart(2, "0") }))}
        className={centered} />
      <span className="text-lg font-bold opacity-50">:</span>
      <GlassSelect value={parsed.m as any} ariaLabel={pickerCopy(lang).minute}
        onChange={v => build(parsed.h, v, parsed.ampm)}
        options={minutes.map(m => ({ value: m as any, label: m }))}
        className={centered} />
      <div className="flex overflow-hidden rounded-xl border border-ink/15 dark:border-white/15">
        {["AM", "PM"].map(ap => (
          <button key={ap} type="button" onClick={() => build(parsed.h, parsed.m, ap)}
            className={`min-w-[46px] px-3 py-2.5 text-xs font-bold transition ${parsed.ampm === ap ? "bg-brand text-white" : "bg-ink/5 opacity-70 hover:bg-brand/10 dark:bg-white/10"}`}>
            {ap}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Glass dropdown — replaces native <select> (OS renders those as archaic black
 *  wheels/radio lists on phones). Canon: ALL dropdowns use this. */
export function GlassSelect<T extends string>({ value, options, onChange, ariaLabel, className = "", triggerLabel, searchable }:
  { value: T; options: { value: T; label: ReactNode; disabled?: boolean; search?: string }[]; onChange: (v: T) => void; ariaLabel?: string; className?: string;
    /** v14: show THIS in the closed trigger instead of the selected option's label — lets a
        compact control (a lone flag) open a sheet of fuller rows (flag + dial code). */
    triggerLabel?: ReactNode;
    /** v16 (Lee): long lists (200 country codes) get a filter box at the top of the sheet.
        Each option's `search` string is what the filter matches (name + code + ISO). */
    searchable?: boolean }) {
  const { lang } = useI18n(); const trigger = useRef<HTMLButtonElement>(null); const panel = useRef<HTMLDivElement>(null);
  const close = () => { setOpen(false); setQ(""); trigger.current?.focus(); };
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>("input,button:not([disabled])")?.focus(); }, [open]);
  const sel = options.find(o => o.value === value);
  const shown = searchable && q
    ? options.filter(o => (o.search ?? String(o.label ?? o.value)).toLowerCase().includes(q.toLowerCase()))
    : options;
  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open}
        className={`input flex items-center justify-between gap-1 text-left ${className}`}>
        <span className="truncate">{triggerLabel ?? sel?.label ?? value}</span><Chevron color="var(--brand-deep)" />
      </button>
      {open && (
        <Sheet onClose={close}>
          <div ref={panel} role="dialog" aria-modal="true" aria-label={ariaLabel ?? pickerCopy(lang).choose} onKeyDown={e => {
            if (e.key === "Escape") { e.preventDefault(); close(); }
            if (e.key === "Tab") {
              const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('input,button:not([disabled])') ?? []);
              const first = items[0], last = items[items.length - 1];
              if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
              else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
          }}>
          {ariaLabel && <p className="mb-2 px-1 font-bold">{ariaLabel}</p>}
          {searchable && (
            <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder={pickerCopy(lang).search} aria-label={pickerCopy(lang).searchOptions}
              className="input mb-2 w-full text-sm" />
          )}
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {shown.length === 0 && <p role="status" className="px-3 py-2.5 text-sm opacity-70">{pickerCopy(lang).empty}</p>}
            {shown.map(o => (
              <button key={o.value} type="button" disabled={o.disabled}
                onClick={() => { onChange(o.value); close(); }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${o.value === value ? "bg-brand text-white" : o.disabled ? "opacity-35" : "hover:bg-brand/10"}`}>
                {o.label}{o.value === value && <span>✓</span>}
              </button>
            ))}
          </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
