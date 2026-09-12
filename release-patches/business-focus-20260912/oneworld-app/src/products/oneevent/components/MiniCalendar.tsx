import { useMemo } from "react";
export default function MiniCalendar({ jobDays = [], eventDays = [] }: { jobDays?: number[]; eventDays?: number[] }) {
  const now = new Date();
  const { cells, today } = useMemo(() => {
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    return { cells, today: now.getDate() };
  }, []);
  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-0.5 text-center text-[8px] font-bold uppercase opacity-40">
        {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5 text-center text-[10px]">
        {cells.map((d, i) => (
          <span key={i} className={`relative grid h-5 place-items-center rounded ${d === today ? "bg-teal font-bold text-white" : ""}`}>
            {d ?? ""}
            {d && (jobDays.includes(d) || eventDays.includes(d)) && (
              <span className={`absolute bottom-0 h-1 w-1 rounded-full ${jobDays.includes(d) ? "bg-teal" : "bg-amber-400"} ${d === today ? "bg-white" : ""}`} />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
