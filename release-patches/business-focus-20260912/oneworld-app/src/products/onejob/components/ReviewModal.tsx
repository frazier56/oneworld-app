import { useState } from "react";
import { useI18n } from "@job/lib/i18n";
import { HOST_QUESTIONS, TALENT_QUESTIONS, submitReview } from "@job/lib/jobloop";
import { fnError, thrownError } from "@job/lib/fnError";

export default function ReviewModal({ executionId, reviewerId, revieweeId, revieweeIsHost, jobTitle, onClose }:
  { executionId: string; reviewerId: string; revieweeId: string; revieweeIsHost: boolean; jobTitle: string; onClose: (done: boolean) => void }) {
  const { t, lang } = useI18n();
  const QS = revieweeIsHost ? HOST_QUESTIONS : TALENT_QUESTIONS;
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const done = QS.every(q => (ratings[q.key] || 0) >= 1);

  return (
    <div className="fixed inset-0 z-[85] grid place-items-end sm:place-items-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onClose(false)} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto glass-modal rounded-t-3xl p-6 shadow-2xl sm:m-4 sm:rounded-3xl">
        <h2 className="text-xl font-extrabold">⭐ {t("reviewTitle")}</h2>
        <p className="mt-1 text-sm opacity-60">{jobTitle}</p>
        <div className="mt-4 space-y-4">
          {QS.map(q => (
            <div key={q.key}>
              <p className="mb-1 text-sm font-medium">{lang === "es" ? q.es : q.en}</p>
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7].map(n => (
                  <button key={n} onClick={() => setRatings(r => ({ ...r, [q.key]: n }))}
                    className={`text-2xl transition ${n <= (ratings[q.key] || 0) ? "" : "opacity-25 grayscale"}`}>⭐</button>
                ))}
              </div>
            </div>
          ))}
          <div><label className="label">{t("reviewComment")}</label>
            <textarea className="input min-h-[70px]" value={comment} onChange={e => setComment(e.target.value)} /></div>
        </div>
        <button disabled={!done || busy} className="btn-primary mt-4 w-full"
          onClick={async () => {
            setBusy(true); setErr("");
            const { error } = await submitReview(executionId, reviewerId, revieweeId, ratings, comment.trim(), jobTitle);
            setBusy(false);
            if (error) setErr(error.code === "23505" ? t("reviewDupe") : "Couldn’t save your review — try again.");
            else onClose(true);
          }}>
          {busy ? "…" : t("reviewSubmit")}
        </button>
        {!done && <p className="mt-2 text-center text-xs opacity-50">{t("reviewRateAll")}</p>}
        {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
        <button onClick={() => onClose(false)} className="btn-ghost mt-2 w-full">{t("later")}</button>
      </div>
    </div>
  );
}
