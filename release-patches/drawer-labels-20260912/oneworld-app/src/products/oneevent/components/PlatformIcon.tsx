/**
 * High-fidelity social platform icons matching real app branding.
 */

interface PlatformIconProps {
  platform: string;
  size?: number;
  className?: string;
}

export function PlatformIcon({ platform, size = 32, className = "" }: PlatformIconProps) {
  const s = size;
  const r = Math.round(s * 0.22); // corner radius matching iOS app icons

  switch (platform.toLowerCase()) {
    case "instagram":
      return (
        <svg className={className} width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="ig-grad1" cx="25%" cy="100%" r="130%" fx="25%" fy="100%">
              <stop offset="0%" stopColor="#feda75" />
              <stop offset="15%" stopColor="#fa7e1e" />
              <stop offset="35%" stopColor="#d62976" />
              <stop offset="60%" stopColor="#962fbf" />
              <stop offset="100%" stopColor="#4f5bd5" />
            </radialGradient>
          </defs>
          <rect width="48" height="48" rx="11" fill="url(#ig-grad1)" />
          <rect x="13" y="13" width="22" height="22" rx="6.5" stroke="white" strokeWidth="2.8" fill="none" />
          <circle cx="24" cy="24" r="5.5" stroke="white" strokeWidth="2.6" fill="none" />
          <circle cx="31.5" cy="16.5" r="1.8" fill="white" />
        </svg>
      );

    case "tiktok":
      return (
        <svg className={className} width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="11" fill="#010101" />
          <path d="M33.2 18.4c-1.9-.1-3.5-1-4.5-2.3-.6-.8-.9-1.8-1-2.8V12.5h-3.8v16.3c0 .1 0 .3 0 .4a3.5 3.5 0 01-3.5 3.1 3.5 3.5 0 01-3.5-3.5 3.5 3.5 0 013.5-3.5c.4 0 .7 0 1 .1v-3.9c-.3 0-.7-.1-1-.1a7.3 7.3 0 00-7.3 7.4 7.3 7.3 0 007.3 7.3 7.3 7.3 0 007.3-7.3V22.5a9.5 9.5 0 005.5 1.8v-3.8c-.7 0-1.3-.1-2-.2z" fill="white" />
          <path d="M33.2 18.4c-1.9-.1-3.5-1-4.5-2.3-.6-.8-.9-1.8-1-2.8V12.5h-1.2c.3 1.5 1.2 2.8 2.4 3.7 1 .7 2.3 1.1 3.6 1.2h.7v1z" fill="#25F4EE" opacity="0.8" />
          <path d="M20.4 25.3a3.5 3.5 0 00-3.5 3.5 3.5 3.5 0 003.5 3.5 3.5 3.5 0 003.5-3.1v-4.6c-.2-.1-.4-.2-.5-.3-.9-.5-1.9-.8-3-1z" fill="#FE2C55" opacity="0.6" />
        </svg>
      );

    case "youtube":
      return (
        <svg className={className} width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="11" fill="#FF0000" />
          <path d="M37.6 17.3a3 3 0 00-2.1-2.1C33.6 14.6 24 14.6 24 14.6s-9.6 0-11.5.6a3 3 0 00-2.1 2.1A31.4 31.4 0 009.8 24c0 2.3.2 4.6.6 6.7a3 3 0 002.1 2.1c1.9.6 11.5.6 11.5.6s9.6 0 11.5-.6a3 3 0 002.1-2.1c.4-2.1.6-4.4.6-6.7 0-2.3-.2-4.6-.6-6.7z" fill="white" fillOpacity="0" />
          <path d="M20.8 29.2V18.8L30 24l-9.2 5.2z" fill="white" />
        </svg>
      );

    case "facebook":
      return (
        <svg className={className} width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="11" fill="#1877F2" />
          <path d="M33 24.1a9 9 0 10-10.4 8.9v-6.3h-2.3V24.1h2.3v-2c0-2.3 1.4-3.5 3.4-3.5 1 0 2 .2 2 .2v2.3h-1.1c-1.1 0-1.5.7-1.5 1.4v1.7h2.5l-.4 2.6h-2.1V33A9 9 0 0033 24.1z" fill="white" />
        </svg>
      );

    case "twitter":
    case "x":
      return (
        <svg className={className} width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="11" fill="#000" />
          <path d="M30.9 13h3.7l-8.1 9.3L36 35h-7.5l-5.8-7.6L16.6 35H12.9l8.7-9.9L12.5 13h7.7l5.3 7 6.4-7zm-1.3 19.8h2.1L19 15.2h-2.2l12.8 17.6z" fill="white" />
        </svg>
      );

    case "linkedin":
      return (
        <svg className={className} width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="11" fill="#0A66C2" />
          <path d="M16.5 19.5h3.6v11.6h-3.6V19.5zm1.8-5.7a2.1 2.1 0 110 4.2 2.1 2.1 0 010-4.2zM22 19.5h3.4v1.6h.1c.5-.9 1.6-1.8 3.3-1.8 3.5 0 4.2 2.3 4.2 5.4v6.4h-3.5v-5.7c0-1.4 0-3.1-1.9-3.1-1.9 0-2.2 1.5-2.2 3v5.8H22V19.5z" fill="white" />
        </svg>
      );

    case "spotify":
      return (
        <svg className={className} width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="11" fill="#1DB954" />
          <path d="M32.7 27.5c-.2 0-.3 0-.5-.1-3-1.8-6.7-2.2-11-1.2-.4.1-.8-.2-.8-.6s.2-.8.6-.8c4.8-1.1 8.9-.6 12.2 1.4.4.2.5.7.2 1-.1.2-.4.3-.7.3zm1.4-3.5c-.2 0-.4-.1-.6-.2-3.4-2.1-8.6-2.7-12.6-1.5-.5.2-1-.2-1.2-.6-.1-.5.2-1 .6-1.2 4.6-1.4 10.3-.7 14.2 1.7.4.3.6.8.3 1.3-.2.3-.5.5-.7.5zm.2-3.8c-.2 0-.4 0-.5-.1-3.9-2.3-10.3-2.5-14-1.4-.5.1-1.1-.2-1.2-.7-.2-.5.2-1.1.7-1.2 4.3-1.3 11.3-1 15.7 1.6.5.3.6.9.3 1.4-.2.3-.6.4-1 .4z" fill="white" />
        </svg>
      );

    case "pinterest":
      return (
        <svg className={className} width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="11" fill="#E60023" />
          <path d="M24 12a12 12 0 00-4.4 23.2c0-1.1 0-2.4.3-3.5.3-1.2 2-8.5 2-8.5s-.5-1-.5-2.5c0-2.4 1.4-4.1 3-4.1 1.5 0 2.2 1.1 2.2 2.4 0 1.5-.9 3.6-1.4 5.6-.4 1.7.9 3 2.5 3 3 0 5.3-3.2 5.3-7.8 0-4.1-2.9-6.9-7.1-6.9-4.9 0-7.7 3.6-7.7 7.4 0 1.5.6 3 1.2 3.8.1.2.1.3.1.5-.1.5-.4 1.7-.5 1.9-.1.3-.3.4-.5.2-2-1-3.3-3.8-3.3-6.2 0-5 3.6-9.6 10.5-9.6 5.5 0 9.8 3.9 9.8 9.2 0 5.5-3.5 9.9-8.3 9.9-1.6 0-3.1-.8-3.7-1.8l-1 3.8c-.4 1.4-1.3 3.2-2 4.3A12 12 0 0024 12z" fill="white" />
        </svg>
      );

    default:
      return (
        <svg className={className} width={s} height={s} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="11" fill="hsl(var(--muted))" />
          <circle cx="24" cy="24" r="9" stroke="hsl(var(--muted-foreground))" strokeWidth="2" fill="none" />
          <path d="M15 24h18M24 15c-3 3.5-3 14.5 0 18M24 15c3 3.5 3 14.5 0 18" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" fill="none" />
        </svg>
      );
  }
}

/** Platform brand colors for metrics highlighting */
export const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  tiktok: "#25F4EE",
  youtube: "#FF0000",
  facebook: "#1877F2",
  twitter: "#1DA1F2",
  x: "#000",
  linkedin: "#0A66C2",
  spotify: "#1DB954",
  pinterest: "#E60023",
};
