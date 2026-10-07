import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useI18n, W, Wt } from "../lib/i18n";

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
const say = (e: unknown, lang: string): string => {
  const m = (e as any)?.message ?? (e as any)?.error_description ?? (e as any)?.error;
  if (typeof m === "string" && m.trim()) return m;
  if (typeof e === "string" && e.trim()) return e;
  return W(lang, "Something went wrong on our side. Nothing was deleted — try again in a moment.", "Algo falló de nuestro lado. No se eliminó nada; inténtelo de nuevo en un momento.");
};

const label = (lang: string, key: string): string | undefined => ({
  posts: W(lang, "posts", "publicaciones"),
  messages: W(lang, "messages you sent", "mensajes que envió"),
  reviews: W(lang, "reviews you wrote", "reseñas que escribió"),
  cards: W(lang, "saved cards", "tarjetas guardadas"),
  connections: W(lang, "connections", "conexiones"),
} as Record<string, string>)[key];

export default function DeleteAccount({ next = "/" }: { next?: string }) {
  const { lang } = useI18n();
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
    if (error) setErr(say(error, lang));
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
      setErr(say((data as any)?.error ?? error, lang));
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
        <h1 className="text-[22px] font-extrabold tracking-tight">{W(lang, "Your account is closed", "Su cuenta está cerrada")}</h1>
        <p className="text-[14px] opacity-70">
          {W(lang, "Your personal information has been removed. Thanks for spending time with One World.", "Su información personal fue eliminada. Gracias por el tiempo que pasó en One World.")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">{W(lang, "Delete your account", "Eliminar su cuenta")}</h1>
        <p className="text-[14px] opacity-70">
          {W(lang, "This closes your One ID for every One World product — OneJob, OneScore, OneEvent, OneSocial and the rest. It cannot be undone.", "Esto cierra su One ID en todos los productos de One World: OneJob, OneScore, OneEvent, OneSocial y los demás. No se puede deshacer.")}
        </p>
      </div>

      {loading && (
        <p className="text-center text-[13px] font-medium opacity-60">{W(lang, "Checking your account…", "Revisando su cuenta…")}</p>
      )}

      {/* ── MONEY BLOCKERS — the server refuses, and so does the button ───────────────────────── */}
      {pre && !pre.canDelete && (
        <div className="card rounded-2xl border border-amber-500/30 p-4 space-y-2">
          <p className="text-[14px] font-semibold">{W(lang, "Finish these first", "Primero termine esto")}</p>
          <p className="text-[13px] opacity-75">
            {W(lang, "We won't delete an account while money is being held. Settle or cancel the following, then come back:", "No eliminamos una cuenta mientras haya dinero retenido. Liquide o cancele lo siguiente y vuelva:")}
          </p>
          <ul className="list-disc pl-5 text-[13px] opacity-80">
            {pre.openContracts.map(c => (
              <li key={c.id}>{c.title?.trim() || W(lang, "An open contract", "Un contrato abierto")}</li>
            ))}
            {pre.activeJobs > 0 && (
              <li>{Wt(lang, "{0} job{1} still in progress", "{0} trabajo{1} todavía en curso", [pre.activeJobs, pre.activeJobs === 1 ? "" : "s"])}</li>
            )}
          </ul>
        </div>
      )}

      {/* ── WHAT WILL BE REMOVED ──────────────────────────────────────────────────────────────── */}
      {pre && (
        <div className="card rounded-2xl p-4 space-y-2">
          <p className="text-[13px] font-semibold opacity-80">{W(lang, "What gets removed", "Qué se elimina")}</p>
          <p className="text-[13px] opacity-70">
            {W(lang, "Your profile, sign-in, saved cards and personal content. Contracts and reviews other people rely on are kept but stripped of your personal details.", "Su perfil, su acceso, sus tarjetas guardadas y su contenido personal. Los contratos y las reseñas de los que dependen otras personas se conservan, pero sin sus datos personales.")}
          </p>
          {Object.entries(pre.willDelete).some(([, n]) => n > 0) && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[13px] opacity-80">
              {Object.entries(pre.willDelete)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => (
                  <li key={k}>{n} {label(lang, k) ?? k}</li>
                ))}
            </ul>
          )}
        </div>
      )}

      {/* ── TYPE-TO-CONFIRM — never a fat-finger ─────────────────────────────────────────────── */}
      {pre?.canDelete && (
        <div className="space-y-2">
          <label className="block text-[13px] font-medium opacity-75">
            {W(lang, "Type", "Escriba")} <span className="font-extrabold">DELETE</span> {W(lang, "to confirm", "para confirmar")}
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
            {busy ? W(lang, "Closing your account…", "Cerrando su cuenta…") : W(lang, "Permanently delete my account", "Eliminar mi cuenta para siempre")}
          </button>
        </div>
      )}

      {err && <p className="pt-1 text-center text-[13px] font-medium text-red-500">{err}</p>}

      {/* If preflight failed we have no `pre`, so nothing above renders — offer a real retry rather
          than stranding the person on a compliance screen with only "keep my account". */}
      {!loading && !pre && err && (
        <button onClick={() => void runPreflight()}
          className="ow-tap w-full rounded-2xl card py-3 text-[14px] font-semibold">
          {W(lang, "Try again", "Intentar de nuevo")}
        </button>
      )}

      <button
        onClick={() => window.location.replace(next)}
        className="ow-tap block w-full pt-1 text-center text-[13px] font-medium opacity-55">
        {W(lang, "Never mind — keep my account", "Mejor no, conservar mi cuenta")}
      </button>
    </div>
  );
}
