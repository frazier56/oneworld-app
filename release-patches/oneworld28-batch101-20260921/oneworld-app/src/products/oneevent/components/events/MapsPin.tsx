/**
 * MapsPin — a proper Google-Maps-coloured pin (Lee, 18 Aug 2026: "make that a color, like a
 * Google color icon... at least much bigger"). Red pin, white core, subtle depth — reads as
 * "tap me for directions" instantly, unlike the hairline outline it replaces.
 */
export default function MapsPin({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0 drop-shadow-sm">
      <path d="M12 2C7.9 2 4.5 5.4 4.5 9.5c0 5.3 6.6 11.6 6.9 11.9a.85.85 0 0 0 1.2 0c.3-.3 6.9-6.6 6.9-11.9C19.5 5.4 16.1 2 12 2Z" fill="#EA4335"/>
      <path d="M12 2C7.9 2 4.5 5.4 4.5 9.5c0 .2 0 .4.02.6L12 21.7l.6-.6C9.9 18 6.9 13.6 6.9 9.9 6.9 6.2 9.2 3.2 12.5 2A7.7 7.7 0 0 0 12 2Z" fill="#C5221F" opacity=".35"/>
      <circle cx="12" cy="9.5" r="3" fill="#FFFFFF"/>
    </svg>
  );
}
