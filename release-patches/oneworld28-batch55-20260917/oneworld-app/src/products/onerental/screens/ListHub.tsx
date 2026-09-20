import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading,
} from "@oneworld/shell";
import ListProperty from "./ListProperty";
import SegmentToggle from "../../shared/SegmentToggle";
import { HubPanel, HubRow, useOnePanel } from "../../shared/HubPanels";
import { completeness } from "../lib/renter";
import { getHostReadiness, type HostReadiness } from "../lib/hostProfile";

/**
 * THE CENTRE TAB — a dashboard first, the form second.
 * ============================================================================================
 * Lee, 11 Aug 2026:
 *
 *   *"On the main home page, you can get rid of the list of property… there's gonna be more people
 *    viewing this app to look for properties than there are for people with listing properties…
 *    this middle button should be more than just listing a property… it should start out with a
 *    more of a dashboard… you can have view my saved properties, my favorites, a property pending,
 *    list a property for rent or for sale, maybe a QR code… a quick application with a QR code, so
 *    all my information would just populate. That's how a setup on one job. So you should look at
 *    it."*
 *
 * ── WHAT ONEJOB ACTUALLY DOES, HAVING NOW READ IT ───────────────────────────────────────────
 * `screens/QRPay.tsx`, line 27:
 *
 *     const [mode, setMode] = useState<"home" | "contract" | "qr">(draftParam ? "contract" : "home");
 *
 * That single line is the whole pattern, and it is the thing this screen was missing. The FORM IS
 * A MODE, not the screen. The centre tab lands on a hub — a readiness strip and a short list of
 * "how do you want to begin?" — and the contract form is one of the things you can begin. A deep
 * link (`?draft=…`) skips straight into it, so the hub never gets in the way of somebody who was
 * already mid-task.
 *
 * OneHome had the form AS the screen. Which meant the tab that four out of five people press
 * because they are looking for somewhere to live opened a 60-field publishing form. Lee's point
 * about the ratio of browsers to listers is the whole argument.
 *
 * Two more rules copied from QRPay rather than reinvented, both of them Lee's own from July:
 *
 *   · A READINESS ROW IS ALWAYS TAPPABLE, INCLUDING ONCE IT IS GREEN. QRPay's comment: *"Done is
 *     not the end of a payment method's life: cards expire, banks change, people want to look."*
 *     So the finished state navigates to the place you'd manage the thing, rather than turning
 *     into a dead ✓ badge that removes the only route in.
 *   · THE ICON IS A COMPONENT, NEVER AN EMOJI. *"An emoji is a different shape on every device,
 *     and this is the screen where a job starts."* Same here — these are inline SVG paths.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────────────────────
 * No metrics. QRPay's comment again: *"No metrics dashboard — that's My Jobs."* The counts on the
 * rows below are a state of play, not analytics; if this screen starts growing charts, they belong
 * on My properties.
 */

/* One path each, drawn at the same weight, so the rows read as a set. */
const P = {
  heart:  "M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.5 2.8c0 5.8-8.5 11.3-8.5 11.3z",
  home:   "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5",
  rentSign: "M4 4h13l3 4-3 4H4z M4 12v8",
  saleSign: "M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
  cal:    "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  clock:  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.5 2",
  card:   "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h2v2h-2z",
  /* ⚠️ THREE ROWS WORE THE SAME QR GLYPH. `card` is a QR code, which is exactly right for the
     renter profile (it HAS a QR) and means nothing on a host profile or on "start another
     listing". An icon set where a third of the rows share one symbol is decoration, not
     navigation. */
  user:   "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20.5c0-3.9 3.4-6.2 7.5-6.2s7.5 2.3 7.5 6.2",
  plus:   "M12 5v14M5 12h14",
};

const Glyph = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split(" M").map((seg, i) => <path key={i} d={i === 0 ? seg : "M" + seg} />)}
  </svg>
);

export default function ListHub() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  /* THE FORM IS A MODE. `?form=1` is the deep link, so "List a place" from anywhere else in the
     app — a share, a bookmark, an empty-state button — still lands straight in the form. */
  const formParam = params.get("form");
  /* `?form=1&edit=<id>` opens the form on an existing listing. One route, one form — the edit
     screen IS the create screen, so they cannot drift apart field by field. */
  const editId = params.get("edit");
  const [mode, setMode] = useState<"home" | "form">(formParam || editId ? "form" : "home");
  const [hostReadiness, setHostReadiness] = useState<HostReadiness | null>(null);
  const [hostReadinessChecked, setHostReadinessChecked] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getHostReadiness()
      .then(value => { if (alive) setHostReadiness(value); })
      .catch(() => { if (alive) setHostReadiness(null); })
      .finally(() => { if (alive) setHostReadinessChecked(true); });
    return () => { alive = false; };
  }, [userId]);
  useEffect(() => {
    if (!(formParam || editId)) return;
    /* Existing listings stay editable. The setup gate applies only before creating a new one. */
    if (editId) { setMode("form"); return; }
    setMode("form"); // Draft entry is available before host readiness; publication is guarded.
  }, [formParam, editId]);

  /* ── v70 · OPENING THE FORM IS A NAVIGATION, NOT A PIECE OF LOCAL STATE ──────────────────
     Lee, for days: *"the first tap does nothing."* Reproduced on the live site — three taps in a
     row did nothing; reload, wait two seconds, one tap, and the form opened.

     Why: `userId` arrives from the session asynchronously, everything on this screen keys off
     it, and when it lands the tree re-renders. A remount resets `mode` to "home" and the tap
     that happened before the session settled is thrown away with it.

     ⚠️ A guard or a delay would only improve the odds. Component state cannot survive a remount.
     The URL can — and this file already documents `?form=1` as its deep link, and `closeForm`
     below already clears it. So the tap writes the parameter, the effect above reads it back,
     and a remount lands exactly where the reader put it. Back works now too, for free. */
  const openForm = () => {
    params.set("form", "1");
    setParams(params);
    setMode("form");          /* immediate, so the screen never waits on a round trip */
  };

  const closeForm = () => {
    setMode("home");
    if (params.get("form") || params.get("edit") || params.get("step")) {
      params.delete("form"); params.delete("edit"); params.delete("step"); setParams(params, { replace: true });
    }
  };

  /* The counts. One batched read, HEAD-only where we only want the number — a dashboard that
     downloads fifty listings to print "3" is a dashboard that costs a second to open. */
  /* One extra read, batched with the counts below rather than a second round trip. */
  const [renterPct, setRenterPct] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    supabase.from("renter_profiles")
      .select("household_size, move_in_from, lease_months, income_band, employment, credit_band, intro")
      .eq("user_id", userId).maybeSingle<any>()
      .then(({ data }) => setRenterPct(data ? Math.round(completeness(data) * 100) : null));
  }, [userId]);

  const counts = useAsync(async () => {
    const [saved, mine, drafts, latestDraft, saleMine, saleDrafts] = await Promise.all([
      supabase.from("saved_items").select("id", { count: "exact", head: true })
        .eq("user_id", userId!).in("item_type", ["rental_property", "sale_property"]),
      supabase.from("rental_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "published"),
      supabase.from("rental_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "draft"),
      /* ── THE UNFINISHED ONE, BY NAME ─────────────────────────────────────────────────────
         Lee, 14 September 2026: *"If you start a listing, you should be able to see it
         somewhere… so you can pick up where you left off, obviously."*

         The counts already knew a draft existed and the tile said "1 in draft" — a number, with
         no way to open it. One more read, batched with the three already here, gets the row
         itself so the tile can be the way back into it. */
      supabase.from("rental_properties").select("id,title,updated_at")
        .eq("agent_id", userId!).eq("status", "draft")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle<{ id: string; title: string | null }>(),
      /* ⚠️ THE SALE PANEL HAS TO SAY SOMETHING WHILE IT IS SHUT. A collapsed panel whose one
         line is a description rather than a number is a panel you have to open to learn
         anything, which defeats the point of collapsing it. Two more HEAD-only counts, in the
         batch that was already going out — no extra round trip. */
      supabase.from("sale_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "published"),
      supabase.from("sale_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "draft"),
    ]);
    return {
      saved: saved.count ?? 0, mine: mine.count ?? 0, drafts: drafts.count ?? 0,
      latestDraft: latestDraft.data ?? null,
      saleMine: saleMine.count ?? 0, saleDrafts: saleDrafts.count ?? 0,
    };
  }, [userId], !!userId);

  /* Collapsed by default, and only one open at a time — both Lee's call. A hub that opens with
     a section already expanded is a hub that has decided for you which of the three you came
     for, and it is wrong two times in three. */
  const panel = useOnePanel<"profile" | "rent" | "sale">();

  if (mode === "form") return <ListProperty onClose={closeForm} editId={editId} />;

  return (
    /* `pb-28` clears the floating tab bar: the last panel's final row sat under it. */
    <div className="space-y-4 pb-28">
      <ScreenHeading>{W(lang, "Properties", "Inmuebles")}</ScreenHeading>
      <SegmentToggle current="rent" lang={lang} context="manage" />

      {/* ── ⚠️ THREE MASTER PANELS, ONE OPEN AT A TIME (Lee, 20 September 2026) ─────────────
          *"My profile should be an actual panel, not a section… you tap on one panel and it
          vertically expands and then you see your two options… you can only have one expanded
          section at a time… That way people see the buttons."*

          v54 shipped this as four flat groups with a heading over each, which is still a wall:
          eleven tiles down a phone screen, and the headings were labels on the wall rather than
          controls. A person opening this tab is in exactly one of three situations — sorting
          themselves out, dealing with what they rent out, dealing with what they are selling —
          and an accordion is that sentence made tappable.

          Calendar and Saved properties moved INTO My profile on his call: *"I think we can group
          everything else under my profile… my host profile, my renter profile, saved properties,
          and calendar."* They are the two rows that belong to the person rather than to either
          portfolio, so "Everything else" — a heading that only ever meant "we could not decide" —
          is gone.

          ⚠️ Every collapsed panel still states its numbers. A panel you must open to find out
          whether anything needs you is a panel that has to be opened every time. */}

      <HubPanel d={P.user} open={panel.open === "profile"} onToggle={() => panel.toggle("profile")}
        title={W(lang, "My profile", "Mi perfil")}
        status={[
          !hostReadinessChecked
            ? W(lang, "Checking…", "Revisando…")
            : hostReadiness?.profile_ready
              ? W(lang, "Host ready", "Anfitrión listo")
              : W(lang, "Host profile unfinished", "Perfil de anfitrión sin terminar"),
          renterPct === null ? W(lang, "renter not started", "arrendatario sin empezar")
            : renterPct >= 100 ? W(lang, "renter complete", "arrendatario completo")
            : W(lang, `renter ${renterPct}% complete`, `arrendatario ${renterPct}% completo`),
        ].join(" · ")}>
        {/* ⚠️ THE TWO PROFILES ARE NOT THE SAME THING, and Lee asked outright whether they were.
            The host profile is what a LANDLORD must complete before publishing: legal identity,
            the private address for notices, and where the rent gets paid. The renter profile is
            what a TENANT shows when applying: who they are, what they earn, references, and the
            QR that fills in an application. One person can hold both, which is exactly why they
            sit together — and why both are now named "My …", so the pair reads as two hats one
            person wears rather than two unrelated records. */}
        <HubRow d={P.user}
          title={W(lang, "My host profile", "Mi perfil de anfitrión")}
          sub={!hostReadinessChecked
            ? W(lang, "Checking your listing readiness…", "Revisando si está listo para publicar…")
            : hostReadiness?.profile_ready
              ? W(lang, "Ready · identity, private address and payment route saved.", "Listo · identidad, dirección privada y forma de pago guardadas.")
              : W(lang, "Complete this once before you list a property.", "Complételo una vez antes de publicar un inmueble.")}
          onClick={() => nav(productHref("onerental", "/host-profile"))} />
        <HubRow d={P.card}
          title={W(lang, "My renter profile", "Mi perfil de arrendatario")}
          sub={renterPct === null
            ? W(lang, "Fill it in once and apply to any place in one tap.",
                      "Complételo una vez y aplique a cualquier inmueble con un toque.")
            : renterPct >= 100
              ? W(lang, "Complete — show your QR at a viewing.",
                        "Completo — muestre su QR en una visita.")
              : W(lang, `${renterPct}% complete — agents answer complete profiles first.`,
                        `${renterPct}% completo — los agentes responden primero a los perfiles completos.`)}
          onClick={() => nav(productHref("onerental", "/renter"))} />
        <HubRow d={P.heart}
          title={W(lang, "Saved properties", "Inmuebles guardados")}
          sub={counts && counts.saved > 0
            ? W(lang, `${counts.saved} saved · rent and sale together.`,
                      `${counts.saved} guardados · arriendo y venta juntos.`)
            : W(lang, "Everything you've hearted, rent and sale together.",
                      "Todo lo que ha marcado, arriendo y venta juntos.")}
          onClick={() => nav(productHref("onerental", "/saved"))} />
        <HubRow d={P.cal}
          title={W(lang, "Calendar", "Calendario")}
          sub={W(lang, "What's booked, and when each place frees up.",
                       "Qué está reservado, y cuándo se libera cada inmueble.")}
          onClick={() => nav(productHref("onerental", "/calendar"))} />
      </HubPanel>

      <HubPanel d={P.home} open={panel.open === "rent"} onToggle={() => panel.toggle("rent")}
        title={W(lang, "My properties for rent", "Mis inmuebles en arriendo")}
        status={!counts
          ? W(lang, "Loading…", "Cargando…")
          : counts.mine === 0 && counts.drafts === 0
            ? W(lang, "Nothing listed yet", "Nada publicado todavía")
            : counts.drafts > 0
              ? W(lang, `${counts.mine} live · ${counts.drafts} in draft`,
                        `${counts.mine} publicados · ${counts.drafts} en borrador`)
              : W(lang, `${counts.mine} live · none in draft`,
                        `${counts.mine} publicados · ninguno en borrador`)}>
        <HubRow d={P.home}
          title={W(lang, "My rental properties", "Mis inmuebles en arriendo")}
          sub={W(lang, "Published, drafts, and what's rented.",
                       "Publicados, borradores, y lo que está arrendado.")}
          onClick={() => nav(productHref("onerental", "/properties"))} />
        <HubRow d={P.rentSign}
          title={counts?.latestDraft
            ? W(lang, "Draft listings", "Borradores")
            : W(lang, "List a property for rent", "Publicar en arriendo")}
          sub={counts?.latestDraft
            ? W(lang,
                `Pick up where you left off — ${counts.latestDraft.title?.trim() || "untitled draft"}`,
                `Retome donde lo dejó — ${counts.latestDraft.title?.trim() || "borrador sin título"}`)
            : W(lang, "Photos, details and pricing — free to list.",
                      "Fotos, detalles y precio — publicar es gratis.")}
          onClick={() => {
            const draft = counts?.latestDraft;
            if (draft) { nav(productHref("onerental", `/list?edit=${draft.id}`)); return; }
            openForm();
          }} />
        {counts?.latestDraft && (
          <HubRow d={P.plus}
            title={W(lang, "Start a different listing", "Empezar otro anuncio")}
            sub={W(lang, "Leaves the draft above untouched.", "El borrador de arriba queda intacto.")}
            onClick={openForm} />
        )}
        {/* Showings and requests are about the places you rent OUT, so they belong here rather
            than under a "manage your search" heading, which is where a TENANT's activity lives. */}
        <HubRow d={P.clock}
          title={W(lang, "Showings & requests", "Visitas y solicitudes")}
          sub={W(lang, "Rental requests and viewing appointments, with their current status.",
                       "Solicitudes de arriendo y citas para visitas, con su estado actual.")}
          onClick={() => nav(productHref("onerental", "/requests"))} />
      </HubPanel>

      <HubPanel d={P.saleSign} open={panel.open === "sale"} onToggle={() => panel.toggle("sale")}
        title={W(lang, "My properties for sale", "Mis inmuebles en venta")}
        status={!counts
          ? W(lang, "Loading…", "Cargando…")
          : counts.saleMine === 0 && counts.saleDrafts === 0
            ? W(lang, "Nothing listed yet", "Nada publicado todavía")
            : counts.saleDrafts > 0
              ? W(lang, `${counts.saleMine} live · ${counts.saleDrafts} in draft`,
                        `${counts.saleMine} publicados · ${counts.saleDrafts} en borrador`)
              : W(lang, `${counts.saleMine} live · none in draft`,
                        `${counts.saleMine} publicados · ninguno en borrador`)}>
        <HubRow d={P.home}
          title={W(lang, "My sale listings", "Mis anuncios en venta")}
          sub={W(lang, "Published and draft listings on the for-sale side.",
                       "Anuncios publicados y borradores del lado de venta.")}
          onClick={() => nav(productHref("onesale", "/properties"))} />
        <HubRow d={P.saleSign}
          title={W(lang, "List a property for sale", "Publicar en venta")}
          sub={W(lang, "Asking price, commission and earnest money.",
                       "Precio, comisión y arras.")}
          onClick={() => nav(productHref("onesale", "/list"))} />
      </HubPanel>

    </div>
  );
}
