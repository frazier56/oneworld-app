/**
 * SYSTEM MESSAGES IN THE READER'S LANGUAGE (ONEWORLD 31, 23 Oct 2026; ORCHESTRATOR ruling on ONEJOB 2's I18N-04 item 7).
 * ============================================================================================
 * System chat lines and notifications used to be stored as finished English sentences written by the
 * SENDER's screen, so a Spanish reader got English no matter what. Now the writer also stores WHAT
 * happened, as an event key plus its parameters, and every reader's screen writes the sentence in that
 * reader's language. The stored text stays as the fallback for old rows, unknown events and old apps.
 *
 * No migration: both tables already carry `metadata jsonb` (messages.metadata; notifications.metadata,
 * which send_notification fills from its `n_meta` argument). The convention is:
 *
 *     metadata.event  = "agreement_accepted"           // a key in EVENTS below
 *     metadata.params = { title: "Paint the fence" }   // strings / numbers / booleans only
 *
 * Writers: `systemEvent("agreement_accepted", { title })` builds that object. Pass it as the message's
 * `metadata` or as send_notification's `n_meta`, and keep writing the English text as before.
 * Readers: `renderSystemText(lang, metadata, storedText)` for a chat line and
 * `renderNotification(lang, n)` for { title, body }. React renders the result as text, so a
 * parameter can never become markup.
 */
import { WA, type Localized } from "./i18n";

type Params = Record<string, string | number | boolean>;
type Template = { text?: Localized; title?: Localized; body?: Localized; when?: (p: Params) => Partial<Record<"text" | "title" | "body", Localized>> };

/* The money sentence that follows an accepted contract's chat line (param `money`). */
const MONEY: Record<string, Localized> = {
  vault: { en: "The payment has been collected into the OneJob Vault and stays there until you both mark the job complete.", es: "El pago se cobró y está en la Bóveda de OneJob hasta que ambos marquen el trabajo como completado.", de: "Die Zahlung wurde in den OneJob-Tresor eingezogen und bleibt dort, bis Sie beide den Auftrag als erledigt markieren.", pt: "O pagamento foi recebido no Cofre do OneJob e fica lá até que ambos marquem o trabalho como concluído.", ru: "Платёж получен в хранилище OneJob и остаётся там, пока вы оба не отметите работу выполненной.", zh: "付款已收入 OneJob 保险库，并将保留到双方都标记工作完成。" },
  external: { en: "You two are settling payment outside OneJob.", es: "Ustedes acordarán el pago fuera de OneJob.", de: "Sie beide regeln die Zahlung außerhalb von OneJob.", pt: "Vocês vão acertar o pagamento fora do OneJob.", ru: "Вы рассчитываетесь вне OneJob.", zh: "你们将在 OneJob 之外结算付款。" },
  free: { en: "This contract is free — there's nothing to collect.", es: "Este contrato es gratis — no hay nada que cobrar.", de: "Dieser Vertrag ist kostenlos – es gibt nichts einzuziehen.", pt: "Este contrato é gratuito — não há nada a cobrar.", ru: "Этот договор бесплатный — списывать нечего.", zh: "此合同免费——无需收款。" },
  setup: { en: "Payment still needs to be set up before the job starts.", es: "El pago aún debe configurarse antes de que empiece el trabajo.", de: "Die Zahlung muss vor Beginn des Auftrags noch eingerichtet werden.", pt: "O pagamento ainda precisa ser configurado antes do início do trabalho.", ru: "Перед началом работы нужно настроить оплату.", zh: "开工前仍需设置付款。" },
};

/* Each event lists what it needs. A missing required parameter means "use the stored text". */
const EVENTS: Record<string, { needs: string[]; t: Template }> = {
  /* Chat line written into the thread when a contract is accepted. */
  contract_accepted_line: { needs: ["title"], t: {
    text: { en: "✅ Contract accepted: \"{title}\".", es: "✅ Contrato aceptado: \"{title}\".", de: "✅ Vertrag angenommen: „{title}“.", pt: "✅ Contrato aceito: \"{title}\".", ru: "✅ Договор принят: «{title}».", zh: "✅ 合同已接受：“{title}”。" },
    when: p => ({ text: p.scheduled === false
      ? { en: "✅ Contract accepted: \"{title}\" — it is not on the calendar yet; open the contract to set the date.", es: "✅ Contrato aceptado: \"{title}\" — aún no está en el calendario; abra el contrato para fijar la fecha.", de: "✅ Vertrag angenommen: „{title}“ – noch nicht im Kalender; öffnen Sie den Vertrag, um das Datum festzulegen.", pt: "✅ Contrato aceito: \"{title}\" — ainda não está no calendário; abra o contrato para definir a data.", ru: "✅ Договор принят: «{title}» — его ещё нет в календаре; откройте договор, чтобы указать дату.", zh: "✅ 合同已接受：“{title}”——尚未加入日历，请打开合同设置日期。" }
      : { en: "✅ Contract accepted: \"{title}\" — the job is scheduled.", es: "✅ Contrato aceptado: \"{title}\" — el trabajo está programado.", de: "✅ Vertrag angenommen: „{title}“ – der Auftrag ist eingeplant.", pt: "✅ Contrato aceito: \"{title}\" — o trabalho está agendado.", ru: "✅ Договор принят: «{title}» — работа запланирована.", zh: "✅ 合同已接受：“{title}”——工作已排期。" } }),
  } },
  /* Chat line written into the thread when a contract is declined. */
  contract_declined_line: { needs: ["title"], t: {
    when: p => ({ text: p.released === true
      ? { en: "❌ Contract declined: \"{title}\". The payment hold has been released.", es: "❌ Contrato rechazado: \"{title}\". La retención del pago fue liberada.", de: "❌ Vertrag abgelehnt: „{title}“. Die Zahlungsreservierung wurde aufgehoben.", pt: "❌ Contrato recusado: \"{title}\". A retenção do pagamento foi liberada.", ru: "❌ Договор отклонён: «{title}». Блокировка платежа снята.", zh: "❌ 合同已拒绝：“{title}”。付款冻结已解除。" }
      : { en: "❌ Contract declined: \"{title}\". The payment hold wasn't released automatically; an uncollected hold lapses on its own within 7 days.", es: "❌ Contrato rechazado: \"{title}\". La retención no se liberó automáticamente; una retención no cobrada vence sola en 7 días.", de: "❌ Vertrag abgelehnt: „{title}“. Die Reservierung wurde nicht automatisch aufgehoben; eine nicht eingezogene Reservierung verfällt innerhalb von 7 Tagen von selbst.", pt: "❌ Contrato recusado: \"{title}\". A retenção não foi liberada automaticamente; uma retenção não cobrada expira sozinha em 7 dias.", ru: "❌ Договор отклонён: «{title}». Блокировка не снята автоматически; неиспользованная блокировка снимается сама в течение 7 дней.", zh: "❌ 合同已拒绝：“{title}”。付款冻结未能自动解除；未扣款的冻结会在 7 天内自动失效。" } }),
  } },
  agreement_accepted: { needs: ["title"], t: {
    title: { en: "Contract accepted ✅", es: "Contrato aceptado ✅", de: "Vertrag angenommen ✅", pt: "Contrato aceito ✅", ru: "Договор принят ✅", zh: "合同已接受 ✅" },
    when: p => ({ body: p.captured === true
      ? { en: "\"{title}\" is on. The payment is now in the OneJob Vault until you both mark it complete.", es: "\"{title}\" está en marcha. El pago está ahora en la Bóveda de OneJob hasta que ambos lo marquen como completado.", de: "„{title}“ läuft. Die Zahlung liegt jetzt im OneJob-Tresor, bis Sie beide den Auftrag als erledigt markieren.", pt: "\"{title}\" está confirmado. O pagamento está agora no Cofre do OneJob até que ambos marquem como concluído.", ru: "«{title}» в работе. Платёж хранится в хранилище OneJob, пока вы оба не отметите работу выполненной.", zh: "“{title}”已开始。款项现存放在 OneJob 保险库中，直到双方都标记完成。" }
      : { en: "\"{title}\" is on.", es: "\"{title}\" está en marcha.", de: "„{title}“ läuft.", pt: "\"{title}\" está confirmado.", ru: "«{title}» в работе.", zh: "“{title}”已开始。" } }),
  } },
  agreement_declined: { needs: ["title"], t: {
    title: { en: "Contract declined", es: "Contrato rechazado", de: "Vertrag abgelehnt", pt: "Contrato recusado", ru: "Договор отклонён", zh: "合同已拒绝" },
    when: p => ({ body: p.released === true
      ? { en: "\"{title}\" was declined. You were not charged — the hold is released.", es: "\"{title}\" fue rechazado. No se le cobró — la retención fue liberada.", de: "„{title}“ wurde abgelehnt. Ihnen wurde nichts berechnet – die Reservierung ist aufgehoben.", pt: "\"{title}\" foi recusado. Você não foi cobrado — a retenção foi liberada.", ru: "«{title}» отклонён. Деньги не списаны — блокировка снята.", zh: "“{title}”已被拒绝。您未被扣款——冻结已解除。" }
      : { en: "\"{title}\" was declined. You were not charged. The hold on your card wasn't released automatically; it lapses on its own within 7 days — contact support if it stays.", es: "\"{title}\" fue rechazado. No se le cobró. La retención en su tarjeta no se liberó automáticamente; vence sola en 7 días — contacte a soporte si sigue ahí.", de: "„{title}“ wurde abgelehnt. Ihnen wurde nichts berechnet. Die Reservierung auf Ihrer Karte wurde nicht automatisch aufgehoben; sie verfällt innerhalb von 7 Tagen – wenden Sie sich an den Support, falls sie bleibt.", pt: "\"{title}\" foi recusado. Você não foi cobrado. A retenção no seu cartão não foi liberada automaticamente; ela expira sozinha em 7 dias — fale com o suporte se continuar.", ru: "«{title}» отклонён. Деньги не списаны. Блокировка на карте не снята автоматически; она снимется сама в течение 7 дней — обратитесь в поддержку, если она останется.", zh: "“{title}”已被拒绝。您未被扣款。您卡上的冻结未能自动解除，将在 7 天内自动失效——如仍存在请联系客服。" } }),
  } },
  job_marked_complete: { needs: ["title"], t: {
    title: { en: "Job marked complete ✔️", es: "Trabajo marcado como completado ✔️", de: "Auftrag als erledigt markiert ✔️", pt: "Trabalho marcado como concluído ✔️", ru: "Работа отмечена выполненной ✔️", zh: "工作已标记完成 ✔️" },
    when: p => ({ body: p.by === "hirer"
      ? { en: "The hirer marked \"{title}\" complete — confirm on your side to release payment.", es: "Quien contrató marcó \"{title}\" como completado — confirme de su lado para liberar el pago.", de: "Der Auftraggeber hat „{title}“ als erledigt markiert – bestätigen Sie auf Ihrer Seite, um die Zahlung freizugeben.", pt: "Quem contratou marcou \"{title}\" como concluído — confirme do seu lado para liberar o pagamento.", ru: "Заказчик отметил «{title}» выполненной — подтвердите со своей стороны, чтобы выплатить деньги.", zh: "雇主已将“{title}”标记为完成——请在您这边确认以发放付款。" }
      : { en: "The professional marked \"{title}\" complete — confirm on your side to release payment.", es: "El profesional marcó \"{title}\" como completado — confirme de su lado para liberar el pago.", de: "Die Fachkraft hat „{title}“ als erledigt markiert – bestätigen Sie auf Ihrer Seite, um die Zahlung freizugeben.", pt: "O profissional marcou \"{title}\" como concluído — confirme do seu lado para liberar o pagamento.", ru: "Исполнитель отметил «{title}» выполненной — подтвердите со своей стороны, чтобы выплатить деньги.", zh: "专业人员已将“{title}”标记为完成——请在您这边确认以发放付款。" } }),
  } },
  /* OneEvent (ONEEVENT 31, 23 Oct): a host confirmed a payment made outside the card rail. `method` is a
     brand name (Wise, PayPal) and is never translated; `eventTitle` is optional. */
  event_payment_confirmed: { needs: ["method"], t: {
    title: { en: "Your {method} payment was confirmed", es: "Su pago por {method} fue confirmado", de: "Ihre {method}-Zahlung wurde bestätigt", pt: "Seu pagamento via {method} foi confirmado", ru: "Ваш платёж через {method} подтверждён", zh: "您的 {method} 付款已确认" },
    when: p => ({ body: typeof p.eventTitle === "string" && p.eventTitle.trim()
      ? { en: "The host confirmed your {method} payment — your ticket for \"{eventTitle}\" is now active.", es: "El anfitrión confirmó su pago por {method} — su entrada para \"{eventTitle}\" ya está activa.", de: "Der Gastgeber hat Ihre {method}-Zahlung bestätigt – Ihr Ticket für „{eventTitle}“ ist jetzt aktiv.", pt: "O anfitrião confirmou seu pagamento via {method} — seu ingresso para \"{eventTitle}\" já está ativo.", ru: "Организатор подтвердил ваш платёж через {method} — ваш билет на «{eventTitle}» активен.", zh: "主办方已确认您的 {method} 付款——您的“{eventTitle}”门票现已生效。" }
      : { en: "The host confirmed your {method} payment — your ticket is now active.", es: "El anfitrión confirmó su pago por {method} — su entrada ya está activa.", de: "Der Gastgeber hat Ihre {method}-Zahlung bestätigt – Ihr Ticket ist jetzt aktiv.", pt: "O anfitrião confirmou seu pagamento via {method} — seu ingresso já está ativo.", ru: "Организатор подтвердил ваш платёж через {method} — ваш билет активен.", zh: "主办方已确认您的 {method} 付款——您的门票现已生效。" } }),
  } },
  job_completed: { needs: ["title"], t: {
    title: { en: "Job completed 🎉", es: "Trabajo completado 🎉", de: "Auftrag abgeschlossen 🎉", pt: "Trabalho concluído 🎉", ru: "Работа завершена 🎉", zh: "工作已完成 🎉" },
    when: p => ({ body: p.released === true
      ? { en: "\"{title}\" is done and the payment has been released. Leave your review!", es: "\"{title}\" está terminado y el pago fue liberado. ¡Deje su reseña!", de: "„{title}“ ist erledigt und die Zahlung wurde freigegeben. Hinterlassen Sie Ihre Bewertung!", pt: "\"{title}\" está concluído e o pagamento foi liberado. Deixe sua avaliação!", ru: "«{title}» завершена, оплата перечислена. Оставьте отзыв!", zh: "“{title}”已完成，付款已发放。请留下您的评价！" }
      : { en: "\"{title}\" is done. Leave your review!", es: "\"{title}\" está terminado. ¡Deje su reseña!", de: "„{title}“ ist erledigt. Hinterlassen Sie Ihre Bewertung!", pt: "\"{title}\" está concluído. Deixe sua avaliação!", ru: "«{title}» завершена. Оставьте отзыв!", zh: "“{title}”已完成。请留下您的评价！" } }),
  } },
};

export const SYSTEM_EVENTS = Object.keys(EVENTS);

/** What a writer stores in `metadata` / `n_meta`. Only plain values; long text is cut. */
export function systemEvent(event: string, params: Record<string, unknown>): { event: string; params: Params } {
  const clean: Params = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") clean[k] = v.slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean") clean[k] = v;
  }
  return { event, params: clean };
}

/* OWN keys only (Max, E9 review, 23 Oct 2026): `"toString" in EVENTS` is true, because `in` also sees what every
   object inherits. A row whose metadata.event was "__proto__", "constructor" or "toString" was therefore treated as a
   known event and the renderer threw on it, which could stop a whole Alerts list from drawing. Every lookup into a
   table here now checks the table's OWN keys, and the shape is checked before it is used. */
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function readEvent(metadata: unknown): { def: (typeof EVENTS)[string]; params: Params } | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as { event?: unknown; params?: unknown };
  if (typeof m.event !== "string" || !own(EVENTS, m.event)) return null;
  const def = EVENTS[m.event];
  if (!def || !Array.isArray(def.needs) || !def.t || typeof def.t !== "object") return null;
  const raw = m.params && typeof m.params === "object" && !Array.isArray(m.params) ? (m.params as Record<string, unknown>) : {};
  const params: Params = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") params[k] = v;
  for (const need of def.needs) if (typeof params[need] !== "string" || !String(params[need]).trim()) return null;
  return { def, params };
}

const fill = (s: string, p: Params) => s.replace(/\{(\w+)\}/g, (_, k) => (own(p, k) ? String(p[k]) : ""));

function pick(lang: string, def: (typeof EVENTS)[string], params: Params, field: "text" | "title" | "body"): string | null {
  const t = { ...def.t, ...(def.t.when ? def.t.when(params) : {}) };
  const loc = t[field];
  if (!loc) return null;
  const money = field === "text" && typeof params.money === "string" && own(MONEY, params.money) ? " " + WA(lang, MONEY[params.money]) : "";
  return fill(WA(lang, loc), params) + money;
}

/** A chat line in the reader's language; the stored text when the row carries no known event. */
export function renderSystemText(lang: string, metadata: unknown, storedText: string): string {
  try {
    const e = readEvent(metadata);
    const s = e && pick(lang, e.def, e.params, "text");
    return typeof s === "string" && s ? s : storedText;
  } catch { return storedText; }   /* never throws: one odd row can never stop a thread from drawing */
}

/** True when this chat line will be written by the reader's screen (so it must not be machine-translated). */
export function isLocalizedSystemLine(metadata: unknown): boolean {
  try {
    const e = readEvent(metadata);
    return !!e && !!pick("en", e.def, e.params, "text");
  } catch { return false; }
}

/** A notification's title and body in the reader's language; the stored ones for anything unknown. */
export function renderNotification(lang: string, n: { title?: string | null; body?: string | null; metadata?: unknown }): { title: string; body: string } {
  const stored = { title: typeof n?.title === "string" ? n.title : "", body: typeof n?.body === "string" ? n.body : "" };
  try {
    const e = readEvent(n?.metadata);
    if (!e) return stored;
    const title = pick(lang, e.def, e.params, "title"), body = pick(lang, e.def, e.params, "body");
    return { title: typeof title === "string" && title ? title : stored.title, body: typeof body === "string" && body ? body : stored.body };
  } catch { return stored; }   /* never throws: one odd row falls back to its stored text, the list keeps drawing */
}
