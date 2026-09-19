/**
 * SpeakOrTypeField — the OneJob "empty box IS the chooser" description pattern, ported to
 * OneEvent (Lee, 18 Aug 2026: *"look at the code for one job around this description box…
 * this is the code that needs to be used"* — his screenshot was OneJob's The-job field).
 *
 * Empty field → a chooser card: "How do you want to describe it?" with a big primary
 * SPEAK IT button (opens the VAIA composer already recording) and a quieter TYPE IT.
 * The moment there's text — typed, dictated, or VAIA-written — the chooser is gone for
 * good and it behaves like a normal editor, with the "Speak with AI" pill one tap away.
 *
 * Two modes:
 *  - "rich"  → RichTextEditor, onChange receives HTML (event descriptions, bios)
 *  - "plain" → textarea, onChange receives plain text (the ICP box)
 *
 * Free for everyone for now — Lee: "everyone needs to have this feature… it is a VIP
 * feature for later." No plan gate here; charLimit still comes from the caller's plan.
 */
import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { VaiaDescriptionModal } from "@evt/components/app/VaiaDescriptionModal";
import { RichTextEditor, stripRichTextHtml } from "@evt/components/ui/rich-text-editor";
import InfoTip from "@evt/components/InfoTip";

export function SpeakOrTypeField({
  mode = "rich", value, onChange, type, title, category, charLimit, placeholder, fieldLabel, error, rows = 3, chooserPrompt, hint, speakLabel = "Speak it", typeLabel = "Type it",
}: {
  mode?: "rich" | "plain";
  value: string;
  onChange: (next: string) => void;
  type?: string;
  title?: string;
  category?: string;
  charLimit?: number;
  placeholder?: string;
  fieldLabel?: string;
  error?: boolean;
  rows?: number;
  chooserPrompt?: string;
  hint?: string;
  speakLabel?: string;
  typeLabel?: string;
}) {
  const [vaiaOpen, setVaiaOpen] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);
  const [typingChosen, setTypingChosen] = useState(false);

  const plain = mode === "rich" ? stripRichTextHtml(value || "") : (value || "");
  const empty = !plain.trim();

  const openSpeak = (record: boolean) => { setAutoRecord(record); setVaiaOpen(true); };

  return (
    <div>
      {empty && !typingChosen ? (
        /* The empty box IS the chooser — speaking gets the primary weight, typing stays
           one tap away. Plain border, not an error box (OneJob ruling, Jul 31). */
        <div className={"rounded-2xl border p-4 " + (error ? "border-destructive/60" : "border-border bg-primary/[0.035]")}>
          <p className="text-center text-[13px] font-semibold text-foreground/70">
            {chooserPrompt || "How do you want to describe it?"}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => openSpeak(true)}
              className="ow-btn-espresso flex flex-[3] items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold">
              <Mic size={18} /> {speakLabel}
            </button>
            <button type="button" onClick={() => setTypingChosen(true)}
              className="flex-[2] rounded-2xl border border-border px-3 py-3.5 text-[15px] font-bold text-foreground transition active:scale-95">
              ⌨️ {typeLabel}
            </button>
          </div>
          <p className="mt-2.5 text-center text-[11.5px] leading-snug text-muted-foreground">
            {hint || "Talking is faster — describe it out loud and VAIA writes it for you."}
          </p>
        </div>
      ) : (
        <>
          {mode === "rich" ? (
            <RichTextEditor value={value} onChange={onChange} placeholder={placeholder} error={error} />
          ) : (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={rows}
              placeholder={placeholder}
              className={"w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground resize-none " + (error ? "border-destructive/60" : "border-border")}
            />
          )}
          {/* Still reachable mid-draft — VAIA takes what's in the box as starting notes. */}
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" onClick={() => openSpeak(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/10 active:scale-95">
              <Sparkles size={13} /> Speak with AI
            </button>
            <InfoTip text="Speak with AI (VAIA) — tap it and describe what you want out loud (or keep typing). VAIA turns your notes into clean, well-organized copy." />
          </div>
        </>
      )}

      <VaiaDescriptionModal
        open={vaiaOpen}
        onClose={() => setVaiaOpen(false)}
        type={type}
        title={title}
        category={category}
        charLimit={charLimit}
        currentDescription={value}
        fieldLabel={fieldLabel}
        autoRecord={autoRecord}
        onApply={(html) => {
          onChange(mode === "rich" ? html : stripRichTextHtml(html).trim());
          setTypingChosen(true);
        }}
      />
    </div>
  );
}
