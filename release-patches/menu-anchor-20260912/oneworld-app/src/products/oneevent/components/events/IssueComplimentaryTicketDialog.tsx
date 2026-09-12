import { useState } from "react";
import { Gift, Loader2, Ticket } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@evt/components/ui/dialog";
import QuickHirePhoneInput from "@evt/components/quick-hire/QuickHirePhoneInput";
import { supabase } from "@evt/integrations/supabase/client";
import { findCountryByIso } from "@evt/lib/country-phone-data";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  hasVip?: boolean;
  onIssued: () => void;
}

const readFunctionError = async (error: any, fallback: string) => {
  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const body = await response.json();
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
      if (typeof body?.message === "string" && body.message.trim()) return body.message;
    } catch {
      // Fall through to the SDK message.
    }
  }
  if (response && typeof response === "object") {
    const direct =
      response.error ||
      response.message ||
      response.body?.error ||
      response.body?.message ||
      response.data?.error ||
      response.data?.message;
    if (typeof direct === "string" && direct.trim()) return direct;
  }
  if (typeof error?.details === "string" && error.details.trim()) return error.details;
  if (typeof error?.hint === "string" && error.hint.trim()) return error.hint;
  return error?.message || fallback;
};

export default function IssueComplimentaryTicketDialog({ open, onOpenChange, eventId, hasVip, onIssued }: Props) {
  const [recipientFirstName, setRecipientFirstName] = useState("");
  const [recipientLastName, setRecipientLastName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientPhoneCountry, setRecipientPhoneCountry] = useState("US");
  const [ticketType, setTicketType] = useState<"ga" | "vip">("ga");
  const [issuing, setIssuing] = useState(false);
  const [formError, setFormError] = useState("");
  const [issuedGuestName, setIssuedGuestName] = useState("");

  const reset = () => {
    setRecipientFirstName("");
    setRecipientLastName("");
    setRecipientEmail("");
    setRecipientPhone("");
    setRecipientPhoneCountry("US");
    setTicketType("ga");
    setFormError("");
    setIssuedGuestName("");
  };

  const issue = async () => {
    const firstName = recipientFirstName.trim();
    const lastName = recipientLastName.trim();
    const recipientName = [firstName, lastName].filter(Boolean).join(" ");
    const phoneDial = findCountryByIso(recipientPhoneCountry)?.code || "+1";
    const formattedPhone = `${phoneDial} ${recipientPhone.trim()}`.trim();

    if (!firstName || !lastName || !recipientEmail.trim() || !recipientPhone.trim()) {
      const message = "Add first name, last name, email, and phone before issuing the ticket.";
      setFormError(message);
      toast.error(message);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      const message = "Enter a valid email address before issuing the ticket.";
      setFormError(message);
      toast.error(message);
      return;
    }

    setIssuing(true);
    setFormError("");
    try {
      const { data, error } = await supabase.functions.invoke("issue-complimentary-ticket", {
        body: {
          eventId,
          ticketType,
          recipientName,
          recipientFirstName: firstName,
          recipientLastName: lastName,
          recipientEmail: recipientEmail.trim(),
          recipientPhone: formattedPhone,
          recipientPhoneCountry,
        },
      });

      if (error || (data as any)?.error) {
        const message = (data as any)?.error || await readFunctionError(error, "Unable to issue ticket");
        setFormError(message);
        toast.error(message);
        return;
      }

      toast.success((data as any)?.emailStatus === "queued" ? "Guest list ticket issued and email queued." : "Guest list ticket issued. Email needs review.");
      reset();
      setIssuedGuestName(recipientName);
      onIssued();
    } catch (error: any) {
      const message = error?.message || "Unable to issue ticket. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!issuing) { if (!next) reset(); onOpenChange(next); } }}>
      <DialogContent className="grid max-h-[85dvh] w-[calc(100vw-24px)] max-w-md grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            {issuedGuestName ? "Guest list ticket issued" : "Guest List"}
          </DialogTitle>
          <DialogDescription>
            {issuedGuestName
              ? "Your guest has been added and their secure ticket is on the way."
              : "Adds a guest list ticket, counts it toward capacity, and emails a secure ticket link."}
          </DialogDescription>
        </DialogHeader>

        {issuedGuestName ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground">
                You have successfully added {issuedGuestName} to your guest list.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Their ticket will be emailed to them and will also be available in OneEvent when they log in.
              </p>
            </div>
          </div>
        ) : (
        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Guest list tickets count toward attendance capacity, not paid revenue. The recipient claims the ticket before account-only features such as chat are available.
          </p>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Ticket type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTicketType("ga")}
                className={ticketType === "ga" ? "rounded-xl border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary" : "rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground"}
              >
                <Ticket className="mr-1 inline h-4 w-4" />
                General
              </button>
              <button
                type="button"
                onClick={() => setTicketType("vip")}
                disabled={!hasVip}
                className={ticketType === "vip" ? "rounded-xl border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-40" : "rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-40"}
              >
                VIP
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Recipient name *</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={recipientFirstName}
                onChange={(e) => { setRecipientFirstName(e.target.value); if (formError) setFormError(""); }}
                autoComplete="given-name"
                className="min-w-0 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="First name"
              />
              <input
                value={recipientLastName}
                onChange={(e) => { setRecipientLastName(e.target.value); if (formError) setFormError(""); }}
                autoComplete="family-name"
                className="min-w-0 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Email *</label>
            <input
              value={recipientEmail}
              onChange={(e) => { setRecipientEmail(e.target.value); if (formError) setFormError(""); }}
              type="email"
              autoComplete="email"
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="recipient@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Phone *</label>
            <QuickHirePhoneInput
              countryCode={recipientPhoneCountry}
              phone={recipientPhone}
              onCountryChange={setRecipientPhoneCountry}
              onPhoneChange={(value) => { setRecipientPhone(value); if (formError) setFormError(""); }}
            />
          </div>

          {formError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {formError}
            </div>
          )}
        </div>
        )}

        <DialogFooter className="shrink-0 border-t border-border px-5 py-4">
          {issuedGuestName ? (
            <button
              type="button"
              onClick={() => { reset(); onOpenChange(false); }}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              OK
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { reset(); onOpenChange(false); }}
                disabled={issuing}
                className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={issue}
                disabled={issuing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {issuing && <Loader2 className="h-4 w-4 animate-spin" />}
                Issue guest list ticket
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

