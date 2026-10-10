/* ── THE REVIEW SHEET — ONE FOR EVERY APP ──────────────────────────────────────────────────────
   Lee, 9 Oct 2026: "everyone gets a review … once you finish that interaction, you bring your
   review screen up … just like Uber, you give them four or five stars … and then options, what
   was the problem … make it a better interface … and the reviews count to OneScore."

   The database decides WHEN (an app's finish writes a `review_prompts` row for each person — see
   20261009_reviews_spine.sql). This component only asks `my_review_prompts()` and shows the oldest
   one. It is mounted once in AppShell, so every product gets it without writing a line.

   It re-checks when the app opens, every time the route changes (at most once a minute), and at
   once when a screen fires `ow-review-check` (OneRide does, the moment a ride completes).

   Rules the sheet keeps:
   · Stars first. Reasons appear only after, and they match the stars: praise for 4–5, problems for
     1–3 (the server refuses a mismatch, so the screen never offers one).
   · "Not now" is a real answer: the sheet comes back tomorrow, not on the next tap.
   · Reviews are blind until both people have reviewed, or for 7 days — said on the sheet, because
     it is the reason people answer honestly. */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useOneId } from "../lib/oneId";
import { useI18n, W, registerCopy } from "../lib/i18n";

type Prompt = {
  prompt_id: string; app: string; source_kind: string; source_id: string; about_role: string;
  reviewee_id: string; reviewee_name: string | null; reviewee_photo: string | null; created_at: string;
};
type Tag = { tag: string; positive: boolean; sort: number };

export const REVIEW_CHECK_EVENT = "ow-review-check";
/** A screen that just finished an interaction calls this so the sheet appears at once. */
export function requestReviewCheck() { window.dispatchEvent(new Event(REVIEW_CHECK_EVENT)); }

/* Tag labels — the catalogue holds keys; the words live here so every language reads naturally. */
const TAGS: Record<string, [string, string]> = {
  great_conversation: ["Great conversation", "Buena conversación"], clean_car: ["Clean car", "Carro limpio"],
  safe_driving: ["Safe driving", "Manejo seguro"], smooth_route: ["Good route", "Buena ruta"],
  on_time: ["On time", "Puntual"], above_and_beyond: ["Above and beyond", "Fue más allá"],
  late_pickup: ["Late pickup", "Llegó tarde"], unsafe_driving: ["Unsafe driving", "Manejo inseguro"],
  car_not_clean: ["Car not clean", "Carro sucio"], rude: ["Rude", "Grosero"], wrong_route: ["Wrong route", "Ruta equivocada"],
  price_changed: ["Price changed", "Cambió el precio"], other: ["Other", "Otro"],
  respectful: ["Respectful", "Respetuoso"], left_car_clean: ["Left the car clean", "Dejó el carro limpio"],
  late: ["Late", "Tarde"], no_show: ["Didn't show up", "No se presentó"], left_mess: ["Left a mess", "Dejó desorden"],
  changed_plans: ["Changed plans", "Cambió los planes"],
  quality_work: ["Quality work", "Trabajo de calidad"], great_communication: ["Great communication", "Buena comunicación"],
  professional: ["Professional", "Profesional"], good_value: ["Good value", "Buen precio"],
  poor_quality: ["Poor quality", "Mala calidad"], unprofessional: ["Unprofessional", "Poco profesional"],
  clear_brief: ["Clear instructions", "Instrucciones claras"], paid_promptly: ["Paid promptly", "Pagó a tiempo"],
  unclear_brief: ["Unclear instructions", "Instrucciones confusas"], scope_creep: ["Kept adding work", "Siguió agregando trabajo"],
};

registerCopy({
  de: {
    "How was your ride with {0}?": "Wie war Ihre Fahrt mit {0}?", "How was {0} as a rider?": "Wie war {0} als Fahrgast?",
    "How was the work from {0}?": "Wie war die Arbeit von {0}?", "How was working with {0}?": "Wie war die Zusammenarbeit mit {0}?",
    "How was it with {0}?": "Wie war es mit {0}?", "What went well?": "Was lief gut?", "What went wrong?": "Was lief schief?",
    "Add a comment (optional)": "Kommentar hinzufügen (optional)", "Not now": "Nicht jetzt", "Submit": "Senden",
    "Thanks — your review is in.": "Danke — Ihre Bewertung ist eingegangen.",
    "Hidden until you both review, or for 7 days.": "Verborgen, bis Sie beide bewertet haben, oder 7 Tage lang.",
    "{0} stars": "{0} Sterne", "That didn't go through. Try again.": "Das hat nicht geklappt. Versuchen Sie es erneut.",
    "Great conversation": "Gutes Gespräch", "Clean car": "Sauberes Auto", "Safe driving": "Sicher gefahren", "Good route": "Gute Route",
    "On time": "Pünktlich", "Above and beyond": "Mehr als erwartet", "Late pickup": "Zu spät abgeholt", "Unsafe driving": "Unsicher gefahren",
    "Car not clean": "Auto nicht sauber", "Rude": "Unhöflich", "Wrong route": "Falsche Route", "Price changed": "Preis geändert", "Other": "Anderes",
    "Respectful": "Respektvoll", "Left the car clean": "Auto sauber hinterlassen", "Late": "Zu spät", "Didn't show up": "Nicht erschienen",
    "Left a mess": "Unordnung hinterlassen", "Changed plans": "Pläne geändert", "Quality work": "Gute Arbeit",
    "Great communication": "Gute Kommunikation", "Professional": "Professionell", "Good value": "Gutes Preis-Leistungs-Verhältnis",
    "Poor quality": "Schlechte Qualität", "Unprofessional": "Unprofessionell", "Clear instructions": "Klare Anweisungen",
    "Paid promptly": "Pünktlich bezahlt", "Unclear instructions": "Unklare Anweisungen", "Kept adding work": "Immer mehr Arbeit verlangt",
  },
  pt: {
    "How was your ride with {0}?": "Como foi sua viagem com {0}?", "How was {0} as a rider?": "Como foi {0} como passageiro?",
    "How was the work from {0}?": "Como foi o trabalho de {0}?", "How was working with {0}?": "Como foi trabalhar com {0}?",
    "How was it with {0}?": "Como foi com {0}?", "What went well?": "O que foi bom?", "What went wrong?": "O que deu errado?",
    "Add a comment (optional)": "Adicione um comentário (opcional)", "Not now": "Agora não", "Submit": "Enviar",
    "Thanks — your review is in.": "Obrigado — sua avaliação foi enviada.",
    "Hidden until you both review, or for 7 days.": "Oculta até vocês dois avaliarem, ou por 7 dias.",
    "{0} stars": "{0} estrelas", "That didn't go through. Try again.": "Não deu certo. Tente de novo.",
    "Great conversation": "Ótima conversa", "Clean car": "Carro limpo", "Safe driving": "Direção segura", "Good route": "Boa rota",
    "On time": "Pontual", "Above and beyond": "Foi além", "Late pickup": "Buscou atrasado", "Unsafe driving": "Direção insegura",
    "Car not clean": "Carro sujo", "Rude": "Grosseiro", "Wrong route": "Rota errada", "Price changed": "Mudou o preço", "Other": "Outro",
    "Respectful": "Respeitoso", "Left the car clean": "Deixou o carro limpo", "Late": "Atrasado", "Didn't show up": "Não apareceu",
    "Left a mess": "Deixou bagunça", "Changed plans": "Mudou os planos", "Quality work": "Trabalho de qualidade",
    "Great communication": "Ótima comunicação", "Professional": "Profissional", "Good value": "Bom preço",
    "Poor quality": "Baixa qualidade", "Unprofessional": "Pouco profissional", "Clear instructions": "Instruções claras",
    "Paid promptly": "Pagou em dia", "Unclear instructions": "Instruções confusas", "Kept adding work": "Ficou pedindo mais trabalho",
  },
  ru: {
    "How was your ride with {0}?": "Как прошла поездка с {0}?", "How was {0} as a rider?": "Каким пассажиром был(а) {0}?",
    "How was the work from {0}?": "Как {0} выполнил(а) работу?", "How was working with {0}?": "Как работалось с {0}?",
    "How was it with {0}?": "Как всё прошло с {0}?", "What went well?": "Что понравилось?", "What went wrong?": "Что пошло не так?",
    "Add a comment (optional)": "Комментарий (необязательно)", "Not now": "Не сейчас", "Submit": "Отправить",
    "Thanks — your review is in.": "Спасибо — отзыв отправлен.",
    "Hidden until you both review, or for 7 days.": "Скрыт, пока вы оба не оставите отзыв, или 7 дней.",
    "{0} stars": "{0} звёзд", "That didn't go through. Try again.": "Не получилось. Попробуйте ещё раз.",
    "Great conversation": "Приятная беседа", "Clean car": "Чистая машина", "Safe driving": "Безопасное вождение", "Good route": "Хороший маршрут",
    "On time": "Вовремя", "Above and beyond": "Сверх ожиданий", "Late pickup": "Опоздал(а)", "Unsafe driving": "Опасное вождение",
    "Car not clean": "Грязная машина", "Rude": "Грубость", "Wrong route": "Не тот маршрут", "Price changed": "Изменил(а) цену", "Other": "Другое",
    "Respectful": "Вежливо", "Left the car clean": "Оставил(а) машину чистой", "Late": "Опоздание", "Didn't show up": "Не пришёл(ла)",
    "Left a mess": "Оставил(а) беспорядок", "Changed plans": "Изменил(а) планы", "Quality work": "Качественная работа",
    "Great communication": "Отличная связь", "Professional": "Профессионально", "Good value": "Хорошая цена",
    "Poor quality": "Плохое качество", "Unprofessional": "Непрофессионально", "Clear instructions": "Понятное задание",
    "Paid promptly": "Оплатил(а) вовремя", "Unclear instructions": "Непонятное задание", "Kept adding work": "Добавлял(а) работу",
  },
  zh: {
    "How was your ride with {0}?": "您和 {0} 的行程如何？", "How was {0} as a rider?": "{0} 作为乘客表现如何？",
    "How was the work from {0}?": "{0} 的工作做得如何？", "How was working with {0}?": "和 {0} 合作得如何？",
    "How was it with {0}?": "和 {0} 的体验如何？", "What went well?": "哪些地方好？", "What went wrong?": "哪里有问题？",
    "Add a comment (optional)": "添加评论（可选）", "Not now": "稍后", "Submit": "提交",
    "Thanks — your review is in.": "谢谢——您的评价已提交。",
    "Hidden until you both review, or for 7 days.": "在双方都评价前隐藏，最多 7 天。",
    "{0} stars": "{0} 星", "That didn't go through. Try again.": "未能提交，请重试。",
    "Great conversation": "聊得愉快", "Clean car": "车很干净", "Safe driving": "驾驶安全", "Good route": "路线合理",
    "On time": "准时", "Above and beyond": "超出预期", "Late pickup": "接人迟到", "Unsafe driving": "驾驶不安全",
    "Car not clean": "车不干净", "Rude": "态度粗鲁", "Wrong route": "路线错误", "Price changed": "临时改价", "Other": "其他",
    "Respectful": "有礼貌", "Left the car clean": "保持车内整洁", "Late": "迟到", "Didn't show up": "未出现",
    "Left a mess": "弄脏了车", "Changed plans": "临时改计划", "Quality work": "做工好",
    "Great communication": "沟通顺畅", "Professional": "专业", "Good value": "物有所值",
    "Poor quality": "质量差", "Unprofessional": "不专业", "Clear instructions": "需求清楚",
    "Paid promptly": "按时付款", "Unclear instructions": "需求不清", "Kept adding work": "不断加活",
  },
});

function question(lang: string, p: Prompt, name: string) {
  const fill = (s: string) => s.replace("{0}", name);
  if (p.app === "oneride" && p.about_role === "driver") return fill(W(lang, "How was your ride with {0}?", "¿Cómo fue su viaje con {0}?"));
  if (p.app === "oneride" && p.about_role === "rider") return fill(W(lang, "How was {0} as a rider?", "¿Qué tal fue {0} como pasajero?"));
  if (p.about_role === "pro") return fill(W(lang, "How was the work from {0}?", "¿Qué tal fue el trabajo de {0}?"));
  if (p.about_role === "client") return fill(W(lang, "How was working with {0}?", "¿Qué tal fue trabajar con {0}?"));
  return fill(W(lang, "How was it with {0}?", "¿Qué tal fue con {0}?"));
}

export default function ReviewPromptHost() {
  const { userId } = useOneId();
  const loc = useLocation();
  const [queue, setQueue] = useState<Prompt[]>([]);
  const last = useRef(0);

  const check = useCallback(async (force = false) => {
    if (!userId) { setQueue([]); return; }
    if (!force && Date.now() - last.current < 60_000) return;
    last.current = Date.now();
    const { data, error } = await supabase.rpc("my_review_prompts");
    if (!error) setQueue((data ?? []) as Prompt[]);       // a failed read keeps what is on screen
  }, [userId]);

  useEffect(() => { void check(true); }, [check]);
  useEffect(() => { void check(); }, [loc.pathname, check]);
  useEffect(() => {
    const on = () => void check(true);
    window.addEventListener(REVIEW_CHECK_EVENT, on);
    return () => window.removeEventListener(REVIEW_CHECK_EVENT, on);
  }, [check]);

  const current = queue[0];
  /* Never over a sign-in, a thread composer or the admin console: a review that interrupts typing
     is a review answered badly. */
  if (!current || loc.pathname.startsWith("/admin") || /\/messages\/[^/]+$/.test(loc.pathname)) return null;
  return <ReviewSheet key={current.prompt_id} prompt={current} onDone={() => setQueue(q => q.slice(1))} />;
}

function ReviewSheet({ prompt, onDone }: { prompt: Prompt; onDone: () => void }) {
  const { lang } = useI18n();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [catalog, setCatalog] = useState<Tag[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const name = (prompt.reviewee_name ?? "").trim().split(/\s+/)[0] || W(lang, "them", "esta persona");

  useEffect(() => {
    let alive = true;
    void supabase.from("review_tag_catalog").select("tag, positive, sort")
      .eq("app", prompt.app).eq("about_role", prompt.about_role).order("sort")
      .then(({ data }) => { if (alive) setCatalog((data ?? []) as Tag[]); });
    return () => { alive = false; };
  }, [prompt.app, prompt.about_role]);

  const positive = stars >= 4;
  const chips = stars ? catalog.filter(t => t.positive === positive) : [];
  const pick = (n: number) => { setStars(n); if ((n >= 4) !== positive || !stars) setTags([]); setErr(null); };
  const toggle = (t: string) => setTags(x => (x.includes(t) ? x.filter(y => y !== t) : [...x, t]));

  async function submit() {
    if (!stars || busy) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("submit_member_review",
      { p_prompt: prompt.prompt_id, p_rating: stars, p_tags: tags, p_comment: comment.trim() || null });
    setBusy(false);
    if (error && !/already reviewed/i.test(error.message)) { setErr(W(lang, "That didn't go through. Try again.", "No se envió. Intente de nuevo.")); return; }
    setThanks(true);
    window.setTimeout(onDone, 1100);
  }
  async function later() {
    if (busy) return;
    setBusy(true);
    await supabase.rpc("snooze_review_prompt", { p_prompt: prompt.prompt_id });
    setBusy(false);
    onDone();
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true"
      aria-label={question(lang, prompt, name)}
      style={{ background: "rgba(11,15,26,.42)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/40 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl dark:border-white/[0.12]"
        style={{ background: "var(--overlay-bg)", boxShadow: "var(--frostedge), var(--glass-shadow)" }}>
        {thanks ? (
          <p className="py-10 text-center text-[16px] font-extrabold">{W(lang, "Thanks — your review is in.", "Gracias — su reseña quedó enviada.")}</p>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              {prompt.reviewee_photo
                ? <img src={prompt.reviewee_photo} alt="" className="h-16 w-16 rounded-full object-cover" />
                : <span className="grid h-16 w-16 place-items-center rounded-full bg-brand text-2xl font-black text-white dark:bg-brand-light dark:text-ink">{name.slice(0, 1).toUpperCase()}</span>}
              <p className="mt-3 text-[18px] font-extrabold leading-snug">{question(lang, prompt, name)}</p>
            </div>
            <div className="mt-4 flex justify-center gap-1.5" role="radiogroup">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" role="radio" aria-checked={stars === n} onClick={() => pick(n)}
                  aria-label={W(lang, "{0} stars", "{0} estrellas").replace("{0}", String(n))}
                  className="ow-tap grid h-12 w-12 place-items-center rounded-full">
                  <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
                    <path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2L2.9 9.4l6.3-.9z"
                      fill={n <= stars ? "#F5B301" : "none"} stroke={n <= stars ? "#F5B301" : "currentColor"} strokeOpacity={n <= stars ? 1 : 0.4} strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
            {stars > 0 && chips.length > 0 && (
              <div className="mt-4">
                <p className="text-center text-[13.5px] font-bold">{positive ? W(lang, "What went well?", "¿Qué estuvo bien?") : W(lang, "What went wrong?", "¿Qué salió mal?")}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {chips.map(c => {
                    const on = tags.includes(c.tag);
                    const [en, es] = TAGS[c.tag] ?? [c.tag, c.tag];
                    return (
                      <button key={c.tag} type="button" aria-pressed={on} onClick={() => toggle(c.tag)}
                        className={`ow-tap rounded-full border px-3.5 py-2 text-[13px] font-bold ${on ? "border-transparent bg-brand text-white dark:bg-brand-light dark:text-ink" : "ow-edge"}`}>
                        {W(lang, en, es)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {stars > 0 && (
              <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 1000))} rows={3}
                placeholder={W(lang, "Add a comment (optional)", "Agregue un comentario (opcional)")}
                className="input mt-4 w-full resize-none text-base" />
            )}
            {err && <p role="alert" className="mt-2 text-center text-sm font-bold text-rose-600 dark:text-rose-300">{err}</p>}
            <p className="mt-3 text-center text-[12px] opacity-60">{W(lang, "Hidden until you both review, or for 7 days.", "Oculta hasta que ambos califiquen, o por 7 días.")}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => void later()} className="ow-tap ow-edge rounded-xl border py-3 text-[14px] font-bold disabled:opacity-50">{W(lang, "Not now", "Ahora no")}</button>
              <button type="button" disabled={busy || !stars} onClick={() => void submit()} className="btn-primary disabled:opacity-50">{W(lang, "Submit", "Enviar")}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
