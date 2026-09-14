import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Send, Sparkles, Loader2, Mic, Check, Keyboard } from "lucide-react";
import { useAuth } from "@evt/hooks/useAuth";
import { useVoiceTranscription } from "@evt/components/ui/VoiceTranscribeButton";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useAiAssistant } from "@evt/contexts/AiAssistantContext";
import { speakVaia, stopVaiaSpeech } from "@evt/lib/vaiaVoice";
import { useI18n } from "@evt/lib/i18n";
type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = "https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/vaia-chat";

export default function AskVaiaChat({ open, onClose, preferVoice = false }: { open: boolean; onClose: () => void; preferVoice?: boolean }) {
  const { avatar: vaiaAvatar, name: vaiaName } = useAiAssistant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Voice-first: tapping VAIA opens straight into conversation mode (she
  // greets you aloud + you talk back). The keyboard icon switches to text.
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [speaking, setSpeaking] = useState(false);
  const speakLang = lang === "es" ? "es" : "en";
  const voice = useVoiceTranscription();
  const isVoiceReviewOpen = voice.recording;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const [voiceHintActive, setVoiceHintActive] = useState(false);

  useEffect(() => {
    if (!open) {
      setVoiceHintActive(false);
      return;
    }
    setVoiceHintActive(preferVoice && !voice.recording && !input.trim());
  }, [open, preferVoice, voice.recording, input]);

  // Auto-scroll transcript to bottom as words populate
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [voice.transcript]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (!open) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  // Listen for proactive VAIA open events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.prefill) {
        setInput(detail.prefill);
      }
    };
    window.addEventListener("vaia-open-chat", handler);
    return () => window.removeEventListener("vaia-open-chat", handler);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM",
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          userId: user?.id,
          plan: null,
          addon: null,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to connect");
      }

      if (!resp.body) throw new Error("No stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
                }
                return [...prev, { role: "assistant", content: snapshot }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: e.message || "Something went wrong. Try again!" }]);
    } finally {
      setIsLoading(false);
      // In voice mode, VAIA speaks her reply aloud (real ElevenLabs voice).
      if (mode === "voice" && assistantSoFar.trim()) {
        setSpeaking(true);
        speakVaia(assistantSoFar, speakLang).finally(() => setSpeaking(false));
      }
    }
  }, [input, isLoading, messages, user?.id, mode, speakLang]);

  const [showIntro, setShowIntro] = useState(true);

  // Auto-dismiss intro after 2s
  useEffect(() => {
    if (!open || !showIntro) return;
    const timer = setTimeout(() => setShowIntro(false), 2000);
    return () => clearTimeout(timer);
  }, [open, showIntro]);

  // Reset intro when reopened
  useEffect(() => {
    if (open && messages.length === 0) setShowIntro(true);
  }, [open, messages.length]);

  // Voice-first greeting: opened in voice mode with no history → VAIA speaks a
  // short hello in her real ElevenLabs voice, so tapping her drops you straight
  // into a conversation. Stops any speech when the popup closes.
  useEffect(() => {
    if (!open) { stopVaiaSpeech(); setSpeaking(false); return; }
    if (mode === "voice" && messages.length === 0) {
      const greet = "Hey, I'm VAIA. Talk to me — tap the mic and ask me anything. Prefer to type? Tap the keyboard.";
      setSpeaking(true);
      speakVaia(greet, speakLang).finally(() => setSpeaking(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fresh open always starts voice-first
  useEffect(() => { if (open && messages.length === 0) setMode("voice"); }, [open, messages.length]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop — blocks background interaction & scroll */}
      <div className="fixed inset-0 z-[998] bg-black/60 backdrop-blur-sm" onClick={() => { window.dispatchEvent(new Event("vaia-stop-all-audio")); onClose(); }} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[999] flex items-end justify-center p-2 pointer-events-none sm:items-center sm:p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
      >
        <div
          className="relative flex flex-col rounded-[28px] shadow-2xl overflow-hidden border border-border/60 pointer-events-auto"
          style={{
            width: "min(420px, calc(100vw - 16px))",
            height: "min(620px, calc(100dvh - 16px - env(safe-area-inset-bottom, 0px)))",
            maxHeight: "calc(100dvh - 16px - env(safe-area-inset-bottom, 0px))",
            background: "hsl(var(--card))",
            overscrollBehavior: "contain",
          }}
          onClick={(event) => event.stopPropagation()}
        >
        {/* Intro animation overlay */}
        <AnimatePresence>
          {showIntro && messages.length === 0 && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--primary) / 0.15))" }}
              onClick={() => setShowIntro(false)}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 200 }}
                className="relative"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/40 shadow-lg"
                  style={{ boxShadow: "0 0 30px hsl(var(--primary) / 0.3)" }}>
                  <img src={vaiaAvatar} alt="VAIA" className="w-full h-full object-cover" />
                </div>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.2, 1], opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #8B5CF6)" }}
                >
                  <Sparkles size={14} className="text-white" />
                </motion.div>
              </motion.div>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-4 text-lg font-bold text-foreground"
              >
                Hey, I'm VAIA ✨
              </motion.p>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-sm text-muted-foreground mt-1"
              >
                Your AI event assistant
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 flex-shrink-0"
          style={{ background: "hsl(var(--primary) / 0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/30 flex-shrink-0"
              style={{ boxShadow: "0 0 12px hsl(var(--primary) / 0.15)" }}
            >
              <img src={vaiaAvatar} alt={vaiaName} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">Ask {vaiaName}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Your AI event assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { stopVaiaSpeech(); setSpeaking(false); setMode(m => (m === "voice" ? "text" : "voice")); }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title={mode === "voice" ? "Switch to typing" : "Switch to voice"}
              type="button"
            >
              {mode === "voice" ? <Keyboard size={16} /> : <Mic size={16} />}
            </button>
            <button
              onClick={() => { window.dispatchEvent(new Event("vaia-stop-all-audio")); stopVaiaSpeech(); onClose(); }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0, overscrollBehavior: "contain" }}>
          {messages.length === 0 && (
            <div className="text-center py-6">
              <Sparkles size={28} className="text-primary mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground leading-relaxed px-2">
                Hi! I'm VAIA. Ask me anything about your events — hosting tips, ticketing, your OneScore, and more.
              </p>
              <div className="flex flex-col gap-2 items-center mt-5">
                {["Help me plan an event", "How do I sell more tickets?", "How can I raise my OneScore?"].map(q => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-xs px-4 py-2 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors w-fit"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "text-primary-foreground" : "text-foreground border border-border/50"}`}
                style={{
                  background: msg.role === "user" ? "hsl(var(--primary))" : "hsl(var(--muted) / 0.4)",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                }}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => {
                          const isInternal = href?.startsWith("/");
                          return (
                            <button
                              className="text-primary underline hover:text-primary/80 transition-colors cursor-pointer bg-transparent border-none p-0 text-left font-inherit text-inherit inline"
                              onClick={(e) => {
                                e.preventDefault();
                                if (isInternal && href) {
                                  onClose();
                                  navigate(href);
                                } else if (href) {
                                  window.open(href, "_blank", "noopener");
                                }
                              }}
                            >
                              {children}
                            </button>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5 border border-border/50" style={{ background: "hsl(var(--muted) / 0.4)" }}>
                <Loader2 size={16} className="animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>

        {/* Voice Recording Overlay — above composer, inside modal */}
        <AnimatePresence>
          {isVoiceReviewOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="px-3 pb-2 flex flex-col gap-2 flex-shrink-0"
            >
              <div className="w-full rounded-2xl border border-border/60 bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-3 pb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Live transcription
                  </span>
                  <span className="text-[11px] text-primary">Review before send</span>
                </div>

                <div ref={transcriptScrollRef} className="max-h-[24vh] min-h-[120px] overflow-y-auto rounded-xl border border-border/50 bg-background/50 px-3 py-2.5">
                  {voice.listening ? (
                    voice.transcript ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                        {voice.transcript}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Listening live… your words will appear here in real time.
                      </p>
                    )
                  ) : (
                    <textarea
                      value={voice.transcript}
                      onChange={(event) => voice.setTranscriptText(event.target.value)}
                      className="min-h-[180px] w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      placeholder="Review and edit your transcript before using it."
                    />
                  )}
                </div>
              </div>

              {/* Visualizer row with cancel & confirm */}
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => voice.cancel()}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  title="Cancel"
                  type="button"
                >
                  <X size={16} />
                </button>

                <div className="flex-1 flex items-center min-w-0 overflow-hidden rounded-full bg-muted/50 px-3 py-2 border border-border/50">
                  <div className="flex items-center justify-center gap-[1.5px] h-7 w-full">
                    {voice.listening && voice.visualizerBars.length > 0 ? (
                      voice.visualizerBars.map((v, i) => (
                        <div
                          key={i}
                          className="bg-primary rounded-sm"
                          style={{
                            width: '2px',
                            height: `${Math.max(8, v * 100)}%`,
                            opacity: 0.4 + v * 0.6,
                            transition: 'height 50ms linear, opacity 50ms linear',
                          }}
                        />
                      ))
                    ) : !voice.listening ? (
                      <button
                        onClick={() => voice.startRecording({ appendTranscript: voice.transcript })}
                        className="flex items-center justify-center gap-2 w-full rounded-full px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                        type="button"
                      >
                        <Mic size={14} />
                        Continue dictation
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 w-full">
                        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                          <span className="text-[11px] text-muted-foreground">Listening… speak now</span>
                      </div>
                    )}
                  </div>
                </div>

                {voice.listening ? (
                  <button
                    onClick={() => voice.stopListening()}
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground transition-colors hover:opacity-90"
                    title="Stop listening"
                    type="button"
                  >
                    <Check size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const text = voice.confirm();
                      if (text) setInput(prev => (prev ? prev + " " : "") + text);
                    }}
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground transition-colors hover:opacity-90"
                    title="Use transcript"
                    type="button"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Composer */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border/60 flex-shrink-0">
          {mode === "voice" && !isVoiceReviewOpen ? (
            <div className="flex w-full flex-col items-center gap-1.5 py-1">
              <button
                onClick={() => { stopVaiaSpeech(); setSpeaking(false); voice.startRecording(); }}
                disabled={isLoading}
                className="flex items-center justify-center rounded-full disabled:opacity-40 transition-transform active:scale-95"
                style={{ width: 54, height: 54, background: "linear-gradient(135deg, hsl(var(--primary)), #8B5CF6)", boxShadow: speaking ? "0 0 0 4px hsl(var(--primary) / 0.18), 0 0 24px hsl(var(--primary) / 0.35)" : "0 0 18px hsl(var(--primary) / 0.25)" }}
                title="Tap to talk"
                type="button"
              >
                <Mic size={22} className="text-white" />
              </button>
              <span className="text-[11px] text-muted-foreground text-center px-2">
                {speaking ? "VAIA is speaking…" : isLoading ? "Thinking…" : "Tap to talk — or the keyboard icon to type"}
              </span>
            </div>
          ) : !isVoiceReviewOpen ? (
            <input
              ref={inputRef}
              value={input}
              onChange={e => {
                setVoiceHintActive(false);
                setInput(e.target.value);
              }}
              onFocus={() => setVoiceHintActive(false)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={voiceHintActive ? "Tap mic to speak…" : "Ask VAIA anything..."}
              className="flex-1 min-w-0 bg-muted/40 border border-border/50 rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              autoFocus={false}
              readOnly={voiceHintActive}
              inputMode={voiceHintActive ? "none" : undefined}
            />
          ) : (
            <div className="flex-1 min-w-0 text-xs text-muted-foreground italic px-2 truncate">
              Recording… tap ✓ to confirm
            </div>
          )}

          {/* Mic — text mode, when not recording and no text */}
          {mode === "text" && !isVoiceReviewOpen && !input.trim() && (
            <button
              onClick={() => {
                setVoiceHintActive(false);
                voice.startRecording();
              }}
              disabled={isLoading}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-all disabled:opacity-40"
              style={voiceHintActive ? {
                color: "hsl(var(--primary))",
                background: "hsl(var(--primary) / 0.12)",
                boxShadow: "0 0 0 1px hsl(var(--primary) / 0.25), 0 0 18px hsl(var(--primary) / 0.25)",
              } : undefined}
              title="Voice input"
              type="button"
            >
              <Mic size={18} />
            </button>
          )}

          {/* Send — when there's text */}
          {!isVoiceReviewOpen && input.trim() && (
            <button
              onClick={sendMessage}
              disabled={isLoading}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full disabled:opacity-40 transition-all"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #8B5CF6)" }}
            >
              <Send size={15} className="text-white" />
            </button>
          )}
        </div>
        </div>
      </motion.div>
    </>
    , document.body
  );
}
