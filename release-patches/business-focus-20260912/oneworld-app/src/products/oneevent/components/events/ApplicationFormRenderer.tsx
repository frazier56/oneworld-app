/**
 * ApplicationFormRenderer — Renders host-defined questions for applicants to fill.
 * Validates required fields and returns answers as a JSON-friendly map.
 */
import { useState, useCallback } from "react";
import { Input } from "@evt/components/ui/input";
import { Textarea } from "@evt/components/ui/textarea";
import { Button } from "@evt/components/ui/button";
import { Checkbox } from "@evt/components/ui/checkbox";
import type { AppQuestion } from "./ApplicationFormBuilder";
import { cn } from "@evt/lib/utils";
import QuickHirePhoneInput from "@evt/components/quick-hire/QuickHirePhoneInput";
import { findCountryByIso } from "@evt/lib/country-phone-data";
import { toast } from "sonner";
import { useLanguage } from "@evt/i18n/LanguageContext";

export type AnswerValue = string | string[] | number | null;
export type AnswerMap = Record<string, AnswerValue>;

interface Props {
  questions: AppQuestion[];
  initialAnswers?: AnswerMap;
  onSubmit: (answers: AnswerMap) => void | Promise<void>;
  /** Fires on every answer change — lets the page snapshot a draft (Back-safety). */
  onAnswersChange?: (answers: AnswerMap) => void;
  submitting?: boolean;
  submitLabel?: string;
  /** When true, submit is blocked with a toast — used in the host's Application Preview. */
  previewMode?: boolean;
}

export default function ApplicationFormRenderer({
  questions,
  initialAnswers,
  onSubmit,
  onAnswersChange,
  submitting,
  submitLabel = "Continue to payment",
  previewMode,
}: Props) {
  const { t } = useLanguage();
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Country ISO per phone-type question (defaults to US)
  const [phoneCountry, setPhoneCountry] = useState<Record<string, string>>({});

  const update = useCallback((id: string, val: AnswerValue) => {
    setAnswers(prev => {
      const next = { ...prev, [id]: val };
      onAnswersChange?.(next);
      return next;
    });
    setErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [onAnswersChange]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    for (const q of questions) {
      const v = answers[q.id];
      const empty =
        v === undefined ||
        v === null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (q.required && empty) {
        e[q.id] = t("apply.required", "This question is required");
        continue;
      }
      if (!empty) {
        if (q.type === "email" && typeof v === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          e[q.id] = "Enter a valid email";
        }
        if (q.type === "number" && typeof v === "string" && Number.isNaN(parseFloat(v))) {
          e[q.id] = "Enter a valid number";
        }
        if (q.type === "phone" && typeof v === "string" && v.replace(/\D/g, "").length < 7) {
          e[q.id] = "Enter a valid phone number";
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (previewMode) {
      toast.info("This is a preview — publish the event to accept real applications.");
      return;
    }
    if (!validate()) {
      /* NEVER a dead button (Lee, 17 Aug 2026): a validation miss above the fold used to look
         like the button doing nothing. Say it, and bring the first missed question on screen. */
      toast.error(t("apply.required_missing", "A required question still needs an answer — scroll up to the one in red."));
      requestAnimationFrame(() => {
        document.querySelector("[data-app-q-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    await onSubmit(answers);
  };

  return (
    <div className="space-y-5">
      {questions.map((q, i) => (
        <div key={q.id} className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            {i + 1}. {q.label}
            {q.required && <span className="text-primary ml-1">*</span>}
          </label>

          {q.type === "short_text" && (
            <Input
              value={(answers[q.id] as string) ?? ""}
              onChange={e => update(q.id, e.target.value)}
              maxLength={300}
              className={cn("bg-secondary border-border", errors[q.id] && "border-destructive")}
            />
          )}

          {q.type === "long_text" && (
            <Textarea
              value={(answers[q.id] as string) ?? ""}
              onChange={e => update(q.id, e.target.value)}
              maxLength={2000}
              rows={4}
              className={cn("bg-secondary border-border resize-none", errors[q.id] && "border-destructive")}
            />
          )}

          {q.type === "email" && (
            <Input
              type="email"
              value={(answers[q.id] as string) ?? ""}
              onChange={e => update(q.id, e.target.value)}
              className={cn("bg-secondary border-border", errors[q.id] && "border-destructive")}
            />
          )}

          {q.type === "phone" && (() => {
            const iso = phoneCountry[q.id] || "US";
            const dial = findCountryByIso(iso)?.code || "+1";
            const raw = (answers[q.id] as string) ?? "";
            // Strip a leading dial code if user previously stored one
            const localPart = raw.startsWith(dial) ? raw.slice(dial.length).trim() : raw;
            return (
              <div className={cn(errors[q.id] && "ring-1 ring-destructive rounded-md")}>
                <QuickHirePhoneInput
                  countryCode={iso}
                  phone={localPart}
                  onCountryChange={(newIso) => {
                    setPhoneCountry(prev => ({ ...prev, [q.id]: newIso }));
                    const newDial = findCountryByIso(newIso)?.code || "+1";
                    update(q.id, localPart ? `${newDial} ${localPart}` : "");
                  }}
                  onPhoneChange={(formatted) => {
                    update(q.id, formatted ? `${dial} ${formatted}` : "");
                  }}
                />
              </div>
            );
          })()}


          {q.type === "number" && (
            <Input
              type="number"
              value={(answers[q.id] as string) ?? ""}
              onChange={e => update(q.id, e.target.value)}
              className={cn("bg-secondary border-border", errors[q.id] && "border-destructive")}
            />
          )}

          {q.type === "date" && (
            <Input
              type="date"
              value={(answers[q.id] as string) ?? ""}
              onChange={e => update(q.id, e.target.value)}
              className={cn("bg-secondary border-border", errors[q.id] && "border-destructive")}
            />
          )}

          {q.type === "single_choice" && (
            <div className="space-y-2">
              {(q.options ?? []).filter(Boolean).map(opt => (
                <label
                  key={opt}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                    answers[q.id] === opt
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => update(q.id, opt)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-foreground">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {q.type === "multi_choice" && (
            <div className="space-y-2">
              {(q.options ?? []).filter(Boolean).map(opt => {
                const selected = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                const checked = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                      checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={c => {
                        const next = c
                          ? [...selected, opt]
                          : selected.filter(s => s !== opt);
                        update(q.id, next);
                      }}
                    />
                    <span className="text-sm text-foreground">{opt}</span>
                  </label>
                );
              })}
            </div>
          )}

          {errors[q.id] && (
            <p className="text-xs text-destructive" data-app-q-error>{errors[q.id]}</p>
          )}
        </div>
      ))}

      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-full bg-primary text-primary-foreground"
        size="lg"
      >
        {submitting ? t("apply.submitting", "Submitting…") : submitLabel}
      </Button>
    </div>
  );
}
