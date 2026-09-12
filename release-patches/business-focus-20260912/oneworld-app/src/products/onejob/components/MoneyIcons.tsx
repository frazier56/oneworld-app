/**
 * WHERE THE MONEY IS — the four places, drawn.
 *
 * Lee, Jul 27 2026: "photoreal icons instead of plain check marks on the rail, so a glance tells you
 * WHERE the money is: vault, Stripe, bank."
 *
 * A row of identical teal ticks tells you a step happened. It does not tell you where your money is
 * sitting right now, which is the only question anybody actually opens this panel to answer. These
 * give each step a picture of its PLACE, and the done/current/pending state rides underneath as
 * colour and ring rather than as the whole message.
 *
 * WHY INLINE SVG AND NOT PHOTOGRAPHS. Rendered art would mean four raster assets in a bundle that
 * ships as one file over GitHub Pages, at 2x and 3x, in light and dark — for icons drawn at 26px.
 * These are built with gradients, an inner highlight and a contact shadow, which is what reads as
 * "dimensional" at this size; a photograph at 26px reads as mud. The genuinely photoreal artwork is
 * the OneJob Vault logo, which appears large on the Vault screen where the detail survives.
 *
 * Brand: teal #15C2B2 is the only accent (ONE_WORLD_BRAND_CANON). The vault, the bank and the card
 * carry their own material colours because they are objects, not affordances — nothing here is
 * tappable, so nothing here competes with the clay CTA.
 */

export type MoneyPlace = "card" | "vault" | "balance" | "bank" | "handshake" | "check";

import { useId } from "react";

function Defs({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}-steel`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8FA3B8" />
        <stop offset="45%" stopColor="#5C7085" />
        <stop offset="100%" stopColor="#33414F" />
      </linearGradient>
      <linearGradient id={`${p}-teal`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#5EEAD4" />
        <stop offset="55%" stopColor="#15C2B2" />
        <stop offset="100%" stopColor="#0B7C70" />
      </linearGradient>
      <linearGradient id={`${p}-card`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3E5C8A" />
        <stop offset="60%" stopColor="#294A80" />
        <stop offset="100%" stopColor="#0F1A2E" />
      </linearGradient>
      <linearGradient id={`${p}-stone`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F3F5F7" />
        <stop offset="100%" stopColor="#C3CCD6" />
      </linearGradient>
      <linearGradient id={`${p}-gloss`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
        <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.06" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
      </linearGradient>
      <radialGradient id={`${p}-dial`} cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
        <stop offset="60%" stopColor="#D7DEE6" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#5C7085" stopOpacity="0.15" />
      </radialGradient>
    </defs>
  );
}

/**
 * The vault. The single most important picture in the product: it is the answer to "who has my money
 * right now" for the whole middle of every job. Door, hinges, spoked handle, a highlight across the
 * top-left so it reads as metal rather than as a flat square.
 */
function Vault({ p }: { p: string }) {
  return (
    <g>
      <rect x="2.5" y="3.5" width="21" height="19" rx="3.2" fill={`url(#${p}-steel)`} />
      <rect x="2.5" y="3.5" width="21" height="19" rx="3.2" fill={`url(#${p}-gloss)`} />
      <rect x="5.2" y="6" width="15.6" height="14" rx="2.2" fill="#2B3745" opacity="0.55" />
      <rect x="6.4" y="7.1" width="13.2" height="11.8" rx="1.8" fill={`url(#${p}-steel)`} />
      <rect x="6.4" y="7.1" width="13.2" height="11.8" rx="1.8" fill={`url(#${p}-gloss)`} opacity="0.8" />
      <circle cx="13" cy="13" r="4.15" fill={`url(#${p}-dial)`} />
      <circle cx="13" cy="13" r="4.15" fill="none" stroke="#1F2933" strokeOpacity="0.5" strokeWidth="0.7" />
      <circle cx="13" cy="13" r="1.5" fill={`url(#${p}-teal)`} />
      {/* handle spokes */}
      <path d="M13 8.4v1.5M13 16.1v1.5M8.4 13h1.5M16.1 13h1.5" stroke="#E8EDF2" strokeOpacity="0.85" strokeWidth="1.1" strokeLinecap="round" />
      {/* hinges */}
      <rect x="3.6" y="7.6" width="1.5" height="2.6" rx="0.7" fill="#E8EDF2" opacity="0.6" />
      <rect x="3.6" y="15.6" width="1.5" height="2.6" rx="0.7" fill="#E8EDF2" opacity="0.6" />
      <ellipse cx="13" cy="23.1" rx="8" ry="1.1" fill="#000" opacity="0.16" />
    </g>
  );
}

/** The client's card. Money is still theirs — only a hold sits on it. */
function Card({ p }: { p: string }) {
  return (
    <g>
      <rect x="2" y="5.5" width="22" height="15" rx="2.8" fill={`url(#${p}-card)`} />
      <rect x="2" y="5.5" width="22" height="15" rx="2.8" fill={`url(#${p}-gloss)`} />
      <rect x="2" y="9" width="22" height="3.1" fill="#0B0F1A" opacity="0.75" />
      <rect x="4.6" y="14.4" width="6.4" height="1.5" rx="0.75" fill="#FFF" opacity="0.55" />
      <rect x="4.6" y="17" width="4.2" height="1.2" rx="0.6" fill="#FFF" opacity="0.3" />
      <circle cx="18.2" cy="16.6" r="2.5" fill="#EB001B" opacity="0.85" />
      <circle cx="21" cy="16.6" r="2.5" fill="#F79E0F" opacity="0.8" />
      <ellipse cx="13" cy="21.3" rx="8.5" ry="1" fill="#000" opacity="0.15" />
    </g>
  );
}

/**
 * The pro's own Stripe balance. Deliberately NOT the vault: once money lands here it belongs to the
 * pro and OneJob is out of it. Drawn as a ledger card with a teal band so it reads as "theirs".
 */
function Balance({ p }: { p: string }) {
  return (
    <g>
      <rect x="3" y="4.5" width="20" height="17" rx="2.8" fill={`url(#${p}-stone)`} />
      <rect x="3" y="4.5" width="20" height="17" rx="2.8" fill={`url(#${p}-gloss)`} opacity="0.7" />
      <rect x="3" y="4.5" width="20" height="4.4" rx="2.8" fill={`url(#${p}-teal)`} />
      <rect x="3" y="7" width="20" height="1.9" fill={`url(#${p}-teal)`} />
      <rect x="6.2" y="11.6" width="13.6" height="1.6" rx="0.8" fill="#5C7085" opacity="0.55" />
      <rect x="6.2" y="14.8" width="9.4" height="1.6" rx="0.8" fill="#5C7085" opacity="0.4" />
      <circle cx="18.6" cy="16.9" r="3.1" fill={`url(#${p}-teal)`} />
      <path d="M17.2 16.9l1 1 2.1-2.2" stroke="#fff" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse cx="13" cy="22.2" rx="8" ry="1" fill="#000" opacity="0.14" />
    </g>
  );
}

/** The bank. The end of the road — the money is out of every platform and into a real account. */
function Bank({ p }: { p: string }) {
  return (
    <g>
      <path d="M13 3.2l10.2 5.1v1.9H2.8V8.3z" fill={`url(#${p}-stone)`} />
      <path d="M13 3.2l10.2 5.1v1.9H2.8V8.3z" fill={`url(#${p}-gloss)`} opacity="0.6" />
      <rect x="4.8" y="10.8" width="2.6" height="8.2" rx="0.5" fill={`url(#${p}-stone)`} />
      <rect x="9.4" y="10.8" width="2.6" height="8.2" rx="0.5" fill={`url(#${p}-stone)`} />
      <rect x="14" y="10.8" width="2.6" height="8.2" rx="0.5" fill={`url(#${p}-stone)`} />
      <rect x="18.6" y="10.8" width="2.6" height="8.2" rx="0.5" fill={`url(#${p}-stone)`} />
      <rect x="3" y="19.4" width="20" height="2.6" rx="0.8" fill={`url(#${p}-steel)`} />
      <rect x="3" y="19.4" width="20" height="2.6" rx="0.8" fill={`url(#${p}-gloss)`} opacity="0.5" />
      <circle cx="13" cy="7.1" r="1.35" fill={`url(#${p}-teal)`} />
      <ellipse cx="13" cy="22.6" rx="9" ry="1" fill="#000" opacity="0.14" />
    </g>
  );
}

/** Both sides agreeing — no money moves on these steps, so they get people, not places. */
function Handshake({ p }: { p: string }) {
  return (
    <g>
      <circle cx="13" cy="13" r="9.4" fill={`url(#${p}-teal)`} />
      <circle cx="13" cy="13" r="9.4" fill={`url(#${p}-gloss)`} opacity="0.55" />
      <path d="M7.6 12.6l2.5-2.2 2.9 1.9 2.9-1.9 2.5 2.2-3 3.6-2.4-1.5-2.4 1.5z"
        fill="#fff" opacity="0.94" />
      <ellipse cx="13" cy="23" rx="7" ry="0.9" fill="#000" opacity="0.13" />
    </g>
  );
}

function Check({ p }: { p: string }) {
  return (
    <g>
      <circle cx="13" cy="13" r="9.4" fill={`url(#${p}-teal)`} />
      <circle cx="13" cy="13" r="9.4" fill={`url(#${p}-gloss)`} opacity="0.55" />
      <path d="M8.9 13.2l2.9 2.9 5.5-5.9" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse cx="13" cy="23" rx="7" ry="0.9" fill="#000" opacity="0.13" />
    </g>
  );
}

/**
 * @param place  which of the four money locations (or a people step) this row is about
 * @param state  done = it happened · current = money is HERE right now · pending = not yet
 */
export function MoneyPlaceIcon({
  place,
  state = "done",
  size = 26,
  title,
}: {
  place: MoneyPlace;
  state?: "done" | "current" | "pending";
  size?: number;
  title?: string;
}) {
  // A per-instance id-space, so two timelines on one screen can't steal each other's gradients.
  // This used to be a module-level counter incremented during render — a render-phase side effect on
  // module-global state, which mints fresh gradient ids on every re-render and is not safe under
  // React's concurrent rendering (a discarded render still burns ids). useId is stable per instance.
  const p = `mp${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const body =
    place === "vault" ? <Vault p={p} />
    : place === "card" ? <Card p={p} />
    : place === "balance" ? <Balance p={p} />
    : place === "bank" ? <Bank p={p} />
    : place === "handshake" ? <Handshake p={p} />
    : <Check p={p} />;

  // A step that hasn't happened shows the same object, drained of colour — the shape still tells you
  // what's coming, the colour tells you it hasn't happened. "Current" gets full colour because that
  // is precisely where the money is sitting as you read.
  const style =
    state === "pending" ? { filter: "grayscale(1)", opacity: 0.38 }
    : state === "current" ? { filter: "saturate(1.12)" }
    : undefined;

  return (
    <svg
      viewBox="0 0 26 26"
      width={size}
      height={size}
      style={style}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="shrink-0"
    >
      <Defs p={p} />
      {body}
    </svg>
  );
}

export default MoneyPlaceIcon;
