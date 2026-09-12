import { fmtDateTimeShort } from "@job/lib/datetime";
import { useI18n, W } from "@job/lib/i18n";

/**
 * THE CONTRACT RECORD — the four moments that define this agreement, each stamped to the second.
 *
 * Lee, Jul 26 2026: "once they mark complete, that should be logged and time stamped on the contract,
 * probably at the bottom of the contract. It says okay, payer, this is their name, they marked the job
 * complete at this date and time and second... they both just kind of stamp it, and that marks on the
 * contract."
 *
 * Lee, Jul 31 2026: "we have a time stamp when the agreement is completed, where both people mark the
 * job completed. We also should have a time stamp [for] when the person sent the contract, and a
 * timestamp when the person accepted it. That's kind of like the initial part of it, and then completing
 * it is obviously the final part... that way you know when the actual contract was signed."
 *
 * So the block now runs the whole arc — sent → accepted → both sign-offs — instead of only the ending.
 * That ordering is the point: read top to bottom and you have the life of the agreement, and the gap
 * between "sent" and "accepted" is the window in which either side could still have walked away.
 *
 * This is the record on a financial agreement, so it is written like one:
 *
 *  - EVERY STAGE, ALWAYS SHOWN once the contract exists. An unreached stage renders as an explicit
 *    "not yet", because a list that skipped the empty ones would read as if the contract were further
 *    along than it is.
 *  - NAMES, NOT ROLES ALONE. "Lee Frazier (client)" is what someone reading this back in six months
 *    needs; "the client marked it complete" is not.
 *  - TO THE SECOND. Lee asked for the second and he's right to: these are the timestamps that started
 *    the accept clock and released the money, so they're the ones that would be quoted in a dispute.
 *    Rounding to the minute would throw away the precision that makes them evidence.
 *  - MISSING IS SAID OUT LOUD, NEVER GUESSED. `sent_at` only started being recorded on Jul 31 2026 and
 *    was backfilled only where it could be derived exactly. On older contracts the row says the time
 *    wasn't recorded rather than showing a plausible-looking approximation — an invented timestamp on
 *    a contract is worse than an absent one.
 */

type Party = {
  /** Display name. Falls back to the role word when a profile has no name yet. */
  name?: string | null;
  at?: string | null;
};

/** Exact local time including seconds — the precision a dispute would turn on. */
const stampTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", second: "2-digit" });
};
const stampDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Month-day-year, per house style.
  return d.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" });
};

/** How long the other side sat on it before accepting — the one derived number worth showing. */
const gap = (from: string, to: string, lang: string) => {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return W(lang, "under a minute later", "menos de un minuto después");
  if (mins < 60) return W(lang, `${mins} minute${mins === 1 ? "" : "s"} later`, `${mins} minuto${mins === 1 ? "" : "s"} después`);
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return W(lang, `${hrs} hour${hrs === 1 ? "" : "s"} later`, `${hrs} hora${hrs === 1 ? "" : "s"} después`);
  const days = Math.round(hrs / 24);
  return W(lang, `${days} day${days === 1 ? "" : "s"} later`, `${days} día${days === 1 ? "" : "s"} después`);
};

export default function CompletionStamps({
  payer,
  payee,
  sent,
  accepted,
  className = "",
}: {
  payer: Party;
  payee: Party;
  /** Who sent it and when. `at` null on contracts sent before this was tracked. */
  sent?: Party;
  /** Who accepted it and when. */
  accepted?: Party;
  className?: string;
}) {
  const { lang } = useI18n();
  const anything = !!(payer.at || payee.at || sent?.at || accepted?.at || sent?.name);
  // Nothing has happened yet → no block at all. An empty record panel on a job that hasn't
  // started would just be noise.
  if (!anything) return null;

  const both = !!payer.at && !!payee.at;
  // The LATER of the two sign-offs is the moment the contract actually closed.
  const closedAt = both
    ? (new Date(payer.at!).getTime() > new Date(payee.at!).getTime() ? payer.at! : payee.at!)
    : null;

  /**
   * One stamped line.
   *
   * `pending` is the wording when the moment hasn't happened yet; `unrecorded` is the different and
   * much more important case where it HAS happened but we don't hold the time. Collapsing those two
   * into one message would tell someone their accepted contract was never sent.
   */
  const row = (
    who: Party,
    opts: { label: string; fallbackName: string; did: string; pending: string; unrecorded?: string; reached?: boolean; note?: string },
  ) => {
    const reached = opts.reached ?? !!who.at;
    return (
      <div className="flex items-start gap-3 py-2.5">
        <span
          className={
            reached
              ? "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-deep text-[11px] font-bold text-white"
              : "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-dashed border-ink/20 text-[11px] opacity-40 dark:border-white/25"
          }
        >
          {reached ? "✓" : ""}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold">
            {who.name?.trim() || opts.fallbackName}
            <span className="ml-1.5 font-medium opacity-55">({opts.label})</span>
          </p>
          {who.at ? (
            <p className="mt-0.5 text-[11px] leading-snug opacity-70">
              {opts.did} <span className="font-semibold opacity-100">{stampDate(who.at)}</span>{" "}
              {W(lang, "at", "a las")} <span className="font-semibold opacity-100">{stampTime(who.at)}</span>
              {opts.note ? <span className="opacity-75"> · {opts.note}</span> : null}
            </p>
          ) : reached && opts.unrecorded ? (
            <p className="mt-0.5 text-[11px] leading-snug opacity-45">{opts.unrecorded}</p>
          ) : (
            <p className="mt-0.5 text-[11px] leading-snug opacity-45">{opts.pending}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className={`card p-4 ${className}`}>
      <h3 className="text-sm font-extrabold">{W(lang, "Contract record", "Registro del contrato")}</h3>
      <p className="mt-0.5 text-[11px] leading-snug opacity-55">
        {both
          ? W(lang, "Both sides confirmed this job was done. These stamps are what released the payment.",
                    "Ambas partes confirmaron que el trabajo se hizo. Estas marcas son las que liberaron el pago.")
          : W(lang, "Every step below is stamped when it actually happens. Payment is released once both sides have marked the job complete.",
                    "Cada paso de abajo queda marcado con la hora en que realmente ocurre. El pago se libera cuando ambas partes marcan el trabajo como completado.")}
      </p>

      <div className="mt-2 divide-y divide-ink/5 dark:divide-white/5">
        {sent &&
          row(sent, {
            label: W(lang, "sent", "enviado"),
            fallbackName: W(lang, "The sender", "Quien lo envió"),
            did: W(lang, "Sent this contract on", "Envió este contrato el"),
            pending: W(lang, "Not sent yet.", "Aún no se ha enviado."),
            // Reached — the contract demonstrably went out — but from before sent_at existed.
            reached: true,
            unrecorded: W(lang, "Sent before OneJob started recording send times, so the exact moment isn't on file.", "Se envió antes de que OneJob registrara las horas de envío, así que el momento exacto no está en el archivo."),
          })}
        {accepted &&
          row(accepted, {
            label: W(lang, "accepted", "aceptado"),
            fallbackName: W(lang, "The other party", "La otra parte"),
            did: W(lang, "Accepted this contract on", "Aceptó este contrato el"),
            pending: W(lang, "Hasn't accepted this contract yet.", "Todavía no ha aceptado este contrato."),
            note: sent?.at && accepted.at ? gap(sent.at, accepted.at, lang) : undefined,
          })}
        {row(payer, {
          label: W(lang, "client", "cliente"),
          fallbackName: W(lang, "The client", "El cliente"),
          did: W(lang, "Marked the job complete on", "Marcó el trabajo como completado el"),
          pending: W(lang, "Hasn't marked the job complete yet.", "Todavía no ha marcado el trabajo como completado."),
        })}
        {row(payee, {
          label: W(lang, "pro", "profesional"),
          fallbackName: W(lang, "The professional", "El profesional"),
          did: W(lang, "Marked the job complete on", "Marcó el trabajo como completado el"),
          pending: W(lang, "Hasn't marked the job complete yet.", "Todavía no ha marcado el trabajo como completado."),
        })}
      </div>

      {both && closedAt && (
        <p className="mt-3 rounded-xl bg-brand/[0.08] px-3 py-2.5 text-[11.5px] font-semibold leading-snug text-brand">
          {W(lang, `Contract completed ${fmtDateTimeShort(closedAt)} — when the second confirmation landed.`, `Contrato completado el ${fmtDateTimeShort(closedAt)} — cuando llegó la segunda confirmación.`)}
        </p>
      )}
    </section>
  );
}
