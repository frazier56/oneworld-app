/**
 * EXPRESS GATE — /events/join-express?next=<path> (PUBLIC route).
 * ============================================================================================
 * Lee's standing rule (17 Aug 2026): ANY action gated behind an account — Message Host, Save
 * Event, anything — goes through the SAME 20-second express account creation used at ticket
 * checkout (Google, or name+email+phone+password, no codes), and then returns the person to
 * exactly where they came from so the action completes. "Anything that's gated by a sign up
 * should always remember where it came from so it can take that user right back."
 *
 * The page is just the ExpressJoin card with a return path. The moment a session exists
 * (express create finishes, or they came back signed in), it forwards to `next`. Google's
 * OAuth redirect goes straight to `next` itself.
 */
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@evt/hooks/useAuth";
import { Navbar } from "@evt/components/Navbar";
import ExpressJoin from "@evt/components/ExpressJoin";
import { ScreenHeading } from "@oneworld/shell";
import { useLanguage } from "@evt/i18n/LanguageContext";

export default function ExpressGate() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const { t } = useLanguage();
  const raw = params.get("next") ?? "/events";
  // Same validation rule as SignInWithReturn: relative paths only, never protocol-relative.
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/events";

  useEffect(() => {
    if (!loading && user?.id) navigate(next, { replace: true });
  }, [loading, user?.id, next, navigate]);

  return (
    <div>
      <Navbar />
      <div className="pb-8">
        <ScreenHeading>{t("express.gate_title", "Join")}</ScreenHeading>
        <p className="text-sm text-muted-foreground mb-4">
          {t("express.gate_sub", "One quick account and you're right back where you were.")}
        </p>
        <ExpressJoin eventCheckoutPath={next} />
      </div>
    </div>
  );
}
