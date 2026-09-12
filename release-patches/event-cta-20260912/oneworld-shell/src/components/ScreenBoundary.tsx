import { Component, type ReactNode } from "react";

/**
 * SCREEN BOUNDARY — a screen that throws shows a sentence, never a white page. (§4.14)
 * ============================================================================================
 * Lee, 9 Aug 2026: one of his review screenshots was ENTIRELY BLANK. No header, no tabs, nothing.
 *
 * A blank white page in this app has exactly one cause: something threw during render, React
 * unmounted the whole tree looking for an error boundary, and there wasn't one. Every product
 * screen is a lazy chunk mounted under `<Suspense>`, and Suspense catches *pending*, not
 * *throwing* — so a single bad read in a single screen takes the entire application off screen,
 * chrome included. That is why the screenshot has nothing in it, not even the header.
 *
 * WHY THIS IS THE FIX RATHER THAN "FIND THE ONE SCREEN". Both, really — but only one of them
 * generalises. Attributing that screenshot to a route matters and is still open; a boundary means
 * the NEXT throw, in a screen nobody has written yet, costs a member a visible error message
 * instead of a dead app and a support ticket that says "it's just white".
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *   · It does not swallow the error. The message goes to the console with the component stack,
 *     so a real defect is still findable and still noisy where engineers look.
 *   · It does not auto-retry. A render that threw once will throw again; a boundary that loops
 *     turns one broken screen into a flashing one.
 *   · It does not wrap the CHROME. It sits inside AppShell's `<main>`, so a screen blowing up
 *     leaves the header, the drawer and the tab bar alive — the member can walk away from the
 *     broken screen instead of being trapped on it. That is the whole difference between a bug
 *     and an outage.
 */
type Props = { children: ReactNode; onReset?: () => void };
type State = { error: Error | null };

export default class ScreenBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    /* Loud where engineers look, quiet where members look. */
    console.error("[ScreenBoundary] a screen threw during render:", error?.message, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    /* A stale-deploy failure and a real crash look identical to a person, so the wording and the
       button are chosen from the message rather than showing one screen for two situations. */
    const isStale = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i
      .test(String((error as any)?.message ?? error ?? ""));

    return (
      <div className="card p-6 text-center">
        {/* A CHUNK ERROR IS NOT A CRASH, AND SAYING SO MATTERS. 15 Aug 2026: after a deploy,
            anybody holding the previous page asks for chunk files the new build deleted. The code
            is fine; they are one version behind. `lazyScreen` reloads automatically, so a person
            only reaches this screen if that already failed — and then "Try again" re-imports the
            same missing file forever. Different cause, different words, different button. */}
        {isStale ? (
          <>
            <p className="text-[15px] font-bold">There's a newer version of this app.</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed opacity-60">
              This page was loaded before the last update, so part of it is no longer available.
              Reloading picks up the new version. Nothing was lost.
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-bold">This screen didn't load.</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed opacity-60">
              Something went wrong on our side. Nothing you did caused it, and nothing was lost —
              the rest of the app still works.
            </p>
          </>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => {
              if (isStale) { window.location.reload(); return; }
              this.setState({ error: null }); this.props.onReset?.();
            }}
            className="btn-primary px-5">
            {isStale ? "Reload" : "Try again"}
          </button>
          {/* ⚠️ 15 Aug 2026 — this was `window.location.assign("/")`, and the origin root is
              ALWAYS the One World home page by design. So a person whose OneHome listing failed to
              load pressed "Go home" and was thrown out of OneHome altogether, onto the umbrella
              front door, through a full page reload that dropped everything held in memory.
              Lee: *"when I click back on this little error screen it takes me all the way out of
              the app."* Home means THIS product's home. The path is read off the current URL, so
              the boundary needs no product prop and cannot go stale when a product is added. */}
          <button onClick={() => {
            const seg = window.location.pathname.split("/").filter(Boolean)[0];
            const home = seg ? `/${seg}` : "/";
            this.setState({ error: null });
            if (window.location.pathname === home) { this.props.onReset?.(); return; }
            window.history.pushState({}, "", home);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }} className="btn-ghost px-5">
            Go home
          </button>
        </div>
        {/* The message itself, small and last. A person will not act on it, but they can read it
            out on a support call, which is worth more than hiding it. */}
        <p className="mt-3 break-words text-[11px] opacity-35">{String(error?.message ?? error)}</p>
      </div>
    );
  }
}
