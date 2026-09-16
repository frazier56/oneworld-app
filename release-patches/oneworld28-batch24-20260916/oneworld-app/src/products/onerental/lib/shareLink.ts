import { SUPABASE_URL } from "@oneworld/shell";

/**
 * THE LINK A HOST ACTUALLY PASTES — one place, because it is easy to get subtly wrong.
 * ============================================================================================
 * Lee is in a WhatsApp group of about five hundred people posting properties all day. What he
 * pastes has to arrive as a picture, a place and a price, not a bare URL.
 *
 * ⚠️ THE APP'S OWN DEEP LINK CANNOT DO THAT, AND THAT IS WHAT THE SHARE BUTTON USED TO SEND.
 * `PropertyDetail` shared `${appDoorway("onehome")}/r/${id}` — the listing inside the app. OneHome
 * is a Vite single-page app whose `index.html` is one empty div and a script tag, and **no link
 * crawler runs JavaScript**. So every link shared from OneHome to date has arrived in WhatsApp as
 * a naked URL, next to a competitor's post that has a photo. It was not broken in a way anybody
 * could see; it simply never produced a card, which looks exactly the same as not having the
 * feature.
 *
 * The share link now points at the `share-listing` edge function, which answers with served HTML
 * carrying real Open Graph tags and redirects a person through to the same listing. A crawler
 * reads the markup and stops; a human lands where they always did.
 *
 * ── WHY THIS IS A FUNCTIONS URL AND NOT SOMETHING PRETTIER ──────────────────────────────────
 * A link like `onesocial.ai/s/<id>` would read better in a chat. It needs a rewrite rule at the
 * edge, which is deployment territory and not mine. **This function is written so that swap is
 * one line here and nothing else** — no caller builds its own URL. When someone owns the rewrite,
 * change `shareUrl` and every share button follows.
 *
 * Until then the honest trade is: an ugly link that produces a card beats a pretty one that does
 * not. WhatsApp shows the preview, not the URL, once the card resolves.
 */

/** The published card for a listing. Never the app deep link — see above. */
export function shareUrl(id: string): string {
  const base = String(SUPABASE_URL || "").replace(/\/+$/, "");
  /* If the app has no Supabase URL there is nothing to share to, and falling back to the app deep
     link would silently restore the no-card behaviour this file exists to end. An empty string
     tells the caller to hide the control instead, which is the "hidden, not disabled" rule. */
  if (!base) return "";
  return `${base}/functions/v1/share-listing?id=${encodeURIComponent(id)}`;
}

/**
 * May this listing be shared at all?
 *
 * `allow_public_share` is the host's own answer and it defaults to true, so `!== false` — a host
 * who has never been asked has not said no. The same predicate is enforced on the server in
 * `share-listing/card.ts`; this one only decides whether to draw the button. A gate that lives
 * only in the UI is not a gate, which is why both exist.
 */
export const canShare = (allowPublicShare: unknown): boolean => allowPublicShare !== false;
