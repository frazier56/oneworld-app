import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import VaiaFace from "./VaiaFace";
import { useI18n } from "../lib/i18n";

/**
 * SCREEN HEADING — the screen's title and the VAIA pill, on ONE row, on every screen.
 * ============================================================================================
 * Lee, 10 Aug 2026: *"The screen title and VAIA have to be on the same row, aligned, on every
 * screen of every app."*
 *
 * WHY THIS IS A SHELL COMPONENT AND NOT A PER-SCREEN LAYOUT.
 * `AppShell` used to render the VAIA pill as its own full-width right-aligned row, and then each
 * screen rendered its own `<h1>` underneath. Two rows, and — because every screen chose its own
 * heading size, weight and margin — two rows that lined up differently on every screen. Lee's
 * screenshots caught "My jobs" and "Profile" both sitting wrong against the pill.
 *
 * Fixing that screen by screen would hold for about a week: the next screen anyone writes picks
 * its own `<h1>` again and the drift is back. So the ROW lives here, once. A screen no longer
 * decides where its title sits or how it relates to the pill — it only says what the title is.
 *
 * HOW THE PILL MOVES WITHOUT THE SHELL AND THE SCREEN FIGHTING OVER IT.
 * `AppShell` still renders the standalone pill for any screen that has no heading (a detail view,
 * a wizard) — otherwise those screens would silently lose VAIA. When a `ScreenHeading` mounts it
 * CLAIMS the pill through the context below, and `AppShell` stands its own row down.
 *
 * The claim runs in `useLayoutEffect`, not `useEffect`, on purpose: layout effects flush
 * synchronously before paint, so the shell's row is stood down in the same commit the heading
 * mounts in. With a passive effect the pill would paint in the wrong place for one frame on
 * every navigation — a visible twitch on every screen change, which is worse than the
 * misalignment we set out to fix.
 */

type VaiaSlotApi = { claim: () => () => void };
const VaiaSlot = createContext<VaiaSlotApi | null>(null);

/** Used by AppShell. Returns the api to provide, and whether it should still render its own row. */
export function useVaiaSlotProvider() {
  const [claims, setClaims] = useState(0);
  const api = useMemo<VaiaSlotApi>(() => ({
    claim() {
      setClaims(c => c + 1);
      return () => setClaims(c => c - 1);
    },
  }), []);
  return { api, Provider: VaiaSlot.Provider, standalone: claims === 0 };
}

/**
 * The pill itself. Tapping it opens the Ask-VAIA assistant (dispatched as an event the product's
 * assistant listens for). Identical on all apps; only the hue behind it changes.
 */
export function VaiaPill({ compactOnNarrow = false }: { compactOnNarrow?: boolean }) {
  const { t } = useI18n();
  return (
    <button aria-label={t("vaiaInsightsAria")}
      onClick={() => window.dispatchEvent(new Event("ow-vaia-open"))}
      className="ow-tap flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-l from-brand/25 via-brand/10 to-transparent py-1 pl-3 pr-1 transition active:scale-95">
      <span className={`${compactOnNarrow ? "hidden" : ""} whitespace-nowrap text-xs font-medium text-ink/55 dark:text-white/60`}>
        {t("vaiaInsights")}
      </span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brand">
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
        <path d="M19 14l.6 1.6L21.5 16.5l-1.9.7L19 19l-.6-1.8L16.5 16.5l1.9-.9z" />
      </svg>
      <span className={compactOnNarrow ? "hidden" : "inline-flex"}>
        <VaiaFace size={32} />
      </span>
    </button>
  );
}

/**
 * A screen's title. Renders the title on the LEFT and the VAIA pill on the RIGHT, in one row.
 *
 *     <ScreenHeading>My jobs</ScreenHeading>
 *     <ScreenHeading icon={<IconToolbox size={24} />}>{t("myJobs")}</ScreenHeading>
 *
 * `items-center`, not `items-baseline`: the pill is a 34px control and the title is text, so
 * baseline alignment drops the pill visually low against a 24px heading. Centring the two on
 * the row is what actually reads as "aligned" — which is what Lee asked for, and it is stable
 * across every title length and every language, including the ones that wrap.
 */
export default function ScreenHeading({
  children, icon, right, className = "", titlePriority = false,
}: {
  children: React.ReactNode;
  /** Optional leading glyph, e.g. OneJob's toolbox on My jobs. */
  icon?: React.ReactNode;
  /** A screen-specific control that belongs beside the pill (rare). */
  right?: React.ReactNode;
  className?: string;
  /** Keeps an action screen's full title readable by compacting VAIA on narrow phones. */
  titlePriority?: boolean;
}) {
  const slot = useContext(VaiaSlot);
  useLayoutEffect(() => slot?.claim(), [slot]);

  return (
    <div className={`mb-3 flex items-center justify-between gap-3 ${className}`}>
      {/* ── THE TITLE SHRINKS BEFORE IT TRUNCATES ──────────────────────────────────────────
          Lee, 11 Aug 2026, on OneHome's create screen: *"the header where it says List a place is
          actually cut off… it's running into where it says Tap for insights."* His screenshot shows
          `List a pl…` at 390px.

          The proximate cause was a doubled page container in OneHome (fixed in those screens), but
          the heading itself had no defence: a fixed 24px title beside a fixed-width pill either
          fits or loses characters, and `truncate` makes losing characters the SILENT outcome. That
          is the wrong failure — a shortened word is unreadable, a slightly smaller word is not.

          `clamp` makes the size responsive to the viewport instead: 24px wherever there is room,
          scaling to 19px on the narrowest phones, which buys roughly four characters at no visual
          cost. This is a shell fix on purpose — every screen in every app inherits it, so the next
          long title in Spanish or German cannot reintroduce the bug one screen at a time.

          `truncate` stays as the final backstop for a genuinely absurd title. It should now never
          be reached in any language we ship. */}
      <h1 className={`flex min-w-0 items-center gap-2.5 text-[clamp(19px,5.4vw,24px)] font-extrabold leading-tight ${titlePriority ? "flex-1" : ""}`}>
        {icon}
        <span className={titlePriority ? "min-w-0 whitespace-normal break-words" : "truncate"}>{children}</span>
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <VaiaPill compactOnNarrow={titlePriority} />
      </div>
    </div>
  );
}
