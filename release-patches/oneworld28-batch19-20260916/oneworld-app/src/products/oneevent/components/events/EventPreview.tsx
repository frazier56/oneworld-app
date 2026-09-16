import { ArrowLeft, MapPin, Calendar, Shield, Star, Sparkles, BookmarkIcon, CheckCircle2, ImageIcon, Users, Ticket } from "lucide-react";
import { currencySymbol } from "@evt/lib/currencies";
import { Button } from "@evt/components/ui/button";
import type { EventFormData } from "./CreateEventForm";
import { useAuth } from "@evt/hooks/useAuth";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@evt/integrations/supabase/client";
import { CollapsibleDescription } from "./CollapsibleDescription";
import OneScoreDonut from "@evt/components/app/OneScoreDonut";
import { useLanguage } from "@evt/i18n/LanguageContext";
import { createEventOptionText, createEventText } from "@evt/i18n/createEventLocale";

interface Props {
  formData: EventFormData;
  onBack: () => void;
  onPublish: () => void;
}

function localeTag(lang: string) {
  return lang === "co" ? "es-CO"
    : lang === "es" ? "es"
    : lang === "de" ? "de-DE"
    : lang === "ru" ? "ru-RU"
    : lang === "zh" ? "zh-CN"
    : lang === "pt" ? "pt-BR"
    : "en-US";
}

function formatDateRange(start: string, end: string, lang: string) {
  if (!start) return "TBD";
  try {
    const formatter = new Intl.DateTimeFormat(localeTag(lang), { month: "short", day: "numeric", year: "numeric" });
    const s = formatter.format(new Date(start + "T00:00:00"));
    if (end && end !== start) {
      const e = formatter.format(new Date(end + "T00:00:00"));
      return `${s} – ${e}`;
    }
    return s;
  } catch { return start; }
}

function formatTime(t: string, lang: string) {
  if (!t) return "";
  try {
    const [h, m] = t.split(":");
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m));
    return new Intl.DateTimeFormat(localeTag(lang), { hour: "numeric", minute: "2-digit" }).format(d);
  } catch { return t; }
}

export default function EventPreview({ formData, onBack, onPublish }: Props) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const ce = (english: string) => createEventText(lang, english);
  // Every view opens at the top (Lee, Jul 22) — Preview is a state toggle, not a
  // route change, so scroll to top on mount.
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [displayName, setDisplayName] = useState("");
  const [hostScore, setHostScore] = useState(0);
  const [hostPhotoUrl, setHostPhotoUrl] = useState<string | null>(null);
  const [hostProfession, setHostProfession] = useState<string>("");
  const [publishing, setPublishing] = useState(false);
  const [localCoverUrl, setLocalCoverUrl] = useState("");
  const shownDisplayName = displayName || ce("You");

  const handlePublish = () => {
    setPublishing(true);
    onPublish();
  };

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("profiles")
        /* Granted columns only — custom_expertise/subcategory are not in the granted set
           and would 42501 the whole preview. job_title/category carry the profession line. */
        .select("full_name, photo_url, job_title, category")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          if (data.full_name) setDisplayName(data.full_name);
          if (data.photo_url) setHostPhotoUrl(data.photo_url);
          const profession =
            data.job_title?.trim() ||
            data.category?.trim() ||
            "";
          setHostProfession(profession);
        });
      supabase.from("score_history").select("one_score").eq("user_id", user.id).order("calculated_at", { ascending: false }).limit(1).then(({ data }) => {
        if (data?.[0]) setHostScore(data[0].one_score);
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!formData.coverImage) {
      setLocalCoverUrl("");
      return;
    }
    const next = URL.createObjectURL(formData.coverImage);
    setLocalCoverUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [formData.coverImage]);

  const locationText = formData.locationType === "online" ? ce("Online") : (formData.location || ce("TBD"));
  const dateText = formData.startDate ? formatDateRange(formData.startDate, formData.endDate || (formData.sameDay ? formData.startDate : ""), lang) : ce("TBD");
  const timeText = [formatTime(formData.startTime, lang), formatTime(formData.endTime, lang)].filter(Boolean).join(" – ");
  const allMedia = formData.attachmentUrls.filter(a => /\.(jpg|jpeg|png|webp|gif)$/i.test(a.name));
  const coverDisplayUrl = localCoverUrl || formData.coverImageUrl;
  const hasCover = !!coverDisplayUrl;
  const symbol = currencySymbol(formData.currency);
  const priceText = formData.ticketMode === "free" ? ce("Free") : `${symbol}${formData.generalAdmissionPrice || "0"} ${(formData.currency || "USD").toUpperCase()}`;
  const capacityText = formData.isUnlimitedCapacity ? ce("Unlimited") : (formData.capacity || ce("TBD"));
  const venueName = formData.venueName || (formData.location ? formData.location.split(",")[0].trim() : "");

  return (
    <div className="min-h-screen bg-background">
      {/* Preview banner — v24 DN (Lee): the back link gets its OWN title row (there was no
          title there anyway), and the two real actions sit centered beneath it, polished.
          "You're previewing" reads as a state, not a button. */}
      <div className="sticky top-0 z-50 border-b border-primary/30 bg-primary/5 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex h-8 items-center">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-primary hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-4 h-4" /> {ce("Back to Edit")}
            </button>
          </div>
          <div className="mt-1 flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {ce("You're previewing")}
            </span>
            <Button size="sm" onClick={handlePublish} className="ow-btn-espresso rounded-full px-5 text-xs font-bold" disabled={publishing}>
              <Sparkles className="w-3.5 h-3.5 mr-1" /> {publishing ? ce("Processing…") : ce("Publish Now")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">

        {/* Hero — renders flyer in its native aspect ratio (no crop) */}
        {(() => {
          const ratio = (formData as any).coverAspectRatio || "16:9";
          const isFlyer = ratio === "4:5" || ratio === "9:16" || ratio === "1:1";
          /* HERO SIZING FIX (16 Aug 2026) — same repair as EventDetail: flyers keep their
             own aspect (height-capped) instead of being letterboxed into a 16/7 strip. */
          const heroAspect = ratio === "1:1" ? "1/1" : ratio === "4:5" ? "4/5" : ratio === "9:16" ? "9/16" : "16/7";
          return (
            <div className="relative rounded-2xl overflow-hidden mb-6 bg-black/40 mx-auto" style={{ aspectRatio: heroAspect, maxHeight: isFlyer ? "min(72vh, 560px)" : undefined }}>
              {hasCover ? (
                <>
                  {isFlyer && (
                    <img src={coverDisplayUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50" />
                  )}
                  <img
                    src={coverDisplayUrl}
                    alt={ce("Event cover")}
                    className={`relative z-[1] w-full h-full ${isFlyer ? "object-contain" : "object-cover"}`}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center">
                  <Calendar size={48} className="text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute inset-0 z-[2] pointer-events-none" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.88) 100%)" }} />
              <div className="absolute bottom-5 left-6 right-6 z-[3]">
                <h1 className="text-xl md:text-3xl font-bold text-white mb-1.5 leading-tight" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
                  {formData.eventName || ce("Untitled Event")}
                </h1>
                <p className="text-xs text-white/60">{ce("Posted just now · Registrations open")}</p>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Main content */}
          <div className="space-y-6">
            {/* Event Media */}
            {allMedia.length > 0 && (
              <div className="rounded-2xl p-6 bg-card border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">{ce("Event Media")}</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allMedia.map((a, i) => (
                    <div key={i} className="rounded-xl overflow-hidden aspect-video bg-secondary">
                      <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <CollapsibleDescription text={formData.description || ce("No description provided.")} />

          </div>

          {/* Sidebar — 4 boxes */}
          <div className="space-y-4">
            {/* Box 1: Event Details */}
            <div className="rounded-2xl p-5 bg-card border border-border space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{ce("Event Details")}</h3>
              {formData.category && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{ce("Category")}</span>
                  <span className="font-medium text-foreground">{createEventOptionText(lang, formData.category)}</span>
                </div>
              )}
              {formData.eventType && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{ce("Event Type")}</span>
                  <span className="font-medium text-foreground capitalize">{createEventOptionText(lang, formData.eventType)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {ce("Date")}</span>
                <span className="font-medium text-foreground text-right text-xs">{dateText}{timeText && <><br /><span className="text-muted-foreground font-normal">{timeText}</span></>}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {ce("Location")}</span>
                <span className="font-medium text-foreground text-right text-xs max-w-[200px] truncate">{venueName || locationText}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {ce("Capacity")}</span>
                <span className="font-medium text-foreground">{capacityText}</span>
              </div>
              {formData.requireScore && formData.minScore > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-primary" /> {ce("Min Score")}</span>
                  <span className="font-medium text-foreground">{formData.minScore}+</span>
                </div>
              )}
            </div>

            {/* Box 2: Register / Tickets */}
            <div className="rounded-2xl p-5 bg-card border border-border">
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{ce("General Admission")}</p>
                  <p className="text-lg font-bold text-foreground">{priceText}</p>
                </div>
                {formData.hasVipTicket && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">VIP</p>
                    <p className="text-lg font-bold text-foreground">{symbol}{formData.vipPrice || "0"} {(formData.currency || "USD").toUpperCase()}</p>
                  </div>
                )}
              </div>
              <Button className="w-full rounded-xl bg-primary text-primary-foreground font-semibold">
                {formData.requiresApplication ? ce("Request to Join") : ce("Register Now")}
              </Button>
            </div>

            {/* Box 3: Save Event */}
            <div className="rounded-2xl p-5 bg-card border border-border">
              <Button variant="outline" className="w-full rounded-xl font-semibold">
                <BookmarkIcon className="w-4 h-4 mr-2" /> {ce("Save Event")}
              </Button>
            </div>

            {/* Box 4: Hosted By — clickable card linking to host's profile */}
            <Link
              to={user?.id ? `/events/p/${user.id}` : "#"}
              state={{ from: "/events/events", backLabel: ce("Back to Event") }}
              className="relative block rounded-2xl p-5 bg-card border border-border transition-all hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {hostScore > 0 && (
                <div className="absolute top-5 right-5">
                  <OneScoreDonut
                    score={hostScore}
                    size={56}
                    strokeWidth={4}
                    label=""
                    wholeClassName="text-base"
                    decimalClassName="text-[10px]"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{ce("Hosted By")}</p>
              <div className="flex items-center gap-3 pr-16">
                <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-primary/15 border border-white/10">
                  {hostPhotoUrl ? (
                    <img src={hostPhotoUrl} alt={shownDisplayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-primary">
                      {shownDisplayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-foreground leading-tight truncate">{shownDisplayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{hostProfession || ce("Host")}</p>
                </div>
              </div>
            </Link>

            {/* Box 5: How ticketing works — mirrors EventDetail's counsel-accurate copy
                (no "protected/guaranteed/verified" claims). */}
            <div className="rounded-2xl p-5 bg-card border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{ce("Ticketing by OneEvent")}</span>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> {ce("Payment is held by OneEvent and released to the host per the event's refund terms")}</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> {ce("Hosts show a public profile and OneScore")}</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> {ce("QR check-in system")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
