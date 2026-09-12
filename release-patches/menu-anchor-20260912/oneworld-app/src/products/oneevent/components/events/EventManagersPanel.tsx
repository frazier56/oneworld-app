/**
 * EventManagersPanel — v22 CB (Lee, 18 Aug 2026): "Assign event manager" on the host's
 * Overview tab. *"He needs a button in his overview section… what do you want them to do —
 * QR check-in, manual check-ins, food and drink tickets, share media — or select all.
 * Just for this event or for all events. Generate link. Boom. Share it. It should expire
 * very quickly."*
 *
 * Generates a single-use invite link (15-minute expiry, server-enforced) to
 * /events/manage-invite/{token}. The invitee signs in (express account if new) and gets
 * a restricted manage portal — tabs filtered by the permissions picked here.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { useMicro } from "@evt/i18n/LanguageContext";
import { toast } from "sonner";
import { UserPlus, Copy, Share2, Clock, X, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@evt/lib/utils";

const PERMS = [
  { key: "all", label: "Everything below" },
  { key: "check-in", label: "QR & manual check-in" },
  { key: "food-drink", label: "Food & drink vouchers" },
  { key: "media", label: "Share media" },
  { key: "registrations", label: "View tickets" },
];

interface ManagerRow { id: string; user_id: string; event_id: string | null; permissions: string[]; name?: string }

export default function EventManagersPanel({ eventId, hostId, currentUserId, embedded = false, startOpen = false }: {
  eventId: string; hostId: string; currentUserId: string;
  embedded?: boolean; startOpen?: boolean;
}) {
  const m = useMicro();
  const [open, setOpen] = useState(startOpen);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set(["all"]));
  const [scope, setScope] = useState<"event" | "all">("event");
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);

  const isHost = currentUserId === hostId;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("event_managers" as any)
      .select("id, user_id, event_id, permissions")
      .or(`event_id.eq.${eventId},event_id.is.null`)
      .eq("host_id", hostId);
    const rows: ManagerRow[] = ((data as any[]) || []);
    if (rows.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", rows.map((r) => r.user_id));
      const names = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
      rows.forEach((r) => { r.name = names.get(r.user_id) || "Manager"; });
    }
    setManagers(rows);
  }, [eventId, hostId]);

  useEffect(() => { if (isHost) void load(); }, [isHost, load]);

  if (!isHost) return null;

  const togglePerm = (key: string) => {
    setPicked((prev) => {
      if (key === "all") return new Set(["all"]);
      /* v25 EF: unchecking one row while "Select all" is on keeps the OTHERS checked. */
      if (prev.has("all")) {
        const next = new Set(PERMS.filter((p) => p.key !== "all" && p.key !== key).map((p) => p.key));
        return next.size ? next : new Set(["all"]);
      }
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      /* All four checked by hand = everything. */
      if (PERMS.filter((p) => p.key !== "all").every((p) => next.has(p.key))) return new Set(["all"]);
      return next.size ? next : new Set(["all"]);
    });
  };

  const generate = async () => {
    setBusy(true);
    setLink(null);
    const { data, error } = await supabase
      .from("event_manager_invites" as any)
      .insert({
        event_id: scope === "event" ? eventId : null,
        host_id: hostId,
        permissions: Array.from(picked),
      })
      .select("token, expires_at")
      .single();
    setBusy(false);
    if (error || !data) { toast.error(m("Could not generate the link")); return; }
    setLink(`${window.location.origin}/events/manage-invite/${(data as any).token}`);
    setExpiresAt(new Date((data as any).expires_at));
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success(m("Invite link copied"));
  };

  const share = () => {
    if (!link) return;
    if (navigator.share) {
      navigator.share({ title: "Help me run this event", text: "Tap this link to get check-in access (it expires in 15 minutes):", url: link }).catch(() => {});
    } else {
      copy();
    }
  };

  const remove = async (row: ManagerRow) => {
    if (!confirm(`Remove ${row.name}'s access?`)) return;
    const { error } = await supabase.from("event_managers" as any).delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(m("Access removed"));
    void load();
  };

  return (
    <div className={embedded ? "" : "rounded-2xl bg-card border border-border p-5"}>
      {!embedded && <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" /> {m("Event managers")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {m("Give an assistant check-in or voucher powers with an expiring link.")}
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-primary text-primary-foreground hover:opacity-90 transition-all">
          <UserPlus className="w-3.5 h-3.5" /> {open ? m("Close") : m("Assign manager")}
        </button>
      </div>}

      {/* Current managers */}
      {managers.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {managers.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{r.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {r.event_id ? m("this event") : m("all your events")} · {r.permissions.includes("all") ? m("everything") : r.permissions.length}
              </span>
              <button onClick={() => remove(r)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
                title={m("Remove access")}><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {/* v25 EF (Lee): "a straight-up vertical LIST, checkbox to the left — not dizzy
              bubbles you select horizontally." Select all sits on top; the rows below
              gray out while it's on. */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">{m("What can they do?")}</p>
            <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
              <label className="flex cursor-pointer items-center gap-3 bg-secondary/50 px-3 py-2.5">
                <input type="checkbox" checked={picked.has("all")} onChange={() => setPicked(new Set(["all"]))}
                  className="h-4 w-4 accent-primary" />
                <span className="text-sm font-bold text-foreground">{m("Select all")}</span>
              </label>
              {PERMS.filter((p) => p.key !== "all").map((p) => (
                <label key={p.key} className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                  picked.has("all") ? "opacity-45" : "hover:bg-secondary/40"
                )}>
                  <input type="checkbox"
                    checked={picked.has("all") || picked.has(p.key)}
                    onChange={() => togglePerm(p.key)}
                    className="h-4 w-4 accent-primary" />
                  <span className="text-sm font-medium text-foreground">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground mb-2">{m("For which events?")}</p>
            <div className="flex gap-2">
              <button onClick={() => setScope("event")}
                className={cn("flex-1 px-3 py-2 rounded-xl text-xs font-semibold border",
                  scope === "event" ? "bg-primary/10 text-primary border-primary/40" : "bg-secondary text-muted-foreground border-border")}>
                {m("Just this event")}
              </button>
              <button onClick={() => setScope("all")}
                className={cn("flex-1 px-3 py-2 rounded-xl text-xs font-semibold border",
                  scope === "all" ? "bg-primary/10 text-primary border-primary/40" : "bg-secondary text-muted-foreground border-border")}>
                {m("All my events")}
              </button>
            </div>
          </div>

          {!link ? (
            /* v25 EF: squared-off primary under the list (Lee: "more like a square button"). */
            <button onClick={generate} disabled={busy}
              className="ow-btn-espresso flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} {m("Generate invite link")}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="break-all rounded-xl bg-secondary/60 border border-border px-3 py-2 text-[11px] text-foreground">{link}</p>
              <div className="flex gap-2">
                <button onClick={share} className="ow-btn-espresso flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold">
                  <Share2 className="w-3.5 h-3.5" /> {m("Share")}
                </button>
                <button onClick={copy} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs font-bold text-foreground">
                  <Copy className="w-3.5 h-3.5" /> {m("Copy")}
                </button>
                <button onClick={() => void generate()} disabled={busy} className="flex items-center justify-center gap-1 rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs font-bold text-foreground disabled:opacity-50">
                  {m("New link")}
                </button>
              </div>
              <p className="flex items-center gap-1 text-[11px] text-amber-600">
                <Clock className="w-3 h-3" /> {m("Expires in 15 minutes — one person per link.")}
                {expiresAt ? ` · ${expiresAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
