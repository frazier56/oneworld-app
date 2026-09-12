import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { W } from "../lib/i18n";

/**
 * WHO AM I DEALING WITH — Airbnb audit A9, 14 August 2026
 * ============================================================================================
 * Airbnb surrounds a five-star average with far more trust signal than the average itself
 * carries: years hosting, response rate, "responds within an hour", a verification tick, and a
 * page explaining what verification does and does not prove.
 *
 * OneScore is a better number than a star average — it is the reason to list on OneHome rather
 * than in a WhatsApp group, and it is not diluted by anything here. What was missing is
 * everything AROUND it. A guest about to send money to a stranger in another country wants to
 * know one thing before they write: **will this person answer?**
 *
 * ── THE RULE THIS COMPONENT IS BUILT AROUND ─────────────────────────────────────────────────
 * **It says nothing rather than something reassuring it has not earned.**
 *
 * That is not caution for its own sake. A brand-new platform showing "responds within an hour"
 * for a host who has never received a message is making a promise the guest will test on their
 * first booking, and being wrong about that once costs more than never having said it. So:
 *
 *   · fewer than three judged conversations → no response figure at all, in any form
 *   · never answered → no response figure, rather than "0 percent", which reads as an accusation
 *     when it may only mean nobody has asked yet
 *   · no rows at all → the component renders nothing and takes up no space
 *
 * The database function it calls already enforces the honest half of this: it excludes threads
 * opened in the last twenty-four hours from both the numerator and the denominator, so a message
 * sent five minutes ago cannot drag a host's rate down, and it returns aggregates only — no
 * message content ever leaves the database.
 *
 * ── WHY THE MEDIAN, SAID IN WORDS ───────────────────────────────────────────────────────────
 * "Responds within an hour" is a band, not a number, because a precise "47 minutes" invites a
 * guest to treat it as a guarantee. Bands are what people actually reason with.
 */

export type HostTrustProps = {
  hostId: string;
  lang: string;
  /** How many places this host has published. Passed in — the product already knows. */
  listingCount?: number | null;
  /** Only true when identity has genuinely been checked. Never optimistic. */
  verified?: boolean;
  className?: string;
};

type Row = {
  inbound: number;
  answered: number;
  response_pct: number | null;
  median_minutes: number | null;
  member_since: string | null;
};

/** Below this, one slow reply would swing the figure by a third. Say nothing instead. */
const ENOUGH = 3;

export default function HostTrust({ hostId, lang, listingCount, verified, className }: HostTrustProps) {
  const [row, setRow] = useState<Row | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (!hostId) { setRow(null); return; }
    void supabase.rpc("host_responsiveness", { p_host: hostId }).then(({ data, error }) => {
      if (!alive) return;
      /* A failed call means we do not know, which is exactly the same as having nothing to say.
         It must never fall through to a default that flatters the host. */
      setRow(error ? null : ((data as Row[])?.[0] ?? null));
    });
    return () => { alive = false; };
  }, [hostId]);

  if (row === undefined) return null;   // still asking; no skeleton, this is a small aside
  const facts = buildFacts(row, lang, listingCount, verified);
  if (facts.length === 0) return null;  // nothing earned, so nothing drawn

  return (
    <section className={`card mt-3 p-4 ${className ?? ""}`}>
      <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
        {W(lang, "About this host", "Sobre esta persona")}
      </h2>
      <ul className="mt-2.5 space-y-1.5">
        {facts.map(f => (
          <li key={f.key} className="flex items-start gap-2 text-[13.5px] leading-snug">
            <span className="mt-[3px] shrink-0 text-brand">{f.icon}</span>
            <span className="opacity-85">{f.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── the facts, and the rules about which ones may be shown ──────────────────────────────── */

function buildFacts(
  row: Row | null, lang: string, listingCount?: number | null, verified?: boolean,
) {
  const out: { key: string; text: string; icon: JSX.Element }[] = [];

  if (verified) {
    out.push({ key: "verified", icon: <IconShield />, text:
      W(lang, "Identity checked by OneHome", "Identidad verificada por OneHome") });
  }

  if (row?.member_since) {
    const years = Math.floor(
      (Date.now() - Date.parse(row.member_since)) / (365.25 * 24 * 3600_000));
    out.push({ key: "since", icon: <IconClock />, text: years >= 1
      ? W(lang, `${years} ${years === 1 ? "year" : "years"} on OneHome`,
                `${years} ${years === 1 ? "año" : "años"} en OneHome`)
      : W(lang, `Joined ${monthYear(row.member_since, lang)}`,
                `Se unió en ${monthYear(row.member_since, lang)}`) });
  }

  if (listingCount && listingCount > 0) {
    out.push({ key: "listings", icon: <IconHome />, text:
      W(lang, `${listingCount} ${listingCount === 1 ? "place" : "places"} listed`,
              `${listingCount} ${listingCount === 1 ? "inmueble" : "inmuebles"} publicados`) });
  }

  /* THE GATE. Everything above is a fact about the past. This is a prediction about the future,
     so it holds itself to a higher bar and stays silent below it. */
  if (row && row.inbound >= ENOUGH && row.response_pct != null && row.answered > 0) {
    out.push({ key: "rate", icon: <IconChat />, text:
      W(lang, `Answers ${row.response_pct} percent of messages`,
              `Responde el ${row.response_pct} por ciento de los mensajes`) });

    if (row.median_minutes != null) {
      out.push({ key: "speed", icon: <IconBolt />, text: speedBand(row.median_minutes, lang) });
    }
  }

  return out;
}

/** A band, never a precise figure — a number invites people to read it as a promise. */
function speedBand(mins: number, lang: string) {
  if (mins <= 60)      return W(lang, "Usually replies within an hour", "Suele responder en menos de una hora");
  if (mins <= 3 * 60)  return W(lang, "Usually replies within a few hours", "Suele responder en pocas horas");
  if (mins <= 24 * 60) return W(lang, "Usually replies within a day", "Suele responder en un día");
  const days = Math.round(mins / (24 * 60));
  return W(lang, `Usually replies within ${days} days`, `Suele responder en ${days} días`);
}

function monthYear(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "es-CO",
    { month: "long", year: "numeric" });
}

/* ── icons, inline so this component pulls in nothing ─────────────────────────────────────── */
const S = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
            strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IconShield = () => <svg {...S}><path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
const IconClock  = () => <svg {...S}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
const IconHome   = () => <svg {...S}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/></svg>;
const IconChat   = () => <svg {...S}><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/></svg>;
const IconBolt   = () => <svg {...S}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>;
