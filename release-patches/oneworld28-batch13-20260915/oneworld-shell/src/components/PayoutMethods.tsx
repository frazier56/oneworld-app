import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useI18n, W } from "../lib/i18n";
import { usePayoutStatus } from "../lib/usePayoutStatus";
import { isPayLinkRail, normalizePayHandle, payLinkLabel, type PayLinkRail } from "../lib/payLinks";

/* The account that is signed in RIGHT NOW — asked at the moment a mutation completes, never
   assumed from a prop captured when the button was pressed (Max, Batch 2 v2 finding 2). */
async function currentActor(): Promise<string | null> {
  try { const { data: { session } } = await supabase.auth.getSession(); return session?.user?.id ?? null; } catch { return null; }
}

/**
 * PAYOUT METHODS — where money reaches a person. ONE surface, shell-owned, every product mounts it.
 * ============================================================================================
 * Lee's Taycan rule (11 Sep 2026): banking and payout identity belong to One ID and follow the
 * person across every app. OneJob's Wallet already stored PayPal / Wise pay links in the shared
 * `payment_methods` table and Stripe Connect readiness in `stripe_connect_accounts`; OneHome was
 * about to grow a second copy (a four-option dropdown and a "my account is ready" checkbox that
 * proved nothing). Max struck that on 11 Sep. This component is the shared surface instead: a
 * product passes its own name and return route; the data, the rules and the words about what a
 * destination IS are the same everywhere.
 *
 * WHAT COUNTS, AND WHAT THE LABELS PROMISE
 *   · Bank account (Stripe Connect underneath) — ready ONLY when the processor itself reports
 *     `payouts_enabled`. "Charges enabled" is a different capability (taking card payments) and
 *     never counts here. ⚠️ THE WORD "STRIPE" NEVER APPEARS ON SCREEN (Lee, 14 Sep 2026: *"No
 *     one knows Stripe"*). It is our processor, which is our business, not the member's; what
 *     they are looking at is "your bank account". The stored VALUES keep the name — the method
 *     key `stripe` and the table `stripe_connect_accounts` — because renaming data to fix words
 *     is how a migration gets written for no reason.
 *   · PayPal / Wise pay link — "On file". Nobody has verified it; the person typed it, the parser
 *     checked its shape, the database's CHECK constraint agrees. Money still moves person to
 *     person and the RECIPIENT confirms it arrived. The word "verified" is never used.
 *   · Remitly, bank transfer, cash — NOT destinations on file. Remitly has no pay-me link and a
 *     bank account number is raw banking data this platform does not store. Those rails stay
 *     honest "paid outside the platform" rails handled in the product's own flow.
 *
 * PRIVACY: a pay link never appears on a public profile or listing. Products disclose it only
 * through a participant-scoped server resolver (OneJob: the `resolve-pay-link` edge function;
 * OneHome: `rental_request_payment_instructions`), and only to the one person with a real agreement.
 */
export type PayoutMethodRow = {
  id: string;
  provider: string;
  method_type: string;
  handle: string | null;
  alias: string | null;
  is_primary: boolean;
  created_at: string;
};

export type PayoutMethodsProps = {
  /** The person whose destinations these are. The component renders nothing without one. */
  userId: string | null;
  /** The product's own name for the "money never comes to …" sentence — "OneHome", "OneJob". */
  productLabel: string;
  /** Where Stripe should send the person back after onboarding, e.g. `/rentals/host-profile`. */
  stripeReturnPath: string;
  /** Called after any change so a parent can re-run its readiness query. */
  onChanged?: () => void;
  /** Which manual rails to offer. Default: both. */
  rails?: readonly PayLinkRail[];
  /** Compact = one card, no explanatory paragraphs (for a request-review sidebar). */
  compact?: boolean;
  /**
   * The product's OWN sentence about its fee on money paid through a link — supplied by the
   * product, never assumed by the shell, because fee policy does not roam with a name:
   * OneHome charges nothing on rent paid outside the contract (Lee, 30 Aug 2026); OneJob's
   * pay-direct methods carry no OneJob fee. Omit it and the sheet says nothing about fees.
   */
  feeNote?: { en: string; es: string };
};

export default function PayoutMethods({
  userId, productLabel, stripeReturnPath, onChanged, rails = ["wise", "paypal"], compact = false, feeNote,
}: PayoutMethodsProps) {
  const { lang } = useI18n();
  const stripe = usePayoutStatus();
  /* The Stripe summary counts only when the hook's answer was produced FOR this account and is
     not mid-refresh; a switch from A to B shows "Checking…" until B's own answer lands (finding 2:
     "bind the Stripe summary to its producing user while refresh is pending"). */
  const stripeBound = !stripe.loading && stripe.user_id === userId;
  const payoutsEnabled = stripeBound && stripe.payouts_enabled;
  /* Rows are KEYED BY THE ACCOUNT they were loaded for (Max's Batch 2 review, finding 2). A slow
     answer for account A must never land on account B, and a userId change clears the list before
     the new one arrives. `loadFailed` keeps a failed load distinct from an empty Vault. */
  const [rows, setRows] = useState<{ forUser: string; list: PayoutMethodRow[] } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [adding, setAdding] = useState<PayLinkRail | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setRows(null); setLoadFailed(false);
    if (!userId) return;
    try {
      /* Named columns, own rows only (RLS `pm_select_own`). `token` and `stripe_customer_id` are
         deliberately NOT selected — a payout summary never carries a provider secret. */
      const { data, error } = await supabase.from("payment_methods")
        .select("id, provider, method_type, handle, alias, is_primary, created_at")
        .eq("user_id", userId).order("created_at", { ascending: true });
      if (mine !== seq.current) return;                      // superseded by a newer load or an account change
      if (error) throw error;
      setRows({ forUser: userId, list: (data ?? []) as PayoutMethodRow[] });
    } catch (e: any) {
      if (mine !== seq.current) return;
      setLoadFailed(true); setRows({ forUser: userId, list: [] });
      setErr(W(lang, "Could not load your payout details. Pull to refresh or try again.", "No se pudieron cargar sus datos de pago. Actualice o inténtelo de nuevo."));
    }
  }, [userId, lang]);

  useEffect(() => { void load(); }, [load]);
  /* An identity change closes the editor and drops every account-bound message: nothing typed
     for A may still be on screen when B is signed in. (The sheet is ALSO keyed by userId below,
     so a switch remounts it even if this effect and the key ever disagree.) */
  useEffect(() => { setAdding(null); setErr(""); setBusy(false); }, [userId]);

  /* Never render another account's rows: the list counts only when it was loaded for THIS userId. */
  const links = (rows && rows.forUser === userId ? rows.list : []).filter(r => isPayLinkRail(r.method_type) && !!r.handle);
  const loading = !!userId && rows === null;

  async function remove(row: PayoutMethodRow) {
    if (!userId) return;
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.from("payment_methods").delete().eq("id", row.id).eq("user_id", userId);
      if (error) throw error;
      if ((await currentActor()) !== userId) return;          // the account changed mid-flight: nothing of A's is reloaded into B's screen
      await load(); onChanged?.();
    } catch {
      /* Returned OR thrown: same sentence, and the row stays on screen until a reload proves otherwise. */
      setErr(W(lang, "Could not remove that link just now. Try again.", "No se pudo quitar ese enlace ahora. Inténtelo de nuevo."));
    } finally { setBusy(false); }
  }

  async function connectStripe() {
    setBusy(true); setErr("");
    try {
      const url = await stripe.startOnboarding(stripeReturnPath);
      if (url) window.location.assign(url);
      else setErr(W(lang, "Could not open secure payout setup. Try again.", "No se pudo abrir la configuración segura de pagos. Inténtelo de nuevo."));
    } catch (e: any) {
      setErr(e?.message || W(lang, "Could not open secure payout setup.", "No se pudo abrir la configuración segura de pagos."));
    } finally { setBusy(false); }
  }

  if (!userId) return null;

  return (
    <div className="space-y-3" data-testid="payout-methods" data-for-user={userId}>
      {/* ── STRIPE ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-xl border border-ink/10 p-3 dark:border-white/12">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${
          payoutsEnabled ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-ink/6 text-ink/60 dark:bg-white/10 dark:text-white/70"}`} aria-hidden>
          {payoutsEnabled ? "✓" : "B"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-black">{W(lang, "Your bank account", "Su cuenta bancaria")}</p>
          <p className="text-[11.5px] leading-relaxed opacity-60" data-stripe-for={stripeBound ? stripe.user_id ?? "" : ""}>
            {!stripeBound ? W(lang, "Checking…", "Verificando…")
              : stripe.error ? W(lang, "Could not check your bank account just now.", "No se pudo consultar su cuenta bancaria ahora.")
              : stripe.payouts_enabled
                ? `${W(lang, "Ready to receive payments", "Lista para recibir pagos")}${stripe.bank_last4 ? ` · •••• ${stripe.bank_last4}` : ""}`
                : stripe.has_account
                  ? W(lang, "Set-up is not finished — this account cannot receive payments yet.", "La configuración está incompleta — esta cuenta aún no puede recibir pagos.")
                  : W(lang, "Not connected.", "No conectada.")}
          </p>
        </div>
        {!payoutsEnabled && (
          <button type="button" className="btn-primary shrink-0 px-3 py-2 text-[12px]" disabled={busy || !stripeBound} onClick={() => void connectStripe()}>
            {stripe.has_account ? W(lang, "Finish", "Terminar") : W(lang, "Connect", "Conectar")}
          </button>
        )}
      </div>

      {/* ── PAY LINKS ON FILE ─────────────────────────────────────────────────────────── */}
      {loading && <p className="text-[11.5px] opacity-60" role="status">{W(lang, "Loading your payout details…", "Cargando sus datos de pago…")}</p>}
      {links.map(row => {
        const rail = row.method_type as PayLinkRail;
        return (
          <div key={row.id} className="flex items-center gap-3 rounded-xl border border-ink/10 p-3 dark:border-white/12">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-black text-brand" aria-hidden>{rail === "paypal" ? "P" : "W"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-black">{payLinkLabel(rail)} · <span className="font-semibold opacity-70">{W(lang, "On file", "Registrado")}</span></p>
              <p className="truncate text-[11.5px] opacity-60">{row.handle}</p>
            </div>
            <button type="button" className="btn-ghost shrink-0 px-3 py-2 text-[12px]" disabled={busy} onClick={() => void remove(row)}>
              {W(lang, "Remove", "Quitar")}
            </button>
          </div>
        );
      })}

      {/* ── ADD A LINK ────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {rails.filter(r => !links.some(l => l.method_type === r)).map(rail => (
          <button key={rail} type="button" className="btn-ghost px-3 py-2 text-[12px]" disabled={busy || loading || loadFailed} data-add-rail={rail} onClick={() => setAdding(rail)}>
            + {W(lang, `Add ${payLinkLabel(rail)} link`, `Agregar enlace de ${payLinkLabel(rail)}`)}
          </button>
        ))}
      </div>

      {!compact && (
        <p className="text-[11.5px] leading-relaxed opacity-60">
          {W(lang,
            `Our payment partner checks your bank account and holds the numbers — ${productLabel} never sees them. A PayPal or Wise link is only "on file": the other person pays you there and the money never passes through ${productLabel}. Remitly, bank transfer and cash are never stored here.`,
            `Nuestro aliado de pagos verifica su cuenta bancaria y guarda los números — ${productLabel} nunca los ve. Un enlace de PayPal o Wise solo queda "registrado": la otra persona le paga allí y el dinero nunca pasa por ${productLabel}. Remitly, transferencia y efectivo nunca se guardan aquí.`)}
        </p>
      )}

      {err && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-[12.5px] font-bold text-red-600 dark:text-red-300">{err}</p>}

      {adding && (
        <PayLinkSheet key={`${userId}:${adding}`} rail={adding} userId={userId} productLabel={productLabel} feeNote={feeNote}
          onClose={() => setAdding(null)}
          onSaved={async () => { setAdding(null); if ((await currentActor()) !== userId) return; await load(); onChanged?.(); }} />
      )}
    </div>
  );
}

/**
 * Adding a PayPal or Wise link. Moved from OneJob's Wallet (`AddManualSheet`) with the product
 * name made a parameter — the words are the same because the rule is the same: the platform never
 * touches this money, cannot protect it, takes no fee on it, and only the recipient can say it
 * arrived.
 */
export function PayLinkSheet({ rail, userId, productLabel, feeNote, onClose, onSaved }: {
  rail: PayLinkRail; userId: string; productLabel: string; feeNote?: { en: string; es: string }; onClose: () => void; onSaved: () => void;
}) {
  const { lang } = useI18n();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /* the database cannot take a pay link safely right now (no unique key): the sheet says so and
     offers nothing that writes (Max 2V3-3) */
  const [unavailable, setUnavailable] = useState(false);
  const name = payLinkLabel(rail);
  const preview = normalizePayHandle(value, rail);
  const inputRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  /* KEYBOARD (Max, finding 6): the dialog takes focus when it opens, Escape closes it, and focus
     goes back to the control that opened it — a sighted mouse user never notices; a keyboard or
     screen-reader user is otherwise left on a page with an invisible open dialog. */
  useEffect(() => {
    alive.current = true;
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => { alive.current = false; document.removeEventListener("keydown", onKey); if (opener && document.contains(opener)) opener.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* SAVE, with the two failure shapes a network gives you (Max's Batch 2 review, finding 3):
       · a RETURNED error → the sheet stays open with the typed value, one sentence, retry
       · a THROWN error (transport lost mid-flight) → the insert may or may not have committed. The
         write is therefore an UPSERT against the shared UNIQUE (user_id, method_type, handle)
         (payment_methods_user_rail_handle_key, added by OneHome 27's 20260911120000 migration) with
         duplicates ignored: a retry after an unresolved earlier commit, or two overlapping retries,
         can only ever leave ONE row. There is NO other write path (Max 2V3-3): a lookup-before-insert
         races its own late commit, so on a database without the constraint (42P10) the sheet says
         pay links cannot be added right now and writes nothing — honest unavailability, not a
         silent race. Existing rows are never touched.
     ACTOR (finding 2): the account that is signed in is checked at the START and at the END of the
     save; a switch in between stores nothing for the new account and reports nothing to it. */
  const save = async () => {
    const link = normalizePayHandle(value, rail);
    if (!link) {
      setErr(rail === "paypal"
        ? W(lang, "That doesn't look like a PayPal link. Try your paypal.me name, like johana, or paste the whole link.",
                  "Eso no parece un enlace de PayPal. Prueba con tu nombre de paypal.me, como johana, o pega el enlace completo.")
        : W(lang, "That doesn't look like a Wise link. Paste the whole link from Wise, or your wise.com/pay/me name.",
                  "Eso no parece un enlace de Wise. Pega el enlace completo de Wise, o tu nombre de wise.com/pay/me."));
      return;
    }
    setBusy(true); setErr("");
    const wrongAccount = () => setErr(W(lang, "You are signed in as a different account now. Nothing was saved.", "Ahora tienes otra cuenta iniciada. No se guardó nada."));
    try {
      if ((await currentActor()) !== userId) { wrongAccount(); return; }
      const row = { user_id: userId, provider: rail, method_type: rail, handle: link, alias: null, is_primary: false, is_secondary: false };
      const { error } = await supabase.from("payment_methods").upsert(row, { onConflict: "user_id,method_type,handle", ignoreDuplicates: true });
      if (error) {
        if ((error as { code?: string }).code === "42P10") {
          /* the database does not carry the unique key (rollout window, or after a rollback):
             nothing was written and nothing will be — no racing fallback (Max 2V3-3) */
          if (alive.current) { setUnavailable(true); setErr(W(lang, "Pay links can't be added right now — OneHome is being updated. Nothing was saved; try again in a few minutes.", "Ahora no se pueden agregar enlaces de pago — OneHome se está actualizando. No se guardó nada; inténtalo en unos minutos.")); }
          return;
        }
        throw error;
      }
      if (!alive.current) return;
      if ((await currentActor()) !== userId) { wrongAccount(); return; }
      onSaved();
    } catch {
      if (alive.current) setErr(W(lang, "We couldn't confirm that was saved. Your link is still here — try Save again.", "No pudimos confirmar que se guardó. Tu enlace sigue aquí — vuelve a intentar Guardar."));
    } finally { if (alive.current) setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[86] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label={W(lang, `Add ${name}`, `Agregar ${name}`)}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="glass-modal relative w-full max-w-lg rounded-t-3xl p-6 shadow-2xl sm:m-4 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={onClose} aria-label={W(lang, "Back", "Atrás")} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 dark:border-white/15">‹</button>
          <span className="text-sm font-extrabold">{W(lang, `Add ${name}`, `Agregar ${name}`)}</span>
          <span className="w-8" />
        </div>

        <label className="label" htmlFor="pay-link-input">{rail === "paypal" ? W(lang, "Your PayPal.Me name or link", "Tu nombre o enlace de PayPal.Me") : W(lang, "Your Wise pay link", "Tu enlace de pago de Wise")}</label>
        <input id="pay-link-input" ref={inputRef} className="input" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          value={value} onChange={e => { setValue(e.target.value); setErr(""); }}
          placeholder={rail === "paypal" ? "johana  ·  paypal.me/johana" : "wise.com/pay/me/johana"} />
        {preview && <p className="mt-1.5 text-[11px] font-semibold text-brand">{W(lang, `People will be sent to ${preview}`, `Las personas irán a ${preview}`)}</p>}
        {err && <p role="alert" data-state={unavailable ? "unavailable" : "error"} className="mt-1.5 text-[11px] font-semibold text-red-500">{err}</p>}

        <div className="mt-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3.5 dark:border-white/10 dark:bg-white/[0.05]">
          <p className="text-[12px] font-bold">{W(lang, "What this is", "Qué es esto")}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed opacity-75">
            {W(lang, `A way to get paid when a card won't work. The other person pays you straight through ${name} — the money never comes to ${productLabel}, so `,
                     `Una forma de cobrar cuando una tarjeta no funciona. La otra persona te paga directo por ${name} — el dinero nunca llega a ${productLabel}, así que `)}
            <strong>{W(lang, `${productLabel} doesn't hold or guarantee direct payments`, `${productLabel} no resguarda ni garantiza los pagos directos`)}</strong>
            {feeNote ? W(lang, `. ${feeNote.en}`, `. ${feeNote.es}`) : "."}
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed opacity-75">
            {W(lang, "Nothing moves forward until ", "Nada avanza hasta que ")}<em>{W(lang, "you", "tú")}</em>
            {W(lang, " confirm the money actually arrived — someone saying they sent it isn't enough.",
                     " confirmas que el dinero realmente llegó — que alguien diga que lo envió no basta.")}
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed opacity-75">
            {W(lang, "Your link stays private. It is never on your profile and never in search — only a person with a real agreement with you can see it.",
                     "Tu enlace es privado. Nunca aparece en tu perfil ni en la búsqueda — solo una persona con un acuerdo real contigo puede verlo.")}
          </p>
        </div>

        <button type="button" className="btn-primary mt-4 w-full" disabled={busy || !preview || unavailable} onClick={() => void save()}>
          {busy ? W(lang, "Saving…", "Guardando…") : W(lang, `Save my ${name} link`, `Guardar mi enlace de ${name}`)}
        </button>
      </div>
    </div>
  );
}
