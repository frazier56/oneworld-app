/**
 * HostRolodexBlast - Modal for selecting Rolodex contacts and sending event announcements.
 *
 * OneEvent 30 overlay 8 (EV-01, 20 Sep 2026): this dialog no longer sends anything itself. Every
 * channel — in-app included — goes through RolodexBroadcastComposer and the server's protected
 * contract (preflight → hold → review → release / cancel). The channel cards are switches whose
 * availability comes from the server's own gates, read once when the dialog opens; the copy the
 * host sees is what the server will do, never a hard-coded "pending".
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
import RolodexBroadcastComposer, { eligibleFor, type BroadcastChannel } from "./RolodexBroadcastComposer";

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
  const [composerOpen, setComposerOpen] = useState(false);
  const [channels, setChannels] = useState<BroadcastChannel[]>(["in_app"]);
  /* Server truth about which channels can send right now, and why not. Read once on open. */
  const [gates, setGates] = useState<{ enabled: Partial<Record<BroadcastChannel, boolean>>; flags: Record<string, boolean>; loaded: boolean; failed: boolean }>({ enabled: {}, flags: {}, loaded: false, failed: false });
  const [selected, setSelected] = useState<Set<string>>(new Set(contacts.map(c => c.rolodex_id)));
  const [searchQ, setSearchQ] = useState("");
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

  useEffect(() => {
    let cancelled = false;
    if (contacts.length === 0) { setGates(g => ({ ...g, loaded: true, failed: false })); return; }
    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("event-rolodex-broadcast", {
          body: {
            eventId: event.id, rolodexIds: contacts.slice(0, 1).map(c => c.rolodex_id),
            channels: ["in_app", "email", "sms", "whatsapp"], message: "gate check", action: "preflight", preflightOnly: true,
          },
        });
        if (cancelled) return;
        if (error || !data || data.error || data.writes_performed !== false) { setGates(g => ({ ...g, loaded: true, failed: true })); return; }
        setGates({ enabled: data.channels_currently_enabled || {}, flags: data.channel_gates || {}, loaded: true, failed: false });
      } catch { if (!cancelled) setGates(g => ({ ...g, loaded: true, failed: true })); }
    })();
    return () => { cancelled = true; };
  }, [event.id, contacts]);

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
  const readyOn = (ch: BroadcastChannel) => selectedContacts.filter(c => eligibleFor(c, ch));
  const selectedInAppReady = readyOn("in_app");
  const selectedWhatsAppReady = readyOn("whatsapp");
  const selectedEmailReady = readyOn("email");
  const selectedSmsReady = readyOn("sms");
  /* in-app is always on server-side; external channels only when the server says so. */
  const channelAvailable = (ch: BroadcastChannel) => ch === "in_app" ? true : gates.enabled[ch] === true;
  const channelNote = (ch: BroadcastChannel): string => {
    if (ch === "in_app") return `${selectedInAppReady.length} in the app`;
    const ready = readyOn(ch).length;
    if (!gates.loaded) return `${ready} consented · checking…`;
    if (gates.failed) return `${ready} consented · availability unknown`;
    if (channelAvailable(ch)) return `${ready} consented`;
    if (gates.flags.external_sends_enabled === false) return `${ready} consented · external sending is off for this account`;
    if (ch === "whatsapp" && gates.flags.whatsapp_approved === false) return `${ready} consented · WhatsApp template awaiting approval`;
    return `${ready} consented · switched off`;
  };
  const toggleChannel = (ch: BroadcastChannel) => setChannels(prev => prev.includes(ch) ? prev.filter(x => x !== ch) : [...prev, ch]);
  const sendableCount = new Set(channels.flatMap(ch => readyOn(ch).map(c => c.rolodex_id))).size;
  const canReview = selected.size > 0 && channels.length > 0 && channels.every(channelAvailable) && sendableCount > 0;

  const toggleAll = () => {
    if (filtered.length> 0 && filtered.every(c => selected.has(c.rolodex_id))) {
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
    /* OneEvent 30 overlay 9 (EV-02): consent is recorded by the server RPC, never by writing the
       contact's consent flags from the browser. The RPC verifies the host owns every contact, writes
       ONE attestation row that lists exactly which contacts it covers, and sets the flags itself.
       A direct write to those columns is refused by a database guard. */
    const ids = selectedMissingAttestation.map(c => c.rolodex_id);
    const { data: attestationId, error } = await supabase.rpc("record_rolodex_consent" as any, {
      p_rolodex_ids: ids,
      p_whatsapp: consentWhatsApp,
      p_sms: consentSms,
      p_email: consentEmail,
      p_collected_where: collectedWhere.trim(),
      p_collected_when: collectedWhen.trim(),
      p_attestation_text: ATTESTATION_TEXT,
      p_attestation_version: ATTESTATION_VERSION,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    } as any);
    setSavingConsent(false);
    if (error || !attestationId) {
      toast.error(`Consent save failed: ${error?.message || "no attestation id returned"}`);
      return;
    }
    const update = {
      attestation_id: String(attestationId),
      whatsapp_ok: consentWhatsApp,
      sms_ok: consentSms,
      email_ok: consentEmail,
    };

    setLocalAttestations(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = { ...update }; });
      return next;
    });
    setAttestationAccepted(false);
    toast.success(`Consent recorded for ${ids.length} contact${ids.length === 1 ? "" : "s"}`);
  };

  if (composerOpen) {
    return (
      <RolodexBroadcastComposer
        hostId={hostId} eventId={event.id} title={event.title}
        contacts={selectedContacts.map(({ rolodex_id, full_name, contact_id, phone, email, sms_ok, whatsapp_ok, email_ok, attestation_id }) =>
          ({ rolodex_id, full_name, contact_id: contact_id || null, phone, email, sms_ok, whatsapp_ok, email_ok, attestation_id }))}
        channels={channels} initialMessage={customMessage}
        onClose={() => setComposerOpen(false)} onSent={onSent}
      />
    );
  }

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2" role="group" aria-label="Delivery channels">
            {([
              ["in_app", "In-app", MessageSquare],
              ["whatsapp", "WhatsApp", Smartphone],
              ["email", "Email", Mail],
              ["sms", "SMS", Smartphone],
            ] as [BroadcastChannel, string, typeof Mail][]).map(([ch, name, Icon]) => {
              const on = channels.includes(ch);
              const available = channelAvailable(ch);
              return (
                <button
                  key={ch} type="button" role="switch" aria-checked={on} disabled={!available}
                  onClick={() => toggleChannel(ch)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    on ? "border-primary/40 bg-primary/10" : available ? "border-border bg-secondary/30 hover:border-primary/30" : "border-dashed border-border bg-secondary/20 opacity-70",
                  )}
>
                  <div className={cn("flex items-center gap-2 text-sm font-semibold", on ? "text-foreground" : "text-muted-foreground")}>
                    <Icon className={cn("w-4 h-4", on && "text-primary")} /> {name}
                    <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold", on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{on ? "On" : available ? "Off" : "N/A"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{channelNote(ch)}</p>
                </button>
              );
            })}
          </div>
          {(selectedExternalContacts.length> 0 || selectedMissingAttestation.length> 0) && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {selectedMissingAttestation.length> 0 ? `${selectedMissingAttestation.length} selected contact${selectedMissingAttestation.length !== 1 ? "s need" : " needs"} a saved consent record before any external send. ` : ""}
                {selectedExternalContacts.length> 0 ? `${selectedExternalContacts.length} selected contact${selectedExternalContacts.length !== 1 ? "s are" : " is"} outside the app and can only be reached on a consented external channel.` : ""}
              </span>
            </div>
          )}
        </div>

        {selectedMissingAttestation.length> 0 && (
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
            {filtered.length> 0 && filtered.every(c => selected.has(c.rolodex_id)) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {filtered.length> 0 && filtered.every(c => selected.has(c.rolodex_id)) ? "Deselect All" : "Select All"}
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
                  <img decoding="async" src={avatarUrl(c)} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
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
          <button onClick={() => setComposerOpen(true)} disabled={!canReview}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all sm:w-auto",
              canReview ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
            )}>
            <Send className="w-4 h-4" />
            {`Review & send · ${sendableCount}`}
          </button>
        </div>
      </div>
    </div>
  );
}
