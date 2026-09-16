import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { drawPassportCard, drawPortableBadge, type PassportCardData } from "../../lib/passportCard";

/**
 * Publish the passport.
 * ============================================================================================
 * The honest state of the four destinations: Instagram has no web share intent — the ONLY route
 * is the OS share sheet with the image attached (`navigator.share({ files })`), so that is the
 * primary action, not a fallback. LinkedIn / X / Facebook take a URL intent but render Open-Graph
 * tags from the server, not the image below — so a per-user OG endpoint is the real fix and is
 * noted in the backlog, not faked here. Order offered: native share (image) → save image → copy
 * link / social buttons.
 *
 * LIGHT LOOK/FEEL (Lee, Aug 2026): this was the last always-dark surface — a navy card on an
 * otherwise light, frosted product. It now wears the SAME shared glass as every other overlay:
 * `--glass-fill` frost, ink text, the neutral Selection-ink scrim (never black, never a hue), and
 * dark-mode variants so it flips with the app. Primary press = the shared ACTION colour (espresso
 * `bg-clay`), not the app hue, so it reads the same in all five apps.
 */
export default function PassportShareSheet({ data, onClose }: { data: PassportCardData; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let dead = false;
    let objUrl: string | null = null;
    drawPassportCard(data)
      .then(b => {
        if (dead) return;
        objUrl = URL.createObjectURL(b);
        setBlob(b); setUrl(objUrl);
      })
      .then(() => drawPortableBadge({ score: data.score, tier: data.tier, productName: data.productName }))
      .then(b => { if (b && !dead) setBadgeUrl(URL.createObjectURL(b)); })
      .catch(e => !dead && setErr(e?.message || "Could not build the image."));
    return () => { dead = true; if (objUrl) URL.revokeObjectURL(objUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const file = blob ? new File([blob], "reputation-passport.png", { type: "image/png" }) : null;
  const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));

  const shareNative = async () => {
    if (!file) return;
    try {
      await navigator.share({
        files: [file],
        title: `${data.name} — Reputation Passport`,
        text: `${data.name} — verified reputation. ${data.url}`,
      });
    } catch { /* user dismissed the sheet; not an error */ }
  };

  const save = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `reputation-passport-${data.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const u = encodeURIComponent(data.url);
  const txt = encodeURIComponent(`My Reputation Passport — verified reputation, real track record.`);
  const links: { label: string; href: string }[] = [
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${txt}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(11,15,26,.42)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/40 p-4 sm:rounded-3xl dark:border-white/12"
        style={{
          background: "var(--glass-fill)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          boxShadow: "var(--frostedge)",
        }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-extrabold">Publish your passport</p>
          <button onClick={onClose} aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full border border-ink/15 text-lg dark:border-white/15">×</button>
        </div>

        {/* Preview first. Nobody should post a credential they haven't looked at. */}
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-ink/[.04] dark:border-white/10 dark:bg-black/30">
          {err ? (
            <p className="p-6 text-center text-sm opacity-60">{err}</p>
          ) : url ? (
            <img src={url} alt="Your Reputation Passport card" className="block w-full" />
          ) : (
            <div className="grid aspect-square place-items-center text-sm opacity-40">Building your card…</div>
          )}
        </div>

        {canShareFile && (
          <button onClick={shareNative}
            className="mt-3 w-full rounded-2xl bg-clay py-3 text-sm font-bold text-white">
            Share image…
          </button>
        )}
        <button onClick={save} disabled={!url}
          className="mt-2 w-full rounded-2xl border border-ink/15 py-3 text-sm font-bold disabled:opacity-40 dark:border-white/15">
          Save image
        </button>

        {!canShareFile && (
          <p className="mt-2 text-center text-[11px] leading-snug opacity-45">
            Save the image, then post it from Instagram, LinkedIn or X. Sharing straight to an app
            works from the mobile app.
          </p>
        )}

        {badgeUrl && (
          <div className="mt-4 border-t border-ink/10 pt-3 dark:border-white/10">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-50">Portable badge</p>
            <img src={badgeUrl} alt="Your reputation badge" className="mx-auto block w-[80%]" />
            <button
              onClick={() => { const a = document.createElement("a"); a.href = badgeUrl; a.download = "reputation-badge.png"; a.click(); }}
              className="mt-2 w-full rounded-2xl border border-ink/15 py-2.5 text-xs font-bold dark:border-white/15">
              Save badge
            </button>
            <p className="mt-1.5 text-center text-[11px] leading-snug opacity-50">
              Add it to your LinkedIn banner, an Instagram highlight, or a portfolio site, with your
              passport link beside it.
            </p>
          </div>
        )}

        <div className="mt-4 border-t border-ink/10 pt-3 dark:border-white/10">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-50">Or share the link</p>
          <button onClick={copy}
            className="w-full rounded-2xl border border-ink/15 py-3 text-sm font-bold dark:border-white/15">
            {copied ? "Link copied ✓" : "Copy link to my passport"}
          </button>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {links.map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                className="rounded-2xl border border-ink/15 py-2.5 text-center text-xs font-bold dark:border-white/15">
                {l.label}
              </a>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] leading-snug opacity-50">
            The link opens your public profile with your passport on it.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
