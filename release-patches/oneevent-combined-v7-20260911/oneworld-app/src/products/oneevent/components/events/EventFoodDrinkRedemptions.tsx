import { useEffect, useState, useRef } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import QRCode from "qrcode";
import { Utensils, Wine, CheckCircle2, Clock } from "lucide-react";
import { useLanguage } from "@evt/i18n/LanguageContext";

interface FdItem {
  id: string;
  name: string;
  description: string | null;
  item_type: "food" | "drink";
  quantity_per_ticket: number;
}

interface Redemption {
  id: string;
  item_id: string;
  qr_code: string;
  redeemed_at: string | null;
}

interface Props {
  registrationId: string;
  eventId: string;
}

/** Attendee-facing list of food/drink QR codes attached to a ticket. */
export default function EventFoodDrinkRedemptions({ registrationId, eventId }: Props) {
  const { lang } = useLanguage();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [items, setItems] = useState<Record<string, FdItem>>({});
  const [loading, setLoading] = useState(true);

  const isEs = lang === "es";
  const t = (en: string, es: string) => (isEs ? es : en);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Fetch event items and existing redemptions in parallel
      const [{ data: itemRows }, { data: redRows }] = await Promise.all([
        supabase
          .from("event_food_drink_items")
          .select("id, name, description, item_type, quantity_per_ticket")
          .eq("event_id", eventId),
        supabase
          .from("event_food_drink_redemptions")
          .select("id, item_id, qr_code, redeemed_at")
          .eq("registration_id", registrationId),
      ]);
      if (cancelled) return;

      const itMap: Record<string, FdItem> = {};
      (itemRows || []).forEach((i: any) => { itMap[i.id] = i; });
      setItems(itMap);

      // If no redemptions exist yet, create one per quantity_per_ticket per item
      let reds: Redemption[] = (redRows || []) as any;
      const missing = (itemRows || []).filter((it: any) => !reds.some((r) => r.item_id === it.id));
      if (missing.length > 0) {
        const inserts: any[] = [];
        missing.forEach((it: any) => {
          const qty = Math.max(1, it.quantity_per_ticket || 1);
          for (let i = 0; i < qty; i++) {
            inserts.push({ item_id: it.id, registration_id: registrationId });
          }
        });
        if (inserts.length > 0) {
          const { data: created } = await supabase
            .from("event_food_drink_redemptions")
            .insert(inserts)
            .select("id, item_id, qr_code, redeemed_at");
          if (created) reds = [...reds, ...(created as any)];
        }
      }
      setRedemptions(reds);
      setLoading(false);
    })();

    // Listen for redemption updates so the QR flips to "redeemed" live
    const ch = supabase
      .channel(`fd-red-${registrationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "event_food_drink_redemptions", filter: `registration_id=eq.${registrationId}` },
        (payload: any) => {
          setRedemptions((prev) => prev.map((r) => (r.id === payload.new.id ? { ...r, redeemed_at: payload.new.redeemed_at } : r)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [registrationId, eventId]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-5 text-center">
        <p className="text-xs text-muted-foreground">{t("Loading vouchers…", "Cargando vales…")}</p>
      </div>
    );
  }

  if (redemptions.length === 0) return null;

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
      <div className="text-center">
        <h3 className="text-base font-bold text-foreground flex items-center justify-center gap-2">
          <Utensils className="w-4 h-4 text-primary" />
          {t("Food & Drink Vouchers", "Vales de Comida y Bebida")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "Show each QR to staff to redeem. Each one is single-use.",
            "Muestra cada QR al personal para canjear. Cada uno es de un solo uso.",
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {redemptions.map((r) => {
          const it = items[r.item_id];
          if (!it) return null;
          return (
            <RedemptionVoucher key={r.id} redemption={r} item={it} t={t} />
          );
        })}
      </div>
    </div>
  );
}

function RedemptionVoucher({
  redemption, item, t,
}: {
  redemption: Redemption;
  item: FdItem;
  t: (en: string, es: string) => string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && !redemption.redeemed_at) {
      QRCode.toCanvas(
        canvasRef.current,
        JSON.stringify({ type: "fd_redemption", id: redemption.id, code: redemption.qr_code }),
        { width: 140, margin: 1, color: { dark: "#000", light: "#fff" } },
      ).catch(() => {});
    }
  }, [redemption.id, redemption.qr_code, redemption.redeemed_at]);

  const isRedeemed = !!redemption.redeemed_at;

  return (
    <div
      className={`rounded-xl p-3 text-center border transition-all ${
        isRedeemed
          ? "bg-emerald-500/5 border-emerald-500/30 opacity-60"
          : "bg-white/5 border-border/40"
      }`}
    >
      <div className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center mb-2 ${
        item.item_type === "drink" ? "bg-blue-500/15 text-blue-400" : "bg-amber-500/15 text-amber-400"
      }`}>
        {item.item_type === "drink" ? <Wine className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
      </div>
      <p className="text-xs font-bold text-foreground mb-2 line-clamp-1">{item.name}</p>
      {isRedeemed ? (
        <div className="flex flex-col items-center gap-1 py-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <p className="text-[10px] font-semibold text-emerald-400">{t("Redeemed", "Canjeado")}</p>
        </div>
      ) : (
        <div className="bg-white p-1.5 rounded-md inline-block">
          <canvas ref={canvasRef} />
        </div>
      )}
      <p className="text-[9px] text-muted-foreground mt-1 font-mono truncate">
        {redemption.qr_code.slice(0, 8).toUpperCase()}
      </p>
    </div>
  );
}
