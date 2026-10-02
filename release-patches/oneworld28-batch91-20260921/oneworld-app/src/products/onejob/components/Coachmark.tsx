import { useState } from "react";
import { useI18n } from "@job/lib/i18n";
import { IconBulb } from "./ActionIcons";

export default function Coachmark({ id, textKey }: { id: string; textKey: any }) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(() => localStorage.getItem(`os-tip-${id}`) === "1");
  if (hidden) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-2xl border border-brand/30 bg-brand/10 px-3.5 py-3">
      <IconBulb size={19} className="mt-px shrink-0 text-teal" />
      <p className="flex-1 text-sm leading-snug">{t(textKey)}</p>
      <button onClick={() => { localStorage.setItem(`os-tip-${id}`, "1"); setHidden(true); }}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink/10 text-xs dark:bg-white/15" aria-label="Dismiss">✕</button>
    </div>
  );
}
