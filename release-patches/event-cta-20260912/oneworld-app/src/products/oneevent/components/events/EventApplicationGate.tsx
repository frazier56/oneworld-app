/**
 * EventApplicationGate — application toggle + ICP description + approval toggle + form builder.
 * Lives inside the Tickets section of CreateEventForm (left column).
 * Available for BOTH free and paid events.
 */
import { useState } from "react";
import { Switch } from "@evt/components/ui/switch";
import { Textarea } from "@evt/components/ui/textarea";
import { Button } from "@evt/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@evt/components/ui/dialog";
import { Sparkles, ClipboardList, ShieldCheck, CreditCard, Clock, ThumbsUp } from "lucide-react";
import ApplicationFormBuilder, { AppQuestion } from "./ApplicationFormBuilder";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { createEventText } from "@evt/i18n/createEventLocale";

interface Props {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  icpDescription: string;
  onIcpChange: (v: string) => void;
  questions: AppQuestion[];
  onQuestionsChange: (qs: AppQuestion[]) => void;
  /** Whether the host wants to manually approve each applicant (vs auto-approve). */
  requiresApproval: boolean;
  onRequiresApprovalChange: (v: boolean) => void;
  /** True if the event is paid; controls helper copy about Stripe charging. */
  isPaid: boolean;
}

export default function EventApplicationGate({
  enabled,
  onEnabledChange,
  icpDescription,
  onIcpChange,
  questions,
  onQuestionsChange,
  requiresApproval,
  onRequiresApprovalChange,
  isPaid,
}: Props) {
  const { lang } = useLanguage();
  const ce = (english: string) => createEventText(lang, english);
  /* v21 CI: one-time "here's what approval does to the guest's card" explainer. */
  const [holdInfoOpen, setHoldInfoOpen] = useState(false);
  return (
    <div className="space-y-3 pt-3 border-t border-white/[0.06]">
      <div className="flex items-start gap-3">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} className="mt-0.5" />
        <div className="flex-1">
          {/* v30 EZ (Lee): row icon removed — it crowded the header into a wrap. */}
          <span className="text-sm font-semibold text-foreground">
            {ce("Request to Join application")}
          </span>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            {isPaid
              ? ce("Attendees request to join, complete your questions, then authorize payment before host review. Their answers land in your applicant Rolodex with a VAIA fit score.")
              : ce("Attendees request to join and complete your questions before their spot is confirmed. Their answers land in your applicant Rolodex with a VAIA fit score.")}
          </p>
        </div>
      </div>

      {enabled && (
        /* v30 EZ (Lee): shifted LEFT — the nested cards were crowding right and wrapping. */
        <div className="space-y-4 pt-1 -ml-1">
          {/* Approval toggle — v21 CI (Lee, 18 Aug): flipping this ON for a PAID event pops
              a one-time explainer so the host knows exactly what happens to the guest's
              card and what the clock is. */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <Switch
              checked={requiresApproval}
              onCheckedChange={(v) => {
                onRequiresApprovalChange(v);
                if (v && isPaid) setHoldInfoOpen(true);
              }}
              className="mt-0.5"
            />
            <div className="flex-1">
              {/* v24 DH (Lee): no icon here — it was pushing the label around for nothing. */}
              <span className="text-xs font-semibold text-foreground">
                {ce("Review each applicant before issuing tickets")}
              </span>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                {requiresApproval
                  ? isPaid
                    ? ce("Cards are authorized first — the money is held on their card — then charged only when you approve. In the rare case payment capture fails (holds expire after about 7 days), the applicant is notified in-app, by email and by text to re-authorize.")
                    : ce("Applicants will receive their ticket by email automatically once you approve them.")
                  : isPaid
                  ? ce("Applicants will go straight to Stripe checkout after submitting.")
                  : ce("Applicants will receive their RSVP ticket immediately after submitting.")}
              </p>
            </div>
          </div>

          {/* v24 DH (Lee): "there is no border around that section — people are not gonna
              know to click into it." The ICP now sits in its own bordered card with a
              clearly-outlined field, matching the approval card above it. */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <label className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" /> {ce("Ideal applicant (ICP) — for VAIA ranking")}
            </label>
            <Textarea
              value={icpDescription}
              onChange={e => onIcpChange(e.target.value)}
              placeholder={ce("e.g. Founders building B2B SaaS at $1M+ ARR, based in LATAM, looking for distribution partnerships.")}
              rows={3}
              className="bg-background/60 border border-ink/25 dark:border-white/20 rounded-xl focus:border-primary/60 resize-none text-sm"
              maxLength={600}
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">
              {ce("VAIA reads each application and scores fit 0–10 (red → green) against this description. Up to 600 chars.")}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{ce("Application questions")}</p>
            <ApplicationFormBuilder questions={questions} onChange={onQuestionsChange} />
          </div>
        </div>
      )}

      {/* v21 CI (Lee): "there needs to be a little notification pop up box that says,
          when you require approval, this is what happens." The numbers here are the
          REAL Stripe mechanics, verified end-to-end 18 Aug: manual-capture hold →
          capture on approve → cancel on decline → ~7-day hold window. */}
      <Dialog open={holdInfoOpen} onOpenChange={setHoldInfoOpen}>
        <DialogContent closeLabel={ce("Close")} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4 text-primary" /> {ce("How approval & payment work")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground/85">
            <div className="flex items-start gap-2.5">
              <CreditCard className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <p>{ce("When a guest requests to join, their card is authorized with a real hold. The money is reserved on their card, but nothing has been charged yet.")}</p>
            </div>
            <div className="flex items-start gap-2.5">
              <ThumbsUp className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <p>{ce("The moment you tap Approve, the card is charged and their ticket is issued. If you Decline, the hold is released immediately and they pay nothing.")}</p>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
              <p>{ce("Card holds last up to 7 days (some banks less). Review each request promptly — if the hold expires before you approve, the guest is asked to authorize again.")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setHoldInfoOpen(false)} className="rounded-full w-full">{ce("Got it")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
