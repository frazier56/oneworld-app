import { ScreenHeading } from "@oneworld/shell";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FEE_PCT, useOneId } from "@oneworld/shell";
import { useT, INPUT, LABEL, type AgentKey } from "../lib/dict";
import {
  AGENT_STAGES, advanceDeal, createDeal, dealMoney, fetchDeals, fetchRepContracts, fetchRoster,
  fmtMoney, nextStage,
  type DealDirection, type DealRow, type DealStage, type RepContractRow, type RosterRow,
} from "../lib/data";

/**
 * DEALS — the contracts-AND-jobs tab (Lee's restructure, 9 Aug 2026), mirroring OneJob's Jobs
 * tab feel: CONTRACTS first (Active / Pending / Completed & ended, from agent_rep_contracts),
 * then JOBS & DEALS (the existing pipeline).
 * ============================================================================================
 * Function 2 of the product: WORK DEALS ON BEHALF OF — the agent browses OneJob's jobs/hirers
 * and reaches out "as agent, on behalf of <client>". The two-mode intake (talent-side /
 * company-side) opens from "New deal"; same form, same single insert into `agent_deals` at
 * stage 'intake'. The centre action (/agent/partner) is GROW THE BOOK.
 *
 * Contracts are DISPLAY-ONLY (counsel-gated; proposals arrive via Messages when built). A
 * contract on a member whose connection has ENDED renders as ended — disconnecting ends the
 * contract (the transactional pairing is server-side; see the draft SQL).
 *
 * Pipeline: intake → matched → negotiating → signed → in-progress → closed, a mobile-first
 * vertical list grouped by stage. This screen IS the talent/agent view, so cards may show the
 * full private breakdown: rate − agent cut − platform fee (shared FEE_PCT) → net. The client
 * sees ONE total price — the rule stands in copy on every card.
 *
 * NO TRANSACTION CODE. Past 'signed' the card carries an inert notice — contracts and payment
 * run through OneJob's money layer when consent review completes. NEVER a payment button.
 */

const stageKey = (s: DealStage): AgentKey => (`stage_${s}` as AgentKey);

/** The two-mode intake — mode cards, short structured form, one write at stage 'intake'. */
function DealIntake({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { userId } = useOneId();
  const [mode, setMode] = useState<DealDirection | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [title, setTitle] = useState("");
  const [where, setWhere] = useState("");
  const [rateStr, setRateStr] = useState("");
  const [cutStr, setCutStr] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [memberId, setMemberId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchRoster(userId).then(r => { if (alive) setRoster(r.rows); });
    return () => { alive = false; };
  }, [userId]);

  const rate = parseFloat(rateStr) || 0;
  const cut = parseFloat(cutStr) || 0;
  const money = rate > 0 ? dealMoney(rate, cut) : null;

  const submit = async () => {
    if (!userId || !mode) return;
    if (!title.trim()) { setErr(t("needWhat")); return; }
    setErr(null); setBusy(true);
    const res = await createDeal(userId, {
      direction: mode,
      title: title.trim(),
      counterpart_name: counterpart.trim() || undefined,
      rate_amount: rate > 0 ? rate : null,
      agent_cut_pct: cut > 0 ? cut : null,
      roster_member_id: memberId || null,
      notes: [where.trim() && `${t("fWhere")}: ${where.trim()}`, notes.trim()].filter(Boolean).join("\n") || undefined,
    });
    setBusy(false);
    if (res.ok) onDone();
    else setErr(t("createFailed"));
  };

  return (
    <div className="space-y-2">
      <div className="card !rounded-3xl">
        <h2 className="text-base font-extrabold leading-tight">{t("askTitle")}</h2>
        <p className="mt-0.5 text-[13px] opacity-60">{t("askSub")}</p>
      </div>

      {/* The two doors — the chosen one wears the identity accent. */}
      {([
        { key: "talent" as DealDirection, head: t("modeTalent"), sub: t("modeTalentSub") },
        { key: "company" as DealDirection, head: t("modeCompany"), sub: t("modeCompanySub") },
      ]).map(m => (
        <button key={m.key} onClick={() => setMode(m.key)}
                className={`card ow-tap w-full !rounded-3xl text-left transition ${
                  mode === m.key ? "!border-brand/60 ring-2 ring-brand/30" : ""
                }`}>
          <p className={`text-base font-extrabold ${mode === m.key ? "text-brand" : ""}`}>{m.head}</p>
          <p className="mt-1 text-[13px] leading-snug opacity-60">{m.sub}</p>
        </button>
      ))}

      {mode && (
        <div className="card !rounded-3xl space-y-3">
          {/* Who this deal is worked by / for — the human promise, stated on the form itself. */}
          <p className="rounded-xl bg-brand/10 px-3 py-2 text-[13px] font-semibold text-brand">
            {mode === "talent" ? t("workedByTalent") : t("workedByCompany")}
          </p>

          <div>
            <label className={LABEL}>{t("fWhat")}</label>
            <input className={INPUT} value={title} onChange={e => setTitle(e.target.value)} placeholder={t("whatPh")} />
          </div>

          <div>
            <label className={LABEL}>{t("fWhere")}</label>
            <input className={INPUT} value={where} onChange={e => setWhere(e.target.value)} placeholder={t("wherePh")} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL}>{t("fRate")}</label>
              <input className={INPUT} inputMode="decimal" value={rateStr}
                     onChange={e => setRateStr(e.target.value)} placeholder="1500" />
            </div>
            <div>
              <label className={LABEL}>{t("fCut")}</label>
              <input className={INPUT} inputMode="decimal" value={cutStr}
                     onChange={e => setCutStr(e.target.value)} placeholder="15" />
            </div>
          </div>
          <p className="text-[13px] leading-snug opacity-50">{t("cutHint")}</p>

          {/* Live breakdown — TALENT/AGENT eyes. The client-facing surface shows total only. */}
          {money && (
            <div className="rounded-xl border border-ink/10 px-3 py-2.5 text-[13px] dark:border-white/15">
              <div className="flex justify-between"><span className="opacity-60">{t("rate")}</span><b>{fmtMoney(money.total)}</b></div>
              <div className="flex justify-between"><span className="opacity-60">{t("agentCut")} ({cut || 0}%)</span><span>−{fmtMoney(money.cut)}</span></div>
              <div className="flex justify-between"><span className="opacity-60">{t("platformFee")} ({FEE_PCT})</span><span>−{fmtMoney(money.fee)}</span></div>
              <div className="mt-1 flex justify-between border-t border-ink/10 pt-1 dark:border-white/15">
                <span className="font-bold">{t("netTalent")}</span><b>{fmtMoney(money.net)}</b>
              </div>
              <p className="mt-1.5 text-[12px] opacity-50">{t("clientTotal")} · {t("eyesOnly")}</p>
            </div>
          )}

          <div>
            <label className={LABEL}>{t("fCounterpart")}</label>
            <input className={INPUT} value={counterpart} onChange={e => setCounterpart(e.target.value)}
                   placeholder={t("counterpartPh")} />
          </div>

          {/* Link the deal to a represented person, when the roster exists. */}
          {mode === "talent" && roster.length > 0 && (
            <div>
              <label className={LABEL}>{t("fFor")}</label>
              <select className={INPUT} value={memberId} onChange={e => setMemberId(e.target.value)}>
                <option value="">{t("optNone")}</option>
                {roster.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={LABEL}>{t("fNotes")}</label>
            <textarea className={INPUT} rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder={t("notesPh")} />
          </div>

          {err && <p className="text-[13px] font-semibold text-red-600">{err}</p>}

          <button onClick={submit} disabled={busy} className="btn-primary ow-tap w-full text-sm">
            {busy ? t("loading") : t("createDeal")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Deals() {
  const { t } = useT();
  const { userId } = useOneId();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [contracts, setContracts] = useState<RepContractRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [memberStatus, setMemberStatus] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showIntake, setShowIntake] = useState(false);

  const load = async (uid: string) => {
    const [d, c, r] = await Promise.all([fetchDeals(uid), fetchRepContracts(uid), fetchRoster(uid)]);
    setDeals(d.rows);
    setContracts(c.rows);
    const names: Record<string, string> = {};
    const statuses: Record<string, string> = {};
    r.rows.forEach(m => { names[m.id] = m.full_name; statuses[m.id] = m.partner_status; });
    setMemberNames(names); setMemberStatus(statuses);
    /* The rep-contracts table is the newest draft — its absence alone doesn't flag the tab;
       the contracts section shows its own honest empty state. */
    setPending(d.pending);
    setLoaded(true);
  };
  useEffect(() => { if (userId) load(userId); else setLoaded(true); }, [userId]);

  const advance = async (deal: DealRow) => {
    if (!userId) return;
    setBusyId(deal.id);
    await advanceDeal(deal);
    await load(userId);
    setBusyId(null);
  };

  if (!userId) {
    return <p className="text-sm opacity-60">{t("signInFirst")}</p>;
  }

  return (
    <div className="space-y-3">
      <ScreenHeading right={
        <button onClick={() => setShowIntake(v => !v)}
                className="btn-primary ow-tap !px-4 !py-2 text-[13px]">{t("newDeal")}</button>
      }>{t("dealsTitle")}</ScreenHeading>

      {pending && <p className="text-[13px] opacity-50">{t("pendingNote")}</p>}
      {!loaded && <p className="text-[13px] opacity-50">{t("loading")}</p>}

      {/* ── CONTRACTS — Active / Pending / Completed & ended ─────────────────────────────── */}
      {loaded && (
        <section className="space-y-2">
          <h2 className="pt-1 text-base font-extrabold">{t("contractsTitle")}</h2>
          {contracts.length === 0 && (
            <p className="text-[13.5px] opacity-60">{t("emptyContracts")}</p>
          )}
          {([
            { key: "active", label: t("grpActive"), match: (s: string) => s === "active" },
            { key: "pending", label: t("grpPending"), match: (s: string) => s === "proposed" },
            { key: "done", label: t("grpEnded"), match: (s: string) => s === "ended" || s === "revoked" },
          ]).map(grp => {
            /* Disconnect ends the contract — a contract on an 'ended' member renders as ended
               even before the server-side trigger exists. */
            const effective = (c: RepContractRow) =>
              c.roster_member_id && memberStatus[c.roster_member_id] === "ended" &&
              (c.status === "active" || c.status === "proposed")
                ? "ended" : c.status;
            const rows = contracts.filter(c => grp.match(effective(c)));
            if (rows.length === 0) return null;
            return (
              <div key={grp.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-brand">
                    {grp.label}
                  </span>
                  <span className="text-[12px] opacity-40">{rows.length}</span>
                </div>
                {rows.map(c => (
                  <Link key={c.id}
                        to={c.roster_member_id ? `/agent/roster/${c.roster_member_id}` : "/agent/roster"}
                        className="card ow-tap block !rounded-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-[14px] font-bold">
                        {(c.roster_member_id && memberNames[c.roster_member_id]) || t("repTitle")}
                      </p>
                      <span className="shrink-0 rounded-full border border-ink/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide opacity-70 dark:border-white/15">
                        {c.direction === "talent" ? t("dirTalent") : t("dirCompany")}
                      </span>
                    </div>
                    {/* Commission — talent/agent eyes only; this is the agent's own tab. */}
                    <p className="mt-1 text-[12.5px] opacity-60">
                      {[
                        c.commission_pct != null ? `${t("repCommission")} ${Number(c.commission_pct)}%` : null,
                        c.starts_on ? `${t("repStarts")} ${c.starts_on}` : null,
                        c.ends_on ? `${t("repEnds")} ${c.ends_on}` : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </Link>
                ))}
              </div>
            );
          })}
          <p className="text-[12.5px] opacity-50">{t("viaMessages")}</p>
        </section>
      )}

      {/* ── JOBS & DEALS — the pipeline ──────────────────────────────────────────────────── */}
      {loaded && <h2 className="pt-1 text-base font-extrabold">{t("jobsDealsTitle")}</h2>}

      {showIntake && (
        <DealIntake onDone={() => { setShowIntake(false); if (userId) load(userId); }} />
      )}

      {loaded && deals.length === 0 && !showIntake && (
        <div className="card !rounded-3xl">
          <h2 className="text-base font-extrabold">{t("emptyDealsTitle")}</h2>
          <p className="mt-1 text-[13.5px] opacity-60">{t("emptyDealsBody")}</p>
          <button onClick={() => setShowIntake(true)} className="btn-primary ow-tap mt-4 w-full text-sm">
            {t("newDeal")}
          </button>
        </div>
      )}

      {AGENT_STAGES.map(stage => {
        const group = deals.filter(d => d.stage === stage);
        if (group.length === 0) return null;
        return (
          <section key={stage} className="space-y-2">
            {/* Stage chip — the identity hue marks the pipeline's spine, nothing else. */}
            <div className="flex items-center gap-2 pt-1">
              <span className="rounded-full bg-brand/10 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-brand">
                {t(stageKey(stage))}
              </span>
              <span className="text-[12px] opacity-40">{group.length}</span>
            </div>

            {group.map(deal => {
              const next = nextStage(deal.stage);
              const money = deal.rate_amount ? dealMoney(Number(deal.rate_amount), deal.agent_cut_pct == null ? null : Number(deal.agent_cut_pct)) : null;
              const pastSigned = ["signed", "in-progress", "closed"].includes(deal.stage);
              return (
                <div key={deal.id} className="card !rounded-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-extrabold leading-snug">{deal.title}</p>
                      {deal.counterpart_name && (
                        <p className="truncate text-[13px] opacity-60">{deal.counterpart_name}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full border border-ink/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide opacity-70 dark:border-white/15">
                      {deal.direction === "talent" ? t("dirTalent") : t("dirCompany")}
                    </span>
                  </div>

                  {/* Private breakdown — TALENT/AGENT eyes only. Client sees one total. */}
                  {money && (
                    <div className="mt-3 rounded-xl border border-ink/10 px-3 py-2.5 text-[13px] dark:border-white/15">
                      <div className="flex justify-between"><span className="opacity-60">{t("rate")}</span><b>{fmtMoney(money.total, deal.rate_currency)}</b></div>
                      {deal.agent_cut_pct != null && (
                        <div className="flex justify-between">
                          <span className="opacity-60">{t("agentCut")} ({Number(deal.agent_cut_pct)}%)</span>
                          <span>−{fmtMoney(money.cut, deal.rate_currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between"><span className="opacity-60">{t("platformFee")} ({FEE_PCT})</span><span>−{fmtMoney(money.fee, deal.rate_currency)}</span></div>
                      <div className="mt-1 flex justify-between border-t border-ink/10 pt-1 dark:border-white/15">
                        <span className="font-bold">{t("netTalent")}</span><b>{fmtMoney(money.net, deal.rate_currency)}</b>
                      </div>
                      <p className="mt-1.5 text-[12px] opacity-50">{t("clientTotal")} · {t("eyesOnly")}</p>
                    </div>
                  )}

                  {/* Past 'signed': an INERT notice. No contracts, no payments, ever, here. */}
                  {pastSigned && (
                    <p className="mt-3 rounded-xl bg-ink/5 px-3 py-2 text-[13px] leading-snug opacity-70 dark:bg-white/10">
                      {t("onejobNotice")}
                    </p>
                  )}

                  {next && (
                    <button onClick={() => advance(deal)} disabled={busyId === deal.id}
                            className="btn-primary ow-tap mt-3 w-full !py-2.5 text-[13px]">
                      {busyId === deal.id ? t("loading") : `${t("moveTo")}: ${t(stageKey(next))}`}
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
