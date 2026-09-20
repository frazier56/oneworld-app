import { useParams } from "react-router-dom";
import { useI18n, useAsync, supabase, W, Avatar, ScreenHeading } from "@oneworld/shell";
import {
  incomeBands, employmentOptions, creditBands, labelOf,
  type IncomeBand, type Employment, type CreditBand,
} from "../lib/renter";

/**
 * WHAT THE AGENT SEES WHEN THEY SCAN THE CODE.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"a quick application with a QR code, so all my information would just
 * populate."*
 *
 * ── THE TOKEN IS THE AUTHORISATION ──────────────────────────────────────────────────────────
 * This screen is deliberately reachable WITHOUT signing in, because the moment somebody has to
 * create an account to read a code a renter handed them at a viewing, the code stops being used.
 * It reads through `renter_profile_by_token`, a SECURITY DEFINER function whose only key is the
 * token, and which returns bands and notes — never the token, never a row id, nothing replayable.
 *
 * The renter switches sharing off, or rolls the token, and every code already printed or pasted
 * dies at once. That is the property that makes a link-is-the-key design acceptable here: it is
 * revocable, and the screen says so on the renter's side of the app.
 *
 * ── WHY THERE IS NO SCORE, NO VERDICT, NO SORTING ───────────────────────────────────────────
 * It would be easy to compute "87% match" from an income band and a lease length. It would also be
 * a number nobody could check, attached to a person, on a platform whose product is credibility.
 * The screen states what the renter said and stops. The agent decides.
 */
export default function ApplicationView() {
  const { token } = useParams<{ token: string }>();
  const { lang } = useI18n();

  const p = useAsync(async () => {
    const { data, error } = await supabase.rpc("renter_profile_by_token", { p_token: token! });
    if (error) { console.error("[onerental] application read failed —", error.message); return null; }
    const row = Array.isArray(data) ? data[0] : data;
    return (row ?? null) as any;
  }, [token], !!token);

  const day = (d: string | null) => d
    ? new Date(d + "T00:00").toLocaleDateString(lang === "es" || lang === "co" ? "es" : "en",
        { year: "numeric", month: "long", day: "numeric" })
    : null;

  if (p === undefined) {
    return <div className="space-y-3 py-8" aria-busy="true">
      <div className="ow-shimmer h-24 rounded-2xl" /><div className="ow-shimmer h-40 rounded-2xl" />
    </div>;
  }

  /* A dead token and a revoked one are the same screen on purpose. Distinguishing them would tell
     a stranger holding an old code that the person is still on the platform. */
  if (!p) {
    return (
      <div className="py-16 text-center">
        <p className="text-[15px] font-bold">
          {W(lang, "This code isn't active.", "Este código no está activo.")}
        </p>
        <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed opacity-60">
          {W(lang,
            "It may have been turned off or replaced. Ask them to show you a current one.",
            "Puede que se haya desactivado o reemplazado. Pídale que le muestre uno vigente.")}
        </p>
      </div>
    );
  }

  const rows: [string, string | null][] = [
    [W(lang, "Moving in from", "Se muda desde"), day(p.move_in_from)],
    [W(lang, "Looking to stay", "Quiere quedarse"),
      p.lease_months ? `${p.lease_months} ${W(lang, "months", "meses")}` : null],
    [W(lang, "People", "Personas"), p.household_size ? String(p.household_size) : null],
    [W(lang, "Parking needed", "Parqueaderos"), p.parking_needed != null ? String(p.parking_needed) : null],
    [W(lang, "Pets", "Mascotas"),
      p.has_pets ? (p.pet_note || W(lang, "Yes", "Sí")) : W(lang, "None", "Ninguna")],
    [W(lang, "Monthly income", "Ingresos mensuales"), labelOf(incomeBands(lang), p.income_band as IncomeBand)],
    [W(lang, "Work", "Trabajo"), labelOf(employmentOptions(lang), p.employment as Employment)],
    [W(lang, "Credit", "Historial"), labelOf(creditBands(lang), p.credit_band as CreditBand)],
  ];

  return (
    <div className="space-y-4 pb-28">
      <ScreenHeading>{W(lang, "Rental application", "Solicitud de arriendo")}</ScreenHeading>

      <div className="flex items-center gap-3">
        <Avatar src={p.photo_url} name={p.full_name} size={54} rounded="rounded-full" textSize="text-lg" />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-black">{p.full_name ?? W(lang, "Member", "Miembro")}</p>
          <p className="text-[12px] opacity-55">
            {W(lang, "Shared with you by QR", "Compartido con usted por QR")}
          </p>
        </div>
      </div>

      {p.intro && (
        <div className="ow-form-sec">
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{p.intro}</p>
        </div>
      )}

      <div className="ow-form-sec">
        <h3 className="mb-2 text-[13px] font-black uppercase tracking-wide opacity-60">
          {W(lang, "The details", "Los detalles")}
        </h3>
        <dl className="divide-y divide-ink/[0.06] dark:divide-white/[0.08]">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-[12.5px] opacity-60">{k}</dt>
              <dd className="text-right text-[13px] font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── THE COLOMBIA-SPECIFIC PART, AND WHY IT IS ITS OWN PANEL ─────────────────────────
          Ley 820 de 2003 Art. 16 appears to prohibit cash security deposits on residential
          leases, so what a Colombian landlord actually asks for is a codeudor or a seguro de
          arrendamiento. A renter who already has one is a materially stronger applicant and had
          no way to say so — which is why it gets its own box rather than a row in the table. */}
      {(p.has_codeudor || p.has_rent_guarantee) && (
        <div className="rounded-2xl border border-[var(--teal-depth)]/35 bg-[var(--teal-depth)]/[0.07] p-4">
          <p className="text-[12.5px] font-black uppercase tracking-wide text-[var(--teal-depth)]">
            {W(lang, "Backed", "Respaldado")}
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px] font-semibold">
            {p.has_codeudor && (
              <li>✓ {W(lang, "Has a co-signer (codeudor) in Colombia", "Tiene codeudor en Colombia")}</li>
            )}
            {p.has_rent_guarantee && (
              <li>✓ {W(lang, "Can get a rent guarantee policy", "Puede obtener póliza de arrendamiento")}</li>
            )}
          </ul>
        </div>
      )}

      <p className="text-center text-[11px] leading-relaxed opacity-45">
        {W(lang,
          "Shared by the renter and shown as they entered it. OneHome does not verify income or credit, and does not score applicants.",
          "Compartido por el arrendatario y mostrado tal como lo ingresó. OneHome no verifica ingresos ni historial crediticio, y no califica a los solicitantes.")}
      </p>
    </div>
  );
}
