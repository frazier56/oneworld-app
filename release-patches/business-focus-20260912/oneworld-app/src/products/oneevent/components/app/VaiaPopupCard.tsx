import { useState } from "react";
import { Sparkles } from "lucide-react";
export function VaiaPopupCard({ message, pageName }: { message: string; pageName?: string }) {
  const key = "oe-vaia-tip-" + (pageName || "x");
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) !== "1"; } catch { return true; } });
  if (!open) return null;
  return (
    <div className="card mb-4 flex items-start gap-3 !rounded-3xl p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"><Sparkles size={17} /></span>
      <p className="flex-1 text-sm opacity-80">{message}</p>
      <button onClick={() => { setOpen(false); try { localStorage.setItem(key, "1"); } catch {} }} aria-label="Dismiss" className="shrink-0 rounded-full px-2 opacity-50 hover:opacity-100">×</button>
    </div>
  );
}
export default VaiaPopupCard;
