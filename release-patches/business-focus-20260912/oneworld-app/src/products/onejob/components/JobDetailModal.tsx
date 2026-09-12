import { createPortal } from "react-dom";
import { useState } from "react";
import { useI18n } from "@job/lib/i18n";
import ReceiptModal from "./ReceiptModal";
import { sanitizeHtml } from "@job/lib/mdToHtml";
import CollapsibleDescription from "./CollapsibleDescription";
import MoneyTimeline from "./MoneyTimeline";
import CompletionStamps from "./CompletionStamps";
import JobReviewExchange from "./JobReviewExchange";
import { timeLeft, windowLabel } from "@job/lib/acceptWindow";

export type JobItem = {
  key: string;
  /** Set on active/completed rows — the job_executions id, which reviews hang off. */
  executionId?: string;
  section: "active" | "pending" | "past";
  statusLabel: string;
  statusTone: "teal" | "amber" | "red";
  title: string;
  amount: number | null;
  amountLabel: string;
  dateText: string;
  description: string | null;
  withName: string;
  withRole: string;
  // Rich-card enrichment (My Jobs) — all optional so existing callers are unaffected.
  currency?: string | null;
  location?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  counterRole?: string;
  /**
   * The agreement's money fields, passed through so this modal can render the money timeline (#39)
   * and the accept countdown (#34). Deliberately the raw row rather than pre-computed strings: the
   * timeline's contract with the user is that every row is a real timestamp, so it must read the
   * timestamps itself.
   */
  money?: {
    payment_rail?: string | null; payment_status?: string | null;
    payment_amount?: number | null; platform_fee?: number | null; currency?: string | null;
    accept_deadline?: string | null; accept_window_hours?: number | null;
    /** When it left draft. Null on contracts sent before Jul 31 2026 — see CompletionStamps. */
    sent_at?: string | null;
    authorized_at?: string | null; accepted_at?: string | null; captured_at?: string | null;
    payee_done_at?: string | null; payer_done_at?: string | null;
    released_at?: string | null; paid_out_at?: string | null; expired_at?: string | null;
    payout_arrival_date?: string | null; payout_status?: string | null;
    payout_failure_message?: string | null;
  } | null;
  /** Which side the VIEWER is on — changes the timeline's wording, never its steps. */
  youAre?: "payer" | "payee" | null;
  /** Display names for the job sign-off block, so the stamps read as signatures rather than roles. */
  payerName?: string | null;
  payeeName?: string | null;
  /**
   * Who sent it and who it went to. Deliberately NOT payer/payee: on a payee-initiated contract
   * the professional is the sender, so reusing the money roles here would credit the send to the
   * wrong person on exactly the contracts where it matters most.
   */
  senderName?: string | null;
  recipientName?: string | null;
};

/** Rich job detail (Lee, Jul 12): pending/active/past jobs are all clickable.
 *  Shows who/when/amount/description; swipe or ‹ › to move between jobs. */
export default function JobDetailModal({ items, index, onIndex, onClose, meId, onLeaveReview }: {
  items: JobItem[]; index: number; onIndex: (i: number) => void; onClose: () => void;
  /** Signed-in user, so the review exchange knows which side is "you". */
  meId?: string;
  onLeaveReview?: (it: JobItem) => void;
}) {
  const { t } = useI18n();
  const [showReceipt, setShowReceipt] = useState(false);
  const it = items[index];
  if (!it) return null;
  let sx = 0, sy = 0;
  const tone = {
    teal: "bg-brand/10 text-brand",
    amber: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
    red: "bg-red-500/10 text-red-500",
  }[it.statusTone];

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-end sm:place-items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        /* FIX-F (Jul 26 2026): panel had no height cap and no scroll, so a tall contract (long
           description + sign-off + money timeline) overflowed off-screen with the bottom unreachable
           and no way to scroll. Cap at the viewport and let the whole panel scroll. overscroll-contain
           stops the scroll from chaining to the page behind. */
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-contain glass-modal rounded-t-3xl p-6 shadow-2xl sm:m-4 sm:rounded-3xl"
        onTouchStart={(e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - sx;
          const dy = e.changedTouches[0].clientY - sy;
          /* FIX-F (Jul 26 2026): only navigate on a CLEARLY horizontal swipe. Before, any drag with
             dx>50 flipped to another job — so a vertical scroll gesture "popped" you to a random job
             (the glitch). Require the swipe to be horizontal-dominant and past a larger threshold, so
             scrolling never triggers navigation. */
          if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy)) return;
          if (dx < 0 && index < items.length - 1) onIndex(index + 1);
          if (dx > 0 && index > 0) onIndex(index - 1);
        }}
      >
        <button onClick={onClose} aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-ink/10 dark:border-white/15">×</button>

        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{it.statusLabel}</span>
        <h2 className="mt-2 pr-8 text-lg font-extrabold">{it.title}</h2>

        {it.amount != null && (
          <div className="mt-2">
            {/* Currency-aware. This printed a bare "$" and ignored `it.currency`, so a COP 300.000
                contract rendered as "$300000" — off by ~4000x, the same class of bug the currency
                persistence fix and get-shared-contract v4 were written to kill. */}
            <p className="text-3xl font-extrabold text-brand">
              {new Intl.NumberFormat("en", { style: "currency", currency: it.currency || "USD", maximumFractionDigits: 2 }).format(it.amount)}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-50">{it.amountLabel}</p>
          </div>
        )}

        <div className="mt-4 space-y-2.5 text-sm">
          {it.dateText && <div className="flex justify-between gap-3"><span className="opacity-50">{t("jobWhen")}</span><span className="text-right font-semibold">{it.dateText}</span></div>}
          {it.withName && <div className="flex justify-between gap-3"><span className="opacity-50">{t("jobWith")}</span><span className="text-right font-semibold">{it.withName} · {it.withRole}</span></div>}
        </div>

        {/* The scope, collapsed.
            FIX-F: the nested inner scroll (max-h-52 overflow-y-auto) was removed — with the whole
            panel scrollable, an inner scroll box just traps the gesture.
            Lee, Jul 31 2026: by the time a contract is HERE, both people have already read the
            scope — writing it, and again on the preview before it was sent. Leaving it open turns
            every later visit into a long scroll past text they know, just to reach the money and the
            buttons. So it clamps to six lines with Show more. The public link view (SharedContract)
            deliberately keeps the full scope: a recipient deciding whether to accept has NOT read
            it yet. */}
        {it.description && (
          <div className="mt-3 border-t border-ink/5 pt-3 dark:border-white/10">
            {/^\s*<\/?[a-z][\s\S]*>/i.test(it.description)
              ? <CollapsibleDescription html={sanitizeHtml(it.description)} />
              : <CollapsibleDescription text={it.description} />}
          </div>
        )}

        {/* ---------- ACCEPT COUNTDOWN (#34) ----------
            A pending contract has a real deadline behind it: `expire-stale-contracts` closes it and
            releases the payer's card when the clock runs out. Showing the clock is how that stops
            being a nasty surprise. */}
        {it.section === "pending" && it.money?.accept_deadline && (() => {
          const left = timeLeft(it.money.accept_deadline);
          if (!left) return null;
          return (
            <p className={`mt-4 rounded-xl px-3 py-2 text-[12px] font-semibold ${
              left.expired
                ? "bg-red-500/10 text-red-500"
                : left.urgent
                  ? "bg-amber-400/15 text-amber-600 dark:text-amber-400"
                  : "bg-ink/5 opacity-70 dark:bg-white/10"
            }`}>
              {left.expired
                ? "The time to accept has run out — this contract is closing and any card hold is being released."
                : `⏳ ${left.text} to accept${it.money.accept_window_hours ? ` (${windowLabel(it.money.accept_window_hours)} window)` : ""}. After that it closes itself and the payer's card is released.`}
            </p>
          );
        })()}

        {/* ---------- CONTRACT RECORD (#53, extended Jul 31 2026) ----------
            The life of the agreement in stamps: sent → accepted → both sign-offs. Sits above the
            money timeline because these are the acts that CAUSED the money to move.
            The section only renders once a contract exists at all — `it.money` is the agreement
            row, so a job with no agreement behind it (an execution stub) shows nothing rather than
            an empty record. */}
        {it.money && (
          <CompletionStamps
            className="mt-4"
            sent={{ name: it.senderName, at: it.money.sent_at }}
            accepted={{ name: it.recipientName, at: it.money.accepted_at }}
            payer={{ name: it.payerName, at: it.money.payer_done_at }}
            payee={{ name: it.payeeName, at: it.money.payee_done_at }}
          />
        )}

        {/* ---------- WHERE THE MONEY IS (#39) ---------- */}
        {it.money && <MoneyTimeline ag={it.money} youAre={it.youAre ?? null} className="mt-4" />}

        {/* ---------- REVIEWS, BOTH DIRECTIONS ----------
            Only on a COMPLETED job: before that there is nothing to review, and an empty review
            box on an active job reads as a nag. See JobReviewExchange for why the absence is
            stated out loud rather than hidden. (Lee, 1 Aug) */}
        {it.section === "past" && it.statusTone === "teal" && it.executionId && meId && (
          <JobReviewExchange
            executionId={it.executionId}
            meId={meId}
            otherName={it.withName}
            onLeaveReview={onLeaveReview ? () => onLeaveReview(it) : undefined}
          />
        )}

        {/* Payment receipt — lives in the completed job (Lee §3.2) */}
        {it.section === "past" && it.statusTone === "teal" && (
          <button onClick={() => setShowReceipt(true)} className="btn-ghost mt-4 w-full">🧾 View receipt</button>
        )}
        {showReceipt && <ReceiptModal item={it} onClose={() => setShowReceipt(false)} />}

        {items.length > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <button disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Previous"
              className="grid h-9 w-9 place-items-center rounded-full border border-ink/10 disabled:opacity-30 dark:border-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-xs font-semibold opacity-50">{index + 1} / {items.length}</span>
            <button disabled={index === items.length - 1} onClick={() => onIndex(index + 1)} aria-label="Next"
              className="grid h-9 w-9 place-items-center rounded-full border border-ink/10 disabled:opacity-30 dark:border-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
