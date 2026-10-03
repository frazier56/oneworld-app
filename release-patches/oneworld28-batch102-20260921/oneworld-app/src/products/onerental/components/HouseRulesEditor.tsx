import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { W, Wt, useVoiceTranscription } from "@oneworld/shell";
import { extractRules, compareErrorText } from "../lib/homeCompare";
import { HOUSE_RULE_MAX_CHARS } from "../lib/plans";

/**
 * HOUSE RULES — ONE RULE AT A TIME, NUMBERED.
 * ============================================================================================
 * Lee, 17 September 2026: *"it's a free text field where they can enter each section and they
 * enter in a rule and they click enter. They enter another rule, click enter. So it's NOT a free
 * text field where you can just write a paragraph. Each rule takes up a section… and each rule is
 * worth no more than two sentences."*
 *
 * So: one input, one Add. Enter adds the rule. Every rule becomes its own numbered line that can
 * be edited or removed. A hundred characters is two sentences, and the counter shows what is
 * left rather than silently truncating.
 *
 * ⚠️ The cap comes from the HOST'S PLAN — three on Free, ten on Pro, fifty on VIP. When they are
 * at the cap the input is disabled and says so, rather than letting somebody type a rule and then
 * refusing it. The database enforces the same cap, because a form is not a guard.
 */
export default function HouseRulesEditor({
  lang, rules, max, planName, onChange,
}: {
  lang: string;
  rules: string[];
  max: number;
  /** Shown in the at-the-limit line, so the host knows which plan they are bumping against. */
  planName: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editingAt, setEditingAt] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const full = rules.length>= max;

  /* ── SPEAK THE RULES (Lee, 2 Oct 2026: "they can type it or speak it… the same code" as the
     ideal home). The same voice hook IdealHome uses; VAIA splits what was said into separate,
     numbered rules and they are appended — every one still editable and removable below. */
  const voice = useVoiceTranscription() as any;
  const listening: boolean = !!voice.listening;
  const [thinking, setThinking] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const wasListening = useRef(false);
  async function fromSpeech(heard: string) {
    const said = heard.trim();
    if (said.length < 3 || full) return;
    setThinking(true); setVoiceMsg(null);
    try {
      const r = await extractRules(said, max - rules.length, lang);
      const add = (r.rules ?? []).map(x => x.slice(0, HOUSE_RULE_MAX_CHARS)).slice(0, max - rules.length);
      if (!add.length) throw new Error(W(lang, "VAIA didn't hear a rule in that. Try again, one rule after another.", "VAIA no escuchó una regla. Intente de nuevo, una regla tras otra."));
      onChange([...rules, ...add]);
      setVoiceMsg({ ok: true, text: Wt(lang, "{0} rules added below. Edit or remove any of them.", "{0} reglas agregadas abajo. Edite o quite la que quiera.", [add.length]) });
    } catch (e: any) {
      setVoiceMsg({ ok: false, text: e?.code ? compareErrorText(lang, e.code) : (e?.message || compareErrorText(lang)) });
    } finally { setThinking(false); }
  }
  useEffect(() => {
    if (wasListening.current && !listening) { const heard = voice.confirm(); if (heard) void fromSpeech(heard); }
    wasListening.current = listening;
  }, [listening]); // eslint-disable-line react-hooks/exhaustive-deps

  function add() {
    const value = draft.trim();
    if (!value || full) return;
    onChange([...rules, value.slice(0, HOUSE_RULE_MAX_CHARS)]);
    setDraft("");
  }
  function saveEdit(i: number) {
    const value = editDraft.trim();
    if (!value) return;
    onChange(rules.map((r, n) => (n === i ? value.slice(0, HOUSE_RULE_MAX_CHARS) : r)));
    setEditingAt(null);
  }

  return (
    <div>
      <ol className="space-y-2">
        {rules.map((rule, i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-2xl border border-ink/10 p-3 dark:border-white/10">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-black text-white">
              {i + 1}
            </span>
            {editingAt === i ? (
              <>
                <input className="input min-w-0 flex-1" value={editDraft} maxLength={HOUSE_RULE_MAX_CHARS}
                  onChange={e => setEditDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveEdit(i); } }}
                  aria-label={W(lang, "Edit rule", "Editar regla")} autoFocus />
                <button type="button" onClick={() => saveEdit(i)} aria-label={W(lang, "Save rule", "Guardar regla")}
                  className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-brand"><Check size={17} /></button>
                <button type="button" onClick={() => setEditingAt(null)} aria-label={W(lang, "Cancel", "Cancelar")}
                  className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full opacity-60"><X size={17} /></button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 break-words text-[13.5px] leading-relaxed">{rule}</span>
                <button type="button" onClick={() => { setEditingAt(i); setEditDraft(rule); }}
                  aria-label={W(lang, "Edit rule", "Editar regla")}
                  className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full opacity-65"><Pencil size={15} /></button>
                <button type="button" onClick={() => onChange(rules.filter((_, n) => n !== i))}
                  aria-label={W(lang, "Remove rule", "Quitar regla")}
                  className="ow-tap grid h-9 w-9 shrink-0 place-items-center rounded-full opacity-65"><Trash2 size={15} /></button>
              </>
            )}
          </li>
        ))}
      </ol>

      {/* ⚠️ The field and its button are on ONE row here on purpose, and it is the one case where
          that is right: a short input beside a square icon button cannot wrap, because the button
          has no label to run off the edge. */}
      <div className={`${rules.length ? "mt-3" : ""} flex items-center gap-2`}>
        <input className="input min-w-0 flex-1" value={draft} disabled={full}
          maxLength={HOUSE_RULE_MAX_CHARS}
          placeholder={W(lang, "Add a rule, then press Enter", "Escriba una regla y pulse Entrar")}
          aria-label={W(lang, "Add a house rule", "Agregar una regla de la casa")}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} disabled={full || !draft.trim()}
          aria-label={W(lang, "Add rule", "Agregar regla")}
          className="ow-tap grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40">
          <Plus size={19} />
        </button>
      </div>

      <button type="button" disabled={full || thinking}
        onClick={() => { if (listening) void fromSpeech(voice.confirm()); else { setVoiceMsg(null); voice.startRecording(); } }}
        className={`ow-tap mt-2 w-full whitespace-nowrap rounded-2xl py-2.5 text-[13.5px] font-bold disabled:opacity-45 ${listening
          ? "bg-red-500 text-white" : "border-2 border-brand bg-brand/10 text-brand-deep dark:text-brand-light"}`}>
        {thinking ? W(lang, "Writing your rules…", "Escribiendo sus reglas…")
          : listening ? W(lang, "Stop and add", "Detener y agregar") : W(lang, "Speak your rules", "Dicte sus reglas")}
      </button>
      {listening && voice.transcript && <p className="mt-1.5 text-[12.5px] italic opacity-70">{String(voice.transcript)}</p>}
      {voiceMsg && <p role={voiceMsg.ok ? "status" : "alert"} className={`mt-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold ${voiceMsg.ok
        ? "bg-teal/10 text-teal-deep dark:text-teal-light" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>{voiceMsg.text}</p>}
      {voice.error && <p className="mt-1.5 text-[12px] font-semibold text-amber-700 dark:text-amber-300">
        {voice.error === "blocked" ? W(lang, "The microphone is blocked — allow it for this site, or type instead.", "El micrófono está bloqueado — permítalo para este sitio, o escriba.")
          : W(lang, "Voice isn't available here — type instead.", "La voz no está disponible aquí — escriba.")}</p>}

      <p className="mt-2 text-[11.5px] leading-relaxed opacity-60">
        {full
          ? Wt(lang, "Your {0} plan allows {1} rules. Remove one to add another, or upgrade.", "Su plan {0} permite {1} reglas. Quite una para agregar otra, o mejore su plan.", [planName, max])
          : Wt(lang, "{0} of {1} rules. Keep each one to two sentences — {2} characters.", "{0} de {1} reglas. Máximo dos frases por regla — {2} caracteres.", [rules.length, max, HOUSE_RULE_MAX_CHARS])}
      </p>
    </div>
  );
}
