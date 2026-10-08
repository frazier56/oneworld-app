import { useEffect, useRef, useState } from "react";
import { useI18n, W, Wt } from "../lib/i18n";
import { useAsync } from "../lib/useAsync";
import { supabase } from "../lib/supabase";
import {
  getPromoLinks, getPublicPromoLinks, savePromoLink, deletePromoLink,
  detectPlatform, normalizeUrl, MAX_WEBSITES, type PromoLink, type Platform,
} from "../lib/promoLinks";

/**
 * PROFILE PROMO LINKS (SHELL) — a person's own website + app buttons on their profile.
 * ONEJOB2 overlays 1 + 2, merged by PUB30 (8 Oct 2026) with TESTING's four findings fixed.
 *
 * Lee's design (8 Oct): CENTERED "V2" buttons, all the same size, outline + coloured glyph +
 * label, One World glass (translucent, blur, subtle shadow). The brand colour must SHOW — it
 * colours the outline and the glyph. Colour is chosen from in-app swatches, never the OS dialog.
 * Addresses take https:// silently (normalizeUrl). Website: your own logo as the face, else a
 * globe + the name. Apps: App Store and Google Play (Android robot) glyphs.
 *
 * Store glyphs: we do NOT draw Apple's or Google's marks. StoreGlyph uses the official files
 * when they are present at /brand/stores/app-store.svg and /brand/stores/android-robot.svg
 * (tinted with the brand colour through a CSS mask) and a plain phone glyph until then.
 *
 * TESTING, 8 Oct 2:50 AM: (1) colour ignored in preview → swatches + outline tint, verified in
 * preview and public view; (2) an unknown app address previewed as "Google Play" → unknown stays
 * unknown, no preview, a hint instead; (3) Add stayed live at 3 websites → disabled with the reason
 * shown before the tap.
 */
const HUE_SWATCHES = ["#2563EB", "#14B8A6", "#9258E8", "#E2711D", "#17A45C", "#E11D48", "#0EA5E9", "#F59E0B"];
const HEX = /^#[0-9a-f]{6}$/i;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const base = () => ((import.meta as any).env?.BASE_URL ?? "/") as string;
const STORE_FILE: Record<Platform, string> = { ios: "brand/stores/app-store.svg", android: "brand/stores/android-robot.svg" };
const storeFileOk: Partial<Record<Platform, boolean>> = {};

function useStoreFile(platform?: Platform | null): string | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (!platform || platform in storeFileOk) return;
    const img = new Image();
    img.onload = () => { storeFileOk[platform] = true; force(n => n + 1); };
    img.onerror = () => { storeFileOk[platform] = false; force(n => n + 1); };
    img.src = base() + STORE_FILE[platform];
  }, [platform]);
  return platform && storeFileOk[platform] ? base() + STORE_FILE[platform] : null;
}

const Globe = ({ color }: { color?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"}
    strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </svg>
);
const Phone = ({ color }: { color?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"}
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" />
  </svg>
);
function StoreGlyph({ platform, color }: { platform?: Platform | null; color?: string }) {
  const file = useStoreFile(platform);
  if (!file) return <Phone color={color} />;
  return <span aria-hidden="true" className="inline-block h-5 w-5 shrink-0"
    style={{ background: color || "currentColor", WebkitMask: `url(${file}) center / contain no-repeat`, mask: `url(${file}) center / contain no-repeat` }} />;
}

const storeLabel = (p?: Platform | null) => (p === "ios" ? "App Store" : p === "android" ? "Google Play" : "App");

function LinkButton({ link }: { link: PromoLink }) {
  const tint = link.hue && HEX.test(link.hue) ? link.hue : undefined;
  const label = link.kind === "app" ? storeLabel(link.platform) : link.label;
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer nofollow"
       className="ow-edge flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border bg-white/60 px-4 text-sm font-semibold shadow-[0_1px_2px_rgba(11,15,26,0.06),0_4px_14px_rgba(11,15,26,0.06)] backdrop-blur-md transition hover:brightness-105 active:scale-[0.99] dark:bg-white/[0.06] dark:shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
       style={tint ? { borderColor: tint, borderWidth: 1.5 } : undefined}>
      {link.kind === "app"
        ? <StoreGlyph platform={link.platform} color={tint} />
        : (link.logo_url
            ? <img src={link.logo_url} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
            : <Globe color={tint} />)}
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
  const ordered = [...websites, ...apps];

  const [kind, setKind] = useState<"website" | "app">("website");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [hue, setHue] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Unnamed website → its own address ("panaderia.co"), not a repeated "My site". */
  const siteName = (u: string) => { try { return new URL(u).hostname.replace(/^www\./i, "").slice(0, 40); } catch { return ""; } };
  const previewUrl = normalizeUrl(url);
  const mySite = siteName(previewUrl) || W(lang, "My site", "Mi sitio");
  const looksValid = /^https?:\/\/[^.\s/]+\.[^.\s/]/.test(previewUrl);
  const platform = detectPlatform(previewUrl);
  const websitesFull = kind === "website" && websites.length >= MAX_WEBSITES;
  const storeTaken = kind === "app" && !!platform && apps.some(a => a.platform === platform);
  const unknownApp = kind === "app" && looksValid && !platform;
  const canAdd = !busy && looksValid && !websitesFull && !storeTaken && !unknownApp;

  const uploadLogo = async (f: File) => {
    setHint("");
    if (!LOGO_TYPES.includes(f.type)) { setHint(W(lang, "Use a PNG, JPG or WebP image.", "Usa una imagen PNG, JPG o WebP.")); return; }
    if (f.size > LOGO_MAX_BYTES) { setHint(W(lang, "That image is over 2 MB. Try a smaller one.", "Esa imagen pesa más de 2 MB. Prueba una más pequeña.")); return; }
    setBusy(true);
    try {
      const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/promo-logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, f, { contentType: f.type, upsert: false });
      if (error) setHint(W(lang, "Couldn't upload the logo. Try again.", "No se pudo subir el logo. Inténtalo de nuevo."));
      else setLogoUrl(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
    } catch { setHint(W(lang, "Couldn't upload the logo. Try again.", "No se pudo subir el logo. Inténtalo de nuevo.")); }
    setBusy(false);
  };

  const add = async () => {
    if (!canAdd) return;
    setHint(""); setBusy(true);
    const { error } = await savePromoLink(userId, {
      kind, url: previewUrl, platform: kind === "app" ? platform : null,
      label: kind === "app" ? storeLabel(platform) : (label.trim() || mySite),
      hue: HEX.test(hue) ? hue : null, logo_url: kind === "website" ? (logoUrl || null) : null,
      position: links.length,
    });
    setBusy(false);
    if (error) { setHint(W(lang, "Couldn't save that link. Try again.", "No se pudo guardar el enlace. Inténtalo de nuevo.")); return; }
    setUrl(""); setLabel(""); setHue(""); setLogoUrl(""); setBump(b => b + 1);
  };

  const remove = async (id?: string) => {
    if (!id) return;
    const { error } = await deletePromoLink(userId, id);
    if (error) setHint(W(lang, "Couldn't remove that link. Try again.", "No se pudo quitar el enlace. Inténtalo de nuevo."));
    setBump(b => b + 1);
  };

  const heading = W(lang, "Websites & apps", "Sitios y apps");

  if (!editable) {
    if (!links.length) return null;
    return (
      <section className="card p-4">
        <h2 className="mb-2.5 font-bold">{heading}</h2>
        <div className="grid gap-2">{ordered.map((l, i) => <LinkButton key={l.id ?? i} link={l} />)}</div>
      </section>
    );
  }

  /* Why Add is off, said BEFORE the tap (TESTING finding 3). */
  const blocked = websitesFull
    ? Wt(lang, "You have {0} websites, the most allowed. Remove one to add another.", "Tienes {0} sitios, el máximo. Quita uno para agregar otro.", [MAX_WEBSITES])
    : storeTaken
      ? (platform === "ios"
          ? W(lang, "You already have an App Store button. Remove it to change it.", "Ya tienes un botón de App Store. Quítalo para cambiarlo.")
          : W(lang, "You already have a Google Play button. Remove it to change it.", "Ya tienes un botón de Google Play. Quítalo para cambiarlo."))
      : unknownApp
        ? W(lang, "Use the App Store or Google Play link.", "Usa el enlace de App Store o Google Play.")
        : "";

  const field = "ow-edge mb-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand";
  const ringOn = "ring-2 ring-offset-2 ring-ink/50 ring-offset-paper dark:ring-white/70 dark:ring-offset-ink";

  return (
    <section className="card p-4">
      <h2 className="mb-1 font-bold">{heading}</h2>
      <p className="mb-3 text-[12px] opacity-70">{W(lang, "Add up to 3 websites and your app.", "Agrega hasta 3 sitios web y tu app.")}</p>

      {!!links.length && (
        <div className="mb-3 grid gap-2">
          {ordered.map((l, i) => (
            <div key={l.id ?? i} className="flex items-center gap-2">
              <div className="min-w-0 flex-1"><LinkButton link={l} /></div>
              <button type="button" onClick={() => remove(l.id)} aria-label={W(lang, "Remove", "Quitar")}
                className="ow-edge grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm opacity-80 hover:opacity-100">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="ow-edge rounded-2xl border p-3">
        <div className="mb-2 flex gap-2" role="tablist">
          {(["website", "app"] as const).map(k => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setHint(""); }}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${kind === k ? "border-transparent bg-brand text-white" : "ow-edge"}`}>
              {k === "website" ? W(lang, "Website", "Sitio web") : "App"}
            </button>
          ))}
        </div>

        {kind === "app" && (
          <p className="mb-2 text-[11px] opacity-70">{W(lang, "In the store, tap Share, then Copy link, and paste it here.", "En la tienda, toca Compartir, luego Copiar enlace, y pégalo aquí.")}</p>
        )}

        {websitesFull ? null : <>
        <input value={url} onChange={e => { setUrl(e.target.value); setHint(""); }} inputMode="url" autoComplete="url"
          autoCapitalize="none" spellCheck={false}
          aria-label={kind === "app" ? W(lang, "App link", "Enlace de la app") : W(lang, "Website address", "Dirección del sitio web")}
          placeholder={kind === "app" ? "apps.apple.com/…" : "yourbusiness.com"} className={field} />

        {kind === "website" && (
          <>
            <input value={label} onChange={e => setLabel(e.target.value)} maxLength={40}
              aria-label={W(lang, "Button name", "Nombre del botón")}
              placeholder={W(lang, "Button name (e.g. My bakery)", "Nombre del botón (p. ej. Mi pastelería)")} className={field} />
            <div className="mb-2 flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                className="ow-edge min-h-[40px] rounded-lg border px-3 text-xs font-semibold disabled:opacity-50">
                {logoUrl ? W(lang, "Change logo", "Cambiar logo") : W(lang, "Upload logo", "Subir logo")}
              </button>
              {logoUrl
                ? <><img src={logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                    <button type="button" onClick={() => setLogoUrl("")} className="text-[12px] underline opacity-70">{W(lang, "Remove", "Quitar")}</button></>
                : <span className="text-[11px] opacity-60">{W(lang, "Optional", "Opcional")}</span>}
              <input ref={fileRef} type="file" accept={LOGO_TYPES.join(",")} hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.currentTarget.value = ""; }} />
            </div>
          </>
        )}

        <div className="mb-2">
          <p className="mb-1.5 text-[11px] opacity-70">{W(lang, "Brand color", "Color de marca")}</p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))", maxWidth: 324 }} role="radiogroup" aria-label={W(lang, "Brand color", "Color de marca")}>
            {HUE_SWATCHES.map(c => (
              <button key={c} type="button" role="radio" aria-checked={hue === c} onClick={() => setHue(c)} aria-label={c}
                className={`aspect-square w-full rounded-full transition ${hue === c ? ringOn : ""}`} style={{ background: c }} />
            ))}
            <button type="button" role="radio" aria-checked={hue === ""} onClick={() => setHue("")} aria-label={W(lang, "No color", "Sin color")}
              className={`ow-edge grid aspect-square w-full place-items-center rounded-full border text-[11px] ${hue === "" ? ringOn : ""}`}>✕</button>
          </div>
        </div>

        {looksValid && !unknownApp && (
          <div className="mb-2">
            <p className="mb-1 text-[11px] opacity-60">{W(lang, "Preview", "Vista previa")}</p>
            <LinkButton link={{ kind, url: previewUrl, label: label.trim() || mySite, platform: kind === "app" ? platform : null,
              hue: HEX.test(hue) ? hue : null, logo_url: kind === "website" ? (logoUrl || null) : null }} />
          </div>
        )}
        </>}

        {(blocked || hint) && <p role="status" className="mb-2 text-[12px] opacity-80">{blocked || hint}</p>}
        {!websitesFull && <button type="button" onClick={add} disabled={!canAdd}
          className="min-h-[44px] w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : W(lang, "Add", "Agregar")}
        </button>}
      </div>
    </section>
  );
}
