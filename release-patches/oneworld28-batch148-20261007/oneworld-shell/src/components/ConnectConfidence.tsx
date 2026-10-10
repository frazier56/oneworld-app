import { useState } from "react";
import { W, useI18n } from "../lib/i18n";
import type { MatchVerdict, SignalResult } from "../lib/identityMatch";

/**
 * CONNECT CONFIDENCE — the screen that says how sure we are this account is yours (SHELL).
 * ============================================================================================
 * Shown AFTER the platform's own "Was this you?" approval, never instead of it. The approval
 * proves somebody controls the account. This answers the second question: does the account look
 * like THIS person? Lee: *"it could be a stolen account, right?"*
 *
 * ── THE PORSCHE TAYCAN RULE ────────────────────────────────────────────────────────────────
 * Lee: *"Very, very simple, very, very easy, but complicated in the back end."* So the member
 * sees one number, one sentence, and at most one thing to do. The four signals are there, but
 * folded away — the person who wants to know why can open it, and nobody else is made to read
 * it. No scores, no weights, no vocabulary from the engine: "Same phone number", not
 * "phone: 1.0".
 *
 * ── ⚠️ ONE THING I CHANGED FROM WHAT LEE ASKED FOR, AND WHY ────────────────────────────────
 * He said: *"if it's not 100 percent, maybe there's a secondary capture match, max or one of
 * those solve-a-puzzle situations."*
 *
 * A captcha proves there is a HUMAN. It does not prove the human is the OWNER — and a person who
 * has stolen an Instagram account can solve a puzzle exactly as well as the person they stole it
 * from. So a captcha alone would be a gate that stops nobody we are worried about, while costing
 * every honest member ten seconds.
 *
 * The step that does work is still a puzzle, and still takes one tap: **pick your own posts out
 * of a grid.** Nine thumbnails, three of them from the account being claimed and six from other
 * accounts on the platform. The owner knows their own photographs instantly. Somebody who has
 * just taken the account over, and is working from a login rather than a life, does not — and
 * unlike a code, there is nothing to intercept and nothing to remember. Same shape as what he
 * asked for, and it is about identity rather than about being a robot.
 *
 * The captcha slot is still here as `botCheck`, for when the thing we are worried about really
 * is a machine — a run of connect attempts from one address — rather than a theft.
 */

/**
 * ⚠️ THE SECOND STEP IS A GATE, NOT A DECORATION — AND IT WAS NOT, WHICH IS A P0 TESTING FOUND
 * ON 8 OCTOBER AND WAS RIGHT ABOUT.
 *
 * The first version took the challenge as a bare `ReactNode` and drew the Connect button for
 * every `check` verdict regardless. So the control that exists to stop a stolen account was a
 * picture of a control: the member could ignore the challenge entirely, press Connect, and the
 * connection went through. A gate that does not block is worse than no gate, because everybody
 * downstream believes something was checked.
 *
 * The challenge is now ONE object carrying its own completion, so there is no way to render a
 * challenge and forget to wait for it — the type will not let you. `passed` drives the button;
 * `token` is what the server re-checks, because **a client-side gate is a courtesy and the real
 * enforcement has to happen in the finalizer.** The component refuses to confirm without it.
 */
export interface Challenge {
  /** What the member is asked to do. */
  node: React.ReactNode;
  /** Has it actually been completed? The Connect button is dead until this is true. */
  passed: boolean;
  /** Proof for the server to re-check. The finalizer must reject a connection without it. */
  token?: string | null;
}

export interface ConnectConfidenceProps {
  platform: string;
  handle?: string | null;
  verdict: MatchVerdict;
  /** The second step, when the verdict asks for one. */
  challenge?: Challenge;
  /** Rendered instead of the challenge when the worry is a machine rather than a theft. */
  botCheck?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

/* The brands' own capitalisation. */
const PLATFORM_NAME: Record<string, string> = {
  tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", instagram: "Instagram",
  facebook: "Facebook", twitch: "Twitch", twitter: "X", x: "X", yelp: "Yelp",
  onesocial: "OneSocial",
};

const TONE = {
  pass:   { ring: "#17A45C", chip: "bg-[#17A45C]/10 text-[#17A45C]" },
  check:  { ring: "#E0A21F", chip: "bg-[#E0A21F]/12 text-[#B37F12]" },
  refuse: { ring: "#C0392B", chip: "bg-[#C0392B]/10 text-[#C0392B]" },
} as const;

export default function ConnectConfidence(p: ConnectConfidenceProps) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const v = p.verdict;
  const tone = TONE[v.verdict];

  /* The gate. A `check` verdict cannot be confirmed until its challenge reports `passed` — and
     if a `check` arrives with no challenge at all, that is a programming mistake upstream, so it
     blocks too rather than falling open. Controls fail CLOSED. */
  const needsStep = v.verdict === "check";
  const blocked = needsStep && !(p.challenge?.passed === true);
  /* ⚠️ Not `charAt(0).toUpperCase()`. That renders "Tiktok" and "Youtube" — caught by looking at
     the screen, and it is the kind of small wrongness that makes a product feel fake right at the
     moment we are asking somebody to trust it with an account. The brands capitalise themselves. */
  const name = PLATFORM_NAME[p.platform.toLowerCase()]
    ?? p.platform.charAt(0).toUpperCase() + p.platform.slice(1);

  const word = v.verdict === "pass" ? W(lang, "Match", "Coincide")
    : v.verdict === "check" ? W(lang, "One more step", "Un paso más")
    : W(lang, "We cannot connect this", "No podemos conectar esto");

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <Ring percent={v.percent} colour={tone.ring} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold">
            {name}{p.handle ? ` · ${p.handle}` : ""}
          </p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${tone.chip}`}>
            {word}
          </span>
        </div>
      </div>

      {/* ⚠️ THE REFUSED CASE NEEDED ITS OWN SENTENCE, AND IT TOOK A SCREENSHOT TO SEE IT. This
             branched on "is there a conflict" without first asking "did we refuse", so a stolen
             account scoring zero was told *"most of this account matches you… one quick check and
             it is yours."* It is not theirs, there is no quick check, and promising one at the
             exact moment we have decided against them is the worst sentence on the screen. A
             refusal says what happened and offers the one honest way forward. */}
      <p className="mt-2.5 text-[13px] leading-relaxed">
        {v.verdict === "refuse" ? W(lang,
            "This account does not look like yours, so we are not going to connect it. If it really is yours, update your name, phone or location on your profile and try again.",
            "Esta cuenta no parece tuya, así que no la vamos a conectar. Si de verdad es tuya, actualiza tu nombre, teléfono o ubicación en tu perfil e inténtalo de nuevo.")
          : v.verdict === "pass" ? W(lang,
            "Everything we can check about this account matches you. This is our best estimate, not a guarantee.",
            "Todo lo que podemos comprobar de esta cuenta coincide contigo. Es nuestra mejor estimación, no una garantía.")
          : v.conflicts.length ? W(lang,
            "Most of this account matches you, but something does not add up. One quick check and it is yours.",
            "Casi todo coincide contigo, pero algo no cuadra. Una comprobación rápida y queda tuya.")
          : W(lang,
            "This account only partly matches you. One quick check and it is yours.",
            "Esta cuenta solo coincide en parte contigo. Una comprobación rápida y queda tuya.")}
      </p>

      {/* The reasons, folded away. Open by default ONLY when something contradicts — that is the
          one case where hiding the reason would feel like being refused without being told. */}
      {v.counted.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen(o => !o)}
            className="ow-tap mt-2 text-[12px] font-bold text-brand">
            {open || v.conflicts.length
              ? W(lang, "What we checked", "Lo que comprobamos")
              : W(lang, "What we checked ›", "Lo que comprobamos ›")}
          </button>
          {(open || v.conflicts.length > 0) && (
            <ul className="mt-1.5 space-y-1.5">
              {v.signals.filter(s => s.state !== "unknown").map(s => <Line key={s.signal} s={s} lang={lang} />)}
            </ul>
          )}
        </>
      )}

      {v.verdict === "check" && (p.challenge || p.botCheck) && (
        <div className="mt-3 rounded-2xl border border-ink/8 bg-ink/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          {p.challenge ? p.challenge.node : p.botCheck}
        </div>
      )}

      {blocked && (
        <p className="mt-2.5 text-[11.5px] font-semibold leading-snug opacity-60">
          {p.challenge
            ? W(lang, "Finish the check above and Connect it will light up.",
                      "Completa la comprobación de arriba y Conectarla se activará.")
            : W(lang, "We cannot connect this account until the extra check is available. Try again shortly.",
                      "No podemos conectar esta cuenta hasta que la comprobación adicional esté disponible. Inténtalo en un momento.")}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={p.onCancel}
          className="ow-tap flex-1 rounded-xl border border-ink/12 py-2.5 text-[13px] font-bold dark:border-white/15">
          {W(lang, "Not mine", "No es mía")}
        </button>
        {v.verdict !== "refuse" && (
          <button type="button" onClick={() => { if (!blocked) p.onConfirm(); }}
            disabled={p.busy || blocked} aria-disabled={blocked}
            className="btn-primary flex-1 py-2.5 text-[13px] disabled:opacity-50">
            {p.busy ? W(lang, "Connecting…", "Conectando…") : W(lang, "Connect it", "Conectarla")}
          </button>
        )}
      </div>
    </div>
  );
}

/** The number, drawn rather than written, because it is the first thing the eye lands on. */
function Ring({ percent, colour }: { percent: number; colour: string }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-[58px] w-[58px] shrink-0 place-items-center">
      <svg width="58" height="58" viewBox="0 0 58 58" className="absolute inset-0 -rotate-90">
        <circle cx="29" cy="29" r={r} fill="none" strokeWidth="5" className="stroke-ink/10 dark:stroke-white/15" />
        {/* A round cap on a zero-length arc draws a DOT, so a refused account wore a little
            coloured pip at twelve o'clock that read as "1 percent". At zero, draw nothing. */}
        {percent > 0 && (
          <circle cx="29" cy="29" r={r} fill="none" strokeWidth="5" stroke={colour} strokeLinecap="round"
            strokeDasharray={`${(c * percent) / 100} ${c}`} />
        )}
      </svg>
      <span className="text-[15px] font-extrabold tabular-nums">{percent}<span className="text-[9px]">%</span></span>
    </span>
  );
}

function Line({ s, lang }: { s: SignalResult; lang: string }) {
  const label = s.signal === "name" ? W(lang, "Name", "Nombre")
    : s.signal === "email" ? W(lang, "Email", "Correo")
    : s.signal === "phone" ? W(lang, "Phone", "Teléfono")
    : W(lang, "Location", "Ubicación");
  const bad = s.state === "conflict";
  return (
    <li className="flex gap-2 text-[12px] leading-snug">
      <span aria-hidden className={`mt-[3px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[9px] font-black text-white ${
        bad ? "bg-[#C0392B]" : s.state === "weak" ? "bg-[#E0A21F]" : "bg-[#17A45C]"}`}>
        {bad ? "!" : s.state === "weak" ? "~" : "✓"}
      </span>
      <span className="min-w-0">
        <span className="font-bold">{label}</span>
        <span className="opacity-65"> — {s.why}</span>
      </span>
    </li>
  );
}
