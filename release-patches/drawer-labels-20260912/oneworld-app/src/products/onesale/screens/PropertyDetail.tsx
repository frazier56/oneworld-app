import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Gallery, ListingEngagement, appDoorway,
  Avatar, ScoreDonut, useI18n, useOneId, useAsync, supabase, productHref, W,
  IconPin, IconCheck, IconChat, startConversation, ScreenHeading, PropertyHistoryPanel, SimilarUnits,
  useViewerCcy, drawPrice, fetchTrm, type Trm,
  /* ⚠️ THE SALE SIDE HAD NO WAY TO ASK TO SEE THE PLACE. 15 Aug 2026.
     Lee, on a for-sale listing: *"There should be a request-a-showing button. The only button I
     see is the earnest money button, and it's greyed out. There definitely should be a request-a-
     showing button towards the bottom somewhere."*

     He is right, and it is worse than an omission: viewing a property you are thinking of BUYING
     is the more consequential of the two appointments, and this page offered nothing but a
     disabled payment button and a message box. v54 opened `showing_windows` to sale listings in
     the database and on the seller's form, then stopped short of the buyer's button — the feature
     existed with no door into it. Same component as the rent side, no second implementation. */
  ShowingRequest, DEFAULT_NOTICE_HOURS, DEFAULT_SLOT_MINUTES,
} from "@oneworld/shell";
import {
  type SaleProperty, type SaleHistory, type SaleEstimate, type SaleComparable,
  SALE_COLUMNS, usd, cop, KIND_LABEL, commissionAmount, BASIS_LABEL, CONFIDENCE_LABEL,
} from "../lib/sale";
/* v85 · R31 · The SAME amenity table the rent listing uses, imported rather than copied — the
   ordering, the grouping, the strike-through rule and both languages live in one file. Same
   shape as the sale FEED importing the rent product's FilterSheet since 12 Aug. */
import { amenityRows, GROUP_TITLE } from "../../onerental/lib/amenities";

/**
 * /sales/s/:id — one property for sale.
 *
 * Everything here is LIVE: the listing, the enquiry, the documents, the history. The only thing
 * that says "coming soon" is the button that would MOVE MONEY, because that is genuinely the
 * only part that is not built. Lee, 10 Aug: *"we don't need to make the whole for-sale section
 * coming soon — we just need to make pieces within it coming soon."*
 */
export default function PropertyDetail() {
  const { id = "" } = useParams();
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [viewCcy] = useViewerCcy();
  const [trm, setTrm] = useState<Trm | null>(null);
  useEffect(() => { void fetchTrm().then(setTrm); }, []);
  const nav = useNavigate();
  const es = lang === "es" || lang === "co";
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [showingOpen, setShowingOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const p = useAsync(async () => {
    const { data } = await supabase.from("sale_properties").select(SALE_COLUMNS).eq("id", id).maybeSingle();
    return (data as unknown as SaleProperty) ?? null;
  }, [id]);

  /* THE VALUE RANGE. Two RPCs rather than one: the range renders on its own as soon as it lands,
     and the comparables behind it fill in underneath. A visitor who only wants the number never
     waits on the list, and a slow comparables read cannot take the range down with it. */
  const est = useAsync(async () => {
    const { data } = await supabase.rpc("sale_estimate", { p_property_id: id });
    return (data as unknown as SaleEstimate) ?? null;
  }, [id]);

  const comps = useAsync(async () => {
    const { data } = await supabase.rpc("sale_comparables", { p_property_id: id });
    return (data as unknown as SaleComparable[]) ?? [];
  }, [id]);

  const agent = useAsync(async () => {
    if (!p) return null;
    const { data } = await supabase.from("profiles")
      .select("id, full_name, photo_url, job_title, score_v9_snapshot").eq("id", p.agent_id).maybeSingle();
    return data as any;
  }, [p?.agent_id], !!p);

  /* THE HISTORY. Keyed on the registry number so it survives the listing and follows the
     property across owners — which is the entire reason this product exists. */
  const history = useAsync(async () => {
    if (!p) return [] as SaleHistory[];
    const q = supabase.from("sale_history")
      .select("id, property_id, matricula_inmobiliaria, address_line, city, sold_price, currency, sold_on, document_path, verified_at, created_at")
      .order("sold_on", { ascending: false });
    const { data } = p.matricula_inmobiliaria
      ? await q.eq("matricula_inmobiliaria", p.matricula_inmobiliaria)
      : await q.eq("property_id", p.id);
    return (data ?? []) as SaleHistory[];
  }, [p?.id, p?.matricula_inmobiliaria], !!p);

  const mine = !!userId && p?.agent_id === userId;
  /**
   * ── OWNER CONTROLS ARE OFF UNLESS YOU CAME FROM MY-LISTINGS (Lee, 13 Aug 2026) ──────────
   * *"If you click on a public listing there and it's your listing, you don't see the public
   * version of it — you see your version. I see where it says Edit and Draft a contract, but I
   * don't need to see it there. That's the public view. If I want to see what everyone else is
   * seeing, I go to the feed. If I want to see my own listing I can go to My Listings."*
   *
   * `mine` still means what it always meant — you own this. What changed is that owning it is no
   * longer enough to SHOW you the owner's tools. The feed is a public surface: an agent checking
   * how their own advert looks to a renter was being shown an Edit button no renter can see, so
   * the one place they could preview their own work was the one place that lied to them about it.
   *
   * `?owner=1` is appended by My Listings and by the post-save redirect, and by nothing else. A
   * person who guesses the query string gets the buttons and then gets refused by RLS, which is
   * where that refusal belongs — this is a VIEW switch, never a permission.
   */
  const [params] = useSearchParams();
  const ownerView = mine && params.get("owner") === "1";

  async function ask() {
    if (!userId || !p || mine) return;
    setSending(true); setErr(null);
    const body = note.trim() || W(lang, `Hi — is "${p.title}" still for sale?`, `Hola — ¿"${p.title}" sigue en venta?`);
    const res = await startConversation(userId, p.agent_id, body);
    if ("error" in res) { setErr(res.error); setSending(false); return; }
    await supabase.from("sale_conversation_tags")
      .upsert({ conversation_id: res.conversationId, property_id: p.id }, { onConflict: "conversation_id" });
    setSending(false);
    nav(productHref("onesale", "/messages"));
  }

  if (p === undefined) return <div className="py-6"><div className="card ow-shimmer h-80" /></div>;
  if (!p) return (
    <div className="py-12 text-center">
      <p className="text-sm font-bold">{W(lang, "This listing is gone.", "Este anuncio ya no está.")}</p>
      <Link to={productHref("onesale")} className="btn-ghost mt-4 inline-block">{W(lang, "Back", "Volver")}</Link>
    </div>
  );

  const where = [p.neighbourhood, p.city].filter(Boolean).join(", ");
  const commission = commissionAmount(p);

  return (
    <div className="space-y-4">
      {/* The SAME gallery the rent side uses — cover, "See all" at a density the reader picks, and
          a fullscreen swipe. Two different photo viewers inside one app called OneHome is exactly
          the drift the shared kit exists to stop. */}
      <Gallery
        photos={p.photos} lang={lang} alt={p.title}
        footer={
          /* v92.3 · U37 · Lee: *"you don't need the comment section. You just need the like
               and share button."* Share STAYS on the listing — it is the CARD that loses it, v90.
               ⚠️ onComments is still passed with the button gone: inside ListingEngagement that
               prop is what makes the count query SKIP media_comments. Drop it and this screen
               runs a count for a button nobody draws. Max's note, from the rent card.
               ⚠️ BARE — no braces — because this sits inside `footer={ … }`.
               Comment syntax in a .tsx file depends on position. v92 put a braced one in the
               ATTRIBUTE position, where JSX reads it as a child, and tsc failed with TS1005. */
          <ListingEngagement
            itemId={p.id} source="sale_property"
            shareUrl={`${appDoorway("onehome")}/s/${p.id}`}
            shareTitle={p.title}
            allowShare={(p as any).allow_public_share !== false}
            hideComments
            onComments={() => {}}
            lang={lang} />
        } />

      {/* ── THE LISTING NUMBER, AND WHEN IT LAST CHANGED ───────────────────────────────────
             Lee, 12 Aug 2026: *"every listing has a number — five digits is good… if someone
             calls about a listing, I need to know okay, what's the listing number."* One sequence
             feeds both halves of OneHome, so a number identifies a property across the product
             rather than only within the sale half.

             The "Edited" stamp only appears once the listing HAS been edited — on one that never
             changed it would just be the creation date wearing a misleading word. */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {(p as any).listing_no && (
          <span className="rounded-md bg-ink/[0.06] px-2 py-0.5 text-[11.5px] font-black tabular-nums tracking-wide opacity-70 dark:bg-white/10">
            #{(p as any).listing_no}
          </span>
        )}
        {(p as any).updated_at && (p as any).created_at
          && new Date((p as any).updated_at).getTime() - new Date((p as any).created_at).getTime() > 60_000 && (
          <span className="text-[11.5px] font-semibold opacity-45">
            {W(lang, "Edited", "Editado")}{" "}
            {new Date((p as any).updated_at).toLocaleDateString(lang === "en" ? "en-US" : "es-CO",
              { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>
      <h1 className="mt-1 text-[22px] font-black leading-tight tracking-tight">{p.title}</h1>
      {where && <p className="mt-1 flex items-center gap-1.5 text-[13px] opacity-65"><IconPin size={13} />{where}</p>}

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="whitespace-nowrap text-[24px] font-black tracking-tight text-brand">{drawPrice(p.asking_price, viewCcy, trm?.rate)}</span>
        {p.display_currency === "COP" && p.display_fx_rate && (
          <span className="text-[12.5px] opacity-55">≈ {cop(p.asking_price, p.display_fx_rate)}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Fact>{KIND_LABEL[p.kind][es ? "es" : "en"]}</Fact>
        {p.bedrooms != null && <Fact>{p.bedrooms} {W(lang, "bedrooms", "habitaciones")}</Fact>}
        {p.bathrooms != null && <Fact>{p.bathrooms} {W(lang, "bathrooms", "baños")}</Fact>}
        {p.area_m2 != null && <Fact>{p.area_m2} m²</Fact>}
        {p.parking_spaces != null && <Fact>{p.parking_spaces} {W(lang, "parking", "parqueaderos")}</Fact>}
        {p.year_built != null && <Fact>{W(lang, `Built ${p.year_built}`, `Año ${p.year_built}`)}</Fact>}
        {p.estrato != null && <Fact>Estrato {p.estrato}</Fact>}
        {p.admin_fee_monthly != null && <Fact>{W(lang, "Admin", "Admin")} {usd(p.admin_fee_monthly)}/{W(lang, "mo", "mes")}</Fact>}
      </div>

      {p.description && <p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed">{p.description}</p>}

      {/* ── THE ESTIMATED VALUE RANGE ────────────────────────────────────────────────────────
          Lee, 10 Aug 2026: *"here's a property range value. Same thing like Zillow."*

          Three deliberate choices, all of them about not overclaiming in a market that has no
          public sales record to check us against:
            · a RANGE, never a single number — a point estimate implies a precision we do not have;
            · the BASIS and the COUNT are shown, so the number can be interrogated rather than
              believed;
            · when there is not enough history, the panel says so plainly instead of widening its
              way to an answer. "Not enough sales nearby yet" is the honest state of a new market
              and it reads better than a confident number that turns out wrong.
          The word avalúo is avoided on purpose: in Colombia that is a regulated appraisal by a
          licensed valuer, and this is not one. The disclaimer travels with the number. */}
      <section className="card mt-3 p-4">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
          {W(lang, "Estimated value", "Valor estimado")}
        </h2>

        {est === undefined ? <div className="ow-shimmer mt-2 h-16 rounded-xl" />
          : est && est.ok ? (
            <>
              <p className="mt-1.5 text-[22px] font-black leading-tight tracking-tight text-brand">
                {usd(est.low)} <span className="opacity-45">–</span> {usd(est.high)}
              </p>
              {Number(p.display_fx_rate) > 0 && (
                <p className="text-[12px] opacity-55">
                  ≈ {cop(est.low, Number(p.display_fx_rate))} – {cop(est.high, Number(p.display_fx_rate))}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] opacity-65">
                <span className="rounded-full bg-brand/15 px-2 py-0.5 font-bold text-brand">
                  {W(lang, CONFIDENCE_LABEL[est.confidence]?.en ?? "", CONFIDENCE_LABEL[est.confidence]?.es ?? "")}
                </span>
                <span>
                  {W(lang,
                    `${est.comparables} ${est.comparables === 1 ? "sale" : "sales"} · ${BASIS_LABEL[est.basis]?.en ?? ""}`,
                    `${est.comparables} ${est.comparables === 1 ? "venta" : "ventas"} · ${BASIS_LABEL[est.basis]?.es ?? ""}`)}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] opacity-55">
                {W(lang,
                  `About ${usd(est.per_m2_mid)} per m², over the last ${est.window_months} months.`,
                  `Alrededor de ${usd(est.per_m2_mid)} por m², de los últimos ${est.window_months} meses.`)}
              </p>

              {/* What the asking price looks like against the middle of the band. Stated, never
                  judged — "12% above" is a fact the buyer and the agent can both act on; "overpriced"
                  is an opinion this product has no business publishing about its own listings. */}
              {est.asking_vs_mid_pct != null && Math.abs(Number(est.asking_vs_mid_pct)) >= 1 && (
                <p className="mt-1 text-[11.5px] opacity-65">
                  {W(lang,
                    `The asking price is ${Math.abs(Number(est.asking_vs_mid_pct))}% ${Number(est.asking_vs_mid_pct) > 0 ? "above" : "below"} the middle of this range.`,
                    `El precio pedido está ${Math.abs(Number(est.asking_vs_mid_pct))}% ${Number(est.asking_vs_mid_pct) > 0 ? "por encima" : "por debajo"} del centro de este rango.`)}
                </p>
              )}

              {!!comps?.length && (
                <details className="mt-2.5">
                  <summary className="ow-tap cursor-pointer text-[12.5px] font-bold text-brand">
                    {W(lang, "See the sales behind this", "Ver las ventas en que se basa")}
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {comps.map((c, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                        <span className="min-w-0 truncate opacity-70">
                          {c.neighbourhood ?? W(lang, "Nearby", "Cerca")}
                          {c.area_m2 ? ` · ${Math.round(Number(c.area_m2))} m²` : ""}
                          {c.bedrooms != null ? ` · ${c.bedrooms} ${W(lang, "bd", "hab.")}` : ""}
                        </span>
                        <span className="shrink-0 font-bold">
                          {usd(Number(c.sold_price))}
                          <span className="ml-1 text-[10.5px] font-normal opacity-50">{c.sold_on}</span>
                        </span>
                      </div>
                    ))}
                    {/* No address. Colombian sales are not public record, and the number does its
                        job without naming somebody's home. */}
                    <p className="pt-1 text-[11px] opacity-45">
                      {W(lang, "Addresses are not shown.", "No se muestran las direcciones.")}
                    </p>
                  </div>
                </details>
              )}

              <p className="mt-2 text-[11px] leading-relaxed opacity-50">
                {W(lang, est.disclaimer_en, est.disclaimer_es)}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[12.5px] leading-relaxed opacity-65">
              {est && !est.ok && est.message_en
                ? W(lang, est.message_en, est.message_es ?? est.message_en)
                : W(lang,
                    "Not enough recorded sales nearby yet to estimate a range. Every sale closed here adds to it.",
                    "Aún no hay suficientes ventas registradas cerca para estimar un rango. Cada venta cerrada aquí lo alimenta.")}
            </p>
          )}
      </section>

      {/* ── THE REGISTERED HISTORY ─────────────────────────────────────────────────────────
          Above the curated sale-history block below, because this one is not a claim: it is what
          a notary registered, keyed on the matrícula, verifiable against a deed number. Renders
          nothing at all when there is no matrícula and no price movement to report. */}
      {/* ── v85 · R31 · WHAT THIS PLACE HAS ────────────────────────────────────────────
          Twenty-six attributes are filterable on this side and none of them were shown. A
          buyer could narrow to "penthouse with air conditioning in the master" , open the
          result, and find no mention of either anywhere on the page.

          Six rows then the rest behind a tap, and anything the seller said this place does
          NOT have is struck through rather than omitted — so silence never has to be
          interpreted. Identical behaviour to the rent listing, from the same table. */}
      <Amenities p={p} lang={lang} />

      <PropertyHistoryPanel
        listingKind="sale" listingId={p.id}
        matricula={p.matricula_inmobiliaria} areaM2={p.area_m2} currency={p.currency} lang={lang} />

      {/* Comparables — stamped, not faked. Same component as the rent side. */}
      <SimilarUnits neighbourhood={p.neighbourhood} city={p.city} lang={lang} />

      {/* v77 · U12 · Comments removed from property listings. Reviews take this space. */}

      {/* ── THE HISTORY. The reason to track a sale here rather than anywhere else. ───────── */}
      <section className="card mt-5 p-4">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
          {W(lang, "Sale history", "Historial de ventas")}
        </h2>
        {history === undefined ? <div className="ow-shimmer mt-2 h-12 rounded-xl" />
          : history.length ? (
            <div className="mt-2 space-y-2">
              {history.map(h => (
                <div key={h.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="opacity-70">{h.sold_on}</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    {usd(Number(h.sold_price))}
                    {h.verified_at
                      ? <span className="text-brand" title={W(lang, "Document on file", "Documento archivado")}><IconCheck size={13} /></span>
                      : <span className="text-[10.5px] font-black uppercase opacity-45">{W(lang, "unverified", "sin verificar")}</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[12.5px] leading-relaxed opacity-65">
              {W(lang,
                "No recorded sale yet. Colombia keeps no public record of what a property last sold for — when this one sells here, with the deed on file, it becomes the first entry in its permanent history.",
                "Aún no hay una venta registrada. Colombia no lleva un registro público de por cuánto se vendió un inmueble — cuando este se venda aquí, con la escritura archivada, será la primera entrada de su historial permanente.")}
            </p>
          )}
      </section>

      {/* ── WHAT MOVES, AND WHAT DOES NOT ────────────────────────────────────────────────── */}
      <section className="card mt-3 space-y-2 p-4">
        <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
          {W(lang, "How a sale works here", "Cómo funciona una venta aquí")}
        </h2>
        <Line text={W(lang,
          "You talk to the agent here, and every document stays in one place both of you can open.",
          "Usted habla con el agente aquí, y cada documento queda en un solo lugar que ambos pueden abrir.")} />
        <Line text={W(lang,
          "The closing happens with your attorney. The purchase price does not pass through us — it never will.",
          "El cierre se hace con su abogado. El precio de compra no pasa por nosotros — nunca lo hará.")} />
        {commission != null && commission > 0 && (
          <Line text={W(lang,
            `The commission is ${usd(commission)}, paid by the ${p.commission_paid_by ?? "seller"}.`,
            `La comisión es de ${usd(commission)}, la paga ${p.commission_paid_by === "buyer" ? "el comprador" : p.commission_paid_by === "shared" ? "de forma compartida" : "el vendedor"}.`)} />
        )}
        {p.earnest_money != null && p.earnest_money > 0 && (
          <Line text={W(lang,
            `Earnest money of ${usd(p.earnest_money)} secures the property while the closing is arranged.`,
            `Arras de ${usd(p.earnest_money)} aseguran el inmueble mientras se organiza el cierre.`)} />
        )}
        {/* THE ONE COMING-SOON PIECE, and it is exactly the money step. */}
        <button type="button" disabled className="btn-primary mt-1 w-full cursor-not-allowed opacity-45">
          {W(lang, "Pay earnest money", "Pagar las arras")}
        </button>
        <p className="text-center text-[11.5px] leading-relaxed opacity-60">
          {W(lang,
            "Paying earnest money and the commission through the app opens shortly. Everything else on this page works today.",
            "Pagar las arras y la comisión por la app se habilita pronto. Todo lo demás en esta página ya funciona.")}
        </p>
      </section>

      {agent && (
        <Link to={productHref("onesale", `/p/${p.agent_id}`)} className="card ow-tap mt-3 flex items-center gap-3 p-3">
          <Avatar src={agent.photo_url} name={agent.full_name} size={44} rounded="rounded-full" textSize="text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-bold">{agent.full_name}</p>
            {agent.job_title && <p className="truncate text-[12px] opacity-55">{agent.job_title}</p>}
          </div>
          <ScoreDonut score={agent.score_v9_snapshot == null ? null : Number(agent.score_v9_snapshot)} size={44} />
        </Link>
      )}

      {showingOpen && p && (
        <ShowingRequest
          propertyId={p.id}
          hostId={p.agent_id}
          notice={(p as any).showing_notice_hours ?? DEFAULT_NOTICE_HOURS}
          slotMinutes={(p as any).showing_slot_minutes ?? DEFAULT_SLOT_MINUTES}
          onClose={() => setShowingOpen(false)}
          /* "Or just send a message" drops them into the box below rather than a dead end —
             Lee's rule from the rent side: *"they click schedule a showing… and then still can
             send a message."* */
          onMessage={() => document.getElementById("ask-seller")?.scrollIntoView({ behavior: "smooth" })} />
      )}

      {!mine && userId && (
        <section id="ask-seller" className="card mt-3 space-y-2 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {W(lang, "Ask about this property", "Preguntar por este inmueble")}
          </h2>
          <textarea className="input min-h-[84px] w-full" value={note} onChange={e => setNote(e.target.value)}
            placeholder={W(lang, `Hi — is "${p.title}" still for sale?`, `Hola — ¿"${p.title}" sigue en venta?`)} />
          <button type="button" className="btn-primary w-full" disabled={sending} onClick={ask}>
            <span className="inline-flex items-center gap-2"><IconChat size={15} />{sending ? "…" : W(lang, "Send message", "Enviar mensaje")}</span>
          </button>

          {/* ⚠️ SHOWN ONLY WHEN THE SELLER ACTUALLY OFFERS VIEWINGS, never as a dead control.
              A "request a showing" button on a listing whose seller has opened no windows sends
              the buyer into a sheet that can only tell them there is nothing — which is exactly
              the class of button-with-nothing-behind-it this whole feature was built to remove.
              When it is off, the message box above is the route, and it is already there. */}
          {(p as any).showings_enabled && (
            <button type="button" className="btn-ghost w-full" onClick={() => setShowingOpen(true)}>
              {W(lang, "Request a showing", "Solicitar una visita")}
            </button>
          )}

          {err && <p className="text-[12px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
        </section>
      )}

      {!mine && !userId && (
        <section id="ask-seller" className="card mt-3 space-y-2 p-4">
          <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
            {W(lang, "Contact the seller", "Contactar al vendedor")}
          </h2>
          <p className="text-[13px] leading-relaxed opacity-65">
            {W(lang,
              "Sign in with One ID to message the seller or request a showing. We tag the conversation with this property so nobody has to ask which listing you mean.",
              "Inicie sesión con One ID para escribirle al vendedor o solicitar una visita. Marcamos la conversación con este inmueble para que nadie tenga que preguntar de cuál se trata.")}
          </p>
          <Link to={productHref("onesale", "/profile")} className="btn-primary block w-full text-center">
            {W(lang, "Sign in to contact seller", "Iniciar sesión para contactar")}
          </Link>
        </section>
      )}

      {ownerView && (
        /* EDIT — Lee, 12 Aug 2026: *"I can't edit my listing… we need an edit button, probably at
           the bottom somewhere."* It reopens the SAME form the listing was created in, so the
           create screen and the edit screen cannot drift apart. Twin of the rent side's. */
        <div className="mt-3 flex items-stretch gap-2">
          <Link to={productHref("onesale", `/list?edit=${p.id}`)}
            className="btn-primary min-w-0 flex-1 truncate whitespace-nowrap text-center text-[clamp(13px,3.6vw,15px)]">
            {W(lang, "Edit", "Editar")}
          </Link>
          <Link to={productHref("onesale", "/properties")}
            className="btn-ghost min-w-0 flex-1 truncate whitespace-nowrap text-center text-[clamp(13px,3.6vw,15px)]">
            {W(lang, "My properties", "Mis inmuebles")}
          </Link>
        </div>
      )}
    </div>
  );
}

/* v85 · R31 · Same markup, same classes and same six-then-the-rest behaviour as the rent
   listing's. Typed loosely on purpose: `amenityRows` reads plain attribute fields that exist
   with the same names on both tables, so narrowing this to one product's row type would be a
   lie about which rows it can read. */
function Amenities({ p, lang }: { p: any; lang: string }) {
  const [all, setAll] = useState(false);
  const rows = amenityRows(p, lang);
  if (rows.length === 0) return null;

  const shown = all ? rows : rows.slice(0, 6);
  const groups = all
    ? (["space", "inside", "outside", "building", "rules"] as const)
        .map(g => ({ g, items: rows.filter((r: any) => r.group === g) }))
        .filter(x => x.items.length > 0)
    : null;

  return (
    <section className="mt-5">
      <h2 className="text-[13px] font-black uppercase tracking-wide opacity-60">
        {W(lang, "What this place has", "Lo que tiene este inmueble")}
      </h2>

      {groups
        ? groups.map(({ g, items }) => (
            <div key={g} className="mt-3">
              <h3 className="text-[11.5px] font-black uppercase tracking-wide opacity-45">
                {GROUP_TITLE(g, lang)}
              </h3>
              <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                {items.map((r: any) => <AmenityRow key={r.key} text={r.text} has={r.has} />)}
              </ul>
            </div>
          ))
        : (
          <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
            {shown.map((r: any) => <AmenityRow key={r.key} text={r.text} has={r.has} />)}
          </ul>
        )}

      {rows.length > 6 && (
        <button type="button" onClick={() => setAll(v => !v)}
          className="ow-tap btn-ghost mt-3 text-[12.5px]">
          {all
            ? W(lang, "Show less", "Ver menos")
            : W(lang, `Show all ${rows.length}`, `Ver los ${rows.length}`)}
        </button>
      )}
    </section>
  );
}

function AmenityRow({ text, has }: { text: string; has: boolean }) {
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <span className={`mt-0.5 shrink-0 ${has ? "text-brand" : "opacity-35"}`}>
        <IconCheck size={14} />
      </span>
      <span className={has ? "opacity-85" : "opacity-45 line-through"}>{text}</span>
    </li>
  );
}

function Fact({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-2.5 py-1 text-[12px] font-semibold opacity-75 dark:border-white/15">{children}</span>;
}
function Line({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-snug">
      <span className="mt-0.5 shrink-0 text-brand"><IconCheck size={14} /></span>
      <span className="opacity-85">{text}</span>
    </p>
  );
}
