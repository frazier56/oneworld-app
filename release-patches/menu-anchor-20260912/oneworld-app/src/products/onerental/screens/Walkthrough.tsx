import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Avatar, useI18n, useOneId, useAsync, supabase, W, IconCheck, IconPlus, IconPhoto, ScreenHeading,
} from "@oneworld/shell";

/**
 * /rentals/c/:contractId/walkthrough — THE EVIDENCE. The thing Airbnb does not have.
 * ============================================================================================
 * Lee, 10 Aug 2026, reasoning it out loud, and the whole design is in what he said:
 *
 *   *"the property manager is not gonna like [the platform holding the money] because they're gonna immediately think,
 *   how we gonna get our money if they damage the place. So we're gonna always put a system in
 *   place to where you have to take pictures… both people need to agree to those photos… and
 *   that's gonna be your evidence. And if it's not in the pictures, it's not evidence. So you're
 *   not held accountable for nothing that's not in the pictures."*
 *
 * He also worked out the mechanics himself, and they are followed exactly:
 *
 *   · ONE side uploads, the OTHER signs off. He started at "both upload" and corrected himself:
 *     *"I would think one person can upload them, and then the other person needs to approve."*
 *     Either party may be the uploader, and either may add more at any time.
 *   · EVERY photo gets an answer. *"They probably need to toggle every picture and say yes or no
 *     to every picture."* A photo left unanswered is not agreement — the counter below says how
 *     many are still waiting, and sign-off is blocked until none are.
 *   · AN X NEEDS A REASON. *"If they say no to that picture… they can say, hey, what's wrong?
 *     They describe what's wrong. Like the ceiling fan broke."* Required by a database check
 *     constraint, not by placeholder text — a form hint is a suggestion.
 *   · A FAULT YOU CANNOT SEE NEEDS A CAPTION. *"Say the air conditioner is not blowing cold air,
 *     they need to take a picture of the air conditioner and then show, hey, air conditioner not
 *     blowing air."* That is what the caption field is, and why it sits under every photo.
 *   · IT GOES BACK AND FORTH. *"Until everyone agrees, you just keep uploading pictures."*
 *   · 48 HOURS. He moved from three days to two.
 *
 * ── The one thing deliberately NOT automatic ────────────────────────────────────────────────
 * The 48-hour window does NOT auto-agree anything when it expires. It is shown, and it is
 * chased. Auto-approving evidence against somebody who was asleep would earn this system exactly
 * the distrust it exists to remove — and the distrust is the product.
 */

type Photo = {
  id: string; report_id: string; uploaded_by: string; photo_url: string;
  caption: string | null; room: string | null;
  verdict: "pending" | "agreed" | "disputed";
  reviewed_by: string | null; reviewed_at: string | null; dispute_note: string | null;
  created_at: string;
};
type Report = {
  id: string; contract_id: string; kind: "move_in" | "move_out";
  status: "open" | "agreed" | "abandoned" | "lapsed";
  reopen_requested_by_agent_at: string | null;
  reopen_requested_by_tenant_at: string | null;
  reopen_count: number;
  /* Lee, 10 Aug 2026: the window runs from the MOVE-IN DATE, not from whenever somebody
     remembers to open the screen. All three of these are computed server-side by
     `open_rental_report` — a deadline the client sets is a deadline the client can move. */
  opens_on: string | null;
  window_closes_at: string;
  submit_by: string | null;
  tenant_review_submitted_at: string | null;
  agent_signed_off_at: string | null; tenant_signed_off_at: string | null; agreed_at: string | null;
};
type ReviewDraft = { photo_id: string; verdict: "agreed" | "disputed"; comment: string | null; submitted_at: string | null };
type CheckoutDispute = {
  id: string; status: "tenant_response_due" | "agreed" | "support_review" | "closed";
  summary: string; tenant_response: string | null; created_at: string;
};

export default function Walkthrough() {
  const { contractId = "" } = useParams();
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [kind, setKind] = useState<"move_in" | "move_out">("move_in");
  const [tick, setTick] = useState(0);          // re-read after every write
  const [err, setErr] = useState<string | null>(null);
  const [checkoutIssue, setCheckoutIssue] = useState("");
  const [tenantResponse, setTenantResponse] = useState("");

  const contract = useAsync(async () => {
    const { data } = await supabase.from("rental_contracts")
      .select("id, agent_id, tenant_id, property_id, starts_on, ends_on, deposit_amount, deposit_required, inspection_days, response_days, tenant_checked_in_at, tenant_checked_out_at, checkout_host_review_due_at, check_in_time, check_out_time")
      .eq("id", contractId).maybeSingle();
    return data as any;
  }, [contractId, tick]);

  const report = useAsync(async () => {
    if (!contract) return null;
    const { data } = await supabase.from("rental_condition_reports")
      .select("id, contract_id, kind, status, opens_on, window_closes_at, submit_by, " +
              "agent_signed_off_at, tenant_signed_off_at, agreed_at, tenant_review_submitted_at, " +
              "reopen_requested_by_agent_at, reopen_requested_by_tenant_at, reopen_count")
      .eq("contract_id", contractId).eq("kind", kind).maybeSingle();
    return (data as unknown as Report) ?? null;
  }, [contractId, kind, tick, contract?.id], !!contract);

  const photos = useAsync(async () => {
    if (!report) return [] as Photo[];
    const { data } = await supabase.from("rental_condition_photos")
      .select("id, report_id, uploaded_by, photo_url, caption, room, verdict, reviewed_by, reviewed_at, dispute_note, created_at")
      .eq("report_id", report.id).order("created_at", { ascending: true });
    return (data ?? []) as Photo[];
  }, [report?.id, tick], !!report);

  /* Signed URLs, minted per view and short-lived. A private object needs a signature to render,
     and signing the whole page's photos in one call keeps it to a single round trip. */
  const signed = useAsync(async () => {
    const paths = (photos ?? []).map(p => p.photo_url).filter(u => !/^https?:/.test(u));
    if (!paths.length) return {} as Record<string, string>;
    const { data } = await supabase.storage.from("rental-evidence").createSignedUrls(paths, 3600);
    return Object.fromEntries((data ?? []).filter(d => d.signedUrl).map(d => [String(d.path), d.signedUrl as string]));
  }, [photos?.length, tick], (photos ?? []).length > 0);

  const drafts = useAsync(async () => {
    if (!report || !userId) return [] as ReviewDraft[];
    const { data } = await supabase.from("rental_condition_review_drafts")
      .select("photo_id, verdict, comment, submitted_at")
      .eq("report_id", report.id).eq("reviewer_id", userId);
    return (data ?? []) as ReviewDraft[];
  }, [report?.id, userId, tick], !!report && !!userId);

  const checkoutDisputes = useAsync(async () => {
    if (!contract || kind !== "move_out") return [] as CheckoutDispute[];
    const { data } = await supabase.from("rental_checkout_disputes")
      .select("id, status, summary, tenant_response, created_at")
      .eq("contract_id", contractId).order("created_at", { ascending: false });
    return (data ?? []) as CheckoutDispute[];
  }, [contractId, contract?.id, kind, tick], !!contract && kind === "move_out");
  const draftByPhoto = useMemo(() => new Map((drafts ?? []).map(d => [d.photo_id, d])), [drafts]);

  const iAmAgent = !!userId && contract?.agent_id === userId;
  const iAmTenant = !!userId && contract?.tenant_id === userId;
  const frozen = !!report?.agreed_at;

  /* Photos I must answer: the other side's, still pending. This number is the whole screen. */
  const owedByMe = useMemo(
    () => (photos ?? []).filter(p => p.uploaded_by !== userId && p.verdict === "pending" && !draftByPhoto.has(p.id)).length,
    [photos, userId, draftByPhoto],
  );
  const disputed = useMemo(() => (photos ?? []).filter(p => p.verdict === "disputed").length, [photos]);
  const mySignOff = iAmAgent ? report?.agent_signed_off_at
    : (kind === "move_in" ? report?.tenant_review_submitted_at : report?.tenant_signed_off_at);
  const theirSignOff = iAmAgent ? report?.tenant_signed_off_at : report?.agent_signed_off_at;

  /* Opened through the RPC, never by a direct insert: the RPC is what reads the contract's
     `inspection_days` / `response_days` and stamps the three dates from the move-in date. An
     insert from here would create a report with no window at all. */
  async function open() {
    setErr(null);
    const { error } = await supabase.rpc("open_rental_report", {
      p_contract: contractId, p_kind: kind,
    });
    if (error) setErr(error.message);
    setTick(t => t + 1);
  }

  async function review(p: Photo, agreed: boolean, why?: string) {
    setErr(null);
    const { error } = await supabase.from("rental_condition_review_drafts").upsert({
      report_id: report!.id,
      photo_id: p.id,
      reviewer_id: userId,
      verdict: agreed ? "agreed" : "disputed",
      comment: agreed ? null : (why ?? "").trim(),
    }, { onConflict: "photo_id,reviewer_id" });
    if (error) setErr(error.message);
    setTick(t => t + 1);
  }

  /* RE-OPENING A LAPSED WINDOW — Lee, 10 Aug: *"it can open back up as long as both people
     agree to it… 48 hours if both people agree."* Two keys, and only once. A window one party
     could reopen alone would not be a deadline, and the deadline is the thing that stops a
     landlord photographing "damage" in month eleven. */
  async function askReopen() {
    setErr(null);
    const { data, error } = await supabase.rpc("request_rental_reopen", { p_report: report!.id });
    if (error) setErr(error.message);
    else if (data === "already_reopened") {
      setErr(W(lang,
        "This walkthrough has already been reopened once. Sort the rest out in Messages.",
        "Esta acta ya se reabrió una vez. Resuelvan el resto por Mensajes."));
    }
    setTick(t => t + 1);
  }

  async function signOff() {
    setErr(null);
    if (iAmTenant && kind === "move_in") {
      const { error } = await supabase.rpc("finalize_rental_condition_review", { p_report: report!.id });
      if (error) setErr(error.message);
      setTick(t => t + 1);
      return;
    }
    const col = iAmAgent ? "agent_signed_off_at" : "tenant_signed_off_at";
    const { error } = await supabase.from("rental_condition_reports")
      .update({ [col]: new Date().toISOString() }).eq("id", report!.id);
    if (error) setErr(error.message);
    setTick(t => t + 1);
  }

  async function checkIn() {
    setErr(null);
    const { error } = await supabase.rpc("check_in_rental", { p_contract: contractId });
    if (error) setErr(error.message);
    setTick(t => t + 1);
  }

  async function checkOut() {
    setErr(null);
    const { error } = await supabase.rpc("check_out_rental", { p_contract: contractId });
    if (error) setErr(error.message);
    setTick(t => t + 1);
  }

  async function openCheckoutIssue() {
    if (!report || checkoutIssue.trim().length < 10) return;
    setErr(null);
    const { error } = await supabase.rpc("open_checkout_dispute", {
      p_contract: contractId,
      p_report: report.id,
      p_summary: checkoutIssue.trim(),
      p_evidence_paths: [],
    });
    if (error) setErr(error.message);
    else setCheckoutIssue("");
    setTick(t => t + 1);
  }

  async function answerCheckoutIssue(disputeId: string, agree: boolean) {
    setErr(null);
    const { error } = await supabase.rpc("respond_checkout_dispute", {
      p_dispute: disputeId, p_agree: agree, p_response: tenantResponse.trim(),
    });
    if (error) setErr(error.message);
    else setTenantResponse("");
    setTick(t => t + 1);
  }

  if (contract === undefined) {
    return <div className="py-6"><div className="card ow-shimmer h-64" /></div>;
  }
  if (!contract || (!iAmAgent && !iAmTenant)) {
    return (
      <div className="py-12 text-center text-sm opacity-60">
        {W(lang, "This walkthrough belongs to a contract you are not part of.",
                 "Este acta pertenece a un contrato del que usted no hace parte.")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScreenHeading>
        {W(lang, "Condition of the property", "Estado del inmueble")}
      </ScreenHeading>
      <p className="mt-1 text-[12.5px] leading-relaxed opacity-65">
        {W(lang,
          "Photograph everything, and both of you agree the photos. If damage is not in these photos at move-in, it cannot be taken out of the deposit at move-out.",
          "Fotografíen todo y ambos aceptan las fotos. Si un daño no está en estas fotos a la entrada, no se puede descontar del depósito a la salida.")}
      </p>

      {/* Move-in / move-out. Same machinery, two moments. */}
      <div className="mt-3 flex gap-2">
        {(["move_in", "move_out"] as const).map(k => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-bold transition ${
              kind === k ? "border-transparent bg-ink text-paper dark:bg-white dark:text-ink"
                         : "border-ink/12 opacity-70 dark:border-white/15"}`}>
            {k === "move_in" ? W(lang, "Move-in", "Entrada") : W(lang, "Move-out", "Salida")}
          </button>
        ))}
      </div>

      {iAmTenant && kind === "move_in" && !contract.tenant_checked_in_at && (
        <div className="card mt-4 p-5 text-center">
          <h2 className="text-lg font-black">{W(lang, "Ready to enter?", "¿Listo para entrar?")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed opacity-60">{W(lang,
            "Check in when you physically arrive. We time-stamp it, then unlock the private move-in photos for your review.",
            "Registre su entrada cuando llegue físicamente. Guardamos la hora y luego desbloqueamos las fotos privadas para su revisión.")}</p>
          <button type="button" onClick={checkIn} className="btn-primary mt-4 w-full">{W(lang, "Check in", "Registrar entrada")}</button>
          {err && <p className="mt-3 text-sm font-bold text-red-600">{err}</p>}
        </div>
      )}

      {iAmTenant && kind === "move_out" && !contract.tenant_checked_out_at && (
        <div className="card mt-4 p-5 text-center">
          <h2 className="text-lg font-black">{W(lang, "Ready to leave?", "¿Listo para salir?")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed opacity-60">{W(lang,
            "Check out only after you have left the property. We time-stamp it and start the host's four-hour inspection window, which always ends before the next tenant checks in.",
            "Registre la salida solo después de dejar el inmueble. Guardamos la hora e iniciamos las cuatro horas de inspección del anfitrión, que siempre terminan antes de la llegada del siguiente inquilino.")}</p>
          <button type="button" onClick={checkOut} className="btn-primary mt-4 w-full">{W(lang, "Check out", "Registrar salida")}</button>
          {err && <p className="mt-3 text-sm font-bold text-red-600">{err}</p>}
        </div>
      )}

      {kind === "move_out" && contract.tenant_checked_out_at && (
        <CheckoutState lang={lang} iAmAgent={iAmAgent} iAmTenant={iAmTenant}
          dueAt={contract.checkout_host_review_due_at}
          disputes={checkoutDisputes ?? []}
          issue={checkoutIssue} setIssue={setCheckoutIssue} onOpen={openCheckoutIssue}
          response={tenantResponse} setResponse={setTenantResponse} onRespond={answerCheckoutIssue} />
      )}

      {(!iAmTenant || (kind === "move_in" ? !!contract.tenant_checked_in_at : !!contract.tenant_checked_out_at)) && (report === null ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-[13.5px] font-bold">
            {kind === "move_in"
              ? W(lang, "Not started yet.", "Aún no ha comenzado.")
              : W(lang, "The move-out record has not been opened.", "El acta de salida no se ha abierto.")}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed opacity-55">
            {W(lang,
              `The window runs from the move-in date and lasts ${contract?.inspection_days ?? 5} days. Photos go in first, then the other side has ${contract?.response_days ?? 2} days to answer each one.`,
              `El plazo corre desde la fecha de entrada y dura ${contract?.inspection_days ?? 5} días. Primero entran las fotos, y luego la otra parte tiene ${contract?.response_days ?? 2} días para responder cada una.`)}
          </p>
          <button type="button" className="btn-primary mt-4" onClick={open}>
            {W(lang, "Start the walkthrough", "Iniciar el acta")}
          </button>
        </div>
      ) : report === undefined ? (
        <div className="card ow-shimmer mt-4 h-48" />
      ) : (
        <>
          <StatusStrip lang={lang} report={report} owedByMe={owedByMe} disputed={disputed}
            total={(photos ?? []).length} frozen={frozen}
            iAmAgent={iAmAgent} onReopen={askReopen} />

          {!frozen && (
            <Uploader reportId={report.id} contractId={contractId} lang={lang}
              onDone={() => setTick(t => t + 1)} />
          )}

          <div className="mt-4 space-y-3">
            {(photos ?? []).length === 0 && (
              <p className="text-center text-[12.5px] opacity-50">
                {W(lang, "No photos yet. Whoever is standing in the property should start.",
                         "Aún no hay fotos. Quien esté en el inmueble debería empezar.")}
              </p>
            )}
            {(photos ?? []).map(p => (
              <PhotoRow key={p.id} p={p} lang={lang} mine={p.uploaded_by === userId}
                draft={draftByPhoto.get(p.id)}
                src={/^https?:/.test(p.photo_url) ? p.photo_url : (signed?.[p.photo_url] ?? undefined)}
                frozen={frozen} onReview={review} />
            ))}
          </div>

          {err && (
            <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-[12.5px] font-semibold text-red-600 dark:text-red-400">
              {err}
            </p>
          )}

          {/* ── SIGN-OFF ─────────────────────────────────────────────────────────────────── */}
          {!frozen && (
            <div className="card mt-5 p-4">
              <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
                {W(lang, "Sign off", "Dar por aceptado")}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed opacity-60">
                {owedByMe > 0
                  ? W(lang,
                      `Answer the ${owedByMe} photo${owedByMe === 1 ? "" : "s"} still waiting on you first. Leaving one unanswered is not agreement.`,
                      `Primero responda ${owedByMe === 1 ? "la foto que está" : `las ${owedByMe} fotos que están`} esperándole. Dejar una sin responder no es aceptar.`)
                  : W(lang,
                      "When you sign off you are agreeing this is how the property is right now. Once both of you sign off, these photos are locked and cannot be changed by anyone.",
                      "Al aceptar, usted confirma que así está el inmueble en este momento. Cuando ambos acepten, estas fotos quedan bloqueadas y nadie puede cambiarlas.")}
              </p>
              <button type="button" className="btn-primary mt-3 w-full"
                disabled={owedByMe > 0 || !!mySignOff || (photos ?? []).length === 0}
                onClick={signOff}>
                {mySignOff
                  ? W(lang, "You have signed off", "Usted ya aceptó")
                  : iAmTenant && kind === "move_in"
                    ? W(lang, "Finalize and submit", "Finalizar y enviar")
                    : W(lang, "I agree these photos are accurate", "Acepto que estas fotos son correctas")}
              </button>
              {mySignOff && !theirSignOff && (
                <p className="mt-2 text-center text-[11.5px] opacity-55">
                  {W(lang, "Waiting on the other party.", "Esperando a la otra parte.")}
                </p>
              )}
            </div>
          )}
        </>
      ))}
    </div>
  );
}

function CheckoutState({ lang, iAmAgent, iAmTenant, dueAt, disputes, issue, setIssue, onOpen, response, setResponse, onRespond }: {
  lang: string; iAmAgent: boolean; iAmTenant: boolean; dueAt: string | null;
  disputes: CheckoutDispute[]; issue: string; setIssue: (value: string) => void; onOpen: () => void;
  response: string; setResponse: (value: string) => void; onRespond: (id: string, agree: boolean) => void;
}) {
  const due = dueAt ? new Date(dueAt) : null;
  const windowOpen = !!due && Date.now() <= due.getTime();
  const pending = disputes.find(d => d.status === "tenant_response_due");
  return (
    <section className="card mt-4 space-y-3 p-4">
      <div>
        <h2 className="text-[14px] font-black">{W(lang, "Checkout recorded", "Salida registrada")}</h2>
        <p className="mt-1 text-[12px] leading-relaxed opacity-65">
          {windowOpen && due
            ? W(lang, `The host can document a checkout issue until ${due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
                      `El anfitrión puede documentar un problema hasta las ${due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`)
            : W(lang, "The host inspection window is closed. Any late claim must go through support.",
                      "El plazo de inspección cerró. Cualquier reclamo tardío debe pasar por soporte.")}
        </p>
      </div>

      {iAmAgent && windowOpen && !pending && (
        <div className="space-y-2 border-t border-ink/10 pt-3 dark:border-white/10">
          <label className="block text-[12px] font-bold">{W(lang, "Found a checkout problem?", "¿Encontró un problema?")}</label>
          <textarea className="input min-h-[76px] w-full" value={issue} onChange={e => setIssue(e.target.value)}
            placeholder={W(lang, "Describe the damage and reference the move-out photos.", "Describa el daño y haga referencia a las fotos de salida.")} />
          <button type="button" className="btn-primary w-full" disabled={issue.trim().length < 10} onClick={onOpen}>
            {W(lang, "Send documented issue", "Enviar problema documentado")}
          </button>
        </div>
      )}

      {pending && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] p-3">
          <p className="text-[12px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {W(lang, "Tenant response required", "Se requiere respuesta del inquilino")}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed">{pending.summary}</p>
          {iAmTenant && (
            <div className="mt-3 space-y-2">
              <textarea className="input min-h-[70px] w-full" value={response} onChange={e => setResponse(e.target.value)}
                placeholder={W(lang, "Add your final statement for the record.", "Agregue su declaración final para el registro.")} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-ghost" onClick={() => onRespond(pending.id, false)}>
                  {W(lang, "Disagree · support review", "No acepto · revisión")}
                </button>
                <button type="button" className="btn-primary" onClick={() => onRespond(pending.id, true)}>
                  {W(lang, "Agree and close", "Aceptar y cerrar")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!pending && disputes[0] && (
        <p className="rounded-xl bg-ink/[0.04] p-3 text-[12px] font-semibold dark:bg-white/[0.05]">
          {disputes[0].status === "support_review"
            ? W(lang, "This checkout issue is with support for review.", "Este problema está en revisión de soporte.")
            : W(lang, "The checkout issue is closed and preserved in the record.", "El problema de salida está cerrado y guardado en el registro.")}
        </p>
      )}
    </section>
  );
}

/* ── WHERE THIS STANDS, IN ONE STRIP ─────────────────────────────────────────────────────── */
function StatusStrip({ lang, report, owedByMe, disputed, total, frozen, iAmAgent, onReopen }: {
  lang: string; report: Report; owedByMe: number; disputed: number; total: number; frozen: boolean;
  iAmAgent: boolean; onReopen: () => void;
}) {
  const closes = new Date(report.window_closes_at);
  const hoursLeft = Math.max(0, Math.round((closes.getTime() - Date.now()) / 3_600_000));
  const submitBy = report.submit_by ? new Date(report.submit_by) : null;
  const pastSubmit = !!submitBy && Date.now() > submitBy.getTime();
  const lapsed = !frozen && Date.now() > closes.getTime();
  if (frozen) {
    return (
      <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/[0.07] p-4">
        <p className="flex items-center gap-2 text-[13.5px] font-bold text-brand">
          <IconCheck size={15} />
          {W(lang, "Agreed and locked", "Aceptada y bloqueada")}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed opacity-70">
          {W(lang,
            `Both of you agreed these ${total} photos. Nobody can add, edit or remove one now — including us. This is the evidence any deposit question is settled against.`,
            `Ambos aceptaron estas ${total} fotos. Nadie puede agregar, editar ni eliminar ninguna — nosotros tampoco. Esta es la prueba con la que se resuelve cualquier tema del depósito.`)}
        </p>
      </div>
    );
  }
  /* THE WINDOW LAPSED. Lee: *"otherwise, they passed their move-in inspection window… they
     can't be lingering around."* What that MEANS is stated here rather than left to be argued
     about later, and the two cases are genuinely different:
       · Photos submitted, never answered → the photos stand, and the silence is on the record.
       · Nothing submitted at all        → there is no record, so nothing can be deducted. */
  if (lapsed) {
    return (
      <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] p-4">
        <p className="text-[13.5px] font-bold text-amber-700 dark:text-amber-400">
          {W(lang, "The walkthrough window has closed", "El plazo del acta ya cerró")}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed opacity-75">
          {total === 0
            ? W(lang,
                "Nobody submitted photos in time, so there is no record of how the property was. With no record, nothing can be deducted from the deposit at the end.",
                "Nadie envió fotos a tiempo, así que no hay registro del estado del inmueble. Sin registro, no se puede descontar nada del depósito al final.")
            : W(lang,
                `The ${total} photos submitted stand as the record. Any that were never answered are recorded as unanswered.`,
                `Las ${total} fotos enviadas quedan como registro. Las que nunca se respondieron quedan registradas como sin responder.`)}
        </p>

        {/* THE SECOND CHANCE, AND IT TAKES TWO. */}
        {report.reopen_count < 1 && (() => {
          const mine  = iAmAgent ? report.reopen_requested_by_agent_at : report.reopen_requested_by_tenant_at;
          const their = iAmAgent ? report.reopen_requested_by_tenant_at : report.reopen_requested_by_agent_at;
          return (
            <div className="mt-3 border-t border-amber-500/30 pt-3">
              {mine ? (
                <p className="text-[12px] font-bold opacity-75">
                  {W(lang, "You have asked to reopen it — waiting for the other party to agree.",
                           "Usted pidió reabrirla — esperando que la otra parte acepte.")}
                </p>
              ) : (
                <>
                  <p className="text-[12px] leading-relaxed opacity-75">
                    {their
                      ? W(lang, "The other party has asked to reopen it for another 48 hours.",
                                "La otra parte pidió reabrirla por 48 horas más.")
                      : W(lang, "If you both agree, it can reopen once for another 48 hours.",
                                "Si ambos están de acuerdo, puede reabrirse una vez por 48 horas más.")}
                  </p>
                  <button type="button" className="btn-ghost mt-2 w-full" onClick={onReopen}>
                    {their
                      ? W(lang, "Agree — reopen for 48 hours", "Aceptar — reabrir por 48 horas")
                      : W(lang, "Ask to reopen it", "Pedir reabrirla")}
                  </button>
                </>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="card mt-4 space-y-1 p-3 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-bold">{W(lang, `${total} photos`, `${total} fotos`)}</span>
        {owedByMe > 0 && (
          <span className="font-bold text-brand">
            {W(lang, `${owedByMe} waiting on you`, `${owedByMe} esperándole`)}
          </span>
        )}
        {disputed > 0 && (
          <span className="opacity-70">
            {W(lang, `${disputed} marked as a problem`, `${disputed} marcadas como problema`)}
          </span>
        )}
      </div>
      {/* TWO deadlines, not one. The "send by" date is the honest half: a manager who uploads on
          the last afternoon has taken the tenant's answering time away from them, and the screen
          says so before that happens rather than after. */}
      {submitBy && (
        <p className={pastSubmit ? "font-bold text-amber-700 dark:text-amber-400" : "opacity-60"}>
          {pastSubmit
            ? W(lang, "Past the date for adding new photos — anything added now leaves the other side less time to answer.",
                      "Pasó la fecha para agregar fotos nuevas — lo que agregue ahora le deja menos tiempo a la otra parte.")
            : W(lang, `Add photos by ${submitBy.toISOString().slice(0, 10)}`,
                      `Agregue fotos antes del ${submitBy.toISOString().slice(0, 10)}`)}
        </p>
      )}
      <p className="opacity-55">
        {W(lang, `Window closes ${closes.toISOString().slice(0, 10)} · ${hoursLeft}h left`,
                 `El plazo cierra el ${closes.toISOString().slice(0, 10)} · quedan ${hoursLeft}h`)}
      </p>
    </div>
  );
}

/* ── ONE PHOTO ────────────────────────────────────────────────────────────────────────────── */
function PhotoRow({ p, draft, lang, mine, frozen, src, onReview }: {
  p: Photo; lang: string; mine: boolean; frozen: boolean; src?: string;
  draft?: ReviewDraft;
  onReview: (p: Photo, agreed: boolean, why?: string) => void;
}) {
  const [why, setWhy] = useState("");
  const [asking, setAsking] = useState(false);
  const verdict = draft?.verdict ?? p.verdict;

  return (
    <article className="card overflow-hidden p-0">
      {src
        ? <img src={src} alt={p.caption ?? ""} loading="lazy"
            className="max-h-72 w-full bg-ink/5 object-cover dark:bg-white/5" />
        : <div className="ow-shimmer h-56 w-full bg-ink/5 dark:bg-white/5" />}
      <div className="space-y-2 p-3">
        {(p.room || p.caption) && (
          <p className="text-[13.5px] leading-snug">
            {p.room && <span className="font-bold">{p.room}: </span>}
            {p.caption}
          </p>
        )}

        {verdict === "agreed" && (
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand">
            <IconCheck size={13} />{draft && !draft.submitted_at
              ? W(lang, "Saved in your draft", "Guardada en su borrador")
              : W(lang, "Both agree this is accurate", "Ambos aceptan que es correcta")}
          </p>
        )}

        {verdict === "disputed" && (
          <div className="rounded-xl bg-amber-500/10 p-2.5">
            <p className="text-[12px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {W(lang, "Marked as a problem", "Marcada como problema")}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug">{draft?.comment ?? p.dispute_note}</p>
            {draft && !draft.submitted_at && <p className="mt-1 text-[11px] font-bold opacity-60">{W(lang, "Private draft · not sent yet", "Borrador privado · aún no enviado")}</p>}
          </div>
        )}

        {/* Only the OTHER party answers, and only while the bundle is open. The database
            refuses self-approval outright — this is just the screen agreeing with it. */}
        {verdict === "pending" && !mine && !frozen && (
          asking ? (
            <div className="space-y-2">
              <textarea className="input min-h-[70px] w-full" value={why} autoFocus
                onChange={e => setWhy(e.target.value)}
                placeholder={W(lang,
                  "What is wrong? e.g. the ceiling fan is broken",
                  "¿Qué está mal? p. ej. el ventilador de techo está dañado")} />
              <div className="flex gap-2">
                <button type="button" className="btn-ghost flex-1" onClick={() => { setAsking(false); setWhy(""); }}>
                  {W(lang, "Cancel", "Cancelar")}
                </button>
                <button type="button" className="btn-primary flex-1" disabled={why.trim().length < 3}
                  onClick={() => onReview(p, false, why)}>
                  {W(lang, "Send", "Enviar")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setAsking(true)}
                className="ow-tap flex-1 rounded-xl border border-ink/15 py-2 text-[13px] font-bold dark:border-white/20">
                ✕ {W(lang, "Something is wrong", "Algo está mal")}
              </button>
              <button type="button" onClick={() => onReview(p, true)}
                className="ow-tap flex-1 rounded-xl bg-brand py-2 text-[13px] font-bold text-white">
                ✓ {W(lang, "Looks right", "Se ve bien")}
              </button>
            </div>
          )
        )}

        {verdict === "pending" && mine && (
          <p className="text-[12px] opacity-55">
            {W(lang, "Waiting for the other party to answer this one.",
                     "Esperando que la otra parte responda esta.")}
          </p>
        )}
      </div>
    </article>
  );
}

/* ── ADD PHOTOS ───────────────────────────────────────────────────────────────────────────── */
function Uploader({ reportId, contractId, lang, onDone }: {
  reportId: string; contractId: string; lang: string; onDone: () => void;
}) {
  const { userId } = useOneId();
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const [room, setRoom] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files || !userId) return;
    setBusy(true); setErr(null);
    for (const f of Array.from(files)) {
      /* PRIVATE BUCKET, and the path shape is load-bearing: `{contract}/{uploader}/{file}`.
         The first folder is what the storage policy reads to decide who may LOOK at this photo
         — the two parties to that contract and nobody else. The second is what stops one party
         writing into the other's folder. These are photographs of the inside of somebody's
         home; they were in a world-readable bucket until the launch audit caught it. */
      const path = `${contractId}/${userId}/${reportId}-${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("rental-evidence").upload(path, f);
      if (error) { setErr(error.message); break; }
      const url = path;   // stored as a PATH; the screen signs it on read
      const { error: iErr } = await supabase.from("rental_condition_photos").insert({
        report_id: reportId, uploaded_by: userId, photo_url: url,
        caption: caption.trim() || null, room: room.trim() || null,
      });
      if (iErr) { setErr(iErr.message); break; }
    }
    setCaption(""); setBusy(false); onDone();
  }

  return (
    <section className="card mt-4 space-y-2 p-4">
      <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
        {W(lang, "Add photos", "Agregar fotos")}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <input className="input w-full" value={room} onChange={e => setRoom(e.target.value)}
          placeholder={W(lang, "Room", "Espacio")} />
        <input className="input w-full" value={caption} onChange={e => setCaption(e.target.value)}
          placeholder={W(lang, "What it shows", "Qué muestra")} />
      </div>
      {/* Lee's air-conditioner case, said out loud on the screen where it applies. */}
      <p className="text-[11px] leading-relaxed opacity-55">
        {W(lang,
          "If the problem cannot be seen — the air conditioner is not blowing cold air — photograph it anyway and say so here. A caption is what turns a photo into evidence.",
          "Si el problema no se ve — el aire acondicionado no enfría — tome la foto igual y dígalo aquí. La descripción es lo que convierte una foto en prueba.")}
      </p>
      <label className="ow-tap flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink/25 py-3 text-[13px] font-bold dark:border-white/25">
        <input type="file" accept="image/*" multiple capture="environment" className="hidden"
          disabled={busy} onChange={e => add(e.target.files)} />
        {busy ? "…" : <><IconPlus size={15} /><IconPhoto size={15} />{W(lang, "Take or choose photos", "Tomar o elegir fotos")}</>}
      </label>
      {err && <p className="text-[12px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
    </section>
  );
}
