import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { EDITABLE_FIELDS, pickEditable } from "../lib/profileContract";
import AiTextField from "../components/ai/AiTextField";

/**
 * EDIT PROFILE — the person edits their OWN One ID profile.
 * ============================================================================================
 * Task 1.3.c. One profile, shared across every product (One ID), so this screen edits the shared
 * `profiles` row and every product sees the change. It is the same framework as the sign-up wizard
 * — glass cards, clay action, teal state — because it collects the same profile-level information;
 * only the words differ (Taycan/Ferrari rule).
 *
 * SAFETY: every write goes through `pickEditable()` from the profile contract, so this screen can
 * physically only change the fields the contract marks editable. A computed field (a score, a photo
 * grade), a billing field, or an admin flag cannot be written from here even if a value is somehow
 * put in the payload — the contract is the gate, not the good intentions of this component.
 *
 * NOT here yet, on purpose: photo / banner UPLOAD. There is no storage-upload helper wired into the
 * shell, and a half-working uploader is worse than none — so it is a named follow-up, not a broken
 * control on this screen.
 */

/** Only the plain text-content fields belong on this screen (upload + toggles are separate). */
const TEXT_FIELDS: { key: string; label: string; placeholder?: string; multiline?: boolean; type?: string }[] = [
  { key: "full_name", label: "Full name", placeholder: "Your name" },
  { key: "job_title", label: "What you do", placeholder: "e.g. Electrician, Photographer" },
  { key: "industry", label: "Industry", placeholder: "e.g. Construction, Events" },
  { key: "category", label: "Category", placeholder: "Your main category" },
  { key: "subcategory", label: "Speciality", placeholder: "Optional" },
  { key: "custom_expertise", label: "Expertise", placeholder: "A few words about what you're great at" },
  { key: "years_experience", label: "Years of experience", placeholder: "e.g. 8", type: "number" },
  { key: "location", label: "Your Location", placeholder: "City, State" },
  { key: "bio", label: "About you", placeholder: "Tell people who you are", multiline: true },
];

const say = (e: unknown): string => {
  const m = (e as any)?.message ?? (e as any)?.error_description ?? (e as any)?.error;
  if (typeof m === "string" && m.trim()) return m;
  if (typeof e === "string" && e.trim()) return e;
  return "Something went wrong saving your profile. Try again in a moment.";
};

/**
 * ONE FIELD — DEFINED AT MODULE SCOPE, NOT INSIDE THE SCREEN.
 * A component declared inside another component gets a NEW function identity on every parent
 * render, so React unmounts and remounts its <input>, dropping the caret and the mobile keyboard
 * after a single keystroke. This codebase has paid for that bug more than once (SignUp `Field`,
 * ResetPassword `Field`). Module scope gives the input a stable identity so React reconciles it.
 */
type FieldSpec = { key: string; label: string; placeholder?: string; multiline?: boolean; type?: string };
function ProfileField({ f, value, onChange, inputRef }: {
  f: FieldSpec; value: string; onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium opacity-75">{f.label}</span>
      {/* THE BIO IS THE ONE FIELD EVERY PRODUCT SHARES, so giving it the writing assist here gives
          it to all seven at once — and a bio is the field people most often abandon at a blank
          box. `offerChooser` is on: this is a long field where "Speak it / Type it" earns its
          place. Any other multiline profile field gets the assist too, which is correct — they
          are all prose about the same person. */}
      {f.multiline ? (
        f.key === "bio" ? (
          <AiTextField
            kind="bio" fieldLabel={f.label} subject="yourself" format="text"
            rows={4} charLimit={1200} offerChooser
            notesPlaceholder="E.g. eight years letting furnished flats in El Poblado and Laureles, mostly to expats, and I handle the contract and the deposit myself."
            value={value} onChange={onChange} placeholder={f.placeholder} />
        ) : (
        <textarea
          value={value} placeholder={f.placeholder} rows={4}
          onChange={e => onChange(e.target.value)}
          className="card w-full resize-none rounded-2xl px-4 py-3 text-[15px] outline-none" />
        )
      ) : (
        <input
          ref={inputRef}
          value={value} placeholder={f.placeholder}
          inputMode={f.type === "number" ? "numeric" : undefined}
          onChange={e => onChange(f.type === "number" ? e.target.value.replace(/\D/g, "") : e.target.value)}
          className="card w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none" />
      )}
    </label>
  );
}

export default function ProfileEdit({ next = "/yourworld" }: { next?: string }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (alive) setLoading(false); return; }
      const cols = [...EDITABLE_FIELDS, "is_public"].join(", ");
      const { data, error } = await supabase.from("profiles").select(cols).eq("id", user.id).maybeSingle();
      if (!alive) return;
      if (error) setErr(say(error));
      else if (data) {
        const f: Record<string, string> = {};
        for (const k of EDITABLE_FIELDS) {
          const v = (data as any)[k];
          f[k] = v == null ? "" : String(v);
        }
        setForm(f);
        setIsPublic(!!(data as any).is_public);
      }
      setLoading(false);
      setTimeout(() => firstRef.current?.focus(), 60);
    })();
    return () => { alive = false; };
  }, []);

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const save = async () => {
    setErr(null); setBusy(true); setSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setErr("You're signed out — sign in and try again."); return; }

    /* The contract is the gate: only editable fields survive `pickEditable`. Empty strings are
       written as NULL so clearing a field actually clears it rather than storing "". */
    const editable = pickEditable(form);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(editable)) {
      const s = typeof v === "string" ? v.trim() : v;
      if (k === "years_experience") patch[k] = s ? Number(s) : null;
      else patch[k] = s === "" ? null : s;
    }
    patch.is_public = isPublic;   // a preference, whitelisted explicitly (not via pickEditable)

    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    setBusy(false);
    if (error) { setErr(say(error)); return; }
    setSaved(true);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="space-y-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">Edit your profile</h1>
        <p className="text-[14px] opacity-70">This is your One ID — it follows you into every One World product.</p>
      </div>

      {loading ? (
        <p className="text-center text-[13px] font-medium opacity-60">Loading your profile…</p>
      ) : (
        <>
          <div className="space-y-3">
            {TEXT_FIELDS.map(f => (
              <ProfileField key={f.key} f={f}
                value={form[f.key] ?? ""}
                onChange={v => set(f.key, v)}
                inputRef={f.key === "full_name" ? firstRef : undefined} />
            ))}
          </div>

          {/* ── VISIBILITY — a real toggle, teal when on (shared "state" colour) ───────────────── */}
          <div className="card flex items-start justify-between gap-3 rounded-2xl p-4">
            <div className="space-y-0.5">
              <p className="text-[14px] font-semibold">Public profile</p>
              <p className="text-[12px] opacity-65">Let people find and view your profile across One World.</p>
            </div>
            <button
              role="switch" aria-checked={isPublic}
              onClick={() => { setIsPublic(v => !v); setSaved(false); }}
              className={`ow-tap relative h-6 w-11 shrink-0 rounded-full transition ${isPublic ? "bg-teal" : "bg-ink/20 dark:bg-white/20"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isPublic ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>

          {err && <p className="text-center text-[13px] font-medium text-red-500">{err}</p>}
          {saved && <p className="text-center text-[13px] font-medium text-teal">Saved.</p>}

          <button onClick={() => void save()} disabled={busy}
            className="ow-tap btn-primary w-full rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-50">
            {busy ? "Saving…" : "Save changes"}
          </button>

          <button onClick={() => window.location.replace(next)}
            className="ow-tap block w-full pt-1 text-center text-[13px] font-medium opacity-55">
            Done
          </button>
        </>
      )}
    </div>
  );
}
