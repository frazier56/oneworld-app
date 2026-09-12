import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading, Chevron,
} from "@oneworld/shell";
import ListProperty from "./ListProperty";
import SegmentToggle from "../../shared/SegmentToggle";

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
    const [saved, mine, drafts] = await Promise.all([
      supabase.from("saved_items").select("id", { count: "exact", head: true })
        .eq("user_id", userId!).in("item_type", ["rental_property", "sale_property"]),
      supabase.from("sale_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "published"),
      supabase.from("sale_properties").select("id", { count: "exact", head: true })
        .eq("agent_id", userId!).eq("status", "draft"),
    ]);
    return { saved: saved.count ?? 0, mine: mine.count ?? 0, drafts: drafts.count ?? 0 };
  }, [userId], !!userId);

  if (mode === "form") return <ListProperty onClose={closeForm} editId={editId} />;

  return (
    <div className="space-y-4">
      <ScreenHeading>{W(lang, "Properties", "Inmuebles")}</ScreenHeading>
      <SegmentToggle current="sale" lang={lang} context="manage" />

      {/* ── LOOKING ────────────────────────────────────────────────────────────────────────
          First, for the same reason as on the rent side: far more people open this tab to find
          somewhere than to list somewhere. */}
      <Section label={W(lang, "You're looking", "Está buscando")}>
        <Opt d={P.heart} primary
          title={W(lang, "Saved properties", "Inmuebles guardados")}
          sub={W(lang, "Everything you've hearted, sale and rent together.",
                       "Todo lo que ha marcado, venta y arriendo juntos.")}
          badge={counts?.saved || undefined}
          onClick={() => nav(productHref("onerental", "/saved"))} />
        <Opt d={P.clock}
          title={W(lang, "Viewings", "Visitas")}
          sub={W(lang, "Viewings you've asked for, and where each one stands.",
                       "Visitas que ha solicitado, y en qué va cada una.")}
          onClick={() => nav(productHref("onerental", "/alerts"))} />
        {/* The thing this product exists for, and the row a buyer should be one tap from. */}
        <Opt d={P.history}
          title={W(lang, "What places actually sold for", "Por cuánto se vendieron")}
          sub={W(lang,
            "Colombia has no public record of it. Every listing here carries its registry chain.",
            "Colombia no tiene un registro público de eso. Cada anuncio aquí lleva su cadena registral.")}
          onClick={() => nav(productHref("onesale", ""))} />
      </Section>

      {/* ── LISTING ──────────────────────────────────────────────────────────────────────── */}
      <Section label={W(lang, "You're selling", "Está vendiendo")}>
        <Opt d={P.saleSign}
          title={W(lang, "List a property for sale", "Publicar en venta")}
          sub={W(lang, "Asking price, commission and earnest money — preview it before it goes live.",
                       "Precio, comisión y arras — con vista previa antes de publicar.")}
          onClick={() => setMode("form")} />
        <Opt d={P.home}
          title={W(lang, "My listings for sale", "Mis anuncios en venta")}
          sub={counts && counts.drafts > 0
            ? W(lang, `${counts.mine} live · ${counts.drafts} in draft`,
                      `${counts.mine} publicados · ${counts.drafts} en borrador`)
            : W(lang, "Published, drafts, and what's under offer.",
                      "Publicados, borradores, y lo que está en negociación.")}
          badge={counts?.mine || undefined}
          onClick={() => nav(productHref("onesale", "/properties"))} />
        <Opt d={P.docs}
          title={W(lang, "Documents", "Documentos")}
          sub={W(lang, "Every paper for a sale in one place, for you and your attorney.",
                       "Todos los papeles de una venta en un solo lugar, para usted y su abogado.")}
          onClick={() => nav(productHref("onesale", "/properties"))} />
      </Section>

      <Section label={W(lang, "You're renting", "Está arrendando")}>
        <Opt d={P.home}
          title={W(lang, "My listings for rent", "Mis anuncios en arriendo")}
          sub={W(lang, "Published rentals, drafts, and move-in evidence.",
                       "Arriendos publicados, borradores y evidencia de ingreso.")}
          onClick={() => nav(productHref("onerental", "/properties"))} />
        <Opt d={P.rentSign}
          title={W(lang, "List a property for rent", "Publicar en arriendo")}
          sub={W(lang, "Photos, the details, and how the letting is secured.",
                       "Fotos, los detalles, y cómo se garantiza el arriendo.")}
          onClick={() => nav(productHref("onerental", "/list?form=1"))} />
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

/** The rent hub's `Opt`, character for character. One primary per screen. */
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
