import { useState } from "react";
import { Sparkles, Loader2, Square } from "lucide-react";
import { useVoiceTranscription } from "@evt/components/ui/VoiceTranscribeButton";
import { stripRichTextHtml } from "@evt/components/ui/rich-text-editor";
import { useI18n } from "@evt/lib/i18n";
import InfoTip from "@evt/components/InfoTip";

// Dedicated copywriter edge fn (Gemini, no length cap, keep-every-detail). NOT
// vaia-chat — that's a terse help assistant capped at 2–4 sentences, which is
// why descriptions came out short. (Lee, Jul 22.)
const CHAT_URL = "https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/compose-description";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function toHtml(text: string) {
  return text.trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

export function AiDescriptionHelper({ type, title, category, currentDescription, charLimit, onApply }: {
  type?: string; title?: string; category?: string; currentDescription?: string; charLimit?: number; onApply?: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const { lang } = useI18n();
  const voice = useVoiceTranscription();
  const listening = voice.recording;

  // Speak → VAIA composes. One button, one flow: tap to talk, tap to stop,
  // VAIA writes a clean description from whatever you said (falls back to
  // polishing the current text if you didn't say anything).
  const compose = async (notes: string) => {
    const raw = stripRichTextHtml(notes || "").trim() || stripRichTextHtml(currentDescription || "").trim();
    if (!raw || busy) return;
    setBusy(true);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ notes: raw, type: type || "event", title, category, charLimit, lang }),
      });
      let out = "";
      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, i);
            buf = buf.slice(i + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const js = line.slice(6).trim();
            if (js === "[DONE]") break;
            try { out += JSON.parse(js).choices?.[0]?.delta?.content || ""; } catch { /* partial */ }
          }
        }
      }
      out = out.trim();
      if (out && onApply) onApply(toHtml(charLimit ? out.slice(0, charLimit) : out));
    } catch { /* graceful */ }
    setBusy(false);
  };

  const onTap = () => {
    if (busy) return;
    if (listening) {
      const text = voice.confirm();
      compose(text);
    } else {
      voice.startRecording();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
      {/* Info on the LEFT (Lee, Jul 22) */}
      <InfoTip text="Tap Speak with AI and just talk — freely, for up to ~2 minutes — about your event: what it is, the vibe, dress code, food, schedule, prices, anything you want people to know. Tap Stop when you're done and VAIA turns everything you said into a clean, polished description — keeping all your details." />
      {listening ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500">
            <span className="flex items-end gap-[2px]" aria-hidden>
              <span className="h-2 w-[3px] animate-pulse rounded-full bg-red-500 [animation-delay:-0.2s]" />
              <span className="h-3 w-[3px] animate-pulse rounded-full bg-red-500" />
              <span className="h-2 w-[3px] animate-pulse rounded-full bg-red-500 [animation-delay:0.2s]" />
            </span>
            Listening…
          </span>
          <button type="button" onClick={onTap}
            className="inline-flex items-center gap-1 rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-red-500/30">
            <Square size={11} className="fill-current" /> Stop &amp; write
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onTap}
          disabled={busy}
          title="Speak and VAIA writes your description"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
            busy ? "bg-brand/15 text-brand" : "bg-gradient-to-r from-brand-bright to-brand-deep text-white shadow-sm shadow-brand/25"
          }`}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {busy ? "Writing…" : "Speak with AI"}
        </button>
      )}
      </div>

      {/* Live transcript — so you can see the words being captured in real time.
          If this stays empty while you talk, the mic isn't hearing you. (Lee, Jul 22) */}
      {listening && (
        <div className="max-h-32 overflow-y-auto rounded-xl border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-sm leading-relaxed text-ink/80 dark:text-white/80">
          {voice.transcript
            ? voice.transcript
            : <span className="opacity-50">Listening… start talking and your words will appear here.</span>}
        </div>
      )}
    </div>
  );
}
export default AiDescriptionHelper;
