import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Avatar, useOneId } from "@oneworld/shell";
import { useT, dateLocale, INPUT } from "../lib/dict";
import { fetchRoster, searchProfiles, type ProfileHit, type RosterRow } from "../lib/data";
import { PartnerChip } from "./Roster";

/**
 * PARTNER — the centre action (Lee's ruling, 9 Aug 2026): grow the book, deliberately.
 * ============================================================================================
 * The centre word is PARTNER, and the flow is a ladder no rung of which can be skipped:
 *   invite → accepted invite = CONNECTED → contract (only to connected people) → PARTNERED.
 * Two doorways in, both on this screen:
 *   1. The QR/link invite — someone signs up in OneJob (professional/payee or hirer/payer,
 *      THEIR choice) and lands tied to this agent.
 *   2. "Partner with someone on the platform" — search people already here by name and invite
 *      them straight into the book. Profiles read: GRANTED COLUMNS ONLY, never select('*').
 *      The invite write is display-only for now (tables are draft) — the affordance answers
 *      with the honest pending note.
 *
 * DE-PANELLED (Lee: "you only need panels when you need panels"): the hero and the QR/link
 * block sit directly on the page in both themes; the white QR card itself stays because it is
 * functional (contrast for scanners). Only genuine groupings (recent joins) keep .card.
 *
 * ── SIGNUP-SIDE CAPTURE IS SHELL-LANE WORK — DELIBERATELY NOT HERE ─────────────────────────
 * Writing the agent tie when someone completes /join belongs to the shell + a server-side hook:
 * the shell's entryContext (oneworld-shell/src/lib/entryContext.ts) already captures query
 * params on first load and flushes after sign-in — capturing `?agent=` there is the intended
 * mechanism, and the roster write must be server-side because RLS makes agent_roster
 * agent-owned. Full note in AGENT_TABLES_DRAFT.sql. This screen only RENDERS the doorway.
 */
export default function Partner() {
  const { t, lang } = useT();
  const { userId } = useOneId();
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* People search */
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [invitedId, setInvitedId] = useState<string | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const url = `${window.location.origin}/join?agent=${userId}`;
    setLink(url);
    /* The exact ink-on-white treatment OneJob's payment QR uses. */
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: "#0B0F1A", light: "#FFFFFF" } })
      .then(d => { if (alive) setQr(d); })
      .catch(e => console.error(`[oneagent] QR render failed: ${e?.message ?? e}`));
    fetchRoster(userId).then(r => {
      if (!alive) return;
      setRoster(r.rows); setPending(r.pending); setLoaded(true);
    });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) { setHits([]); setSearched(false); return; }
    const seq = ++searchSeq.current;
    const h = setTimeout(async () => {
      const r = await searchProfiles(needle);
      if (seq !== searchSeq.current) return; // a newer keystroke owns the results
      setHits(r.rows.filter(p => p.id !== userId));
      setSearched(true);
    }, 250);
    return () => clearTimeout(h);
  }, [q, userId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch (e) { console.error(`[oneagent] clipboard failed: ${(e as Error)?.message ?? e}`); }
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "OneAgent", url: link }); return; } catch { /* user cancelled */ }
    }
    await copy();
  };

  if (!userId) {
    return <p className="text-sm opacity-60">{t("signInFirst")}</p>;
  }

  const recent = roster.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Hero — directly on the page, no panel. */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand">OneAgent</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{t("growTitle")}</h1>
        <p className="mt-1 text-[13.5px] opacity-60">{t("growSub")}</p>
      </div>

      {/* QR + link + share — unpanelled; the white QR card stays because it is functional. */}
      <div className="text-center">
        {qr
          ? <img src={qr} alt="QR" className="mx-auto w-[230px] rounded-xl bg-white p-2 shadow-sm" />
          : <div className="mx-auto h-[230px] w-[230px] animate-pulse rounded-xl bg-ink/5 dark:bg-white/10" />}
        <p className="mt-3 text-[13.5px] leading-snug opacity-60">{t("growQrHint")}</p>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-ink/10 px-3 py-2.5 dark:border-white/15">
          <p className="min-w-0 flex-1 truncate text-left text-[13px] opacity-70">{link}</p>
          <button onClick={copy}
                  className="ow-tap shrink-0 rounded-lg border border-ink/10 px-3 py-1.5 text-[12px] font-bold dark:border-white/15">
            {copied ? t("copiedOk") : t("copyLink")}
          </button>
        </div>

        <button onClick={share} className="btn-primary ow-tap mt-3 w-full text-sm">{t("shareLink")}</button>

        {/* Quiet secondary line — normal weight, neutral body colour, no panel, no wine. */}
        <p className="mt-3 text-left text-[13px] leading-snug opacity-60">{t("growBothSides")}</p>
      </div>

      {/* Partner with someone already on the platform. */}
      <section>
        <h2 className="text-base font-extrabold">{t("partnerOnTitle")}</h2>
        <p className="mt-0.5 text-[13px] opacity-60">{t("partnerOnSub")}</p>
        <input className={`${INPUT} mt-2`} type="search" value={q}
               onChange={e => setQ(e.target.value)} placeholder={t("searchPeoplePh")} />
        {searched && hits.length === 0 && (
          <p className="mt-2 text-[13px] opacity-50">{t("noResults")}</p>
        )}
        {hits.length > 0 && (
          <div className="mt-2 space-y-2">
            {hits.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-ink/10 px-3 py-2.5 dark:border-white/15">
                <Avatar name={p.full_name} src={p.photo_url} size={36} textSize="text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold leading-snug">{p.full_name}</p>
                  <p className="truncate text-[12.5px] opacity-60">
                    {[p.job_title, p.location].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {/* Display-only for now — the agent tables are draft, so the affordance
                    answers with the honest pending note rather than pretending to write. */}
                <button onClick={() => setInvitedId(p.id)}
                        className="ow-tap shrink-0 rounded-lg border border-ink/10 px-3 py-1.5 text-[12px] font-bold dark:border-white/15">
                  {t("inviteCta")}
                </button>
              </div>
            ))}
            {invitedId && <p className="text-[13px] opacity-50">{t("pendingNote")}</p>}
          </div>
        )}
      </section>

      {/* How it works — plain heading + steps, no panel. */}
      <section>
        <h2 className="mb-3 text-base font-extrabold">{t("howWorks")}</h2>
        {[t("growStep1"), t("growStep2"), t("growStep3")].map((s, i) => (
          <div key={i} className="mb-2 flex items-center gap-3 text-[13.5px] leading-snug">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal/15 text-xs font-bold text-teal-deep">
              {i + 1}
            </span>
            {s}
          </div>
        ))}
      </section>

      {/* Recent joins — a genuine grouping of data, so it keeps its card. */}
      <section className="card !rounded-3xl">
        <h2 className="text-base font-extrabold">{t("recentJoins")}</h2>
        {pending && <p className="mt-2 text-[13px] opacity-50">{t("pendingNote")}</p>}
        {!loaded && <p className="mt-2 text-[13px] opacity-50">{t("loading")}</p>}
        {loaded && recent.length === 0 && (
          <p className="mt-2 text-[13.5px] opacity-60">{t("noJoins")}</p>
        )}
        <div className="mt-2 space-y-2">
          {recent.map(m => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-ink/10 px-3 py-2.5 dark:border-white/15">
              <Avatar name={m.full_name} src={null} size={36} textSize="text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold leading-snug">{m.full_name}</p>
                <p className="truncate text-[12.5px] opacity-60">
                  {[m.category,
                    new Date(m.created_at).toLocaleDateString(dateLocale(lang), { month: "short", day: "numeric" }),
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
              <PartnerChip status={m.partner_status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
