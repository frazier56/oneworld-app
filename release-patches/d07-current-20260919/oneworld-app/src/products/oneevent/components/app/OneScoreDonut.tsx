/* Ported call sites pass label/class props from the old rich donut; accepted and unused here —
   the number IS the label at these sizes, and tier colouring is the shell donut's job on the
   profile. This stays the lightweight inline-score dot for event cards. */
export default function OneScoreDonut({ score = 0, size = 56, strokeWidth = 4 }: {
  score?: number; size?: number; strokeWidth?: number;
  label?: string; wholeClassName?: string; decimalClassName?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "#14B8A6" : pct >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="opacity-15" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <span className="absolute font-bold" style={{ fontSize: size * 0.3 }}>{Math.round(pct)}</span>
    </div>
  );
}
