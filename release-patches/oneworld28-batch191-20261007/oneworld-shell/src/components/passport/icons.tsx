/**
 * PASSPORT ICONS — inline SVGs, so the shell adds no icon dependency.
 * ============================================================================================
 * The shell deliberately does not depend on `lucide-react` (chrome uses `ActionIcons`). The
 * passport needs a richer set than ActionIcons carries, so the exact glyphs it uses live here as
 * small stroke SVGs with a lucide-compatible prop shape (`className`, `style`, `strokeWidth`) —
 * size comes from the `h-* w-*` class the caller already passes. Path geometry follows lucide
 * (ISC-licensed).
 */
import type { CSSProperties } from "react";

interface IP { className?: string; style?: CSSProperties; strokeWidth?: number }

const S = ({ className, style, strokeWidth = 2, children }: IP & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
    {children}
  </svg>
);

export const Shield = (p: IP) => <S {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></S>;
export const ShieldCheck = (p: IP) => <S {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></S>;
export const Award = (p: IP) => <S {...p}><circle cx="12" cy="8" r="6" /><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12" /></S>;
export const Crown = (p: IP) => <S {...p}><path d="M2 6l4 4 6-7 6 7 4-4-2 12H4L2 6z" /><path d="M4 20h16" /></S>;
export const Star = (p: IP) => <S {...p}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" /></S>;
export const Check = (p: IP) => <S {...p}><path d="M20 6 9 17l-5-5" /></S>;
export const CheckCircle2 = (p: IP) => <S {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></S>;
export const ChevronDown = (p: IP) => <S {...p}><path d="m6 9 6 6 6-6" /></S>;
export const ChevronRight = (p: IP) => <S {...p}><path d="m9 18 6-6-6-6" /></S>;
export const ExternalLink = (p: IP) => <S {...p}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></S>;
export const Info = (p: IP) => <S {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></S>;
export const Lock = (p: IP) => <S {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></S>;
export const User = (p: IP) => <S {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></S>;
export const Users = (p: IP) => <S {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></S>;
export const Briefcase = (p: IP) => <S {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></S>;
export const Globe = (p: IP) => <S {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></S>;
export const Zap = (p: IP) => <S {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></S>;
export const TrendingUp = (p: IP) => <S {...p}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></S>;
export const BadgeCheck = (p: IP) => <S {...p}><path d="M12 2 15 5l4-.5.5 4L22 12l-2.5 3.5.5 4-4-.5L12 22l-3-3-4 .5.5-4L2 12l3-3.5-.5-4 4 .5L12 2z" /><path d="m9 12 2 2 4-4" /></S>;
export const CreditCard = (p: IP) => <S {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></S>;
