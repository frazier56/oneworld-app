import { ScreenHeading } from "@oneworld/shell";
import { useState } from "react";
import { useI18n, useOneId, useAsync, supabase, W } from "@oneworld/shell";
import BrandIcon from "../shared/BrandIcon";
import { scoreDelta, type AssetClass, type ProofLevel } from "./calculator";
import { useScoreData } from "./useScoreData";

/**
 * /onescore/connect — TAB 2: "Connect your world."
 * ============================================================================================
 * The layout Lee approved on the standalone build, rebuilt on the shared shell and LIVE data:
 * a tile GRID of platforms in sections, tap a tile → an inline add form right below its row,
 * your connected accounts pinned at the top with honest proof labels. OneScore connects ALL
 * credibility — social AND reviews AND marketplaces AND credentials — that is the split with
 * OneSocial (true social media only). Rappi · DiDi · Uber are here on purpose: credibility is
 * global, and Colombia is a launch market.
 *
 * Writes go through the guarded `claim_platform_asset` RPC (proof pinned to self-reported —
 * a client can never award itself a stronger proof) and are READ BACK before the tile turns
 * on. Stronger verification (sign into the platform, code challenge, attestation) is the
 * provider rollout, labelled honestly.
 */
type Plat = { id: string; label: string; cls: AssetClass; ph: { en: string; es: string } };

const SOCIAL: Plat[] = [
  { id: "instagram", label: "Instagram", cls: "audience", ph: { en: "@yourname", es: "@tunombre" } },
  { id: "tiktok", label: "TikTok", cls: "audience", ph: { en: "@yourname", es: "@tunombre" } },
  { id: "youtube", label: "YouTube", cls: "audience", ph: { en: "Channel handle or link", es: "Canal o enlace" } },
  { id: "x", label: "X (Twitter)", cls: "audience", ph: { en: "@yourname", es: "@tunombre" } },
  { id: "facebook", label: "Facebook", cls: "audience", ph: { en: "Page or profile link", es: "Enlace de página o perfil" } },
  { id: "linkedin", label: "LinkedIn", cls: "presence", ph: { en: "linkedin.com/in/yourname", es: "linkedin.com/in/tunombre" } },
  { id: "threads", label: "Threads", cls: "audience", ph: { en: "@yourname", es: "@tunombre" } },
  { id: "github", label: "GitHub", cls: "presence", ph: { en: "github.com/yourname", es: "github.com/tunombre" } },
  { id: "snapchat", label: "Snapchat", cls: "audience", ph: { en: "@yourname", es: "@tunombre" } },
  { id: "twitch", label: "Twitch", cls: "audience", ph: { en: "twitch.tv/yourname", es: "twitch.tv/tunombre" } },
];

const REVIEWS: Plat[] = [
  { id: "google", label: "Google Reviews", cls: "reviews", ph: { en: "Business profile link", es: "Enlace del negocio" } },
  { id: "bbb", label: "Better Business Bureau", cls: "reviews", ph: { en: "BBB business page link", es: "Enlace de página BBB" } },
  { id: "trustpilot", label: "Trustpilot", cls: "reviews", ph: { en: "Company page link", es: "Enlace de la empresa" } },
  { id: "yelp", label: "Yelp", cls: "reviews", ph: { en: "Business page link", es: "Enlace del negocio" } },
  { id: "upwork", label: "Upwork", cls: "paid_work", ph: { en: "Profile link", es: "Enlace de perfil" } },
  { id: "fiverr", label: "Fiverr", cls: "paid_work", ph: { en: "Profile link", es: "Enlace de perfil" } },
  { id: "airbnb", label: "Airbnb", cls: "reviews", ph: { en: "Listing or host link", es: "Enlace de anfitrión" } },
  { id: "zillow", label: "Zillow (agents)", cls: "reviews", ph: { en: "Agent profile link", es: "Enlace de agente" } },
  { id: "uber", label: "Uber", cls: "paid_work", ph: { en: "Driver/courier — screenshot later", es: "Conductor — captura después" } },
  { id: "rappi", label: "Rappi", cls: "paid_work", ph: { en: "Rappi profile", es: "Perfil de Rappi" } },
  { id: "didi", label: "DiDi", cls: "paid_work", ph: { en: "DiDi profile", es: "Perfil de DiDi" } },
  { id: "website", label: "Your website", cls: "presence", ph: { en: "yoursite.com", es: "tusitio.com" } },
];

const PROOF_LABEL: Record<ProofLevel, { en: string; es: string }> = {
  self_asserted: { en: "Self-reported", es: "Auto-declarado" },
  handle_match: { en: "Handle matched", es: "Usuario verificado" },
  code_challenge: { en: "Code-verified", es: "Verificado por código" },
  oauth: { en: "Account-verified", es: "Cuenta verificada" },
  attested: { en: "Attested", es: "Certificado" },
};

type Held = { id: string; platform: string; asset_class: string; proof_level: ProofLevel; handle: string | null };

export default function ConnectScreen() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const { input, loaded } = useScoreData();
  const [bump, setBump] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const held = useAsync(async () => {
    const { data } = await supabase.from("verified_assets")
      .select("id, platform, asset_class, proof_level, handle")
      .eq("user_id", userId!).is("revoked_at", null);
    return (data ?? []) as Held[];
  }, [userId, bump], !!userId);

  const heldFor = (pid: string) => (held ?? []).find(h => h.platform === pid);

  const add = async (p: Plat) => {
    if (!userId || busy || !handle.trim()) return;
    setBusy(true); setErr(null);
    const { data: newId, error } = await supabase.rpc("claim_platform_asset", {
      p_platform: p.id, p_class: p.cls, p_handle: handle.trim(),
    });
    /* Read the write back before the tile turns on. */
    const { data: check } = error ? { data: null } : await supabase.from("verified_assets")
      .select("id").eq("id", newId).maybeSingle();
    if (error || !check) setErr(p.id);
    setBusy(false); setOpen(null); setHandle(""); setBump(b => b + 1);
  };

  const remove = async (h: Held) => {
    if (busy) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("revoke_platform_asset", { p_id: h.id });
    const { data: check } = error ? { data: h } : await supabase.from("verified_assets")
      .select("id").eq("id", h.id).is("revoked_at", null).maybeSingle();
    if (error || check) setErr(h.platform);
    setBusy(false); setBump(b => b + 1);
  };

  const worth = (p: Plat) =>
    loaded ? scoreDelta(input, { assets: [{ class: p.cls, proof: "self_asserted" }] }) : 0;

  const Tile = ({ p }: { p: Plat }) => {
    const isOpen = open === p.id;
    const has = heldFor(p.id);
    return (
      <button
        onClick={() => { setOpen(isOpen ? null : p.id); setHandle(""); setErr(null); }}
        className={`card flex flex-col items-center gap-2 !p-3.5 transition ${
          isOpen ? "ring-2 ring-teal" : has ? "ring-1 ring-teal/40" : "hover:bg-brand/5"}`}>
        <BrandIcon id={p.id} size={28} />
        <span className="text-[11.5px] font-bold leading-tight">{p.label}</span>
        {has && <span className="h-1.5 w-1.5 rounded-full bg-teal" />}
      </button>
    );
  };

  const AddForm = ({ p }: { p: Plat }) => (
    <div className="card col-span-4 space-y-2 !p-4">
      <div className="flex items-center gap-2">
        <BrandIcon id={p.id} size={18} />
        <p className="text-[13.5px] font-extrabold">{p.label}</p>
        {worth(p) > 0 && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-extrabold text-brand">
            +{worth(p).toFixed(1)}
          </span>
        )}
      </div>
      <input
        value={handle}
        onChange={e => setHandle(e.target.value)}
        placeholder={W(lang, p.ph.en, p.ph.es)}
        className="w-full rounded-xl border border-ink/10 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:opacity-50 dark:border-white/15"
        autoFocus
      />
      <div className="flex gap-2">
        <button onClick={() => add(p)} disabled={!handle.trim() || busy || !userId}
          className="btn-brand flex-1 disabled:opacity-50">
          {busy ? "…" : W(lang, "Add", "Agregar")}
        </button>
        <button onClick={() => setOpen(null)} className="btn-ghost">{W(lang, "Cancel", "Cancelar")}</button>
      </div>
      {err === p.id && (
        <p className="text-[12px] font-bold text-red-500">
          {W(lang, "That didn't save — try again.", "No se guardó — reintenta.")}
        </p>
      )}
      {!userId && (
        <p className="text-[12px] opacity-55">{W(lang, "Sign in to connect platforms.", "Inicia sesión para conectar.")}</p>
      )}
    </div>
  );

  /* Grid with the add form injected as a full-width row right below the tapped tile's row —
     the standalone build's pattern, so the form never teleports the user down the page. */
  const Grid = ({ items }: { items: Plat[] }) => {
    const rows: JSX.Element[] = [];
    for (let i = 0; i < items.length; i += 4) {
      const slice = items.slice(i, i + 4);
      rows.push(...slice.map(p => <Tile key={p.id} p={p} />));
      const opened = slice.find(p => p.id === open);
      if (opened) rows.push(<AddForm key={`${opened.id}-form`} p={opened} />);
    }
    return <div className="grid grid-cols-4 gap-2">{rows}</div>;
  };

  return (
    <div className="space-y-4">
      <div>
        <ScreenHeading className="mb-0">{W(lang, "Connect your world", "Conecta tu mundo")}</ScreenHeading>
        <p className="mt-0.5 text-[13px] opacity-60">
          {W(lang,
            "Add everywhere you exist online. Stronger verification is rolling out — start with your handles.",
            "Agrega todos los lugares donde existes en línea. La verificación fuerte está en camino — empieza con tus usuarios.")}
        </p>
      </div>

      {/* Connected — pinned at top, honest labels, removable. */}
      {!!(held ?? []).length && (
        <div className="overflow-hidden rounded-2xl border border-ink/10 dark:border-white/10">
          {(held ?? []).map((h, i) => (
            <div key={h.id} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-ink/5 dark:border-white/5" : ""}`}>
              <BrandIcon id={h.platform} size={22} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold">{h.handle ?? h.platform}</p>
                <p className="text-[11.5px] opacity-55">
                  {W(lang, PROOF_LABEL[h.proof_level]?.en ?? h.proof_level, PROOF_LABEL[h.proof_level]?.es ?? h.proof_level)}
                </p>
              </div>
              {h.proof_level === "self_asserted" && (
                <span className="shrink-0 rounded-full border border-ink/10 px-2 py-0.5 text-[10.5px] font-bold opacity-60 dark:border-white/15"
                  title={W(lang, "Account sign-in verification is rolling out", "La verificación con inicio de sesión está en camino")}>
                  {W(lang, "Verify soon", "Verificar pronto")}
                </span>
              )}
              <button onClick={() => remove(h)} disabled={busy}
                className="shrink-0 text-[12px] font-bold opacity-50 hover:opacity-80">
                {W(lang, "Remove", "Quitar")}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] font-extrabold uppercase tracking-widest opacity-45">
        {W(lang, "Social & content", "Redes y contenido")}
      </p>
      <Grid items={SOCIAL} />

      <p className="pt-1 text-[11px] font-extrabold uppercase tracking-widest opacity-45">
        {W(lang, "Reviews & marketplaces", "Reseñas y plataformas de trabajo")}
      </p>
      <Grid items={REVIEWS} />

      <p className="pt-1 text-[11px] font-extrabold uppercase tracking-widest opacity-45">
        {W(lang, "Identity & credentials", "Identidad y credenciales")}
      </p>
      <div className="space-y-2">
        {([
          { id: "identity", en: "Verify your identity", es: "Verifica tu identidad", subEn: "Government ID — the single biggest lever", subEs: "Documento oficial — la palanca más grande", cls: "identity" as AssetClass },
          { id: "license", en: "Professional licence", es: "Licencia profesional", subEn: "Photo of your licence — we check it against the issuing board", subEs: "Foto de tu licencia — la validamos con la entidad emisora", cls: "license" as AssetClass },
          { id: "certification", en: "Certifications", es: "Certificaciones", subEn: "AWS, Cisco, trade certs — photo or link", subEs: "AWS, Cisco, oficios — foto o enlace", cls: "certification" as AssetClass },
        ]).map(c => (
          <div key={c.id} className="card flex items-center gap-3 !p-4">
            <BrandIcon id={c.id} size={24} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-extrabold">{W(lang, c.en, c.es)}</p>
              <p className="text-[12px] opacity-55">{W(lang, c.subEn, c.subEs)}</p>
            </div>
            {loaded && scoreDelta(input, { assets: [{ class: c.cls, proof: "code_challenge" }] }) > 0 && (
              <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-extrabold text-brand">
                {W(lang, "up to", "hasta")} +{scoreDelta(input, { assets: [{ class: c.cls, proof: c.cls === "license" ? "attested" : "oauth" }] }).toFixed(0)}
              </span>
            )}
            <span className="shrink-0 rounded-full border border-ink/10 px-2.5 py-1 text-[11px] font-bold opacity-60 dark:border-white/15">
              {W(lang, "Opening soon", "Muy pronto")}
            </span>
          </div>
        ))}
      </div>

      <p className="px-1 text-[12px] leading-snug opacity-50">
        {W(lang,
          "Self-reported handles count at 15% strength. Verifying ownership — signing into the platform, or posting a code we give you — releases the full value.",
          "Los usuarios auto-declarados cuentan al 15%. Verificar la propiedad — iniciando sesión o publicando un código — libera el valor completo.")}
      </p>
    </div>
  );
}
