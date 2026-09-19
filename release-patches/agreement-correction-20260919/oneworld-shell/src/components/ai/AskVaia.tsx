/* ============================================================================================
 * ASK VAIA — the thing the "Tap for insights" pill opens. SHELL.
 * ============================================================================================
 * Lee, 14 September 2026: *"Make sure VAIA is working, making sure she has a full knowledge base
 * of what's going on. She should be trained based on whatever we have in the code so she can speak
 * intelligently to anyone who has a question, and she should be able to speak in at least Latin
 * American Spanish and English."*
 *
 * ⚠️ SHE WAS NOT WORKING. Not "answering badly" — the button did nothing at all. `VaiaPill` in
 * `ScreenHeading.tsx` dispatches an `ow-vaia-open` window event, and the ONLY listener in the
 * whole codebase was inside OneEvent. On OneHome, OneJob, OneScore, OneSocial and every other
 * product, tapping VAIA fired an event into an empty room. Found by grepping for the listener
 * rather than by tapping the pill, which is the only reason it was found at all: a control that
 * silently does nothing looks identical to a control that is thinking.
 *
 * ── WHY THIS LIVES IN THE SHELL ──────────────────────────────────────────────────────────────
 * The pill is a shell component, rendered on every screen of every product by `ScreenHeading`.
 * A pill owned by the shell that opens a panel owned by one product is how eight products end up
 * with eight different VAIAs — which is the exact failure the shared-chrome rule exists to stop.
 * OneEvent keeps its own richer panel (voice-first, live transcription) and is skipped below;
 * everybody else gets this one, and the two share a backend and an identity.
 *
 * ── WHAT SHE KNOWS ───────────────────────────────────────────────────────────────────────────
 * Nothing, here. The knowledge is the `product` field sent to `vaia-chat`, which chooses the
 * system prompt server-side. That is deliberate: a product's knowledge base changes far more often
 * than this component, and shipping a new client build to correct a sentence VAIA says would be
 * absurd.
 *
 * ⚠️ AND `product` WAS NEVER SENT BY ANYBODY. The edge function has had a carefully written
 * OneEvent prompt for weeks and reads `product` from the request body to select it — while the
 * only client calling it sends `messages`, `userId`, `plan` and `addon`. So OneEvent's VAIA has
 * been answering as the OneSocial career assistant, talking about endorsements and job
 * applications to somebody running a ticketed event. Two halves of one feature, each correct,
 * never introduced.
 * ========================================================================================== */
import { useEffect, useRef, useState } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON } from "../../lib/supabase";
import { useI18n, W } from "../../lib/i18n";
import VaiaFace from "../VaiaFace";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${SUPABASE_URL}/functions/v1/vaia-chat`;

export default function AskVaia({ product }: { product: string }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener("ow-vaia-open", openIt);
    return () => window.removeEventListener("ow-vaia-open", openIt);
  }, []);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages]);

  /* Escape closes, because a panel that only closes by finding a small × is a panel people leave
     open and then tap through by accident. */
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setInput(""); setErr(null); setBusy(true);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);

    try {
      /* The function requires a real JWT and refuses anything else — it reads the caller's own
         profile with the service role, so an anonymous key must never be enough. */
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("signed-out");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: next,
          userId: session?.user?.id,
          /* The two fields that were missing. `product` picks the knowledge base; `lang` is what
             makes her answer in the language the member is reading the app in. */
          product,
          lang,
        }),
      });
      if (!resp.ok || !resp.body) {
        const body = await resp.json().catch(() => ({} as { error?: string }));
        throw new Error(body.error || String(resp.status));
      }

      /* Server-sent events from the AI gateway: one `data:` line per token, `[DONE]` at the end.
         Buffered by line, because a chunk boundary lands mid-JSON often enough to matter. */
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const piece = JSON.parse(payload)?.choices?.[0]?.delta?.content;
            if (typeof piece === "string" && piece) {
              answer += piece;
              setMessages(m => [...m.slice(0, -1), { role: "assistant", content: answer }]);
            }
          } catch { /* a partial frame; the next chunk completes it */ }
        }
      }
      if (!answer) throw new Error("empty");
    } catch (e) {
      /* Drop the empty assistant bubble rather than leaving a blank speech bubble on screen. */
      setMessages(m => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m));
      setErr(String((e as Error)?.message) === "signed-out"
        ? W(lang, "Sign in to ask VAIA.", "Inicie sesión para preguntarle a VAIA.")
        : W(lang, "VAIA could not answer just now. Try again in a moment.",
                  "VAIA no pudo responder en este momento. Inténtelo de nuevo en un momento."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="VAIA"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 backdrop-blur-[2px]"
      onClick={() => setOpen(false)}>
      <div className="ow-sheet flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-3xl p-4 sm:mb-4 sm:rounded-3xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5">
          <VaiaFace size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-black">VAIA</p>
            <p className="truncate text-[11.5px] opacity-55">
              {W(lang, "Ask about anything on this screen.", "Pregunte sobre cualquier cosa de esta pantalla.")}
            </p>
          </div>
          <button type="button" onClick={() => setOpen(false)}
            className="ow-tap grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-black opacity-60"
            aria-label={W(lang, "Close", "Cerrar")}>×</button>
        </div>

        <div ref={listRef} className="mt-3 min-h-[120px] flex-1 space-y-2.5 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="py-6 text-center text-[12.5px] leading-relaxed opacity-55">
              {W(lang, "She knows this product — how listings, contracts, deposits and payouts work here.",
                       "Ella conoce este producto: cómo funcionan los anuncios, los contratos, los depósitos y los pagos.")}
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "ow-ink-sel"
                  : "border border-ink/10 bg-white/45 dark:border-white/12 dark:bg-white/[0.06]"}`}>
                {m.content || (busy ? "…" : "")}
              </p>
            </div>
          ))}
          {err && <p role="alert" className="rounded-xl bg-red-500/10 p-2.5 text-[12.5px] font-semibold text-red-600 dark:text-red-300">{err}</p>}
        </div>

        <form className="mt-3 flex items-center gap-2"
          onSubmit={e => { e.preventDefault(); void ask(input); }}>
          <input className="input min-w-0 flex-1" value={input} onChange={e => setInput(e.target.value)}
            placeholder={W(lang, "Ask VAIA…", "Pregúntele a VAIA…")} aria-label={W(lang, "Ask VAIA", "Pregúntele a VAIA")} />
          <button type="submit" disabled={busy || !input.trim()} className="btn-primary shrink-0 px-4 py-3 disabled:opacity-40">
            {busy ? "…" : W(lang, "Ask", "Enviar")}
          </button>
        </form>
      </div>
    </div>
  );
}
