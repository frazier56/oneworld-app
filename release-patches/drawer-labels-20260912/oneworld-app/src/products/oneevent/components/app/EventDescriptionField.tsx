import { useState, useRef, useEffect, useMemo } from "react";
import { Sparkles, Loader2, Square } from "lucide-react";
import { useVoiceTranscription } from "@evt/components/ui/VoiceTranscribeButton";
import { RichTextEditor, stripRichTextHtml } from "@evt/components/ui/rich-text-editor";
import { useI18n } from "@evt/lib/i18n";
import InfoTip from "@evt/components/InfoTip";

// Dedicated copywriter edge fn (Gemini, no length cap, keep-every-detail). NOT
// vaia-chat — that's a terse help assistant capped at 2–4 sentences. Same
// underlying model (Gemini 2.5 Flash) OneSocial's bio dictation uses via the
// Lovable AI gateway, so quality matches. (Lee, Jul 22.)
const CHAT_URL = "https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/compose-description";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function toHtml(text: string) {
  return text.trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

export function EventDescriptionField({
  type, title, category, value, charLimit, placeholder, error, onChange,
}: {
  type?: string; title?: string; category?: string; value: string; charLimit?: number;
  placeholder?: string; error?: boolean; onChange: (html: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const { lang } = useI18n();
  const voice = useVoiceTranscription();
  const listening = voice.recording;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest words on screen at all times — auto-scroll to the bottom on
  // every transcript update so the user never has to touch the screen (and risk
  // stopping the mic) to see what just came out of their mouth. (Lee, Jul 22)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [voice.transcript, listening]);

  // Split the transcript so the most recent words render highlighted and the
  // earlier words fade back — the live "these are the words being captured
  // right now" cue Lee asked for.
  const { older, recent } = useMemo(() => {
    const words = (voice.transcript || "").trim().split(/\s+/).filter(Boolean);
    const RECENT = 7;
    if (words.length <= RECENT) return { older: "", recent: words.join(" ") };
    return { older: words.slice(0, -RECENT).join(" "), recent: words.slice(-RECENT).join(" ") };
  }, [voice.transcript]);

  const compose = async (notes: string) => {
    const raw = stripRichTextHtml(notes || "").trim() || stripRichTextHtml(value || "").trim();
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
          const { done, value: chunk } = await reader.read();
          if (done) break;
          buf += dec.decode(chunk, { stream: true });
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
      if (out) onChange(toHtml(charLimit ? out.slice(0, charLimit) : out));
    } catch { /* graceful */ }
    setBusy(false);
  };

  const onSpeak = () => {
    if (busy) return;
    if (listening) {
      const text = voice.confirm();
      compose(text);
    } else {
      voice.startRecording();
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Description <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-1.5">
          <InfoTip text="Tap Speak with AI and just talk — freely, for up to ~2 minutes — about your event: what it is, the vibe, dress code, food, schedule, prices, anything you want people to know. Your words appear live in the box below as you speak. Tap Stop & write when you're done and VAIA turns everything you said into a clean, polished description — keeping all your details." />
          {listening ? (
            <button type="button" onClick={onSpeak}
              className="inline-flex items-center gap-1 rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-red-500/30">
              <Square size={11} className="fill-current" /> Stop &amp; write
            </button>
          ) : (
            <button type="button" onClick={onSpeak} disabled={busy}
              title="Speak and VAIA writes your description"
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                busy ? "bg-brand/15 text-brand" : "bg-gradient-to-r from-brand-bright to-brand-deep text-white shadow-sm shadow-brand/25"
              }`}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {busy ? "Writing…" : "Speak with AI"}
            </button>
          )}
        </div>
      </div>

      {/* While dictating, the live transcript REPLACES the editor in the same box —
          newest words highlighted and auto-scrolled into view. On Stop it hands
          the text to VAIA and the polished description drops back into the editor. */}
      {listening ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/[0.04] dark:bg-red-500/[0.06]">
          <div className="flex items-center gap-1.5 border-b border-red-500/20 px-3 py-2 text-xs font-semibold text-red-500">
            <span className="flex items-end gap-[2px]" aria-hidden>
              <span className="h-2 w-[3px] animate-pulse rounded-full bg-red-500 [animation-delay:-0.2s]" />
              <span className="h-3 w-[3px] animate-pulse rounded-full bg-red-500" />
              <span className="h-2 w-[3px] animate-pulse rounded-full bg-red-500 [animation-delay:0.2s]" />
            </span>
            Listening — keep talking
          </div>
          <div ref={scrollRef} className="max-h-[220px] min-h-[120px] overflow-y-auto px-4 py-3 text-[15px] leading-relaxed">
            {older || recent ? (
              <p className="whitespace-pre-wrap break-words">
                <span className="text-ink/45 dark:text-white/40">{older}{older && " "}</span>
                <span className="rounded bg-teal/15 px-0.5 font-semibold text-teal">{recent}</span>
              </p>
            ) : (
              <p className="opacity-50">Start talking — your words will appear here as you speak.</p>
            )}
          </div>
        </div>
      ) : (
        <RichTextEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          error={error}
        />
      )}
    </div>
  );
}
export default EventDescriptionField;
