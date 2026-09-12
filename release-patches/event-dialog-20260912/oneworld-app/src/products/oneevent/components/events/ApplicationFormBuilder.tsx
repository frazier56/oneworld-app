/**
 * ApplicationFormBuilder — Lets the host build a custom intake form for paid events.
 * Used inside CreateEventForm when `requires_application` is on.
 */
import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@evt/components/ui/input";
import { Button } from "@evt/components/ui/button";
import { Switch } from "@evt/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@evt/components/ui/select";
import { cn } from "@evt/lib/utils";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { createEventText } from "@evt/i18n/createEventLocale";

export type AppQuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multi_choice"
  | "number"
  | "email"
  | "phone"
  | "date";

export interface AppQuestion {
  id: string;
  type: AppQuestionType;
  label: string;
  required: boolean;
  options?: string[]; // for single/multi choice
}

const TYPE_LABEL_KEYS: Record<AppQuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  single_choice: "Single choice",
  multi_choice: "Multi choice",
  number: "Number",
  email: "Email",
  phone: "Phone",
  date: "Date",
};

const NEEDS_OPTIONS = (t: AppQuestionType) => t === "single_choice" || t === "multi_choice";

interface Props {
  questions: AppQuestion[];
  onChange: (qs: AppQuestion[]) => void;
}

export default function ApplicationFormBuilder({ questions, onChange }: Props) {
  const { lang } = useLanguage();
  const ce = (english: string) => createEventText(lang, english);
  const addQuestion = useCallback(() => {
    onChange([
      ...questions,
      {
        id: crypto.randomUUID(),
        type: "short_text",
        label: "",
        required: true,
      },
    ]);
  }, [questions, onChange]);

  const updateQ = useCallback(
    (id: string, patch: Partial<AppQuestion>) => {
      onChange(questions.map(q => (q.id === id ? { ...q, ...patch } : q)));
    },
    [questions, onChange]
  );

  const removeQ = useCallback(
    (id: string) => onChange(questions.filter(q => q.id !== id)),
    [questions, onChange]
  );

  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      const next = [...questions];
      const target = index + dir;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      onChange(next);
    },
    [questions, onChange]
  );

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.12] p-5 text-center">
          <p className="text-xs text-muted-foreground">
            {ce("No questions yet. Add the first one to start building your application form.")}
          </p>
        </div>
      )}

      {/* v24 DI (Lee): the old cards floated everything to the right on invisible borders.
          Redesigned: a real card per question — Q chip + reorder + delete on the header
          row, the label field FULL WIDTH with a visible outline, then labelled "Answer
          type" + "Required" side by side, everything anchored LEFT. */}
      {questions.map((q, i) => (
        <div
          key={q.id}
          className="rounded-xl border border-ink/15 bg-card p-3.5 space-y-3 dark:border-white/12"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
              Q{i + 1}
            </span>
            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30"
                aria-label={ce("Move up")}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1}
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30"
                aria-label={ce("Move down")}>↓</button>
            </div>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => removeQ(q.id)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-secondary text-muted-foreground hover:text-destructive hover:border-destructive/40"
              aria-label={ce("Remove question")}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{ce("Question")}</label>
            <Input
              value={q.label}
              onChange={e => updateQ(q.id, { label: e.target.value })}
              placeholder={ce("e.g. What is your company?")}
              className="w-full bg-background border-ink/25 dark:border-white/20 focus:border-primary/50 text-sm"
            />
          </div>

          <div className="flex items-end gap-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{ce("Answer type")}</label>
              <Select
                value={q.type}
                onValueChange={v => {
                  const t = v as AppQuestionType;
                  updateQ(q.id, {
                    type: t,
                    options: NEEDS_OPTIONS(t) ? q.options ?? [""] : undefined,
                  });
                }}
              >
                <SelectTrigger className="w-[150px] h-9 bg-background border-ink/25 dark:border-white/20 text-xs font-semibold">
                  <SelectValue displayValue={ce(TYPE_LABEL_KEYS[q.type])} placeholder={ce(TYPE_LABEL_KEYS[q.type])} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL_KEYS).map(([v, l]) => (
                    <SelectItem key={v} value={v} className="text-xs">
                      {ce(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <Switch
                checked={q.required}
                onCheckedChange={v => updateQ(q.id, { required: v })}
                className="scale-90"
              />
              <span className="text-xs font-medium text-foreground">{ce("Required")}</span>
            </div>
          </div>

          {NEEDS_OPTIONS(q.type) && (
            <div className="space-y-1.5 rounded-lg border border-ink/10 bg-secondary/40 p-2.5 dark:border-white/10">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ce("Options")}</p>
              {(q.options ?? []).map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={e => {
                      const next = [...(q.options ?? [])];
                      next[idx] = e.target.value;
                      updateQ(q.id, { options: next });
                    }}
                    placeholder={`${ce("Option")} ${idx + 1}`}
                    className="bg-background border-ink/25 dark:border-white/20 text-xs h-8"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = (q.options ?? []).filter((_, j) => j !== idx);
                      updateQ(q.id, { options: next.length ? next : [""] });
                    }}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateQ(q.id, { options: [...(q.options ?? []), ""] })
                }
                className="h-7 rounded-full text-[11px]"
              >
                <Plus className="w-3 h-3 mr-1" /> {ce("Add option")}
              </Button>
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addQuestion}
        className="w-full rounded-xl border-dashed border-white/[0.15] bg-white/[0.04] hover:bg-white/[0.08]"
      >
        <Plus className="w-4 h-4 mr-1" /> {ce("Add question")}
      </Button>
    </div>
  );
}
