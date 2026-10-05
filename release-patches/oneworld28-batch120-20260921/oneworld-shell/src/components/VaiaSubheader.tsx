import { VaiaPill } from "./ScreenHeading";

/**
 * VAIA SUBHEADER — the standalone "Tap for insights" row (SHELL).
 * ============================================================================================
 * This is the FALLBACK placement, kept for screens that have no title of their own: a detail
 * view, a wizard step, a modal-ish route. Losing VAIA on those screens would be a regression,
 * so `AppShell` still renders this row when nothing has claimed the pill.
 *
 * On a screen WITH a title, `ScreenHeading` claims the pill and puts it on the title's row
 * instead (Lee, 10 Aug 2026: *"The screen title and VAIA have to be on the same row, aligned,
 * on every screen of every app."*), and AppShell stands this row down.
 *
 * The button itself is `VaiaPill` — one implementation, so the two placements cannot drift into
 * two different-looking pills, which is the failure this whole change exists to end.
 */
export default function VaiaSubheader() {
  return (
    <div className="mb-1 flex justify-end">
      <VaiaPill />
    </div>
  );
}
