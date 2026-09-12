import { useEffect, useState } from "react";
import { useI18n, W } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import {
  fetchPropertyHistory, annualGrowthPct, shortDeed,
  type PropertyHistory,
} from "../lib/propertyHistory";
import { fetchTrm, type Trm } from "../lib/trm";

/**
 * THE HISTORY PANEL — the reason to use OneHome instead of a WhatsApp group.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"it's more than just a listing service… we're capturing sales and rental
 * history… to make sure prices stay competitive."*
 *
 * Two histories, from two completely different places, on one panel — because to the person
 * reading it they answer the same question ("is this price fair?") and splitting them into two
 * sections the reader has to reconcile would waste the only advantage the product has.
 *
 *   1. WHAT IT ACTUALLY SOLD FOR — registered notarial transfers from IGAC's open data, keyed on
 *      the matrícula inmobiliaria. Free, public, verifiable against a deed number, and until now
 *      shown to nobody. See `lib/propertyHistory.ts`.
 *
 *   2. WHAT IT HAS BEEN ASKED FOR — our own `listing_price_events`, written by a database trigger
 *      on every price and status change since 11 Aug 2026. This one exists nowhere else in
 *      Colombia at any price, because nobody started recording it. It cannot be bought and it
 *      cannot be backfilled; the only way to have it is to have been keeping it.
 *
 * ── THE RULE THIS PANEL LIVES BY ────────────────────────────────────────────────────────────
 * Report, never infer. Every number here was recorded by somebody — a notary, or this platform
 * watching an agent change a price. The moment the panel starts estimating what a place is
 * "worth", it becomes the same guess as everybody else's and the credibility that makes it worth
 * building is gone. There is deliberately no valuation, no "OneHome estimate", no comparison to a
 * neighbourhood average we do not have the data to compute honestly.
 *
 * ── AND IT SAYS WHAT IT DOESN'T KNOW ────────────────────────────────────────────────────────
 * The registry's priced coverage runs 2021–2023. A property with a long chain and no priced sale
 * is normal, not suspicious. So an empty result renders as "no registered sale on file", never as
 * "this property has never sold" — those are different sentences and only one of them is true.
 */

type PriceEvent = {
  id: string;
  event_type: string;
  price: number | null;
  previous_price: number | null;
  price_unit: string | null;
  status: string | null;
  occurred_at: string;
};

export default function PropertyHistoryPanel({
  listingKind, listingId, matricula, areaM2, currency = "USD", lang: langProp,
}: {
  listingKind: "rental" | "sale";
  listingId: string;
  /** The property registry number, when the agent supplied one. Only sale listings ask for it. */
  matricula?: string | null;
  /** From the LISTING, not the registry — the registry has no areas. Labelled as such on screen. */
  areaM2?: number | null;
  /** Asking-price events use the listing's stored denomination; they are not all dollars. */
  currency?: string | null;
  lang?: string;
}) {
  const i18n = useI18n();
  const lang = langProp ?? i18n.lang;

  const [registry, setRegistry] = useState<PropertyHistory | null | "loading">(
    matricula ? "loading" : null);
  const [trm, setTrm] = useState<Trm | null>(null);

  useEffect(() => { fetchTrm().then(setTrm); }, []);
  useEffect(() => {
    if (!matricula) { setRegistry(null); return; }
    let dead = false;
    fetchPropertyHistory(matricula).then(h => { if (!dead) setRegistry(h); });
    return () => { dead = true; };
  }, [matricula]);

  /* Our own asking-price history. RLS already restricts this to public published listings and to
     the owner's own; the query does not need to repeat the condition. */
  const asking = useAsync(async () => {
    const { data, error } = await supabase.from("listing_price_events")
      .select("id, event_type, price, previous_price, price_unit, status, occurred_at")
      .eq("listing_kind", listingKind)
      .eq("listing_id", listingId)
      .order("occurred_at", { ascending: false })
      .limit(60);
    if (error) { console.error("[shell] price history read failed —", error.message); return []; }
    return (data ?? []) as PriceEvent[];
  }, [listingKind, listingId], !!listingId);

  const usd = (n: number) => new Intl.NumberFormat("en-US",
    { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const cop = (n: number) => new Intl.NumberFormat("es-CO",
    { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
  const askingMoney = (n: number) => {
    const code = currency?.toUpperCase() || "USD";
    try {
      return new Intl.NumberFormat(code === "COP" ? "es-CO" : "en-US", {
        style: "currency", currency: code, currencyDisplay: code === "COP" ? "code" : "symbol",
        maximumFractionDigits: code === "COP" ? 0 : 2,
      }).format(n);
    } catch {
      return `${code} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)}`;
    }
  };
  /* ── ⚠️ A DATE-ONLY STRING MUST BE BUILT IN LOCAL TIME, NOT PARSED ────────────────────────
     Found on production, 15 Aug 2026, by reading the live Cartagena listing: the registry says
     the sale was registered on 13 July 2016 and the screen said **12 July**. Every registry date
     on every listing was showing one day early.

     `new Date("2016-07-13")` is specified to parse a bare date as **UTC midnight**. Rendered in
     any timezone west of Greenwich that instant is still the previous evening, so it formats as
     the 12th. Colombia is UTC−5. So is most of the Americas. The bug was invisible to anyone
     testing in UTC — which is exactly why it survived: it does not reproduce on a server, only on
     the machines of every actual user.

     Building from the parts pins it to local midnight, where a date with no time belongs. */
  const day = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return "";
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString(
      lang === "es" || lang === "co" ? "es" : "en", { year: "numeric", month: "short", day: "numeric" });
  };

  const reg = registry === "loading" ? null : registry;
  const sales = reg?.pricedSales ?? [];
  const growth = reg ? annualGrowthPct(reg) : null;

  /* THE FIRST EVENT IS "listed". A history with one entry is not a history, it is a start date —
     so the asking-price section only claims to be history once something has actually changed. */
  const events = asking ?? [];
  const changes = events.filter(e => e.event_type === "price_change");
  const listedAt = events.length ? events[events.length - 1] : null;
  const daysListed = listedAt
    ? Math.floor((Date.now() - new Date(listedAt.occurred_at).getTime()) / 86_400_000)
    : null;

  /* ── THIS SECTION IS ALWAYS ON THE PAGE, AND THAT IS A REVERSAL ──────────────────────────
     It used to `return null` when there was no matrícula and no price movement — which, today,
     is nearly every listing on the platform including Lee's own. So the feature the whole
     product is built around rendered nowhere, and Lee, 12 Aug 2026, quite reasonably asked:
     *"I'd like to get a report on what happened with the history… I wanna know where that is and
     how does the user access it."* It was there. It was just invisible.

     Zillow's framing is the right one and it is why this changed: the history block is a FIXED
     part of a property page, and when there is nothing to report it says so. A section that
     appears only when it has good news teaches nobody that it exists, and the first time it does
     appear the reader has no idea whether its absence elsewhere meant "clean" or "not checked".
     Empty and explained beats absent. */

  return (
    <section className="ow-form-sec">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-black uppercase tracking-wide opacity-60">
          {W(lang, "This property's history", "Historial de este inmueble")}
        </h3>
        <span className="rounded-full bg-[var(--teal-depth)]/12 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--teal-depth)]">
          {W(lang, "OneHome", "OneHome")}
        </span>
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed opacity-55">
        {W(lang,
          "Recorded, not estimated. Sale prices come from the national property registry; asking prices are what this listing has actually been advertised at.",
          "Registrado, no estimado. Los precios de venta vienen del registro nacional de instrumentos públicos; los precios pedidos son lo que este anuncio realmente ha pedido.")}
      </p>

      {/* ── 1 · WHAT IT SOLD FOR — SALE LISTINGS ONLY ──────────────────────────────────────
          Lee, 15 Aug 2026: *"there's no point in showing sale history on a property that's for
          rent. So we need to put some type of gate on that."*

          He is right, and the reason is sharper than tidiness. A tenant deciding whether 1,050
          dollars a month is fair gains nothing from knowing the owner paid 360 million pesos —
          the two numbers do not divide into each other in any way a renter can use, and putting
          them side by side invites exactly the arithmetic that produces a bad conclusion. Worse,
          it tells a stranger what the landlord paid for the place, on a page the landlord did not
          expect to be a disclosure.

          A BUYER gets both halves, because a buyer genuinely wants both: what it sold for, and
          what it rents for if they intend to let it. So the rule is one-directional —
          sale listings show sale history AND rent history; rental listings show rent history
          only. */}
      {listingKind === "rental" ? null : !matricula ? (
        /* NO FOLIO, SO NO REGISTRY — said plainly, because the alternative is a page that looks
           identical whether the property has a clean chain or was simply never looked up. The
           sentence names the document the number is printed on, so the lister can go and get it
           rather than being told a feature is unavailable. */
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide opacity-45">
            {W(lang, "Registered sales", "Ventas registradas")}
          </p>
          <p className="text-[12px] leading-relaxed opacity-55">
            {W(lang,
              "Not looked up. Registered sale prices are chained by matrícula inmobiliaria — the property's permanent number at the registry office, printed at the top of its certificado de tradición y libertad. This listing doesn't carry one yet, so nothing has been checked either way.",
              "No consultado. Los precios de venta registrados se encadenan por matrícula inmobiliaria — el número permanente del inmueble en la Oficina de Registro, impreso en la parte superior de su certificado de tradición y libertad. Este anuncio aún no la trae, así que no se ha verificado nada en ningún sentido.")}
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide opacity-45">
            {W(lang, "Registered sales", "Ventas registradas")}
          </p>

          {registry === "loading" ? (
            <div className="ow-shimmer h-12 rounded-xl" />
          ) : sales.length > 0 ? (
            <>
              <ul className="divide-y divide-ink/[0.06] dark:divide-white/[0.08]">
                {sales.map((s, i) => {
                  /* ── THE CHANGE SINCE THE SALE BEFORE IT ──────────────────────────────────
                     Lee, 15 Aug 2026: *"you can't show a percent variance on the first
                     historical value because that's the baseline. It increased from what? …
                     if it's a negative increase it's gonna be red, and if it's positive it's
                     gonna be green."*

                     `sales` is NEWEST FIRST, so the sale to compare against is the NEXT item in
                     the array, not the previous one. Getting that backwards would invert every
                     arrow on the panel while still looking plausible, which is the worst kind of
                     bug on a screen whose whole claim is that it reports rather than estimates.

                     The OLDEST row — the last in the array — has nothing behind it and gets no
                     percentage at all. Not a zero, not a dash: nothing. A zero would assert the
                     price did not move, and we do not know that. */
                  const prior = sales[i + 1];
                  const delta = prior && prior.valueCop
                    ? Math.round(((s.valueCop! - prior.valueCop) / prior.valueCop) * 1000) / 10
                    : null;
                  return (
                  <li key={s.anotacion} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-[14px] font-black tabular-nums">
                        {cop(s.valueCop!)}
                      </span>
                      <span className="block text-[11px] opacity-55">
                        {day(s.date)}
                        {shortDeed(s.document) ? ` · ${shortDeed(s.document)}` : ""}
                      </span>
                      {/* Price per m² moved UNDER the money so the far right belongs to the
                          percentage, matching the asking-price rows below. It uses the LISTING's
                          area because the registry holds none — said out loud, never implied. */}
                      {areaM2 ? (
                        <span className="block text-[10.5px] opacity-45 tabular-nums">
                          {cop(Math.round(s.valueCop! / areaM2))}{" "}
                          {W(lang, "per m² (listed area)", "por m² (área del anuncio)")}
                        </span>
                      ) : null}
                    </span>
                    {delta != null && (
                      <span className={`shrink-0 text-[13px] font-black tabular-nums ${
                        delta >= 0 ? "text-[var(--teal-depth)]" : "text-red-500"}`}>
                        {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
                      </span>
                    )}
                  </li>
                  );
                })}
              </ul>

              {growth != null && (
                <p className="mt-2 text-[12px] font-semibold">
                  <span className={growth >= 0 ? "text-[var(--teal-depth)]" : "text-red-500"}>
                    {growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}%
                  </span>{" "}
                  <span className="font-normal opacity-60">
                    {W(lang, "a year between registered sales", "al año entre ventas registradas")}
                  </span>
                </p>
              )}

              {/* The honesty line. Without it, "1 sale" reads as "sold once in its life". */}
              {reg && reg.events.length > sales.length && (
                <p className="mt-1.5 text-[11px] leading-relaxed opacity-45">
                  {W(lang,
                    `${sales.length} priced sale${sales.length === 1 ? "" : "s"} of ${reg.events.length} registered events. The registry only records transaction values from 2021 onward.`,
                    `${sales.length} venta${sales.length === 1 ? "" : "s"} con precio de ${reg.events.length} anotaciones registradas. El registro solo trae valores desde 2021.`)}
                </p>
              )}
            </>
          ) : (
            <p className="text-[12px] leading-relaxed opacity-55">
              {W(lang,
                "No registered sale price on file. The national registry only carries transaction values from 2021 onward, so an older or quietly-held property will show nothing here — that is not a sign of a problem.",
                "No hay precio de venta registrado. El registro nacional solo trae valores desde 2021, así que un inmueble más antiguo o que no se ha movido no mostrará nada aquí — eso no indica ningún problema.")}
            </p>
          )}

          <p className="mt-1.5 text-[10.5px] opacity-40">
            {W(lang, "Source: IGAC / national property registry, open data · matrícula ",
                     "Fuente: IGAC / registro nacional, datos abiertos · matrícula ")}
            {reg?.matricula ?? matricula}
          </p>
        </div>
      )}

      {/* ── 2 · WHAT IT HAS BEEN ASKED FOR ──────────────────────────────────────────────── */}
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide opacity-45">
          {listingKind === "rental"
            ? W(lang, "Rent asked on OneHome", "Canon pedido en OneHome")
            : W(lang, "Asking price on OneHome", "Precio pedido en OneHome")}
        </p>

        {/* ── WHY THE RENTAL HALF LOOKS THIN, AND WILL FOR A WHILE ────────────────────────
            Lee, 12 Aug 2026, on rental history: *"unless Airbnb is logging this history, then no
            one's reporting the rent anywhere… I doubt if they're submitting these leases to the
            city."* He is right, and the research agrees: Colombia registers LANDLORDS (matrícula
            de arrendadores, a business registry) — it does not register LEASES. There is no
            public dataset of what any Colombian apartment has rented for, at any price, from
            anybody. So unlike the sale half, this one cannot be bought or backfilled; it only
            exists from the day the platform started writing it down, which was 11 Aug 2026.
            Saying that out loud is better than a thin list that looks like a broken feature. */}
        {listingKind === "rental" && changes.length === 0 && (
          <p className="mb-1.5 text-[11px] leading-relaxed opacity-45">
            {W(lang,
              "Colombia has no public record of what anything rents for — leases are never registered. OneHome keeps its own from the day a listing appears, so this fills in as prices move.",
              "En Colombia no existe un registro público de cánones — los contratos de arrendamiento no se registran. OneHome lleva el suyo desde que aparece el anuncio, así que esto se va llenando cuando el precio cambia.")}
          </p>
        )}

        {asking === undefined ? (
          <div className="ow-shimmer h-10 rounded-xl" />
        ) : changes.length === 0 ? (
          <p className="text-[12px] leading-relaxed opacity-55">
            {daysListed != null
              ? W(lang,
                  `Listed ${daysListed === 0 ? "today" : `${daysListed} day${daysListed === 1 ? "" : "s"} ago`} — the price hasn't moved since.`,
                  `Publicado ${daysListed === 0 ? "hoy" : `hace ${daysListed} día${daysListed === 1 ? "" : "s"}`} — el precio no ha cambiado desde entonces.`)
              : W(lang, "No price changes recorded yet.", "Aún no hay cambios de precio registrados.")}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-ink/[0.06] dark:divide-white/[0.08]">
              {changes.map(e => {
                const up = (e.price ?? 0) > (e.previous_price ?? 0);
                return (
                  <li key={e.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="text-[12px] opacity-60">{day(e.occurred_at)}</span>
                    <span className="text-right">
                      <span className="text-[13.5px] font-bold tabular-nums">
                        {e.previous_price != null && (
                          <span className="mr-1.5 font-normal line-through opacity-40">
                            {askingMoney(e.previous_price)}
                          </span>
                        )}
                        {e.price != null ? askingMoney(e.price) : "—"}
                      </span>
                      {e.previous_price != null && e.price != null && (
                        <span className={`ml-1.5 text-[11.5px] font-black ${up ? "text-red-500" : "text-[var(--teal-depth)]"}`}>
                          {up ? "▲" : "▼"}{" "}
                          {Math.abs(Math.round(((e.price - e.previous_price) / e.previous_price) * 100))}%
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {daysListed != null && (
              <p className="mt-1.5 text-[11px] opacity-45">
                {W(lang,
                  `On the market ${daysListed} day${daysListed === 1 ? "" : "s"} · ${changes.length} price change${changes.length === 1 ? "" : "s"}`,
                  `${daysListed} día${daysListed === 1 ? "" : "s"} en el mercado · ${changes.length} cambio${changes.length === 1 ? "" : "s"} de precio`)}
              </p>
            )}
          </>
        )}
      </div>

      {trm && (
        <p className="mt-3 border-t border-ink/[0.06] pt-2 text-[10.5px] leading-relaxed opacity-40 dark:border-white/[0.08]">
          {W(lang,
            `Pesos converted at the official TRM in force ${trm.from} (${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(trm.rate)} COP/USD), certified by the Superintendencia Financiera.`,
            `Pesos convertidos a la TRM oficial vigente desde ${trm.from} (${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(trm.rate)} COP/USD), certificada por la Superintendencia Financiera.`)}
        </p>
      )}
    </section>
  );
}
