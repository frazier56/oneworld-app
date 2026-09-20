import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@evt/components/ui/dialog";
import { Button } from "@evt/components/ui/button";
import { Sparkles, ShieldCheck, Megaphone, CalendarCheck2, CreditCard, Camera } from "lucide-react";
import { useGeoLocation } from "@evt/hooks/useGeoLocation";

const STORAGE_KEY = "os_events_welcome_dismissed_v1";

type Lang = "en" | "es";

const COPY: Record<Lang, {
  eyebrow: string;
  title: string;
  description: string;
  bullets: { title: string; body: string }[];
  cta: string;
}> = {
  en: {
    eyebrow: "For event planners",
    title: "Welcome to OneEvent",
    description: "The page below is the full event hub — every feature hosts use to advertise, manage, and get paid for events in one place. Here's a quick preview.",
    bullets: [
      {
        title: "The only credibility score in the industry",
        body: "For the first time, you have a real way to prove you're legit. Your OneScore™ shows hirers, attendees, and partners that you're a trustworthy event host — not just another profile. No score yet? This is how you start building one.",
      },
      { title: "Advertise your events", body: "Public event pages built for discovery — shareable links, QR codes, and SEO that actually ranks." },
      { title: "Manage everything in one place", body: "Check-ins, attendee messaging, co-hosts, scanners, and post-event recaps without juggling 4 tools." },
      { title: "Get paid cleanly", body: "Card payments + structured payouts. No chasing Venmo screenshots." },
      { title: "Share media that lives forever", body: "Hosts + attendees post photos/clips to a shared gallery that boosts every future event." },
    ],
    cta: "Got it",
  },
  es: {
    eyebrow: "Para organizadores de eventos",
    title: "Bienvenido a OneEvent",
    description: "La página de abajo es el centro de eventos completo — todas las funciones que los anfitriones usan para promocionar, gestionar y cobrar por eventos en un solo lugar. Aquí tienes un vistazo rápido.",
    bullets: [
      {
        title: "El único puntaje de credibilidad de la industria",
        body: "Por primera vez tienes una forma real de demostrar que eres legítimo. Tu OneScore™ le muestra a clientes, asistentes y socios que eres un organizador confiable — no solo otro perfil más. ¿Aún no tienes puntaje? Así es como empiezas a construirlo.",
      },
      { title: "Promociona tus eventos", body: "Páginas públicas pensadas para descubrirse — enlaces compartibles, códigos QR y SEO que realmente posiciona." },
      { title: "Gestiona todo en un solo lugar", body: "Check-ins, mensajes a asistentes, co-anfitriones, escáneres y recapitulaciones — sin malabarear 4 herramientas." },
      { title: "Cobra de forma limpia", body: "Pagos con tarjeta y desembolsos estructurados. Sin perseguir capturas de pantalla." },
      { title: "Comparte contenido que perdura", body: "Anfitriones y asistentes suben fotos y clips a una galería compartida que impulsa cada evento futuro." },
    ],
    cta: "Entendido",
  },
};

const ICONS = [ShieldCheck, Megaphone, CalendarCheck2, CreditCard, Camera];

/**
 * Shown when an affiliate-attributed visitor lands on /events.
 * Triggers on `?ref=CODE` or `?welcome=1`. One-time per browser session.
 * Auto-detects language from IP geo (non-US → Spanish), with an EN/ES toggle.
 */
export default function EventPlannerWelcomeModal() {
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const { country } = useGeoLocation();

  // Default language: Spanish for non-US IPs, English otherwise.
  // Once the user toggles, their choice sticks for the session.
  const [lang, setLang] = useState<Lang>("en");
  const [userOverride, setUserOverride] = useState(false);

  useEffect(() => {
    if (userOverride) return;
    if (country && country.toUpperCase() !== "US") setLang("es");
    else setLang("en");
  }, [country, userOverride]);

  useEffect(() => {
    const hasRef = !!params.get("ref");
    const forceWelcome = params.get("welcome") === "1";
    if (!hasRef && !forceWelcome) return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    const t = setTimeout(() => setOpen(true), 250);
    return () => clearTimeout(t);
  }, [params]);

  const handleClose = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const copy = useMemo(() => COPY[lang], [lang]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border-border/40">
        {/* Language toggle */}
        <div className="absolute top-3 right-12 flex items-center gap-1 rounded-full border border-border/50 bg-background/60 p-0.5 text-[11px]">
          {(["en", "es"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => { setUserOverride(true); setLang(code); }}
              className={`px-2 py-0.5 rounded-full transition-colors ${
                lang === code ? "evt-chip-active bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={lang === code}
            >
              {code === "en" ? "EN" : "ES"}
            </button>
          ))}
        </div>

        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{copy.eyebrow}</span>
          </div>
          <DialogTitle className="text-xl">{copy.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {copy.bullets.map((b, i) => (
            <Bullet key={i} icon={ICONS[i]} title={b.title}>
              {b.body}
            </Bullet>
          ))}
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={handleClose} className="w-full bg-primary text-primary-foreground">
            {copy.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Bullet({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-md bg-secondary/60 flex items-center justify-center mt-0.5">
        <Icon className="w-4 h-4 text-brand" />
      </div>
      <div className="text-sm">
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
