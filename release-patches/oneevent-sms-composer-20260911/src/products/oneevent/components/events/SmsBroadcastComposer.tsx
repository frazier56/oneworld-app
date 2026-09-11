import { useRef, useState } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { useMicro } from "@evt/i18n/LanguageContext";

type Contact = { rolodex_id: string; full_name: string; phone: string | null; sms_ok: boolean | null; attestation_id: string | null };
type Intent = { requestId: string; ids: string[]; message: string; recipients?: Contact[]; phase: "holding" | "held" | "releasing" | "unknown" | "accepted"; broadcastId?: string; reviewed?: boolean };
type Props = { hostId: string; eventId: string; title: string; contacts: Contact[]; onClose: () => void; onSent: () => void };
export default function SmsBroadcastComposer({ hostId, eventId, title, contacts, onClose, onSent }: Props) {
  const m = useMicro(), key = `oneevent:sms-intent:${hostId}:${eventId}`;
  const [intent, setIntent] = useState<Intent | null>(() => {
    try { const value = sessionStorage.getItem(key); if (!value) return null; const parsed = JSON.parse(value); if (!Array.isArray(parsed.ids) || typeof parsed.requestId !== "string") throw new Error("Invalid saved request"); return parsed; } catch { return { requestId: "unavailable", ids: [], message: "", phase: "unknown" }; }
  });
  const [message, setMessage] = useState(`You're invited to "${title}"!`);
  const [ack, setAck] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const ids = [...new Set(contacts.map(c => c.rolodex_id))];
  const valid = ids.length > 0 && ids.length === contacts.length && contacts.every(c => c.sms_ok === true && !!c.attestation_id && !!c.phone?.trim());
  const persist = (next: Intent) => { sessionStorage.setItem(key, JSON.stringify(next)); setIntent(next); };
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
  const hold = () => run(async () => {
    if (!valid || !ack || intent || !message.trim()) return;
    // Preflight is read-only. Never label destination counts as consent approval.
    const body = { eventId, rolodexIds: ids, channels: ["sms"], message: message.trim(), includeTicketLink: true, includeGroupChatLink: false, respectSuppressionTags: true };
    const plan = await invoke({ ...body, action: "preflight", preflightOnly: true });
    if (plan.messages_sent !== false || plan.writes_performed !== false || plan.channels_currently_enabled?.sms !== true || plan.selected_contacts !== ids.length || plan.matched_contacts !== ids.length || plan.channel_plan?.sms?.unique_destinations !== ids.length || plan.channel_plan?.sms?.missing_destination !== 0 || plan.channel_plan?.sms?.duplicate_destination !== 0) {
      setError(m("SMS is unavailable or the selected recipients did not pass review. No messages were sent.", "SMS no está disponible o los destinatarios no pasaron la revisión. No se enviaron mensajes.")); return;
    }
    const next: Intent = { requestId: crypto.randomUUID(), ids, recipients: contacts.map(({ rolodex_id, full_name, phone, sms_ok, attestation_id }) => ({ rolodex_id, full_name, phone, sms_ok, attestation_id })), message: body.message, phase: "holding" };
    // Persist before the first write; a lost response must not generate a new request.
    persist(next);
    const result = await invoke({ ...body, action: "hold", requestId: next.requestId, attestExternalPermission: true });
    if (result.status !== "held" || result.messages_sent !== false || !result.broadcast_id || result.summary?.queued_count !== ids.length || result.summary?.skipped_count !== 0) {
      persist({ ...next, broadcastId: result.broadcast_id, phase: "unknown" }); throw new Error("Held recipients did not match");
    }
    persist({ ...next, broadcastId: result.broadcast_id, phase: "held", reviewed: true });
  });
  const release = () => run(async () => {
    if (!intent?.broadcastId || intent.phase !== "held" || !intent.reviewed || !confirmed) return;
    persist({ ...intent, phase: "releasing" });
    const result = await invoke({ action: "release", broadcastId: intent.broadcastId, confirmRelease: true });
    if (result.status !== "processing" || result.broadcast_id !== intent.broadcastId) throw new Error("Unconfirmed release");
    persist({ ...intent, phase: "accepted" });
  });
  const check = () => run(async () => {
    if (!intent) return;
    const { data, error } = await supabase.from("event_rolodex_broadcasts" as any).select("id,status").eq("host_id", hostId).eq("event_id", eventId).eq("request_id", intent.requestId).maybeSingle();
    if (error) throw error;
    const row = data as { id: string; status: string } | null;
    if (row && ["processing", "completed", "completed_with_errors"].includes(row.status)) persist({ ...intent, broadcastId: row.id, phase: "accepted" });
    else if (row?.status === "cancelled") { sessionStorage.removeItem(key); setIntent(null); setAck(false); }
    else setError(m("Still unconfirmed. Review this request in Broadcast History; do not create a replacement send.", "Aún sin confirmar. Revisa esta solicitud en el historial; no crees un envío de reemplazo."));
  });
  const cancel = () => run(async () => {
    if (intent?.phase !== "held" || !intent.broadcastId) return;
    persist({ ...intent, phase: "unknown" });
    const result = await invoke({ action: "cancel", broadcastId: intent.broadcastId });
    if (result.status !== "cancelled" || result.broadcast_id !== intent.broadcastId) throw new Error("Unconfirmed cancellation");
    sessionStorage.removeItem(key); setIntent(null); setAck(false); setConfirmed(false);
  });
  const accepted = intent?.phase === "accepted";
  return <div role="dialog" aria-modal="true" aria-labelledby="sms-composer-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3">
    <section className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4"><h2 id="sms-composer-title" className="font-bold">{m("SMS invitation", "Invitación por SMS")}</h2><button disabled={busy} onClick={onClose} aria-label={m("Close", "Cerrar")} className="min-h-11 min-w-11">×</button></div>
      <div className="space-y-4 overflow-y-auto p-4">
        <p className="font-semibold">{title}</p>
        <p>{m("Selected recipients", "Destinatarios seleccionados")}: <strong>{intent?.ids.length ?? ids.length}</strong></p>
        <ul className="max-h-32 overflow-auto text-sm">{(intent?.ids ?? ids).map(id => { const c = (intent?.recipients ?? contacts).find(c => c.rolodex_id === id); return <li key={id}>{c ? `${c.full_name} · ${c.phone}` : id}</li>; })}</ul>
        {!intent && <><label className="block text-sm">{m("Message", "Mensaje")}<textarea value={message} onChange={e => setMessage(e.target.value)} disabled={busy} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background p-3" /></label>
          <p className="text-sm">{m("The event link is included. Saved SMS consent and opt-out checks still apply.", "Se incluye el enlace del evento. Se verifican el consentimiento SMS guardado y las bajas.")}</p>
          {!valid && <p role="alert">{m("Every selected contact needs a phone and saved SMS consent. Go back to adjust the selection.", "Cada contacto seleccionado necesita teléfono y consentimiento SMS guardado. Vuelve para ajustar la selección.")}</p>}
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={ack} disabled={busy} onChange={e => setAck(e.target.checked)} />{m("I confirm this event invitation and recipient selection. This does not grant contact consent.", "Confirmo esta invitación y los destinatarios. Esto no otorga consentimiento a los contactos.")}</label>
          <button disabled={busy || !valid || !ack || !message.trim()} onClick={hold} className="min-h-11 w-full rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-40">{m("Review SMS request", "Revisar solicitud SMS")}</button></>}
        {intent?.phase === "held" && <><p>{m("Held for review. Nothing has been sent.", "En espera de revisión. No se ha enviado nada.")}</p><p className="whitespace-pre-wrap rounded-xl border border-border p-3">{intent.message}</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{m("I confirm sending SMS to exactly these recipients.", "Confirmo enviar SMS exactamente a estos destinatarios.")}</label><button disabled={busy || !confirmed} onClick={release} className="min-h-11 w-full rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-40">{m("Send SMS", "Enviar SMS")} · {intent.ids.length}</button><button disabled={busy} onClick={cancel} className="min-h-11 w-full rounded-xl border border-border">{m("Cancel held request", "Cancelar solicitud en espera")}</button></>}
        {intent && !accepted && intent.phase !== "held" && <><p role="status">{m("Request outcome unconfirmed. Do not resend.", "Resultado de la solicitud sin confirmar. No vuelvas a enviar.")}</p><button disabled={busy} onClick={check} className="min-h-11 w-full rounded-xl border border-border">{m("Check status", "Revisar estado")}</button></>}
        {accepted && <><p role="status">{m("Accepted for processing. This is not delivery confirmation. Check Broadcast History for delivery results.", "Aceptado para procesamiento. Esto no confirma la entrega. Revisa los resultados en el historial.")}</p><button onClick={() => { sessionStorage.removeItem(key); onSent(); onClose(); }} className="min-h-11 w-full rounded-xl border border-border">{m("Done", "Listo")}</button></>}
        {intent && <p className="break-all text-xs">{m("Request", "Solicitud")}: {intent.broadcastId || intent.requestId}</p>}
        {error && <p role="alert" className="text-sm">{error}</p>}
      </div>
    </section>
  </div>;
}
