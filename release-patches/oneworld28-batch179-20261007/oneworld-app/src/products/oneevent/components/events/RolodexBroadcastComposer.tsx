/**
 * RolodexBroadcastComposer — the ONE client for the protected broadcast contract (EV-01).
 * OneEvent 30 overlay 8, 20 September 2026. Grew out of SmsBroadcastComposer (SMS only) so that
 * every channel — in-app, email, SMS, WhatsApp — goes through the same four steps the server
 * enforces: PREFLIGHT (read-only, no writes) → HOLD (rows written, nothing sent) → the host reviews
 * exactly what was held → RELEASE (explicit confirm; WhatsApp also proves the review fingerprint)
 * or CANCEL. The held request survives a reload (sessionStorage) and a lost response never mints a
 * second request (the request id is persisted before the first write). No channel is ever chosen
 * for the host: what the server says is enabled is what can be sent, and nothing else.
 */
import { useRef, useState } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { useMicro } from "@evt/i18n/LanguageContext";

export type BroadcastChannel = "in_app" | "email" | "sms" | "whatsapp";
export type ComposerContact = {
  rolodex_id: string; full_name: string; contact_id: string | null; phone: string | null; email: string | null;
  sms_ok: boolean | null; whatsapp_ok: boolean | null; email_ok: boolean | null; attestation_id: string | null;
};
type Phase = "holding" | "held" | "releasing" | "unknown" | "accepted";
type Intent = {
  requestId: string; ids: string[]; channels: BroadcastChannel[]; message: string; phase: Phase;
  recipients?: ComposerContact[]; broadcastId?: string; reviewed?: boolean; fingerprint?: string | null;
  summary?: { queued: number; skipped: number };
};
type Props = {
  hostId: string; eventId: string; title: string; contacts: ComposerContact[]; channels: BroadcastChannel[];
  initialMessage: string; onClose: () => void; onSent: () => void;
};

export const CHANNEL_LABEL: Record<BroadcastChannel, [string, string]> = {
  in_app: ["In-app", "En la app"], email: ["Email", "Correo"], sms: ["Text message", "SMS"], whatsapp: ["WhatsApp", "WhatsApp"],
};

/** Who can receive on a channel — the SAME rule the server applies (a contact the server would
 *  skip is shown as skipped here, before anything is held). */
export function eligibleFor(c: ComposerContact, channel: BroadcastChannel): boolean {
  if (channel === "in_app") return !!c.contact_id;
  if (!c.attestation_id) return false;
  if (channel === "email") return !!c.email?.trim() && c.email_ok === true;
  if (channel === "sms") return !!c.phone?.trim() && c.sms_ok === true;
  return !!c.phone?.trim() && c.whatsapp_ok === true;
}

/** Fixed diagnostic codes only — never names, numbers, tokens or response bodies. */
export function preflightFailures(plan: any, channels: BroadcastChannel[], expected: Record<BroadcastChannel, number>): string[] {
  const failed: string[] = [];
  if (plan?.messages_sent !== false) failed.push("no_messages");
  if (plan?.writes_performed !== false) failed.push("no_writes");
  for (const ch of channels) {
    if (plan?.channels_currently_enabled?.[ch] !== true) {
      failed.push(`${ch}_disabled`);
      if (ch !== "in_app" && plan?.channel_gates?.external_sends_enabled === false) failed.push("external_sends_disabled");
    }
    const cp = plan?.channel_plan?.[ch];
    if (!cp) { failed.push(`${ch}_no_plan`); continue; }
    if (cp.duplicate_destination !== 0) failed.push(`${ch}_duplicate_destination`);
    /* The server counts destinations, not consent; the client's count is the stricter of the two.
       Fewer destinations than we expect means the server sees something we do not — stop. */
    if (typeof cp.unique_destinations === "number" && cp.unique_destinations < expected[ch]) failed.push(`${ch}_destination_mismatch`);
  }
  return [...new Set(failed)];
}

export default function RolodexBroadcastComposer({ hostId, eventId, title, contacts, channels, initialMessage, onClose, onSent }: Props) {
  const m = useMicro();
  const key = `oneevent:broadcast-intent:${hostId}:${eventId}`;
  const legacyKey = `oneevent:sms-intent:${hostId}:${eventId}`;
  const [intent, setIntent] = useState<Intent | null>(() => {
    try {
      const value = sessionStorage.getItem(key) || sessionStorage.getItem(legacyKey);
      if (!value) return null;
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed.ids) || typeof parsed.requestId !== "string") throw new Error("Invalid saved request");
      if (!Array.isArray(parsed.channels)) parsed.channels = ["sms"];   // a request held by the SMS-only composer
      return parsed as Intent;
    } catch { return { requestId: "unavailable", ids: [], channels, message: "", phase: "unknown" }; }
  });
  const [message, setMessage] = useState(initialMessage);
  const [ack, setAck] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const lock = useRef(false);

  const ids = [...new Set(contacts.map(c => c.rolodex_id))];
  const expected = Object.fromEntries(channels.map(ch => [ch, contacts.filter(c => eligibleFor(c, ch)).length])) as Record<BroadcastChannel, number>;
  const anyEligible = channels.some(ch => expected[ch] > 0);
  const valid = ids.length > 0 && channels.length > 0 && anyEligible;
  const external = channels.some(ch => ch !== "in_app");

  const persist = (next: Intent) => { try { sessionStorage.setItem(key, JSON.stringify(next)); sessionStorage.removeItem(legacyKey); } catch { /* private mode */ } setIntent(next); };
  const forget = () => { try { sessionStorage.removeItem(key); sessionStorage.removeItem(legacyKey); } catch { /* private mode */ } setIntent(null); setAck(false); setConfirmed(false); };
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await work(); } catch { setError(m("The outcome could not be confirmed. Check status before doing anything else. Do not resend.", "No se pudo confirmar el resultado. Revisa el estado antes de continuar. No vuelvas a enviar.")); }
    finally { lock.current = false; setBusy(false); }
  };
  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("event-rolodex-broadcast", { body });
    if (error || !data || data.error) throw new Error("Unconfirmed broadcast response");
    return data;
  };
  const requestBody = () => ({ eventId, rolodexIds: ids, channels, message: message.trim(), includeTicketLink: true, includeGroupChatLink: false, respectSuppressionTags: true });

  const check = () => run(async () => {
    if (!valid || intent) return;
    setDiagnostic("");
    const plan = await invoke({ ...requestBody(), action: "preflight", preflightOnly: true });
    const failed = preflightFailures(plan, channels, expected);
    setDiagnostic(failed.length
      ? `${m("Check blocked", "Verificación bloqueada")}: ${failed.join(", ")}`
      : m("Check passed. Nothing was held and nothing was sent.", "Verificación aprobada. No se creó una solicitud ni se enviaron mensajes."));
  });

  const hold = () => run(async () => {
    if (!valid || !ack || intent || !message.trim()) return;
    const body = requestBody();
    const plan = await invoke({ ...body, action: "preflight", preflightOnly: true });   // read-only
    const failed = preflightFailures(plan, channels, expected);
    if (failed.length) {
      setDiagnostic(`${m("Check blocked", "Verificación bloqueada")}: ${failed.join(", ")}`);
      setError(m("A channel is unavailable or the selection did not pass review. Nothing was sent.", "Un canal no está disponible o la selección no pasó la revisión. No se envió nada."));
      return;
    }
    const next: Intent = {
      requestId: crypto.randomUUID(), ids, channels, message: body.message, phase: "holding",
      recipients: contacts.map(({ rolodex_id, full_name, contact_id, phone, email, sms_ok, whatsapp_ok, email_ok, attestation_id }) =>
        ({ rolodex_id, full_name, contact_id, phone, email, sms_ok, whatsapp_ok, email_ok, attestation_id })),
    };
    persist(next);   // before the first write: a lost response must not mint a second request
    const result = await invoke({ ...body, action: "hold", requestId: next.requestId, ...(external ? { attestExternalPermission: true } : {}) });
    const queued = Number(result?.summary?.queued_count ?? 0), skipped = Number(result?.summary?.skipped_count ?? 0);
    if (result.status !== "held" || result.messages_sent !== false || !result.broadcast_id || queued === 0 || queued + skipped !== ids.length * channels.length) {
      persist({ ...next, broadcastId: result.broadcast_id, phase: "unknown" }); throw new Error("Held recipients did not match");
    }
    setDiagnostic("");
    persist({ ...next, broadcastId: result.broadcast_id, phase: "held", reviewed: true, fingerprint: result.preflight_fingerprint ?? null, summary: { queued, skipped } });
  });

  const release = () => run(async () => {
    if (!intent?.broadcastId || intent.phase !== "held" || !intent.reviewed || !confirmed) return;
    persist({ ...intent, phase: "releasing" });
    const result = await invoke({ action: "release", broadcastId: intent.broadcastId, confirmRelease: true, ...(intent.fingerprint ? { preflightFingerprint: intent.fingerprint } : {}) });
    if (result.status !== "processing" || result.broadcast_id !== intent.broadcastId) throw new Error("Unconfirmed release");
    persist({ ...intent, phase: "accepted" });
  });

  const status = () => run(async () => {
    if (!intent) return;
    const { data, error } = await supabase.from("event_rolodex_broadcasts" as any).select("id,status").eq("host_id", hostId).eq("event_id", eventId).eq("request_id", intent.requestId).maybeSingle();
    if (error) throw error;
    const row = data as { id: string; status: string } | null;
    if (row && ["processing", "completed", "completed_with_errors"].includes(row.status)) persist({ ...intent, broadcastId: row.id, phase: "accepted" });
    else if (row?.status === "held") persist({ ...intent, broadcastId: row.id, phase: "held", reviewed: true });
    else if (row?.status === "cancelled" || !row) forget();
    else setError(m("Still unconfirmed. Review this request in Broadcast History; do not create a replacement send.", "Aún sin confirmar. Revisa esta solicitud en el historial; no crees un envío de reemplazo."));
  });

  const cancel = () => run(async () => {
    if (intent?.phase !== "held" || !intent.broadcastId) return;
    persist({ ...intent, phase: "unknown" });
    const result = await invoke({ action: "cancel", broadcastId: intent.broadcastId });
    if (result.status !== "cancelled" || result.broadcast_id !== intent.broadcastId) throw new Error("Unconfirmed cancellation");
    forget();
  });

  const accepted = intent?.phase === "accepted";
  const shownChannels = intent?.channels ?? channels;
  const shownContacts = intent?.recipients ?? contacts;
  const shownIds = intent?.ids ?? ids;
  const label = (ch: BroadcastChannel) => m(CHANNEL_LABEL[ch][0], CHANNEL_LABEL[ch][1]);
  const channelLine = shownChannels.map(ch => `${label(ch)} · ${shownContacts.filter(c => eligibleFor(c, ch)).length}`).join("  ·  ");

  return <div role="dialog" aria-modal="true" aria-labelledby="broadcast-composer-title" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-3">
    <section className="flex max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <h2 id="broadcast-composer-title" className="font-bold">{m("Review invitation", "Revisar invitación")}</h2>
        <button disabled={busy} onClick={onClose} aria-label={m("Close", "Cerrar")} className="min-h-11 min-w-11 text-xl">×</button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4">
        <p className="font-semibold">{title}</p>
        <p className="text-sm">{m("Channels", "Canales")}: <strong>{channelLine}</strong></p>
        <p className="text-sm">{m("Selected contacts", "Contactos seleccionados")}: <strong>{shownIds.length}</strong></p>
        <ul className="max-h-36 space-y-1 overflow-auto text-sm">
          {shownIds.map(id => {
            const c = shownContacts.find(x => x.rolodex_id === id);
            if (!c) return <li key={id}>{id}</li>;
            const gets = shownChannels.filter(ch => eligibleFor(c, ch));
            return <li key={id} className="flex items-baseline justify-between gap-2">
              <span className="truncate">{c.full_name}</span>
              <span className={gets.length ? "shrink-0 text-xs text-muted-foreground" : "shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300"}>
                {gets.length ? gets.map(label).join(", ") : m("skipped — no eligible channel", "omitido — sin canal elegible")}
              </span>
            </li>;
          })}
        </ul>

        {!intent && <>
          <label className="block text-sm">{m("Message", "Mensaje")}
            <textarea value={message} onChange={e => { setMessage(e.target.value); setDiagnostic(""); }} disabled={busy} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background p-3" />
          </label>
          <p className="text-sm text-muted-foreground">{m("The event link is included. Saved consent and opt-out checks still apply on every channel.", "Se incluye el enlace del evento. Se verifican el consentimiento guardado y las bajas en cada canal.")}</p>
          {!valid && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{m("Nobody selected can receive on the chosen channels. Go back to adjust the selection or record consent.", "Nadie de la selección puede recibir por los canales elegidos. Vuelve para ajustar la selección o registrar consentimiento.")}</p>}
          <button disabled={busy || !valid} onClick={check} className="min-h-11 w-full rounded-xl border border-border p-3 disabled:opacity-40">{m("Check availability (no send)", "Verificar disponibilidad (sin enviar)")}</button>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={ack} disabled={busy} onChange={e => setAck(e.target.checked)} />{m("I confirm this event invitation and recipient selection. This does not grant contact consent.", "Confirmo esta invitación y los destinatarios. Esto no otorga consentimiento a los contactos.")}</label>
          <button disabled={busy || !valid || !ack || !message.trim()} onClick={hold} className="min-h-11 w-full rounded-xl bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-40">{m("Hold for review", "Poner en revisión")}</button>
        </>}

        {intent?.phase === "held" && <>
          <p className="text-sm">{m("Held for review. Nothing has been sent.", "En espera de revisión. No se ha enviado nada.")}{intent.summary?.skipped ? ` ${intent.summary.skipped} ${m("were set aside by the server (see Broadcast History).", "fueron apartados por el servidor (ver historial).")}` : ""}</p>
          <p className="whitespace-pre-wrap rounded-xl border border-border p-3 text-sm">{intent.message}</p>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{m("I confirm sending to exactly these recipients on these channels.", "Confirmo enviar exactamente a estos destinatarios por estos canales.")}</label>
          <button disabled={busy || !confirmed} onClick={release} className="min-h-11 w-full rounded-xl bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-40">{m("Send now", "Enviar ahora")}</button>
          <button disabled={busy} onClick={cancel} className="min-h-11 w-full rounded-xl border border-border">{m("Cancel held request", "Cancelar solicitud en espera")}</button>
        </>}

        {intent && !accepted && intent.phase !== "held" && <>
          <p role="status" className="text-sm">{m("Request outcome unconfirmed. Do not resend.", "Resultado de la solicitud sin confirmar. No vuelvas a enviar.")}</p>
          <button disabled={busy} onClick={status} className="min-h-11 w-full rounded-xl border border-border">{m("Check status", "Revisar estado")}</button>
        </>}

        {accepted && <>
          <p role="status" className="text-sm">{m("Accepted for processing. This is not delivery confirmation — Broadcast History shows delivery results.", "Aceptado para procesamiento. Esto no confirma la entrega; el historial muestra los resultados.")}</p>
          <button onClick={() => { forget(); onSent(); onClose(); }} className="min-h-11 w-full rounded-xl border border-border">{m("Done", "Listo")}</button>
        </>}

        {intent && <p className="break-all text-xs text-muted-foreground">{m("Request", "Solicitud")}: {intent.broadcastId || intent.requestId}</p>}
        {diagnostic && <p role="status" className="break-words text-sm" data-testid="broadcast-preflight-diagnostic">{diagnostic}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </section>
  </div>;
}
