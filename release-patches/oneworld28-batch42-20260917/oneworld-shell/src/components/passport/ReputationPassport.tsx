import { useMemo, useState } from "react";
import {
  Award, BadgeCheck, CheckCircle2, ChevronDown, ChevronRight, Crown,
  Shield, ShieldCheck, Star, User, Info, Zap,
  TrendingUp, Users, Briefcase, Globe, Lock,
} from "./icons";
import { BADGE_TIERS, calculateBadgeTier, getTierInfo, type BadgeTier } from "../../lib/badgeTiers";
import { useBadgeTier } from "../../lib/useBadgeTier";
import { useI18n } from "../../lib/i18n";
import { PRODUCT_BRAND, type AppKey } from "../../lib/oneWorld";
import VaiaFace from "../VaiaFace";
import PassportShareSheet from "./PassportShareSheet";
import PassportCard from "./PassportCard";

const cn = (...a: (string | undefined | false | null)[]) => a.filter(Boolean).join(" ");

/* VAIA context tip — uses the shared VaiaFace, which degrades to a brand monogram rather than a
   broken-image icon on the one screen whose whole job is to make someone look credible. */
function VaiaTip({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2", className)}>
      <VaiaFace size={20} className="mt-0.5" ring="ring-brand/30" />
      <p className="text-[11px] leading-relaxed text-ink/60 dark:text-white/60">
        <span className="font-semibold text-brand">VAIA: </span>{text}
      </p>
    </div>
  );
}

const TIER_ICONS: Record<BadgeTier, typeof Shield> = {
  member: Shield, verified: ShieldCheck, trusted: Award, authority: Crown,
};
const TIER_RANGES: Record<BadgeTier, string> = {
  member: "Starter", verified: "Growing", trusted: "Established", authority: "Elite",
};
const TIER_DESCRIPTIONS: Record<BadgeTier, { en: string; es: string }> = {
  member: { en: "You're just getting started! Complete your profile basics to begin building credibility.", es: "¡Recién empiezas! Completa tu perfil básico para empezar a construir credibilidad." },
  verified: { en: "Your identity is confirmed. You now appear in search results and can apply with confidence.", es: "Tu identidad está confirmada. Apareces en búsquedas y puedes postularte con confianza." },
  trusted: { en: "You've proven reliability through completed work and strong engagement. Premium opportunities unlock here.", es: "Has demostrado confiabilidad. Se desbloquean oportunidades premium." },
  authority: { en: "The highest distinction. You're recognized as a leader and can endorse others to help them grow.", es: "La distinción más alta. Eres reconocido como líder y puedes endosar a otros." },
};
const TIER_BENEFITS: Record<BadgeTier, { icon: typeof Star; text: string }[]> = {
  member: [
    { icon: Globe, text: "Access the One World marketplace" },
    { icon: User, text: "Basic profile listing" },
    { icon: Briefcase, text: "Browse and save jobs & events" },
    { icon: TrendingUp, text: "Start building your OneScore™" },
  ],
  verified: [
    { icon: BadgeCheck, text: "Verified badge on your profile" },
    { icon: TrendingUp, text: "Higher visibility in search" },
    { icon: Briefcase, text: "Apply for jobs & message talent" },
    { icon: Users, text: "Eligible for community events" },
  ],
  trusted: [
    { icon: Award, text: "Trusted badge — top credibility" },
    { icon: Zap, text: "Priority search placement" },
    { icon: Briefcase, text: "Access premium listings" },
    { icon: Star, text: "Host and monetize your events" },
  ],
  authority: [
    { icon: Crown, text: "Authority badge — highest tier" },
    { icon: Users, text: "Endorse and mentor other users" },
    { icon: Star, text: "Featured in 'Top Talent' sections" },
    { icon: Lock, text: "Access authority-only events" },
  ],
};
const VAIA_TIER_TIPS: Record<BadgeTier, { en: string; es: string }> = {
  member: { en: "Welcome aboard! Focus on completing your profile — add a photo, bio, and verify your phone. That alone gets you halfway to Verified!", es: "¡Bienvenido! Enfócate en completar tu perfil — foto, bio, y verifica tu teléfono." },
  verified: { en: "Nice work getting verified! Now start connecting with people, apply for jobs, and upload media to your portfolio.", es: "¡Buen trabajo! Ahora conecta con personas, postúlate a trabajos, y sube contenido." },
  trusted: { en: "You're building real credibility! Complete more jobs and get reviews — consistency is the key to Trusted status.", es: "¡Estás construyendo credibilidad! Completa más trabajos y obtén reseñas." },
  authority: { en: "You're at Authority — the highest tier. It's earned continuously: keep completing jobs and collecting reviews, and you can now endorse others to help them rise.", es: "Estás en Autoridad — el nivel más alto. Se mantiene con trabajo continuo, y ahora puedes respaldar a otros." },
};

interface Props {
  /** Which app is rendering — drives the wordmark, bloom hue and world link. */
  product: AppKey;
  /** The person's public world link, where the passport sends people. */
  worldHref: string;
  profile: {
    full_name: string; email: string; bio: string | null;
    photo_url: string | null; location: string | null;
    industry: string | null; category: string | null;
    subcategory: string | null; custom_expertise: string | null;
    job_title: string | null; phone: string | null;
  } | null;
  userId?: string | null;
  oneScore: number; completionPct: number;
  checklist: { label: string; done: boolean }[];
  connectionCount?: number; socialAppsConnected?: number;
  completedJobs?: number; reviewCount?: number; avgRating?: number;
  hostedOrAttendedEvents?: number; accountAgeDays?: number;
  photoCount?: number; videoCount?: number;
  /** Public view renders the passport alone — no roadmap, checklist or coaching. */
  publicView?: boolean;
  hasPayout?: boolean;
}

export default function ReputationPassport({
  product, worldHref, profile, userId, oneScore, completionPct, checklist,
  connectionCount = 0, socialAppsConnected = 0, completedJobs = 0,
  reviewCount = 0, avgRating = 0, hostedOrAttendedEvents = 0,
  accountAgeDays = 0, photoCount = 0, videoCount = 0,
  publicView = false, hasPayout = false,
}: Props) {
  const { lang } = useI18n();
  const isEs = lang === "es";
  const [expandedTier, setExpandedTier] = useState<BadgeTier | null>(null);
  const [sharing, setSharing] = useState(false);

  const profession = profile?.subcategory || profile?.category || profile?.custom_expertise || profile?.industry || profile?.job_title || "Professional";
  const brand = PRODUCT_BRAND[product];
  const first = (profile?.full_name || "").split(" ")[0] || "";

  /* ONE tier, everywhere — resolved from the RPC first, handed to calculateBadgeTier so the badge,
     the subtitle, the next-tier panel, the roadmap highlight and VAIA's tip describe one person. */
  const { tier: rpcTier } = useBadgeTier(userId);

  const badgeProgress = useMemo(() => calculateBadgeTier({
    hasAccount: true, hasPhoto: photoCount >= 1, photoCount, videoCount,
    bioLength: profile?.bio?.length ?? 0, hasLocation: Boolean(profile?.location),
    hasSkills: Boolean(profile?.custom_expertise || profile?.subcategory),
    connectionCount, oneScore, completedJobs, reviewCount, avgRating,
    socialAppsConnected, hostedOrAttendedEvents, hasAuthorityEndorsement: connectionCount > 50, accountAgeDays,
  }, rpcTier), [profile, oneScore, connectionCount, socialAppsConnected, completedJobs, reviewCount, avgRating, hostedOrAttendedEvents, accountAgeDays, photoCount, videoCount, rpcTier]);

  const displayTier: BadgeTier = rpcTier ?? badgeProgress.currentTier;
  const currentTierInfo = getTierInfo(displayTier);
  const tierOrder: BadgeTier[] = ["member", "verified", "trusted", "authority"];
  const currentIdx = tierOrder.indexOf(displayTier);

  return (
    <div className="space-y-4">
      {/* ═══ The passport ═══ */}
      <PassportCard
        userId={userId}
        name={profile?.full_name || ""}
        profession={profession}
        location={profile?.location ?? null}
        photoUrl={profile?.photo_url ?? null}
        score={oneScore > 0 ? oneScore : null}
        tier={displayTier}
        completedJobs={completedJobs}
        reviewCount={reviewCount}
        avgRating={avgRating}
        connectionCount={connectionCount}
        hasEmail={Boolean(profile?.email)}
        hasPayout={hasPayout}
        publicView={publicView}
        worldHref={worldHref}
        firstName={first}
        onPublish={() => setSharing(true)}
      />

      {/* Next tier — owner only */}
      {!publicView && badgeProgress.nextTier && (
        <section className="card p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40 dark:text-paper/40">
              {isEs ? "Siguiente nivel" : "Next tier"} · {getTierInfo(badgeProgress.nextTier).label}
            </p>
            <span className="text-sm font-extrabold text-brand">{Math.round(badgeProgress.progress)}%</span>
          </div>
          <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-brand/10">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${badgeProgress.progress}%`, background: "linear-gradient(140deg,#15C2B2,#0F766E)" }} />
          </div>
          <div className="space-y-1">
            {badgeProgress.requirements.filter(r => !r.met).slice(0, 3).map(req => (
              <div key={req.key} className="flex items-center gap-1.5 text-[11px] text-ink/60 dark:text-paper/60">
                <div className="h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                <span className="truncate">{isEs ? req.labelEs : req.label}</span>
                {req.target > 1 && (
                  <span className="ml-auto shrink-0 font-mono text-[9px]">{Math.min(req.current, req.target)}/{req.target}</span>
                )}
              </div>
            ))}
          </div>
          <VaiaTip className="mt-3" text={isEs ? VAIA_TIER_TIPS[displayTier].es : VAIA_TIER_TIPS[displayTier].en} />
        </section>
      )}

      {/* ═══ Badge tier roadmap — owner only ═══ */}
      {!publicView && (
        <section className="card p-4">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-sm font-bold text-ink dark:text-paper">{isEs ? "Mapa de Niveles" : "Badge Tier Roadmap"}</h3>
            <Info className="h-3 w-3 text-ink/60 dark:text-paper/60" />
          </div>
          <p className="mb-3 text-[11px] text-ink/60 dark:text-paper/60">
            {isEs ? "Cada nivel desbloquea más visibilidad, oportunidades y herramientas."
                  : "Each tier unlocks more visibility, opportunities, and tools. Progress by meeting the requirements below."}
          </p>

          <div className="relative mb-4 flex items-center justify-between px-2">
            <div className="absolute left-2 right-2 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-brand/10">
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${((currentIdx + (badgeProgress.progress / 100)) / (tierOrder.length - 1)) * 100}%`,
                  background: `linear-gradient(90deg, ${getTierInfo("member").color}, ${currentTierInfo.color})`,
                }} />
            </div>
            {tierOrder.map((tier, i) => {
              const info = getTierInfo(tier);
              const Icon = TIER_ICONS[tier];
              const isActive = i <= currentIdx;
              const isCurrent = tier === displayTier;
              return (
                <div key={tier} className="relative z-10 flex flex-col items-center">
                  {/* The tier you're on is magnified and ringed so it clearly stands out — the small
                      blue circle before wasn't enough (Lee, Aug 2026). A two-step halo: a paper gap
                      then a 2px ring in the tier's own colour. Unreached tiers stay grey. */}
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                      isCurrent && "scale-125")}
                    style={{
                      borderColor: isActive ? info.textColor : "rgba(120,120,120,0.25)",
                      background: isActive ? info.color : "rgba(120,120,120,0.08)",
                      ...(isCurrent ? { boxShadow: `0 0 0 3px var(--pp-ring-gap), 0 0 0 5px ${info.textColor}` } : {}),
                    }}>
                    <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-ink/40 dark:text-paper/40")} />
                  </div>
                  {/* Tier NAME in ink/black, never the badge colour — Lee: same-colour-as-badge
                      "doesn't look right." Unreached tiers dim; the current one is heaviest. */}
                  <span className={cn("mt-2 text-center text-[10px] text-ink dark:text-paper",
                      isCurrent ? "font-extrabold" : "font-medium", !isActive && "opacity-45")}>
                    {isEs ? info.labelEs : info.label}
                  </span>
                  <span className="text-[8px] text-ink/50 dark:text-paper/50">{TIER_RANGES[tier]}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            {BADGE_TIERS.map((tier, idx) => {
              const Icon = TIER_ICONS[tier.tier];
              const isUnlocked = idx <= currentIdx;
              const isCurrent = tier.tier === displayTier;
              const isExpanded = expandedTier === tier.tier;
              const benefits = TIER_BENEFITS[tier.tier];
              const desc = TIER_DESCRIPTIONS[tier.tier];
              return (
                <div key={tier.tier}
                  className={cn("overflow-hidden rounded-lg border transition-all",
                    isCurrent ? "border-brand/30 bg-brand/5" : "border-ink/10 bg-ink/[0.03] dark:border-white/[0.08] dark:bg-white/[0.03]",
                    !isUnlocked && "opacity-40")}>
                  <button className="flex w-full items-center gap-2.5 p-3 text-left"
                    onClick={() => setExpandedTier(isExpanded ? null : tier.tier)}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: tier.color }}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-ink dark:text-paper">{isEs ? tier.labelEs : tier.label}</p>
                        {isCurrent && <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[8px] font-bold text-brand">CURRENT</span>}
                        {isUnlocked && !isCurrent && <CheckCircle2 className="h-3 w-3 text-brand" />}
                        {!isUnlocked && <Lock className="h-3 w-3 text-ink/40 dark:text-paper/40" />}
                      </div>
                      <p className="truncate text-[10px] text-ink/60 dark:text-paper/60">{TIER_RANGES[tier.tier]}</p>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-ink/60 dark:text-paper/60" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink/60 dark:text-paper/60" />}
                  </button>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-ink/[0.06] px-3 pb-3 dark:border-white/[0.06]">
                      <p className="pt-2 text-[11px] leading-relaxed text-ink/60 dark:text-paper/60">{isEs ? desc.es : desc.en}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-ink/60 dark:text-paper/60">{isEs ? "Requisitos" : "Requirements"}</p>
                          {tier.requirements.map(req => (
                            <div key={req.key} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                              <CheckCircle2 className={cn("h-3 w-3 shrink-0", isUnlocked ? "text-brand" : "text-ink/30 dark:text-paper/30")} />
                              <span className={cn("text-ink/60 dark:text-paper/60", isUnlocked && "text-ink dark:text-paper")}>{isEs ? req.labelEs : req.label}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-ink/60 dark:text-paper/60">{isEs ? "Beneficios" : "Benefits"}</p>
                          {benefits.map((b, i) => {
                            const BIcon = b.icon;
                            return (
                              <div key={i} className="flex items-center gap-1.5 py-0.5 text-[11px] text-ink/60 dark:text-paper/60">
                                <BIcon className="h-3 w-3 shrink-0" style={{ color: tier.textColor }} />
                                <span>{b.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <VaiaTip text={isEs ? VAIA_TIER_TIPS[tier.tier].es : VAIA_TIER_TIPS[tier.tier].en} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ Profile checklist — owner only ═══ */}
      {!publicView && (
        <section className="card p-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink dark:text-paper">{isEs ? "Progreso del Perfil" : "Profile Checklist"}</h3>
            <span className="text-sm font-bold text-brand">{completionPct}%</span>
          </div>
          <p className="mb-2.5 text-[11px] text-ink/60 dark:text-paper/60">
            {isEs ? "Completa cada elemento para maximizar tu visibilidad y puntaje."
                  : "Complete each item to maximize your visibility and OneScore."}
          </p>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-brand/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${completionPct}%`, background: "linear-gradient(140deg,#15C2B2,#0F766E)" }} />
          </div>
          <div className="space-y-1">
            {checklist.map(c => (
              <div key={c.label} className="flex items-center justify-between rounded-lg border border-brand/12 bg-brand/[0.04] px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", c.done ? "text-brand" : "text-ink/30 dark:text-paper/30")} />
                  <span className={cn("text-xs", c.done ? "text-ink dark:text-paper" : "text-ink/60 dark:text-paper/60")}>{c.label}</span>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold",
                  c.done ? "border border-brand/30 bg-brand/10 text-brand" : "border border-brand/12 bg-brand/10 text-ink/60 dark:text-paper/60")}>
                  {c.done ? "✓" : (isEs ? "Pendiente" : "To do")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {sharing && (
        <PassportShareSheet
          onClose={() => setSharing(false)}
          data={{
            name: profile?.full_name || "",
            title: profile?.job_title || profession,
            location: profile?.location ?? null,
            photoUrl: profile?.photo_url ?? null,
            score: oneScore > 0 ? oneScore : null,
            tier: displayTier,
            jobs: completedJobs,
            reviews: reviewCount,
            rating: reviewCount > 0 ? (avgRating / 7) * 5 : null,
            platforms: socialAppsConnected,
            url: worldHref,
            productName: brand.name,
            accentBloom: brand.dot,
          }}
        />
      )}
    </div>
  );
}
