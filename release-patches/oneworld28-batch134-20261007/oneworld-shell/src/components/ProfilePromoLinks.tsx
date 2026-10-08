import { useState } from "react";
import { useI18n, W, Wt } from "../lib/i18n";
import { useAsync } from "../lib/useAsync";
import { IconGlobe } from "./ActionIcons";
import {
  getPromoLinks, getPublicPromoLinks, savePromoLink, deletePromoLink,
  detectPlatform, MAX_WEBSITES, type PromoLink,
} from "../lib/promoLinks";

/**
 * PROFILE PROMO LINKS (SHELL) — a person's OWN website + app buttons on their profile.
 * ONEJOB2 overlay 1 (8 Oct 2026), PUB30 polish on top:
 *  - text through `W` (es + co + the runtime dictionary), not a bare `lang === "es"`;
 *  - brand colour picks black or white text by contrast, so a light colour stays readable;
 *  - plain modern glyphs (globe / phone) instead of emoji — Lee, 8 Oct: modern buttons, no
 *    Apple/Google badges, no redrawn logos; the store NAME is the label;
 *  - one App Store + one Google Play per person, max 3 websites — enforced by the database too.
 * `editable` → owner editor; otherwise read-only buttons (renders nothing when there are none).
 */
const HEX = /^#[0-9a-f]{6}$/i;

function readableText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return lum > 0.4 ? "#0B0F1A" : "#FFFFFF";
}

function buttonStyle(hue?: string | null): React.CSSProperties {
  if (!hue || !HEX.test(hue)) return {};
  return { background: hue, color: readableText(hue), borderColor: hue };
}

const IconPhone = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </svg>
);

function LinkButton({ link }: { link: PromoLink }) {
  const label = link.kind === "app"
    ? (link.platform === "ios" ? "App Store" : "Google Play")
    : link.label;
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer nofollow"
       className="inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-xl border border-ink/20 bg-ink/[0.03] px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-105 active:scale-[0.98] dark:border-white/20 dark:bg-white/[0.06]"
       style={buttonStyle(link.hue)}>
      {link.logo_url
        ? <img src={link.logo_url} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
        : (link.kind === "app" ? <IconPhone /> : <IconGlobe size={18} />)}
      <span className="truncate">{label}</span>
    </a>
  );
}

export default function ProfilePromoLinks({ userId, editable = false }: { userId: string; editable?: boolean }) {
  const { lang } = useI18n();
  const [bump, setBump] = useState(0);
  const links = useAsync(
    async () => (editable ? getPromoLinks(userId) : getPublicPromoLinks(userId)),
    [userId, editable, bump], !!userId,
  ) ?? [];

  const websites = links.filter(l => l.kind === "website");
  const apps = links.filter(l => l.kind === "app");

  const [kind, setKind] = useState<"website" | "app">("website");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [hue, setHue] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const mySite = W(lang, "My site", "Mi sitio");

  const add = async () => {
    setErr("");
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) { setErr(W(lang, "Paste a link that starts with https://", "Pega un enlace que empiece con https://")); return; }
    if (kind === "website" && websites.length >= MAX_WEBSITES) { setErr(Wt(lang, "Up to {0} websites.", "Máximo {0} sitios web.", [MAX_WEBSITES])); return; }
    const platform = detectPlatform(u);
    if (kind === "app" && !platform) { setErr(W(lang, "Use the App Store or Google Play link (the Share button).", "Usa el enlace de App Store o Google Play (botón Compartir).")); return; }
    if (kind === "app" && apps.some(a => a.platform === platform)) {
      setErr(platform === "ios"
        ? W(lang, "You already added an App Store link. Remove it first to change it.", "Ya agregaste un enlace de App Store. Quítalo primero para cambiarlo.")
        : W(lang, "You already added a Google Play link. Remove it first to change it.", "Ya agregaste un enlace de Google Play. Quítalo primero para cambiarlo."));
      return;
    }
    setBusy(true);
    const { error } = await savePromoLink(userId, {
      kind, url: u, platform,
      label: kind === "app" ? (platform === "ios" ? "App Store" : "Google Play") : (label.trim() || mySite),
      hue: HEX.test(hue) ? hue : null, position: links.length,
    });
    setBusy(false);
    if (error) { setErr(W(lang, "Couldn't save that link. Try again.", "No se pudo guardar el enlace. Inténtalo de nuevo.")); return; }
    setUrl(""); setLabel(""); setHue(""); setBump(b => b + 1);
  };

  const remove = async (id?: string) => {
    if (!id) return;
    const { error } = await deletePromoLink(userId, id);
    if (error) setErr(W(lang, "Couldn't remove that link. Try again.", "No se pudo quitar el enlace. Inténtalo de nuevo."));
    setBump(b => b + 1);
  };

  const heading = W(lang, "Websites & apps", "Sitios y apps");

  if (!editable) {
    if (!links.length) return null;
    return (
      <section className="card p-4">
        <h2 className="mb-2.5 font-bold">{heading}</h2>
        <div className="flex flex-wrap gap-2">{[...websites, ...apps].map((l, i) => <LinkButton key={l.id ?? i} link={l} />)}</div>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <h2 className="mb-1 font-bold">{heading}</h2>
      <p className="mb-3 text-[12px] opacity-70">
        {W(lang, "Promote your business: up to 3 websites and your app.", "Promociona tu negocio: hasta 3 sitios web y tu app.")}
      </p>

      {!!links.length && (
        <div className="mb-3 space-y-2">
          {[...websites, ...apps].map((l, i) => (
            <div key={l.id ?? i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1"><LinkButton link={l} /></div>
              <button type="button" onClick={() => remove(l.id)} aria-label={W(lang, "Remove", "Quitar")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/20 text-sm opacity-80 hover:opacity-100 dark:border-white/20">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-ink/15 p-3 dark:border-white/15">
        <div className="mb-2 flex gap-2" role="tablist">
          {(["website", "app"] as const).map(k => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setErr(""); }}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${kind === k ? "border-transparent bg-brand text-white" : "border-ink/20 dark:border-white/20"}`}>
              {k === "website" ? W(lang, "Website", "Sitio web") : "App"}
            </button>
          ))}
        </div>

        {kind === "app" && (
          <p className="mb-2 text-[11px] opacity-70">
            {W(lang, "In the App Store or Google Play, tap Share, then Copy link, and paste it here.",
                     "En App Store o Google Play, toca Compartir, luego Copiar enlace, y pégalo aquí.")}
          </p>
        )}

        <input value={url} onChange={e => setUrl(e.target.value)} inputMode="url" type="url" autoComplete="url"
          aria-label={kind === "app" ? W(lang, "App link", "Enlace de la app") : W(lang, "Website link", "Enlace del sitio web")}
          placeholder={kind === "app" ? "https://apps.apple.com/…" : "https://yourbusiness.com"}
          className="mb-2 w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand dark:border-white/20" />

        {kind === "website" && (
          <input value={label} onChange={e => setLabel(e.target.value)} maxLength={40}
            aria-label={W(lang, "Button name", "Nombre del botón")}
            placeholder={W(lang, "Button name (e.g. My bakery)", "Nombre del botón (p. ej. Mi pastelería)")}
            className="mb-2 w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand dark:border-white/20" />
        )}

        <div className="mb-2 flex items-center gap-2">
          <span className="text-[12px] opacity-70">{W(lang, "Brand color", "Color de marca")}</span>
          <input type="color" value={HEX.test(hue) ? hue : "#1E66F5"} onChange={e => setHue(e.target.value)}
            aria-label={W(lang, "Brand color", "Color de marca")}
            className="h-8 w-11 cursor-pointer rounded border border-ink/20 bg-transparent dark:border-white/20" />
          {hue && <button type="button" onClick={() => setHue("")} className="text-[12px] underline opacity-70 hover:opacity-100">{W(lang, "Clear", "Quitar")}</button>}
        </div>

        {url && (
          <div className="mb-2">
            <p className="mb-1 text-[11px] opacity-60">{W(lang, "Preview", "Vista previa")}</p>
            <LinkButton link={{ kind, url, label: label || mySite, platform: detectPlatform(url), hue: HEX.test(hue) ? hue : null }} />
          </div>
        )}

        {err && <p role="alert" className="mb-2 text-[12px] text-red-500">{err}</p>}
        <button type="button" onClick={add} disabled={busy || !url}
          className="min-h-[44px] w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : W(lang, "Add", "Agregar")}
        </button>
      </div>
    </section>
  );
}
