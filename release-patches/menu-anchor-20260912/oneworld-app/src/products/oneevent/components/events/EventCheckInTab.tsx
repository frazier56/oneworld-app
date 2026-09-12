/**
 * EventCheckInTab — v18 rework (Lee's host-side UAT, 18 Aug 2026).
 *
 * The big one: the QR scanner SHOWED the camera but never decoded a frame — there was no
 * decoding loop at all, which is why it sat there unresponsive. It now decodes for real:
 * the native BarcodeDetector when the browser has it (Android Chrome does), falling back
 * to jsQR on a canvas at ~8 fps. A decoded ticket resolves to one of exactly the three
 * prompts Lee specified: checked in (name + email), already checked in (name + when), or
 * invalid QR code (wrong event, unknown ticket, unreadable payload).
 *
 * Approval gate: an attendee whose application is still pending CANNOT be checked in —
 * scanner and manual search both refuse with a "pending approval" prompt (Lee: "you can't
 * check-in anyone who has a pending approval").
 *
 * LIVE badge: only shown — blinking green — while the camera is actually streaming;
 * gray "OFF" otherwise (Lee: "it should be blinking live if the scanner is actually on").
 * The two mode tiles are now real stacked BUTTONS, not ambiguous panels.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useMicro } from "@evt/i18n/LanguageContext";
import { QrCode, Camera, Search, Users, CheckCircle2, AlertCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@evt/lib/utils";
import { supabase } from "@evt/integrations/supabase/client";
import { toast } from "sonner";
import jsQR from "jsqr";

interface Registration {
  id: string;
  user_id: string;
  status: string;
  qr_code: string | null;
  checked_in_at: string | null;
  checked_in_count: number;
  profile?: { full_name: string; email: string; photo_url: string | null };
}

interface Props {
  eventId: string;
  registrations: Registration[];
  onRefresh: () => void;
  pendingApps?: { user_ids: Set<string>; emails: Set<string> };
  requiresApproval?: boolean;
}

type ScanResult =
  | { type: "success"; name: string; email: string }
  | { type: "already"; name: string; email: string; time: string }
  | { type: "pending"; name: string }
  /* v20 BY: the same scanner redeems food & drink vouchers — scan the voucher QR from the
     attendee's ticket and it burns one, telling the host how many that attendee has left. */
  | { type: "fd"; name: string; item: string; itemType: string; left: number }
  | { type: "fd-already"; name: string; item: string; time: string }
  | { type: "error"; message: string }
  | null;

export default function EventCheckInTab({ eventId, registrations, onRefresh, pendingApps, requiresApproval }: Props) {
  const m = useMicro(); // v15: seven-language host-panel strings
  const [mode, setMode] = useState<"scanner" | "manual">("scanner");
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDecodeRef = useRef<number>(0);
  const coolDownRef = useRef<string>("");
  /* v25 DY (Lee): once a code has produced a verdict, the SAME code must never re-fire
     while its card is up — the old 4s cooldown let a ticket still in frame re-decode and
     overwrite the green "Checked in" with amber "Already checked in" before the host ever
     saw it. Cleared on Dismiss or when a DIFFERENT code scans. */
  const latchRef = useRef<string>("");
  const scannerBoxRef = useRef<HTMLDivElement>(null);

  /* v25 DY: Lee's scan feedback protocol — sight + sound + touch.
     Fresh check-in: ONE beep + vibrate + green check. Already checked in: TWO beeps +
     vibrate + amber info. Bad code: one LONG low beep, no vibration, red X. */
  const feedback = useCallback((kind: "fresh" | "already" | "bad") => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const beep = (t0: number, dur: number, freq: number) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = "sine"; o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
          g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + t0 + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
          o.connect(g); g.connect(ctx.destination);
          o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.03);
        };
        if (kind === "fresh") beep(0, 0.2, 1175);
        else if (kind === "already") { beep(0, 0.15, 880); beep(0.24, 0.15, 880); }
        else beep(0, 0.9, 280);
        setTimeout(() => { try { void ctx.close(); } catch { /* closed */ } }, 1800);
      }
    } catch { /* no audio — visual still lands */ }
    try {
      if (kind !== "bad" && typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(kind === "fresh" ? 200 : [120, 90, 120]);
      }
    } catch { /* unsupported */ }
  }, []);

  const showResult = useCallback((r: ScanResult) => {
    setScanResult(r);
    if (!r) return;
    const kind = r.type === "success" || r.type === "fd" ? "fresh"
      : r.type === "error" ? "bad" : "already";
    feedback(kind);
  }, [feedback]);
  /* registrations changes on every refresh — the decode loop reads through a ref so the
     running camera loop always sees the latest list without restarting. */
  const regsRef = useRef(registrations);
  useEffect(() => { regsRef.current = registrations; }, [registrations]);

  const checkedIn = registrations.filter((r) => r.status === "checked-in");
  const remaining = registrations.filter((r) => r.status === "registered");
  const checkInPct = registrations.length > 0 ? Math.round((checkedIn.length / registrations.length) * 100) : 0;

  const isPendingApproval = useCallback((reg: Registration) => {
    if (!requiresApproval || !pendingApps) return false;
    const email = (reg.profile?.email || "").toLowerCase();
    return pendingApps.user_ids.has(reg.user_id) || (!!email && pendingApps.emails.has(email));
  }, [requiresApproval, pendingApps]);

  const doCheckIn = useCallback(async (reg: Registration): Promise<ScanResult> => {
    if (isPendingApproval(reg)) {
      return { type: "pending", name: reg.profile?.full_name ?? "Attendee" };
    }
    if (reg.status === "checked-in") {
      return { type: "already", name: reg.profile?.full_name ?? "Attendee", email: reg.profile?.email ?? "", time: reg.checked_in_at ?? "" };
    }
    if (reg.status === "cancelled") {
      return { type: "error", message: m("This ticket was cancelled") };
    }
    const { error } = await supabase
      .from("event_registrations")
      .update({ status: "checked-in", checked_in_at: new Date().toISOString(), checked_in_count: reg.checked_in_count + 1 })
      .eq("id", reg.id);
    if (error) return { type: "error", message: m("Check-in failed") };
    onRefresh();
    return { type: "success", name: reg.profile?.full_name ?? "Attendee", email: reg.profile?.email ?? "" };
  }, [isPendingApproval, onRefresh, m]);

  /* A decoded QR payload → prompt. Ticket QRs carry JSON {ticketId, eventId, hash}
     (EventTicketView); we also accept a bare registration id / qr_code string. */
  const handleDecoded = useCallback(async (raw: string) => {
    const now = Date.now();
    /* v25 DY: a latched code never re-fires while its verdict is on screen. */
    if (latchRef.current === raw) return;
    // Same code within 4s = the ticket is still in front of the camera; don't re-fire.
    if (coolDownRef.current === raw && now - lastDecodeRef.current < 4000) return;
    coolDownRef.current = raw;
    lastDecodeRef.current = now;
    latchRef.current = raw;

    let ticketId = "";
    let codeEventId = "";
    try {
      const parsed = JSON.parse(raw);
      ticketId = String(parsed.ticketId || "");
      codeEventId = String(parsed.eventId || "");
    } catch {
      ticketId = raw.trim();
    }

    if (codeEventId && codeEventId !== eventId) {
      showResult({ type: "error", message: m("This ticket is for a different event") });
      return;
    }
    const regs = regsRef.current;
    const reg = regs.find((r) => r.id === ticketId) || regs.find((r) => r.qr_code === ticketId) || regs.find((r) => r.qr_code === raw.trim());
    if (!reg) {
      /* Not a ticket — try a food/drink voucher (32-hex qr_code on a redemption row).
         Host RLS covers read + the redeem update. */
      const code = raw.trim();
      if (/^[0-9a-f]{16,64}$/i.test(code)) {
        const { data: red } = await supabase
          .from("event_food_drink_redemptions")
          .select("id, redeemed_at, registration_id, item:event_food_drink_items!inner(id, name, item_type, event_id)")
          .eq("qr_code", code)
          .maybeSingle();
        const item: any = (red as any)?.item;
        if (red && item && item.event_id === eventId) {
          const holder = regs.find((r) => r.id === (red as any).registration_id);
          const holderName = holder?.profile?.full_name ?? m("Attendee");
          if ((red as any).redeemed_at) {
            showResult({ type: "fd-already", name: holderName, item: item.name, time: (red as any).redeemed_at });
            return;
          }
          const { error: redErr } = await supabase
            .from("event_food_drink_redemptions")
            .update({ redeemed_at: new Date().toISOString() })
            .eq("id", (red as any).id);
          if (redErr) { showResult({ type: "error", message: m("Could not redeem — try again") }); return; }
          const { data: remaining } = await supabase
            .from("event_food_drink_redemptions")
            .select("id", { count: "exact", head: false })
            .eq("registration_id", (red as any).registration_id)
            .eq("item_id", item.id)
            .is("redeemed_at", null);
          showResult({ type: "fd", name: holderName, item: item.name, itemType: item.item_type, left: (remaining ?? []).length });
          return;
        }
      }
      showResult({ type: "error", message: m("Invalid QR code") });
      return;
    }
    showResult(await doCheckIn(reg));
  }, [eventId, doCheckIn, m, showResult]);

  /* Decode loop — BarcodeDetector natively where present, else jsQR on a canvas. */
  const startDecodeLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const BD = (window as any).BarcodeDetector;
    const detector = BD ? new BD({ formats: ["qr_code"] }) : null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let last = 0;

    const tick = async () => {
      if (!streamRef.current) return; // camera stopped
      const nowT = performance.now();
      if (nowT - last > 120 && video.readyState >= 2 && video.videoWidth > 0) {
        last = nowT;
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes?.length) await handleDecoded(codes[0].rawValue ?? "");
          } else if (ctx) {
            const w = Math.min(640, video.videoWidth);
            const h = Math.round(video.videoHeight * (w / video.videoWidth));
            canvas.width = w; canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" });
            if (code?.data) await handleDecoded(code.data);
          }
        } catch { /* one bad frame never kills the loop */ }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [handleDecoded]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      startDecodeLoop();
    } catch {
      toast.error(m("Camera access denied"));
    }
  }, [startDecodeLoop, m]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  /* Same sight/sound/touch protocol for manual check-ins (Lee's ruling). */
  const handleManualCheckIn = async (reg: Registration) => {
    showResult(await doCheckIn(reg));
  };

  const manualFiltered = registrations.filter((r) => {
    if (!manualSearch) return true;
    const q = manualSearch.toLowerCase();
    return (
      (r.profile?.full_name?.toLowerCase().includes(q)) ||
      (r.profile?.email?.toLowerCase().includes(q)) ||
      (r.qr_code?.toLowerCase().includes(q))
    );
  });

  /* v23 DA (Lee): the scan result renders INSIDE the camera frame — while scanning, the
     old card below the fold was invisible on a phone. Solid background so it reads over
     live video; amber text darkened (no more yellow-on-amber). */
  const resultCard = scanResult ? (
    <div className={cn(
      "rounded-2xl p-4 border text-center bg-background/95 backdrop-blur-sm shadow-lg",
      scanResult.type === "success" || scanResult.type === "fd" ? "border-green-500/40" :
      scanResult.type === "already" || scanResult.type === "fd-already" ? "border-amber-500/40" :
      scanResult.type === "pending" ? "border-yellow-500/40" :
      "border-destructive/40"
    )}>
      {scanResult.type === "success" && (
        <>
          <CheckCircle2 className="w-9 h-9 mx-auto mb-1.5 text-green-600 dark:text-green-400" />
          <p className="text-sm font-semibold text-foreground">{scanResult.name}</p>
          {scanResult.email && <p className="text-xs text-muted-foreground break-all">{scanResult.email}</p>}
          <p className="text-xs font-semibold text-green-600 dark:text-green-400 mt-1">{m("Checked in")} · {new Date().toLocaleTimeString()}</p>
        </>
      )}
      {scanResult.type === "already" && (
        <>
          <AlertCircle className="w-9 h-9 mx-auto mb-1.5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-semibold text-foreground">{scanResult.name}</p>
          {scanResult.email && <p className="text-xs text-muted-foreground break-all">{scanResult.email}</p>}
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-1">{m("Already checked in")} · {scanResult.time ? new Date(scanResult.time).toLocaleTimeString() : ""}</p>
        </>
      )}
      {scanResult.type === "fd" && (
        <>
          <CheckCircle2 className="w-9 h-9 mx-auto mb-1.5 text-green-600 dark:text-green-400" />
          <p className="text-sm font-semibold text-foreground">{scanResult.name}</p>
          <p className="text-xs font-semibold text-green-600 dark:text-green-400 mt-1">
            {scanResult.itemType === "drink" ? "🥂" : "🍽️"} {scanResult.item} · {m("redeemed")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{scanResult.left} {m("left for this attendee")}</p>
        </>
      )}
      {scanResult.type === "fd-already" && (
        <>
          <AlertCircle className="w-9 h-9 mx-auto mb-1.5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-semibold text-foreground">{scanResult.name}</p>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-1">{scanResult.item} · {m("already redeemed")} · {new Date(scanResult.time).toLocaleTimeString()}</p>
        </>
      )}
      {scanResult.type === "pending" && (
        <>
          <Clock className="w-9 h-9 mx-auto mb-1.5 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm font-semibold text-foreground">{scanResult.name}</p>
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mt-1">{m("Application pending — approve them in the Applications tab before check-in")}</p>
        </>
      )}
      {scanResult.type === "error" && (
        <>
          <XCircle className="w-9 h-9 mx-auto mb-1.5 text-destructive" />
          <p className="text-xs font-semibold text-destructive">{scanResult.message}</p>
        </>
      )}
      <button onClick={() => { setScanResult(null); latchRef.current = ""; }} className="mt-2.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-foreground border border-border">{m("Dismiss")}</button>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      {/* QR Scanner Card */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
              <QrCode className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{m("QR Scanner")}</h3>
              <p className="text-xs text-muted-foreground">{m("Primary check-in tool for live events")}</p>
            </div>
          </div>
          {/* LIVE only means live: green + blinking while the camera streams, gray otherwise. */}
          {scanning ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
              OFF
            </span>
          )}
        </div>

        {/* Mode buttons — stacked, and they LOOK like buttons (Lee: "make those two buttons
            that are vertically on top of each other… they should actually work"). */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={() => {
              setMode("scanner");
              void startCamera();
              /* v25 DX (Lee): jump the camera into view — "you don't realize the scanner
                 is actually open, it's just too low on the screen." */
              setTimeout(() => scannerBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
            }}
            className={cn(
              "ow-btn-espresso flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all",
              mode === "scanner" && scanning ? "" : "opacity-95"
            )}
          >
            <Camera className="w-5 h-5" /> {m("Scan QR Code")}
          </button>
          <button
            onClick={() => { setMode("manual"); stopCamera(); }}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-bold transition-all",
              mode === "manual" ? "bg-primary/10 border-primary/40 text-primary" : "bg-secondary border-border text-foreground hover:bg-secondary/80"
            )}
          >
            <Users className="w-5 h-5" /> {m("Manual Check-In")}
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">{m("Checked In")}</p>
            <p className="text-2xl font-bold text-foreground">{checkedIn.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">{m("Remaining")}</p>
            <p className="text-2xl font-bold text-foreground">{remaining.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">{m("Progress")}</p>
            <p className="text-2xl font-bold text-primary">{checkInPct}%</p>
          </div>
        </div>
      </div>

      {/* Scanner View */}
      {mode === "scanner" && (
        <div className="flex flex-col items-center">
          <div ref={scannerBoxRef} className="relative w-72 h-72 rounded-2xl overflow-hidden bg-black border-2 border-primary/50">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Scan corners */}
            <div className="absolute inset-4 border-2 border-primary/40 rounded-lg pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-primary rounded-tl-md" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-primary rounded-tr-md" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-primary rounded-bl-md" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-primary rounded-br-md" />
            </div>
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <button onClick={() => void startCamera()} className="ow-btn-espresso px-4 py-2 rounded-xl text-sm font-semibold">{m("Start Scanner")}</button>
              </div>
            )}
            {/* v23 DA: the verdict lands right where the host is already looking. */}
            {resultCard && <div className="absolute inset-x-2 bottom-2 z-10">{resultCard}</div>}
          </div>
          <p className="text-xs text-muted-foreground mt-3">{m("Position QR code within frame")}</p>
        </div>
      )}

      {/* Scan result (manual mode keeps it here; scanner mode shows it inside the frame) */}
      {mode !== "scanner" && resultCard}

      {/* Manual Check-In */}
      {mode === "manual" && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-base font-semibold text-foreground mb-3">{m("Manual Check-In")}</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                placeholder={m("Search by name, email, or ticket ID...")}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {manualFiltered.map((reg) => {
              const pending = isPendingApproval(reg);
              return (
                <div
                  key={reg.id}
                  onClick={() => void handleManualCheckIn(reg)}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 transition-colors",
                    pending ? "opacity-60 cursor-not-allowed" : "hover:bg-secondary/50 cursor-pointer"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {reg.profile?.photo_url ? (
                      <img src={reg.profile.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {(reg.profile?.full_name ?? "?")[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{reg.profile?.full_name ?? "Unknown"}</p>
                      {reg.status === "checked-in" && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                      {pending && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-600 shrink-0">
                          <Clock className="w-2.5 h-2.5" /> {m("Pending approval")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">TICKET-{reg.id.slice(0, 3).toUpperCase()}</p>
                  </div>
                  {reg.checked_in_at && (
                    <span className="text-xs text-muted-foreground">{new Date(reg.checked_in_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Check-Ins */}
      {checkedIn.length > 0 && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">{m("Recent Check-Ins")}</h3>
          </div>
          <div className="divide-y divide-border">
            {checkedIn.slice(0, 10).map((reg) => (
              <div key={reg.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {reg.profile?.photo_url ? (
                    <img src={reg.profile.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {(reg.profile?.full_name ?? "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{reg.profile?.full_name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    {reg.checked_in_at ? new Date(reg.checked_in_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                  </p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
