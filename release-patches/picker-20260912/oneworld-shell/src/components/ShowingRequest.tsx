import { useEffect, useMemo, useState } from "react";
import { useI18n, W } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { supabase } from "../lib/supabase";
import { slotsFor, slotsByDay, type ShowingWindow, type Slot } from "../lib/showings";

/**
 * REQUEST A SHOWING — the sheet behind the button that has been disabled since it was drawn.
 * ============================================================================================
 * Lee, 15 August 2026: *"they can click schedule a showing… and then still send a message. And
 * ultimately we'll have the calendar integrated."*
 *
 * ── WHY IT IS A SHEET AND NOT A SCREEN ──────────────────────────────────────────────────────
 * Somebody asking to view a flat has not left the listing — they are still deciding. Taking them
 * to another route means a back button, a re-fetch, and a decision about where "back" goes when
 * they finish. A sheet keeps the listing behind it, which is also the thing they will want to
 * glance at while picking a time.
 *
 * ── AND WHY THE SLOT LIST IS NOT COMPUTED HERE ──────────────────────────────────────────────
 * `lib/showings.ts` owns all three rules — inside a window, past the notice period, not already
 * taken. A screen that re-derived any of them would eventually disagree with the server, and the
 * failure mode is somebody standing outside a stranger's door at a time the host never agreed to.
 */
export default function ShowingRequest({
  propertyId, hostId, notice, slotMinutes, onClose, onBooked, onMessage,
}: {
  propertyId: string;
  hostId: string;
  /** Hours of warning the host asked for. */
  notice: number;
  slotMinutes: number;
  onClose: () => void;
  onBooked?: () => void;
  /** "Send a message instead" — Lee: *"and then still still can send a message."* */
  onMessage?: () => void;
}) {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const es = lang === "es" || lang === "co";

  const [windows, setWindows] = useState<ShowingWindow[] | null>(null);
  const [taken, setTaken] = useState<{ starts_at: string; ends_at: string }[]>([]);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function load() {
    const [w, t] = await Promise.all([
      supabase.from("showing_windows").select("weekday, starts_at, ends_at").eq("property_id", propertyId),
      /* Only future showings matter, and only ones that still hold their slot. A cancelled
         viewing must release the time or the calendar silently shrinks over months. */
      supabase.from("property_showings").select("starts_at, ends_at")
        .eq("property_id", propertyId).in("state", ["requested", "confirmed"])
        .gte("starts_at", new Date().toISOString()),
    ]);
    setWindows(w.data ?? []);
    setTaken(t.data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [propertyId]);

  const days = useMemo(() => {
    if (!windows) return [];
    return slotsByDay(slotsFor({ windows, taken, slotMinutes, noticeHours: notice }));
  }, [windows, taken, slotMinutes, notice]);

  async function submit() {
    if (!chosen || !userId) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from("property_showings").insert({
      property_id: propertyId, guest_id: userId, host_id: hostId,
      starts_at: chosen.startIso, ends_at: chosen.endIso,
      guest_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      /* ⚠️ 23P01 IS NOT AN ERROR, IT IS A RACE. Two people tapped the same slot; the exclusion
         constraint on `property_showings` let the first one through. Say so in words the guest
         can act on, and re-draw so the slot disappears in front of them. */
      if (error.code === "23P01") {
        setErr(W(lang, "Somebody just took that time. Here are the times still free.",
                       "Alguien acaba de tomar esa hora. Estas son las que siguen libres."));
        setChosen(null); load();
      } else {
        setErr(error.message);
      }
      return;
    }
    setDone(true); onBooked?.();
  }

  const fmtDay = (d: Date) => d.toLocaleDateString(es ? "es" : "en",
    { weekday: "long", day: "numeric", month: "long" });
  const fmtTime = (d: Date) => d.toLocaleTimeString(es ? "es" : "en",
    { hour: "numeric", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      {/* ⚠️ THIS WAS `bg-surface`, AND THAT CLASS DOES NOT EXIST — THE SECOND TIME IN THREE DAYS.
          15 Aug 2026. `bg-surface` is in neither the Tailwind preset nor `tokens.css`. Tailwind
          emits nothing at all for an unknown utility and warns about nothing, so this sheet has
          been shipping with NO BACKGROUND since v51 — the guest's slot list drawn straight on top
          of the listing photographs behind it. Lee photographed the identical failure on the
          currency dropdown in v52; I wrote the same class again two files later.

          The real class is `ow-sheet`, which carries the opaque surface, the frosted edge and the
          shadow together. Written down properly this time: **a class name that appears in neither
          tokens.css nor the preset is a typo, not a colour** — and the cheap way to catch it is to
          grep the two files before shipping a surface, which takes about four seconds. */}
      <div className="ow-sheet relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-black tracking-tight">
            {W(lang, "Request a showing", "Solicitar una visita")}
          </h2>
          <button onClick={onClose} className="ow-tap -m-1 p-1 text-[20px] leading-none opacity-50"
            aria-label={W(lang, "Close", "Cerrar")}>×</button>
        </div>

        {done ? (
          /* Confirmed state says what happens NEXT, not just that something happened. "Requested"
             with no follow-up is how a guest ends up refreshing the page all evening. */
          <div className="py-4 text-center">
            <p className="text-[15px] font-bold">{W(lang, "Asked for", "Solicitada")}</p>
            {chosen && (
              <p className="mt-1 text-[13.5px] opacity-75">
                {fmtDay(chosen.start)} · {fmtTime(chosen.start)}
              </p>
            )}
            <p className="mx-auto mt-3 max-w-[34ch] text-[12.5px] leading-relaxed opacity-70">
              {W(lang,
                "The host has to confirm before it is set. You will see it in your messages either way, and nobody else can take that time while they decide.",
                "El anfitrión debe confirmarla para que quede en firme. La verá en sus mensajes de cualquier modo, y nadie más puede tomar esa hora mientras decide.")}
            </p>
            <button onClick={onClose} className="btn-primary mt-4 w-full">{W(lang, "Done", "Listo")}</button>
          </div>
        ) : windows === null ? (
          <div className="ow-shimmer h-24 rounded-xl" />
        ) : days.length === 0 ? (
          /* ── NOTHING FREE IS NOT AN ERROR, AND IT MUST NOT BE A DEAD END ─────────────────
             Either the host offers no windows, or the notice period has eaten the near ones.
             Both are ordinary. The message says which, and always offers the message route —
             Lee: *"they click schedule a showing… and then still can send a message."* */
          <div className="py-2">
            <p className="text-[13.5px] leading-relaxed opacity-75">
              {W(lang,
                "No viewing times are open for this place at the moment. You can message the host and ask — most will make time.",
                "No hay horarios de visita abiertos para este inmueble en este momento. Puede escribirle al anfitrión y preguntar — la mayoría hace espacio.")}
            </p>
            {onMessage && (
              <button onClick={() => { onClose(); onMessage(); }} className="btn-primary mt-4 w-full">
                {W(lang, "Message the host", "Escribir al anfitrión")}
              </button>
            )}
          </div>
        ) : (
          <>
            {notice > 0 && (
              <p className="mb-2.5 text-[11.5px] leading-relaxed opacity-60">
                {W(lang, `This host asks for ${notice} hours' notice, so the earliest times are already excluded.`,
                         `Este anfitrión pide ${notice} horas de aviso, así que las horas más próximas ya están excluidas.`)}
              </p>
            )}

            <div className="space-y-3">
              {days.map(({ day, slots }) => (
                <div key={day.toISOString()}>
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide opacity-45">{fmtDay(day)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map(s => (
                      <button key={s.startIso} type="button" onClick={() => setChosen(s)}
                        className={`ow-tap rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
                          chosen?.startIso === s.startIso
                            ? "border-brand bg-brand text-white"
                            : "border-ink/15 hover:border-ink/35 dark:border-white/15 dark:hover:border-white/35"}`}>
                        {fmtTime(s.start)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] font-bold opacity-70">
                {W(lang, "Anything to add? (optional)", "¿Algo que agregar? (opcional)")}
              </span>
              <textarea className="input min-h-[64px] w-full" value={note} maxLength={400}
                onChange={e => setNote(e.target.value)}
                placeholder={W(lang, "I am coming with my partner.", "Voy con mi pareja.")} />
            </label>

            {err && <p className="mt-2 text-[12.5px] font-semibold text-red-500">{err}</p>}

            <button onClick={submit} disabled={!chosen || busy || !userId}
              className="btn-primary mt-3 w-full disabled:opacity-45">
              {busy ? W(lang, "Asking…", "Solicitando…")
                    : chosen ? `${W(lang, "Ask for", "Solicitar")} ${fmtTime(chosen.start)}`
                             : W(lang, "Pick a time", "Elija una hora")}
            </button>

            {onMessage && (
              <button onClick={() => { onClose(); onMessage(); }}
                className="ow-tap mt-2 w-full py-2 text-[12.5px] font-semibold opacity-65">
                {W(lang, "Or just send a message", "O simplemente envíe un mensaje")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
