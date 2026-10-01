import { useState } from "react";
import { passwordRules, type PwRule } from "../lib/passwordRules";

/**
 * PASSWORD FIELD — with a show/hide eye and a Caps-Lock warning.
 * ============================================================================================
 * Shared by the sign-up wizard and the reset-password screen so both behave identically.
 *
 * Standard practices baked in, because they are table stakes, not features:
 *   · a reveal eye — every real product lets you see what you typed;
 *   · a Caps-Lock heads-up — the single most common "why won't my password work" cause;
 *   · 16px text so iOS does not zoom on focus;
 *   · `autoComplete="new-password"` so managers offer to save/generate.
 *
 * A top-level component (not defined inside a screen) so typing never remounts the <input> and
 * drops focus — the mobile keyboard bug that cost this codebase real UAT rounds.
 */

const EyeMark = ({ off }: { off: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

export default function PasswordField({
  label, value, onChange, placeholder, autoComplete = "new-password", autoFocus,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const on = e.getModifierState?.("CapsLock");
    if (typeof on === "boolean") setCaps(on);
  };
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[13px] font-semibold opacity-70">{label}</span>}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={checkCaps}
          onKeyDown={checkCaps}
          className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3.5 pr-12 text-[16px] outline-none transition focus:border-brand dark:border-white/20 dark:bg-white/[0.04]"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="ow-tap absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl opacity-55"
        >
          <EyeMark off={show} />
        </button>
      </div>
      {caps && (
        <span className="mt-1 block text-[12px] font-medium text-amber-600 dark:text-amber-400">
          Caps Lock is on
        </span>
      )}
    </label>
  );
}

const RuleRow = ({ r }: { r: PwRule }) => (
  <li className={`flex items-center gap-2 text-[12.5px] transition ${r.ok ? "opacity-90" : "opacity-55"}`}>
    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold leading-none
      ${r.ok ? "bg-teal text-white" : "bg-current/15"}`}>{r.ok ? "✓" : ""}</span>
    <span>{r.label}{r.pending ? " — checking…" : ""}</span>
  </li>
);

export function PasswordChecklist({ pw, pw2, breached }: { pw: string; pw2: string; breached: boolean | null }) {
  return (
    <ul className="space-y-1.5 rounded-2xl bg-current/[0.03] p-3">
      {passwordRules(pw, pw2, breached).map((r) => <RuleRow key={r.key} r={r} />)}
    </ul>
  );
}
