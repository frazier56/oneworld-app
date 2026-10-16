import type { ReactNode } from "react";
import { IconUpload } from "./ActionIcons";

/**
 * THE ONE "ADD MEDIA" TILE — photos and videos alike (overlay 48, 6 Oct 2026).
 * ============================================================================================
 * Lee: *"why are the photos and the video boxes different sizes?… the photo box is too big and the
 * video box is too small… the photos doesn't have the graphic at all. It doesn't even say add
 * photos… it's almost like there's two different applications."*
 *
 * They WERE two implementations: a half-width square with a "+" and a count in PhotoDeck, and a
 * 160px tile with an upload arrow and a label in PublicVideoDeck. Now one tile, used by both: a
 * full-row, compact strip — upload icon, the label, the count — so it never competes with the
 * pictures for space and never leaves a hole beside itself in a two-column grid.
 */
export default function MediaAddTile({ label, count, max, accept, disabled, onFiles, busy, multiple = true }: {
  label: string;
  count: number;
  max: number;
  accept: string;
  disabled?: boolean;
  onFiles: (files: FileList | null) => void;
  /** Shown instead of the label while uploading (progress belongs to the deck, the frame to the tile). */
  busy?: ReactNode;
  multiple?: boolean;
}) {
  const full = count >= max;
  return (
    <label data-ow="media-add"
      className={`ow-tap col-span-full flex h-24 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 text-center transition ${
        disabled || full ? "cursor-default border-ink/15 opacity-60 dark:border-white/15" : "border-ink/25 hover:border-brand dark:border-white/25"}`}>
      <input type="file" accept={accept} multiple={multiple} className="hidden"
        disabled={disabled || full}
        onChange={e => { onFiles(e.target.files); e.currentTarget.value = ""; }} />
      {busy ?? (
        <>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand" aria-hidden>
            <IconUpload size={20} />
          </span>
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <strong className="whitespace-nowrap text-[14.5px]">{label}</strong>
            <span className="whitespace-nowrap text-[12px] font-semibold tabular-nums opacity-60">{`${count} / ${max}`}</span>
          </span>
        </>
      )}
    </label>
  );
}
