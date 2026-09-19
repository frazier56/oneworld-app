import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { W } from "@oneworld/shell";
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
  const full = rules.length >= max;

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

      <p className="mt-2 text-[11.5px] leading-relaxed opacity-60">
        {full
          ? W(lang, `Your ${planName} plan allows ${max} rules. Remove one to add another, or upgrade.`,
                    `Su plan ${planName} permite ${max} reglas. Quite una para agregar otra, o mejore su plan.`)
          : W(lang, `${rules.length} of ${max} rules. Keep each one to two sentences — ${HOUSE_RULE_MAX_CHARS} characters.`,
                    `${rules.length} de ${max} reglas. Máximo dos frases por regla — ${HOUSE_RULE_MAX_CHARS} caracteres.`)}
      </p>
    </div>
  );
}
