import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
export function DetailNavigation({ currentId, allIds = [], basePath, swipeDisabled }: { currentId: string; allIds?: string[]; basePath: string; label?: string; swipeDisabled?: boolean }) {
  const nav = useNavigate();
  const i = allIds.indexOf(currentId);
  if (i < 0 || allIds.length < 2) return null;
  const prev = allIds[(i - 1 + allIds.length) % allIds.length];
  const next = allIds[(i + 1) % allIds.length];
  /* v24 DS (Lee): "those arrows need to be a little bit wider — they look crammed."
     Real chevron glyphs on wider pill targets instead of skinny text characters. */
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => nav(`${basePath}/${prev}`)}
        className="btn-ghost grid !h-10 !w-12 place-items-center !p-0" aria-label="Previous">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <button onClick={() => nav(`${basePath}/${next}`)}
        className="btn-ghost grid !h-10 !w-12 place-items-center !p-0" aria-label="Next">
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
export default DetailNavigation;
