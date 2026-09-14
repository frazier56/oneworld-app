import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading, Chevron,
} from "@oneworld/shell";
import ListProperty from "./ListProperty";
import SegmentToggle from "../../shared/SegmentToggle";
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
    if (!hostReadinessChecked) return;
    if (hostReadiness?.profile_ready) setMode("form");
    else nav(productHref("onerental", "/host-profile?return=%2Frentals%2Flist%3Fform%3D1"), { replace: true });
  }, [formParam, editId, hostReadinessChecked, hostReadiness?.profile_ready, nav]);

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
    if (!hostReadinessChecked || !hostReadiness?.profile_ready) {
      nav(productHref("onerental", "/host-profile?return=%2Frentals%2Flist%3Fform%3D1"));
      return;
    }
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
    const [saved, mine, drafts] = await Promise.all([
      supabase.from("saved_items").select("id", { count: "exact", head: true })
        .eq("user_id", userId!).in("item_type", ["rental_property", "sale_property"]),
      supabase.from("rental_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "published"),
      supabase.from("rental_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "draft"),
    ]);
    return { saved: saved.count ?? 0, mine: mine.count ?? 0, drafts: drafts.count ?? 0 };
  }, [userId], !!userId);

  if (mode === "form" && (editId || hostReadiness?.profile_ready)) return <ListProperty onClose={closeForm} editId={editId} />;

  return (
    <div className="space-y-4">
      <ScreenHeading>{W(lang, "Properties", "Inmuebles")}</ScreenHeading>
      <SegmentToggle current="rent" lang={lang} context="manage" />

      {/* Signed-in owners need their portfolio and publishing controls before discovery tools. */}
      <Section label={W(lang, "Your properties", "Sus inmuebles")}>
        <Opt d={P.card} primary={hostReadiness?.profile_ready}
          title={W(lang, "Host profile", "Perfil de anfitrión")}
          sub={!hostReadinessChecked
            ? W(lang, "Checking your listing readiness…", "Revisando si está listo para publicar…")
            : hostReadiness?.profile_ready
              ? W(lang, "Ready · identity, private address and payment route saved.", "Listo · identidad, dirección privada y forma de pago guardadas.")
              : W(lang, "Complete this once before you list a property.", "Complételo una vez antes de publicar un inmueble.")}
          onClick={() => nav(productHref("onerental", "/host-profile"))} />
        <Opt d={P.home} primary
          title={W(lang, "My rental properties", "Mis inmuebles en arriendo")}
          sub={counts && counts.drafts > 0
            ? W(lang, `${counts.mine} live · ${counts.drafts} in draft`,
                      `${counts.mine} publicados · ${counts.drafts} en borrador`)
            : W(lang, "Published, drafts, and what's rented.",
                      "Publicados, borradores, y lo que está arrendado.")}
          badge={counts?.mine || undefined}
          onClick={() => nav(productHref("onerental", "/properties"))} />
        <Opt d={P.rentSign}
          title={W(lang, "List a property for rent", "Publicar en arriendo")}
          sub={W(lang, "Photos, details and pricing — free to list.",
                       "Fotos, detalles y precio — publicar es gratis.")}
          onClick={openForm} />
        <Opt d={P.saleSign}
          title={W(lang, "List a property for sale", "Publicar en venta")}
          sub={W(lang, "Asking price, commission and earnest money.",
                       "Precio, comisión y arras.")}
          onClick={() => nav(productHref("onesale", "/list"))} />
      </Section>

      <Section label={W(lang, "Manage your search", "Administre su búsqueda")}>
        <Opt d={P.heart} primary
          title={W(lang, "Saved properties", "Inmuebles guardados")}
          sub={W(lang, "Everything you've hearted, rent and sale together.",
                       "Todo lo que ha marcado, arriendo y venta juntos.")}
          badge={counts?.saved || undefined}
          onClick={() => nav(productHref("onerental", "/saved"))} />
        <Opt d={P.clock}
          title={W(lang, "Showings & requests", "Visitas y solicitudes")}
          sub={W(lang, "Rental requests and viewing appointments, with their current status.",
                       "Solicitudes de arriendo y citas para visitas, con su estado actual.")}
          onClick={() => nav(productHref("onerental", "/requests"))} />
        {/* Lee, 11 Aug 2026: *"a quick application with a QR code, so all my information would
            just populate. That's how a setup on OneJob."* This is that. */}
        <Opt d={P.card}
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
      </Section>

      {/* ── LISTING ────────────────────────────────────────────────────────────────────────
          Lee: *"list a property for rent or for sale."* Two separate rows rather than one row
          that then asks which — the choice is the thing, so it should be the tap. Rent goes into
          the form as a MODE of this screen; sale is a different section of OneHome and gets a
          real doorway, never a raw href. */}
      <Section label={W(lang, "More tools", "Más herramientas")}>
        {/* ⚠️ THIS LINE PROMISED A DEPOSIT, ON THE ROW A HOST TAPS TO CREATE A LISTING.
            Found in production on 15 August 2026 by clicking the screen rather than reading the
            code. It read: *"Photos, the details, the deposit — then preview it before it goes
            live."*

            OneHome takes no deposit. That was settled on 14 August when OneCover replaced the
            deposit design outright, and every deposit promise was reported stripped in seven
            languages. This one survived, in the highest-traffic place it could have survived —
            the entry point to listing a property. A sweep that is reported complete and is not
            is worse than no sweep, because nobody looks again.

            It is replaced with what the host actually gets, which is a better sentence anyway:
            the listing is free and there is no deposit to arrange. */}
        <Opt d={P.cal}
          title={W(lang, "Calendar", "Calendario")}
          sub={W(lang, "What's booked, and when each place frees up.",
                       "Qué está reservado, y cuándo se libera cada inmueble.")}
          onClick={() => nav(productHref("onerental", "/calendar"))} />
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] opacity-40">{label}</p>
      {children}
    </div>
  );
}

/** QRPay's `Opt`, with a count. One primary per screen — the same rule as everywhere else. */
function Opt({ d, title, sub, primary, badge, onClick }: {
  d: string; title: string; sub: string; primary?: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`ow-tap flex w-full items-center gap-3 rounded-3xl p-4 text-left transition active:scale-[0.99] ${
        primary
          ? "border border-brand/35 bg-gradient-to-br from-brand/15 to-brand/[0.04] shadow-lg shadow-brand/10"
          : "card"}`}>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
        primary ? "bg-brand text-white" : "bg-brand/10 text-brand-deep dark:text-brand-light"}`}>
        <Glyph d={d} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-bold ${primary ? "text-lg" : ""}`}>{title}</span>
        <span className="block text-[12px] leading-snug opacity-55">{sub}</span>
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="shrink-0 rounded-full bg-brand/12 px-2 py-0.5 text-[11.5px] font-black tabular-nums text-brand-deep dark:text-brand-light">
          {badge}
        </span>
      )}
      <Chevron dir="right" className="opacity-40" />
    </button>
  );
}
