import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { ONE_ID_NOTICE_VERSION, type Product } from "../lib/oneId";

/**
 * PER-PRODUCT TERMS — shown once, the first time someone opens a product.
 * ============================================================================================
 * Lee, 3 August 2026:
 *
 *   "Just put a message that people have to click the agree-to-terms-and-conditions type
 *    thing… put it there as a gateway when they try to use that app and they haven't used it
 *    before. Something that looks reasonable, not something weird. Maybe not a pop-up box, but a
 *    box at the bottom — just a checkbox on the screen before I can get into that app."
 *
 * That is exactly the right control and it is the standard pattern, so this is his design, not
 * a replacement for it.
 *
 * ── Why it has to be PER PRODUCT and not once for the ecosystem ──────────────────────────────
 * One account does not mean one legal relationship. The products promise materially different
 * things and carry materially different obligations:
 *
 *   OneJob    holds money for someone and releases it later
 *   OneVoice  records and transcribes phone calls — including the OTHER person on the call
 *   OneScore  publishes a number about a person that other people make decisions on
 *   OneEvent  sells tickets and takes payment
 *
 * Bundling all of that into a single "accept terms" at sign-up is precisely what the EU
 * regulators ruled against in the Meta decisions: consent has to be specific to a purpose, and
 * it has to be as easy to withdraw as it was to give. A blanket tick at the door does not do
 * that, and it also asks someone to agree to call recording before they have any idea the
 * product involves calls.
 *
 * So the master terms are accepted once, at sign-up, and each product adds its own short
 * schedule at the moment it becomes relevant — which is also the moment the person actually
 * cares enough to read it.
 *
 * ── The one that is not like the others ──────────────────────────────────────────────────────
 * OneVoice's gate is doing more work than the rest. A tick here means the ACCOUNT HOLDER agreed
 * to record calls. It does NOT constitute consent from the person on the other end of the line,
 * and in twelve US states that second consent is the one that matters and is worth $5,000 a call
 * if it is missing. That is handled by the recorded announcement at the start of every call, not
 * by this box. Do not let this checkbox become the reason nobody builds that announcement.
 */

const VERSION = ONE_ID_NOTICE_VERSION;

export default function TermsGate({
  product, title, points, termsUrl, children,
}: {
  product: Product;
  /** e.g. "Before you use OneVoice" */
  title: string;
  /** Three or four short lines. Plain language, no legal register — this is the summary, the
   *  link is the document. Someone who reads only these should not be surprised later. */
  points: string[];
  termsUrl: string;
  children: React.ReactNode;
}) {
  const { lang } = useI18n();
  const { userId, claimProduct } = useOneId();
  const [checked, setChecked] = useState(false);
  const [state, setState] = useState<"loading" | "needed" | "done">("loading");
  const [failed, setFailed] = useState(false);
  const purpose = `terms:${product}`;

  useEffect(() => {
    let alive = true;
    /* NO USER, NO GATE. This must set a terminal state, not just bail.
       Returning early left `state` on "loading" forever, and the render below turns "loading"
       into `return null` — so every public profile, hire link and contract link rendered a
       permanently blank page for signed-out visitors. Exactly the outcome the public-path work
       was meant to prevent, reintroduced one layer lower. Terms are recorded against a user; with
       nobody to record against there is nothing to gate. */
    if (!userId) { setState("done"); return; }
    /* ── SCOPE THE QUERY EXPLICITLY. DO NOT LEAN ON RLS TO NARROW IT ──────────────────────────
       Filtering by `purpose` alone and trusting RLS to add "…and it's mine" is the exact shape
       of the bug that made the unread badge read 41 instead of 6: an admin policy widened what
       RLS returned, and the query had no opinion of its own. Here the failure is nastier —
       `maybeSingle()` ERRORS when more than one row matches, `data` comes back null, and the
       gate reappears on every single load with no way to dismiss it.

       `order + limit(1)` rather than `maybeSingle()` so that even a duplicated row (a retry, a
       migration) yields the newest answer instead of an error. */
    supabase
      .from("one_id_consents")
      .select("granted, granted_at")
      .eq("user_id", userId)
      .eq("purpose", purpose)
      .order("granted_at", { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!alive) return;
        /* A READ failure must NOT be read as "they agreed". Showing the gate again to somebody
           who already accepted is a mild annoyance; letting somebody in because the network
           blinked means there is no consent record and no evidence — which is the one thing
           this component exists to produce. Fail closed. */
        if (error) { setFailed(true); setState("needed"); return; }
        setState(data?.[0]?.granted ? "done" : "needed");
      });
    return () => { alive = false; };
  }, [purpose, userId]);

  const accept = async () => {
    const { error } = await supabase.rpc("record_one_id_notice", {
      p_notice_version: VERSION,
      p_locale: lang,
      p_consents: { [purpose]: true },
    });
    /* "We showed it" is worth nothing without evidence. If the write failed, the person is NOT
       let through on the strength of a click nobody recorded — GDPR Art. 7(1) and Colombia's
       Decreto 1074/2015 both put the burden of proof on us, and a consent we cannot produce is
       the same as one we never took. */
    if (error) { setFailed(true); return; }
    /* CONSENT FIRST, THEN ENTITLEMENT — in that order, and only on a deliberate acceptance.
       Visiting a URL no longer grants anything. */
    await claimProduct(product);
    setFailed(false);
    setState("done");
  };

  /* Render nothing while checking rather than flashing the gate at someone who accepted it
     months ago. A gate that reappears reads as broken and trains people to click through it
     without looking — which defeats the entire point of having one. */
  if (state === "loading") return null;
  if (state === "done") return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center"
         style={{ background: "rgba(11,15,26,.42)", backdropFilter: "blur(2px)" }}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-white/40 p-5 shadow-2xl sm:rounded-3xl dark:border-white/10"
        style={{ background: "var(--overlay-bg)" }}>
        <h2 className="text-lg font-extrabold leading-tight">{title}</h2>

        {/* ── A PARAGRAPH, NOT A BULLET LIST ───────────────────────────────────────────────
            Lee, 4 Aug 2026: *"that little terms piece that pops up on all the apps at the bottom
            — it shouldn't be bullets, that should just be a paragraph of text. In my opinion it
            draws too much attention to it unnecessarily."*

            He is right about the mechanism, not just the taste. Bullets are a VISUAL EMPHASIS
            device: each dot is a full stop that restarts the reader's attention, so three bullets
            read as three warnings and the sheet starts to look like a legal notice. The same
            three sentences run together read as a short explanation — which is what this is. The
            gate still gates; it just stops shouting.

            The points are joined rather than restructured, so every product keeps the exact
            sentences it declared and nothing needs rewriting eight times. */}
        <p className="mt-3 text-[14px] leading-relaxed opacity-80">
          {points.join(" ")}
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-snug">
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
                 className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-current" />
          <span>
            I agree to the{" "}
            <a href={termsUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              terms for this product
            </a>.
          </span>
        </label>

        {/* Deliberately no "skip" and no dismiss. A gate you can dismiss is not a gate, and an
            unenforced agreement is worse than none — it looks like consent in a screenshot and
            is worth nothing in a dispute. */}
        <button onClick={accept} disabled={!checked}
          className="ow-tap btn-primary mt-4 w-full rounded-2xl py-3.5 text-[15px] font-bold disabled:opacity-40">
          Continue
        </button>

        {/* Say so when it did not save. Silently re-showing the gate next session is how a
            person concludes the product is broken; naming the failure lets them retry. */}
        {failed && (
          <p className="mt-2.5 text-center text-[12.5px] leading-snug text-red-500">
            We could not save that just now. Check your connection and try again.
          </p>
        )}
      </div>
    </div>
  );
}
