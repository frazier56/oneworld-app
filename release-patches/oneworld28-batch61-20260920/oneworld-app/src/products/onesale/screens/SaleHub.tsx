import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading,
} from "@oneworld/shell";
import ListProperty from "./ListProperty";
import SegmentToggle from "../../shared/SegmentToggle";
import { HubPanel, HubRow, useOnePanel } from "../../shared/HubPanels";

/**
 * THE CENTRE TAB ON THE SALE SIDE — the twin of OneRental's ListHub, which this product never had.
 * ============================================================================================
 * Lee, 15 August 2026, pressing the raised centre button on the for-sale side:
 *
 *   *"We have to fix the main button — the fifth button that sticks up in the middle is supposed
 *   to take you to like a dashboard, but it's just taking to this list of property, and you don't
 *   even know which. That button is broken right now."*
 *
 * It is not broken; it is missing. `onesale/routes.tsx` mounted the 60-field publishing form
 * DIRECTLY on `/sales/list`, with a comment saying as much: *"this product has no hub, so the
 * query string is read in a tiny wrapper below."* So the tab that most people press because they
 * are looking for somewhere to buy opened a form for selling — the exact defect Lee corrected on
 * the rent side on 11 August, still standing here four days later.
 *
 * ── THE PATTERN, UNCHANGED FROM THE RENT HUB AND FROM ONEJOB'S QRPay ────────────────────────
 * **The form is a MODE, not the screen.** `?form=1` deep-links straight into it, so every "List a
 * property" button elsewhere in the app — including the rent hub's own — still lands where it
 * always did and nothing that pointed at `/sales/list` breaks. `?edit=<id>` opens an existing
 * listing in the same form, because the edit screen IS the create screen and two of them drift
 * field by field.
 *
 * ── AND WHY THE ROWS ARE NOT A COPY OF THE RENT HUB'S ───────────────────────────────────────
 * Lee's twin rule is that the same thing should look the same — not that different things should
 * pretend to be the same. A buyer has no renter profile and no QR to show at a viewing; what a
 * buyer has is a shortlist, viewings booked, and the registry history that is this product's
 * whole reason to exist. Same shape, same weights, same one-primary-per-screen rule. Different
 * nouns, because the nouns are genuinely different.
 */

/* One path each, drawn at the same weight, so the rows read as a set. Shared vocabulary with the
   rent hub deliberately — `heart` is saved on both sides, `home` is my listings on both. */
const P = {
  heart:  "M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.5 2.8c0 5.8-8.5 11.3-8.5 11.3z",
  home:   "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5",
  saleSign: "M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
  rentSign: "M4 4h13l3 4-3 4H4z M4 12v8",
  clock:  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.5 2",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v4h4 M12 7.5V12l3.5 2",
  docs:   "M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v5h5",
  user:   "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20.5c0-3.9 3.4-6.2 7.5-6.2s7.5 2.3 7.5 6.2",
};

const Glyph = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split(" M").map((seg, i) => <path key={i} d={i === 0 ? seg : "M" + seg} />)}
  </svg>
);

export default function SaleHub() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const formParam = params.get("form");
  const editId = params.get("edit");
  const [mode, setMode] = useState<"home" | "form">(formParam || editId ? "form" : "home");
  useEffect(() => { if (formParam || editId) setMode("form"); }, [formParam, editId]);

  const closeForm = () => {
    setMode("home");
    if (params.get("form") || params.get("edit")) {
      params.delete("form"); params.delete("edit"); setParams(params, { replace: true });
    }
  };

  /* HEAD-only counts. A dashboard that downloads fifty listings to print "3" is a dashboard that
     costs a second to open — the rent hub's rule, and the reason it opens instantly. */
  const counts = useAsync(async () => {
    const [saved, mine, drafts, rentMine, rentDrafts] = await Promise.all([
      supabase.from("saved_items").select("id", { count: "exact", head: true })
        .eq("user_id", userId!).in("item_type", ["rental_property", "sale_property"]),
      supabase.from("sale_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "published"),
      supabase.from("sale_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "draft"),
      /* The rent panel states its numbers here too — same reasoning as the sale panel on the
         rent hub. A collapsed panel that cannot say whether anything needs you gets opened
         every time, which is the wall the accordion was meant to remove. */
      supabase.from("rental_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "published"),
      supabase.from("rental_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "draft"),
    ]);
    return { saved: saved.count ?? 0, mine: mine.count ?? 0, drafts: drafts.count ?? 0,
             rentMine: rentMine.count ?? 0, rentDrafts: rentDrafts.count ?? 0 };
  }, [userId], !!userId);

  /* Same accordion, same three names, same one-open-at-a-time rule as the rent hub — the whole
     point of Lee's correction was that the toggle must not rename the categories under you. */
  const panel = useOnePanel<"profile" | "sale" | "rent">();

  if (mode === "form") return <ListProperty onClose={closeForm} editId={editId} />;

  return (
    <div className="space-y-4 pb-28">
      <ScreenHeading>{W(lang, "Properties", "Inmuebles")}</ScreenHeading>
      <SegmentToggle current="sale" lang={lang} context="manage" />

      {/* ── ⚠️ THE SAME THREE PANELS AS THE RENT HUB (Lee, 20 September 2026) ──────────────
          This screen and `onerental/ListHub` are one tap apart, so anything true about the
          layout of one has to be true of the other or the toggle becomes a redesign. Both are
          now My profile / My properties for … / My properties for … , collapsed, one open at a
          time, master panels solid and child rows translucent. See `shared/HubPanels.tsx` for
          why the weights run that way round. Only the ORDER differs: on the selling side the
          sale panel comes first, because that is the side you chose. */}

      <HubPanel d={P.user} open={panel.open === "profile"} onToggle={() => panel.toggle("profile")}
        title={W(lang, "My profile", "Mi perfil")}
        status={counts && counts.saved > 0
          ? W(lang, `${counts.saved} saved`, `${counts.saved} guardados`)
          : W(lang, "Nothing saved yet", "Nada guardado todavía")}>
        <HubRow d={P.heart}
          title={W(lang, "Saved properties", "Inmuebles guardados")}
          sub={counts && counts.saved > 0
            ? W(lang, `${counts.saved} saved · sale and rent together.`,
                      `${counts.saved} guardados · venta y arriendo juntos.`)
            : W(lang, "Everything you've hearted, sale and rent together.",
                      "Todo lo que ha marcado, venta y arriendo juntos.")}
          onClick={() => nav(productHref("onerental", "/saved"))} />
        <HubRow d={P.clock}
          title={W(lang, "Viewings", "Visitas")}
          sub={W(lang, "Viewings you've asked for, and where each one stands.",
                       "Visitas que ha solicitado, y en qué va cada una.")}
          onClick={() => nav(productHref("onerental", "/alerts"))} />
      </HubPanel>

      <HubPanel d={P.saleSign} open={panel.open === "sale"} onToggle={() => panel.toggle("sale")}
        title={W(lang, "My properties for sale", "Mis inmuebles en venta")}
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
          title={W(lang, "My sale listings", "Mis anuncios en venta")}
          sub={W(lang, "Published, drafts, and what's under offer.",
                       "Publicados, borradores, y lo que está en negociación.")}
          onClick={() => nav(productHref("onesale", "/properties"))} />
        <HubRow d={P.saleSign}
          title={W(lang, "List a property for sale", "Publicar en venta")}
          sub={W(lang, "Asking price, commission and earnest money — preview it before it goes live.",
                       "Precio, comisión y arras — con vista previa antes de publicar.")}
          onClick={() => setMode("form")} />
        <HubRow d={P.docs}
          title={W(lang, "Documents", "Documentos")}
          sub={W(lang, "Every paper for a sale in one place, for you and your attorney.",
                       "Todos los papeles de una venta en un solo lugar, para usted y su abogado.")}
          onClick={() => nav(productHref("onesale", "/properties"))} />
        {/* The thing this product exists for. It is about SALE PRICES, so it belongs to the sale
            panel rather than to a browsing heading of its own. */}
        <HubRow d={P.history}
          title={W(lang, "What places actually sold for", "Por cuánto se vendieron")}
          sub={W(lang,
            "Colombia has no public record of it. Every listing here carries its registry chain.",
            "Colombia no tiene un registro público de eso. Cada anuncio aquí lleva su cadena registral.")}
          onClick={() => nav(productHref("onesale", ""))} />
      </HubPanel>

      <HubPanel d={P.rentSign} open={panel.open === "rent"} onToggle={() => panel.toggle("rent")}
        title={W(lang, "My properties for rent", "Mis inmuebles en arriendo")}
        status={!counts
          ? W(lang, "Loading…", "Cargando…")
          : counts.rentMine === 0 && counts.rentDrafts === 0
            ? W(lang, "Nothing listed yet", "Nada publicado todavía")
            : counts.rentDrafts > 0
              ? W(lang, `${counts.rentMine} live · ${counts.rentDrafts} in draft`,
                        `${counts.rentMine} publicados · ${counts.rentDrafts} en borrador`)
              : W(lang, `${counts.rentMine} live · none in draft`,
                        `${counts.rentMine} publicados · ninguno en borrador`)}>
        <HubRow d={P.home}
          title={W(lang, "My rental properties", "Mis inmuebles en arriendo")}
          sub={W(lang, "Published rentals, drafts, and move-in evidence.",
                       "Arriendos publicados, borradores y evidencia de ingreso.")}
          onClick={() => nav(productHref("onerental", "/properties"))} />
        <HubRow d={P.rentSign}
          title={W(lang, "List a property for rent", "Publicar en arriendo")}
          sub={W(lang, "Photos, the details, and how the letting is secured.",
                       "Fotos, los detalles, y cómo se garantiza el arriendo.")}
          onClick={() => nav(productHref("onerental", "/list?form=1"))} />
      </HubPanel>

    </div>
  );
}
