import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n, W, Wt } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { sendMessage, listingMessageText, listingPath, type HomeProfileSnapshot } from "../lib/conversations";
import Avatar from "./Avatar";

/**
 * AN IDEAL-HOME PROFILE, SENT IN MESSAGES — and the agent's "Match with my properties".
 * ============================================================================================
 * Lee, 3 Oct 2026: *"someone can send over their ideal home profile… it comes in a little card…
 * once the agent gets it, there should be a button that says match this person's profile with my
 * properties… same type of AI functionality that scores properties, but in reverse… then a way to
 * send a property via the message portal."*
 *
 * WHAT THE CARD IS: a SNAPSHOT taken when it was sent — name, photo, where, rent or buy, and the
 * five priorities. Never a live window into the sender's profile (that row is theirs alone under
 * RLS, and what they shared is what they meant to share). Never their spoken notes.
 *
 * WHO SEES THE BUTTON: the person who RECEIVED it, and only if they have at least one published
 * home. A friend with no listings gets a card, not a button that leads to "you have nothing".
 * The server re-checks all of it (`home-compare`, mode "match") — this only decides what to draw.
 *
 * RESULTS: kept for this viewer in this browser, per card and language, so reopening the thread
 * does not spend another AI call. Each result opens the home, or SENDS it straight back into this
 * same conversation as a home card — the loop Lee described, closed in one tap.
 */
type Match = {
  kind: "rental" | "sale"; id: string; score: number; verdict: string;
  title: string | null; city: string | null; price: number | null; ccy: string | null; unit: string | null; photo: string | null;
};
type MatchResult = { matches: Match[]; considered: number; at: string };

/* One count per viewer per page load — a thread with six profile cards asks once, not six times. */
const listingCounts = new Map<string, Promise<number>>();
function myPublishedCount(viewerId: string): Promise<number> {
  let p = listingCounts.get(viewerId);
  if (!p) {
    p = (async () => {
      const [r, s] = await Promise.all([
        supabase.from("rental_properties").select("id", { count: "exact", head: true })
          .eq("agent_id", viewerId).eq("status", "published"),
        supabase.from("sale_properties").select("id", { count: "exact", head: true })
          .eq("agent_id", viewerId).in("status", ["published", "under_offer"]),
      ]);
      return (r.count ?? 0) + (s.count ?? 0);
    })().catch(() => 0);
    listingCounts.set(viewerId, p);
  }
  return p;
}

const cacheKey = (messageId: string, lang: string) => `ow.homeMatch.${messageId}.${lang}`;
function readCache(k: string): MatchResult | null {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as MatchResult : null; } catch { return null; }
}
function writeCache(k: string, v: MatchResult) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }

export default function HomeProfileCard({ p, mine, messageId, conversationId, viewerId }: {
  p: HomeProfileSnapshot; mine: boolean; messageId?: string; conversationId?: string; viewerId: string | null;
}) {
  const { lang } = useI18n();
  const nav = useNavigate();
  const [canMatch, setCanMatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<MatchResult | null>(() => (messageId ? readCache(cacheKey(messageId, lang)) : null));
  const [all, setAll] = useState(false);
  const [sent, setSent] = useState<Record<string, "busy" | "done" | "fail">>({});

  useEffect(() => {
    let live = true;
    if (mine || !viewerId || !messageId) { setCanMatch(false); return; }
    void myPublishedCount(viewerId).then(n => { if (live) setCanMatch(n > 0); });
    return () => { live = false; };
  }, [mine, viewerId, messageId]);

  async function match() {
    if (!messageId) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.functions.invoke("home-compare", { body: { mode: "match", message_id: messageId, lang } });
    setBusy(false);
    /* A reply without a list is a failure, never "you checked 0 homes". */
    if (error || !data || !Array.isArray((data as any).matches)) {
      let code = "failed";
      try { code = (await (error as any)?.context?.json?.())?.error ?? "failed"; } catch { /* not JSON */ }
      setErr(matchError(lang, code));
      return;
    }
    const out: MatchResult = { matches: (data as any).matches ?? [], considered: Number((data as any).considered) || 0, at: new Date().toISOString() };
    setRes(out); setAll(false);
    writeCache(cacheKey(messageId, lang), out);
  }

  async function send(m: Match) {
    if (!conversationId || !viewerId) return;
    const k = `${m.kind}:${m.id}`;
    setSent(s => ({ ...s, [k]: "busy" }));
    const r = await sendMessage(conversationId, viewerId,
      listingMessageText({ kind: m.kind, id: m.id }, W(lang, "This home fits what you're looking for.", "Este inmueble se ajusta a lo que busca.")));
    setSent(s => ({ ...s, [k]: "ok" in r ? "done" : "fail" }));
  }

  const looking = p.looking_for === "rent" ? W(lang, "Looking to rent", "Busca arrendar")
    : p.looking_for === "buy" ? W(lang, "Looking to buy", "Busca comprar") : W(lang, "Renting or buying", "Arrendar o comprar");
  const shown = res ? (all ? res.matches : res.matches.slice(0, 5)) : [];

  return (
    <div data-ow="home-profile-card" className={`w-[min(80vw,300px)] overflow-hidden rounded-xl ${mine ? "bg-white/15" : "bg-white/70 dark:bg-white/[0.06]"}`}>
      {p.note && <p className="whitespace-pre-wrap break-words px-3 pt-2.5 text-[13.5px]">{p.note}</p>}
      <div className="flex items-center gap-2.5 px-3 pt-2.5">
        <Avatar src={p.photo} name={p.name} size={40} rounded="rounded-full" textSize="text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold leading-tight">{p.name || W(lang, "Member", "Miembro")}</p>
          <p className={`truncate text-[11.5px] ${mine ? "text-white/75" : "opacity-60"}`}>
            {[p.location, looking].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <p className={`px-3 pt-2.5 text-[10.5px] font-black uppercase tracking-[0.14em] ${mine ? "text-white/70" : "opacity-50"}`}>
        {W(lang, "Ideal home profile", "Perfil de hogar ideal")}
      </p>
      <ol className="space-y-1.5 px-3 pb-3 pt-1.5">
        {p.priorities.map((x, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black ${
              mine ? "bg-white/25 text-white" : "bg-brand text-white"}`}>{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold leading-snug">{x.label}</span>
              {x.detail && <span className={`block text-[11.5px] leading-snug ${mine ? "text-white/75" : "opacity-60"}`}>{x.detail}</span>}
            </span>
          </li>
        ))}
      </ol>

      {canMatch && (
        <div className="border-t border-ink/10 px-3 pb-3 pt-2.5 dark:border-white/10">
          {!res && (
            <button type="button" onClick={() => void match()} disabled={busy}
              className="btn-primary flex h-10 w-full items-center justify-center gap-1.5 text-[13.5px] disabled:opacity-60">
              <Sparkle />{busy ? W(lang, "Matching your homes…", "Buscando entre sus inmuebles…") : W(lang, "Match with my properties", "Comparar con mis inmuebles")}
            </button>
          )}
          {err && <p role="alert" className="mt-2 text-[12px] font-semibold text-red-600 dark:text-red-400">{err}</p>}

          {res && (
            <div aria-live="polite">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12.5px] font-black">
                  {res.matches.length
                    ? W(lang, "Best fits from your homes", "Lo que mejor encaja de sus inmuebles")
                    : W(lang, "None of your homes fit yet", "Aún no encaja ninguno de sus inmuebles")}
                </p>
                <button type="button" onClick={() => void match()} disabled={busy}
                  className="shrink-0 text-[11.5px] font-bold text-brand-deep underline-offset-2 hover:underline disabled:opacity-50 dark:text-brand-light">
                  {busy ? "…" : W(lang, "Match again", "Volver a comparar")}
                </button>
              </div>
              <p className="text-[11px] opacity-55">
                {Wt(lang, "VAIA checked {0} of your published homes against this profile.", "VAIA revisó {0} de sus inmuebles publicados con este perfil.", [res.considered])}
              </p>
              <ul className="mt-2 space-y-2">
                {shown.map(m => {
                  const k = `${m.kind}:${m.id}`;
                  const st = sent[k];
                  return (
                    <li key={k} className="rounded-xl border border-ink/10 bg-white/80 p-2 dark:border-white/10 dark:bg-white/[0.04]">
                      <button type="button" onClick={() => nav(listingPath(m))} className="ow-tap flex w-full items-start gap-2 text-left">
                        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink/[0.06] dark:bg-white/10">
                          {m.photo && <img decoding="async" src={m.photo} alt="" className="h-full w-full object-cover"
                            onError={e => { e.currentTarget.style.display = "none"; }} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="line-clamp-2 text-[12.5px] font-bold leading-snug">{m.title ?? W(lang, "Property", "Propiedad")}</span>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-black tabular-nums ${fitTone(m.score)}`}>{m.score}%</span>
                          </span>
                          {m.verdict && <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug opacity-70">{m.verdict}</span>}
                        </span>
                      </button>
                      <div className="mt-1.5 flex justify-end">
                        {st === "done" ? (
                          <span className="text-[11.5px] font-bold text-teal">✓ {W(lang, "Sent", "Enviado")}</span>
                        ) : (
                          <button type="button" onClick={() => void send(m)} disabled={st === "busy" || !conversationId}
                            className="ow-tap rounded-full border border-brand px-3 py-1 text-[11.5px] font-bold text-brand-deep disabled:opacity-50 dark:text-brand-light">
                            {st === "busy" ? "…" : st === "fail" ? W(lang, "Not sent. Try again", "No se envió. Reintentar") : W(lang, "Send in this chat", "Enviar en este chat")}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {res.matches.length > 5 && (
                <button type="button" onClick={() => setAll(a => !a)} className="mt-2 w-full text-center text-[12px] font-bold opacity-70">
                  {all ? W(lang, "Show fewer", "Mostrar menos") : Wt(lang, "Show all {0}", "Mostrar los {0}", [res.matches.length])}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fitTone(score: number): string {
  if (score >= 75) return "bg-teal/15 text-teal";
  if (score >= 50) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-ink/10 text-ink/70 dark:bg-white/10 dark:text-white/70";
}

function matchError(lang: string, code: string): string {
  switch (code) {
    case "daily_limit": return W(lang, "You've reached today's limit. Come back tomorrow.", "Llegó al límite de hoy. Vuelva mañana.");
    case "busy": return W(lang, "VAIA is busy right now. Try again in a minute.", "VAIA está ocupada en este momento. Inténtelo en un minuto.");
    case "signed_out": return W(lang, "Sign in to continue.", "Inicie sesión para continuar.");
    case "not_yours": return W(lang, "Only the person this was sent to can match it.", "Solo la persona que lo recibió puede compararlo.");
    case "no_listings": return W(lang, "Publish a home first, then match it here.", "Publique un inmueble primero y luego compárelo aquí.");
    case "none_for_rent": return W(lang, "They're looking to rent, and you have no published homes for rent.", "Busca arrendar y usted no tiene inmuebles publicados en arriendo.");
    case "none_for_sale": return W(lang, "They're looking to buy, and you have no published homes for sale.", "Busca comprar y usted no tiene inmuebles publicados en venta.");
    default: return W(lang, "Something went wrong. Please try again.", "Algo salió mal. Inténtelo de nuevo.");
  }
}

function Sparkle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9zM18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
    </svg>
  );
}
