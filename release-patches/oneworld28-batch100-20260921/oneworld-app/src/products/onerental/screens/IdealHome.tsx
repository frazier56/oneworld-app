import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useI18n, useOneId, productHref, W, ScreenHeading, VaiaFace, useVoiceTranscription,
} from "@oneworld/shell";
import { loadProfile, saveProfile, extractPriorities, compareErrorText, type Priority, type HomeProfile } from "../lib/homeCompare";
import { useHomeProduct } from "../lib/homeCompare";

/**
 * YOUR IDEAL HOME — the five things that matter, in order. (Lee, 2 Oct 2026)
 * ============================================================================================
 * *"What is the property you're looking for? List the top five things in order of priority…
 * you could just talk it… king bed, an air conditioner, a separate dryer, in Poblado close to
 * downtown… boom, you define what you need, now compare."*
 *
 * Speak or type it; VAIA turns it into at most five ranked, checkable priorities; you can fix the
 * wording, change the order, drop or add one, then save. Every comparison is judged against this.
 * Defining it is free — it is what makes a comparison worth paying for.
 */
export default function IdealHome() {
  const { lang } = useI18n();
  const prod = useHomeProduct();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const back = params.get("return");

  const [text, setText] = useState("");
  const [list, setList] = useState<Priority[]>([]);
  const [lookingFor, setLookingFor] = useState<HomeProfile["looking_for"]>("either");
  const [busy, setBusy] = useState<"" | "think" | "save">("");
  const [updated, setUpdated] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const voice = useVoiceTranscription() as any;
  const base = useRef("");

  useEffect(() => {
    if (!userId) return;
    void loadProfile(userId).then(p => {
      if (p) { setList(p.priorities); setLookingFor(p.looking_for); setText(p.spoken ?? ""); }
      setLoaded(true);
    });
  }, [userId]);

  const listening: boolean = !!voice.listening;
  const live = listening ? [base.current.trim(), String(voice.transcript || "").trim()].filter(Boolean).join(" ") : text;
  const startMic = () => { base.current = text; voice.startRecording(); };
  const stopMic = () => { const heard = voice.confirm(); setText([base.current.trim(), heard].filter(Boolean).join(" ")); };
  const wasListening = useRef(false);
  useEffect(() => { if (wasListening.current && !listening) { const heard = voice.confirm(); if (heard) setText([base.current.trim(), heard].filter(Boolean).join(" ")); } wasListening.current = listening; }, [listening]); // eslint-disable-line

  async function build() {
    if (listening) stopMic();
    const said = (listening ? live : text).trim();
    if (said.length < 3) return;
    setBusy("think"); setErr(null); setUpdated(false);
    try {
      const r = await extractPriorities(said, lang);
      if (!r.priorities.length) throw new Error(W(lang, "VAIA could not find a priority in that. Try naming a few things you need.", "VAIA no encontró prioridades. Intente nombrar algunas cosas que necesita."));
      setList(r.priorities); if (r.looking_for) setLookingFor(r.looking_for);
      /* Lee, 2 Oct 2026: after "Redo list" nothing seemed to happen — often VAIA returns the same
         list, so the screen did not change. Say so, every time. */
      setUpdated(true);
      /* …and take them to it: the list is below the fold on a phone (Lee: "the screen should just
         shift up to where it says your top priorities"). */
      setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch (e: any) {
      setErr(e?.code ? compareErrorText(lang, e.code) : (e?.message || compareErrorText(lang)));
    } finally { setBusy(""); }
  }
  async function save() {
    const clean = list.map(p => ({ label: p.label.trim(), detail: (p.detail ?? "").trim() })).filter(p => p.label).slice(0, 5);
    if (!clean.length || !userId) return;
    setBusy("save"); setErr(null);
    const { error } = await saveProfile(userId, { priorities: clean, looking_for: lookingFor, spoken: text.trim() || null });
    setBusy("");
    if (error) { setErr(W(lang, "Your ideal home could not be saved. Please try again.", "No se pudo guardar su hogar ideal. Inténtelo de nuevo.")); return; }
    nav(back && back.startsWith("/") ? back : productHref(prod, "/saved"));
  }
  const move = (i: number, d: -1 | 1) => setList(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });

  return (
    <div className="space-y-4 pb-32">
      <ScreenHeading>{W(lang, "Your ideal home", "Su hogar ideal")}</ScreenHeading>

      <section className="card p-4">
        <div className="flex items-start gap-3">
          <VaiaFace size={44} />
          <p className="text-[13.5px] leading-relaxed">
            {W(lang, "What are you looking for? Say it the way you'd tell a friend — what you need, what you'd love, where. I'll turn it into your top five.",
                     "¿Qué está buscando? Dígalo como se lo diría a un amigo — lo que necesita, lo que le encantaría, dónde. Lo convierto en sus cinco prioridades.")}
          </p>
        </div>
        {listening ? (
          <div aria-live="polite" className="mt-3 min-h-[110px] rounded-2xl border border-brand/40 bg-brand/[0.04] px-3.5 py-3 text-[14.5px] leading-relaxed">
            {live || <span className="opacity-45">{W(lang, "Listening… start talking.", "Escuchando… empiece a hablar.")}</span>}
          </div>
        ) : (
          <textarea className="input mt-3 min-h-[110px] w-full text-[14.5px]" value={text} onChange={e => setText(e.target.value)}
            placeholder={W(lang, "E.g. a king bed, air conditioning, washer and a separate dryer, in El Poblado close to downtown, two bedrooms.",
                                  "Ej.: cama king, aire acondicionado, lavadora y secadora aparte, en El Poblado cerca del centro, dos habitaciones.")} />
        )}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {listening ? (
            <button type="button" onClick={stopMic} className="ow-tap rounded-2xl bg-red-500 py-3 text-[14.5px] font-bold text-white">
              {W(lang, "Stop", "Detener")}
            </button>
          ) : (
            <button type="button" onClick={startMic} className="ow-tap rounded-2xl border-2 border-brand bg-brand/10 py-3 text-[14.5px] font-bold text-brand-deep dark:text-brand-light">
              {W(lang, "Speak", "Hablar")}
            </button>
          )}
          <button type="button" onClick={() => void build()} disabled={!!busy || (listening ? live : text).trim().length < 3}
            className="btn-primary whitespace-nowrap text-[14.5px] disabled:opacity-45">
            {busy === "think" ? W(lang, "Thinking…", "Pensando…") : list.length ? W(lang, "Update list", "Actualizar lista") : W(lang, "Make my list", "Crear lista")}
          </button>
        </div>
        {voice.error && <p className="mt-2 text-[12px] font-semibold text-amber-700 dark:text-amber-300">
          {voice.error === "blocked" ? W(lang, "The microphone is blocked — allow it for this site, or type instead.", "El micrófono está bloqueado — permítalo para este sitio, o escriba.")
            : W(lang, "Voice isn't available here — type instead.", "La voz no está disponible aquí — escriba.")}</p>}
      </section>

      {/* The one-time guide after VAIA builds or updates the list (Lee, 2 Oct 2026: "a little pop-up
          … your priorities have been updated, you can reprioritize them with the arrows… click okay"). */}
      {updated && !err && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-6 backdrop-blur-sm" role="dialog" aria-modal="true"
          aria-label={W(lang, "Your priorities are updated", "Sus prioridades están actualizadas")} onClick={() => setUpdated(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-ink/10 bg-paper p-5 text-center shadow-xl dark:border-white/10 dark:bg-ink" onClick={e => e.stopPropagation()}>
            <p className="text-[16px] font-black">{W(lang, "Your priorities are updated", "Sus prioridades están actualizadas")}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed opacity-75">{W(lang,
              "They're listed below, most important first. Move them with the arrows, edit any line, then tap Save.",
              "Están abajo, la más importante primero. Muévalas con las flechas, edite cualquier línea y toque Guardar.")}</p>
            <button type="button" autoFocus className="btn-primary mt-4 w-full" onClick={() => setUpdated(false)}>OK</button>
          </div>
        </div>
      )}
      {err && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[12.5px] font-semibold text-red-600 dark:text-red-400">{err}</p>}

      {loaded && list.length > 0 && (
        <section ref={listRef} className="card scroll-mt-24 p-4">
          <h2 className="text-[15px] font-black tracking-tight">{W(lang, "Your top priorities", "Sus prioridades")}</h2>
          <p className="mt-0.5 text-[12px] opacity-60">{W(lang, "Most important first. Edit, reorder or remove anything.", "La más importante primero. Edite, reordene o quite lo que quiera.")}</p>
          <ol className="mt-3 space-y-2">
            {list.map((p, i) => (
              <li key={i} className="flex items-start gap-2 rounded-2xl border ow-edge p-2.5">
                <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-black text-white">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <textarea rows={p.label.length > 26 ? 2 : 1} className="w-full resize-none bg-transparent text-[14px] font-bold leading-snug outline-none" value={p.label} maxLength={80}
                    autoFocus={!p.label && i === list.length - 1}
                    placeholder={W(lang, "e.g. Parking for one car", "Ej.: Parqueadero para un carro")}
                    onChange={e => setList(l => l.map((x, k) => k === i ? { ...x, label: e.target.value.replace(/\n/g, " ") } : x))}
                    aria-label={W(lang, "Priority", "Prioridad")} />
                  <input className="w-full bg-transparent text-[12.5px] opacity-70 outline-none" value={p.detail ?? ""} maxLength={240}
                    placeholder={W(lang, "Detail (optional)", "Detalle (opcional)")}
                    onChange={e => setList(l => l.map((x, k) => k === i ? { ...x, detail: e.target.value } : x))} />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={W(lang, "Move up", "Subir")}
                    className="ow-edge ow-tap grid h-9 w-9 place-items-center rounded-lg border text-[14px] disabled:opacity-25">↑</button>
                  <button type="button" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={W(lang, "Move down", "Bajar")}
                    className="ow-edge ow-tap grid h-9 w-9 place-items-center rounded-lg border text-[14px] disabled:opacity-25">↓</button>
                </div>
                <button type="button" onClick={() => setList(l => l.filter((_, k) => k !== i))} aria-label={W(lang, "Remove", "Quitar")}
                  className="ow-tap -mr-1 grid h-9 w-8 place-items-center text-[20px] leading-none opacity-45">×</button>
              </li>
            ))}
          </ol>
          {list.length < 5 && (
            <button type="button" onClick={() => setList(l => [...l, { label: "", detail: "" }])}
              className="ow-edge ow-tap mt-2 w-full rounded-2xl border border-dashed py-2.5 text-[13px] font-bold">
              {W(lang, "+ Add a priority", "+ Agregar una prioridad")}
            </button>
          )}

          <p className="mt-4 text-[12px] font-bold opacity-60">{W(lang, "Looking to", "Busca")}</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {([["rent", W(lang, "Rent", "Arrendar")], ["buy", W(lang, "Buy", "Comprar")], ["either", W(lang, "Either", "Cualquiera")]] as [HomeProfile["looking_for"], string][]).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={lookingFor === v} onClick={() => setLookingFor(v)}
                className={`ow-tap rounded-xl border py-2 text-[13px] font-bold ${lookingFor === v ? "border-ink bg-ink text-paper dark:border-white dark:bg-white dark:text-ink" : "ow-edge"}`}>{label}</button>
            ))}
          </div>

          <button type="button" onClick={() => void save()} disabled={!!busy || !list.some(p => p.label.trim())}
            className="btn-primary mt-4 w-full disabled:opacity-45">
            {busy === "save" ? "…" : W(lang, "Save my ideal home", "Guardar mi hogar ideal")}
          </button>
        </section>
      )}
    </div>
  );
}
