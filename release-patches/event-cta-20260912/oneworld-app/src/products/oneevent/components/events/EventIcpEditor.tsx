/**
 * EventIcpEditor — Inline editor for the event's ICP (Ideal Candidate Profile).
 * Shown at the top of the Applicants tab. Required before VAIA can score applicants.
 *
 * v31 (Lee): the ICP card was eating the top of the Applicants tab while "the real
 * information is right below it". It now renders COLLAPSED by default as a single
 * compact row with an enable switch — switching it ON expands the editor, switching
 * it OFF collapses it back. The saved ICP is never deleted by collapsing.
 */
import { useState } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { Save, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@evt/components/ui/switch";
import { SpeakOrTypeField } from "@evt/components/app/SpeakOrTypeField";

interface Props {
  eventId: string;
  initialIcp: string | null;
  onSaved: (next: string) => void;
}

export default function EventIcpEditor({ eventId, initialIcp, onSaved }: Props) {
  const [open, setOpen] = useState(false); // v31: collapsed by default, always
  const [editing, setEditing] = useState(!initialIcp);
  const [draft, setDraft] = useState(initialIcp || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (draft.trim().length < 10) {
      toast.error("ICP needs at least a sentence describing your ideal candidate.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({ application_icp_description: draft.trim() })
      .eq("id", eventId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save ICP");
      return;
    }
    toast.success("ICP saved — VAIA can now score applicants.");
    onSaved(draft.trim());
    setEditing(false);
  };

  return (
    <div className={`rounded-2xl border p-3 mb-4 transition-colors ${open ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      {/* Always-visible compact header row: title + Set chip + enable switch */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 min-w-0 text-left flex-1"
        >
          <Sparkles className={`w-4 h-4 shrink-0 ${open ? "text-primary" : "text-muted-foreground"}`} />
          <h3 className={`text-sm font-bold truncate ${open ? "text-foreground" : "text-muted-foreground"}`}>
            Ideal Candidate Profile (ICP)
          </h3>
          {initialIcp && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary font-semibold shrink-0">
              <Check className="w-3 h-3" /> Set
            </span>
          )}
        </button>
        <Switch checked={open} onCheckedChange={setOpen} aria-label="Enable ICP scoring section" />
      </div>
      {!open && (
        <p className="mt-1 text-[11px] text-muted-foreground leading-snug pl-6">
          {initialIcp
            ? "VAIA scores each applicant against your saved profile. Switch on to view or edit."
            : "Optional — switch on to describe your ideal applicant and VAIA will score every application 0–10."}
        </p>
      )}

      {open && (editing ? (
        <div className="mt-3">
          {/* v19 (Lee): the OneJob speak-or-type pattern replaces the old textarea +
              red "Listening…" helper — the composer is the same one the contract form
              uses, and the caption gets its own full-width line (no more squished
              left column beside the mic UI). */}
          <SpeakOrTypeField
            mode="plain"
            value={draft}
            onChange={setDraft}
            type="icp"
            charLimit={800}
            rows={3}
            placeholder="Describe your ideal applicant: their background, role, experience level, vibe, goals. The more specific, the smarter VAIA scores."
            fieldLabel="Ideal Candidate Profile"
            chooserPrompt="How do you want to describe your ideal applicant?"
            hint="Talking is faster — describe them out loud and VAIA writes the profile for you."
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            VAIA will score every applicant 0–10 against this — red to green, right on their row.
          </p>
          <div className="flex items-center justify-end mt-2 gap-2 flex-wrap">
            <div className="flex gap-2">
              {initialIcp && (
                <button
                  onClick={() => { setDraft(initialIcp); setEditing(false); }}
                  className="px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3 h-3" /> {saving ? "Saving…" : "Save ICP"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{initialIcp}</p>
          <button
            onClick={() => setEditing(true)}
            className="mt-2 text-xs text-primary font-semibold hover:opacity-80"
          >
            Edit profile
          </button>
        </div>
      ))}
    </div>
  );
}
