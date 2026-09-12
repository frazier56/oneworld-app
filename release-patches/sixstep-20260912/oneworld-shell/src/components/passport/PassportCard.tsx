import { Link } from "react-router-dom";
import { Crown, Award, ShieldCheck, Shield, User as UserIcon, CreditCard, BadgeCheck, ExternalLink, Check } from "./icons";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";
import { useAsync } from "../../lib/useAsync";
import { getTierInfo, type BadgeTier } from "../../lib/badgeTiers";
import { IconPin, IconBriefcase } from "../ActionIcons";

/** Trust chips are dark green, product-independent on purpose: a verification means the same thing
 *  whichever app renders the card, so it must not wear an app's accent. */
const TRUST_GREEN = "#0B6539";

/**
 * THE PASSPORT — the shareable credential, identical on every app.
 * Built to the onesocial.ai reference (384×577, radius 32). Always dark, in both themes: a
 * passport is an object, it should look the same in your hand whatever room you're in, and it must
 * match the image you publish to LinkedIn. NO app wordmark above the title — the passport
 * aggregates every app, so branding it with the one that drew it would be wrong.
 */
const TIER_ICONS: Record<BadgeTier, typeof Shield> = {
  member: Shield, verified: ShieldCheck, trusted: Award, authority: Crown,
};

export interface PassportCardProps {
  userId?: string | null;
  name: string;
  profession: string;
  location?: string | null;
  photoUrl?: string | null;
  score: number | null;
  tier: BadgeTier;
  completedJobs: number;
  reviewCount: number;
  /** Stored on a 7-point scale, displayed out of 5. */
  avgRating: number;
  connectionCount: number;
  /** Owner view gets the Publish button; public view doesn't. */
  onPublish?: () => void;
  publicView?: boolean;
  /** Email is the only identity signal we actually hold today. */
  hasEmail?: boolean;
  hasPayout?: boolean;
  /** Where the "One World" footer/pill link goes — the person's public world. */
  worldHref: string;
  /** Possessive first name for the footer link ("Sarah's One World"). */
  firstName?: string;
}

export default function PassportCard(p: PassportCardProps) {
  const { lang } = useI18n();
  const isEs = lang === "es";
  const tier = getTierInfo(p.tier);
  const accent = tier.textColor;
  const TierIcon = TIER_ICONS[p.tier];

  /** The platforms this person has actually linked, by name — shown as chips. */
  const linked = useAsync(async () => {
    const { data } = await supabase.from("social_connections_public")
      .select("platform, is_verified").eq("user_id", p.userId!).eq("is_active", true);
    return {
      names: [...new Set((data ?? []).map(r => String(r.platform)))],
      verified: (data ?? []).filter(r => r.is_verified).length,
    };
  }, [p.userId], !!p.userId);

  /** "Top 28%" — real, or absent. Suppressed below 20 scored profiles. */
  const percentile = useAsync(async () => {
    const [total, above] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).not("score_v9_snapshot", "is", null),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gt("score_v9_snapshot", p.score!),
    ]);
    const t = total.count ?? 0;
    if (t < 20) return null;
    return Math.max(1, Math.round(((above.count ?? 0) / t) * 100));
  }, [p.score], p.score != null && p.score > 0);

  const platformNames = linked?.names ?? [];
  const verifiedCount = linked?.verified ?? 0;
  const rating5 = p.reviewCount > 0 ? (p.avgRating / 7) * 5 : null;

  const metrics: { v: string; l: string; good: boolean }[] = [
    { v: String(p.completedJobs), l: isEs ? "Trabajos" : "Jobs", good: p.completedJobs >= 3 },
    { v: rating5 != null ? rating5.toFixed(1) : "—", l: isEs ? "Nota" : "Rating", good: (rating5 ?? 0) >= 4 },
    { v: String(p.reviewCount), l: isEs ? "Reseñas" : "Reviews", good: p.reviewCount >= 3 },
    { v: String(p.connectionCount), l: isEs ? "Red" : "Network", good: p.connectionCount >= 10 },
    { v: String(platformNames.length), l: isEs ? "Apps" : "Linked", good: platformNames.length >= 1 },
    { v: String(verifiedCount ?? 0), l: isEs ? "Verif." : "Verified", good: (verifiedCount ?? 0) >= 1 },
  ];

  const trust: { icon: typeof UserIcon; l: string; done: boolean }[] = [
    { icon: UserIcon, l: isEs ? "Identidad" : "Identity", done: !!p.hasEmail },
    { icon: CreditCard, l: isEs ? "Pago" : "Payment", done: !!p.hasPayout },
    { icon: ShieldCheck, l: isEs ? "Antec." : "Background", done: false },
    { icon: BadgeCheck, l: isEs ? "Cert." : "Certs", done: false },
  ];

  const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--pp-faint)" }}>{children}</p>
  );

  const first = p.firstName || p.name.split(" ")[0] || "";

  return (
    <section
      className="ow-pp p-7"
      style={{
        border: `1px solid ${accent}8C`,
        boxShadow: `0 16px 80px -30px rgba(0,0,0,.45), 0 0 120px -30px ${accent}26, var(--pp-edge)`,
      }}
    >
      <div>
        {/* ── Header ── (no app wordmark — see file header) */}
        <div className="text-center">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.22em]" style={{ color: "var(--pp-fg)" }}>
            {isEs ? "Pasaporte de Reputación" : "Reputation Passport"}
          </p>
        </div>

        {/* ── Identity ── */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl border-2"
            style={{ borderColor: `${accent}99` }}>
            {p.photoUrl ? (
              <img src={p.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-extrabold"
                style={{ background: "var(--pp-chip)", color: accent }}>
                {p.name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?"}
              </div>
            )}
          </div>

          <div className="min-w-0">
            {p.score != null && p.score > 0 ? (
              <p className="flex items-baseline leading-none">
                <span className="text-[40px] font-extrabold tracking-tight">{Math.floor(p.score)}</span>
                <span className="text-base font-bold" style={{ color: "var(--pp-muted)" }}>
                  .{Math.round((p.score - Math.floor(p.score)) * 10)}
                </span>
              </p>
            ) : (
              <p className="text-[15px] font-bold" style={{ color: "var(--pp-muted)" }}>{isEs ? "Sin puntaje aún" : "No score yet"}</p>
            )}
            {percentile != null && (
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--pp-muted)" }}>{`Top ${percentile}%`}</p>
            )}
            <h3 className="mt-1.5 truncate text-[16px] font-bold leading-tight">{p.name}</h3>
            {p.location && <p className="truncate text-[11px]" style={{ color: "var(--pp-muted)" }}><IconPin size={12} className="mr-1 inline-block align-[-1px]" />{p.location}</p>}
            <p className="truncate text-[11px]" style={{ color: "var(--pp-muted)" }}><IconBriefcase size={12} className="mr-1 inline-block align-[-1px]" />{p.profession}</p>
          </div>
        </div>

        {/* ── Tier pill: centred, full width, tier-coloured. One tier badge on this card, ever. ── */}
        <div className="mt-4 flex justify-center">
          <Link to={p.worldHref}
            title={isEs ? "Ver su One World" : "See their One World"}
            className="ow-shimmer ow-notch inline-flex min-w-[142px] items-center justify-center gap-2 rounded-full px-5 py-2 text-[13.5px] font-extrabold"
            style={{
              background: `linear-gradient(135deg, ${tier.metal[0]}, ${tier.metal[1]} 52%, ${tier.metal[2]})`,
              color: tier.ink,
              boxShadow: [
                `0 0 0 1px ${tier.metal[2]}59`,
                `0 1px 2px rgba(11,15,26,.10)`,
                `0 6px 16px -6px rgba(11,15,26,.28)`,
                `0 4px 18px ${tier.metal[1]}40`,
                `inset 0 1px 0 rgba(255,255,255,.55)`,
                `inset 0 -1px 0 rgba(0,0,0,.18)`,
              ].join(", "),
            }}>
            <span className="inline-flex items-center gap-2">
              <TierIcon className="h-4 w-4" />
              {isEs ? tier.labelEs : tier.label}
            </span>
          </Link>
        </div>

        {/* ── Connected platforms ── */}
        <div className="mt-5">
          <Label>{isEs ? "Plataformas conectadas" : "Connected platforms"}</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {platformNames.length ? platformNames.map(pl => (
              <span key={pl} className="rounded-full border px-2.5 py-1 text-[11px] capitalize"
                style={{ borderColor: "var(--pp-line)", background: "var(--pp-chip)", color: "var(--pp-muted)" }}>
                {pl}
              </span>
            )) : (
              <span className="text-[11px]" style={{ color: "var(--pp-faint)" }}>{isEs ? "Ninguna aún" : "None linked yet"}</span>
            )}
          </div>
        </div>

        {/* ── Track record ── */}
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--pp-line)" }}>
          <Label>{isEs ? "Historial" : "Track record"}</Label>
          <div className="mt-2.5 grid grid-cols-6 gap-1.5">
            {metrics.map((m, i) => {
              const empty = m.v === "0" || m.v === "—";
              return (
                <div key={i} className="min-w-0 text-center">
                  <p className="truncate text-[15px] font-extrabold leading-tight">{m.v}</p>
                  <p className="truncate text-[8px] uppercase leading-tight tracking-wide" style={{ color: "var(--pp-faint)" }}>{m.l}</p>
                  <div className="mx-auto mt-1 h-[3px] w-full rounded-full"
                    style={{ background: empty ? "var(--pp-line)" : m.good ? "#15C2B2" : "#F59E0B" }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Trust & verification — earned lit, unearned dim ── */}
        <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--pp-line)" }}>
          <Label>{isEs ? "Verificación" : "Trust & verification"}</Label>
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {trust.map((tItem, i) => {
              const TIcon = tItem.icon;
              return (
                <div key={i}
                  className="relative flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center"
                  style={tItem.done
                    ? { borderColor: `${TRUST_GREEN}4D`, background: `${TRUST_GREEN}14` }
                    : { borderColor: "var(--pp-line)", background: "var(--pp-chip)" }}>
                  {tItem.done && (
                    <Check className="absolute right-1 top-1 h-2.5 w-2.5" style={{ color: TRUST_GREEN }} strokeWidth={3.5} />
                  )}
                  <TIcon className="h-3.5 w-3.5"
                    style={{ color: tItem.done ? TRUST_GREEN : "var(--pp-faint)", opacity: tItem.done ? 1 : 0.75 }} />
                  <span className="truncate text-[8.5px] font-semibold uppercase tracking-wide"
                    style={{ color: tItem.done ? TRUST_GREEN : "var(--pp-faint)" }}>
                    {tItem.l}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer: the way back in — the person's One World, or Publish for the owner ── */}
        <div className="mt-4 flex items-center justify-center gap-3 border-t pt-3.5" style={{ borderColor: "var(--pp-line)" }}>
          {p.publicView || !p.onPublish ? (
            <Link to={p.worldHref}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold underline decoration-1 underline-offset-4"
              style={{ color: accent }}>
              {isEs ? `El One World de ${first}` : `${first}'s One World`}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button onClick={p.onPublish}
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[12px] font-bold"
              style={{ borderColor: `${accent}66`, color: accent, background: `${accent}14` }}>
              {isEs ? "Publicar mi pasaporte" : "Publish my passport"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
