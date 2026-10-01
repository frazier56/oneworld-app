/**
 * ManagerInviteClaim — /events/manage-invite/:token (v22 CB, Lee 18 Aug 2026).
 *
 * The landing page for an event-manager invite link. Lee's flow: *"he sends them a link…
 * they create an account — same type of express account — and then they'll have access to
 * the managed portal… they're gonna have to be prompted: you're gonna have to create an
 * account to manage this event."*
 *
 * Signed out → bounce through join-express (the 20-second account) with ?next back here.
 * Signed in  → claim_event_manager_invite RPC redeems the token (15-minute expiry,
 * single-claim) and lands them in the host's manage portal, restricted to the
 * permissions the host picked.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@evt/hooks/useAuth";
import { supabase } from "@evt/integrations/supabase/client";
import AppLayout from "@evt/components/app/AppLayout";
import { ShieldCheck, Clock, XCircle, Loader2 } from "lucide-react";

export default function ManagerInviteClaim() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"working" | "ok" | "expired" | "invalid" | "claimed" | "own" | "error">("working");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // The express prompt: create the 20-second account, come straight back.
      navigate(`/events/join-express?next=${encodeURIComponent(`/events/manage-invite/${token}`)}`, { replace: true });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("claim_event_manager_invite" as any, { p_token: token });
      const res: any = data;
      if (error) { setState("error"); return; }
      if (res?.ok) {
        setState("ok");
        setTimeout(() => {
          /* v25 EF (Lee): land them INSIDE the manage screen with the quick next-next-done
             tour — "as if they clicked manage and boom, they got access." */
          navigate(res.event_id ? `/events/events/${res.event_id}/manage?welcome=manager` : "/events/events?tab=hosting", { replace: true });
        }, 900);
        return;
      }
      switch (res?.error) {
        case "expired": setState("expired"); break;
        case "already_claimed": setState("claimed"); break;
        case "own_invite": setState("own"); break;
        case "invalid": default: setState("invalid"); break;
      }
    })();
  }, [authLoading, user, token, navigate]);

  const body = (() => {
    switch (state) {
      case "working":
        return (<><Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground mt-3">Checking your invite…</p></>);
      case "ok":
        return (<><ShieldCheck className="w-8 h-8 mx-auto text-green-500" />
          <p className="text-sm font-semibold text-foreground mt-3">You're in — opening the manage portal…</p></>);
      case "expired":
        return (<><Clock className="w-8 h-8 mx-auto text-amber-500" />
          <p className="text-sm font-semibold text-foreground mt-3">This invite has expired</p>
          <p className="text-xs text-muted-foreground mt-1">Invite links last 15 minutes. Ask the host to generate a fresh one.</p></>);
      case "claimed":
        return (<><XCircle className="w-8 h-8 mx-auto text-destructive" />
          <p className="text-sm font-semibold text-foreground mt-3">This invite was already used</p>
          <p className="text-xs text-muted-foreground mt-1">Each link works for one person. Ask the host for your own link.</p></>);
      case "own":
        return (<><XCircle className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground mt-3">This is your own invite link</p>
          <p className="text-xs text-muted-foreground mt-1">Share it with your assistant — you already have full access.</p></>);
      default:
        return (<><XCircle className="w-8 h-8 mx-auto text-destructive" />
          <p className="text-sm font-semibold text-foreground mt-3">This invite link isn't valid</p>
          <p className="text-xs text-muted-foreground mt-1">Check the link, or ask the host to generate a new one.</p></>);
    }
  })();

  return (
    <AppLayout>
      <div className="mx-auto max-w-sm py-16 text-center">
        <div className="rounded-2xl border border-border bg-card p-8">{body}</div>
      </div>
    </AppLayout>
  );
}
