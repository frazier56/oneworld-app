/**
 * Reputation Badge Tier System
 * 
 * 4 tiers that users progress through based on activity milestones:
 *   1. Member — Basic account with minimum requirements
 *   2. Verified — Identity confirmed, complete profile
 *   3. Trusted — Proven track record with jobs & reviews
 *   4. Authority — Top-tier, endorsed by another Authority
 * 
 * Gate requirements are cumulative — each tier builds on the previous.
 */

export type BadgeTier = "member" | "verified" | "trusted" | "authority";

export interface BadgeTierInfo {
  tier: BadgeTier;
  label: string;
  labelEs: string;
  color: string;        // gradient CSS
  textColor: string;    // text CSS color
  icon: string;         // lucide icon name
  description: string;
  descriptionEs: string;
  requirements: TierRequirement[];
}

export interface TierRequirement {
  key: string;
  label: string;
  labelEs: string;
  target: number;
  current: number;
  met: boolean;
}

export interface UserBadgeProgress {
  currentTier: BadgeTier;
  nextTier: BadgeTier | null;
  progress: number;         // 0-100 toward next tier
  requirements: TierRequirement[];
  totalMet: number;
  totalRequired: number;
}

// ── Tier Definitions ──────────────────────────────────────────────────

export const BADGE_TIERS: BadgeTierInfo[] = [
  {
    tier: "member",
    label: "Member",
    labelEs: "Miembro",
    color: "linear-gradient(135deg, #64748B, #475569)",
    textColor: "#94A3B8",
    icon: "Shield",
    description: "New to OneJob. You've set up the basics — keep building to unlock your badge.",
    descriptionEs: "Nuevo en OneJob. Has configurado lo básico — sigue construyendo para desbloquear tu insignia.",
    requirements: [
      { key: "account", label: "Create account", labelEs: "Crear cuenta", target: 1, current: 0, met: false },
      { key: "photo", label: "Upload at least 1 photo", labelEs: "Subir al menos 1 foto", target: 1, current: 0, met: false },
      { key: "bio", label: "Write a minimum bio", labelEs: "Escribir una bio mínima", target: 50, current: 0, met: false },
      { key: "location", label: "Set your location", labelEs: "Establecer tu ubicación", target: 1, current: 0, met: false },
      { key: "connections_1", label: "Make 1 connection", labelEs: "Hacer 1 conexión", target: 1, current: 0, met: false },
    ],
  },
  {
    tier: "verified",
    label: "Verified",
    labelEs: "Verificado",
    color: "linear-gradient(135deg, #2EE6D6, #14B8A6)",
    textColor: "#2EE6D6",
    icon: "ShieldCheck",
    description: "Identity confirmed. Your profile is complete and credible — you're building real presence.",
    descriptionEs: "Identidad confirmada. Tu perfil es completo y creíble — estás construyendo presencia real.",
    requirements: [
      { key: "bio_extended", label: "Extended bio (150+ chars)", labelEs: "Bio extendida (150+ caracteres)", target: 150, current: 0, met: false },
      { key: "photos_9", label: "Upload 9 photos", labelEs: "Subir 9 fotos", target: 9, current: 0, met: false },
      { key: "videos_3", label: "Upload 3 videos", labelEs: "Subir 3 videos", target: 3, current: 0, met: false },
      { key: "skills", label: "Add at least 1 skill", labelEs: "Agregar al menos 1 habilidad", target: 1, current: 0, met: false },
      { key: "connections_10", label: "Make 10 connections", labelEs: "Hacer 10 conexiones", target: 10, current: 0, met: false },
      { key: "social_app", label: "Connect 1 social app", labelEs: "Conectar 1 app social", target: 1, current: 0, met: false },
    ],
  },
  {
    tier: "trusted",
    label: "Trusted",
    labelEs: "Confiable",
    color: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
    textColor: "#A78BFA",
    icon: "Award",
    description: "Proven track record. You've completed jobs, earned reviews, and built a strong portfolio.",
    descriptionEs: "Historial comprobado. Has completado trabajos, ganado reseñas y construido un portafolio sólido.",
    requirements: [
      { key: "onescore_50", label: "Reach OneScore 50+", labelEs: "Alcanzar OneScore 50+", target: 50, current: 0, met: false },
      { key: "photos_20", label: "Upload 20 photos", labelEs: "Subir 20 fotos", target: 20, current: 0, met: false },
      { key: "videos_20", label: "Upload 20 videos", labelEs: "Subir 20 videos", target: 20, current: 0, met: false },
      { key: "completed_jobs_3", label: "Complete 3 jobs", labelEs: "Completar 3 trabajos", target: 3, current: 0, met: false },
      { key: "reviews_3", label: "Receive 3 reviews (4+ stars)", labelEs: "Recibir 3 reseñas (4+ estrellas)", target: 3, current: 0, met: false },
      { key: "connections_50", label: "Make 50 connections", labelEs: "Hacer 50 conexiones", target: 50, current: 0, met: false },
      { key: "social_apps_3", label: "Connect 3 social apps", labelEs: "Conectar 3 apps sociales", target: 3, current: 0, met: false },
    ],
  },
  {
    tier: "authority",
    label: "Authority",
    labelEs: "Autoridad",
    color: "linear-gradient(135deg, #F59E0B, #D97706)",
    textColor: "#FBBF24",
    icon: "Crown",
    description: "Top-tier reputation. You've been endorsed by an Authority and can now endorse others.",
    descriptionEs: "Reputación de primer nivel. Has sido respaldado por una Autoridad y ahora puedes respaldar a otros.",
    requirements: [
      { key: "onescore_80", label: "Reach OneScore 80+", labelEs: "Alcanzar OneScore 80+", target: 80, current: 0, met: false },
      { key: "completed_jobs_10", label: "Complete 10 jobs", labelEs: "Completar 10 trabajos", target: 10, current: 0, met: false },
      { key: "reviews_10", label: "Receive 10 reviews (4.5+ avg)", labelEs: "Recibir 10 reseñas (4.5+ promedio)", target: 10, current: 0, met: false },
      { key: "hosted_event", label: "Participate in at least 1 event", labelEs: "Participar en al menos 1 evento", target: 1, current: 0, met: false },
      { key: "connections_100", label: "Make 100 connections", labelEs: "Hacer 100 conexiones", target: 100, current: 0, met: false },
      { key: "social_apps_5", label: "Connect 5 social apps", labelEs: "Conectar 5 apps sociales", target: 5, current: 0, met: false },
      { key: "authority_endorsement", label: "Endorsed by an Authority", labelEs: "Respaldado por una Autoridad", target: 1, current: 0, met: false },
      { key: "account_90d", label: "Account age 90+ days", labelEs: "Cuenta de 90+ días", target: 90, current: 0, met: false },
    ],
  },
];

// ── Badge Calculator ──────────────────────────────────────────────────

interface BadgeInput {
  hasAccount: boolean;
  hasPhoto: boolean;
  photoCount: number;
  videoCount: number;
  bioLength: number;
  hasLocation: boolean;
  hasSkills: boolean;
  connectionCount: number;
  oneScore: number;
  completedJobs: number;
  reviewCount: number;
  avgRating: number;
  socialAppsConnected: number;
  hostedOrAttendedEvents: number;
  hasAuthorityEndorsement: boolean;
  accountAgeDays: number;
}

export function calculateBadgeTier(input: BadgeInput): UserBadgeProgress {
  // Member requirements
  const memberReqs: TierRequirement[] = [
    { key: "account", label: "Create account", labelEs: "Crear cuenta", target: 1, current: input.hasAccount ? 1 : 0, met: input.hasAccount },
    { key: "photo", label: "Upload at least 1 photo", labelEs: "Subir al menos 1 foto", target: 1, current: Math.min(input.photoCount, 1), met: input.photoCount >= 1 },
    { key: "bio", label: "Write a minimum bio", labelEs: "Escribir una bio mínima", target: 50, current: input.bioLength, met: input.bioLength >= 50 },
    { key: "location", label: "Set your location", labelEs: "Establecer tu ubicación", target: 1, current: input.hasLocation ? 1 : 0, met: input.hasLocation },
    { key: "connections_1", label: "Make 1 connection", labelEs: "Hacer 1 conexión", target: 1, current: Math.min(input.connectionCount, 1), met: input.connectionCount >= 1 },
  ];

  // Verified requirements
  const verifiedReqs: TierRequirement[] = [
    { key: "bio_extended", label: "Extended bio (150+ chars)", labelEs: "Bio extendida (150+ caracteres)", target: 150, current: input.bioLength, met: input.bioLength >= 150 },
    { key: "photos_9", label: "Upload 9 photos", labelEs: "Subir 9 fotos", target: 9, current: input.photoCount, met: input.photoCount >= 9 },
    { key: "videos_3", label: "Upload 3 videos", labelEs: "Subir 3 videos", target: 3, current: input.videoCount, met: input.videoCount >= 3 },
    { key: "skills", label: "Add at least 1 skill", labelEs: "Agregar al menos 1 habilidad", target: 1, current: input.hasSkills ? 1 : 0, met: input.hasSkills },
    { key: "connections_10", label: "Make 10 connections", labelEs: "Hacer 10 conexiones", target: 10, current: input.connectionCount, met: input.connectionCount >= 10 },
    { key: "social_app", label: "Connect 1 social app", labelEs: "Conectar 1 app social", target: 1, current: input.socialAppsConnected, met: input.socialAppsConnected >= 1 },
  ];

  // Trusted requirements
  const trustedReqs: TierRequirement[] = [
    { key: "onescore_50", label: "Reach OneScore 50+", labelEs: "Alcanzar OneScore 50+", target: 50, current: input.oneScore, met: input.oneScore >= 50 },
    { key: "photos_20", label: "Upload 20 photos", labelEs: "Subir 20 fotos", target: 20, current: input.photoCount, met: input.photoCount >= 20 },
    { key: "videos_20", label: "Upload 20 videos", labelEs: "Subir 20 videos", target: 20, current: input.videoCount, met: input.videoCount >= 20 },
    { key: "completed_jobs_3", label: "Complete 3 jobs", labelEs: "Completar 3 trabajos", target: 3, current: input.completedJobs, met: input.completedJobs >= 3 },
    { key: "reviews_3", label: "Receive 3 reviews (4+ stars)", labelEs: "Recibir 3 reseñas (4+ estrellas)", target: 3, current: input.avgRating >= 4 ? input.reviewCount : 0, met: input.reviewCount >= 3 && input.avgRating >= 4 },
    { key: "connections_50", label: "Make 50 connections", labelEs: "Hacer 50 conexiones", target: 50, current: input.connectionCount, met: input.connectionCount >= 50 },
    { key: "social_apps_3", label: "Connect 3 social apps", labelEs: "Conectar 3 apps sociales", target: 3, current: input.socialAppsConnected, met: input.socialAppsConnected >= 3 },
  ];

  // Authority requirements
  const authorityReqs: TierRequirement[] = [
    { key: "onescore_80", label: "Reach OneScore 80+", labelEs: "Alcanzar OneScore 80+", target: 80, current: input.oneScore, met: input.oneScore >= 80 },
    { key: "completed_jobs_10", label: "Complete 10 jobs", labelEs: "Completar 10 trabajos", target: 10, current: input.completedJobs, met: input.completedJobs >= 10 },
    { key: "reviews_10", label: "Receive 10 reviews (4.5+ avg)", labelEs: "Recibir 10 reseñas (4.5+ promedio)", target: 10, current: input.avgRating >= 4.5 ? input.reviewCount : 0, met: input.reviewCount >= 10 && input.avgRating >= 4.5 },
    { key: "hosted_event", label: "Participate in at least 1 event", labelEs: "Participar en al menos 1 evento", target: 1, current: input.hostedOrAttendedEvents, met: input.hostedOrAttendedEvents >= 1 },
    { key: "connections_100", label: "Make 100 connections", labelEs: "Hacer 100 conexiones", target: 100, current: input.connectionCount, met: input.connectionCount >= 100 },
    { key: "social_apps_5", label: "Connect 5 social apps", labelEs: "Conectar 5 apps sociales", target: 5, current: input.socialAppsConnected, met: input.socialAppsConnected >= 5 },
    { key: "authority_endorsement", label: "Endorsed by an Authority", labelEs: "Respaldado por una Autoridad", target: 1, current: input.hasAuthorityEndorsement ? 1 : 0, met: input.hasAuthorityEndorsement },
    { key: "account_90d", label: "Account age 90+ days", labelEs: "Cuenta de 90+ días", target: 90, current: input.accountAgeDays, met: input.accountAgeDays >= 90 },
  ];

  // Determine current tier
  const memberMet = memberReqs.filter(r => r.met).length;
  const verifiedMet = verifiedReqs.filter(r => r.met).length;
  const trustedMet = trustedReqs.filter(r => r.met).length;
  const authorityMet = authorityReqs.filter(r => r.met).length;

  if (authorityMet === authorityReqs.length) {
    return { currentTier: "authority", nextTier: null, progress: 100, requirements: authorityReqs, totalMet: authorityMet, totalRequired: authorityReqs.length };
  }
  if (trustedMet === trustedReqs.length) {
    const pct = Math.round((authorityMet / authorityReqs.length) * 100);
    return { currentTier: "trusted", nextTier: "authority", progress: pct, requirements: authorityReqs, totalMet: authorityMet, totalRequired: authorityReqs.length };
  }
  if (verifiedMet === verifiedReqs.length) {
    const pct = Math.round((trustedMet / trustedReqs.length) * 100);
    return { currentTier: "verified", nextTier: "trusted", progress: pct, requirements: trustedReqs, totalMet: trustedMet, totalRequired: trustedReqs.length };
  }
  if (memberMet === memberReqs.length) {
    const pct = Math.round((verifiedMet / verifiedReqs.length) * 100);
    return { currentTier: "member", nextTier: "verified", progress: pct, requirements: verifiedReqs, totalMet: verifiedMet, totalRequired: verifiedReqs.length };
  }

  // Not yet a member
  const pct = Math.round((memberMet / memberReqs.length) * 100);
  return { currentTier: "member", nextTier: "verified", progress: pct, requirements: memberReqs, totalMet: memberMet, totalRequired: memberReqs.length };
}

/** Get the display info for a tier */
export function getTierInfo(tier: BadgeTier): BadgeTierInfo {
  return BADGE_TIERS.find(t => t.tier === tier) || BADGE_TIERS[0];
}
