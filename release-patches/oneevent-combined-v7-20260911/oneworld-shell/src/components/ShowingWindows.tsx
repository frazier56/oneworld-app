import { useEffect, useState } from "react";
import { W } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { NOTICE_CHOICES, noticeLabel } from "../lib/showings";

/**
 * THE HOST'S SIDE OF SHOWINGS — when they are willing to open the door.
 * ============================================================================================
 * Lee, 15 August 2026:
 *
 *   *"As long as the host designates the blocks in the calendar where the user can book times
 *   automatically, then they can just automatically book them. It may require twenty four hours
 *   notice, so the host would say — do you want six hours, twelve, twenty four, forty eight hours
 *   notice? So a user can't book it to tonight, one hour from now."*
 *
 * v51 shipped the guest half and seeded one property's windows by hand. This is the half that
 * makes it a feature rather than a demo.
 *
 * ── WHY WEEKLY BLOCKS AND NOT A CALENDAR ────────────────────────────────────────────────────
 * A calendar asks the host to answer the same question fifty-two times a year. Nobody keeps that
 * up, and a stale calendar is worse than none — it sends a stranger to a door on a day the host
 * forgot to close. A weekly pattern is how people actually hold their own time ("evenings after
 * work, Saturday mornings"), it stays true without maintenance, and the notice period covers the
 * exceptions. One-off blackouts can come later; they are a smaller need than this.
 *
 * ── AND WHY IT IS ONE ROW PER DAY, NOT A GRID ───────────────────────────────────────────────
 * Seven days times a start and an end is fourteen controls. On a 390px phone a grid of those is
 * the "train wreck" Lee described on the rooms row in August. One row per day, only the days
 * they switch on, and nothing renders for a day they do not offer.
 */

type Row = { weekday: number; starts_at: string; ends_at: string };

const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/* Monday first. Sunday-first is a US convention and this product is Colombian; the array is
   indexed by getDay() so the ORDER here is presentation only and nothing downstream shifts. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const hhmm = (t: string) => (t || "").slice(0, 5);

export default function ShowingWindows({
  propertyId, enabled, onEnabledChange, notice, onNoticeChange, slotMinutes, onSlotChange, lang,
  onCreateDraft,
}: {
  /** Null while the listing is still being created. Choosing the first day creates a draft. */
  propertyId: string | null;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  notice: number;
  onNoticeChange: (v: number) => void;
  slotMinutes: number;
  onSlotChange: (v: number) => void;
  lang: string;
  onCreateDraft?: () => Promise<string | null>;
}) {
  const es = lang === "es" || lang === "co";
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!propertyId) { setLoaded(true); return; }
    let dead = false;
    supabase.from("showing_windows").select("weekday, starts_at, ends_at").eq("property_id", propertyId)
      .then(({ data }) => { if (!dead) { setRows((data ?? []) as Row[]); setLoaded(true); } });
    return () => { dead = true; };
  }, [propertyId]);

  /** Persist immediately. A host who sets Tuesday and then abandons the form has still told us
      something true, and losing it means asking them the same question twice. */
  async function persist(next: Row[]) {
    setRows(next);
    const id = propertyId || await onCreateDraft?.();
    if (!id) return;
    await supabase.from("showing_windows").delete().eq("property_id", id);
    if (next.length) {
      await supabase.from("showing_windows").insert(
        next.map(r => ({ property_id: id, weekday: r.weekday, starts_at: r.starts_at, ends_at: r.ends_at })));
    }
  }

  const rowFor = (d: number) => rows.find(r => r.weekday === d);

  function toggleDay(d: number) {
    const has = !!rowFor(d);
    /* A sensible default beats an empty pair of time boxes: most viewings happen after work, and
       a host who wants mornings will change it in two taps. */
    persist(has ? rows.filter(r => r.weekday !== d)
                : [...rows, { weekday: d, starts_at: "17:00", ends_at: "19:00" }]);
  }

  function setTime(d: number, which: "starts_at" | "ends_at", v: string) {
    persist(rows.map(r => {
      if (r.weekday !== d) return r;
      const next = { ...r, [which]: v };
      /* ⚠️ AN END BEFORE A START IS REFUSED IN THE DATABASE (`showing_window_order_ck`), so
         silently writing one would surface as an opaque save failure three screens later. Nudge
         the other end instead — the host meant to move the block, not to invert it. */
      if (next.ends_at <= next.starts_at) {
        if (which === "starts_at") {
          const [h, m] = v.split(":").map(Number);
          next.ends_at = `${String(Math.min(23, h + 2)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        } else {
          const [h, m] = v.split(":").map(Number);
          next.starts_at = `${String(Math.max(0, h - 2)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
      }
      return next;
    }));
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed opacity-70">
        {W(lang,
          "Set the times you are happy to show the place, and people can book one of those slots without asking you first.",
          "Defina las horas en que puede mostrar el inmueble, y la gente podrá reservar una de esas franjas sin preguntarle antes.")}
      </p>

      <label className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-1">
        <input type="checkbox" className="h-4 w-4" checked={enabled}
          onChange={e => onEnabledChange(e.target.checked)} />
        <span className="text-[13.5px] font-bold">
          {W(lang, "Let people book a viewing", "Permitir reservar visitas")}
        </span>
      </label>

      {enabled && (
        <>
          {/* ── THE NOTICE PERIOD, IN LEE'S OWN CHOICES ────────────────────────────────────
              *"Do you want six hours, twelve hours, twenty four hours, forty eight hours
              notice?"* Plus same-day, because a full-time agent showing four flats a day genuinely
              does not need warning and should not be forced to pretend otherwise. */}
          <div>
            <p className="mb-1 text-[12px] font-bold opacity-70">
              {W(lang, "How much notice do you need?", "¿Cuánto aviso necesita?")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NOTICE_CHOICES.map(h => (
                <button key={h} type="button" onClick={() => onNoticeChange(h)}
                  className={`ow-tap rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
                    notice === h ? "border-brand bg-brand text-white"
                                 : "border-ink/15 dark:border-white/15"}`}>
                  {noticeLabel(h, es)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed opacity-55">
              {notice === 0
                ? W(lang, "Somebody could book a viewing for later today.",
                          "Alguien podría reservar una visita para hoy mismo.")
                : W(lang, `The soonest anyone can book is ${notice} hours from now.`,
                          `Lo más pronto que alguien puede reservar es dentro de ${notice} horas.`)}
            </p>
          </div>

          <div>
            <p className="mb-1 text-[12px] font-bold opacity-70">
              {W(lang, "How long is one viewing?", "¿Cuánto dura una visita?")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[15, 30, 45, 60].map(m => (
                <button key={m} type="button" onClick={() => onSlotChange(m)}
                  className={`ow-tap rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
                    slotMinutes === m ? "border-brand bg-brand text-white"
                                      : "border-ink/15 dark:border-white/15"}`}>
                  {m} {W(lang, "min", "min")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[12px] font-bold opacity-70">
              {W(lang, "Which days, and when?", "¿Qué días, y a qué horas?")}
            </p>
            {!loaded ? (
              <div className="ow-shimmer h-20 rounded-xl" />
            ) : (
              <div className="space-y-1.5">
                {ORDER.map(d => {
                  const r = rowFor(d);
                  return (
                    <div key={d} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleDay(d)}
                        className={`ow-tap w-[104px] shrink-0 rounded-xl border px-2.5 py-2 text-left text-[12.5px] font-bold ${
                          r ? "border-brand bg-brand/[0.08]" : "border-ink/12 opacity-60 dark:border-white/12"}`}>
                        {(es ? DAYS_ES : DAYS_EN)[d]}
                      </button>
                      {r ? (
                        <div className="flex flex-1 items-center gap-1.5">
                          <input type="time" className="input h-10 w-full" value={hhmm(r.starts_at)}
                            onChange={e => setTime(d, "starts_at", e.target.value)} />
                          <span className="shrink-0 text-[12px] opacity-50">–</span>
                          <input type="time" className="input h-10 w-full" value={hhmm(r.ends_at)}
                            onChange={e => setTime(d, "ends_at", e.target.value)} />
                        </div>
                      ) : (
                        <span className="flex-1 text-[11.5px] opacity-40">
                          {W(lang, "Not showing", "Sin visitas")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!propertyId && (
              <p className="mt-1.5 text-[11px] leading-relaxed opacity-55">
                {W(lang, "Choosing the first day saves a private draft, so your viewing times are not lost.",
                         "Al elegir el primer día se guarda un borrador privado para no perder sus horarios de visita.")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
