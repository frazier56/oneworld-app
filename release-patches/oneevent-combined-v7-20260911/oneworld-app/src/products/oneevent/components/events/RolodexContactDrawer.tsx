import { useEffect, useState } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { useAuth } from "@evt/hooks/useAuth";
import { X, Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

interface Props {
  rolodexId: string;
  contactName: string;
  onClose: () => void;
}

interface Note {
  id: string;
  body: string;
  created_at: string;
}

interface RolodexRow {
  name: string | null;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  location: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
}

export default function RolodexContactDrawer({ rolodexId, contactName, onClose }: Props) {
  const { user } = useAuth();
  const [row, setRow] = useState<RolodexRow | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<RolodexRow>>({});

  const load = async () => {
    const { data: r } = await supabase
      .from("host_rolodex" as any)
      .select("name, email, phone, occupation, location, tags, custom_fields")
      .eq("id", rolodexId)
      .single();
    if (r) {
      setRow(r as any);
      setForm(r as any);
    }
    const { data: n } = await supabase
      .from("rolodex_notes" as any)
      .select("id, body, created_at")
      .eq("rolodex_id", rolodexId)
      .order("created_at", { ascending: false });
    if (n) setNotes(n as any);
  };

  useEffect(() => { load(); }, [rolodexId]);

  const addNote = async () => {
    if (!draft.trim() || !user?.id) return;
    const { error } = await supabase.from("rolodex_notes" as any).insert({
      rolodex_id: rolodexId,
      host_id: user.id,
      body: draft.trim(),
    });
    if (error) return toast.error("Failed to save note");
    setDraft("");
    load();
  };

  const deleteNote = async (id: string) => {
    await supabase.from("rolodex_notes" as any).delete().eq("id", id);
    load();
  };

  const addTag = async () => {
    if (!tagDraft.trim() || !row) return;
    const next = Array.from(new Set([...(row.tags || []), tagDraft.trim().toLowerCase()]));
    const { error } = await supabase.from("host_rolodex" as any).update({ tags: next }).eq("id", rolodexId);
    if (error) return toast.error("Failed");
    setTagDraft("");
    load();
  };

  const removeTag = async (t: string) => {
    if (!row) return;
    const next = (row.tags || []).filter((x) => x !== t);
    await supabase.from("host_rolodex" as any).update({ tags: next }).eq("id", rolodexId);
    load();
  };

  const saveFields = async () => {
    const { error } = await supabase.from("host_rolodex" as any).update({
      name: form.name || null,
      email: form.email || null,
      phone: form.phone || null,
      occupation: form.occupation || null,
      location: form.location || null,
    }).eq("id", rolodexId);
    if (error) return toast.error("Failed to save");
    toast.success("Saved");
    setEditing(false);
    load();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md h-full bg-card border-l border-border overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-foreground truncate">{row?.name || contactName}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Basic fields */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact info</h3>
              <button onClick={() => setEditing(!editing)} className="text-xs text-primary font-semibold">
                {editing ? "Cancel" : "Edit"}
              </button>
            </div>
            {editing ? (
              <div className="space-y-2">
                {(["name","email","phone","occupation","location"] as const).map((f) => (
                  <input key={f} value={(form[f] as string) || ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                    placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" />
                ))}
                <button onClick={saveFields} className="w-full mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Save</button>
              </div>
            ) : (
              <dl className="text-sm space-y-1.5">
                {row?.email && <div><dt className="inline text-muted-foreground">Email: </dt><dd className="inline text-foreground">{row.email}</dd></div>}
                {row?.phone && <div><dt className="inline text-muted-foreground">Phone: </dt><dd className="inline text-foreground">{row.phone}</dd></div>}
                {row?.occupation && <div><dt className="inline text-muted-foreground">Occupation: </dt><dd className="inline text-foreground">{row.occupation}</dd></div>}
                {row?.location && <div><dt className="inline text-muted-foreground">Location: </dt><dd className="inline text-foreground">{row.location}</dd></div>}
                {!row?.email && !row?.phone && !row?.occupation && !row?.location && (
                  <p className="text-xs text-muted-foreground italic">No contact info yet — tap Edit to add.</p>
                )}
              </dl>
            )}
          </section>

          {/* Tags */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(row?.tags || []).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                placeholder="Add tag (e.g., vip)"
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" />
              <button onClick={addTag} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground hover:bg-primary/10">
                <Tag className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Custom fields (read-only, from app forms / CSV) */}
          {row?.custom_fields && Object.keys(row.custom_fields).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Extra info</h3>
              <dl className="text-sm space-y-1 bg-secondary/40 rounded-lg p-3">
                {Object.entries(row.custom_fields).map(([k, v]) => (
                  <div key={k}>
                    <dt className="inline text-muted-foreground capitalize">{k.replace(/_/g, " ")}: </dt>
                    <dd className="inline text-foreground">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Notes */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h3>
            <div className="flex gap-2 mb-3">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a note about this person…" rows={2}
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground resize-none" />
              <button onClick={addNote} className="px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold self-start py-2">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No notes yet.</p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-lg bg-secondary/60 border border-border text-sm">
                    <p className="text-foreground whitespace-pre-wrap">{n.body}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                      <button onClick={() => deleteNote(n.id)} className="text-xs text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
