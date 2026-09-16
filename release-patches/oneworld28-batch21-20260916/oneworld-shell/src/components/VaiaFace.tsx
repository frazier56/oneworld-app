import { useState } from "react";

/**
 * VAIA's face, with a fallback that isn't a broken-image icon.
 * ============================================================================================
 * An image that carries a brand should never fail to a browser default. If the file can't load
 * for any reason (bad deploy, offline, cache miss), this renders a clean brand-hued "V" monogram
 * instead: still recognisably VAIA, still the right size and ring, and it tells nobody something
 * is broken.
 *
 * Shell version: the avatar is a stable `/public` URL (default `/vaia-avatar-v5.png`, overridable
 * per product via `src`) rather than a content-hashed build artefact — the OneJob bug was a
 * hard-coded hashed path to a file that did not exist, which drew a broken-image icon on the one
 * screen whose whole job is to make someone look credible.
 */
export default function VaiaFace({
  size = 32,
  className = "",
  ring,
  src = "/vaia-avatar-v5.png",
  name = "VAIA",
}: {
  size?: number;
  className?: string;
  /** Legacy: a Tailwind ring utility. Superseded by the gradient ring below; accepted so the
      existing call sites keep compiling, and used as a flat fallback where a caller passes one. */
  ring?: string;
  /** Product may point at its own asset; defaults to the shared public file. */
  src?: string;
  name?: string;
}) {
  const [failed, setFailed] = useState(false);
  /* ── THE GRADIENT RING (Lee, 12 Aug 2026) ────────────────────────────────────────────────
     *"At the very top where VAIA is, she's missing her gradient. She had a gradient around her.
     If you look on the OneJob page you'll see her, and she has a gradient — it wraps around her
     from the right and goes to the left. She needs to be consistent, obviously; we don't want
     her looking any different."*

     A Tailwind `ring-*` can only be one flat colour, which is what she had here, so she rendered
     with a plain hairline on every screen that used this component while OneJob's own copy kept
     the gradient. This draws the ring as a 2px gradient border instead: a padded wrapper carrying
     the gradient with the round face sitting on top of it, right-to-left through the product's
     own hue ramp. Being in the shell, every app gets the same one and they cannot drift again.

     `ring` is still honoured as the FALLBACK colour, so a caller that deliberately asked for a
     different emphasis keeps it if the ramp variables are not present. */
  const shared = `shrink-0 rounded-full ${className}`;
  /* ALWAYS the gradient, whatever a caller passes. Lee: *"she needs to be consistent, obviously
     — we don't want her looking any different."* Honouring a per-call-site ring colour is exactly
     how she ended up looking different on OneJob and everywhere else in the first place. `ring`
     is accepted and ignored so the existing call sites keep compiling. */
  void ring;
  const RING_BG = "linear-gradient(to left, var(--brand-light, #7dd3fc), var(--brand, #0ea5e9), var(--brand-deep, #0369a1))";

  /* The wrapper IS the ring: 2px of gradient showing round the edge of the face. */
  const Ring = ({ children }: { children: React.ReactNode }) => (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full ${className}`}
      style={{ width: size + 4, height: size + 4, padding: 2,
               background: RING_BG }}
    >
      {children}
    </span>
  );

  if (failed) {
    return (
      <Ring>
        <span
          aria-label={name}
          role="img"
          className={`grid place-items-center bg-gradient-to-br from-brand to-brand/70 font-extrabold text-white ${shared}`}
          style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.46)) }}
        >
          V
        </span>
      </Ring>
    );
  }

  return (
    <Ring>
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        loading="eager"
        onError={() => setFailed(true)}
        className={`object-cover ${shared}`}
        style={{ width: size, height: size }}
      />
    </Ring>
  );
}
