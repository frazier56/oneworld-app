import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { sc } from "../lib/shellCopy";
import { PRODUCT_BRAND, type AppKey } from "../lib/oneWorld";
import { IS_SERVICE } from "../routes";

/**
 * THE PRODUCT MARQUEE — eight products in one line that never needs scrolling past.
 * ============================================================================================
 * Lee, 4 Aug 2026, replacing the centred two-column list he had asked for an hour earlier:
 *
 *   "How about we do like a scrolling marquee? And then when they put their finger over it, the
 *    description pops in. They let their finger go, it continues to scroll. That way they only
 *    see the actual product, and they can stop it. If they stop it, at the top it'll say Work.
 *    At the bottom is the description... it's gonna be magnified a little bit. Because when you
 *    touch it, your finger's gonna be in the way, so you gotta have your finger out of the way —
 *    tap it to stop it and tap it to keep it going. They can slide it back and forth. If they
 *    let it go, it just goes back to automatically scrolling. Having a long list is still, to me,
 *    problematic."
 *
 * He is right and the reason is worth writing down, because it is the third layout for the same
 * content and the first one that removes the problem instead of tidying it.
 *
 * A LIST makes the reader responsible for eight things at once. Every version of the list —
 * cards, plain rows, centred pairs, two columns — was an attempt to make eight simultaneous
 * unknowns less tiring, and none of them could, because the eight-at-once is the tiring part. A
 * marquee shows ONE thing at a time and asks for nothing. It occupies about 90px instead of half
 * a screen, so the Sign in button stays where a person can reach it, and the pitch still gets
 * read — just one product per moment, on its own.
 *
 * ── The three details Lee got exactly right, and why each one is load-bearing ────────────────
 *
 * **Tap to stop, not press-and-hold.** His own reasoning: *"when you touch it, your finger's
 * gonna be in the way."* A hold gesture puts a thumb over the thing it reveals. Tap-to-pin
 * leaves the screen clear, and it is also the only version that works with a mouse and with a
 * keyboard.
 *
 * **Description BELOW, group label ABOVE.** Both slots are reserved at all times, empty or not,
 * so nothing on the page moves when a chip is pinned. A marquee that shoves the button down
 * every time you touch it is a marquee people stop touching.
 *
 * **Release resumes.** Nothing here is a mode. There is no state a person can get stuck in, and
 * no "play" control to find — let go and it carries on.
 *
 * `prefers-reduced-motion` turns the animation off entirely and leaves a normally scrollable
 * row: automatic horizontal movement is a genuine accessibility problem for some people, and
 * this is the one component on the screen that moves.
 */

const ORDER: AppKey[] = [
  "onescore", "onejob", "oneevent", "onesocial", "oneagent", "onehome", "onepay", "onebusiness",
  "onevoice", "onepage", "oneapp",
];

const LINE: Record<AppKey, string> = {
  onescore:  "Credibility you can prove, in one number",
  onejob:    "Get hired and get paid, with the money held safe",
  oneevent:  "Host events and sell tickets, or find one to go to",
  onesocial: "A professional network built on proof, not followers",
  oneagent:  "An agent who works the deal and brings you the offer",
  /* ONE line for ONE app. It has to carry both halves without listing them as products, because
     the marquee is a launcher — "rent or buy" is the segment strip's job once they are inside. */
  onehome:   "Rent or buy a place, with a real contract and the whole history",
  /* The two sections keep a line only so the `Record<AppKey, string>` stays total. Nothing
     iterates them — `ORDER` above is the six apps and the three services. */
  onerental: "Rent a place with a real contract, not a chat thread",
  onesale:   "Buy and sell property with the whole history in one place",
  onevoice:  "An AI receptionist that answers your phone, day or night",
  onepage:   "A website that actually brings you customers",
  oneapp:    "Your own customer app, without building one",
  onepay:      "Take a payment on your phone and keep every receipt in one place",
  onebusiness: "Every service you buy from us — calls, website, leads — in one account",
};

/** Pixels per second. Slow enough to read a name without effort, fast enough to feel alive. */
const SPEED = 26;
/** How long after your finger leaves before it starts drifting again. Lee: *"if you let go for a
 *  second, I'm continuing my little marquee thing."* */
const RESUME_MS = 1000;
/**
 * How quickly a flick bleeds off — expressed PER SECOND, not per frame.
 *
 * It was `velocity *= 0.94` once per animation frame, and that is a real defect rather than a
 * tidy-up: the amount of glide then depends entirely on how fast the device paints. On a 120Hz
 * phone a flick dies in half the distance it travels on a 60Hz one, and under a headless browser
 * running at ~10fps the same flick coasts for several seconds. Same code, three different feels.
 *
 * 0.94 per 16ms is 0.94^62.5 ≈ 0.021 per second, so the constant below is that same curve
 * expressed in real time and then applied as `pow(RETAINED, dt)`. Identical at 60Hz, and now
 * identical everywhere else too.
 */
const FRICTION_RETAINED_PER_SEC = 0.021;
/** Below this (px/sec) the glide has stopped mattering and the strip is treated as still. */
const VELOCITY_FLOOR = 3;

export default function ProductMarquee() {
  const { lang } = useI18n();
  const [pinned, setPinned] = useState<AppKey | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  /* Offset lives in a ref, not in state: this updates every animation frame and re-rendering
     React 60 times a second to move a transform would be the whole CPU budget of the screen. */
  const offset = useRef(0);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, off: 0 });
  const moved = useRef(false);
  const loopWidth = useRef(0);
  /** Flick velocity, px/frame, and when the finger last left. Both drive the glide-then-resume. */
  const velocity = useRef(0);
  const lastMove = useRef({ x: 0, t: 0 });
  const releasedAt = useRef(0);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (el) loopWidth.current = el.scrollWidth / 2;   // the list is rendered twice
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const reduced = typeof matchMedia === "function"
      && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000;   // clamp: a backgrounded tab must not lurch
      last = now;

      /* ── DRAG, GLIDE, THEN RESUME ─────────────────────────────────────────────────────────
         Lee, 4 Aug 2026: *"I can move it with my thumb a little bit, but not really. I should be
         able to free-move it... and then after you stop touching it for like a second, it
         continues. Right now it's very glitchy, you can't really slide it with any fluidity."*

         Three things were wrong and only one of them was the drag maths:

         1. THE AUTO-SCROLL KEPT RUNNING UNDER THE FINGER. `dragging` gated the drift, but the
            pointer handler wrote an ABSOLUTE offset from the press point every move — so the two
            fought each other and the strip stuttered instead of tracking. The drag is now
            incremental: each move adds its own delta, so nothing else can move the strip while a
            finger is on it.
         2. NO INERTIA. Letting go stopped it dead, which on a touch surface reads as broken
            rather than as precise. A flick now carries and bleeds off.
         3. IT RESUMED INSTANTLY. The moment the finger lifted, the drift took over and yanked the
            strip out from under the thing you were about to tap. There is now a second of quiet
            first — his number, and it is the right one. */
      if (dragging.current) {
        /* Nothing here: the pointer handler owns the offset while a finger is down. */
      } else if (pinned) {
        velocity.current = 0;
      } else if (Math.abs(velocity.current) > VELOCITY_FLOOR) {
        offset.current += velocity.current * dt;
        velocity.current *= Math.pow(FRICTION_RETAINED_PER_SEC, dt);
      } else if (now - releasedAt.current > RESUME_MS) {
        offset.current -= SPEED * dt;
      }
      const w = loopWidth.current || 1;
      /* Wrap in BOTH directions. Dragging right walks the offset positive, and a one-sided
         modulo would leave a blank gap the moment somebody scrubbed backwards. */
      if (offset.current <= -w) offset.current += w;
      if (offset.current > 0) offset.current -= w;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${offset.current}px,0,0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pinned]);

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    velocity.current = 0;
    dragStart.current = { x: e.clientX, off: offset.current };
    lastMove.current = { x: e.clientX, t: performance.now() };
    /* NOT captured here — see `onMove`. Capturing on press retargets every following pointer
       event to the capture element, so the `click` fires on the CONTAINER instead of the chip and
       tap-to-pin stops working entirely. Capture only once a real drag has begun. */
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    /* INCREMENTAL, not absolute-from-the-press-point. One-to-one with the finger, and immune to
       anything else that touches the offset mid-gesture. */
    const dx = e.clientX - lastMove.current.x;
    offset.current += dx;

    if (!moved.current && Math.abs(e.clientX - dragStart.current.x) > 4) {
      moved.current = true;
      /* NOW capture — the gesture is unambiguously a drag, so there is no click left to protect.
         Without capture a fast flick dies the instant the finger crosses out of a 90px-tall band,
         which is most of what "it fights me" was. */
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }

    const now = performance.now();
    const dt = Math.max(now - lastMove.current.t, 1);
    /* px per SECOND, smoothed — a raw last-sample velocity turns one jittery pixel into a
       launch. Seconds rather than frames so the glide is the same on every refresh rate. */
    velocity.current = velocity.current * 0.35 + (dx / dt) * 1000 * 0.65;
    lastMove.current = { x: e.clientX, t: now };
  };

  const onUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    releasedAt.current = performance.now();
    /* A slow, deliberate drag should stop where you put it; only a real flick should glide.
       1.2px per 16ms frame in the old units — 75px/sec. */
    if (Math.abs(velocity.current) < 75) velocity.current = 0;
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch { /* ignore */ }
    /* Scrubbing is not choosing. Releasing after a drag resumes rather than pinning whatever
       happened to be under the finger. */
    if (moved.current) setTimeout(() => { moved.current = false; }, 0);
  };

  const active = pinned;
  const group = active ? (IS_SERVICE[active] ? "Services" : "Apps") : null;

  return (
    /* `w-full min-w-0` is not decoration. The track inside is `w-max` — deliberately wider than
       the screen — and a flex item sizes to its CONTENT by default, so without an explicit width
       and `min-w-0` the clipping box grew to the full width of the track and dragged the whole
       page out to about 1200px. The marquee stopped being a marquee and became a very wide row.
       Belt and braces on the clipping box below too. */
    <div className="w-full min-w-0 select-none">
      {/* GROUP LABEL — reserved height, so pinning never moves the page. */}
      {/* Fixed height so pinning cannot move the page — which means the label has to FIT on one
          line. "Six apps · Three services · One sign-in" wrapped at 420px and the second line
          ran under the chips. The One ID badge above already says "one sign-in", so the tail was
          repetition anyway; dropping it makes the line fit and the page quieter. */}
      <p className="h-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] opacity-45">
        {group ?? <span className="opacity-60">{sc(lang, "groups")}</span>}
      </p>

      <div
        className="relative mt-2 w-full min-w-0 overflow-hidden"
        /* Fade the two ends rather than cutting them — a chip sliced by a hard edge reads as a
           layout bug, and the fade is what tells you there is more in both directions. */
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
        }}
        /* `onPointerLeave` is GONE. With pointer capture the pointer never "leaves", and keeping
           the handler meant a fast flick that crossed the strip's edge ended the drag early —
           the exact "it fights me" symptom. */
        onPointerDown={onDown} onPointerMove={onMove}
        onPointerUp={onUp} onPointerCancel={onUp}
        
      >
        <div ref={trackRef} className="flex w-max items-center gap-2.5 will-change-transform">
          {/* Twice, so the wrap has something to wrap INTO. `aria-hidden` on the second copy so
              a screen reader is not read the whole ecosystem twice. */}
          {[0, 1].map(copy => (
            ORDER.map(k => {
              const on = active === k;
              return (
                <button
                  key={`${copy}-${k}`}
                  aria-hidden={copy === 1 || undefined}
                  tabIndex={copy === 1 ? -1 : 0}
                  onClick={() => { if (!moved.current) setPinned(p => (p === k ? null : k)); }}
                  className={`ow-tap flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 transition-[transform,background-color,border-color] duration-200 ${
                    on
                      ? "scale-[1.12] border-brand/40 bg-brand/10"
                      : "border-ink/10 bg-ink/[0.03] dark:border-white/10 dark:bg-white/[0.05]"
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: PRODUCT_BRAND[k].dot }} />
                  <span className={`whitespace-nowrap text-[13.5px] leading-none ${on ? "font-extrabold" : "font-bold"}`}>
                    {PRODUCT_BRAND[k].name}
                  </span>
                </button>
              );
            })
          ))}
        </div>
      </div>

      {/* DESCRIPTION — two lines of reserved height, for the same no-jump reason. */}
      {/* Lee: *"it's too close to the small text at the bottom — the small text is literally
          suffocating the definitions of the various apps."* */}
      <p className="mt-3 flex h-9 items-start justify-center px-2 text-center text-[12.5px] leading-snug opacity-60">
        {active ? LINE[active] : <span className="opacity-70">{sc(lang, "marqueeHint")}</span>}
      </p>
    </div>
  );
}
