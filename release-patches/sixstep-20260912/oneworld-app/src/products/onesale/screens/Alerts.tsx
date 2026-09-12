import { Link } from "react-router-dom";
import { useI18n, useOneId, useAsync, supabase, productHref, W, ScreenHeading,} from "@oneworld/shell";

/**
 * /rentals/alerts — the bell.
 * ============================================================================================
 * A product that names a `notificationsPath` and then 404s on it is a broken control in the
 * header of every screen. This reads the shared `notifications` table filtered to this product,
 * so nothing new is invented for OneRental's bell.
 */
export default function Alerts() {
  const { lang } = useI18n();
  const { userId } = useOneId();

  const rows = useAsync(async () => {
    if (!userId) return [];
    const { data } = await supabase.from("notifications")
      .select("id, title, body, created_at, read_at, link")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    return data ?? [];
  }, [userId]);

  return (
    <div className="space-y-4">
      <ScreenHeading>{W(lang, "Alerts", "Avisos")}</ScreenHeading>
      <div className="mt-4 space-y-2">
        {rows === undefined && [0, 1].map(i => <div key={i} className="card ow-shimmer h-16" />)}
        {rows?.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm font-bold">{W(lang, "Nothing yet.", "Nada todavía.")}</p>
            <p className="mt-1 text-[12.5px] opacity-55">
              {W(lang,
                "You will hear from us when someone asks about a place, signs a contract, or answers your walkthrough photos.",
                "Le avisaremos cuando alguien pregunte por un inmueble, firme un contrato o responda las fotos del acta.")}
            </p>
          </div>
        )}
        {rows?.map((n: any) => (
          <Link key={n.id} to={n.link ?? productHref("onesale")} className="card ow-tap block p-3">
            <p className="text-[13.5px] font-bold">{n.title}</p>
            {n.body && <p className="mt-0.5 text-[12.5px] leading-snug opacity-70">{n.body}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
