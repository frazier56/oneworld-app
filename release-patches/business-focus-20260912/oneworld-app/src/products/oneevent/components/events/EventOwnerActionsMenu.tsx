import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, Copy, Trash2, UserCog, UserPlus, Users, Loader2, Search, X, Check, Eye, EyeOff, Settings } from "lucide-react";
import { supabase } from "@evt/integrations/supabase/client";
import { toast } from "sonner";

interface CoOwner {
  id: string;
  user_id: string;
  show_publicly: boolean;
  profile?: { full_name: string | null; photo_url: string | null; email: string | null };
}

interface ProfileHit {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  email: string | null;
}

interface Props {
  mode?: "menu" | "ownership";
  eventId: string;
  hostId: string;
  currentUserId: string;
  duplicating?: boolean;
  onEdit: () => void;
  onManage?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTransferred?: (newHostId: string) => void;
}

type Modal = null | "reassign" | "coowner-add" | "coowner-manage";

export default function EventOwnerActionsMenu({
  mode = "menu",
  eventId,
  hostId,
  currentUserId,
  duplicating,
  onEdit,
  onManage,
  onDuplicate,
  onDelete,
  onTransferred,
}: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coOwners, setCoOwners] = useState<CoOwner[]>([]);
  const [loadingCoOwners, setLoadingCoOwners] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPrimaryOwner = currentUserId === hostId;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Search profiles by name (debounced — profiles.email is owner-private, not searchable)
  useEffect(() => {
    if (modal !== "reassign" && modal !== "coowner-add") return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .ilike("full_name", `%${q}%`)
        .neq("id", hostId)
        .limit(8);
      if (!cancelled) {
        setResults((data as ProfileHit[]) || []);
        setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, modal, hostId]);

  const loadCoOwners = async () => {
    setLoadingCoOwners(true);
    const { data } = await supabase
      .from("event_co_owners")
      .select("id, user_id, show_publicly")
      .eq("event_id", eventId);
    const rows = (data as CoOwner[]) || [];
    if (rows.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", rows.map((r) => r.user_id));
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      rows.forEach((r) => { r.profile = map.get(r.user_id); });
    }
    setCoOwners(rows);
    setLoadingCoOwners(false);
  };

  const openModal = async (m: Modal) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setModal(m);
    if (m === "coowner-manage") await loadCoOwners();
  };

  const closeModal = () => { setModal(null); setQuery(""); setResults([]); };

  const handleReassign = async (newHost: ProfileHit) => {
    if (!confirm(`Transfer ownership of this event to ${newHost.full_name || newHost.email}? You will lose primary owner controls (transfer, add co-owners, delete).`)) return;
    setSubmitting(true);
    const { error } = await supabase.from("events").update({ host_id: newHost.id }).eq("id", eventId);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ownership transferred.");
    closeModal();
    onTransferred?.(newHost.id);
  };

  const handleAddCoOwner = async (newCo: ProfileHit) => {
    setSubmitting(true);
    const { error } = await supabase.from("event_co_owners").insert({
      event_id: eventId,
      user_id: newCo.id,
      added_by: currentUserId,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Already a co-owner." : error.message); return; }
    toast.success(`${newCo.full_name || newCo.email} added as co-owner.`);
    closeModal();
  };

  const togglePublicCoOwner = async (row: CoOwner) => {
    const { error } = await supabase.from("event_co_owners").update({ show_publicly: !row.show_publicly }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setCoOwners((prev) => prev.map((r) => r.id === row.id ? { ...r, show_publicly: !r.show_publicly } : r));
  };

  const removeCoOwner = async (row: CoOwner) => {
    if (!confirm(`Remove ${row.profile?.full_name || "this co-owner"}? They will no longer be able to manage this event.`)) return;
    const { error } = await supabase.from("event_co_owners").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setCoOwners((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Co-owner removed.");
  };

  return (
    <>
      <div ref={menuRef} className="relative">
        {mode === "menu" && <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Event actions"
          className="flex items-center justify-center w-10 h-10 rounded-xl border border-primary/35 bg-primary/10 text-primary shadow-sm shadow-primary/15 backdrop-blur-md hover:bg-primary/15 hover:border-primary/50 transition-colors"
        >
          <MoreVertical className="h-[18px] w-[18px]" strokeWidth={2.8} />
        </button>}

        {(open || mode === "ownership") && (
          <div className={mode === "ownership" ? "w-full" : "absolute right-0 top-11 z-40 w-56 rounded-xl bg-card border border-border shadow-xl overflow-hidden"}>
            {mode === "menu" && <>
            {onManage && (
              <MenuItem icon={<Settings className="w-4 h-4" />} label="Manage Event" onClick={() => { setOpen(false); onManage(); }} />
            )}
            <MenuItem icon={<Pencil className="w-4 h-4" />} label="Edit Event" onClick={() => { setOpen(false); onEdit(); }} />
            <MenuItem
              icon={duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              label="Duplicate"
              onClick={() => { setOpen(false); onDuplicate(); }}
              disabled={duplicating}
            />
            </>}
            {isPrimaryOwner && (
              <>
                {mode === "menu" && <div className="h-px bg-border" />}
                <MenuItem icon={<UserCog className="w-4 h-4" />} label="Reassign Owner" onClick={() => openModal("reassign")} />
                <MenuItem icon={<UserPlus className="w-4 h-4" />} label="Add Co-owner" onClick={() => openModal("coowner-add")} />
                <MenuItem icon={<Users className="w-4 h-4" />} label="Manage Co-owners" onClick={() => openModal("coowner-manage")} />
                {mode === "menu" && <><div className="h-px bg-border" />
                <MenuItem icon={<Trash2 className="w-4 h-4" />} label="Delete Event" destructive onClick={() => { setOpen(false); onDelete(); }} /></>}
              </>
            )}
          </div>
        )}
      </div>

      {modal && createPortal(
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeModal}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-5 w-full max-w-md relative">
            <button aria-label="Close ownership dialog" onClick={closeModal} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>

            {modal === "reassign" && (
              <>
                <h3 className="text-base font-bold text-foreground mb-1">Reassign Owner</h3>
                <p className="text-xs text-muted-foreground mb-4">Transfer this event to another OneEvent member. You will become a co-owner and lose transfer/delete rights.</p>
              </>
            )}
            {modal === "coowner-add" && (
              <>
                <h3 className="text-base font-bold text-foreground mb-1">Add Co-owner</h3>
                <p className="text-xs text-muted-foreground mb-4">Co-owners can edit the event and manage registrations, applications, media, and check-ins. They can't transfer or delete it.</p>
              </>
            )}

            {(modal === "reassign" || modal === "coowner-add") && (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto -mx-1 px-1">
                  {searching && <p className="text-xs text-muted-foreground py-3 text-center">Searching…</p>}
                  {!searching && query.trim().length >= 2 && results.length === 0 && (
                    <p className="text-xs text-muted-foreground py-3 text-center">No members match that search.</p>
                  )}
                  {results.map((r) => (
                    <button
                      key={r.id}
                      disabled={submitting}
                      onClick={() => modal === "reassign" ? handleReassign(r) : handleAddCoOwner(r)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors text-left disabled:opacity-50"
                    >
                      {r.photo_url
                        ? <img src={r.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        : <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">{(r.full_name || r.email || "?").charAt(0).toUpperCase()}</div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.full_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {modal === "coowner-manage" && (
              <>
                <h3 className="text-base font-bold text-foreground mb-1">Co-owners</h3>
                <p className="text-xs text-muted-foreground mb-4">Toggle public visibility or remove a co-owner. They can manage the event but can't transfer or delete it.</p>

                {loadingCoOwners && <p className="text-xs text-muted-foreground py-3 text-center">Loading…</p>}
                {!loadingCoOwners && coOwners.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 text-center">No co-owners yet. Use "Add Co-owner" to invite someone.</p>
                )}

                <div className="max-h-72 overflow-y-auto space-y-2">
                  {coOwners.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border">
                      {row.profile?.photo_url
                        ? <img src={row.profile.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        : <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">{(row.profile?.full_name || row.profile?.email || "?").charAt(0).toUpperCase()}</div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{row.profile?.full_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground truncate">{row.profile?.email}</p>
                      </div>
                      <button
                        onClick={() => togglePublicCoOwner(row)}
                        title={row.show_publicly ? "Showing publicly — click to hide" : "Hidden — click to show publicly"}
                        className={`p-1.5 rounded-md border ${row.show_publicly ? "bg-primary/15 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border"}`}
                      >
                        {row.show_publicly ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => removeCoOwner(row)}
                        className="p-1.5 rounded-md text-destructive hover:bg-destructive/10"
                        aria-label="Remove co-owner"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>, document.body
      )}
    </>
  );
}

function MenuItem({ icon, label, onClick, disabled, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-left transition-colors disabled:opacity-50 ${destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-secondary"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
