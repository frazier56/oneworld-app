import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * DELETE MY ACCOUNT — the in-app path Apple and Google both require.
 * ============================================================================================
 * Apple Guideline 5.1.1(v): an app that lets you CREATE an account must let you INITIATE and
 * COMPLETE deletion inside the app. A `mailto:` link is explicitly disallowed and is one of the
 * most reliably-caught review rejections. Google Play requires an equivalent path. This screen is
 * that path, and it is shared by every product so the requirement is met once, not five times.
 *
 * The server (`delete-account` edge function) is the real authority and is money-safe: it REFUSES
 * while any payment is held or any job is live, so nobody's held money is ever orphaned. This screen's
 * whole job is to be honest and deliberate:
 *   1. Ask the server what would happen (preflight) the moment the screen opens.
 *   2. Show exactly what gets removed, and — if there is money in flight — show the blockers and
 *      refuse to arm the button.
 *   3. Make the person TYPE "DELETE" so this can never be a fat-finger. Then, and only then, do the
 *      irreversible call, sign them out, and send them to the front door.
 *
 * Nothing is destroyed until the person types the word and taps the final button. Reading this
 * screen, or opening it by accident, deletes nothing.
 */

type Preflight = {
  canDelete: boolean;
  openContracts: { id: string; title: string | null }[];
  activeJobs: number;
  willDelete: Record<string, number>;
};

/** Never render an error object; always a sentence. Same rule as the auth screens. */
const say = (e: unknown): string => {
  const m = (e as any)?.message ?? (e as any)?.error_description ?? (e as any)?.error;
  if (typeof m === "string" && m.trim()) return m;
  if (typeof e === "string" && e.trim()) return e;
  return "Something went wrong on our side. Nothing was deleted — try again in a moment.";
};

const LABELS: Record<string, string> = {
  posts: "posts",
  messages: "messages you sent",
  reviews: "reviews you wrote",
  cards: "saved cards",
  connections: "connections",
};

export default function DeleteAccount({ next = "/" }: { next?: string }) {
  const [pre, setPre] = useState<Preflight | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Ask the server what would happen. This is a read — it changes nothing — so it is safe on mount
     and safe to retry. A transient failure on a compliance-required screen must not become a
     dead-end, so it is a callable the "Try again" button can re-run. */
  const runPreflight = async () => {
    setErr(null); setLoading(true);
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { preflight: true },
    });
    if (error) setErr(say(error));
    else setPre(data as Preflight);
    setLoading(false);
  };
  useEffect(() => { void runPreflight(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const armed = !!pre?.canDelete && confirmText.trim().toUpperCase() === "DELETE" && !busy;

  const doDelete = async () => {
    if (!armed) return;
    setErr(null); setBusy(true);
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { confirm: "DELETE" },
    });
    if (error || (data as any)?.error) {
      setBusy(false);
      setErr(say((data as any)?.error ?? error));
      return;
    }
    /* The account is gone. Clear the session and send them to the front door. `signOut` may fail
       harmlessly (the user no longer exists); either way we leave. */
    try { await supabase.auth.signOut(); } catch { /* user is already gone */ }
    setDone(true);
    setTimeout(() => window.location.replace(next), 1200);
  };

  if (done) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-3 text-center">
        <h1 className="text-[22px] font-extrabold tracking-tight">Your account is closed</h1>
        <p className="text-[14px] opacity-70">
          Your personal information has been removed. Thanks for spending time with One World.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">Delete your account</h1>
        <p className="text-[14px] opacity-70">
          This closes your One ID for every One World product — OneJob, OneScore, OneEvent,
          OneSocial and the rest. It cannot be undone.
        </p>
      </div>

      {loading && (
        <p className="text-center text-[13px] font-medium opacity-60">Checking your account…</p>
      )}

      {/* ── MONEY BLOCKERS — the server refuses, and so does the button ───────────────────────── */}
      {pre && !pre.canDelete && (
        <div className="card rounded-2xl border border-amber-500/30 p-4 space-y-2">
          <p className="text-[14px] font-semibold">Finish these first</p>
          <p className="text-[13px] opacity-75">
            We won't delete an account while money is being held. Settle or cancel the following, then
            come back:
          </p>
          <ul className="list-disc pl-5 text-[13px] opacity-80">
            {pre.openContracts.map(c => (
              <li key={c.id}>{c.title?.trim() || "An open contract"}</li>
            ))}
            {pre.activeJobs > 0 && (
              <li>{pre.activeJobs} job{pre.activeJobs === 1 ? "" : "s"} still in progress</li>
            )}
          </ul>
        </div>
      )}

      {/* ── WHAT WILL BE REMOVED ──────────────────────────────────────────────────────────────── */}
      {pre && (
        <div className="card rounded-2xl p-4 space-y-2">
          <p className="text-[13px] font-semibold opacity-80">What gets removed</p>
          <p className="text-[13px] opacity-70">
            Your profile, sign-in, saved cards and personal content. Contracts and reviews other
            people rely on are kept but stripped of your personal details.
          </p>
          {Object.entries(pre.willDelete).some(([, n]) => n > 0) && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[13px] opacity-80">
              {Object.entries(pre.willDelete)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => (
                  <li key={k}>{n} {LABELS[k] ?? k}</li>
                ))}
            </ul>
          )}
        </div>
      )}

      {/* ── TYPE-TO-CONFIRM — never a fat-finger ─────────────────────────────────────────────── */}
      {pre?.canDelete && (
        <div className="space-y-2">
          <label className="block text-[13px] font-medium opacity-75">
            Type <span className="font-extrabold">DELETE</span> to confirm
          </label>
          <input
            ref={inputRef}
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="DELETE"
            className="card w-full rounded-2xl px-4 py-3.5 text-[15px] tracking-widest outline-none" />
          <button
            onClick={() => void doDelete()}
            disabled={!armed}
            className="ow-tap w-full rounded-2xl bg-red-600 py-3.5 text-[15px] font-bold text-white disabled:opacity-40">
            {busy ? "Closing your account…" : "Permanently delete my account"}
          </button>
        </div>
      )}

      {err && <p className="pt-1 text-center text-[13px] font-medium text-red-500">{err}</p>}

      {/* If preflight failed we have no `pre`, so nothing above renders — offer a real retry rather
          than stranding the person on a compliance screen with only "keep my account". */}
      {!loading && !pre && err && (
        <button onClick={() => void runPreflight()}
          className="ow-tap w-full rounded-2xl card py-3 text-[14px] font-semibold">
          Try again
        </button>
      )}

      <button
        onClick={() => window.location.replace(next)}
        className="ow-tap block w-full pt-1 text-center text-[13px] font-medium opacity-55">
        Never mind — keep my account
      </button>
    </div>
  );
}
