import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { REPORT_REASONS, reportContent, blockUser, useRefreshBlocks, type ReportTarget } from "@job/lib/moderation";

/**
 * The report / block sheet. One component, reused from every user-generated surface — the feed, a
 * DM thread, a review, a public profile — so the affordance looks and behaves identically wherever
 * someone runs into something they want gone.
 *
 * Apple 1.2 requires BOTH: a way to report content and a way to block the person. Offering only
 * "report" reads as a black hole to the user, since nothing visibly changes for them; blocking is
 * the part that gives them immediate control. So both live here, and blocking is offered right
 * after a report lands rather than being buried on another screen.
 */
export default function ReportBlockSheet({
  open, onClose, targetType, targetId, targetUserId, targetName, onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  targetUserId?: string | null;
  targetName?: string | null;
  /** Fired after a successful block so the parent can drop the content from view immediately. */
  onBlocked?: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [stage, setStage] = useState<"pick" | "sent">("pick");
  const refreshBlocks = useRefreshBlocks();
  const who = targetName?.trim() || "this person";

  useEffect(() => {
    if (!open) return;
    setReason(""); setDetail(""); setErr(""); setStage("pick"); setBusy(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const submitReport = async () => {
    if (!reason || busy) return;
    setBusy(true); setErr("");
    const { error } = await reportContent({ targetType, targetId, targetUserId, reason, detail });
    setBusy(false);
    if (error) { setErr(error); return; }
    setStage("sent");
  };

  const doBlock = async () => {
    if (!targetUserId || busy) return;
    setBusy(true); setErr("");
    const { error } = await blockUser(targetUserId);
    setBusy(false);
    if (error) { setErr(error); return; }
    refreshBlocks();
    onBlocked?.();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[190] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label="Report or block">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-2xl dark:bg-[#141824] sm:m-4 sm:rounded-3xl">
        <button onClick={onClose} aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-ink/10 text-lg dark:border-white/15">×</button>

        {stage === "pick" ? (
          <>
            <h2 className="text-xl font-extrabold">Report this {targetType}</h2>
            <p className="mt-1 text-sm opacity-65">
              Reports are private — {who} is never told who reported them. We review every one.
            </p>

            <fieldset className="mt-4">
              <legend className="label">What's wrong?</legend>
              <div className="mt-1 space-y-1.5">
                {REPORT_REASONS.map((r) => (
                  <label key={r.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      reason === r.id ? "border-brand bg-brand/10 ring-1 ring-brand" : "border-ink/10 hover:bg-brand/5 dark:border-white/15"}`}>
                    <input type="radio" name="report-reason" value={r.id} checked={reason === r.id}
                      onChange={() => setReason(r.id)} className="accent-brand" />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="label mt-4 block" htmlFor="report-detail">Anything else? (optional)</label>
            <textarea id="report-detail" className="input min-h-[80px]" value={detail} maxLength={1000}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Tell us what happened — it helps us act faster." />

            <button onClick={submitReport} disabled={!reason || busy} className="btn-primary mt-4 w-full disabled:opacity-50">
              {busy ? "Sending…" : "Submit report"}
            </button>

            {targetUserId && (
              <button onClick={doBlock} disabled={busy}
                className="mt-2 w-full rounded-full border border-red-500/30 py-2.5 text-sm font-bold text-red-500 transition active:scale-[.98]">
                Block {who}
              </button>
            )}
            <p className="mt-2 text-center text-[11px] leading-snug opacity-55">
              Blocking hides their posts and messages from you, and stops them contacting you. You can
              undo it any time in Settings.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mt-2 grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-3xl text-brand">✓</div>
            <h2 className="mt-4 text-center text-xl font-extrabold">Report received</h2>
            <p className="mt-2 text-center text-sm leading-relaxed opacity-70">
              Thanks — we'll review this. {who} won't know you reported them.
            </p>
            {targetUserId && (
              <>
                <p className="mt-4 text-center text-sm font-semibold">Want to stop hearing from them too?</p>
                <button onClick={doBlock} disabled={busy}
                  className="mt-2 w-full rounded-full border border-red-500/30 py-2.5 text-sm font-bold text-red-500 transition active:scale-[.98]">
                  {busy ? "Blocking…" : `Block ${who}`}
                </button>
              </>
            )}
            <button onClick={onClose} className="btn-ghost mt-2 w-full">Done</button>
          </>
        )}

        {err && <p className="mt-3 text-center text-sm font-semibold text-red-500">{err}</p>}
      </div>
    </div>,
    document.body,
  );
}
