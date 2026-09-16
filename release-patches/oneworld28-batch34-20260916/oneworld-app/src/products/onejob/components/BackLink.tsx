import { Link } from "react-router-dom";

/** Modern back control (Lee, Jul 12): replaces the tiny "←" text links app-wide.
 *  A clear glass pill with a real chevron + label — visible and obviously tappable.
 *  UI_RULES: never ship the tiny bare arrow again. */
export default function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/70 py-1.5 pl-2 pr-3.5 text-sm font-semibold shadow-sm backdrop-blur transition active:scale-95 hover:bg-brand/10 dark:border-white/15 dark:bg-white/10"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </Link>
  );
}
