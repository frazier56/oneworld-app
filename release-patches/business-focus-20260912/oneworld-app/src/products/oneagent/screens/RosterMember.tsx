import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar, useOneId } from "@oneworld/shell";
import { useT, dateLocale, type AgentKey } from "../lib/dict";
import { PartnerChip } from "./Roster";
import {
  fetchDealsForMember, fetchRepContractForMember, fetchRosterMember, fmtMoney, resendInvite,
  type DealRow, type PartnerStatus, type RepContractRow, type RosterRow,
} from "../lib/data";

/**
 * ROSTER MEMBER — one represented person, and where the PARTNER LADDER is read off.
 * ============================================================================================
 * The ladder (Lee, 9 Aug 2026), rendered as an explicit progress state:
 *   invited → accepted invite = CONNECTED → contract → PARTNERED.
 * Rules surfaced right here, in copy:
 *   · "Send contract" is a DISABLED affordance — contracts can only go to people connected to
 *     you, and the proposal itself will arrive via Messages. No write path exists yet (the
 *     contract flow is counsel-gated), so the button never enables in this build.
 *   · "Disconnect" is display-only for now. Either side can disconnect at any time, and
 *     disconnecting also ENDS any active contract — the display logic below already treats a
 *     contract on an 'ended' row as ended (the transactional pairing is server-side; see the
 *     draft SQL trigger note).
 * Deals here show rate + agent cut: an AGENT surface, inside the talent/agent visibility ring.
 */
export default function RosterMember() {
  const { t, lang } = useT();
  const { memberId } = useParams();
  const { userId } = useOneId();
  const [member, setMember] = useState<RosterRow | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [contract, setContract] = useState<RepContractRow | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disconnectAsked, setDisconnectAsked] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    let alive = true;
    (async () => {
      const [m, d, c] = await Promise.all([
        fetchRosterMember(memberId), fetchDealsForMember(memberId), fetchRepContractForMember(memberId),
      ]);
      if (!alive) return;
      setMember(m.row); setDeals(d.rows); setContract(c.row);
      /* The rep-contracts table is newer than the others — its absence alone should not flag
         the whole screen as pending; its panel shows the honest empty state instead. */
      setPending(m.pending || d.pending);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [memberId]);

  const doResend = async () => {
    if (!member) return;
    setBusy(true);
    const r = await resendInvite(member.id);
    setBusy(false);
    if (r.ok) setResent(true);
  };

  if (!userId) {
    return <p className="text-sm opacity-60">{t("signInFirst")}</p>;
  }
  if (!loaded) {
    return <p className="text-[13px] opacity-50">{t("loading")}</p>;
  }
  if (!member) {
    return (
      <div>
        {pending && <p className="mb-2 text-[13px] opacity-50">{t("pendingNote")}</p>}
        <p className="text-sm opacity-60">{t("memberNotFound")}</p>
        <Link to="/agent/roster" className="mt-3 inline-block text-[13px] font-bold text-brand">{t("backToRoster")}</Link>
      </div>
    );
  }

  const status: PartnerStatus = member.partner_status;
  const ended = status === "ended";
  /* Disconnecting ends the contract — display logic honours the rule even before the
     server-side trigger exists. */
  const contractStatus = contract
    ? (ended && (contract.status === "active" || contract.status === "proposed") ? "ended" : contract.status)
    : null;

  const LADDER: { key: PartnerStatus; label: string }[] = [
    { key: "invited", label: t("psInvited") },
    { key: "connected", label: t("psConnected") },
    { key: "partnered", label: t("psPartnered") },
  ];
  const rung = ended ? -1 : LADDER.findIndex(l => l.key === status);

  return (
    <div className="space-y-3">
      {pending && <p className="text-[13px] opacity-50">{t("pendingNote")}</p>}

      {/* Profile summary */}
      <div className="card !rounded-3xl">
        <div className="flex items-center gap-3">
          <Avatar name={member.full_name} src={null} size={52} textSize="text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold leading-tight">{member.full_name}</h1>
            <p className="truncate text-[13px] opacity-60">
              {[member.category, member.email].filter(Boolean).join(" · ")}
            </p>
          </div>
          <PartnerChip status={status} />
        </div>
        {member.notes && <p className="mt-3 text-[13.5px] leading-snug opacity-70">{member.notes}</p>}
        {status === "invited" && (
          <button onClick={doResend} disabled={busy || resent}
                  className="ow-tap mt-3 inline-flex items-center justify-center rounded-xl border border-ink/10 px-4 py-2 text-[13px] font-semibold dark:border-white/15">
            {resent ? t("resent") : t("resend")}
          </button>
        )}
      </div>

      {/* The partner ladder — an explicit progress state; no rung is skippable. */}
      <div className="card !rounded-3xl">
        <h2 className="text-base font-extrabold">{t("ladderTitle")}</h2>
        <div className="mt-3 flex items-center">
          {LADDER.map((step, i) => {
            const reached = rung >= i;
            const current = rung === i;
            return (
              <div key={step.key} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
                {i > 0 && (
                  <div className={`mx-1.5 mb-4 h-0.5 flex-1 rounded-full ${reached && !ended ? "bg-teal" : "bg-ink/10 dark:bg-white/15"}`} />
                )}
                <div className="flex flex-col items-center gap-1">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                    reached && !ended
                      ? "bg-teal text-white"
                      : "bg-ink/5 opacity-60 dark:bg-white/10"
                  }`}>
                    {i + 1}
                  </span>
                  <span className={`text-[11px] ${current ? "font-bold" : "opacity-50"}`}>{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>
        {ended && <p className="mt-2 text-[13px] font-semibold text-red-600">{t("psEnded")}</p>}

        {/* Send contract — DISABLED affordance; the ladder rule and the Messages hand-off are
            spelled out. Never enables in this build: the contract flow is counsel-gated. */}
        <button disabled
                className="btn-primary ow-tap mt-4 w-full !py-2.5 text-[13px]">
          {t("sendContract")}
        </button>
        <p className="mt-2 text-[12.5px] leading-snug opacity-50">{t("sendContractRule")}</p>
        <p className="mt-1 text-[12.5px] leading-snug opacity-50">{t("viaMessages")}</p>
      </div>

      {/* Representation contract — SPEC/DISPLAY ONLY. Commission is agent/talent-eyes only,
          and this is an agent surface. */}
      <div className="card !rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold">{t("repTitle")}</h2>
          {contractStatus && (
            contractStatus === "active"
              ? <span className="rounded-full bg-teal/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-teal-deep">{t("repStatus_active")}</span>
              : contractStatus === "revoked"
                ? <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-600">{t("repStatus_revoked")}</span>
                : <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide opacity-60 dark:bg-white/10">
                    {contractStatus === "ended" ? t("repStatus_ended") : t("repStatus_proposed")}
                  </span>
          )}
        </div>
        {!contract && <p className="mt-2 text-[13.5px] opacity-60">{t("repNone")}</p>}
        {contract && (
          <div className="mt-3 space-y-1.5 text-[13px]">
            {contract.commission_pct != null && (
              <div className="flex justify-between">
                <span className="opacity-60">{t("repCommission")}</span>
                <b>{Number(contract.commission_pct)}%</b>
              </div>
            )}
            {contract.starts_on && (
              <div className="flex justify-between">
                <span className="opacity-60">{t("repStarts")}</span>
                <span>{new Date(`${contract.starts_on}T00:00:00`).toLocaleDateString(dateLocale(lang), { year: "numeric", month: "short", day: "numeric" })}</span>
              </div>
            )}
            {contract.ends_on && (
              <div className="flex justify-between">
                <span className="opacity-60">{t("repEnds")}</span>
                <span>{new Date(`${contract.ends_on}T00:00:00`).toLocaleDateString(dateLocale(lang), { year: "numeric", month: "short", day: "numeric" })}</span>
              </div>
            )}
            {contract.commission_pct != null && (
              <p className="pt-1 text-[12px] opacity-50">{t("eyesOnly")}</p>
            )}
          </div>
        )}
        <p className="mt-3 text-[12.5px] leading-snug opacity-50">{t("repNote")}</p>
        <p className="mt-1.5 text-[12.5px] leading-snug opacity-50">{t("counselLine")}</p>
      </div>

      {/* Their deals — agent-eye view: rate and cut may show. */}
      <div className="card !rounded-3xl">
        <h2 className="text-base font-extrabold">{t("theirDeals")}</h2>
        {deals.length === 0 && <p className="mt-2 text-[13.5px] opacity-60">{t("noMemberDeals")}</p>}
        <div className="mt-2 space-y-2">
          {deals.map(d => (
            <Link key={d.id} to="/agent/deals"
                  className="ow-tap block rounded-xl border border-ink/10 px-3 py-2.5 dark:border-white/15">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[13.5px] font-bold">{d.title}</p>
                <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
                  {t(`stage_${d.stage}` as AgentKey)}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] opacity-60">
                {d.rate_amount ? fmtMoney(Number(d.rate_amount), d.rate_currency) : ""}
                {d.rate_amount && d.agent_cut_pct != null ? ` · ${t("agentCut")} ${Number(d.agent_cut_pct)}%` : ""}
                {d.start_date
                  ? `${d.rate_amount ? " · " : ""}${new Date(`${d.start_date}T00:00:00`).toLocaleDateString(dateLocale(lang), { month: "short", day: "numeric" })}`
                  : ""}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Disconnect — DISPLAY-ONLY in this build (either side can, at any time; wiring waits on
          counsel + the server-side trigger that ends any active contract in the same
          transaction). Tapping states the consequence honestly instead of pretending to write. */}
      {!ended && (
        <div>
          <button onClick={() => setDisconnectAsked(true)}
                  className="ow-tap w-full rounded-2xl border border-ink/10 px-5 py-3 text-sm font-bold text-red-600 dark:border-white/15">
            {t("disconnect")}
          </button>
          {disconnectAsked && (
            <div className="mt-2 space-y-1">
              <p className="text-[13px] leading-snug opacity-60">{t("disconnectNote")} {t("disconnectRight")}</p>
              <p className="text-[13px] opacity-50">{t("pendingNote")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
