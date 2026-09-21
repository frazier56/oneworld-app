import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { W } from "@oneworld/shell";
import type { Lane } from "./lanes";

/**
 * THE FEED'S OWN MAP — R18 note 4.
 * ============================================================================================
 * Lee: *"the map needs rebuilding for this screen, not porting into it. Today it is the existing
 * map dropped into the feed. It should use the whole screen, and it should show whatever lane
 * you came from — houses on Homes, events on Events, jobs on Jobs. We have the whole screen to
 * work with now."*
 *
 * The old one was `ListingMap`, OneHome's own component, which is built to sit inside a
 * scrolling column of listing cards at 62% of the viewport with a card list under it. Dropped into a
 * full-screen feed it left a black band, answered only to homes, and carried a second set of
 * filters nobody had asked it to have. This is the feed's map instead.
 *
 * ── ONE RULE, WHICH IS THE WHOLE DESIGN ────────────────────────────────────────────────────
 * The map shows THE LANE YOU CAME FROM, already filtered by that lane's own search and filters.
 * There is no map filter, no map search and no map sort, because the lane behind it has all
 * three and a second copy of them is a second answer to the same question. Swiping sideways
 * changes the lane; the map follows.
 *
 * ── WHY IT DRAWS ITS OWN CANVAS ─────────────────────────────────────────────────────────────
 * No tiles, and that is deliberate rather than a shortcut. A tile map at this size is a network
 * dependency, an API key and a third-party script on the first screen of the product, for a set
 * of pins that are all within one city. What a member needs here is WHERE THESE ARE RELATIVE TO
 * EACH OTHER and which one to open — so the pins are plotted on the feed's own dark canvas, in
 * the lane's own colour, at their true relative positions, with the spread normalised so a
 * cluster fills the screen instead of huddling in the middle of an empty ocean.
 *
 * When the tile map earns its place — driving directions, a street you must recognise — it goes
 * on the LISTING page, which is where somebody who has chosen one property is standing.
 */

export type LanePin = {
  id: string;
  lat: number;
  lng: number;
  /** What the pin says when it is the selected one. */
  label: string;
  /** The money line, where the record has one. */
  note?: string | null;
  /** The existing screen this opens — never a screen written for the map. */
  href: string;
};

/** Mercator is overkill inside one city; the error over a few kilometres is under a pixel. */
function project(pins: LanePin[], w: number, h: number, pad: number) {
  const lats = pins.map(p => p.lat), lngs = pins.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  /* A single pin, or several at one address, would divide by zero and land in the corner.
     A floor on the span puts them in the middle of the screen instead, which is the honest
     picture: "they are all here". */
  const spanLat = Math.max(maxLat - minLat, 0.004);
  const spanLng = Math.max(maxLng - minLng, 0.004);
  const cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2;
  return pins.map(p => ({
    pin: p,
    x: pad + ((p.lng - (cLng - spanLng / 2)) / spanLng) * (w - pad * 2),
    /* Latitude grows north and screen y grows south. */
    y: pad + (1 - (p.lat - (cLat - spanLat / 2)) / spanLat) * (h - pad * 2),
  }));
}

export default function LaneMap({ lane, pins, lang, onClose, selectedId, onSelect }: {
  lane: Lane;
  pins: LanePin[];
  lang: string;
  onClose: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const nav = useNavigate();
  /* 100 × 100 user units, drawn into whatever box the screen gives it — so one projection serves
     every phone and the pins never need re-measuring on rotate. */
  const placed = useMemo(() => (pins.length ? project(pins, 100, 100, 9) : []), [pins]);
  const chosen = placed.find(p => p.pin.id === selectedId) ?? null;

  return (
    <div data-ow="lane-map" className="absolute inset-0 z-[25] bg-[#0B0F1A]">
      {/* The canvas. Full bleed under the header and the footer, which is the point of the
          rebuild — Lee has the whole screen and the map should use it. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="ow-map-glow" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor={lane.hue} stopOpacity="0.22" />
            <stop offset="100%" stopColor={lane.hue} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="url(#ow-map-glow)" />
        {/* A grid, faint, so the eye reads the plane as a map rather than as scattered dots. */}
        {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map(v => (
          <g key={v} stroke="rgba(255,255,255,.055)" strokeWidth="0.25">
            <line x1={v} y1="0" x2={v} y2="100" />
            <line x1="0" y1={v} x2="100" y2={v} />
          </g>
        ))}
      </svg>

      {/* The pins sit in normal layout rather than inside the SVG, so each one is a real button
          with a real 44-pixel target and its own focus ring. */}
      <div className="absolute inset-0">
        {placed.map(({ pin, x, y }) => {
          const on = pin.id === selectedId;
          return (
            <button key={pin.id} type="button"
              onClick={() => onSelect(on ? null : pin.id)}
              aria-label={pin.label}
              aria-pressed={on}
              className="ow-tap absolute grid h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2
                place-items-center rounded-full border-2 transition"
              style={{
                left: `${x}%`, top: `${y}%`,
                background: on ? lane.hue : "rgba(11,15,26,.82)",
                borderColor: on ? "#fff" : lane.hue,
                boxShadow: on ? `0 0 0 5px ${lane.hue}55, 0 6px 16px rgba(0,0,0,.6)` : `0 0 12px ${lane.hue}55`,
                zIndex: on ? 3 : 2,
              }}>
              <span aria-hidden className="h-[9px] w-[9px] rounded-full"
                style={{ background: on ? "#fff" : lane.hue }} />
            </button>
          );
        })}
      </div>

      {/* NOTHING TO PLOT IS A SENTENCE, NOT AN EMPTY SCREEN. Jobs and Socials will often have no
          coordinates at all, and a blank grid reads as a broken map rather than an honest one. */}
      {!placed.length && (
        <div className="absolute inset-0 grid place-items-center px-10 text-center">
          <p className="text-[15px] font-bold text-white/70">
            {W(lang, `Nothing in ${lane.en} has a location yet.`, `Nada en ${lane.es} tiene ubicación todavía.`)}
          </p>
        </div>
      )}

      {/* ── THE WAY OUT (R18 note 5) ────────────────────────────────────────────────────────
          Labelled, and above everything. Lee reported twice that the map strands him; a control
          that is only sometimes on screen is the same bug with better odds. */}
      <button type="button" onClick={onClose}
        className="ow-tap absolute left-4 top-[calc(env(safe-area-inset-top)+64px)] z-[6] inline-flex h-[38px]
          items-center gap-1.5 rounded-full border border-white/25 bg-black/55 px-3.5 text-[13px]
          font-extrabold text-white backdrop-blur-md">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 5l-7 7 7 7" />
        </svg>
        {W(lang, "Back to the feed", "Volver al feed")}
      </button>

      {/* How many, and of what — so the map says which lane it is showing without a legend. */}
      {!!placed.length && (
        <div className="pointer-events-none absolute right-4 top-[calc(env(safe-area-inset-top)+64px)] z-[6]
          rounded-full border border-white/20 bg-black/50 px-3 py-[7px] text-[12px] font-extrabold
          text-white backdrop-blur-md">
          <span aria-hidden className="mr-1.5 inline-block h-[8px] w-[8px] rounded-full align-middle"
            style={{ background: lane.hue }} />
          {placed.length} {W(lang, lane.en, lane.es)}
        </div>
      )}

      {/* THE CHOSEN PIN. One tap selects, the card names it, the button opens it — the same two
          steps as the feed itself, so nothing new has to be learned here. */}
      {chosen && (
        <div className="absolute inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[6]
          rounded-2xl border border-white/15 bg-black/70 p-3.5 text-white backdrop-blur-xl">
          <p className="line-clamp-2 text-[15px] font-extrabold leading-tight">{chosen.pin.label}</p>
          {chosen.pin.note && <p className="mt-0.5 text-[13px] font-bold text-white/85">{chosen.pin.note}</p>}
          <button type="button" onClick={() => nav(chosen.pin.href)}
            className="mt-2.5 inline-flex h-[38px] items-center rounded-[12px] bg-clay px-4 text-[13px] font-extrabold">
            {W(lang, "View listing", "Ver el anuncio")}
          </button>
        </div>
      )}
    </div>
  );
}
