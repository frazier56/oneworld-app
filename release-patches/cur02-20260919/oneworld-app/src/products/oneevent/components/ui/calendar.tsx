import * as React from "react";
import { cn } from "@evt/lib/utils";
// Minimal month-grid calendar matching the react-day-picker single-select API
// used by the ported event code: <Calendar mode="single" selected={Date}
// onSelect={(d)=>...} disabled={(d)=>bool} />
export interface CalendarProps {
  mode?: "single";
  selected?: Date;
  onSelect?: (d: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
  /** BCP-47 locale used for month and weekday labels. Defaults to English. */
  locale?: string;
  /** radix compat — accepted, focus handling is native here */
  initialFocus?: boolean;
}
export function Calendar({ selected, onSelect, disabled, className, locale = "en" }: CalendarProps) {
  const init = selected || new Date();
  const [view, setView] = React.useState({ y: init.getFullYear(), m: init.getMonth() });
  const first = new Date(view.y, view.m, 1);
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= new Date(view.y, view.m + 1, 0).getDate(); d++) cells.push(new Date(view.y, view.m, d));
  const wk = [...Array(7)].map((_, i) => new Date(2023, 0, i + 1).toLocaleDateString(locale, { weekday: "narrow" }));
  const same = (a: Date, b?: Date) => b && a.toDateString() === b.toDateString();
  return (
    <div className={cn("p-2 w-[280px]", className)}>
      <div className="mb-2 flex items-center justify-between px-1">
        <button type="button" onClick={() => setView(v => ({ y: v.m === 0 ? v.y - 1 : v.y, m: v.m === 0 ? 11 : v.m - 1 }))} className="grid h-8 w-8 place-items-center rounded-full text-teal hover:bg-teal/10">‹</button>
        <p className="font-bold">{new Date(view.y, view.m, 1).toLocaleDateString(locale, { month: "long", year: "numeric" })}</p>
        <button type="button" onClick={() => setView(v => ({ y: v.m === 11 ? v.y + 1 : v.y, m: v.m === 11 ? 0 : v.m + 1 }))} className="grid h-8 w-8 place-items-center rounded-full text-teal hover:bg-teal/10">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {wk.map((w, i) => <span key={i} className="py-1 text-[10px] font-bold uppercase opacity-40">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const dis = disabled?.(d);
          const sel = same(d, selected);
          return (
            <button key={i} type="button" disabled={dis} onClick={() => onSelect?.(d)}
              className={cn("grid aspect-square place-items-center rounded-full text-sm font-semibold transition", sel ? "bg-teal text-white" : dis ? "opacity-25" : "hover:bg-teal/10")}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default Calendar;
