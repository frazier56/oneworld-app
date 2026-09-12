import { useI18n, useOneId, type AppConfig } from "@oneworld/shell";

/**
 * A screen that has not been built yet, and says so honestly.
 *
 * The alternative — a blank page, or fake content — makes the sign-on matrix impossible to run,
 * because you cannot tell "signed in and the screen is empty" from "not signed in". This states
 * which product you are in, which screen you asked for, and who the app thinks you are. That is
 * exactly what Phase 3 needs to read off the screen.
 */
export default function Placeholder({ config, screen }: { config: AppConfig; screen: string }) {
  const { t, lang } = useI18n();
  const { userId, email, displayName, products } = useOneId();

  return (
    <div className="space-y-3">
      <div className="card !rounded-3xl">
        {/* THE "O" IS PART OF THE NAME. `wordmark.ink`/`wordmark.brand` are "ne"/"Job" because
            the leading O is a drawn MARK in the header, not a character. Concatenating just the
            two strings printed "NEJOB" and "NEVOICE" at the top of every product's home screen —
            live, on the route the whole sign-on matrix is read off. Same class of bug as the
            "nePage" header this component's sibling already documents. */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand">
          O{config.wordmark.ink}{config.wordmark.brand}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{t(screen)}</h1>
        <p className="mt-2 text-[13.5px] leading-snug opacity-60">
          The shell is live on this route. The screen itself lands in this product's own thread.
        </p>
      </div>

      {/* THE SIGN-ON MATRIX READS OFF THIS PANEL. Move between products from the drawer and
          `signed in as` must never change and must never say "guest" — that failure is the exact
          reason the shell exists. */}
      <div className="card ow-card-warm !rounded-3xl text-[12.5px] leading-relaxed">
        <p className="font-bold uppercase tracking-widest opacity-40">Session</p>
        <p className="mt-1.5">
          signed in as <b>{displayName ?? email ?? "— not signed in —"}</b>
        </p>
        <p className="opacity-60">user {userId ?? "none"}</p>
        <p className="opacity-60">products {products.length ? products.join(", ") : "none yet"}</p>
        <p className="opacity-60">language {lang}</p>
      </div>
    </div>
  );
}
