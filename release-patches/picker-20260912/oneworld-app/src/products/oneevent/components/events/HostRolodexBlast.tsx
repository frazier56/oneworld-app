/**
 * HostRolodexBlast - Modal for selecting Rolodex contacts and sending event announcements.
 */
import { useEffect, useState } from "react";
import {
  X,
  Send,
  CheckSquare,
  Square,
  Search,
  Users,
  Mail,
  MessageSquare,
  Smartphone,
  AlertCircle,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@evt/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@evt/lib/utils";
import { areUsersConnected } from "@evt/lib/messageSpamGuard";
import { notifySmsNewMessage } from "@evt/lib/notifySms";
import SmsBroadcastComposer from "./SmsBroadcastComposer";

interface RolodexContact {
  rolodex_id: string;
  contact_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  job_title: string | null;
  category: string | null;
  events_attended: number;
  whatsapp_ok: boolean | null;
  sms_ok: boolean | null;
  email_ok: boolean | null;
  attestation_id: string | null;
  last_notified_at: string | null;
}

interface HostRolodexBlastProps {
  hostId: string;
  contacts: RolodexContact[];
  event: { id: string; title: string; start_date: string | null; location: string | null };
  onClose: () => void;
  onSent: () => void;
}

const ATTESTATION_VERSION = "rolodex_outbound_attestation_v1_2026-08-20";
const ATTESTATION_TEXT =
  "I confirm these contacts gave me their information for event invitations or follow-up from me/the host, and I am recording the channels they agreed to receive. Consent is not a condition of purchase.";

type LocalAttestation = Pick<RolodexContact, "attestation_id" | "whatsapp_ok" | "sms_ok" | "email_ok">;

export default function HostRolodexBlast({ hostId, contacts, event, onClose, onSent }: HostRolodexBlastProps) {
  const [smsComposer, setSmsComposer] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(contacts.map(c => c.rolodex_id)));
  const [searchQ, setSearchQ] = useState("");
  const [sending, setSending] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [attestationAccepted, setAttestationAccepted] = useState(false);
  const [collectedWhere, setCollectedWhere] = useState("");
  const [collectedWhen, setCollectedWhen] = useState("");
  const [consentWhatsApp, setConsentWhatsApp] = useState(false);
  const [consentEmail, setConsentEmail] = useState(false);
  const [consentSms, setConsentSms] = useState(false);
  const [localAttestations, setLocalAttestations] = useState<Record<string, LocalAttestation>>({});
  const [customMessage, setCustomMessage] = useState(
    `You're invited to "${event.title}"! Check it out on OneEvent.`
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  const inviteUrl = `${window.location.origin}/events/e/${event.id}`;
  const contactsWithLocal = contacts.map(c => ({ ...c, ...(localAttestations[c.rolodex_id] || {}) }));
  const filtered = contactsWithLocal.filter(c =>
    c.full_name.toLowerCase().includes(searchQ.toLowerCase()) ||
    (c.job_title || "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (c.phone || "").toLowerCase().includes(searchQ.toLowerCase())
  );
  const selectedContacts = contactsWithLocal.filter(c => selected.has(c.rolodex_id));
  const selectedAppContacts = selectedContacts.filter(c => c.contact_id);
  const selectedExternalContacts = selectedContacts.filter(c => !c.contact_id && (c.email || c.phone));
  const selectedMissingAttestation = selectedContacts.filter(c => !c.attestation_id);
  const selectedInAppReady = selectedAppContacts.filter(c => c.attestation_id);
  const selectedWhatsAppReady = selectedContacts.filter(c => c.attestation_id && c.whatsapp_ok && c.phone);
  const selectedEmailReady = selectedContacts.filter(c => c.attestation_id && c.email_ok && c.email);
  const selectedSmsReady = selectedContacts.filter(c => c.attestation_id && c.sms_ok && c.phone);

  const toggleAll = () => {
    if (filtered.length > 0 && filtered.every(c => selected.has(c.rolodex_id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.rolodex_id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const avatarUrl = (c: RolodexContact) =>
    c.photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.full_name)}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied");
    } catch {
      toast.error("Copy failed. Select and copy the event link instead.");
    }
  };

  const handleSaveAttestation = async () => {
    if (selectedMissingAttestation.length === 0) { toast.info("Selected contacts already have consent records."); return; }
    if (!attestationAccepted) { toast.error("Confirm the consent statement before saving."); return; }
    if (!collectedWhere.trim() || !collectedWhen.trim()) { toast.error("Add where and roughly when consent was collected."); return; }

    setSavingConsent(true);
    const { data, error } = await supabase
      .from("rolodex_import_attestations" as any)
      .insert({
        host_id: hostId,
        contact_count: selectedMissingAttestation.length,
        whatsapp_ok: consentWhatsApp,
        sms_ok: consentSms,
        email_ok: consentEmail,
        collected_where: collectedWhere.trim(),
        collected_when: collectedWhen.trim(),
        attestation_text: ATTESTATION_TEXT,
        attestation_version: ATTESTATION_VERSION,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      } as any)
      .select("id")
      .single();

    if (error || !data?.id) {
      setSavingConsent(false);
      toast.error(`Consent save failed: ${error?.message || "no attestation id returned"}`);
      return;
    }

    const ids = selectedMissingAttestation.map(c => c.rolodex_id);
    const update = {
      attestation_id: data.id,
      whatsapp_ok: consentWhatsApp,
      sms_ok: consentSms,
      email_ok: consentEmail,
    };
    const { error: updateError } = await supabase
      .from("host_rolodex" as any)
      .update(update as any)
      .eq("host_id", hostId)
      .in("id", ids);

    setSavingConsent(false);
    if (updateError) {
      toast.error(`Consent saved, but contacts were not updated: ${updateError.message}`);
      return;
    }

    setLocalAttestations(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = { ...update, attestation_id: data.id }; });
      return next;
    });
    setAttestationAccepted(false);
    toast.success(`Consent recorded for ${ids.length} contact${ids.length === 1 ? "" : "s"}`);
  };

  const handleSend = async () => {
    if (selected.size === 0) { toast.error("Select at least one contact"); return; }
    if (selectedInAppReady.length === 0) {
      toast.error("No selected app contacts have consent records yet. Save consent or copy the invite link.");
      return;
    }
    setSending(true);

    let sent = 0;
    let skipped = selectedMissingAttestation.length + selectedExternalContacts.filter(c => c.attestation_id).length;
    const notifiedRolodexIds: string[] = [];

    for (const contact of selectedInAppReady) {
      const contactId = contact.contact_id;
      try {
        const connected = await areUsersConnected(hostId, contactId);

        const { data: existingConvos } = await supabase
          .from("conversations")
          .select("id, participant_ids")
          .contains("participant_ids", [hostId])
          .order("last_message_at", { ascending: false });

        let conversationId: string | null = null;
        if (existingConvos) {
          const existing = existingConvos.find(c =>
            c.participant_ids.includes(hostId) && c.participant_ids.includes(contactId)
          );
          if (existing) conversationId = existing.id;
        }

        if (!conversationId) {
          const { data: newConvo, error: convoErr } = await supabase
            .from("conversations")
            .insert({
              participant_ids: [hostId, contactId],
              category: "events",
              last_message_text: customMessage.slice(0, 100),
              last_message_at: new Date().toISOString(),
              is_request: !connected,
            } as any)
            .select("id")
            .single();
          if (convoErr) { skipped++; continue; }
          conversationId = newConvo.id;
        }

        const metadata = {
          event_announcement: {
            event_id: event.id,
            title: event.title,
            start_date: event.start_date,
            location: event.location,
            public_url: inviteUrl,
          },
        };

        const { error: messageError } = await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: hostId,
          content: customMessage,
          message_type: "event_announcement",
          metadata,
        } as any);
        if (messageError) { skipped++; continue; }

        notifySmsNewMessage({ recipientId: contactId, senderId: hostId, messagePreview: `Event: ${event.title}`, messageType: "event_share" });

        await supabase
          .from("conversations")
          .update({
            last_message_text: `Event: ${event.title}`,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", conversationId);

        sent++;
        notifiedRolodexIds.push(contact.rolodex_id);
      } catch {
        skipped++;
      }
    }

    if (notifiedRolodexIds.length > 0) {
      await supabase
        .from("host_rolodex" as any)
        .update({ last_notified_at: new Date().toISOString() } as any)
        .eq("host_id", hostId)
        .in("id", notifiedRolodexIds);
    }

    toast.success(`Event announcement sent in-app to ${sent} contact${sent !== 1 ? "s" : ""}${skipped > 0 ? `, ${skipped} skipped with visible channel limits` : ""}`);
    setSending(false);
    onSent();
    onClose();
  };

  if (smsComposer) return <SmsBroadcastComposer hostId={hostId} eventId={event.id} title={event.title} contacts={selectedContacts} onClose={() => setSmsComposer(false)} onSent={onSent} />;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center px-0 py-0 sm:items-center sm:px-4 sm:py-4"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", height: "100dvh" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notify-contacts-title"
        data-testid="notify-contacts-dialog"
        className="w-full max-w-2xl overflow-hidden rounded-t-2xl border border-primary/20 bg-card shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top))", display: "flex", flexDirection: "column" }}
      >

        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-primary/10"
          style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.06) 0%, transparent 100%)" }}>
          <div>
            <h2 id="notify-contacts-title" className="text-lg font-bold text-foreground">Notify contacts</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{selected.size} of {contacts.length} selected</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/80 hover:bg-secondary transition-colors border border-border/50">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          data-testid="notify-contacts-scroll-body"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >

        <div className="px-4 sm:px-6 pt-4 pb-2">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
            <p className="text-sm font-semibold text-foreground">{event.title}</p>
            <p className="text-xs text-muted-foreground">{event.start_date ? new Date(event.start_date).toLocaleDateString() : "Date TBD"} - {event.location || "Location TBD"}</p>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-foreground">Delivery</p>
            <button onClick={handleCopyInvite} className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
              <Copy className="w-3.5 h-3.5" /> Copy invite link
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessageSquare className="w-4 h-4 text-primary" /> In-app</div>
              <p className="text-xs text-muted-foreground mt-1">{selectedInAppReady.length} ready, {selectedMissingAttestation.length} need consent</p>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Smartphone className="w-4 h-4" /> WhatsApp</div>
              <p className="text-xs text-muted-foreground mt-1">{selectedWhatsAppReady.length} consented; templates pending</p>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Mail className="w-4 h-4" /> Email</div>
              <p className="text-xs text-muted-foreground mt-1">{selectedEmailReady.length} consented; backend pending</p>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Smartphone className="w-4 h-4" /> SMS</div>
              <p className="text-xs text-muted-foreground mt-1">{selectedSmsReady.length} with saved SMS consent</p>
              <button type="button" disabled={sending || savingConsent || selected.size === 0} onClick={() => setSmsComposer(true)} className="mt-2 min-h-11 w-full rounded-xl border border-primary/30 px-3 text-sm font-semibold text-primary disabled:opacity-40">Review SMS invitation</button>
            </div>
          </div>
          {(selectedExternalContacts.length > 0 || selectedMissingAttestation.length > 0) && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {selectedMissingAttestation.length > 0 ? `${selectedMissingAttestation.length} selected contact${selectedMissingAttestation.length !== 1 ? "s need" : " needs"} a saved consent record before any send. ` : ""}
                {selectedExternalContacts.length > 0 ? `${selectedExternalContacts.length} selected contact${selectedExternalContacts.length !== 1 ? "s are" : " is"} outside the app. Use SMS review for consented phone contacts. WhatsApp and email are not available in this composer.` : ""}
              </span>
            </div>
          )}
        </div>

        {selectedMissingAttestation.length > 0 && (
          <div className="mx-4 sm:mx-6 mb-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">Record consent for selected contacts</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ATTESTATION_TEXT}</p>
                <label className="mt-3 flex items-start gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={attestationAccepted} onChange={e => setAttestationAccepted(e.target.checked)} className="mt-0.5" />
                  I can answer for this consent record.
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input value={collectedWhere} onChange={e => setCollectedWhere(e.target.value)} placeholder="Where collected? e.g. signup sheet"
                    className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/60" />
                  <input value={collectedWhen} onChange={e => setCollectedWhen(e.target.value)} placeholder="Roughly when? e.g. Aug 2026"
                    className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/60" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", consentWhatsApp ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}>
                    <input type="checkbox" checked={consentWhatsApp} onChange={e => setConsentWhatsApp(e.target.checked)} />
                    WhatsApp
                  </label>
                  <label className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", consentEmail ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}>
                    <input type="checkbox" checked={consentEmail} onChange={e => setConsentEmail(e.target.checked)} />
                    Email
                  </label>
                  <label className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", consentSms ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}>
                    <input type="checkbox" checked={consentSms} onChange={e => setConsentSms(e.target.checked)} />
                    Text message
                  </label>
                </div>
                <button onClick={handleSaveAttestation} disabled={savingConsent}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {savingConsent ? "Saving..." : `Save for ${selectedMissingAttestation.length} contact${selectedMissingAttestation.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 sm:px-6 py-3">
          <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
          <textarea
            value={customMessage}
            onChange={e => setCustomMessage(e.target.value)}
            className="w-full rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none bg-secondary/50 border border-border focus:border-primary/60 transition-colors"
            style={{ minHeight: 80 }}
            maxLength={500}
          />
        </div>

        <div className="px-4 sm:px-6 pb-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-secondary/50 border border-border flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search contacts..."
              className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
            />
          </div>
          <button onClick={toggleAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 whitespace-nowrap shrink-0">
            {filtered.length > 0 && filtered.every(c => selected.has(c.rolodex_id)) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {filtered.length > 0 && filtered.every(c => selected.has(c.rolodex_id)) ? "Deselect All" : "Select All"}
          </button>
        </div>

        <div className="px-4 sm:px-6 pb-4">
          <div className="space-y-1.5">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                No contacts found
              </div>
            ) : filtered.map(c => {
              const checked = selected.has(c.rolodex_id);
              return (
                <button key={c.rolodex_id} onClick={() => toggle(c.rolodex_id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border",
                    checked
                      ? "bg-primary/5 border-primary/30"
                      : "bg-secondary/30 border-border hover:bg-secondary/50"
                  )}>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <img src={avatarUrl(c)} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.job_title || c.category || "Member"}</p>
                    {!c.contact_id && (
                      <p className="text-[10px] text-muted-foreground truncate">{[c.email, c.phone].filter(Boolean).join(" - ") || "Email/SMS contact"}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground/60">{c.contact_id ? `${c.events_attended} event${c.events_attended !== 1 ? "s" : ""}` : "External"}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", c.attestation_id ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
                      {c.attestation_id ? "consent saved" : "needs consent"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        </div>

        <div
          className="flex shrink-0 flex-col-reverse gap-2 border-t border-primary/10 p-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:p-6"
          data-testid="notify-contacts-footer"
          style={{
            background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.04) 100%)",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          <button onClick={onClose} className="w-full px-5 py-2.5 rounded-lg text-sm font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-colors sm:w-auto">
            Cancel
          </button>
          <button onClick={handleSend} disabled={selected.size === 0 || selectedInAppReady.length === 0 || sending}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all sm:w-auto",
              selectedInAppReady.length > 0 && !sending
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
            )}>
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : `Send in-app to ${selectedInAppReady.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
