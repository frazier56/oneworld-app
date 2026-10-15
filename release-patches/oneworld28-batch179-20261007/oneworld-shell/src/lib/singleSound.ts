/* ============================================================================================
 * ONE SOUND AT A TIME — and none from a video you can no longer see.
 *
 * Lee, 2 Oct 2026: *"the audio from one video will persist… If you click off of that video, that
 * particular audio still remains on the next video or the next still photo… very glitchy."*
 *
 * Every viewer here (the listing lightbox, the full-screen video stack, the feed) mounts several
 * <video> elements side by side and lets you swipe between them. Swiping moves a video out of
 * view; it does not stop it. Each viewer could be taught that separately — and the next one
 * written would forget. So it is one rule for the whole app, installed once by the shell:
 *
 *   1. When a video or audio starts playing WITH SOUND, every other one playing with sound pauses.
 *   2. A playing element with sound that scrolls or swipes mostly out of view (under 40% visible)
 *      pauses.
 *
 * Muted autoplay loops — the feed's silent previews — are left alone by both rules: they make
 * no noise, and pausing them would freeze the feed.
 * ==========================================================================================*/
let installed = false;

export function installSingleSound(): () => void {
  if (installed || typeof document === "undefined") return () => {};
  installed = true;
  const audible = (m: HTMLMediaElement) => !m.paused && !m.muted && m.volume > 0;

  const io = typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver(entries => {
        for (const e of entries) {
          const m = e.target as HTMLMediaElement;
          if (e.intersectionRatio < 0.4 && audible(m)) m.pause();
        }
      }, { threshold: [0, 0.4, 1] })
    : null;

  const silenceOthers = (current: HTMLMediaElement) => {
    document.querySelectorAll<HTMLMediaElement>("video, audio").forEach(m => {
      if (m !== current && audible(m)) m.pause();
    });
  };

  const onPlayOrVolume = (ev: Event) => {
    const m = ev.target as HTMLMediaElement;
    if (!(m instanceof HTMLMediaElement)) return;
    if (audible(m)) { silenceOthers(m); io?.observe(m); }
  };
  const onPause = (ev: Event) => {
    const m = ev.target as HTMLMediaElement;
    if (m instanceof HTMLMediaElement) io?.unobserve(m);
  };

  // `play`, `volumechange` and `pause` do not bubble; capture sees them anyway.
  document.addEventListener("play", onPlayOrVolume, true);
  document.addEventListener("volumechange", onPlayOrVolume, true);
  document.addEventListener("pause", onPause, true);
  document.addEventListener("ended", onPause, true);
  return () => {
    document.removeEventListener("play", onPlayOrVolume, true);
    document.removeEventListener("volumechange", onPlayOrVolume, true);
    document.removeEventListener("pause", onPause, true);
    document.removeEventListener("ended", onPause, true);
    io?.disconnect(); installed = false;
  };
}
