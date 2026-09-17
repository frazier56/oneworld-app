import type { BadgeTier } from "../lib/badgeTiers";

/**
 * THE ONESCORE DONUT — a shooting star, not a gauge and not a solid band.
 * ============================================================================
 *
 * MOVED INTO THE SHELL, 3 Aug 2026, and the reason is the strongest case in the package.
 *
 * The tier ramps below are PRODUCT-INDEPENDENT by design — Trusted stays violet inside
 * OneSocial, Authority stays gold inside OneScore. By this package's own rule (does it vary by
 * product? no → it is shell code) that makes the donut shell code, and leaving it in one app
 * meant eight independent re-implementations of the single most-corrected feature in the whole
 * project. Each of those eight would be free to divide by `pct` instead of `100` and ship the
 * option Lee explicitly rejected — while looking almost right.
 *
 * One implementation, one test, one chance to get it wrong instead of eight.
 * ============================================================================
 *
 * I got this wrong on 2 Aug 2026 and this comment exists so nobody repeats it.
 *
 * Lee had said the rings and the score are "parallel tracks… they never really depend on
 * each other," so I made the ring a complete 360° band that never moved. He looked at it:
 *
 *   "You've actually overwritten it now, which is sad… the ring is NOT a complete ring. It
 *    depends on the number. It gets darker the further it goes around the circle. It has a
 *    comet effect — like a shooting star, where the front of the star is brighter than the
 *    tail. It kind of tells time. If you're at seventy, the end of it is roughly where
 *    seventy would be on a circular clock."
 *
 * BOTH STATEMENTS ARE TRUE. They are about different properties, and that is the whole rule:
 *
 *   COLOUR FAMILY  ← the BADGE TIER. Activity only. A 96 Member is silver; a 96 Authority is
 *                    gold. The score never changes WHICH colour the ring is. This is the
 *                    "parallel tracks" half — and it is why `compute_badge_tier` and
 *                    badgeTiers.ts carry no OneScore thresholds.
 *   LENGTH + DEPTH ← the ONESCORE. The arc runs from 12 o'clock to wherever the number sits
 *                    on a 0–100 clock, and it deepens as it travels. This is the half I
 *                    deleted.
 *
 * ── Why the mix factor is ABSOLUTE, not relative ────────────────────────────────────────
 *
 * Each segment's colour is mixed at `(p + len) / 100` — its position on the FULL circle —
 * never at its position along this particular arc. That one detail is the whole behaviour
 * Lee asked for, and it is the difference between his two options:
 *
 *   ✔ ABSOLUTE (this): "if somebody has a fifteen, basically you would never see it. You'll
 *     start seeing it come into fruition around maybe thirty to forty. And when you're at a
 *     hundred, you'll see the full deepness of it."  So a 40 tops out at 40% of the way to
 *     full depth — pale the whole way round. Only a 100 reaches the true colour.
 *
 *   ✘ RELATIVE (`/pct`): every score would hit full depth at its own head, so a 20 and a 95
 *     would end equally dark and only differ in length. Lee, on exactly this: "regardless of
 *     what number it is, it's gonna be deep and dark at that number. I don't necessarily
 *     like that effect."
 *
 * So the depth carries information the length alone does not. Dividing by `pct` here would
 * silently ship the option he rejected, and it would look almost right.
 *
 * ── The ramps ───────────────────────────────────────────────────────────────────────────
 *
 * [tail tint, head colour at 100] per tier. PRODUCT-INDEPENDENT and staying that way: the
 * donut sits beside the passport, whose tiers look identical on every One World app. None of
 * these is OneJob green on purpose — a tier ring wearing the host app's voice stops reading
 * as a tier and starts reading as "this app". (GREEN_MIGRATION §3.)
 */
const TIER_RAMP: Record<BadgeTier, [string, string]> = {
  member:    ["#CBD5E1", "#475569"], // slate
  verified:  ["#99F6E4", "#0E9B8E"], // teal
  trusted:   ["#DCC8FB", "#6A2FC0"], // violet — matches the tier METAL, not the app
  authority: ["#FDE68A", "#D97706"], // gold
};

const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  const m = (p: number, q: number) => Math.round(p + (q - p) * t);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
}

export default function ScoreDonut({ score, size = 92, tier = "member" }:
  { score: number | null; size?: number; tier?: BadgeTier }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const stroke = 4;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const intPart = score == null ? "—" : Math.floor(score).toString();
  const dec = score == null ? null : Math.round((score - Math.floor(score)) * 10);
  const [lo, hi] = TIER_RAMP[tier] ?? TIER_RAMP.member;

  /* Drawn as many small solid segments rather than one stroke with an SVG gradient, because
     a linearGradient is a straight sweep across the bounding box — it cannot follow a curve,
     so the "darker as it travels" reading breaks at the 3 and 9 o'clock positions. Two
     percent per segment is below the eye's ability to see a step at these sizes. */
  const SEG = 2;
  const segs: { from: number; len: number; color: string }[] = [];
  for (let p = 0; p < pct; p += SEG) {
    const len = Math.min(SEG, pct - p);
    segs.push({ from: p, len, color: mix(lo, hi, (p + len) / 100) });
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          className="fill-none stroke-ink/10 dark:stroke-white/10" />
        {segs.map((s, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke={s.color}
            strokeLinecap={i === segs.length - 1 ? "round" : "butt"}
            className="fill-none"
            /* a hair of overlap so the segments read as one continuous arc, not a dashed one */
            strokeDasharray={`${(Math.min(s.len + 0.35, 100) / 100) * c} ${c}`}
            strokeDashoffset={-((s.from / 100) * c)} />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-extrabold leading-none" style={{ fontSize: size * 0.26 }}>
          {intPart}
          {dec != null && <sup className="font-bold opacity-70" style={{ fontSize: size * 0.14 }}>.{dec}</sup>}
        </span>
      </div>
    </div>
  );
}
