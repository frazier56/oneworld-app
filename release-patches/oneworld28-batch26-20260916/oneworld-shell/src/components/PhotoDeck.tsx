import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { W, WA, type Localized } from "../lib/i18n";
import { makeDerivatives, thumbPath, thumbFor } from "../lib/imageDerivatives";

/**
 * PHOTO DECK — up to 50 photos, reorderable, with slot 1 as the cover.
 * ============================================================================================
 * Lee, 11 Aug 2026: *"They should be able to arrange their pictures, like dragging and dropping
 * them and moving them around… but there's always a primary picture. They can drag that picture
 * up to the very corner and say, whatever picture is here, that's gonna be the main picture that
 * shows, the display picture."*
 *
 * So: position 1 IS the cover. No separate "make this the cover" flag anywhere in the data —
 * `photos[0]` is the cover on the feed card, the profile tile and the search result, and the only
 * way to change it is to move a photo to the front. One fact, one place, nothing to keep in sync.
 *
 * ── TOUCH-AND-HOLD DRAG, AND WHY THE FIRST VERSION DIDN'T HAVE IT ───────────────────────────
 * Lee, 11 Aug 2026: *"I would rather it be a drag and drop where you touch and hold it and you
 * drag and drop it around."*
 *
 * The first version used the HTML5 drag events, which on iOS Safari do not fire at all — so on the
 * device this form is actually filled in on, "drag" meant nothing and only the ‹ › nudges worked.
 * This version uses Pointer Events, which are the same API for mouse, pen and finger.
 *
 * The whole difficulty is telling a DRAG from a SCROLL, because both start as a finger going down
 * on a photo. The answer is time, not distance: hold still for 260ms and it is a drag; move first
 * and it is a scroll. That is the same contract as reordering a home-screen icon, so nobody has to
 * learn it. Concretely:
 *   · pointerdown arms a 260ms timer and records the origin.
 *   · a move of more than 10px before the timer fires cancels it — the page scrolls, untouched.
 *   · when the timer fires we take pointer capture, buzz once if the device can, and from then on
 *     the grid gets `touch-action: none` so the page cannot scroll out from under the drag.
 *   · while dragging, the tile under the finger is hit-tested from live rects and the array is
 *     reordered as you go, so the layout under your finger is always the result you will get.
 *
 * The tap route (‹ › and "Cover") stays. It is the only route for anyone who cannot press-and-drag
 * on a moving bus, and it costs one row of chrome.
 *
 * ── THE COVER RING ──────────────────────────────────────────────────────────────────────────
 * Lee: *"the cover should also be highlighted with a little ring around it with a darker color,
 * probably like dark teal."* `--teal-depth` (#0F766E) is that colour and it is already the
 * family's dark teal anchor, so the ring is a token rather than a new hex.
 *
 * ── PICTURE QUALITY, AND THE STORAGE STRATEGY BEHIND IT ─────────────────────────────────────
 * Lee, 11 Aug 2026: *"Whatever Instagram or Facebook does… they probably got billions of files.
 * We need to do the same thing… They don't have to be ultra high resolution, but they don't need
 * to be blurry on a cell phone."*
 *
 * So each upload writes TWO objects, which is exactly what those sites do: a display image with
 * its longest edge bounded at 2,560px, and a 512px thumbnail beside it. The grid loads
 * thumbnails; the fullscreen viewer loads the display image. The full reasoning, and the
 * arithmetic showing 2,560px is double what the widest phone can resolve, is in
 * `lib/imageDerivatives.ts`.
 *
 * The effect on this form: fifty photographs go from roughly 250 MB of originals to about 20 MB,
 * and nobody can see the difference on a phone. If the browser cannot decode the file at all — a
 * raw HEIC on a desktop is the real case — the ORIGINAL is uploaded untouched rather than the
 * photograph being lost.
 *
 * ── THE PROGRESS BAR, AND WHY THIS SCREEN GETS ONE ──────────────────────────────────────────
 * Lee, 11 Aug 2026: *"one of my pictures took a long time to load… there was no thinking. It
 * didn't say uploading or nothing. It just… the screen just froze, and you should put some type of
 * thinking thing to say uploading and maybe a progress bar."*
 *
 * OneJob's convention is a binary word swap — `{attaching ? "Uploading…" : "Add a file"}` — and it
 * is right there, because OneJob attaches ONE document. This screen takes fifty photographs off a
 * phone camera, re-encodes each one on the main thread, and writes two objects per file. That is
 * not one operation with unknown duration; it is fifty operations with a known count. A spinner
 * for a known count is withholding information the user can act on ("this is going to take a
 * while, I'll leave it running"). So: the count, the current filename, and a determinate bar.
 *
 * The uploads run three at a time. Sequential was costing the round-trip latency of fifty
 * uploads end to end; unbounded would have fifty encodes competing for the same main thread and
 * make the freeze worse rather than better. Results are written back BY INDEX, so the deck ends
 * up in the order the files were chosen no matter which upload finishes first.
 */

/* ── THE MENU SPEAKS EVERY LANGUAGE THE APP OFFERS (Max C-4, 12 Sep 2026) ────────────────
   *"German controls fall back to English because W selects only English/Spanish."* True, and a
   member who taps the German flag and gets English back concludes the app is broken. These live
   beside the control rather than in the shipped dictionaries, so the frozen locale release is
   untouched. English is required; everything else degrades to it. */
const MENU_COPY = {
  options:  { en: "Photo options", es: "Opciones de la foto", co: "Opciones de la foto", de: "Fotooptionen", ru: "Параметры фото", zh: "照片选项", pt: "Opções da foto" },
  backward: { en: "Move backward", es: "Mover atrás", co: "Mover atrás", de: "Nach hinten", ru: "Назад", zh: "向前移动", pt: "Mover para trás" },
  forward:  { en: "Move forward", es: "Mover adelante", co: "Mover adelante", de: "Nach vorn", ru: "Вперёд", zh: "向后移动", pt: "Mover para frente" },
  cover:    { en: "Make cover photo", es: "Poner como portada", co: "Poner como portada", de: "Als Titelbild", ru: "Сделать обложкой", zh: "设为封面", pt: "Definir como capa" },
  remove:   { en: "Delete", es: "Eliminar", co: "Eliminar", de: "Löschen", ru: "Удалить", zh: "删除", pt: "Excluir" },
  close:    { en: "Close", es: "Cerrar", co: "Cerrar", de: "Schließen", ru: "Закрыть", zh: "关闭", pt: "Fechar" },
} satisfies Record<string, Localized>;

/** Half the sheet it replaced. Lee: *"you could cut it in half vertically and wouldn't miss
 *  anything."* Wide enough for "Make cover photo" in German, which is the longest string it has. */
const MENU_W = 208;

const MAX_PHOTOS = 50;
/** Generous enough for a RAW-ish phone export, small enough that one bad file cannot fill a bucket. */
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
/** Three at a time — see the note above on why neither 1 nor ∞ is right. */
const LANES = 3;
/** Hold this long without moving and it becomes a drag. Shorter than this and scrolling misfires. */
const HOLD_MS = 220;
/**
 * Move further than this before the hold completes and it was a scroll all along.
 *
 * Raised from 10px to 16px on 11 Aug 2026. Lee: *"you touch and hold it, and it's like it's just
 * not sticking very well. It releases the picture."* 10px is under the width of a fingertip's own
 * wobble — a finger resting still on glass reports 4–12px of jitter, so the hold was being
 * cancelled before it ever completed and the drag never armed. 16px is above the noise floor and
 * still well below a deliberate scroll.
 */
const SLOP_PX = 24;

type Progress = { done: number; total: number; name: string } | null;

export default function PhotoDeck({
  photos, onChange, folder, lang, max = MAX_PHOTOS,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  /** Storage prefix under the member's own id, e.g. `rentals`. Keeps one member's uploads together. */
  folder: string;
  lang: string;
  max?: number;
}) {
  const [progress, setProgress] = useState<Progress>(null);
  const [err, setErr] = useState<string | null>(null);
  const busy = progress !== null;

  /* `useOneId` is not imported here on purpose — it would make this component require an identity
     provider in every test that renders it. The uploader reads the session directly instead. */
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(r => setUid(r.data.user?.id ?? "")); }, []);

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return;
    const next = [...photos];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };

  async function add(files: FileList | null) {
    if (!files || !uid) return;
    setErr(null);

    const room = max - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) {
      setErr(W(lang, `You can add ${room} more — the limit is ${max}.`,
                     `Puede agregar ${room} más — el límite es ${max}.`));
    }

    /* Reject the unusable up front, so the count in the progress bar is the number of files that
       are actually going to be uploaded. A bar that counts files it is about to skip is a bar that
       lies. */
    const queue: File[] = [];
    for (const f of picked) {
      const ext = (f.name.split(".").pop() ?? "").toLowerCase();
      if (!ALLOWED.includes(ext)) {
        setErr(W(lang, `"${f.name}" isn't a photo we can use. Try JPG, PNG, WEBP or HEIC.`,
                       `"${f.name}" no es una foto que podamos usar. Use JPG, PNG, WEBP o HEIC.`));
        continue;
      }
      if (f.size > MAX_BYTES) {
        setErr(W(lang, `"${f.name}" is ${(f.size / 1048576).toFixed(0)} MB — the limit is 25 MB.`,
                       `"${f.name}" pesa ${(f.size / 1048576).toFixed(0)} MB — el límite es 25 MB.`));
        continue;
      }
      queue.push(f);
    }
    if (queue.length === 0) return;

    setProgress({ done: 0, total: queue.length, name: queue[0].name });

    const out: (string | null)[] = new Array(queue.length).fill(null);
    let cursor = 0;
    let done = 0;
    let fatal: string | null = null;

    const one = async (i: number) => {
      const f = queue[i];
      const ext = (f.name.split(".").pop() ?? "").toLowerCase();
      /* Bound + re-encode before anything leaves the phone. `null` means either the browser
         could not decode it, or the conversion produced a BLANK canvas — and in both cases the
         original goes up untouched.

         That second case is new on 12 Aug and it is the fix for Lee's first listing photo, which
         stored as a valid 2560×1920 WebP containing 4.9 million fully transparent pixels and
         nothing else. `makeDerivatives` now checks its own output and refuses to return an empty
         picture, so what reaches storage is his actual photograph, unprocessed. A photograph we
         cannot shrink is still better than a photograph we refused — and very much better than a
         blank rectangle nobody notices until it is on the listing. */
      const d = await makeDerivatives(f);
      const outExt = d ? d.ext : ext;
      const stem = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const path = `${stem}.${outExt}`;

      const { error } = await supabase.storage.from("media")
        .upload(path, d ? d.display : f, { upsert: false, contentType: d ? d.type : f.type });
      if (error) { fatal = error.message; return; }

      /* The thumbnail is written beside it under the `-t` convention, and its failure is NOT
         fatal: `thumbFor()` falls back to the display image, so a listing whose thumbnails did
         not write is slower to draw and still completely correct. */
      if (d?.thumb) {
        await supabase.storage.from("media")
          .upload(thumbPath(path), d.thumb, { upsert: false, contentType: d.type });
      }
      out[i] = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    };

    const lane = async () => {
      while (cursor < queue.length && !fatal) {
        const i = cursor++;
        try { await one(i); } catch (e: any) { fatal = e?.message ?? String(e); }
        done++;
        setProgress({ done, total: queue.length, name: queue[Math.min(cursor, queue.length - 1)].name });
      }
    };

    await Promise.all(Array.from({ length: Math.min(LANES, queue.length) }, lane));

    /* Whatever DID upload is kept, in the order it was chosen. Losing eleven good photographs
       because the twelfth failed would be the worst possible response to a flaky connection. */
    const landed = out.filter(Boolean) as string[];
    if (landed.length) onChange([...photos, ...landed]);
    if (fatal) setErr(fatal);
    setProgress(null);
  }

  return (
    <Deck photos={photos} onChange={onChange} lang={lang} max={max}
      busy={busy} progress={progress} err={err} add={add} move={move} ready={uid !== null} />
  );
}

function Deck({
  photos, onChange, lang, max, busy, progress, err, add, move, ready,
}: {
  photos: string[]; onChange: (n: string[]) => void; lang: string; max: number;
  busy: boolean; progress: Progress; err: string | null;
  add: (f: FileList | null) => void; move: (a: number, b: number) => void; ready: boolean;
}) {
  const cover = W(lang, "Cover", "Portada");

  /* ── ONE CONTROL PER TILE (Batch C · Airbnb round 2, 12 Sep 2026) ────────────────────────
     Lee, seeing the old tile: *"you got the cover, you got an x, you got... supposed to have
     three dots. You got six dots. I don't know why you have six dots... Airbnb only had three
     dots, and that's it. The x to delete it was inside the three dots. Everything was inside the
     three dots."*

     He is right and the old tile proves it: a hundred-pixel square carried FOUR separate control
     clusters — a close cross, a six-dot drag grip, and a bottom bar holding a left nudge, a Cover
     button and a right nudge. Six affordances on a photograph, none of them big enough to hit
     confidently, all of them covering the thing the host is trying to look at.

     Airbnb's tile has ONE: a small, quiet three-dot button in a corner, and every action lives
     behind it. That is what this is. The photograph is the interface; the controls step back.

     `menuAt` is the index whose menu is open, or null. One at a time, by construction. */
  const [menuAt, setMenuAt] = useState<number | null>(null);

  /* ── CLOSING IT WITHOUT BREAKING IT (Max C-1, 12 Sep 2026) ────────────────────────────
     *"Document capture-phase pointerdown closes the menu before its action click. Make-cover
     fails at 320, 390 and 1280 pixels. Correct outside-click containment using trigger/menu
     references or composedPath; bubble stopPropagation cannot fix the capture handler."*

     He is exactly right and the reasoning is worth keeping, because it is a whole family of bug.
     The first version put `stopPropagation` on the menu's own `onPointerDown` — a BUBBLE-phase
     handler — against a document listener registered in the CAPTURE phase. Capture runs first, top
     down, so the document closed the menu before the event ever reached the menu to be stopped.
     React then unmounted it, and the click that would have fired the action landed on nothing.
     Every item looked tappable and did nothing, which is the worst shape of defect there is: a
     control that half works.

     Containment by REFERENCE fixes it regardless of phase. `composedPath` is used where available
     so a tap inside a shadow root still resolves to the menu; `contains` is the fallback. */
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef(new Map<number, HTMLButtonElement>());
  useEffect(() => {
    if (menuAt === null) return;
    const inside = (e: Event) => {
      const path = typeof (e as any).composedPath === "function" ? (e as any).composedPath() as EventTarget[] : [];
      const t = e.target as Node | null;
      const hit = (el: Element | null | undefined) =>
        !!el && (path.includes(el) || (!!t && el.contains(t)));
      return hit(menuRef.current) || hit(triggerRefs.current.get(menuAt));
    };
    const close = (e: Event) => { if (!inside(e)) setMenuAt(null); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuAt(null);
      /* Focus goes back where it came from, or it lands on <body> and the next Tab restarts the
         page (Max C-3). */
      triggerRefs.current.get(menuAt)?.focus();
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close, true); document.removeEventListener("keydown", key); };
  }, [menuAt]);

  /** Close, and put focus back on the trigger that opened it. */
  const closeMenu = (i: number) => { setMenuAt(null); triggerRefs.current.get(i)?.focus(); };

  /* ── IT BELONGS TO ITS OWN PHOTO (Lee, 12 Sep 2026) ───────────────────────────────────
     The first correction for Max's clipping finding was a full-width bottom sheet. It solved the
     clipping and lost the thing that made the control legible: *"the whole right side of that
     popup menu is blank. It's just white space... you could cut it in half vertically. And the
     value is that you could relate it to the actual photo it pertains to versus just in the
     middle of the screen randomly. It should be at the top right wherever the three dots are."*

     He is right on both counts. Half that width was empty, and a sheet in the middle of the screen
     does not say WHICH of five photographs it is about — which is the entire question when the
     grid is full.

     So it is anchored to its trigger again, but it still lives in a PORTAL, which is what actually
     fixed Max's C-2: the tile keeps `overflow-hidden` to round the photograph, so anything drawn
     inside it is cut at the edge no matter how narrow it is.

     ⚠️ AN ANCHORED POPOVER HAS TO BE RE-MEASURED, and forgetting that is how one ends up off
     screen — the exact failure I warned about when arguing for the sheet. So the rect is
     recomputed on scroll and on resize, both captured so a scrolling ANCESTOR counts, and it is
     clamped to the viewport on both axes and flipped above the trigger when it would fall off the
     bottom. */
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (menuAt === null) { setAnchor(null); return; }
    const place = () => {
      const el = triggerRefs.current.get(menuAt);
      const box = menuRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) {
        el.focus({ preventScroll: true });
        setMenuAt(null);
        return;
      }
      const w = box?.offsetWidth || MENU_W;
      const h = box?.offsetHeight || 0;
      const gutter = 8;
      /* Right edge of the menu meets the right edge of the dots, so it opens INTO the photo
         rather than off the side of it. */
      let left = r.right - w;
      left = Math.max(gutter, Math.min(left, window.innerWidth - w - gutter));
      let top = r.bottom + 6;
      if (h && top + h > window.innerHeight - gutter) top = Math.max(gutter, r.top - h - 6);
      top = Math.max(gutter, Math.min(top, window.innerHeight - h - gutter));
      setAnchor({ top, left });
    };
    place();
    /* A second pass once the menu has been measured for real — the first runs before it exists. */
    const id = window.requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [menuAt]);

  /* ── IT WORKS WITHOUT A MOUSE (Max C-3, 12 Sep 2026) ──────────────────────────────────
     *"Enter opens the menu but leaves focus on the trigger. Implement first-enabled-item focus,
     arrows, Home/End, Escape and return focus... Role attributes alone are insufficient."*

     He is right that `role="menu"` is a promise, not a behaviour. A menu a keyboard cannot enter
     is a menu a keyboard user cannot use, and it is also how the whole control behaves for anyone
     driving the page with a switch or a screen reader.

     DISABLED ITEMS ARE SKIPPED, not merely un-clickable: arrowing onto "Move backward" on the
     cover photo and finding the key does nothing is the same dead-control problem in another
     costume. Escape lives in the document handler above so it works from the scrim too. */
  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);
  useEffect(() => {
    if (menuAt === null) return;
    /* After paint: the portal is not in the document during this effect's own tick. */
    const id = window.setTimeout(() => menuItems()[0]?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [menuAt]);
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = menuItems();
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (n: number) => { e.preventDefault(); items[Math.max(0, Math.min(items.length - 1, n))]?.focus(); };
    if (e.key === "ArrowDown") return go(at < 0 ? 0 : (at + 1) % items.length);
    if (e.key === "ArrowUp") return go(at <= 0 ? items.length - 1 : at - 1);
    if (e.key === "Home") return go(0);
    if (e.key === "End") return go(items.length - 1);
    if (e.key === "Tab" && menuAt !== null) closeMenu(menuAt);
  };


  /* ── THE DRAG MACHINE ────────────────────────────────────────────────────────────────────
     `dragIdx` is the index currently under the finger, and it MOVES as the array is reordered —
     it is a position, not an identity. Everything else is a ref, because re-rendering on every
     pointermove at 120Hz is how a drag turns into a stutter. */
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  /* State paints the highlight; this ref drives the gesture synchronously. Waiting for React to
     render between two pointermove events was the source of the mobile "it won't follow me" lag. */
  const dragPosition = useRef<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number; i: number } | null>(null);
  const armed = useRef(false);
  /** The pointer we are tracking. Null the moment it lifts or is cancelled. */
  const pointer = useRef<number | null>(null);
  const tiles = useRef(new Map<number, HTMLDivElement>());
  const grid = useRef<HTMLDivElement | null>(null);
  const restoreTouch = useRef<null | (() => void)>(null);

  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    armed.current = false;
    origin.current = null;
  };
  const endDrag = () => {
    pointer.current = null;
    cancelHold();
    setDragIdx(null);
    dragPosition.current = null;
    restoreTouch.current?.();
    restoreTouch.current = null;
  };
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    restoreTouch.current?.();
  }, []);

  /** Which tile is the pointer over? Read live rects — the tiles have just moved. */
  const hitTest = (x: number, y: number): number | null => {
    for (const [i, el] of tiles.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent, i: number) => {
    /* A secondary mouse button is a context menu, not a drag. */
    if (e.button !== 0 && e.pointerType === "mouse") return;
    /* The arrow, cover and remove buttons live inside the draggable tile. Pointer capture on the
       tile would retarget their release and swallow the click, making every visible tap control
       look live while doing nothing. Controls own their press; only the photograph starts a hold. */
    if ((e.target as HTMLElement).closest("button")) return;
    origin.current = { x: e.clientX, y: e.clientY, i };
    const target = e.currentTarget as HTMLElement;
    const pid = e.pointerId;
    pointer.current = pid;

    /* ── CAPTURE ON PRESS, NOT ON ARM ──────────────────────────────────────────────────────
       This is the bug Lee felt as "it releases the picture".

       Capture used to be taken inside the timer, 260ms after the finger landed. In those 260ms the
       browser owns the gesture, and the moment the finger moves a hair it may hand the stream to
       the scroller and fire `pointercancel` at us — so the timer fired against an element that no
       longer had the pointer, `setPointerCapture` threw into the empty catch, and the tile
       "let go" exactly as he describes.

       Taking capture immediately keeps every subsequent move and up event addressed to this tile,
       which is what makes the hold survive a slightly unsteady finger. It does NOT stop the page
       scrolling — `touch-action` still governs that, and it is only set to `none` once the drag
       genuinely arms — so a press-then-swipe still scrolls the page normally. */
    try { target.setPointerCapture(pid); } catch { /* capture is best-effort */ }

    holdTimer.current = setTimeout(() => {
      /* The finger may have lifted while we waited. Arming a drag for a pointer that is gone
         leaves a tile stuck to the cursor until the next tap. */
      if (pointer.current !== pid) return;
      armed.current = true;
      /* Apply the no-scroll state synchronously, before the finger's first drag movement. Waiting
         for React's next paint lets Android hand the gesture to page scrolling and cancel it. */
      if (grid.current) grid.current.style.touchAction = "none";
      const y = window.scrollY;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      restoreTouch.current = () => {
        if (grid.current) grid.current.style.touchAction = "";
        document.body.style.overflow = previousOverflow;
        window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
      };
      setDragIdx(i);
      dragPosition.current = i;
      try { navigator.vibrate?.(8); } catch { /* not everywhere, never important */ }
    }, HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!armed.current) {
      /* Still deciding. A real move means they meant to scroll. Measured as true distance rather
         than per-axis: a 15px diagonal drift used to pass both axis tests and cancel nothing,
         while a 17px vertical one cancelled — the threshold was a square, not a circle. */
      const o = origin.current;
      if (!o) return;
      const dx = e.clientX - o.x, dy = e.clientY - o.y;
      if (Math.sqrt(dx * dx + dy * dy) > SLOP_PX) cancelHold();
      return;
    }
    const current = dragPosition.current;
    if (current === null) return;
    e.preventDefault();
    const over = hitTest(e.clientX, e.clientY);
    if (over !== null && over !== current) {
      move(current, over);
      dragPosition.current = over;
      setDragIdx(over);
    }
  };

  return (
    <div>
      {/* `touch-action: none` ONLY while dragging. Setting it permanently would kill the page
          scroll every time a finger landed on a photo, which is most of the time. */}
      {/* ── TWO COLUMNS, AND THE COVER SPANS BOTH ──────────────────────────────────────
          Was three columns. Lee: *"the pictures are larger, which gives it more space... let's
          make it two columns, make the pictures larger."* Three columns on a 390px phone is a
          108px tile, which is smaller than the photograph's own subject and far too small to
          carry any control at all — which is how the tile ended up with six of them fighting.

          The cover spans both columns, the way it does in Airbnb's manager and on our own
          published listing. The layout IS the hierarchy: the host sees which photograph is doing
          the selling without reading a badge. */}
      <div ref={grid} className="grid grid-cols-2 gap-2.5"
        style={dragIdx !== null ? { touchAction: "none" } : undefined}>
        {/* ADD is FIRST, always in the same place. A tile that moves as the deck grows is a tile
            people hunt for. */}
        <label className={`ow-tap grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed p-2 text-center transition ${
          photos.length >= max || busy ? "border-ink/15 opacity-60 dark:border-white/15" : "border-ink/25 hover:border-brand dark:border-white/25"}`}>
          <input type="file" accept="image/*" multiple className="hidden"
            disabled={busy || !ready || photos.length >= max}
            onChange={e => { add(e.target.files); e.currentTarget.value = ""; }} />
          {busy && progress ? (
            /* The word first, then the count, then the bar. Somebody who glances at this for half
               a second needs to leave with "it's working and it isn't stuck". */
            <span className="flex w-full flex-col items-center gap-1">
              <Spinner />
              <span className="text-[10.5px] font-black uppercase tracking-wide opacity-70">
                {W(lang, "Uploading", "Subiendo")}
              </span>
              <span className="text-[11px] font-bold tabular-nums opacity-60">
                {progress.done} / {progress.total}
              </span>
              <span className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-ink/10 dark:bg-white/15">
                <span className="block h-full rounded-full bg-brand transition-[width] duration-200"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </span>
            </span>
          ) : (
            /* ⚠️ ONE STRING, AND IT MAY NOT WRAP. Lee photographed this stacked onto THREE lines
               on a phone — the plus, then the count, then the maximum — inside a tile that is a
               third of a narrow screen wide. `{photos.length}/{max}` is three separate text nodes,
               and a browser is entitled to break between any of them.

               A template literal makes it one unbreakable token, `whitespace-nowrap` forbids the
               break outright, and `tabular-nums` stops the tile twitching as the count goes from
               9 to 10. Belt, braces and a third thing, because this is a tile that gets narrower
               on every smaller phone and there is no width at which "0 / 50" reading as three
               lines is acceptable. */
            <span className="flex flex-col items-center gap-1 text-[11.5px] font-bold opacity-60">
              <span className="text-xl leading-none">+</span>
              <span className="whitespace-nowrap tabular-nums">{`${photos.length}/${max}`}</span>
            </span>
          )}
        </label>

        {photos.map((src: string, i: number) => (
          <div key={src}
            ref={el => { if (el) tiles.current.set(i, el); else tiles.current.delete(i); }}
            onPointerDown={e => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onContextMenu={e => { if (dragIdx !== null) e.preventDefault(); }}
            className={`group relative select-none overflow-hidden rounded-xl border transition ${
              i === 0 ? "col-span-2 aspect-[4/3]" : "aspect-square"} ${
              dragIdx === i
                ? "z-10 scale-[1.03] border-brand shadow-xl ring-2 ring-brand/50"
                : i === 0
                  ? "border-transparent ring-2 ring-[var(--teal-depth)] ring-offset-2 ring-offset-paper dark:ring-offset-ink"
                  : "border-ink/[0.08] dark:border-white/10"}`}
            style={{ WebkitTouchCallout: "none" } as any}>
            <Thumb src={src} />

            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide text-white backdrop-blur-sm"
                style={{ background: "var(--teal-depth)" }}>
                {cover}
              </span>
            )}

            {/* ── THE ONLY CONTROL ON THE TILE ────────────────────────────────────────────
                Quiet by design: a white disc with three small dots, the way Airbnb's is. It sits
                in the corner and does not compete with the photograph. Everything a host can do
                to a photo is behind it, so there is exactly one thing to learn and one thing to
                hit — and at forty-four pixels it is a real touch target rather than the
                twenty-four-pixel cross it replaces.

                Hidden while a drag is in flight so the tile under the finger is a clean picture. */}
            {dragIdx === null && (
              <button type="button" data-testid={`photo-menu-${i}`}
                ref={el => { if (el) triggerRefs.current.set(i, el); else triggerRefs.current.delete(i); }}
                aria-haspopup="menu" aria-expanded={menuAt === i}
                aria-label={WA(lang, MENU_COPY.options)}
                /* The tile beneath arms a press-and-hold drag on pointerdown; without this the
                   button's own press would start dragging the photo instead of opening a menu. */
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setMenuAt(menuAt === i ? null : i); }}
                className="ow-tap absolute right-2 top-2 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur-sm dark:bg-ink/80 dark:text-paper">
                {/* VERTICAL. Lee, 12 Sep 2026: *"three dots is not horizontal three dots."* The
                    vertical stack is the overflow-menu glyph every phone platform uses; laid on
                    its side it reads as a loading indicator. */}
                <span aria-hidden className="flex flex-col gap-[3px]">
                  {[0, 1, 2].map(n => <i key={n} className="block h-[3.5px] w-[3.5px] rounded-full bg-current" />)}
                </span>
              </button>
            )}

            {menuAt === i && createPortal(
              /* Portalled, so the tile's `overflow-hidden` cannot clip it (Max C-2); anchored and
                 clamped by the effect above, so it belongs to this photograph and stays on screen
                 (Lee, 12 Sep). `visibility` rather than a conditional render for the first frame:
                 the menu has to EXIST to be measured, and it must not be seen at 0,0 first. */
              <div ref={menuRef} role="menu" aria-label={WA(lang, MENU_COPY.options)}
                data-testid={`photo-menu-open-${i}`}
                onKeyDown={onMenuKeyDown}
                style={{ top: anchor?.top ?? 0, left: anchor?.left ?? 0, width: MENU_W, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100dvh - 16px)", overflowY: "auto", visibility: anchor ? "visible" : "hidden" }}
                className="ow-sheet fixed z-[120] overflow-hidden rounded-2xl p-1.5 text-left">
                <PhotoMenuItem disabled={i === 0} onClick={() => { move(i, i - 1); closeMenu(i); }}>
                  {WA(lang, MENU_COPY.backward)}
                </PhotoMenuItem>
                <PhotoMenuItem disabled={i === photos.length - 1} onClick={() => { move(i, i + 1); closeMenu(i); }}>
                  {WA(lang, MENU_COPY.forward)}
                </PhotoMenuItem>
                <PhotoMenuItem disabled={i === 0} onClick={() => { move(i, 0); closeMenu(i); }}>
                  {WA(lang, MENU_COPY.cover)}
                </PhotoMenuItem>
                {/* The one irreversible action, separated by a rule and coloured, so a thumb
                    travelling down the list does not arrive on it by momentum. */}
                <div className="my-1 h-px bg-ink/10 dark:bg-white/15" />
                <PhotoMenuItem danger onClick={() => { onChange(photos.filter((p: string) => p !== src)); closeMenu(i); }}>
                  {WA(lang, MENU_COPY.remove)}
                </PhotoMenuItem>
              </div>, document.body)}
          </div>
        ))}
      </div>

      {/* The filename, under the grid rather than in the tile, because a filename is long and the
          tile is 100px. It answers the only question the bar can't: "which one is it stuck on?" */}
      {busy && progress && (
        <p className="mt-2 truncate text-[11.5px] font-semibold opacity-60">
          {W(lang, "Uploading", "Subiendo")} {progress.name}
        </p>
      )}

      <p className="mt-3 rounded-xl bg-ink/[0.04] px-3 py-2 text-[11.5px] font-semibold leading-relaxed opacity-70 dark:bg-white/[0.05]">
        {photos.length === 0
          /* Four words and eight. The version this replaced ran to four lines on a phone and
             re-explained the menu that is already sitting on every tile — Lee, 12 Sep 2026:
             *"all the words is overwhelming to people. Less is more."* */
          ? W(lang, "No photos, no replies.", "Sin fotos, no hay respuestas.")
          : W(lang, "Hold and drag to reorder. The big one leads.",
                    "Mantenga y arrastre para reordenar. La grande va de primera.")}
      </p>
      {err && <p className="mt-1 text-[11.5px] font-semibold text-red-500">{err}</p>}
    </div>
  );
}

/** One row of the photo menu. Full width so the whole strip is the target, left-aligned so the
 *  words start in the same place, and a disabled item stays VISIBLE rather than disappearing —
 *  a menu whose items move about between photos is a menu you have to read every time. */
function PhotoMenuItem({ children, onClick, disabled, danger }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled}
      className={`ow-tap block w-full rounded-xl px-3 py-2.5 text-left text-[13.5px] font-semibold transition disabled:opacity-35 ${
        danger ? "text-red-500 hover:bg-red-500/10" : "hover:bg-ink/[0.06] dark:hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

/** A determinate bar answers "how far"; this answers "is it alive". Both, because a bar that sits
 *  on 3/12 for twenty seconds during a slow encode reads as frozen without it. */
function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A grid tile. Loads the 512px thumbnail and silently falls back to the display image when a
 *  listing predates thumbnails or one failed to write. */
function Thumb({ src }: { src: string }) {
  const [url, setUrl] = useState(thumbFor(src));
  return (
    <img src={url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover"
      onError={() => { if (url !== src) setUrl(src); }} />
  );
}
