import { useEffect, useMemo, useRef, useState } from "react";
import { ROLODEX_FIELDS, RolodexField, RolodexFieldKey, RolodexFormValues } from "@evt/lib/rolodexSchema";
import { Camera, ChevronLeft, ChevronRight, Loader2, Check } from "lucide-react";
import { supabase } from "@evt/integrations/supabase/client";
import { toast } from "sonner";
import { GooglePlacesAutocomplete } from "@evt/components/ui/google-places-autocomplete";

interface Props {
  initial?: RolodexFormValues;
  submitLabel: string;
  onSubmit: (values: RolodexFormValues) => Promise<void> | void;
  onCancel?: () => void;
  /** When true, hides the photo upload (e.g., for public form to keep it short). */
  hidePhoto?: boolean;
  /** Storage bucket for photo upload (defaults to "avatars"). */
  bucket?: string;
  busy?: boolean;
}

interface Step {
  id: string;
  title: string;
  fields: RolodexFieldKey[];
}

// Group fields into bite-sized wizard steps (1–2 fields each).
const BASE_STEPS: Step[] = [
  { id: "name",        title: "Their name",            fields: ["name"] },
  { id: "contact",     title: "How to reach them",     fields: ["whatsapp_link", "phone"] },
  { id: "email",       title: "Email",                 fields: ["email"] },
  { id: "location",    title: "Location",              fields: ["location"] },
  { id: "profession",  title: "What they do",          fields: ["profession"] },
  { id: "business",    title: "Business",              fields: ["business_name", "website"] },
  { id: "sells",       title: "Do they sell something?", fields: ["sells_something"] },
  { id: "what_sell",   title: "What do they sell?",    fields: ["what_they_sell"] }, // conditional
  { id: "who_help",    title: "Who do they help?",     fields: ["who_they_help"] },
  { id: "niche",       title: "Niche",                 fields: ["niche"] },
  { id: "bottleneck",  title: "Current bottleneck",    fields: ["current_bottleneck"] },
  { id: "money",       title: "Numbers",               fields: ["monthly_revenue", "offer_price"] },
  { id: "referrals",   title: "Pays referral fees?",   fields: ["pays_referral_fees"] },
  { id: "notes",       title: "Notes",                 fields: ["notes"] },
];

export default function RolodexContactForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  hidePhoto = false,
  bucket = "avatars",
  busy = false,
}: Props) {
  const [values, setValues] = useState<RolodexFormValues>(initial || {});
  const [uploading, setUploading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  const setField = (key: RolodexFieldKey, val: string) =>
    setValues((v) => ({ ...v, [key]: val }));

  // Filter steps based on conditionals (skip "What do they sell?" if not "Yes")
  const steps = useMemo(() => {
    return BASE_STEPS.filter((s) => {
      if (s.id === "what_sell") return values.sells_something === "Yes";
      return true;
    });
  }, [values.sells_something]);

  const totalSteps = steps.length;
  const currentStep = steps[Math.min(stepIdx, totalSteps - 1)];
  const isLastStep = stepIdx >= totalSteps - 1;

  const handlePhoto = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `rolodex/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setField("photo_url", data.publicUrl);
    } catch (err: any) {
      toast.error(err?.message || "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const validateMinimum = () => {
    if (!values.name?.trim() && !values.email?.trim() && !values.phone?.trim() && !values.whatsapp_link?.trim()) {
      toast.error("Add at least a name, email, phone, or WhatsApp link");
      return false;
    }
    return true;
  };

  const handleNext = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLastStep) {
      if (!validateMinimum()) return;
      onSubmit(values);
      return;
    }
    // Keep the keyboard up on iOS: refocus the next step's first input synchronously
    // before the browser collapses the soft keyboard.
    const node = firstInputRef.current;
    setStepIdx((i) => Math.min(i + 1, totalSteps - 1));
    // After state flush, the new step's first input mounts and gets focus via autoFocus.
    // As a fallback (for textareas/selects), nudge focus next frame.
    requestAnimationFrame(() => {
      firstInputRef.current?.focus?.();
    });
    // Prevent the prior input from blurring before the new one mounts
    node?.focus?.();
  };

  const handleBack = () => {
    setStepIdx((i) => Math.max(i - 1, 0));
    requestAnimationFrame(() => firstInputRef.current?.focus?.());
  };

  // When the visible step changes, ensure the first input is focused.
  useEffect(() => {
    const id = requestAnimationFrame(() => firstInputRef.current?.focus?.());
    return () => cancelAnimationFrame(id);
  }, [stepIdx]);

  const renderField = (field: RolodexField, isFirst: boolean) => {
    const val = (values[field.key] as string) || "";
    const baseClass =
      "w-full px-4 py-3 rounded-lg bg-secondary border border-border text-base text-foreground outline-none focus:border-primary";

    if (field.key === "location") {
      return (
        <div key={field.key}>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">{field.label}</label>
          <GooglePlacesAutocomplete
            value={val}
            onChange={(v) => setField("location", v)}
            onSelect={(v) => setField("location", v)}
            placeholder={field.placeholder}
            types={["(cities)"]}
          />
        </div>
      );
    }

    if (field.key === "sells_something" || field.key === "pays_referral_fees") {
      const options = field.options?.filter((o) => o !== "") || [];
      return (
        <div key={field.key}>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">{field.label}</label>
          <div className="grid grid-cols-3 gap-2">
            {options.map((opt) => {
              const active = val === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setField(field.key, opt)}
                  className={`px-3 py-3 rounded-lg border text-sm font-semibold transition-colors ${
                    active
                      ? "evt-chip-active bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border text-foreground"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.key}>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">{field.label}</label>
          <textarea
            ref={isFirst ? (firstInputRef as any) : undefined}
            rows={3}
            value={val}
            placeholder={field.placeholder}
            onChange={(e) => setField(field.key, e.target.value)}
            className={`${baseClass} resize-none`}
          />
        </div>
      );
    }

    return (
      <div key={field.key}>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">{field.label}</label>
        <input
          ref={isFirst ? (firstInputRef as any) : undefined}
          type={field.type === "image" ? "text" : field.type}
          value={val}
          placeholder={field.placeholder}
          onChange={(e) => setField(field.key, e.target.value)}
          enterKeyHint={isLastStep ? "done" : "next"}
          autoFocus={isFirst}
          className={baseClass}
        />
      </div>
    );
  };

  const progressPct = Math.round(((stepIdx + 1) / totalSteps) * 100);

  return (
    <form onSubmit={handleNext} className="flex flex-col h-full min-h-[420px]">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            Step {stepIdx + 1} of {totalSteps}
          </span>
          <span className="text-xs font-semibold text-primary">{progressPct}%</span>
        </div>
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Photo on first step only */}
      {!hidePhoto && stepIdx === 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center shrink-0">
            {values.photo_url ? (
              <img src={values.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <label className="flex-1 cursor-pointer">
            <span className="text-xs font-semibold text-primary">
              {values.photo_url ? "Change photo" : "Add photo (optional)"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
            />
            {uploading && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
          </label>
        </div>
      )}

      {/* Step body */}
      <div className="flex-1 space-y-4">
        <h3 className="text-base font-bold text-foreground">{currentStep.title}</h3>
        {currentStep.fields.map((key, idx) => {
          const field = ROLODEX_FIELDS.find((f) => f.key === key);
          if (!field) return null;
          return renderField(field, idx === 0);
        })}
      </div>

      {/* Sticky footer nav (sits above the keyboard on mobile) */}
      <div
        className="sticky bottom-0 left-0 right-0 mt-6 pt-3 bg-card border-t border-border flex items-center gap-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)" }}
      >
        {stepIdx > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-3 rounded-lg bg-secondary border border-border text-sm font-semibold text-foreground flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 rounded-lg bg-secondary border border-border text-sm font-semibold text-foreground"
          >
            Cancel
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={busy || uploading}
          className="flex-1 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLastStep ? (
            <>
              <Check className="w-4 h-4" /> {submitLabel}
            </>
          ) : (
            <>
              Next <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
